import { describe, expect, it } from "vitest";
import { buildLadder, type LadderBand } from "./range-ladder";

/**
 * The Range Ladder's geometry, tested as the pure function it is.
 *
 * The ladder is the app's visual centrepiece and its most dangerous drawing. A forward-widening
 * cone — the shape every other product draws here — IS the visual grammar of a projection: the eye
 * reads it as "the future goes that way, and here is how sure we are". Ours is the same information
 * sliced into discrete horizons, on a signed-return axis, with nothing joining the rows.
 *
 * Two of the tests below are not really tests of geometry. They are the honesty locks:
 *
 *   · there is NO 50th-percentile mark of any kind — no stroke, no tick, no label. A median line is
 *     a point forecast wearing an interval's clothes, and it is the single easiest way to turn this
 *     chart back into the thing it exists not to be.
 *   · nothing connects one horizon row to the next. Join the bands and you have redrawn the cone.
 */

const BANDS: LadderBand[] = [
  { horizonDays: 5, coverage: 0.8, lo: -0.043, hi: 0.048, label: "5-day", n: 240, windowDays: 500 },
  { horizonDays: 5, coverage: 0.5, lo: -0.018, hi: 0.021, label: "5-day", n: 240, windowDays: 500 },
  { horizonDays: 10, coverage: 0.8, lo: -0.062, hi: 0.071, label: "10-day", n: 235, windowDays: 500 },
  { horizonDays: 10, coverage: 0.5, lo: -0.027, hi: 0.031, label: "10-day", n: 235, windowDays: 500 },
  { horizonDays: 20, coverage: 0.8, lo: -0.089, hi: 0.104, label: "20-day", n: 225, windowDays: 500 },
  { horizonDays: 20, coverage: 0.5, lo: -0.038, hi: 0.045, label: "20-day", n: 225, windowDays: 500 },
];

describe("buildLadder", () => {
  it("makes one row per horizon, in ascending order", () => {
    const ladder = buildLadder(BANDS);
    expect(ladder.rows.map((r) => r.horizonDays)).toEqual([5, 10, 20]);
  });

  it("nests the 50% band inside the 80% band on every row", () => {
    const ladder = buildLadder(BANDS);
    for (const row of ladder.rows) {
      expect(row.inner.x).toBeGreaterThan(row.outer.x);
      expect(row.inner.x + row.inner.width).toBeLessThan(row.outer.x + row.outer.width);
    }
  });

  it("puts zero — the last close — at the same x on every row", () => {
    // The zero line is the ladder's one strong anchor: every band is a return FROM here. If it
    // drifted between rows, the rows would no longer be comparable and the chart would be a lie.
    const ladder = buildLadder(BANDS);
    const zeroes = ladder.rows.map((r) => r.zeroX);
    expect(new Set(zeroes.map((z) => z.toFixed(6))).size).toBe(1);
    expect(zeroes[0]).toBe(ladder.zeroX);
  });

  it("scales every row against ONE shared axis, so the widening is real and visible", () => {
    // The 20-day band is genuinely wider than the 5-day one. That has to be *shown*, not asserted:
    // per-row autoscaling would draw every horizon the same width and hide the fact that
    // uncertainty grows with time — which is the single most useful thing the ladder teaches.
    const ladder = buildLadder(BANDS);
    const [five, , twenty] = ladder.rows;
    expect(twenty.outer.width).toBeGreaterThan(five.outer.width);
  });

  it("HAS NO 50th-percentile mark — no stroke, no tick, no label, no field to hold one", () => {
    // The honesty lock. A median line is a point forecast in an interval's clothing.
    const ladder = buildLadder(BANDS);
    for (const row of ladder.rows) {
      expect(row).not.toHaveProperty("median");
      expect(row).not.toHaveProperty("medianX");
      expect(row).not.toHaveProperty("p50");
    }
    expect(JSON.stringify(ladder)).not.toMatch(/median|p50/i);
  });

  it("emits NOTHING that joins one horizon row to the next", () => {
    // The other lock. A silhouette drawn across the rows is a forward-widening cone, and a cone is
    // a projection whatever the label under it says.
    const ladder = buildLadder(BANDS);
    expect(ladder).not.toHaveProperty("silhouette");
    expect(ladder).not.toHaveProperty("connector");
    expect(ladder).not.toHaveProperty("path");
  });

  it("carries N and the window on every row — a range without its sample is an assertion", () => {
    const ladder = buildLadder(BANDS);
    for (const row of ladder.rows) {
      expect(row.n).toBeGreaterThan(0);
      expect(row.windowDays).toBeGreaterThan(0);
    }
  });

  it("places the quantile dots inside the outer band, spanning it", () => {
    const ladder = buildLadder(BANDS);
    for (const row of ladder.rows) {
      expect(row.dots).toHaveLength(20); // 20 dots = 20 equal-probability outcomes
      for (const dot of row.dots) {
        expect(dot.x).toBeGreaterThanOrEqual(row.outer.x - 0.001);
        expect(dot.x).toBeLessThanOrEqual(row.outer.x + row.outer.width + 0.001);
      }
      // Above zero is a gain, below is a loss — the dot knows which, so the shape channel can too.
      const belowZero = row.dots.filter((d) => d.x < row.zeroX);
      expect(belowZero.every((d) => !d.above)).toBe(true);
    }
  });

  it("returns no rows when the pipeline stored no bands", () => {
    expect(buildLadder([]).rows).toEqual([]);
  });

  it("ignores a horizon beyond 20 days — the ≤20d rule is in the geometry, not just the schema", () => {
    const withLong: LadderBand[] = [
      ...BANDS,
      { horizonDays: 60, coverage: 0.8, lo: -0.2, hi: 0.25, label: "60-day", n: 200, windowDays: 500 },
      { horizonDays: 60, coverage: 0.5, lo: -0.1, hi: 0.12, label: "60-day", n: 200, windowDays: 500 },
    ];
    expect(buildLadder(withLong).rows.map((r) => r.horizonDays)).toEqual([5, 10, 20]);
  });

  it("drops a horizon that has no 80% band — the outer band IS the row", () => {
    const innerOnly: LadderBand[] = [
      { horizonDays: 5, coverage: 0.5, lo: -0.018, hi: 0.021, label: "5-day", n: 240, windowDays: 500 },
    ];
    expect(buildLadder(innerOnly).rows).toEqual([]);
  });
});
