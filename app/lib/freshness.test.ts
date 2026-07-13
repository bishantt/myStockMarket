import { describe, expect, it } from "vitest";

import { freshness } from "@/lib/freshness";
import { isTradingDay, nextTradingDay, previousTradingDay } from "@/lib/market-hours";

/**
 * The freshness state machine (NEWS-AND-CONTROL-PLAN Part 4.1).
 *
 * The strip on the Desk answers one question — "is what I am reading current?" — and it has to
 * answer it without crying wolf. A weekend is not a broken pipeline. A holiday is not a broken
 * pipeline. Those are the cases that make a freshness indicator worthless: a lamp that is amber
 * every Saturday is a lamp nobody looks at by Tuesday.
 *
 * So the whole rule is: count the SESSIONS the pipeline should have run for and did not. Not days.
 * Not hours. Sessions.
 */

/** A completed run for the trading day `date`, finished at the usual hour that evening. */
function ranFor(date: string) {
  return { runDate: date, finishedAt: new Date(`${date}T22:41:00Z`) };
}

/** An instant, given an ET wall-clock time on a calendar date. EDT in July, so ET = UTC−4. */
function etJuly(date: string, hhmm: string) {
  return new Date(`${date}T${hhmm}:00-04:00`);
}

describe("the trading calendar walk", () => {
  it("knows a weekday session from a weekend", () => {
    expect(isTradingDay("2026-07-10")).toBe(true); // Friday
    expect(isTradingDay("2026-07-11")).toBe(false); // Saturday
    expect(isTradingDay("2026-07-12")).toBe(false); // Sunday
    expect(isTradingDay("2026-07-13")).toBe(true); // Monday
  });

  it("knows the NYSE holidays — a closed weekday is not a session", () => {
    expect(isTradingDay("2026-07-03")).toBe(false); // Independence Day, observed
    expect(isTradingDay("2026-11-26")).toBe(false); // Thanksgiving
    expect(isTradingDay("2026-11-27")).toBe(true); // the half day after it IS a session
  });

  it("walks backwards and forwards over a weekend in one step", () => {
    expect(previousTradingDay("2026-07-13")).toBe("2026-07-10"); // Monday back to Friday
    expect(nextTradingDay("2026-07-10")).toBe("2026-07-13"); // Friday forward to Monday
  });

  it("walks over a holiday that sits beside a weekend", () => {
    // Thursday 2026-11-26 is Thanksgiving. From Friday the 27th, the previous session is Wednesday.
    expect(previousTradingDay("2026-11-27")).toBe("2026-11-25");
  });
});

