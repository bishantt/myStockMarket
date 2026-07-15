import Link from "next/link";
import { notFound } from "next/navigation";

import { RangeBands } from "@/components/ticker/RangeBands";
import { RangeStrip } from "@/components/ticker/RangeStrip";
import { TickerCalendar, TickerMention, TickerPaper } from "@/components/ticker/TickerBlocks";
import { TickerChart } from "@/components/ticker/TickerChart";
import { SymbolRecord } from "@/components/SymbolRecord";
import { StatFigure } from "@/components/StatFigure";
import { Surface } from "@/components/Surface";
import { copy, fill } from "@/lib/copy";
import { getLatestVolBands, getTicker } from "@/lib/ticker";
import { getTickerCalendar, getTickerMention, getTickerPaper } from "@/lib/ticker-depth";
import { getSymbolRecord, hasRecord } from "@/lib/record";
import { formatUtcDate, formatUtcWeekday } from "@/lib/time";

/**
 * TickerPageBody — the instrument room v2, as ONE server component (PD9, plan 11.1 / E9).
 *
 * PD8 built this as the body of /ticker/[symbol]/page.tsx. PD9 lifts it out unchanged so the
 * standalone page (hard load / shared link) and the intercepting @modal overlay (a tap on a
 * TickerChip door, opening over the live room) render the SAME tree. That identity is E9's
 * guarantee, and the reload-while-open e2e depends on it: the sheet's DOM and the page's DOM must be
 * content-identical, which is only true when they are literally the same component. The sheet chrome
 * is DetailOverlay's job; this body does not know it is in a sheet.
 *
 * THE HERO OF THIS PAGE IS STILL THE RANGE LADDER. Every block names its own absence (P9); a served
 * name shows the price blocks, a non-served name honestly omits them and still shows identity, the
 * night's mention, our record, its calendar and any paper position. Market cap appears nowhere (the
 * schema has no size data, and the page does not fake it). See the block comments below — unchanged
 * from PD8 in what they SAY; PD9 changed only where the code lives.
 */

type TickerPageBodyProps = { symbol: string };

