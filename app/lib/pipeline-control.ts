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
 * THE ARGUMENT (plan 8.1, worth re-reading before adding a button): this is an end-of-day product, and on
 * a normal weeknight the pipeline HAS ALREADY RUN, so a manual re-run recomputes byte-identical data — for
 * that case the honest control is the EXPLANATION, not the button. Four cases earn a real button: a
 * failed/missed nightly (recovery), a news re-fetch, a macro refresh, a scan recompute. So most of the
 * time this panel is a short piece of writing, and the sentences are the feature — a present-but-pointless
 * button invites a press that changes nothing and says nothing about it.
 *
 * Everything here is a PURE FUNCTION of four inputs (the manual-run ledger, the last completed run, the
 * clock, and whether the GitHub token exists) — no database, no network, no `new Date()` inside — which is
 * what lets every reachable state be pinned by a unit test.
 */

/** One row of the app's own manual-run ledger (`manual_run`), as the panel needs it. */
export type ManualRunRow = {
  id: string;
  action: RunAction;
  requestedAt: Date;
  status: "requested" | "queued" | "running" | "succeeded" | "failed";
  /**
   * The GitHub run, once found. Null until then — see `isLost` below. A STRING, not the `bigint` Prisma
   * returns, converted at the database boundary on purpose: `JSON.stringify` THROWS on a bigint, and this
   * row is serialized by a polling API route on every tick — so the panel would have died on the first
   * found run, on the happy path, only in production (the unit tests never serialize). The id only ever
   * builds a link, so a string is what it is.
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
 * Is this run still genuinely in flight, or have we simply lost it? THE SILENT FAILURE THIS PREVENTS: a
 * run that did nothing and a run never dispatched look identical from the couch. The dispatch API answers
 * 204 No Content with an empty body (recorded live 2026-07-13; the plan and GitHub's REST docs both claim
 * a run id — both wrong), so the app HUNTS for its run by matching the request id in the run's name. That
 * normally succeeds in a second or two; when it does not (revoked token, renamed workflow, GitHub
 * incident) the run may not exist, so the absence is counted and, after the timeout, SAID OUT LOUD.
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
 * How many runs of an action have been requested TODAY, on the ET calendar — not UTC. The caps reset at
 * midnight ET (the reader lives on market time); a run fired 11pm ET Monday is already Tuesday in UTC, so
 * counting in UTC would cost Tuesday's reader part of their allowance. Every requested run counts,
 * INCLUDING failures: a news run that died halfway still spent its ~20 of a 100-a-day budget.
 */
function spentToday(runs: ManualRunRow[], action: RunAction, now: Date): number {
  const today = etDateOf(now);
  return runs.filter((r) => r.action === action && etDateOf(r.requestedAt) === today).length;
}

/**
 * Why `full` cannot run right now — or null if it can. `full` is the ONLY action with real reasons to
 * refuse, because it is the only one that ingests the market (the other four touch no price and depend on
 * no close, which is why plan 8.1 gave them real buttons). The checks are ordered by how fundamental the
 * fact is — a weekend outranks a cooldown — so the reader hears the real reason, not the first checked.
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

  // The market is open: today's closing data does not exist yet. Running now would ingest a half-formed
  // bar over the last good close — plan 8.1's "impossible by design", the reason for job_a.py's mode guard.
  if (marketState(now) === "open") {
    return fill(copy.control.naMarketOpen, { nightly: "6:37pm" });
  }

  // The close has happened. If tonight's edition already landed there is nothing newer to fetch, and the
  // honest control is this sentence, not a button that recomputes the same bytes. If NOT (the nightly
  // failed or has not fired), this is the recovery case — plan 8.1 reason (a), the panel's best button.
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
    // The only button that spends money, and it says so — a stated cost is a fact, a hidden one is a
    // surprise on a bill. Through `price()` like every number (not `.toFixed(2)`, which drift rule 12
    // refused): `.toFixed` is the door through which a minus becomes a hyphen and a separator goes missing.
    description: fill(copy.control.runNewsDesc, { cost: `$${price(NEWS_RUN_COST_USD)}` }),
  },
  macro: { label: copy.control.runMacro, description: copy.control.runMacroDesc },
  compute: { label: copy.control.runCompute, description: copy.control.runComputeDesc },
  briefing: { label: copy.control.runBriefing, description: copy.control.runBriefingDesc },
};

/**
 * The whole panel: one row per action, each in exactly ONE state. The precedence is deliberate and tested:
 *   1. no token          — nothing else is worth computing.
 *   2. this action live  — the reader must see what is running, even if it is also capped ("daily limit
 *                          reached" over a run executing now is a lie about the present).
 *   3. another run live  — runs are serialized; a second dispatch might silently evaporate.
 *   4. not applicable    — the true reason, outranking a cooldown that would state a false one.
 *   5. capped · 6. cooling down · 7. available
 */
export function controlPanel(input: ControlInput): ActionRow[] {
  const { runs, lastRun, now, tokenConfigured } = input;

  // A run we have lost is NOT in flight — else one bad dispatch would freeze every button until midnight.
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
      // A cap line under "the market is open" is noise: it answers a question the reader stopped asking.
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

  /*
   * 1. NOTHING OUTRANKS A RUN HAPPENING RIGHT NOW. The reader must always see what is executing;
   * "tonight's run already succeeded" or "daily limit reached" OVER a live run is a lie about the present.
   * (Not hypothetical: a `full` run writes its pipeline_run row near the END of its work, so for the last
   * stretch of a recovery run "already succeeded" is technically true while it is visibly still going.)
   */
  const mine = live.find((r) => r.action === action);
  if (mine) {
    if (mine.status === "running") {
      return { kind: "running", since: mine.requestedAt, runUrl: runUrl(mine.ghRunId) };
    }
    if (mine.status === "queued") return { kind: "queued" };
    return { kind: "requested" };
  }

  /*
   * 2. A FACT ABOUT THE WORLD OUTRANKS A FACT ABOUT OUR CONFIGURATION. `not_configured` used to be checked
   * first and swallowed everything: with P-2 unprovisioned every row read "not configured" and the four C5
   * sentences — the point of plan 8.1 — never rendered. But "markets are open, so today's data does not
   * exist yet" is true with or without a token; the missing token is our own temporary setup, stated once
   * above the rows. This also outranks a cooldown, which would state a FALSE reason ("available again at
   * 10:31am" is a promise the open market will not keep).
   */
  if (action === "full") {
    const reason = whyFullCannotRun(lastRun, now);
    if (reason) return { kind: "not_applicable", reason };
  }

  // 3. P-2 is absent. No button could work, and the panel says so once, above the rows.
  if (!tokenConfigured) return { kind: "not_configured" };

  // 4. The newest run's outcome, so a failure is reported rather than silently forgotten.
  const newest = newestRun(runs, action);
  if (newest && isLost(newest, now)) return { kind: "lost" };
  if (newest?.status === "failed") return { kind: "failed", runUrl: runUrl(newest.ghRunId) };

  // 3. Somebody else's run is in flight. Runs share a concurrency group and GitHub keeps only the
  //    latest queued run in a group — a second dispatch now might simply evaporate.
  if (live.length > 0) return { kind: "blocked" };

  // 5. Today's allowance is spent.
  if (spent >= cap.perDay) return { kind: "capped" };

  // 6. It ran too recently to tell the reader anything new.
  if (cap.cooldownMinutes > 0 && newest) {
    const availableAt = new Date(newest.requestedAt.getTime() + cap.cooldownMinutes * 60_000);
    if (availableAt > now) return { kind: "cooldown", availableAt };
  }

  return { kind: "available" };
}
