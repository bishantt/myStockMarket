// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkLive, checkMasthead, checkBoard, checkIndexHonesty, checkCalendar,
  checkPressTime, checkBylines, checkNextEdition, checkMorning, mastheadKind,
  isTradingDay, latestClosedSession, pageText, parseLongDate,
} from "./live-truth.mjs";

/**
 * A CHECKER THAT CANNOT FAIL ITS FIXTURES IS DECORATION.
 *
 * That sentence is ruling E10, and it is the N-build's most expensive lesson: for two tagged phases
 * the accessibility sweep "passed" a news story page against a database that had never contained
 * that story. It was scanning the 404 screen. Nothing was wrong, because nothing was being asked.
 *
 * So every check in live-truth.mjs is run here against TWO recordings of the same product:
 *
 *   desk-healthy.txt / news-healthy.txt              REAL, recorded from production 2026-07-13,
 *                                                    the evening the Monday edition landed.
 *   desk-poisoned-saturday-RECONSTRUCTED.txt         The Saturday Desk — what production actually
 *                                                    showed on 2026-07-11/12. Reconstructed, and the
 *                                                    filename says so; the header names the source
 *                                                    of every string in it.
 *
 * The healthy pass is the easy half. The poisoned FAIL is the half that matters: it is the proof
 * that this instrument would have caught the outage it was built for, rather than the hope.
 */

const FIXTURES = join(process.cwd(), "scripts", "fixtures", "live");
const read = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

const HEALTHY_DESK = read("desk-healthy.txt");
const HEALTHY_NEWS = read("news-healthy.txt");
const POISONED_DESK = read("desk-poisoned-saturday-RECONSTRUCTED.txt");

/** The evening the healthy Desk was recorded: Monday 2026-07-13, 19:45 ET — after the nightly landed. */
const MONDAY_EVENING = new Date("2026-07-13T23:45:00Z");
/** The instant the poisoned Desk was live: Saturday 2026-07-11, 15:33 ET. */
const THE_SATURDAY = new Date("2026-07-11T19:33:00Z");

const desk = (html: string) => pageText(html);

describe("the trading calendar the instrument judges production by", () => {
  it("knows a session from a weekend and a holiday", () => {
    expect(isTradingDay("2026-07-13")).toBe(true); // Monday
    expect(isTradingDay("2026-07-11")).toBe(false); // the Saturday
    expect(isTradingDay("2026-11-26")).toBe(false); // Thanksgiving — a weekday
    expect(isTradingDay("2026-07-03")).toBe(false); // Independence Day observed — the 4th is a Saturday
  });

  it("knows which session's bell has actually rung", () => {
    // After the close on a session day, it is today's.
    expect(latestClosedSession(new Date("2026-07-13T23:45:00Z"))).toBe("2026-07-13");
    // Before the open, it is the previous session — the 1:00am-recovery-run case.
    expect(latestClosedSession(new Date("2026-07-14T05:00:00Z"))).toBe("2026-07-13");
    // On the Saturday, it is Friday. This is the number the whole outage turned on.
    expect(latestClosedSession(THE_SATURDAY)).toBe("2026-07-10");
    // The day after Thanksgiving closes at 1:00pm ET, and the calendar knows.
    expect(latestClosedSession(new Date("2026-11-27T18:30:00Z"))).toBe("2026-11-27"); // 1:30pm ET
    expect(latestClosedSession(new Date("2026-11-27T17:30:00Z"))).toBe("2026-11-25"); // 12:30pm ET
  });
});

describe("reading a page", () => {
  it("strips markup and scripts down to what a reader actually sees", () => {
    const html = `<div><script>const x = "Saturday, July 11, 2026";</script><h1>Monday, July 13, 2026</h1></div>`;
    expect(pageText(html)).toBe("Monday, July 13, 2026");
  });

  it("reads the edition date out of a masthead", () => {
    expect(parseLongDate(desk(HEALTHY_DESK))).toBe("2026-07-13");
    expect(parseLongDate(desk(POISONED_DESK))).toBe("2026-07-11");
    expect(parseLongDate("no date here")).toBeNull();
  });
});

