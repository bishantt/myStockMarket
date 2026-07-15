import { db } from "@/lib/db";
import { directionOf, price, signedPercent } from "@/lib/format";
import { computeRangeStrip, type RangeStripData } from "@/lib/ticker-depth";
import type { Direction } from "@/components/StatFigure";

/**
 * ticker.ts — the data behind the /ticker/[symbol] drill (plan §9.2 level 3, §3.7 charts).
 *
 * The route reads a symbol's daily bars from the serving database and hands them to the Lightweight
 * Charts hook as candle and volume series. Only the SERVED symbols (indices, sector ETFs, and the
 * watchlist) have bars in Postgres — the full universe lives in the Parquet lake on R2 — so a
 * symbol with no bars (a mover the user drilled into) renders an honest "no chart data" state
 * rather than an empty grid pretending to be a chart.
 *
 * The transform is a pure function (barsToSeries) so it is unit-tested without a database; getTicker
 * is the input/output shell that reads the rows and computes the header figures through lib/format.
 */

/** One candle in the shape Lightweight Charts v5 expects (business-day time string). */
export type Candle = { time: string; open: number; high: number; low: number; close: number };

/** One volume bar; `up` (close ≥ open) lets the chart colour it with the redundant Wong pair. */
export type VolumeBar = { time: string; value: number; up: boolean };

/** A daily bar as it comes from the price_bar table. */
type BarRow = { date: Date; open: number; high: number; low: number; close: number; vol: number | bigint };

/** Everything the ticker page renders for a symbol. */
export type TickerData = {
  symbol: string;
  name: string;
  /** Identity fields (PD8 block 1): the exchange, sector and industry the schema holds. Each is
   *  absent (null) rather than a faked "N/A". Market cap is NOT here — the schema has no size data. */
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  candles: Candle[];
  volumes: VolumeBar[];
  /** The most recent close, already formatted, or null when there are no bars. */
  lastClose: string | null;
  /** The raw last close, for marking open paper positions live (block 7). Null when there are no bars. */
  lastCloseValue: number | null;
  /** The latest day change, already formatted and signed, or null when there are fewer than two bars. */
  dayChange: { value: string; direction: Direction } | null;
  /** The 52-week strip (PD8 block 2), computed from the served closes. Null when there are too few. */
  rangeStrip: RangeStripData | null;
};

/** A US business day string (YYYY-MM-DD). price_bar dates are stored at UTC midnight, so the ISO
 * date slice is the trading day with no timezone arithmetic. */
function businessDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Split daily bars into the candle and volume series the chart hook consumes. Pure. */
export function barsToSeries(bars: BarRow[]): { candles: Candle[]; volumes: VolumeBar[] } {
  const candles: Candle[] = [];
  const volumes: VolumeBar[] = [];
  for (const b of bars) {
    const time = businessDay(b.date);
    candles.push({ time, open: b.open, high: b.high, low: b.low, close: b.close });
    volumes.push({ time, value: Number(b.vol), up: b.close >= b.open });
  }
  return { candles, volumes };
}

/**
 * Load a symbol's ticker view. Returns null when the symbol is not in the universe at all; returns
 * a data object with empty series (and the header figures null) when the symbol is known but has no
 * served bars, so the page can say "no chart data" honestly.
 *
 * The two reads run in PARALLEL (§5.3 P-2). They used to be awaited one after the other, which read
 * naturally — look the instrument up, then fetch its bars — but the second query never actually used
 * the first one's result: it filters on the symbol we already had. So the sequence bought nothing
 * and cost a full cross-region round trip, every time. The instrument check still gates the return;
 * it just no longer gates the request.
 */
export async function getTicker(symbol: string): Promise<TickerData | null> {
  const normalized = symbol.trim().toUpperCase();
  try {
    const [instrument, bars] = await Promise.all([
      db.instrument.findUnique({
        where: { symbol: normalized },
        select: { symbol: true, name: true, exchange: true, sector: true, industry: true },
      }),
      db.priceBar.findMany({
        where: { symbol: normalized },
        orderBy: { date: "asc" },
        select: { date: true, open: true, high: true, low: true, close: true, vol: true },
      }),
    ]);
    if (!instrument) return null;

    const { candles, volumes } = barsToSeries(bars);
    const lastBar = bars.length > 0 ? bars[bars.length - 1] : null;

    return {
      symbol: instrument.symbol,
      name: instrument.name,
      exchange: instrument.exchange,
      sector: instrument.sector,
      industry: instrument.industry,
      candles,
      volumes,
      lastClose: lastBar ? price(lastBar.close) : null,
      lastCloseValue: lastBar ? lastBar.close : null,
      dayChange: dayChangeOf(bars),
      // The strip runs through the last bar's own trading day, not "today" — the same C6 rule the
      // chart caption keeps: the only honest source for "through when" is the data.
      rangeStrip: lastBar
        ? computeRangeStrip(bars.map((bar) => bar.close), businessDay(lastBar.date))
        : null,
    };
  } catch (error) {
    console.error(`getTicker: could not load ${normalized}`, error);
    return null;
  }
}

/** One row of the empirical vol bands, as the Range Ladder consumes them. */
export type VolBandRow = {
  horizonDays: number;
  coverage: number;
  lo: number;
  hi: number;
  label: string;
  n: number | null;
  windowDays: number | null;
};

/**
 * The latest run's vol bands for a symbol, in ONE query (§5.3 P-2).
 *
 * This replaces a genuine two-step: find the newest runDate, then fetch that run's rows. Those two
 * really were dependent — the second filtered on the first's answer — so they could not simply be
 * put in a Promise.all, and an earlier draft of the plan that claimed otherwise was wrong on the
 * arithmetic. The fix is to not ask twice: take the most recent rows and keep the ones sharing the
 * newest runDate in JavaScript.
 *
 * Twelve rows is deliberate slack. A run publishes at most three horizons × two coverages = six
 * rows per symbol, so twelve reaches back through the previous run as well — enough that the newest
 * run is always complete inside the window, without reading the symbol's whole history.
 */
export async function getLatestVolBands(symbol: string): Promise<VolBandRow[]> {
  const normalized = symbol.trim().toUpperCase();
  try {
    const rows = await db.volBand.findMany({
      where: { symbol: normalized },
      orderBy: { runDate: "desc" },
      take: 12,
      select: {
        runDate: true,
        horizonDays: true,
        coverage: true,
        lo: true,
        hi: true,
        label: true,
        n: true,
        windowDays: true,
      },
    });
    if (rows.length === 0) return [];

    const newest = rows[0].runDate.getTime();
    return rows
      .filter((row) => row.runDate.getTime() === newest)
      .map((row) => {
        const { runDate, ...band } = row;
        void runDate; // the row is filtered by it above; the ladder does not render it
        return band;
      });
  } catch (error) {
    console.error(`getLatestVolBands: could not load bands for ${normalized}`, error);
    return [];
  }
}

/** The latest day change from the last two closes, or null when there is not enough history. */
function dayChangeOf(bars: BarRow[]): { value: string; direction: Direction } | null {
  if (bars.length < 2) return null;
  const latest = bars[bars.length - 1].close;
  const prev = bars[bars.length - 2].close;
  const delta = (latest - prev) / prev;
  return { value: signedPercent(delta), direction: directionOf(delta) };
}
