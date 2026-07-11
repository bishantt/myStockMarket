import { db } from "@/lib/db";
import { directionOf, price, signedPercent } from "@/lib/format";
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
  candles: Candle[];
  volumes: VolumeBar[];
  /** The most recent close, already formatted, or null when there are no bars. */
  lastClose: string | null;
  /** The latest day change, already formatted and signed, or null when there are fewer than two bars. */
  dayChange: { value: string; direction: Direction } | null;
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
 */
export async function getTicker(symbol: string): Promise<TickerData | null> {
  const normalized = symbol.trim().toUpperCase();
  try {
    const instrument = await db.instrument.findUnique({
      where: { symbol: normalized },
      select: { symbol: true, name: true },
    });
    if (!instrument) return null;

    const bars = await db.priceBar.findMany({
      where: { symbol: normalized },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, vol: true },
    });
    const { candles, volumes } = barsToSeries(bars);

    return {
      symbol: instrument.symbol,
      name: instrument.name,
      candles,
      volumes,
      lastClose: bars.length > 0 ? price(bars[bars.length - 1].close) : null,
      dayChange: dayChangeOf(bars),
    };
  } catch (error) {
    console.error(`getTicker: could not load ${normalized}`, error);
    return null;
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