describe("1 — masthead session truth", () => {
  it("passes the real Monday Desk", () => {
    const result = checkMasthead(desk(HEALTHY_DESK), MONDAY_EVENING);
    expect(result.verdict).toBe("PASS");
    expect(result.found).toBe("2026-07-13");
  });

  it("CATCHES THE SATURDAY — the outage this whole instrument exists for", () => {
    const result = checkMasthead(desk(POISONED_DESK), THE_SATURDAY);
    expect(result.verdict).toBe("FAIL");
    expect(result.found).toContain("2026-07-11");
    expect(result.found).toContain("Saturday");
    expect(result.found).toContain("The market never opened");
  });

  it("catches a stale masthead — the night the pipeline died", () => {
    // It is Tuesday evening, past the 9:00pm promise, and the Desk still shows Monday.
    const tuesdayLate = new Date("2026-07-15T02:30:00Z"); // 10:30pm ET Tuesday
    const result = checkMasthead(desk(HEALTHY_DESK), tuesdayLate);
    expect(result.verdict).toBe("FAIL");
    expect(result.found).toContain("STALE");
  });

  it("does NOT cry wolf between the closing bell and the night's publish", () => {
    // 5:00pm ET Tuesday. The market shut an hour ago; job A does not finish until ~6:40pm. A Desk
    // showing Monday is CORRECT — Tuesday's edition does not exist yet. A guard that failed here
    // would fail every single evening, and a guard that cries wolf is not there on the night it is
    // right.
    const tuesdayTeatime = new Date("2026-07-14T21:00:00Z");
    const result = checkMasthead(desk(HEALTHY_DESK), tuesdayTeatime);
    expect(result.verdict).toBe("PENDING");
    expect(result.owed).toBe("tonight's nightly");
  });

  it("catches an edition from the future", () => {
    const before = new Date("2026-07-13T14:00:00Z"); // 10am ET Monday — Monday has not closed
    const result = checkMasthead(desk(HEALTHY_DESK), before);
    expect(result.verdict).toBe("FAIL");
    expect(result.found).toContain("FUTURE");
  });
});

describe("2 — the macro board is on the page", () => {
  it("finds all five figures on the real Desk", () => {
    expect(checkBoard(desk(HEALTHY_DESK)).verdict).toBe("PASS");
  });

  it("fails when the module is absent from the DOM entirely", () => {
    // Not an empty cell — an ABSENT one. An empty cell that says "not yet reported" is the product
    // working. A component that renders nothing renders nothing wrong, and no other test would notice.
    const stripped = desk(HEALTHY_DESK).replace(/Gold \(oz\)/g, "").replace(/Mood gauge/g, "");
    const result = checkBoard(stripped);
    expect(result.verdict).toBe("FAIL");
    expect(result.found).toContain("Gold (oz)");
    expect(result.found).toContain("Mood gauge");
  });

  it("passes a board whose cells are honestly EMPTY — absence of data is not absence of the module", () => {
    const degraded = desk(POISONED_DESK); // its mood gauge reads "Insufficient inputs tonight"
    expect(degraded).toContain("Insufficient inputs");
    expect(checkBoard(degraded).verdict).toBe("PASS");
  });
});

describe("3 — index-level honesty", () => {
  it("passes real FRED levels", () => {
    const result = checkIndexHonesty(desk(HEALTHY_DESK));
    expect(result.verdict).toBe("PASS");
  });

  it("passes an ETF fallback THAT SAYS IT IS ONE — the Saturday's pulse was honest about this", () => {
    // The night's FRED index levels were all null, so the pulse fell back to ETF closes and labelled
    // each one. That fallback is the N1 fix working correctly on garbage input, and it must not be
    // scored as a failure just because the edition around it was poisoned.
    expect(checkIndexHonesty(desk(POISONED_DESK)).verdict).toBe("PASS");
  });

  it("CATCHES a number under an index's name with no source at all — the R0 bug", () => {
    // The original sin: the SPY ETF's price printed under the label "S&P 500", reading 754.94 while
    // the index was near 6,800. Strip the attribution and the check must fire.
    const unattributed = desk(HEALTHY_DESK)
      .replace("S&P 500, Nasdaq Composite, Dow: FRED, prior close", "");
    const result = checkIndexHonesty(unattributed);
    expect(result.verdict).toBe("FAIL");
    expect(result.found).toContain("S&P 500");
  });
});

