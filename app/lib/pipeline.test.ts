import { describe, expect, it } from "vitest";

import { toTradingDate } from "@/lib/pipeline";
import { isNewInEdition } from "@/lib/news";
import { freshness } from "@/lib/freshness";

/**
 * THE SEAM BETWEEN THE DATABASE ROW AND THE FRESHNESS MACHINE.
 *
 * This file exists because of a bug that every other test in the suite was structurally incapable
 * of finding, and it is worth stating plainly, because the shape of it will recur.
 *
 * `freshness()` has nineteen unit tests. `PipelineStrip` has fifteen. All thirty-four passed while
 * the Desk could not render at all — because every one of them CONSTRUCTED ITS OWN FIXTURE, and
 * every fixture was correct. They handed the machine a bare trading date, `"2026-07-10"`, which is
 * what the machine wants.
 *
 * The database hands it something else. `pipeline_run.runDate` is a Prisma `@db.Date` — a trading
 * DAY, stored at UTC midnight — and the loader called `.toISOString()` on it, which is right for an
 * instant and wrong for a date: it produced `"2026-07-10T00:00:00.000Z"`. The machine then built
 * `new Date("2026-07-10T00:00:00.000Z" + "T00:00:00Z")`, got an Invalid Date, and threw a
 * RangeError the first time anything tried to format it. The production prerender caught it. No
 * test did, and no test could have, because the defect was in neither component — it was in the
 * JOINT, and both sides of a joint can be individually perfect while the joint is broken.
 *
 * So this file tests the joint. It asserts the exact shape the loader produces, and it feeds that
 * shape to the real machine.
 */

describe("toTradingDate — a @db.Date is a DAY, not an instant", () => {
  it("returns a bare calendar date, never a timestamp", () => {
    // The whole bug, in one assertion.
    expect(toTradingDate(new Date("2026-07-10T00:00:00.000Z"))).toBe("2026-07-10");
  });

  it("reads the UTC components, so it never rolls back a day into New York's evening", () => {
    // A bare date stored at UTC midnight IS 2026-07-10. Formatting it in Eastern time would make it
    // "2026-07-09" — the trap lib/time.ts already documents, here at the other end of the pipe.
    expect(toTradingDate(new Date("2026-07-13T00:00:00.000Z"))).toBe("2026-07-13");
  });
});

describe("isNewInEdition — the 'new' tag's boundary is the prior edition's press time (CC10, R8)", () => {
  const prior = new Date("2026-07-14T23:36:00Z"); // when the prior edition went to press

  it("tags a row first seen AFTER the prior edition went to press", () => {
    expect(isNewInEdition(new Date("2026-07-15T06:31:00Z"), prior)).toBe(true);
  });

  it("does NOT tag a row carried over from the prior edition (first seen at or before its press)", () => {
    expect(isNewInEdition(new Date("2026-07-14T20:00:00Z"), prior)).toBe(false);
    expect(isNewInEdition(prior, prior)).toBe(false); // exactly at press time is not "after"
  });

  it("tags NOTHING when there is no prior edition — 'everything is new' is not information (R8)", () => {
    expect(isNewInEdition(new Date("2026-07-15T06:31:00Z"), null)).toBe(false);
  });
});

describe("the loader's output actually drives the machine", () => {
  it("a row straight out of Prisma grades without throwing, and grades correctly", () => {
    // This is the test that would have caught it. The input is exactly what the database gives the
    // loader — a Date at UTC midnight — passed through the loader's own converter, and then into
    // the real state machine with no hand-tidying in between.
    const rowFromPrisma = new Date("2026-07-10T00:00:00.000Z"); // Friday
    const run = {
      runDate: toTradingDate(rowFromPrisma),
      finishedAt: new Date("2026-07-10T22:41:00.000Z"),
    };

    const f = freshness(run, new Date("2026-07-11T09:00:00-04:00")); // Saturday morning

    expect(f.state).toBe("fresh");
    expect(f.lastGoodSession).toBe("2026-07-10");
    // If runDate were still a timestamp, this would be an Invalid Date and formatting it would throw.
    expect(Number.isNaN(f.nextRunAt.getTime())).toBe(false);
  });

  it("refuses a timestamp where a trading date belongs, loudly", () => {
    // The defensive half. If a future loader regresses and hands the machine a full ISO string
    // again, it must fail where the mistake IS — not silently produce an Invalid Date that surfaces
    // as a RangeError three components away, in a formatter that did nothing wrong.
    const badRun = {
      runDate: "2026-07-10T00:00:00.000Z", // a timestamp, not a trading date
      finishedAt: new Date("2026-07-10T22:41:00.000Z"),
    };

    expect(() => freshness(badRun, new Date("2026-07-11T09:00:00-04:00"))).toThrow(/trading date/i);
  });
});
