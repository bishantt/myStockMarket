import Link from "next/link";
import { notFound } from "next/navigation";

import { CandleChartLoader } from "@/components/ticker/CandleChartLoader";
import { RangeBands } from "@/components/ticker/RangeBands";
import { StatFigure } from "@/components/StatFigure";
import { Surface } from "@/components/Surface";
import { getLatestVolBands, getTicker } from "@/lib/ticker";

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

/**
 * Cached per symbol, rendered on demand the first time each one is asked for (§5.3 P-1).
 *
 * This was the slowest page in the app: 1237ms, because it awaited FOUR database queries one after
 * another and each one crossed the country. Now the loader is a single parallel stage (P-2), and the
 * result is cached, so the reader pays it once per symbol per publish rather than once per tap.
 */
export const revalidate = 600;

/**
 * The empty array is not a placeholder — it is what turns runtime ISR ON for this route.
 *
 * The pinned framework's own documentation is explicit, and it is the kind of detail that silently
 * costs you the entire benefit: "You must always return an array from generateStaticParams, even if
 * it's empty. Otherwise, the route will be dynamically rendered." An earlier draft of the plan
 * omitted this and would have shipped a `revalidate` that never cached a thing, with the flagship
 * budget failing forever and no obvious reason why.
 *
 * Empty, specifically, because there is no useful set to prerender: the universe is ~6,000 symbols
 * and the reader visits a handful. Each one renders once, on first request, and is cached from then
 * on. Unknown symbols still 404 through the existing notFound().
 */
export async function generateStaticParams(): Promise<{ symbol: string }[]> {
  return [];
}

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);

  // One parallel stage instead of four sequential round trips. The bands do not depend on the
  // ticker, and never did — they were simply awaited after it.
  const [ticker, bandRows] = await Promise.all([getTicker(decoded), getLatestVolBands(decoded)]);
  if (!ticker) notFound();

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
          <CandleChartLoader candles={ticker.candles} volumes={ticker.volumes} />
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
