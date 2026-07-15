import { describe, expect, it } from "vitest";
import {
  etAbbreviation,
  formatAsOf,
  formatEtClock,
  formatEtClockPadded,
  formatEtDate,
  formatEtStamp,
  formatEtWeekday,
  formatUtcDate,
  formatUtcDateLong,
  formatUtcWeekday,
  formatWeekdayLong,
} from "./time";

/**
 * The user lives on market time: Long Island, New York. Every timestamp in this product is
 * stored in UTC and displayed in America/New_York, and the app must never be wrong about
 * which side of a daylight-saving boundary it is on.
 *
 * CC2 (ruling R1) rewrote every reader-facing shape: clocks are 12-hour with AM/PM ("7:36 PM"),
 * never 24-hour; dates carry their weekday ("Tue, Jul 14"). These tests pin the exact shape of
 * every public formatter — they are the contract the render sites and the VRT baselines depend on.
 *
 * The plan (§6.1) names the two daylight-saving dates explicitly. In 2026 those fall on Sunday
 * 8 March (clocks jump 2am -> 3am) and Sunday 1 November (clocks fall back 2am -> 1am). All inputs
 * below are UTC instants: we assert on what the reader in New York sees, not on the machine's clock.
 */

describe("etAbbreviation", () => {
  it("says EST in the winter and EDT in the summer", () => {
    expect(etAbbreviation(new Date("2026-01-15T17:00:00Z"))).toBe("EST");
    expect(etAbbreviation(new Date("2026-07-09T20:05:00Z"))).toBe("EDT");
  });

  it("flips to EDT at the exact instant the March transition happens", () => {
    // 06:59:59Z is 01:59:59 EST — the last second before the clocks jump.
    expect(etAbbreviation(new Date("2026-03-08T06:59:59Z"))).toBe("EST");
    // 07:00:00Z is 03:00:00 EDT — 2am never exists on this date.
    expect(etAbbreviation(new Date("2026-03-08T07:00:00Z"))).toBe("EDT");
  });

  it("flips back to EST at the exact instant the November transition happens", () => {
    // 05:59:59Z is 01:59:59 EDT.
    expect(etAbbreviation(new Date("2026-11-01T05:59:59Z"))).toBe("EDT");
    // 06:00:00Z is 01:00:00 EST — the 1 o'clock hour happens twice.
    expect(etAbbreviation(new Date("2026-11-01T06:00:00Z"))).toBe("EST");
  });
});

describe("formatEtClock", () => {
  it("renders a 12-hour clock with AM/PM and no leading zero on the hour", () => {
    // 20:05 UTC on a summer date is 16:05 in New York — five minutes after the close.
    expect(formatEtClock(new Date("2026-07-09T20:05:00Z"))).toBe("4:05 PM");
  });

  it("does not pad the hour in prose contexts — 9:30, not 09:30", () => {
    // 13:30 UTC in summer is 09:30 ET — the opening bell.
    expect(formatEtClock(new Date("2026-07-09T13:30:00Z"))).toBe("9:30 AM");
  });

  it("reads the same wall-clock time on both sides of the March transition", () => {
    // Both instants are 16:05 in New York, one in EST and one in EDT.
    expect(formatEtClock(new Date("2026-03-06T21:05:00Z"))).toBe("4:05 PM"); // EST, UTC-5
    expect(formatEtClock(new Date("2026-03-09T20:05:00Z"))).toBe("4:05 PM"); // EDT, UTC-4
  });

  it("renders midnight as 12:00 AM, never 00:00", () => {
    expect(formatEtClock(new Date("2026-07-09T04:00:00Z"))).toBe("12:00 AM");
  });
});

