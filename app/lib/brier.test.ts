import { describe, expect, it } from "vitest";

import { brierScore, calibrationBuckets, rollingBrier, type ResolvedForecast } from "./brier";

/**
 * lib/brier.test.ts — forecast scoring and calibration (plan §7 P6 step 3–4).
 *
 * Brier is (probability − outcome)²; a coin-flip forecast scores 0.25. Calibration buckets group
 * forecasts by predicted probability and compare the predicted rate to what actually happened.
 */

const f = (probability: number, outcome: 0 | 1): ResolvedForecast => ({ probability, outcome });

describe("brierScore", () => {
  it("is zero for a perfectly confident, correct forecast", () => {
    expect(brierScore(1, 1)).toBe(0);
    expect(brierScore(0, 0)).toBe(0);
  });

  it("is one for a perfectly confident, wrong forecast", () => {
    expect(brierScore(1, 0)).toBe(1);
  });

  it("is 0.25 for a coin-flip forecast (the anchor)", () => {
    expect(brierScore(0.5, 1)).toBeCloseTo(0.25, 6);
    expect(brierScore(0.5, 0)).toBeCloseTo(0.25, 6);
  });
});

describe("rollingBrier", () => {
  it("averages the Brier scores of resolved forecasts", () => {
    const forecasts = [f(0.5, 1), f(0.5, 0), f(1, 1)]; // 0.25, 0.25, 0 → mean 0.1667
    expect(rollingBrier(forecasts)).toBeCloseTo(0.5 / 3, 6);
  });

  it("is null with no resolved forecasts (nothing to average)", () => {
    expect(rollingBrier([])).toBeNull();
  });
});

describe("calibrationBuckets", () => {
  it("groups by decile and reports predicted vs actual with N", () => {
    // Two forecasts in the 0.7 decile [0.70, 0.80) that both happened, one in 0.2 that did not.
    const forecasts = [f(0.72, 1), f(0.78, 1), f(0.22, 0)];
    const buckets = calibrationBuckets(forecasts);
    const seventies = buckets.find((b) => b.lower === 0.7);
    expect(seventies?.n).toBe(2);
    expect(seventies?.actual).toBeCloseTo(1, 6);
    expect(seventies?.predictedMean).toBeCloseTo(0.75, 6);
    const twenties = buckets.find((b) => b.lower === 0.2);
    expect(twenties?.n).toBe(1);
    expect(twenties?.actual).toBe(0);
  });

  it("omits empty buckets so the scatter only shows measured points", () => {
    const buckets = calibrationBuckets([f(0.55, 1)]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].lower).toBe(0.5);
  });
});
