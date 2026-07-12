import { describe, expect, it } from "vitest";
import { marketState } from "./market-hours";

/**
 * The nav's market-state dot says one word about the exchange. It had better be true.
 *
 * The temptation here is to check the weekday and the clock and call it done. That produces an
 * indicator that cheerfully says "Open" on Christmas morning — a small lie, told confidently, in an
 * app whose entire argument is that it does not tell small lies confidently. So the holidays are
 * modelled, and a half-day closes early.
 */

/** 14:30 UTC = 10:30 EDT — the middle of a summer session. */
const summerMidSession = (day: number) => new Date(`2026-07-${String(day).padStart(2, "0")}T14:30:00Z`);

describe("marketState", () => {
  it("is open in the middle of a normal weekday session", () => {
    // Wednesday 8 July 2026, 10:30 EDT.
    expect(marketState(summerMidSession(8))).toBe("open");
  });

  it("is closed at the weekend", () => {
    expect(marketState(summerMidSession(11))).toBe("closed"); // Saturday
    expect(marketState(summerMidSession(12))).toBe("closed"); // Sunday
  });

  it("is closed before the opening bell and after the close", () => {
    expect(marketState(new Date("2026-07-08T13:00:00Z"))).toBe("closed"); // 09:00 EDT
    expect(marketState(new Date("2026-07-08T20:30:00Z"))).toBe("closed"); // 16:30 EDT
  });

  it("opens exactly at 9:30 ET and closes exactly at 16:00 ET", () => {
    expect(marketState(new Date("2026-07-08T13:30:00Z"))).toBe("open"); // 09:30 EDT sharp
    expect(marketState(new Date("2026-07-08T19:59:00Z"))).toBe("open"); // 15:59 EDT
    expect(marketState(new Date("2026-07-08T20:00:00Z"))).toBe("closed"); // 16:00 EDT sharp
  });

  it("is closed on a market holiday, even at what would be mid-session", () => {
    // Independence Day observed, Friday 3 July 2026. A weekday-and-clock check would say "open".
    expect(marketState(summerMidSession(3))).toBe("closed");
    // Christmas Day, Friday 25 December 2026.
    expect(marketState(new Date("2026-12-25T16:00:00Z"))).toBe("closed"); // 11:00 EST
  });

  it("closes at 13:00 ET on a half day", () => {
    // The day after Thanksgiving, Friday 27 November 2026 — the market closes at 1pm.
    expect(marketState(new Date("2026-11-27T16:00:00Z"))).toBe("open"); // 11:00 EST — still trading
    expect(marketState(new Date("2026-11-27T18:30:00Z"))).toBe("closed"); // 13:30 EST — shut
  });

  it("respects Eastern time across the daylight-saving boundary", () => {
    // 14:30 UTC is 10:30 EDT in July (open) but 09:30 EST in January (also open, at the bell).
    expect(marketState(new Date("2026-01-08T14:30:00Z"))).toBe("open");
    // 14:00 UTC in January is 09:00 EST — before the bell.
    expect(marketState(new Date("2026-01-08T14:00:00Z"))).toBe("closed");
  });
});