describe("formatEtClockPadded", () => {
  it("pads the hour so a mono column stays aligned — 09:30, not 9:30", () => {
    // The one context that keeps the pad: the control-room table, where a right-aligned mono
    // column would jump a glyph between a 9am row and a 10am row.
    expect(formatEtClockPadded(new Date("2026-07-09T13:30:00Z"))).toBe("09:30 AM");
    expect(formatEtClockPadded(new Date("2026-07-09T20:05:00Z"))).toBe("04:05 PM");
  });

  it("still renders midnight as 12:00 AM", () => {
    expect(formatEtClockPadded(new Date("2026-07-09T04:00:00Z"))).toBe("12:00 AM");
  });
});

describe("formatEtDate", () => {
  it("carries the weekday: Thu, Jul 9", () => {
    expect(formatEtDate(new Date("2026-07-09T20:05:00Z"))).toBe("Thu, Jul 9");
  });

  it("uses the New York calendar day, not the UTC one", () => {
    // 02:30Z on 10 July is still 22:30 on 9 July in New York. A naive UTC read says "Jul 10".
    expect(formatEtDate(new Date("2026-07-10T02:30:00Z"))).toBe("Thu, Jul 9");
  });
});

describe("formatUtcDate", () => {
  it("carries the weekday, read from the UTC components of a bare date", () => {
    expect(formatUtcDate(new Date("2026-07-14T00:00:00Z"))).toBe("Tue, Jul 14");
  });

  it("does NOT shift a bare date into Eastern time — a trading day stays its own day", () => {
    // A run date stored at UTC midnight is that calendar day. Reading it in ET would roll it back
    // one — 2026-07-15 at UTC midnight is still 2026-07-14 in New York — which is the exact bug this
    // formatter exists to avoid. It must read the UTC components and say "Wed, Jul 15".
    expect(formatUtcDate(new Date("2026-07-15T00:00:00Z"))).toBe("Wed, Jul 15");
  });
});

describe("formatEtStamp", () => {
  it("is the one-line provenance shape: weekday date · clock · ET", () => {
    expect(formatEtStamp(new Date("2026-07-09T20:05:00Z"))).toBe("Thu, Jul 9 · 4:05 PM ET");
  });
});

describe("formatAsOf", () => {
  it("produces the exact string every SectionMasthead shows", () => {
    expect(formatAsOf(new Date("2026-07-09T20:05:00Z"))).toBe("as of 4:05 PM ET");
  });

  it("still says ET in winter — the abbreviation is available, but the Desk shows ET only", () => {
    // CLAUDE.md, "Timing": display timezone is ET year-round, so the reader never has to
    // decode whether tonight is EDT or EST. etAbbreviation() exists for provenance contexts.
    expect(formatAsOf(new Date("2026-01-15T21:05:00Z"))).toBe("as of 4:05 PM ET");
  });
});

describe("formatUtcDateLong", () => {
  it("writes a trading day out in full, by its UTC components", () => {
    // A run date is a bare calendar date stored at UTC midnight. Formatting it in Eastern time
    // would shift it back a day and the Desk's masthead would carry the wrong date — which is
    // exactly the bug this function exists to prevent (the header once read "Jul 10" while the
    // pipeline module beneath it read "Jul 11", from the same value).
    expect(formatUtcDateLong(new Date("2026-07-10T00:00:00.000Z"))).toBe("Friday, July 10, 2026");
    expect(formatUtcDateLong(new Date("2026-01-02T00:00:00.000Z"))).toBe("Friday, January 2, 2026");
  });
});

describe("the weekday-only formatters (unchanged by CC2)", () => {
  it("formatUtcWeekday reads a bare date's short weekday from its UTC components", () => {
    expect(formatUtcWeekday(new Date("2026-07-10T00:00:00Z"))).toBe("Fri");
  });

  it("formatEtWeekday reads a real instant's short weekday in New York", () => {
    expect(formatEtWeekday(new Date("2026-07-09T20:05:00Z"))).toBe("Thu");
  });

  it("formatWeekdayLong reads a TradingDate's long weekday, UTC-anchored so it never drifts a day", () => {
    expect(formatWeekdayLong("2026-07-17")).toBe("Friday");
  });
});
