"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";
import { freshness, type CompletedRun } from "@/lib/freshness";
import { formatEtClock, formatEtWeekday, formatUtcDate, formatUtcWeekday } from "@/lib/time";

/**
 * PipelineStrip — "is what I am reading current?", answered in one line, loudly only when it should
 * be (NEWS-AND-CONTROL-PLAN Part 4.1, ruling 0.2.7).
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO GO.
 *
 * Module 00 was a full card in the first position of the Desk — the single most valuable slot the
 * phone viewport has — and its entire payload was one date ("Last cloud run — Jul 11") and one fixed
 * sentence that never changed. Worse than the size was the sameness: it looked exactly the same on a
 * healthy night as it did on a night the pipeline had been dead for a week. It was not a freshness
 * indicator. It was a decoration that mentioned freshness.
 *
 * THE RULE THAT REPLACES IT: freshness is prominent IN PROPORTION TO HOW BAD THE NEWS IS.
 *
 *   fresh  → one quiet muted line. No card, no masthead, no icon, no colour.
 *   aging  → amber, and it names the session that went missing AND the data you are looking at
 *            instead. Amber is reserved in this app (P11) and this is precisely what it is reserved
 *            FOR — a genuine alert about a real degradation.
 *   dead   → the loudest surface in the application. A red-bordered banner, undismissable, stating
 *            what every number on the page actually is. Because a silently dead pipeline serving
 *            stale data is the catastrophic failure mode: the app keeps looking authoritative and
 *            keeps being wrong, and nothing on screen says so.
 *   never  → quiet. An empty database is not a dead pipeline; it is one that has not started, and
 *            every module on the Desk already renders its own placeholder saying the data is coming.
 *
 * The escalation is carried by THREE things at once, never by colour alone (P11's redundant
 * encoding): the colour, the word ("stale", "pipeline down"), and the ARIA role — a healthy strip is
 * `status` (polite), a dead one is `alert` (assertive). If the escalation lived only in the hue, a
 * screen-reader user would get the app's calmest voice on its worst night.
 *
 * It is PAGE CHROME, not a ritual station: it mounts inside the Desk header block, above the grid,
 * and it never carries station data. The ritual now runs 01 → 07, and that order is still inviolable
 * — retiring 00 removed a station, it did not reorder the ones that remain.
 */

/**
 * The control room (Part 8, built in N6) will live in Settings under a "Pipeline" section. The strip
 * is its doorway from the moment the strip exists: the anchor resolves to the section once N6 lands
 * it, and lands honestly on Settings until then — the same page, just without the panel yet.
 */
const CONTROL_ROOM = "/settings#pipeline";

/**
 * The doorway's tap target.
 *
 * The plan drew the fresh strip at "~28px tall". That is the right amount of INK — but the whole
 * strip is a link, and a 28px-tall link is a fiddly tap on a phone. The constitution's 44px floor is
 * a non-negotiable and it is not negotiable here either, so the height goes into padding: the strip
 * still reads as one quiet line, and the thumb still gets a target it can hit. (The sweep's inline
 * exception would technically have let a 20px strip through — it exempts a link sitting INSIDE a
 * sentence — but here the sentence IS the link, and leaning on the exception would have been using
 * a rule's letter against its purpose.)
 */
const DOORWAY = "flex min-h-11 items-center underline-offset-2 hover:underline";

/** A bare trading date ("2026-07-10") as the Date its UTC components describe. */
function tradingDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** "Fri, Jul 10" — the session a reader recognises; formatUtcDate carries the weekday itself now (R1). */
function sessionLabel(date: string): string {
  return formatUtcDate(tradingDate(date));
}

