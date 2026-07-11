import { describe, expect, it } from "vitest";

import { M3_SLUGS, GATED_MODULES, isM3Complete, isLessonSoftGated } from "./academy-progress";

/**
 * lib/academy-progress.test.ts — the M3 soft-gate logic (plan §7 P5 step 1/6).
 *
 * The rule the plan makes contractual: a pattern lesson (modules M4/M5) shows a soft gate until the
 * risk module M3 is complete — risk before patterns. It is SOFT: the reader may still proceed.
 */

describe("isM3Complete", () => {
  it("is true only when every M3 lesson has been read", () => {
    expect(isM3Complete(M3_SLUGS)).toBe(true);
    expect(isM3Complete([...M3_SLUGS, "candles-honestly"])).toBe(true);
  });

  it("is false when any M3 lesson is missing", () => {
    expect(isM3Complete(M3_SLUGS.slice(1))).toBe(false);
    expect(isM3Complete([])).toBe(false);
  });
});

describe("isLessonSoftGated", () => {
  it("gates a pattern lesson (M4/M5) until M3 is complete", () => {
    for (const moduleKey of GATED_MODULES) {
      expect(isLessonSoftGated(moduleKey, [])).toBe(true);
      expect(isLessonSoftGated(moduleKey, M3_SLUGS)).toBe(false);
    }
  });

  it("never gates the foundational or risk modules themselves", () => {
    for (const moduleKey of ["M0", "M1", "M2", "M3", "M6"]) {
      expect(isLessonSoftGated(moduleKey, [])).toBe(false);
    }
  });
});