describe("4 — session calendar hygiene", () => {
  it("CATCHES the retired provider's rows, which are STILL LIVE in production today", () => {
    // This is not a hypothetical. The healthy 2026-07-13 recording — a Desk that is correct in every
    // other respect — still shows "Coinbase Cryptocurrencies", written by an ingest that was
    // allowlisted away a month ago. The plan predicted these would self-heal on the next run. They
    // did not, and the reason is in checkCalendar's own comment: the refresh replaces the FORWARD
    // window, and a row that has fallen behind the window is not in it.
    const result = checkCalendar(desk(HEALTHY_DESK));
    expect(result.verdict).toBe("FAIL");
    expect(result.found).toContain("Coinbase Cryptocurrencies");
  });

  it("passes a calendar with no retired rows and nothing behind the edition", () => {
    const clean = desk(HEALTHY_DESK)
      .replace(/Jul 11 fed FOMC Press Release Jul 11 macro Coinbase Cryptocurrencies Jul 12 macro Coinbase Cryptocurrencies Jul 12 fed FOMC Press Release /g, "");
    const result = checkCalendar(clean);
    expect(result.verdict).toBe("PASS");
  });

  it("keeps an event on the edition's OWN day — it belongs to that edition", () => {
    // THE BUG THIS EXISTS FOR (PD1, minutes after the strip's twin). The Monday edition carries an
    // "FOMC decision" dated Jul 13 — its own session. Measured against the WALL CLOCK, this check
    // called that row "in the past" the moment midnight ET rolled into Tuesday, and redded the gate
    // on a Desk that was completely right. The calendar is floored at the edition's session
    // (lib/morning.ts, calendarFloor) and the floor is INCLUSIVE, so the check must be too.
    const clean = desk(HEALTHY_DESK)
      .replace(/Jul 11 fed FOMC Press Release Jul 11 macro Coinbase Cryptocurrencies Jul 12 macro Coinbase Cryptocurrencies Jul 12 fed FOMC Press Release /g, "");
    // The fixture's masthead is Monday, July 13 and it carries "Jul 13 FOMC ... FOMC decision".
    expect(clean).toContain("Jul 13");
    expect(checkCalendar(clean).verdict).toBe("PASS");
  });

  it("still catches a row that has genuinely fallen behind the edition", () => {
    // The disease itself: the edition is Jul 13, and the rows are dated Jul 11 and Jul 12.
    const result = checkCalendar(desk(HEALTHY_DESK).replaceAll("Coinbase Cryptocurrencies", "Some Other Release"));
    expect(result.verdict).toBe("FAIL");
    expect(result.found).toContain("2026-07-11");
    expect(result.found).toContain("2026-07-12");
  });

  it("does not red the gate at the turn of the year", () => {
    // A "Jan 2" row on a December edition is NEXT year's, not 363 days stale. Stamping the edition's
    // year onto it blindly would fail this check every Christmas — on a perfectly good calendar.
    const december = desk(HEALTHY_DESK)
      .replace("Monday, July 13, 2026", "Wednesday, December 30, 2026")
      .replace(/Jul 11 fed FOMC Press Release Jul 11 macro Coinbase Cryptocurrencies Jul 12 macro Coinbase Cryptocurrencies Jul 12 fed FOMC Press Release /g, "")
      .replaceAll("Jul 13", "Dec 30").replaceAll("Jul 14", "Dec 31")
      .replaceAll("Jul 15", "Jan 2").replaceAll("Jul 16", "Jan 5");
    expect(checkCalendar(december).verdict).toBe("PASS");
  });
});

