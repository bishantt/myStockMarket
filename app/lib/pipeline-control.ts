import {
  NEWS_RUN_COST_USD,
  RUN_ACTIONS,
  RUN_CAPS,
  RUN_LOOKUP_TIMEOUT_SECONDS,
  type RunAction,
} from "@/lib/constants";
import { copy, fill } from "@/lib/copy";
import { price } from "@/lib/format";
import type { CompletedRun } from "@/lib/freshness";
import {
  etDateOf,
  holidayName,
  isTradingDay,
  marketState,
  nextTradingDay,
  previousTradingDay,
} from "@/lib/market-hours";
import { formatEtClock, formatWeekdayLong } from "@/lib/time";

/**
 * pipeline-control.ts — what the reader may run by hand, and (far more often) why they may not.
 *
 * THE ARGUMENT THIS FILE IS BUILT ON (plan 8.1, and it is worth re-reading before adding a button).
 *
 * The commission asked for user-triggered pipeline runs. The honest evaluation narrowed it: this is
 * an end-of-day product, and on a normal weeknight the pipeline HAS ALREADY RUN. A manual re-run
 * then would recompute byte-identical data — so **for that case the honest control is the
 * EXPLANATION, not the button.** Four cases earn a real button: a failed or missed nightly (the
 * recovery case), a news re-fetch, a macro refresh, and a scan recompute.
 *
 * So most of the time this panel is a short piece of writing rather than a row of controls, and the
 * sentences are the feature. A button that is present but pointless invites a press that changes
 * nothing — and a product that lets you do a pointless thing and then says nothing about it has
 * lied to you about what you just did.
 *
 * Everything here is a PURE FUNCTION of four inputs: the manual-run ledger, the last completed
 * pipeline run, the clock, and whether the GitHub token exists. No database, no network, no `new
 * Date()` inside. That is what lets every state the reader can ever reach be pinned by a unit test.
 */

/** One row of the app's own manual-run ledger (`manual_run`), as the panel needs it. */
export type ManualRunRow = {
  id: string;
  action: RunAction;
  requestedAt: Date;
  status: "requested" | "queued" | "running" | "succeeded" | "failed";
  /**
   * The GitHub run, once we have managed to find it. Null until then — see `isLost` below.
   *
   * A STRING, not the `bigint` Prisma hands back, and the conversion happens at the database
   * boundary on purpose. `JSON.stringify` THROWS on a bigint ("Do not know how to serialize a
   * BigInt"), and this row is read by a polling API route that serializes its answer on every tick.
   * The panel would have died on the first successfully-found run — which is to say, on exactly the
   * happy path, and only in production, since the unit tests never serialize anything.
   *
   * The id is only ever used to build a link, so a string is also simply what it is.
   */
  ghRunId: string | null;
  finishedAt: Date | null;
};

export type RunState =
  /** Press it. */
  | { kind: "available" }
  /** Ran too recently to tell you anything new. */
  | { kind: "cooldown"; availableAt: Date }
  /** Today's allowance is spent. */
  | { kind: "capped" }
  /** There is no button, and this sentence is why (C5). */
  | { kind: "not_applicable"; reason: string }
  /** Dispatched; GitHub has not created the run yet. Normal, and brief. */
  | { kind: "requested" }
  /** Behind the scheduled run in the concurrency group. */
  | { kind: "queued" }
  | { kind: "running"; since: Date; runUrl: string | null }
  /** Dispatched, and the run never appeared. See the long note below — this state is the point. */
  | { kind: "lost" }
  | { kind: "failed"; runUrl: string | null }
  /** Another run is in flight; runs are serialized. */
  | { kind: "blocked" }
  /** P-2 is not provisioned. */
  | { kind: "not_configured" };

export type ActionRow = {
  action: RunAction;
  label: string;
  description: string;
  state: RunState;
  /** "1 of 2 left today" — null when a cap line would be noise (a state with no button). */
  capLine: string | null;
};

export type ControlInput = {
  runs: ManualRunRow[];
  lastRun: CompletedRun | null;
  now: Date;
  tokenConfigured: boolean;
};

/** The GitHub repo the runs live in — only ever used to build a link the reader can click. */
const REPO = "bishantt/myStockMarket";

function runUrl(ghRunId: string | null): string | null {
  return ghRunId === null ? null : `https://github.com/${REPO}/actions/runs/${ghRunId}`;
}

/** A run the panel is still waiting on. */
const IN_FLIGHT: ReadonlySet<ManualRunRow["status"]> = new Set(["requested", "queued", "running"]);

