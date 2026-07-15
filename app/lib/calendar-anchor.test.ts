import { describe, expect, it } from "vitest";

import { calendarAnchorId, calendarAnchorIdFromDate, calendarDayHref } from "./calendar-anchor";

/**
 * The anchor id and href must agree exactly — a story's watch row and the Desk calendar's day stamp
 * their anchor from two different files, and two spellings is how a link and its target silently
 * walk apart. These pin the ONE format both sides read.
 */
describe("calendar day anchor", () => {
  it("builds a stable id from an ISO trading day", () => {
    expect(calendarAnchorId("2026-07-12")).toBe("cal-2026-07-12");
  });

  it("builds the same id from a Date as from that day's ISO string", () => {
    // The calendar builder holds Dates; the watch rows hold ISO strings. They must land on one id.
    const date = new Date("2026-07-12T00:00:00.000Z");
    expect(calendarAnchorIdFromDate(date)).toBe(calendarAnchorId("2026-07-12"));
  });

  it("the href is a hash link to the Desk — it never 404s, it only fails to scroll", () => {
    expect(calendarDayHref("2026-07-12")).toBe("/#cal-2026-07-12");
  });
});
