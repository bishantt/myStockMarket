import Link from "next/link";

import { db } from "@/lib/db";
import { buildLedgerView, type PaperTradeRow } from "@/lib/ledger";
import { costMirrorDrag } from "@/lib/paper";
import { isM3Complete, M3_SLUGS } from "@/lib/academy-progress";
import { PaperEntryForm } from "@/components/desk/PaperEntryForm";
import { PaperLedger } from "@/components/desk/PaperLedger";

/**
 * /paper — the paper-trading desk (plan §7 P6 step 1–2, §9.2 paper corner).
 *
 * Paper trades are the only orders the app places. The page pairs the ledger with its friction
 * surfaces: the cost mirror (projected annual drag = spread × turnover), the frequency mirror (a note
 * when the week's round trips exceed five), and — on the entry form — the cooling-off interstitial. It
 * is soft-gated on Academy M3: sizing and risk come before placing orders, so an unfinished M3 shows a
 * suggestion to read it first (a nudge, never a lock).
 */

export const dynamic = "force-dynamic";

function nowDate(): Date {
  return new Date();
}

export default async function PaperPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; signalViewedAt?: string }>;
}) {
  const params = await searchParams;
  const rows = (await db.paperTrade.findMany({ orderBy: { openedAt: "desc" } })) as unknown as PaperTradeRow[];
  const now = nowDate();
  const ledger = buildLedgerView(rows, now);

  const completed = (await db.lessonProgress.findMany({ select: { slug: true } })).map((r) => r.slug);
  const m3Done = isM3Complete(completed);

  // Cost mirror: a round trip pays the cost twice (entry + exit). Project the observed weekly pace
  // out over a year against the average round-trip cost, so the certain drag is visible.
  const closed = ledger.closedTrades;
  const avgRoundTripBps =
    closed.length > 0 ? (closed.reduce((s, t) => s + t.costBps * 2, 0) / closed.length) : 30;
  const turnoverPerYear = ledger.roundTripsThisWeek * 52;
  const drag = costMirrorDrag({ roundTripsPerYear: turnoverPerYear, effectiveSpreadBps: avgRoundTripBps });

  return (
    <div className="flex flex-col gap-8">
      <header className="pt-3">
        <h1 className="font-ui text-xl font-bold uppercase tracking-[0.06em] text-ink">
          Paper desk
        </h1>
        <div className="mt-2 h-0.5 bg-ink" />
        <p className="max-w-[62ch] pt-3 font-prose text-base text-ink-2">
          Practice with simulated money and real friction. Every fill pays the spread and slippage it
          would in life, so the certain cost of trading is visible before any uncertain gain. No
          brokerage, no real orders — this is the whole point of the app.
        </p>
      </header>

      {!m3Done ? (
        <aside className="max-w-[62ch] rounded-panel border border-hairline p-4" aria-label="Suggested order">
          <p className="font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-ink">Risk before orders</p>
          <p className="pt-1.5 font-prose text-sm text-ink-2">
            The Academy suggests finishing{" "}
            <Link href={`/academy/${M3_SLUGS[0]}`} className="text-accent underline underline-offset-2">
              module M3 — the risk lessons
            </Link>{" "}
            before placing paper orders, so sizing and expectancy come first. You may still trade now.
          </p>
        </aside>
      ) : null}

      <section aria-label="Place a paper trade">
        <h2 className="font-ui text-xs font-bold uppercase tracking-[0.07em] text-ink">New paper trade</h2>
        <div className="mt-2 h-px bg-hairline" />
        <PaperEntryForm
          defaultSymbol={params.symbol ?? ""}
          signalViewedAt={params.signalViewedAt ?? null}
        />
      </section>

      {/* COST MIRROR — the arithmetic, spelled out (plan §8.1). */}
      <section aria-label="Cost mirror" className="max-w-[62ch]">
        <h2 className="font-ui text-xs font-bold uppercase tracking-[0.07em] text-ink">Cost mirror</h2>
        <div className="mt-2 h-px bg-hairline" />
        <p className="pt-3 font-prose text-base text-ink-2">
          At {ledger.roundTripsThisWeek} round trip{ledger.roundTripsThisWeek === 1 ? "" : "s"} this week
          ({turnoverPerYear} a year at this pace) and an average round-trip cost of{" "}
          {avgRoundTripBps.toFixed(0)} basis points, the projected annual drag is{" "}
          <span className="font-mono text-ink">{drag.annualDragBps.toFixed(0)} bps</span> —{" "}
          <span className="font-mono text-ink">{(drag.annualDragFraction * 100).toFixed(2)}%</span> of
          capital, paid whether the trades win or lose.
        </p>
        {ledger.frequencyMirrorTriggered ? (
          <p className="pt-2 font-prose text-base text-ink">
            You have made more than five paper round trips this week. The most active retail traders
            underperform by about their trading costs — worth sitting on the next one until tomorrow.
          </p>
        ) : null}
      </section>

      <section aria-label="Ledger">
        <h2 className="flex items-baseline gap-3 font-ui text-xs font-bold uppercase tracking-[0.07em] text-ink">
          <span>Ledger</span>
          <span className="font-mono font-medium text-muted">
            realized {ledger.totalRealizedPnl >= 0 ? "+" : "−"}
            {Math.abs(ledger.totalRealizedPnl).toFixed(2)}
          </span>
        </h2>
        <div className="mt-2 h-px bg-hairline" />
        <PaperLedger open={ledger.openTrades} closed={ledger.closedTrades} />
      </section>
    </div>
  );
}
