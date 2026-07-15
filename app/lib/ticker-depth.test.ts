import { describe, expect, it } from "vitest";

import { computeRangeStrip, FULL_YEAR_SESSIONS } from "./ticker-depth";

/**
 * The 52-week strip's computation (PD8, plan 10.3). A range without its window is a claim without a
 * scope, so the strip states the ACTUAL session count — and it degrades honestly, never inventing a
 * 52-week range out of a thin history. These tests pin both: the numbers, and the absences.
 */
describe("computeRangeStrip", () => {
  it("finds the low, high, current and position over the closes", () => {
    // low 90, high 120, current (last) 110 → position (110-90)/(120-90) = 0.6667
    const strip = computeRangeStrip([100, 120, 90, 110], "2026-07-09");
    expect(strip).not.toBeNull();
    expect(strip?.low).toBe(90);
    expect(strip?.high).toBe(120);
    expect(strip?.current).toBe(110);
    expect(strip?.position).toBeCloseTo(20 / 30, 6);
    expect(strip?.sessions).toBe(4);
    expect(strip?.through).toBe("2026-07-09");
  });

  it("uses ONLY the trailing 252 sessions — an ancient low outside the window does not count", () => {
    // 48 ancient bars at 1 (far below), then 252 bars climbing from 100. The window is the last 252,
    // so the low is 100, NOT 1. A "52-week" range that reached back further would not be one.
    const ancient = new Array(48).fill(1);
    const window = Array.from({ length: FULL_YEAR_SESSIONS }, (_, i) => 100 + i);
    const strip = computeRangeStrip([...ancient, ...window], "2026-07-09");
    expect(strip?.sessions).toBe(FULL_YEAR_SESSIONS);
    expect(strip?.low).toBe(100);
    expect(strip?.high).toBe(100 + FULL_YEAR_SESSIONS - 1);
  });

  it("is absent with fewer than two bars — a range needs two points", () => {
    expect(computeRangeStrip([], "d")).toBeNull();
    expect(computeRangeStrip([100], "d")).toBeNull();
  });

  it("is absent when every close is identical — a flat range has no position to draw", () => {
    // Absence beats invention (the registry's own rule): a zero-width range is not rendered as a
    // marker pinned to one end, which would read as a claim it is not.
    expect(computeRangeStrip([50, 50, 50], "d")).toBeNull();
  });

  it("clamps position to the ends — current at the low is 0, at the high is 1", () => {
    expect(computeRangeStrip([100, 120, 80, 80], "d")?.position).toBe(0);
    expect(computeRangeStrip([100, 80, 120, 120], "d")?.position).toBe(1);
  });
});
