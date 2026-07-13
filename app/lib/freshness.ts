import {
  etDateOf,
  etMinuteOf,
  isTradingDay,
  nextTradingDay,
  previousTradingDay,
  sessionsBetween,
  type TradingDate,
} from "@/lib/market-hours";

/**
 * freshness.ts — is what the reader is looking at current, and if not, how bad is it?
 *
 * This is the whole brain behind the Desk's pipeline strip (NEWS-AND-CONTROL-PLAN Part 4.1). It is
 * a pure function of three things — the last completed run, the trading calendar, and the current
 * instant — so it can be tested exhaustively without a database, a clock, or a browser.
 *
 * THE DESIGN PRINCIPLE, WHICH IS AN HONESTY PRINCIPLE (plan Part 1.2).
 *
 * Module 00 used to spend the best card on the Desk saying "last cloud run — Jul 11" every single
 * day, in the same quiet voice whether the pipeline was healthy or three days dead. That is exactly
 * backwards. Freshness should be prominent IN PROPORTION TO HOW BAD THE NEWS IS: a live pipeline
 * earns one quiet line, a stale one earns amber, a dead one earns the loudest surface in the app.
 *
 * To do that without crying wolf, the count has to be in SESSIONS, never in hours or days:
 *
 *   · A weekend is not staleness. There was no session, so no edition was owed.
 *   · A holiday is not staleness. Same reason.
 *   · Monday morning is not staleness. Monday's close has not happened yet; Friday's data is the
 *     newest data that EXISTS. Scolding the reader for the passage of time is not honesty.
 *
 * A lamp that glows amber every Saturday is a lamp nobody reads by Tuesday, and then it is not
 * there on the night it matters.
 */

/** Job A's nightly fire time, 22:37 UTC — fixed in UTC so it is immune to daylight saving. */
const NIGHTLY_RUN_UTC_HOUR = 22;
const NIGHTLY_RUN_UTC_MINUTE = 37;

/**
 * The hour, in ET, by which a session's edition is owed: 9:00pm.
 *
 * This is not an arbitrary grace period — it is the product's own published promise (CLAUDE.md:
 * "briefing ready ~8:40pm EDT — promise 9:00pm ET year-round"). Before 9pm, tonight's absent run
 * is the schedule, not a failure. The strip may not invent a deadline the product never made.
 */
const PROMISE_MINUTE_ET = 21 * 60;

/** Two missed sessions is the line between "something slipped" and "this thing is dead". */
const DEAD_AFTER_MISSED_SESSIONS = 2;

/** A run that actually finished. A row with no `finishedAt` is a crash, not an edition. */
export type CompletedRun = {
  /** The trading day the run processed, as an ET calendar date. */
  runDate: TradingDate;
  /** When it finished writing. */
  finishedAt: Date;
};

/**
 * `fresh` — every owed edition is on the page.
 * `aging` — exactly one owed edition never landed.
 * `dead`  — two or more did. The data on screen is meaningfully old and nothing else says so.
 * `never` — no run has ever completed. An empty database is not a dead pipeline; it is a pipeline
 *           that has not started, and the Desk's module placeholders already say the data is
 *           coming. The strip must not shout about a fresh install.
 */
export type FreshnessState = "fresh" | "aging" | "dead" | "never";

export type Freshness = {
  state: FreshnessState;
  /** The trading day of the newest COMPLETED run — the edition actually on screen. */
  lastGoodSession: TradingDate | null;
  /** When that run finished. */
  finishedAt: Date | null;
  /** The most recent session whose edition is owed by now. Null before any session is owed. */
  expectedSession: TradingDate | null;
  /** How many owed editions never landed. */
  missedSessions: number;
  /** When the next nightly run fires. */
  nextRunAt: Date;
};

/**
 * The most recent session whose edition is owed at `now`.
 *
 * Today counts only once the promise hour has passed; before that, we look back to the previous
 * session. This is the function that keeps Monday morning from being an alarm.
 */
function latestOwedSession(now: Date): TradingDate {
  const today = etDateOf(now);
  const todaysEditionIsOwed = isTradingDay(today) && etMinuteOf(now) >= PROMISE_MINUTE_ET;
  return todaysEditionIsOwed ? today : previousTradingDay(today);
}

/** The instant Job A next fires: the first session whose 22:37 UTC slot is still ahead of us. */
function nextScheduledRun(now: Date): Date {
  let day = etDateOf(now);
  if (!isTradingDay(day)) day = nextTradingDay(day);

  let fireAt = fireTimeOn(day);
  // Tonight's run may already be behind us — roll to the next session.
  if (fireAt.getTime() <= now.getTime()) fireAt = fireTimeOn(nextTradingDay(day));
  return fireAt;
}

/** The instant Job A fires on a given trading day. */
function fireTimeOn(day: TradingDate): Date {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCHours(NIGHTLY_RUN_UTC_HOUR, NIGHTLY_RUN_UTC_MINUTE, 0, 0);
  return at;
}

/**
 * Grade the pipeline's freshness.
 *
 * `lastRun` must be a COMPLETED run — see CompletedRun. Passing the newest row regardless of
 * whether it finished is the bug this signature exists to prevent: Job A crashing halfway leaves a
 * `pipeline_run` row for tonight with a null `finishedAt`, and a strip that counted that row as an
 * edition would photograph a crashed pipeline as a healthy one.
 */
/** A bare trading date and nothing else: "2026-07-10". Not "2026-07-10T00:00:00.000Z". */
const TRADING_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function freshness(lastRun: CompletedRun | null, now: Date): Freshness {
  /*
   * Fail where the mistake IS.
   *
   * `runDate` comes from a Prisma `@db.Date` column, and the obvious way to serialise it —
   * `.toISOString()` — yields a full timestamp. Feed that in and every date this module builds is an
   * Invalid Date: silently, without error, until some formatter three components away throws a
   * RangeError that names neither this function nor the loader that actually got it wrong. That is
   * exactly what happened, and it cost a production build to find.
   *
   * So the machine refuses the input at its own front door, and says what it wanted.
   */
  if (lastRun && !TRADING_DATE.test(lastRun.runDate)) {
    throw new TypeError(
      `freshness: runDate must be a bare trading date like "2026-07-10", got "${lastRun.runDate}". ` +
        `A @db.Date is a DAY — use toTradingDate(), not .toISOString().`,
    );
  }

  const nextRunAt = nextScheduledRun(now);

  if (!lastRun) {
    return {
      state: "never",
      lastGoodSession: null,
      finishedAt: null,
      expectedSession: null,
      missedSessions: 0,
      nextRunAt,
    };
  }

  const expectedSession = latestOwedSession(now);

  // The run is for a session at or after the newest owed one — nothing is missing. (The "after"
  // case is real, not defensive padding: a run can complete before the promise hour, so at 7pm on
  // Monday the last run is Monday's while the newest OWED session is still Friday's.)
  const missedSessions =
    lastRun.runDate >= expectedSession ? 0 : sessionsBetween(lastRun.runDate, expectedSession);

  const state: FreshnessState =
    missedSessions === 0 ? "fresh" : missedSessions >= DEAD_AFTER_MISSED_SESSIONS ? "dead" : "aging";

  return {
    state,
    lastGoodSession: lastRun.runDate,
    finishedAt: lastRun.finishedAt,
    expectedSession,
    missedSessions,
    nextRunAt,
  };
}
