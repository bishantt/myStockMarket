import { describe, expect, it } from "vitest";

import { buildWorkedExample } from "./worked-example";
import type { BaseRateData } from "./baserate";

/**
 * lib/worked-example.test.ts — the fixed three-step worked-example template (plan §7 P5 step 4).
 *
 * The template is always: (1) what happened in the data, (2) what pattern this matches and why it is
 * believed to matter, (3) what happened the last N times — with the failure count shown, never hidden.
 * The markers are numbered 1–3 and map one-to-one to the steps.
 */

const baseRate = (over: Partial<BaseRateData> = {}): BaseRateData => ({
  n: 120,
  wins: 66,
  winRate: 0.55,
  ciLow: 0.46,
  ciHigh: 0.64,
  baseline: 0.53,
  horizonDays: 10,
  refClass: "US large/mid",
  ...over,
});

const input = (over: Partial<BaseRateData> = {}) => ({
  symbol: "DEMO",
  patternKey: "golden-cross",
  patternLabel: "Golden cross",
  cause: "The 50-day average crossed above the 200-day.",
  baseRate: baseRate(over),
});

describe("buildWorkedExample", () => {
  it("produces exactly three numbered steps in the fixed order", () => {
    const example = buildWorkedExample(input());
    expect(example.steps.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(example.steps[0].title.toLowerCase()).toContain("data");
    expect(example.steps[1].body).toMatch(/believed|idea|evidence/i);
  });

  it("gives one marker per step, numbered to match", () => {
    const example = buildWorkedExample(input());
    expect(example.markers).toHaveLength(3);
    expect(example.markers.map((m) => m.n)).toEqual([1, 2, 3]);
    expect(example.markers.map((m) => m.step)).toEqual([1, 2, 3]);
  });

  it("shows the failure count in step three (N minus wins), never hidden", () => {
    const example = buildWorkedExample(input({ n: 120, wins: 66 }));
    expect(example.failureCount).toBe(54);
    expect(example.steps[2].body).toContain("54");
    expect(example.steps[2].body).toContain("66");
  });

  it("names the pattern and its evidence-based belief in step two", () => {
    const example = buildWorkedExample(input());
    expect(example.steps[1].body).toMatch(/moving average|50-day|weak/i);
  });

  it("suppresses the outcome step honestly when N is below 30", () => {
    const example = buildWorkedExample(input({ n: 12, wins: 7 }));
    expect(example.suppressed).toBe(true);
    expect(example.steps[2].body.toLowerCase()).toContain("anecdote");
    // A tiny sample must not advertise a failure count as if it were a statistic.
    expect(example.steps[2].body).not.toContain("5 times");
  });

  it("falls back to a generic belief line for an unknown pattern", () => {
    const example = buildWorkedExample({ ...input(), patternKey: "mystery", patternLabel: "Mystery" });
    expect(example.steps[1].body.length).toBeGreaterThan(0);
  });
});
