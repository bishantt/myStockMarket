import { Suspense } from "react";
import Link from "next/link";

import { db } from "@/lib/db";
import { buildLedgerView, type PaperTradeRow } from "@/lib/ledger";
import { Surface } from "@/components/Surface";
import { TermProse } from "@/components/Term";
import { costMirrorDrag } from "@/lib/paper";
import { decimal, percent, price } from "@/lib/format";
import { isM3Complete, M3_SLUGS } from "@/lib/academy-progress";
import { PaperEntryIsland } from "@/components/desk/PaperEntryIsland";
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

/**
 * Served from the cache (§5.3 P-1), busted by the paper actions on every write, so the ledger a
 * reader sees is always the ledger their last trade produced.
 *
 * The page no longer reads `searchParams` on the server — that is what made it un-cacheable. The two
 * parameters the ticket needs (`?symbol=`, `?signalViewedAt=`) are read in the client island below.
 */
export const revalidate = 600;

function nowDate(): Date {
  return new Date();
}

/**
 * The ledger rows and the reader's lesson progress, in one parallel stage — and degrading to empty
 * if the database cannot be reached, because this route prerenders now and CI builds with no
 * database at all. An unreadable ledger shows the page's existing empty state; an unreadable
 * progress list simply means the M3 nudge does not fire.
 */
async function paperData() {
  try {
    const [rows, progress] = await Promise.all([
      db.paperTrade.findMany({ orderBy: { openedAt: "desc" } }),
      db.lessonProgress.findMany({ select: { slug: true } }),
    ]);
    return { rows: rows as unknown as PaperTradeRow[], completed: progress.map((r) => r.slug) };
  } catch (error) {
    console.error("PaperPage: could not read the ledger or lesson progress", error);
    return { rows: [] as PaperTradeRow[], completed: [] as string[] };
  }
}