/**
 * THE CLOCK RUNS IN THE BROWSER, AND THAT IS THE MOST IMPORTANT LINE IN THIS FILE.
 *
 * The Desk is served from a cache (ISR), which is what makes it fast. But a cache serves a render,
 * and a render carries the clock it was made with. If the strip's grade were computed on the server,
 * it would be graded with the CACHE's clock — and the failure that produces is precisely the one
 * this component exists to prevent:
 *
 *   Monday 8am — a reader visits. The page is regenerated; the pipeline is healthy; the strip is
 *                rendered "fresh", and that render goes into the cache.
 *   Monday 10pm — the pipeline dies. Nothing runs, so nothing calls /api/revalidate, so nothing
 *                touches the cache.
 *   Tuesday 8am — the reader visits. The cached render is stale, so Next serves it AS IS and
 *                regenerates in the background. The reader's first paint says **fresh**.
 *
 * The one surface whose whole job is to catch a dead pipeline would have been silenced by the
 * cache, on exactly the morning it mattered, and it would have taken a reload to notice.
 *
 * The fix is to see what is actually cacheable. The last completed RUN is data: it changes once a
 * night and caching it is correct. "Now" is not data. It is the reader's clock, it is different for
 * every reader and every visit, and it belongs in the browser. So the server sends the run, the
 * server's clock seeds the first paint (so hydration matches its own HTML byte for byte), and the
 * moment the component mounts it regrades against the real clock.
 *
 * On a healthy night the two agree and nothing moves. On a dead night the page shifts as the banner
 * arrives — and that is not a layout-shift bug to be engineered away. That is the page changing
 * loudly on the one night we want it to. (It is also why the CLS gate stays at 0.000: it measures a
 * healthy deployment, where server and browser reach the same verdict.)
 *
 * No timer. Nothing ticks. A poll here would be a clock running inside a suspended PWA webview for
 * a state that changes once a day, and the app does not manufacture that kind of liveness.
 */
export function PipelineStrip({
  run,
  serverNow,
}: {
  /** The newest run that actually finished — the edition on screen. Null if none ever has. */
  run: (Omit<CompletedRun, "finishedAt"> & { finishedAt: string }) | null;
  /** The render clock, as an ISO string, so the first client paint matches the server's HTML. */
  serverNow: string;
}) {
  const [now, setNow] = useState(serverNow);

  /*
   * This is the React-documented way to render something the server cannot know: seed the state
   * with a value the server DID render (so hydration matches its own HTML byte for byte), then
   * correct it on mount. It is what the framework's own "my app renders differently on the client"
   * guidance prescribes.
   *
   * The lint rule below is a heuristic against cascading renders, and it cannot see hydration
   * parity — the very thing that makes this safe. Reading the clock during render instead would
   * produce client HTML that disagrees with the server's and blow up hydration; caching it in a
   * module-level variable would freeze the strip at the first mount of the session, so a tab left
   * open overnight would grade tomorrow's pipeline against yesterday's clock. This runs exactly
   * once, on mount, and then never again — nothing cascades and nothing ticks.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe clock; see above
    setNow(new Date().toISOString());
  }, []);

  const completed = run ? { runDate: run.runDate, finishedAt: new Date(run.finishedAt) } : null;
  const { state, lastGoodSession, finishedAt, expectedSession, nextRunAt } = freshness(
    completed,
    new Date(now),
  );

  // "next: Mon 6:37 PM ET" — 12-hour with AM/PM, the house clock shape since CC2 (ruling R1).
  const next = `${formatEtWeekday(nextRunAt)} ${formatEtClock(nextRunAt)} ET`;

  /* ── DEAD: the one surface in this app allowed to shout ───────────────────────────────────── */
  if (state === "dead" && lastGoodSession) {
    return (
      <div
        role="alert"
        className="mt-4 flex flex-col gap-2 rounded-panel border-2 border-danger bg-danger-wash p-4 sm:flex-row sm:items-baseline sm:gap-3"
      >
        <span className="font-mono text-2xs uppercase tracking-[0.08em] text-danger">
          {copy.strip.deadWord}
        </span>
        <Link href={CONTROL_ROOM} className={cx(DOORWAY, "font-ui text-sm text-ink")}>
          {fill(copy.strip.dead, { lastDay: sessionLabel(lastGoodSession) })}
        </Link>
      </div>
    );
  }

  /* ── AGING: amber, and it names both the missing night and the night you are reading ─────── */
  if (state === "aging" && lastGoodSession && expectedSession) {
    return (
      <p role="status" className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-chip bg-alert-wash px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.08em] text-alert">
          {copy.strip.staleWord}
        </span>
        <Link href={CONTROL_ROOM} className={cx(DOORWAY, "font-ui text-2xs text-ink-2")}>
          {fill(copy.strip.aging, {
            day: formatUtcWeekday(tradingDate(expectedSession)),
            lastDay: formatUtcWeekday(tradingDate(lastGoodSession)),
          })}
        </Link>
      </p>
    );
  }

  /* ── FRESH / NEVER: one quiet line, and nothing else ─────────────────────────────────────── */
  const line =
    state === "fresh" && lastGoodSession && finishedAt
      ? fill(copy.strip.fresh, {
          day: sessionLabel(lastGoodSession),
          time: `${formatEtClock(finishedAt)} ET`,
          next,
        })
      : copy.strip.never;

  return (
    <p role="status" className="font-mono text-2xs text-muted">
      <Link href={CONTROL_ROOM} className={DOORWAY}>
        {line}
      </Link>
    </p>
  );
}