describe("5 — press-time truth", () => {
  it("passes /news assembled on a real session", () => {
    const result = checkPressTime(desk(HEALTHY_NEWS));
    expect(result.verdict).toBe("PASS");
    expect(result.found).toBe("2026-07-13");
  });

  it("catches a Saturday press time — no newsroom sat down for a market that never opened", () => {
    const poisoned = desk(HEALTHY_NEWS).replace("Monday, July 13, 2026", "Saturday, July 11, 2026");
    const result = checkPressTime(poisoned);
    expect(result.verdict).toBe("FAIL");
    expect(result.found).toContain("Saturday");
  });

  it("reports the feed's missing byline anchors as PENDING against PD8, not as a failure", () => {
    const result = checkBylines(HEALTHY_NEWS);
    expect(result.verdict).toBe("PENDING");
    expect(result.owed).toContain("PD8");
  });

  it("gates the bylines the moment PD8 lands them", () => {
    const withAnchors = `${HEALTHY_NEWS}<a href="https://reuters.com/article/x">Reuters</a>`;
    expect(checkBylines(withAnchors).verdict).toBe("PASS");
  });
});

describe("6 — the next-edition promise", () => {
  it("passes a strip promising the next real session", () => {
    // Recorded Monday evening; the masthead says Monday, the strip says "next edition Tue".
    const result = checkNextEdition(desk(HEALTHY_DESK));
    expect(result.verdict).toBe("PASS");
    expect(result.found).toBe("Tue");
  });

  it("measures the promise against the EDITION, not against the wall clock", () => {
    // THE BUG THIS EXISTS FOR (PD1, found the night check:live joined the standing gate).
    //
    // This check used to walk forward from `now`. So at 00:07 ET on Tuesday it demanded the strip
    // say "Wed" — while the Desk, still serving Monday's edition and promising that evening's, was
    // completely correct. It failed a healthy product, and it would have done so EVERY night,
    // between midnight ET and the evening run.
    //
    // That is the same two-clocks bug as the calendar floor in lib/morning.ts, found the same hour:
    // a surface derived from the EDITION, checked against the CLOCK. The promise is a fact about the
    // edition, so the edition is what it is measured against — and this check no longer takes a
    // clock at all. A stale masthead is assertion 1's job, and assertion 1 does it loudly.
    const result = checkNextEdition(desk(HEALTHY_DESK)); // masthead: Monday, July 13; strip: next Tue
    expect(result.verdict).toBe("PASS");
  });

  it("catches a promise that names the wrong day", () => {
    const wrong = desk(HEALTHY_DESK).replace("next edition Tue", "next edition Thu");
    const result = checkNextEdition(wrong);
    expect(result.verdict).toBe("FAIL");
    expect(result.expected).toContain("Tue");
  });

  it("walks over a weekend — a Friday edition promises Monday", () => {
    const friday = desk(HEALTHY_DESK)
      .replace("Monday, July 13, 2026", "Friday, July 10, 2026")
      .replace("next edition Tue", "next edition Mon");
    expect(checkNextEdition(friday).verdict).toBe("PASS");
  });

  it("says so when the Desk names no edition at all", () => {
    const noDate = desk(HEALTHY_DESK).replace("Monday, July 13, 2026", "");
    expect(checkNextEdition(noDate).verdict).toBe("FAIL");
  });
});