/**
 * Is this run still genuinely in flight, or have we simply lost it?
 *
 * THE SILENT FAILURE THIS EXISTS TO PREVENT — and it is the hazard this whole phase was warned
 * about, because N6's buttons have exactly the property that a run which did nothing and a run that
 * was never dispatched look identical from the couch.
 *
 * The dispatch API answers **204 No Content with an empty body** (recorded against the live API on
 * 2026-07-13; the plan claimed it returns a `workflow_run_id`, and GitHub's own REST docs claim it
 * too — both are wrong). There is no run id in the response. So the app dispatches, and then has to
 * HUNT for its run by matching the request id in the run's name.
 *
 * That hunt normally succeeds within a second or two. When it does not — a revoked token, a renamed
 * workflow, a GitHub incident — the run may not exist at all. If the panel kept showing "requested…"
 * the reader would watch a spinner forever for a run that will never come, and nothing anywhere
 * would say so. So the absence is counted, and after the timeout it is SAID OUT LOUD.
 */
function isLost(run: ManualRunRow, now: Date): boolean {
  if (run.status !== "requested" || run.ghRunId !== null) return false;
  const age = (now.getTime() - run.requestedAt.getTime()) / 1000;
  return age > RUN_LOOKUP_TIMEOUT_SECONDS;
}

/** The newest run of an action, or undefined. The ledger is read newest-first. */
function newestRun(runs: ManualRunRow[], action: RunAction): ManualRunRow | undefined {
  return runs
    .filter((r) => r.action === action)
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())[0];
}

/**
 * How many runs of an action have been requested TODAY, counted on the ET calendar.
 *
 * In ET, not UTC, and that is not a detail. The caps reset at midnight ET (the reader lives on
 * market time). A run fired at 11pm ET on Monday is already Tuesday in UTC — count it in UTC and
 * Tuesday's reader silently loses part of their allowance to Monday's spending.
 *
 * Every requested run counts, INCLUDING the failed ones. A news run that died halfway still called
 * Marketaux and still spent its ~20 requests of a 100-a-day budget. A cap that forgave failures
 * would quietly stop protecting the thing it was sized around.
 */
function spentToday(runs: ManualRunRow[], action: RunAction, now: Date): number {
  const today = etDateOf(now);
  return runs.filter((r) => r.action === action && etDateOf(r.requestedAt) === today).length;
}

/**
 * Why `full` cannot run right now — or null if it can.
 *
 * `full` is the ONLY action with real reasons to refuse, because it is the only one that ingests
 * the market. The other four (news, macro, compute, briefing) touch no price and depend on no
 * session having closed, which is precisely why plan 8.1 found they earn real buttons.
 *
 * The order of these checks is the order of their truth. A weekend is a more fundamental fact than
 * a cooldown, and the reader should be told the real reason rather than the first one we happened
 * to check.
 */
function whyFullCannotRun(lastRun: CompletedRun | null, now: Date): string | null {
  const today = etDateOf(now);

  // Not a session at all — no close will happen today, so no new data can exist.
  if (!isTradingDay(today)) {
    const lastSession = previousTradingDay(today);
    const nextSession = nextTradingDay(today);
    const holiday = holidayName(today);

    if (holiday) {
      return fill(copy.control.naHoliday, {
        name: holiday,
        lastDay: formatWeekdayLong(lastSession),
        nextDay: formatWeekdayLong(nextSession),
      });
    }
    return fill(copy.control.naWeekend, {
      lastDay: formatWeekdayLong(lastSession),
      nextDay: formatWeekdayLong(nextSession),
    });
  }

  // The market is open: today's closing data does not exist yet. Running now would ingest a
  // half-formed bar and write it over the last good close. This is the case plan 8.1 calls
  // "impossible by design", and it is the reason the mode guard in job_a.py exists.
  if (marketState(now) === "open") {
    return fill(copy.control.naMarketOpen, { nightly: "6:37pm" });
  }

  // The close has happened. Did tonight's edition already land? If so there is nothing newer to
  // fetch, and the honest control is this sentence rather than a button that recomputes the same
  // bytes. If NOT — the nightly failed, or has not fired yet — this is the recovery case, which is
  // reason (a) in plan 8.1 and the single most valuable button on this panel.
  if (lastRun && lastRun.runDate === today) {
    // ET, always — the app has exactly one display timezone and the reader lives on market time.
    return fill(copy.control.naAlreadyRan, { time: `${formatEtClock(lastRun.finishedAt)} ET` });
  }

  return null;
}

