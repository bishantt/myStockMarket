// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isTradingDay, holidayName } from "@/lib/market-hours";
import { RUN_DATE, SEEDED_SESSION, sessionAt, sessionDayIso, sessionPlus, monthStart } from "./clock.mjs";
import { NEWS_CLUSTERS } from "./news.mjs";

/**
 * THE SEED VALIDATOR — every date the seeded world claims as a SESSION must be one (ruling E1).
 *
 * Why a fixture needs a calendar at all, and why this test is not pedantry:
 *
 * On 2026-07-11 production published an edition dated to a Saturday. The pipeline now refuses that
 * three ways over (the mode gate, the bar-derived edition, and publish's own lock). But a guard that
 * production obeys and the FIXTURES do not is a guard with a hole in it: the seeded world is what
 * every e2e journey and all 76 pixel baselines are photographed against, so a seeded Saturday would
 * mean the entire browser oracle certifying, forever, a screen that production is now forbidden to
 * produce. The tests would be green and the app would be right, and they would be describing
 * different worlds.
 *
 * THE FUSE THIS SITS ON. Drift rule 21 made the seeded world derive every date from ONE anchor
 * (fixtures/clock.mjs), which is what stopped the dates drifting apart. It did not — could not —
 * make them LAWFUL. The offsets are CALENDAR days, not sessions: `sessionPlus(-15)` from Thursday
 * 2026-07-09 lands on Wednesday 2026-06-24, which is fine, and `sessionPlus(-12)` would land on
 * Saturday 2026-06-27, which is not. Nothing about the anchor tells you which. Today every offset in
 * the seed happens to be lawful; the next one somebody writes is a coin flip, and the failure would
 * surface as a VRT diff in a room nobody was editing.
 *
 * WHAT COUNTS AS A CLAIM ABOUT A SESSION — and the distinction is the same one publish.py draws:
 *
 *   runDate / firedDate / resolvesOn   A CLAIM. "The market traded that day, and this is what it
 *                                      did." Checked here, every one of them.
 *   asOfDate (the macro board)         NOT a claim. It is the date the SOURCE published a number —
 *                                      Freddie Mac's mortgage rate, the BLS's CPI print, Nepal Rastra
 *                                      Bank's rupee reference, which is posted every calendar day
 *                                      including Sundays. Guarding these would refuse true rows for a
 *                                      rule that was never about them. (publish_macro_stats is
 *                                      exempt in the pipeline for exactly this reason — the two sides
 *                                      of the app must draw the line in the same place, or one of
 *                                      them is wrong.)
 */

const SEED = readFileSync(join(process.cwd(), "prisma", "seed.mjs"), "utf8");

/** The bare UTC calendar day of a seeded instant — the form the trading calendar reads. */
function tradingDay(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

/**
 * Every session-claiming date in prisma/seed.mjs, read out of its SOURCE.
 *
 * The seed cannot be imported: it calls main() at module scope and would connect to Prisma and start
 * writing. So this reads the file and evaluates each date expression against clock.mjs's own
 * helpers — the same helpers the seed itself calls, so the answer is the seed's answer and not a
 * re-derivation of it. (This repo already reads its own sources to check them: the pipeline's
 * test_ci_tag_families.py reads ci.yml for the same reason. A file you cannot import you can still
 * hold to account.)
 */
function seededSessionClaims(): { field: string; expression: string; day: string }[] {
  const pattern = /\b(runDate|firedDate|resolvesOn):\s*([A-Za-z_][\w]*(?:\([^)]*\))?)/g;
  const claims: { field: string; expression: string; day: string }[] = [];

  for (const [, field, expression] of SEED.matchAll(pattern)) {
    // A closed set of identifiers — clock.mjs's exports and nothing else. The seed has no other way
    // to say a date (drift rule 21 fails the build if it tries), so this cannot miss one.
    const evaluate = new Function(
      "RUN_DATE", "sessionAt", "sessionPlus", "sessionDayIso", "monthStart",
      `return (${expression});`,
    ) as (...args: unknown[]) => Date | string;

    claims.push({
      field,
      expression,
      day: tradingDay(evaluate(RUN_DATE, sessionAt, sessionPlus, sessionDayIso, monthStart)),
    });
  }

  return claims;
}

describe("the seeded world only claims sessions that happened", () => {
  it("sweeps a seed that actually has dates in it", () => {
    // NEGATIVE CONTROL, and it is the whole reason this test can be trusted. A regex that silently
    // stops matching — a rename, a reformat, a field moved into a helper — would turn this file into
    // a sweep of nothing, reporting a clean bill of health for a seed it never looked at. That is
    // precisely how /news went unmeasured for two tagged phases. So the sweep asserts its own catch.
    const claims = seededSessionClaims();
    expect(claims.length).toBeGreaterThanOrEqual(20);
    expect(claims.filter((c) => c.field === "firedDate")).toHaveLength(3);
    expect(claims.filter((c) => c.field === "resolvesOn")).toHaveLength(3);
  });

  it("stamps every seeded edition, fire and resolution on a real trading session", () => {
    const unlawful = seededSessionClaims().filter((claim) => !isTradingDay(claim.day));

    expect(
      unlawful.map((c) => `${c.field}: ${c.expression} → ${c.day} (${holidayName(c.day) ?? "a weekend"})`),
    ).toEqual([]);
  });

  it("dates every seeded news cluster to a session", () => {
    // The clusters carry their own runDate — the night the front page was assembled. A press-time on
    // a Saturday is the same lie as a close on one ("Assembled Saturday…" was one of the four
    // surfaces that rendered the production bug faithfully).
    const clusters = NEWS_CLUSTERS as { runDate: Date }[];
    expect(clusters.length).toBeGreaterThan(0);

    for (const cluster of clusters) {
      expect(isTradingDay(tradingDay(cluster.runDate)), `cluster runDate ${tradingDay(cluster.runDate)}`).toBe(true);
    }
  });

  it("hangs the whole seeded world on a session — the anchor itself", () => {
    expect(isTradingDay(SEEDED_SESSION)).toBe(true); // 2026-07-09, a Thursday
    expect(tradingDay(RUN_DATE)).toBe(SEEDED_SESSION);
  });

  it("can actually fail — the calendar rejects the day production wrongly stamped", () => {
    // If isTradingDay said yes to everything, every assertion above would pass on a broken seed.
    expect(isTradingDay("2026-07-11")).toBe(false); // the Saturday
    expect(isTradingDay("2026-11-26")).toBe(false); // Thanksgiving — a weekday with no session
    expect(isTradingDay("2026-07-10")).toBe(true); // the Friday it should have been
  });
});