export default async function PaperPage() {
  const { rows, completed } = await paperData();
  const now = nowDate();
  const ledger = buildLedgerView(rows, now);
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
        {/*
         * THE ONLY DOORWAYS IN THIS ROOM ARE UP HERE, IN THE STANDING PROSE (PD6).
         *
         * The plan is explicit that /paper gets a figures AUDIT and no new emphasis (§8.3), and the
         * reason is this room's job: it is the one place in the app where the reader is about to
         * spend money, even simulated money. A ticket decorated with underlines and emphasized
         * numerals is a ticket that is selling something. The cost mirror already says the true and
         * unwelcome thing in plain type, and plain type is exactly how it should say it.
         *
         * So the vocabulary lesson happens in the paragraph that INTRODUCES the room — where "the
         * spread" and "slippage" are being explained to a beginner — and stops at the ticket's edge.
         */}
        <p className="max-w-[62ch] pt-3 font-prose text-base text-ink-2">
          <TermProse text="Practice with simulated money and real friction. Every fill pays the spread and slippage it would in life, so the certain cost of trading is visible before any uncertain gain. No brokerage, no real orders — this is the whole point of the app." />
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

      {/*
       * THE DESK SPREAD FOR /paper (NEWS-AND-CONTROL-PLAN Part 4.3): the ticket in a 5/12 column,
       * and the cost mirror above the ledger in a 7/12 column beside it.
       *
       * The split is not "two things fit". It is that the ticket is where you ACT and the right-hand
       * column is what should be true in your head while you do it: the certain cost of trading at
       * your current pace, and the record of the trades you have already made. Stacked down one
       * column, the cost mirror is something you scroll PAST on the way to the ledger. Beside the
       * ticket, it is in your eye while you fill the form — which is the entire argument for the
       * cost mirror existing.
       *
       * Below `lg:` this is one column and the order is ticket → mirror → ledger, unchanged.
       */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
      <section aria-label="Place a paper trade" className="lg:col-span-5">
        <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">New paper trade</h2>
        <div className="mt-2 h-px bg-hairline" />
        {/*
         * useSearchParams() suspends during prerendering, so the ticket sits behind a boundary and
         * the rest of the page stays static. The fallback reserves the form's height rather than
         * collapsing to nothing — a shell that grows when the form arrives would shove the cost
         * mirror and the ledger down the page (budget B5). Same pattern, same reason, as /login.
         */}
        <Suspense fallback={<div className="h-[420px]" aria-hidden="true" />}>
          <PaperEntryIsland />
        </Suspense>
      </section>

      <div className="flex flex-col gap-8 lg:col-span-7">
      {/*
       * COST MIRROR — the app's most honest artifact, and it is styled like what it is: a receipt.
       *
       * Dashed tape edges, the factors right-aligned in mono the way a register prints them, a rule,
       * and then the total — set large, in loss colour, with the WORD "drag" beside it so the
       * meaning never rides on colour alone.
       *
       * The punchline lands with the weight of a bill because it IS one. This is the number nobody
       * shows a beginner: the cost of trading at this pace, paid whether the trades win or lose,
       * certain in a way that no edge on this Desk is certain. It is deliberately the largest thing
       * on this page.
       *
       * (The P&L-is-never-the-hero rule is intact: this is a COST, on /paper, at num-lg rather than
       * the 64px hero scale.)
       */}
      <Surface level="tinted" as="section" aria-label="Cost mirror" className="max-w-[62ch] p-6">
        <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Cost mirror
        </h2>

        <div className="mt-4 border-y-2 border-dashed border-hairline-strong py-4">
          <dl className="flex flex-col gap-2">
            <ReceiptLine
              label={`Round trips this week (${ledger.roundTripsThisWeek})`}
              value={`${turnoverPerYear} / yr at this pace`}
            />
            <ReceiptLine
              label="Average round-trip cost"
              value={`${decimal(avgRoundTripBps, 0)} bps`}
            />
            <ReceiptLine
              label="Projected annual drag"
              value={`${decimal(drag.annualDragBps, 0)} bps`}
            />
          </dl>
        </div>

        <div className="flex items-baseline justify-between gap-4 pt-4">
          <span className="font-ui text-sm text-muted">Paid whether the trades win or lose</span>
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-num-lg text-down-text">
              −{percent(drag.annualDragFraction, 1)}
            </span>
            <span className="font-ui text-sm font-semibold text-down-text">/ yr drag</span>
          </span>
        </div>

        {ledger.frequencyMirrorTriggered ? (
          // The frequency mirror stays plain prose — never amber. Amber is reserved for something
          // DEGRADED (the consumer register is check-drift.mjs's ALERT_ALLOWED); a behavioural
          // nudge is not a degradation, and dressing one as an alert is how urgency gets
          // manufactured.
          <p className="max-w-[58ch] pt-4 font-prose text-base text-ink">
            You have made more than five paper round trips this week. The most active retail traders
            underperform by about their trading costs — worth sitting on the next one until tomorrow.
          </p>
        ) : null}
      </Surface>

      <section aria-label="Ledger">
        <h2 className="flex items-baseline gap-3 font-ui text-xs font-bold uppercase tracking-[0.07em] text-ink">
          <span>Ledger</span>
          <span className="font-mono font-medium text-muted">
            realized {ledger.totalRealizedPnl >= 0 ? "+" : "−"}
            {price(Math.abs(ledger.totalRealizedPnl))}
          </span>
        </h2>
        <div className="mt-2 h-px bg-hairline" />
        <PaperLedger open={ledger.openTrades} closed={ledger.closedTrades} />
      </section>
      </div>
      </div>
    </div>
  );
}

/** One factor on the receipt tape: the label on the left, the figure right-aligned in mono. */
function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-ui text-sm text-muted">{label}</dt>
      <dd className="shrink-0 font-mono text-sm text-ink-2">{value}</dd>
    </div>
  );
}