const LABELS: Record<RunAction, { label: string; description: string }> = {
  full: { label: copy.control.runFull, description: copy.control.runFullDesc },
  news: {
    label: copy.control.runNews,
    // The only button that spends money, and it says so. A stated cost is a fact; a hidden one is
    // something the reader finds out from a bill.
    //
    // Through `price()`, like every other number in this app, and not `.toFixed(2)` — which is what
    // I wrote first and drift rule 12 refused. The rule looks pedantic on a figure as small as this
    // one, and it is not: `.toFixed` is the exact door through which a minus sign becomes a hyphen
    // and a thousands separator goes missing. There is one door for numbers, and a cheap number does
    // not get to use a different one.
    description: fill(copy.control.runNewsDesc, { cost: `$${price(NEWS_RUN_COST_USD)}` }),
  },
  macro: { label: copy.control.runMacro, description: copy.control.runMacroDesc },
  compute: { label: copy.control.runCompute, description: copy.control.runComputeDesc },
  briefing: { label: copy.control.runBriefing, description: copy.control.runBriefingDesc },
};

/**
 * The whole panel: one row per action, each in exactly ONE state.
 *
 * The precedence below is deliberate and tested:
 *
 *   1. no token          — nothing else is worth computing; no button could work
 *   2. this action is live — the reader must always be able to see what is running, even if the
 *                            action is also capped. "Daily limit reached" printed over a run that
 *                            is executing right now would be a lie about the present.
 *   3. another run is live — runs are serialized; a second dispatch might silently evaporate
 *   4. not applicable    — the true reason, which outranks a cooldown that would state a false one
 *   5. capped
 *   6. cooling down
 *   7. available
 */
export function controlPanel(input: ControlInput): ActionRow[] {
  const { runs, lastRun, now, tokenConfigured } = input;

  // A run we have lost is NOT in flight. It must not go on blocking the panel, or one bad dispatch
  // would freeze every button until midnight with no way out for the reader.
  const live = runs.filter((r) => IN_FLIGHT.has(r.status) && !isLost(r, now));

  return RUN_ACTIONS.map((action): ActionRow => {
    const { label, description } = LABELS[action];
    const cap = RUN_CAPS[action];
    const spent = spentToday(runs, action, now);
    const left = Math.max(0, cap.perDay - spent);
    const capLine = fill(copy.control.capLine, { left, cap: cap.perDay });

    const state = stateFor({ action, runs, live, lastRun, now, tokenConfigured, spent, cap });

    return {
      action,
      label,
      description,
      state,
      // A cap line under a sentence explaining that the market is open is noise: it answers a
      // question the reader is no longer asking.
      capLine: state.kind === "available" || state.kind === "cooldown" ? capLine : null,
    };
  });
}

function stateFor(ctx: {
  action: RunAction;
  runs: ManualRunRow[];
  live: ManualRunRow[];
  lastRun: CompletedRun | null;
  now: Date;
  tokenConfigured: boolean;
  spent: number;
  cap: { perDay: number; cooldownMinutes: number };
}): RunState {
  const { action, runs, live, lastRun, now, tokenConfigured, spent, cap } = ctx;

  // 1. P-2 is absent. Every row says so, and none pretends it could dispatch.
  if (!tokenConfigured) return { kind: "not_configured" };

  // 2. This action's own run is in flight — show it, whatever else is true.
  const mine = live.find((r) => r.action === action);
  if (mine) {
    if (mine.status === "running") {
      return { kind: "running", since: mine.requestedAt, runUrl: runUrl(mine.ghRunId) };
    }
    if (mine.status === "queued") return { kind: "queued" };
    return { kind: "requested" };
  }

  // The newest finished run of this action, so a failure is reported rather than silently forgotten.
  const newest = newestRun(runs, action);
  if (newest && isLost(newest, now)) return { kind: "lost" };
  if (newest?.status === "failed") return { kind: "failed", runUrl: runUrl(newest.ghRunId) };

  // 3. Somebody else's run is in flight. Runs share a concurrency group and GitHub keeps only the
  //    latest queued run in a group — a second dispatch now might simply evaporate.
  if (live.length > 0) return { kind: "blocked" };

  // 4. The true reason it cannot run, which outranks a cooldown that would state a false one.
  if (action === "full") {
    const reason = whyFullCannotRun(lastRun, now);
    if (reason) return { kind: "not_applicable", reason };
  }

  // 5. Today's allowance is spent.
  if (spent >= cap.perDay) return { kind: "capped" };

  // 6. It ran too recently to tell the reader anything new.
  if (cap.cooldownMinutes > 0 && newest) {
    const availableAt = new Date(newest.requestedAt.getTime() + cap.cooldownMinutes * 60_000);
    if (availableAt > now) return { kind: "cooldown", availableAt };
  }

  return { kind: "available" };
}
