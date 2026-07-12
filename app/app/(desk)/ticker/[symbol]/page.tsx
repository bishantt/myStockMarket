import Link from "next/link";
import { notFound } from "next/navigation";

import { CandleChart } from "@/components/ticker/CandleChart";
import { RangeBands } from "@/components/ticker/RangeBands";
import { StatFigure } from "@/components/StatFigure";
import { Surface } from "@/components/Surface";
import { getTicker } from "@/lib/ticker";
import { db } from "@/lib/db";

/**
 * /ticker/[symbol] — drill level 3, the full page (§5.5).
 *
 * THE HERO OF THIS PAGE IS NOT A NUMBER. It is the Range Ladder.
 *
 * The price renders at num-lg rather than the 64px hero scale, and that is deliberate: the
 * hero-figure law (one per view) is satisfied by NOT spending it here, which leaves the stage to the
 * ladder — the chart that says, honestly, how uncertain the next twenty days are. A page about a
 * single stock that opens with a giant price is a page teaching the reader to watch the price. This
 * one teaches them to watch the range.
 *
 * A server component reads the symbol's bars and hands them to the client chart. The always-visible
 * "Back to Desk" rail is the return path the drill promises (level 3 is a real route, so the browser
 * Back button restores the Desk — journey 2). A symbol that is known but has no served bars (a mover
 * the reader drilled into) shows an honest note, never a blank chart.
 */

export const dynamic = "force-dynamic";

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);
  const ticker = await getTicker(decoded);
  if (!ticker) notFound();

  // The empirical vol bands for this symbol's latest run — the one forward-looking number, always
  // shown as a range with its regime-break caveat (RangeBands).
  const latestBand = await db.volBand.findFirst({ where: { symbol: decoded }, orderBy: { runDate: "desc" }, select: { runDate: true } });
  const bandRows = latestBand
    ? await db.volBand.findMany({
        where: { symbol: decoded, runDate: latestBand.runDate },
        select: {
          horizonDays: true, coverage: true, lo: true, hi: true, label: true,
          n: true, windowDays: true,
        },
      })
    : [];

  // A band with no sample size cannot be shown: the ladder prints N on every row, and a range
  // without its N is an assertion. Rows written before the column existed are simply dropped.
  const bands = bandRows
    .filter((b) => b.n !== null && b.windowDays !== null)
    .map((b) => ({ ...b, n: b.n as number, windowDays: b.windowDays as number }));

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* The return rail — always visible, so the drill never traps the reader (plan §9.1). */}
      <Link
        href="/"
        className="font-ui text-sm text-ink-2 transition-colors duration-(--duration-quick) hover:text-accent-deep"
      >
        ← Back to Desk
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.08em] text-muted">{ticker.symbol}</p>
          <h1 className="font-display text-display font-bold text-ink">{ticker.name}</h1>
        </div>
        {ticker.lastClose ? (
          <StatFigure
            label="Last close"
            value={ticker.lastClose}
            scale="figure"
            delta={ticker.dayChange ? { value: ticker.dayChange.value, direction: ticker.dayChange.direction } : undefined}
          />
        ) : null}
      </header>

      {ticker.candles.length > 0 ? (
        <Surface as="section" aria-label="Price and volume" className="p-5">
          <CandleChart candles={ticker.candles} volumes={ticker.volumes} />
        </Surface>
      ) : null}

      {/*
       * The Range Ladder — this page's visual centrepiece, and the app's most careful drawing.
       * Nested 50/80 bands per horizon on a signed-return axis, with the honesty furniture as the
       * texture rather than a footnote. No median mark. Nothing joining the rows into a cone.
       */}
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
    </div>
  );
}
