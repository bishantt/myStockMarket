import { describe, expect, it } from "vitest";

import { nRegime, tierFor } from "@/lib/constants";

/**
 * Tests for lib/constants.ts — the tier bands, the CI-spans-baseline cap, and the N-gate regimes
 * (plan §6.2 mandatory: tier-cap logic, the RR Fig 9.3 case as a literal fixture).
 */

describe("tierFor", () => {
  it("applies the Appendix F win-rate bands when the CI is clear of the baseline", () => {
    expect(tierFor(0.45, 0.4, 0.5, 0.3)).toBe("weak"); // < 50%
    expect(tierFor(0.55, 0.52, 0.58, 0.3)).toBe("weak"); // 50–58%
    expect(tierFor(0.64, 0.6, 0.68, 0.3)).toBe("moderate"); // 58–70%
    expect(tierFor(0.75, 0.72, 0.78, 0.3)).toBe("strong"); // > 70%
  });

  it("caps the tier at weak when the CI spans the baseline (RR Fig 9.3: CI 47–65 vs baseline 55)", () => {
    expect(tierFor(0.55, 0.47, 0.65, 0.55)).toBe("weak");
    // A high point estimate is still capped if its interval spans the baseline.
    expect(tierFor(0.72, 0.55, 0.85, 0.6)).toBe("weak");
  });
});

describe("nRegime", () => {
  it("splits the three N regimes at the Appendix F thresholds", () => {
    expect(nRegime(120)).toBe("full"); // ≥ 100 → % + CI
    expect(nRegime(100)).toBe("full");
    expect(nRegime(60)).toBe("frequency"); // 30–99 → "X in 10" + wide-interval note
    expect(nRegime(30)).toBe("frequency");
    expect(nRegime(29)).toBe("suppressed"); // < 30 → suppressed
    expect(nRegime(0)).toBe("suppressed");
  });
});
