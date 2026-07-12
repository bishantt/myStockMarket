import { describe, expect, it } from "vitest";
import { etAbbreviation, formatAsOf, formatEtClock, formatEtDate, formatUtcDateLong } from "./time";

/**
 * The user lives on market time: Long Island, New York. Every timestamp in this product is
 * stored in UTC and displayed in America/New_York, and the app must never be wrong about
 * which side of a daylight-saving boundary it is on.
 *
 * The plan (§6.1) makes these tests mandatory and names the two dates explicitly: the March
 * and November transitions. In 2026 those fall on Sunday 8 March (clocks jump 2am -> 3am) and
 * Sunday 1 November (clocks fall back 2am -> 1am).
 *
 * All inputs below are UTC instants. That is the whole point: we assert on what the reader in
 * New York sees, not on what the machine's local timezone happens to be.
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
  it("renders a 24-hour clock so numerals stay the same width in a mono column", () => {
    // 20:05 UTC on a summer date is 16:05 in New York — five minutes after the close.
    expect(formatEtClock(new Date("2026-07-09T20:05:00Z"))).toBe("16:05");
  });

  it("pads the hour, so 09:30 never renders as 9:30 and shifts the column", () => {
    // 13:30 UTC in summer is 09:30 ET — the opening bell.
    expect(formatEtClock(new Date("2026-07-09T13:30:00Z"))).toBe("09:30");
  });

  it("reads the same wall-clock time on both sides of the March transition", () => {
    // Both instants are 16:05 in New York, one in EST and one in EDT.
    expect(formatEtClock(new Date("2026-03-06T21:05:00Z"))).toBe("16:05"); // EST, UTC-5
    expect(formatEtClock(new Date("2026-03-09T20:05:00Z"))).toBe("16:05"); // EDT, UTC-4
  });

  it("renders midnight as 00:00, not 24:00", () => {
    expect(formatEtClock(new Date("2026-07-09T04:00:00Z"))).toBe("00:00");
  });
});

describe("formatEtDate", () => {
  it("renders a short, unambiguous US date", () => {
    expect(formatEtDate(new Date("2026-07-09T20:05:00Z"))).toBe("Jul 9");
  });

  it("uses the New York calendar day, not the UTC one", () => {
    // 02:30Z on 10 July is still 22:30 on 9 July in New York. A naive UTC read says "Jul 10".
    expect(formatEtDate(new Date("2026-07-10T02:30:00Z"))).toBe("Jul 9");
  });
});

describe("formatAsOf", () => {
  it("produces the exact string every SectionMasthead shows", () => {
    expect(formatAsOf(new Date("2026-07-09T20:05:00Z"))).toBe("as of 16:05 ET");
  });

  it("still says ET in winter — the abbreviation is available, but the Desk shows ET only", () => {
    // CLAUDE.md, "Timing": display timezone is ET year-round, so the reader never has to
    // decode whether tonight is EDT or EST. etAbbreviation() exists for provenance contexts.
    expect(formatAsOf(new Date("2026-01-15T21:05:00Z"))).toBe("as of 16:05 ET");
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