describe("freshness — the five calendar cases", () => {
  it("FRESH: Friday's run, read on Saturday morning — a weekend is not staleness", () => {
    // This is the case that decides whether the strip is worth having. The market is shut; there is
    // no session to have missed; the pipeline is behaving perfectly. Amber here would be a lie.
    const f = freshness(ranFor("2026-07-10"), etJuly("2026-07-11", "09:00"));
    expect(f.state).toBe("fresh");
    expect(f.missedSessions).toBe(0);
    expect(f.lastGoodSession).toBe("2026-07-10");
  });

  it("FRESH: Friday's run, read on Sunday night — still no session missed", () => {
    const f = freshness(ranFor("2026-07-10"), etJuly("2026-07-12", "21:30"));
    expect(f.state).toBe("fresh");
  });

  it("FRESH: Monday's run, read on Monday at 10pm ET — tonight's edition has landed", () => {
    const f = freshness(ranFor("2026-07-13"), etJuly("2026-07-13", "22:00"));
    expect(f.state).toBe("fresh");
    expect(f.expectedSession).toBe("2026-07-13");
  });

  it("FRESH: Friday's run, read Monday at 8am — Monday's run is not due until tonight", () => {
    // Monday's close has not happened. Friday's data is the newest data that EXISTS. The pipeline
    // is not late; the session is not over. Calling this stale would be scolding the reader for
    // the passage of time.
    const f = freshness(ranFor("2026-07-10"), etJuly("2026-07-13", "08:00"));
    expect(f.state).toBe("fresh");
    expect(f.missedSessions).toBe(0);
  });

  it("FRESH over a holiday: Wednesday's run, read on Thanksgiving night", () => {
    // 2026-11-26 is Thanksgiving — a closed day, so no run is owed for it. The last session was
    // Wednesday and its run is on the page. Nothing is missing.
    const wed = { runDate: "2026-11-25", finishedAt: new Date("2026-11-25T22:41:00Z") };
    // November is EST (UTC−5).
    const f = freshness(wed, new Date("2026-11-26T22:00:00-05:00"));
    expect(f.state).toBe("fresh");
    expect(f.missedSessions).toBe(0);
  });

  it("AGING: exactly one expected session went unrun", () => {
    // Friday's run is the newest; it is Monday night, past the promise hour, and Monday's run
    // never landed. One session owed, one session missing.
    const f = freshness(ranFor("2026-07-10"), etJuly("2026-07-13", "22:00"));
    expect(f.state).toBe("aging");
    expect(f.missedSessions).toBe(1);
    expect(f.expectedSession).toBe("2026-07-13");
    expect(f.lastGoodSession).toBe("2026-07-10");
  });

  it("DEAD: two expected sessions went unrun", () => {
    // Friday's run, and it is now Tuesday night. Monday and Tuesday are both owed and both absent.
    // Every number on the Desk is now three days old and nothing else on the page would say so.
    const f = freshness(ranFor("2026-07-10"), etJuly("2026-07-14", "22:00"));
    expect(f.state).toBe("dead");
    expect(f.missedSessions).toBe(2);
  });

  it("DEAD stays dead as the gap widens", () => {
    const f = freshness(ranFor("2026-07-10"), etJuly("2026-07-24", "22:00"));
    expect(f.state).toBe("dead");
    expect(f.missedSessions).toBe(10); // ten sessions in two weeks
  });

  it("NEVER: no completed run has ever been recorded", () => {
    // An empty database is not a dead pipeline — it is a pipeline that has not started. The Desk's
    // module placeholders already say the data is coming; the strip must not shout about it.
    const f = freshness(null, etJuly("2026-07-13", "22:00"));
    expect(f.state).toBe("never");
    expect(f.lastGoodSession).toBeNull();
    expect(f.missedSessions).toBe(0);
  });

  it("a run that STARTED but never finished does not count as a run", () => {
    // This is the failure mode that a naive 'latest row' read would miss entirely: Job A crashed
    // halfway, so a pipeline_run row exists for tonight with no finishedAt. The row is not an
    // edition. Treating it as one would let a crashed pipeline photograph itself as healthy.
    const f = freshness(null, etJuly("2026-07-13", "22:00"));
    expect(f.state).toBe("never");
  });
});

describe("freshness — the promise hour", () => {
  it("a session's run is not owed until 9pm ET, the hour the product promises", () => {
    // The app's own published promise is a briefing by 9:00pm ET. Before that hour, tonight's run
    // being absent is not lateness — it is the schedule. The strip may not invent a deadline the
    // product never made.
    const beforeNine = freshness(ranFor("2026-07-10"), etJuly("2026-07-13", "20:59"));
    expect(beforeNine.state).toBe("fresh");
    expect(beforeNine.expectedSession).toBe("2026-07-10");

    const afterNine = freshness(ranFor("2026-07-10"), etJuly("2026-07-13", "21:01"));
    expect(afterNine.state).toBe("aging");
    expect(afterNine.expectedSession).toBe("2026-07-13");
  });
});

describe("freshness — what runs next", () => {
  it("names the next scheduled run: tonight, if tonight's has not fired", () => {
    // Monday lunchtime. Job A fires at 22:37 UTC — 6:37pm EDT — tonight.
    const f = freshness(ranFor("2026-07-10"), etJuly("2026-07-13", "12:00"));
    expect(f.nextRunAt?.toISOString()).toBe("2026-07-13T22:37:00.000Z");
  });

  it("names the next scheduled run: Monday, when read on a Saturday", () => {
    // The whole point of the line. On Saturday the reader is told the next edition is Monday
    // evening — not left wondering whether something is broken.
    const f = freshness(ranFor("2026-07-10"), etJuly("2026-07-11", "09:00"));
    expect(f.nextRunAt?.toISOString()).toBe("2026-07-13T22:37:00.000Z");
  });

  it("skips a holiday when naming the next run", () => {
    // Read on Thanksgiving 2026 (Thursday, closed). The next run is Friday's — the half day is
    // still a session, and it still gets an edition.
    const wed = { runDate: "2026-11-25", finishedAt: new Date("2026-11-25T22:41:00Z") };
    const f = freshness(wed, new Date("2026-11-26T10:00:00-05:00"));
    expect(f.nextRunAt?.toISOString()).toBe("2026-11-27T22:37:00.000Z");
  });

  it("rolls past tonight's fire time to tomorrow", () => {
    // Monday 11pm: tonight's 22:37 UTC run is behind us, so the next one is Tuesday's.
    const f = freshness(ranFor("2026-07-13"), etJuly("2026-07-13", "23:00"));
    expect(f.nextRunAt?.toISOString()).toBe("2026-07-14T22:37:00.000Z");
  });
});