export async function TickerPageBody({ symbol }: TickerPageBodyProps) {
  const decoded = decodeURIComponent(symbol);

  // Six reads, one parallel stage (block 4–7 are one Prisma round each). The record is REUSE of the
  // honesty components; the mention/calendar/paper are user- and pipeline-state the schema holds.
  const [ticker, bandRows, record, mention, calendar, paper] = await Promise.all([
    getTicker(decoded),
    getLatestVolBands(decoded),
    getSymbolRecord(decoded),
    getTickerMention(decoded),
    getTickerCalendar(decoded),
    getTickerPaper(decoded),
  ]);
  if (!ticker) notFound();

  // A band with no sample size cannot be shown: the ladder prints N on every row, and a range
  // without its N is an assertion. Rows written before the column existed are simply dropped.
  const bands = bandRows
    .filter((b) => b.n !== null && b.windowDays !== null)
    .map((b) => ({ ...b, n: b.n as number, windowDays: b.windowDays as number }));

  // The last session the chart shows — read from the last bar, never from "today" (ruling C6). The
  // bare trading date formats from its UTC components; reading it in ET would print the day before.
  const lastBar = ticker.candles.at(-1);
  const chartThrough = lastBar
    ? `${formatUtcWeekday(new Date(`${lastBar.time}T00:00:00Z`))} ${formatUtcDate(new Date(`${lastBar.time}T00:00:00Z`))}`
    : "—";

  const identity = [ticker.exchange, ticker.sector, ticker.industry]
    .filter((field): field is string => Boolean(field))
    .join(copy.ticker.identitySeparator);

  const hasPaper = paper.open.length > 0 || paper.realized.count > 0;

  return (
    <div className="flex flex-col gap-6 py-6">
      {/*
       * The return rail — always visible, so the drill never traps the reader (plan §9.1). min-h-11
       * because it was 20px tall, and this is the ONE control that promises the reader they can get
       * back. A sweep is only as honest as its route list — which is exactly what its own comment says.
       */}
      <Link
        href="/"
        className="flex min-h-11 w-fit items-center font-ui text-sm text-ink-2 transition-colors duration-(--duration-quick) hover:text-accent-deep"
      >
        ← Back to Desk
      </Link>

      {/* Block 1 — the header and identity line. Last close is num-lg, not the hero scale: the hero
          is the ladder, satisfied by NOT spending the hero figure here. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-sm uppercase tracking-[0.08em] text-muted">{ticker.symbol}</p>
          <h1 className="font-display text-display font-bold text-ink">{ticker.name}</h1>
          {identity ? (
            <p className="font-ui text-sm text-muted">{identity}</p>
          ) : null}
        </div>
        {ticker.lastClose ? (
          <StatFigure
            label="Last close"
            value={ticker.lastClose}
            scale="figure"
            delta={
              ticker.dayChange
                ? {
                    value: ticker.dayChange.value,
                    direction: ticker.dayChange.direction,
                    window: copy.ticker.lastCloseWindow,
                  }
                : undefined
            }
          />
        ) : null}
      </header>

      {/* Block 2 — the 52-week strip (served names). One thin band, position not angle, data-p2. */}
      {ticker.rangeStrip ? (
        <Surface as="section" aria-label="Price range" className="p-4 desk:p-5">
          <RangeStrip strip={ticker.rangeStrip} />
        </Surface>
      ) : null}

      {/* Block 3 — the chart and the Range Ladder (the hero). Both unchanged from before PD8. */}
      {ticker.candles.length > 0 ? (
        <Surface as="section" aria-label="Price and volume" className="p-5">
          <TickerChart candles={ticker.candles} volumes={ticker.volumes} through={chartThrough} />
        </Surface>
      ) : null}

      {bands.length > 0 ? (
        <Surface as="section" className="p-5 desk:p-6">
          <RangeBands bands={bands} />
        </Surface>
      ) : null}

      {ticker.candles.length === 0 ? (
        <p className="font-ui text-sm text-muted">
          No chart data. This name sits outside the served set — the indices, the sector ETFs, and
          the names on your watchlist. Add it to your watchlist to have the nightly pipeline serve
          its bars.
        </p>
      ) : null}

      {/* Block 4 — tonight's mention. Absent silently when the name is in no cluster. */}
      {mention ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.ticker.mentionHeading}</h2>
          <TickerMention mention={mention} />
        </section>
      ) : null}

      {/* Block 5 — the record here. Active signals, the setup card's base rate (N-gated), resolved
          hits and misses at equal weight. Absent when the ledger is silent — zero new probability UI. */}
      {hasRecord(record) ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">{copy.ticker.recordHeading}</h2>
          <SymbolRecord record={record} />
        </section>
      ) : null}

      {/* Block 6 — on the calendar. This name's dated events, next 30 days. Absent when it has none. */}
      {calendar.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.ticker.calendarHeading}</h2>
          <TickerCalendar rows={calendar} />
        </section>
      ) : null}

      {/* Block 7 — the paper position. Open rows marked live, plus realized history. Absent when
          the reader holds nothing on this name. */}
      {hasPaper ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.ticker.paperHeading}</h2>
          <TickerPaper paper={paper} lastCloseValue={ticker.lastCloseValue} />
        </section>
      ) : null}

      {/* Block 8 — the provenance footer, composed from what actually rendered (C6). */}
      <footer className="border-t border-hairline pt-3">
        <p className="font-ui text-2xs text-muted">
          {lastBar ? `${fill(copy.ticker.provenanceBars, { date: chartThrough })} · ` : ""}
          {copy.ticker.provenanceLedger}
        </p>
      </footer>
    </div>
  );
}
