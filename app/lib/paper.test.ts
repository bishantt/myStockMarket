import { describe, expect, it } from "vitest";

import {
  costMirrorDrag,
  exceedsFrequencyMirror,
  halfKellyFraction,
  simulateFill,
} from "./paper";
import { KELLY_FRACTION_CAP } from "./constants";

/**
 * lib/paper.test.ts — the paper-desk arithmetic (plan §7 P6, Appendix F).
 *
 * Three pieces the acceptance pins down: fills move against the trader by the right amount, the
 * size suggestion never exceeds half-Kelly (a property test over random inputs), and the cost mirror
 * reproduces spread × turnover.
 */

describe("simulateFill", () => {
  it("fills a buy above the open by half the spread plus slippage (large/mid)", () => {
    const fill = simulateFill({ side: "buy", nextOpen: 100, bucket: "large-mid" });
    // half of 20bp = 10bp, plus 5bp slippage = 15bp = 0.15% → 100.15
    expect(fill.fillPrice).toBeCloseTo(100.15, 6);
    expect(fill.costBps).toBeCloseTo(15, 6);
  });

  it("fills a sell below the open by the same amount", () => {
    const fill = simulateFill({ side: "sell", nextOpen: 100, bucket: "large-mid" });
    expect(fill.fillPrice).toBeCloseTo(99.85, 6);
  });

  it("uses the wider small-cap spread (60bp → 30bp half + 5bp)", () => {
    const fill = simulateFill({ side: "buy", nextOpen: 100, bucket: "small" });
    expect(fill.costBps).toBeCloseTo(35, 6); // 30 + 5
    expect(fill.fillPrice).toBeCloseTo(100.35, 6);
  });

  it("always moves the fill against the trader (buy up, sell down)", () => {
    const buy = simulateFill({ side: "buy", nextOpen: 50, bucket: "large-mid" });
    const sell = simulateFill({ side: "sell", nextOpen: 50, bucket: "large-mid" });
    expect(buy.fillPrice).toBeGreaterThan(50);
    expect(sell.fillPrice).toBeLessThan(50);
  });
});

describe("halfKellyFraction", () => {
  it("halves the Kelly fraction for a favourable bet", () => {
    // p = 0.6, payoff b = 2 → Kelly = p - (1-p)/b = 0.6 - 0.4/2 = 0.4 → half = 0.2
    expect(halfKellyFraction(0.6, 2)).toBeCloseTo(0.2, 6);
  });

  it("returns zero when the edge is non-positive (never suggests a losing bet)", () => {
    expect(halfKellyFraction(0.4, 1)).toBe(0); // Kelly = 0.4 - 0.6 = -0.2 → clamp 0
    expect(halfKellyFraction(0.5, 1)).toBe(0);
  });

  it("never exceeds half-Kelly, for random inputs (property)", () => {
    for (let i = 0; i < 500; i++) {
      const p = (i % 100) / 100; // 0..0.99 deterministically (no Math.random in this repo's spirit)
      const b = 0.1 + ((i * 7) % 50) / 10; // 0.1..5.0
      const half = halfKellyFraction(p, b);
      const fullKelly = p - (1 - p) / b;
      expect(half).toBeLessThanOrEqual(Math.max(0, fullKelly) / 2 + 1e-9);
      expect(half).toBeLessThanOrEqual(KELLY_FRACTION_CAP + 1e-9);
      expect(half).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("costMirrorDrag", () => {
  it("reproduces spread × turnover as an annual drag fraction", () => {
    // 20bp effective spread × 8 round trips/year = 160bp = 1.6%
    const drag = costMirrorDrag({ roundTripsPerYear: 8, effectiveSpreadBps: 20 });
    expect(drag.annualDragBps).toBeCloseTo(160, 6);
    expect(drag.annualDragFraction).toBeCloseTo(0.016, 6);
  });
});

describe("exceedsFrequencyMirror", () => {
  it("flags more than five paper round-trips in a week", () => {
    expect(exceedsFrequencyMirror(6)).toBe(true);
    expect(exceedsFrequencyMirror(5)).toBe(false);
    expect(exceedsFrequencyMirror(0)).toBe(false);
  });
});
