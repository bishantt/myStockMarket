import type { ReactNode } from "react";

import Link from "next/link";

import { DeltaChip } from "@/components/DeltaChip";
import { SectionMasthead } from "@/components/SectionMasthead";
import { Tag } from "@/components/Tag";
import { TickerChip } from "@/components/TickerChip";
import { copy } from "@/lib/copy";
import { catalystLabel, sourcesLine } from "@/lib/news";
import type { MacroView, MorningPlanView } from "@/lib/morning";

/**
 * MorningPlan — Desk module 02 in morning state (CC9, plan 4.7-presentation; new-surface skill applied).
 *
 * The evening brief is an LLM artifact the gate verifies. The Morning Plan is NOT: it is assembled from
 * live tables, deterministically, so a dawn spends no Anthropic and there is nothing to verify at
 * breakfast (risk 10). Three sections, in the reader's pre-open order:
 *
 *   OVERNIGHT — the stories that crossed the wire since the evening went to press, same card grammar as
 *               the Front Page preview (a headline doorway, a catalyst chip, the source count). No
 *               why-it-matters prose: the dawn's news is facts-only (P9), and a headline claims nothing
 *               a link cannot back.
 *   TODAY'S CALENDAR — today's scheduled catalysts, bmo-first, each with its timing in words ("before
 *               the open", "8:30 AM ET"). The chip, the name, the time — no consensus arithmetic.
 *   WHERE THINGS CLOSED — one line reusing the EVENING's own verified numbers (the S&P close and its
 *               move, the VIX). It invents nothing; it points back at the figures module 01 already
 *               carries, so the morning reader has last night's close without scrolling for it.
 *
 * The evening brief, once published, sits beneath as a collapsed doorway ("Last evening's brief →") on
 * the same page. Every empty state is information, not an apology (the no-shimmer-on-empty law).
 */
export function MorningPlan({
  asOf,
  editionAsOf,
  plan,
  macro,
  closeWeekday,
  lastBrief,
}: {
  asOf: Date;
  /** The edition's own stamp, for the as-of matches/differs treatment (CC4). */
  editionAsOf?: Date;
  plan: MorningPlanView;
  /** The evening's macro view — "Where things closed" reuses its verified S&P and VIX, unchanged. */
  macro: MacroView | null;
  /** The last closed session's weekday ("Thursday") — the window on the close figures. */
  closeWeekday: string;
  /** Last evening's brief, rendered by the caller — collapsed beneath the plan, one tap away. Absent
   *  when no brief was published (a held or missing night). */
  lastBrief?: ReactNode;
}) {
  return (
    <section aria-label="The morning plan">
      <SectionMasthead index={2} title={copy.morningPlan.title} asOf={asOf} editionAsOf={editionAsOf} />

      {/* OVERNIGHT — the stories that crossed the wire since the close. Same grammar as the Front Page. */}
      <div className="pt-4">
        <SubHeading>{copy.morningPlan.overnight}</SubHeading>
        {plan.overnight.length > 0 ? (
          <ul className="flex flex-col gap-3 pt-2">
            {plan.overnight.map((story) => (
              <li
                key={story.id}
                className="flex flex-col gap-1 border-b border-hairline pb-3 last:border-0 last:pb-0"
              >
                <Link
                  href={`/news/${story.id}`}
                  className="flex min-h-11 items-center font-display text-base text-ink underline-offset-2 hover:underline md:min-h-0"
                >
                  {story.headline}
                </Link>
                <span className="flex items-center gap-2">
                  <Tag variant="catalyst">{catalystLabel(story.eventType)}</Tag>
                  <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
                    {sourcesLine(story.sources)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-2 font-prose text-base text-ink-2">{copy.morningPlan.overnightEmpty}</p>
        )}
      </div>

      {/* TODAY'S CALENDAR — today's catalysts, bmo-first, each with its timing in words. */}
      <div className="pt-6">
        <SubHeading>{copy.morningPlan.todayCalendar}</SubHeading>
        {plan.todayCalendar.length > 0 ? (
          <ul className="pt-2">
            {plan.todayCalendar.map((event, index) => (
              <li
                key={`${event.code}-${event.symbol ?? event.title}-${index}`}
                className="flex items-baseline gap-3 border-b border-hairline py-2.5 last:border-b-0"
              >
                <span className="w-24 shrink-0">
                  <Tag variant="catalyst">{event.code}</Tag>
                </span>
                {/* The symbol is spoken once (CC6, D7): the chip already says EARNINGS, the ticker says
                    the name. A macro row has no ticker, so its release name is the title. */}
                <span className="flex min-w-0 flex-1 items-baseline gap-2 truncate font-ui text-sm text-ink-2">
                  {event.symbol ? <TickerChip symbol={event.symbol} /> : event.title}
                  {event.high ? <HighMark /> : null}
                </span>
                {event.timing ? (
                  <span className="shrink-0 font-mono text-2xs text-muted">{event.timing}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-2 font-prose text-base text-ink-2">{copy.morningPlan.todayCalendarEmpty}</p>
        )}
      </div>

      {/* WHERE THINGS CLOSED — one line reusing the evening's verified S&P and VIX. */}
      {macro ? (
        <div className="pt-6">
          <SubHeading>{copy.morningPlan.whereClosed}</SubHeading>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2 font-mono text-sm text-ink-2">
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted">{macro.spx.label}</span>
              <span className="text-ink tabular-nums">{macro.spx.value}</span>
              {macro.spx.deltaPct !== "—" ? (
                <DeltaChip
                  value={macro.spx.deltaPct}
                  direction={macro.spx.direction}
                  window={`${closeWeekday}'s close`}
                />
              ) : null}
            </span>
            {macro.vix !== "—" ? (
              <span className="flex items-baseline gap-1.5">
                <span className="text-muted">VIX</span>
                <span className="text-ink tabular-nums">{macro.vix}</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/*
       * Last evening's brief — collapsed on the same page, one tap away (native <details>, the primitive
       * the Disclosure component itself is built on). Disclosure is not used here on purpose: its `count`
       * is the M2 caveat contract — how many MISSES a fold hides — and the brief is supplementary reading,
       * not a hidden caveat. A count on it would be a number that means nothing.
       */}
      {lastBrief ? (
        <details className="group pt-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center font-ui text-sm text-accent-deep underline-offset-2 hover:underline">
            {copy.morningPlan.lastBrief}
          </summary>
          <div className="pt-4">{lastBrief}</div>
        </details>
      ) : null}
    </section>
  );
}

/** A section label inside the plan — the CC4 section-header grammar (mono 600, uppercase, ink-2). */
function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-ink-2">{children}</h3>
  );
}

/** The high-importance marker: an ink dot and the word. Never a colour, never the loudest thing. */
function HighMark() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span aria-hidden="true" className="inline-block size-1.5 rounded-pill bg-ink" />
      <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
        {copy.calendar.importanceHigh}
      </span>
    </span>
  );
}