describe("CC9 — check:live learns the morning edition (R6, and the Q-CC5-2 fix)", () => {
  /** 7:00 AM ET Tuesday 2026-07-14 — a dawn ran at 6:31, the last close was Monday 2026-07-13. */
  const TUE_MORNING = new Date("2026-07-14T11:00:00Z");
  /** A Morning masthead dated TODAY (Jul 14), legitimately ahead of the last close (Mon Jul 13). */
  const morningMasthead =
    "The Desk — Morning Edition Tuesday, July 14, 2026 before the open · market data through "
    + "Monday's close · news & macro refreshed 6:31 AM ET";

  it("reads the morning kicker as a morning edition, everything else as evening", () => {
    expect(mastheadKind(morningMasthead)).toBe("morning");
    expect(mastheadKind(desk(HEALTHY_DESK))).toBe("evening");
  });

  it("PASSES a Morning Edition dated today, though its date is ahead of the last close (R6)", () => {
    const r = checkMasthead(morningMasthead, TUE_MORNING);
    expect(r.verdict).toBe("PASS");
    expect(r.found).toContain("2026-07-14");
  });

  it("does NOT fire the evening 'future edition' red on a morning masthead — the Q-CC5-2 false red", () => {
    // The masthead date (Jul 14) is ahead of the last closed session (Jul 13). The evening path would call
    // that "an edition from the FUTURE"; the morning greeting is exactly that, and honestly so.
    const r = checkMasthead(morningMasthead, TUE_MORNING);
    expect(r.found).not.toContain("FUTURE");
  });

  it("catches a STALE morning — a Morning Edition dated a day that is not today", () => {
    const stale = morningMasthead.replace("Tuesday, July 14, 2026", "Monday, July 13, 2026");
    const r = checkMasthead(stale, TUE_MORNING);
    expect(r.verdict).toBe("FAIL");
    expect(r.found).toContain("stale morning");
  });

  it("measures the next-edition promise against the DATA session, not the morning display date", () => {
    // Morning of Jul 14; the strip promises Tuesday's own evening. Against the display date (Jul 14) the
    // promise reads wrong (it would demand Wednesday); against the last close (Jul 13) it is right.
    const withStrip = `${morningMasthead} 14 sources · 0 degraded · next edition Tue ~6:37 PM ET`;
    expect(checkNextEdition(withStrip, TUE_MORNING).verdict).toBe("PASS");
  });

  it("measures the calendar against the floor (the last close), so today's leading rows are not stale", () => {
    // The morning rail leads with TODAY's events (Jul 14), which sit ON the display date and would be
    // flagged if measured against it. Measured against the floor (Jul 13) they pass.
    const withCal = `${morningMasthead} Session calendar Jul 14 EARNINGS AAPL Jul 15 macro CPI`;
    expect(checkCalendar(withCal, TUE_MORNING).verdict).toBe("PASS");
  });

  it("checkMorning PASSES a Morning Edition refreshed before the open", () => {
    expect(checkMorning(morningMasthead).verdict).toBe("PASS");
  });

  it("checkMorning FAILS when the Desk is still the Evening Edition in a morning window", () => {
    // An evening masthead in a morning window is a morning that never got greeted — the R6 miss.
    expect(checkMorning(desk(HEALTHY_DESK)).verdict).toBe("FAIL");
  });

  it("checkMorning FAILS a refresh stamp that is not before the open", () => {
    const late = morningMasthead.replace("6:31 AM ET", "11:00 AM ET");
    expect(checkMorning(late).verdict).toBe("FAIL");
  });

  it("appends the morning assertion ONLY under --window=morning; the evening six never grow", () => {
    const evening = checkLive({ deskHtml: HEALTHY_DESK, newsHtml: HEALTHY_NEWS, now: MONDAY_EVENING });
    expect(evening).toHaveLength(7);
    const morning = checkLive({
      deskHtml: HEALTHY_DESK, newsHtml: HEALTHY_NEWS, now: MONDAY_EVENING, window: "morning",
    });
    expect(morning).toHaveLength(8);
  });
});

describe("the whole instrument, end to end", () => {
  it("reports every check, and fails the run on any one of them", () => {
    const results = checkLive({ deskHtml: HEALTHY_DESK, newsHtml: HEALTHY_NEWS, now: MONDAY_EVENING });
    expect(results).toHaveLength(7);
    // Production on 2026-07-13: honest masthead, healed board, real index levels, honest press time
    // — and a session calendar still carrying a dead provider's rows.
    const failures = results.filter((r) => r.verdict === "FAIL");
    expect(failures.map((f) => f.surface)).toEqual(["session calendar · hygiene"]);
  });

  it("WOULD HAVE CAUGHT THE SATURDAY — four surfaces, on the day it was live", () => {
    const results = checkLive({
      deskHtml: POISONED_DESK,
      newsHtml: HEALTHY_NEWS.replace("Monday, July 13, 2026", "Saturday, July 11, 2026"),
      now: THE_SATURDAY,
    });
    const failed = results.filter((r) => r.verdict === "FAIL").map((r) => r.surface);
    expect(failed).toContain("masthead · session truth");
    expect(failed).toContain("news · press-time truth");
  });
});
