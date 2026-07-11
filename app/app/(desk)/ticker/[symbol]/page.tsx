import Link from "next/link";
import { notFound } from "next/navigation";

import { CandleChart } from "@/components/ticker/CandleChart";
import { VolBandPanel } from "@/components/ticker/VolBandPanel";
import { StatFigure } from "@/components/StatFigure";
import { getTicker } from "@/lib/ticker";
import { db } from "@/lib/db";

/**
 * /ticker/[symbol] — drill level 3, the full page (plan §9.2, route table, §3.7).
 *
 * A server component reads the symbol's bars and hands them to the client chart. The breadcrumb and
 * the always-visible "Back to Desk" rail are the return path the drill promises (level 3 is a real
 * route, so the browser Back button restores the Desk — journey 2). A symbol that is known but has
 * no served bars (a mover the user drilled into) shows an honest note, never a blank chart.
 */

export const dynamic = "force-dynamic";

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol);
  const ticker = await getTicker(decoded);
  if (!ticker) notFound();

  // The empirical vol bands for this symbol's latest run — the one forward-looking number, always
  // shown as a range with its regime-break caveat (VolBandPanel).
  const latestBand = await db.volBand.findFirst({ where: { symbol: decoded }, orderBy: { runDate: "desc" }, select: { runDate: true } });
  const bands = latestBand
    ? await db.volBand.findMany({
        where: { symbol: decoded, runDate: latestBand.runDate },
        select: { horizonDays: true, coverage: true, lo: true, hi: true, label: true },
      })
    : [];

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* The return rail — always visible, so the drill never traps the reader (plan §9.1). */}
      <Link href="/" className="font-ui text-xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent">
        ← Back to Desk
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <h1 className="font-ui text-lg font-bold uppercase tracking-[0.06em] text-ink">{ticker.symbol}</h1>
          <p className="pt-1 font-ui text-sm text-muted">{ticker.name}</p>
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
        <section aria-label="Price and volume">
          <CandleChart candles={ticker.candles} volumes={ticker.volumes} />
        </section>
      ) : null}

      {/* The typical range — empirical vol bands with the mandatory regime-break caveat. */}
      <VolBandPanel bands={bands} />

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
