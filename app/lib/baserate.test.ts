import { describe, expect, it } from "vitest";

import { buildBaseRate, type BaseRateData } from "@/lib/baserate";
import { copy } from "@/lib/copy";

/**
 * Tests for lib/baserate.ts — the N-gated base-rate view-model (plan §6.2 mandatory: all three N
 * regimes, CI text, baseline cap). Every rendered string traces to the copy deck.
 */

const BASE: BaseRateData = {
  n: 120, wins: 66, winRate: 0.55, ciLow: 0.47, ciHigh: 0.63, baseline: 0.54,
  horizonDays: 10, refClass: "US large/mid", years: 5,
  publicationYear: 2001, evidenceGrade: "mixed", decayNote: "…",
};

describe("buildBaseRate — the three N regimes", () => {
  it("N ≥ 100 shows the percentage and the Wilson CI", () => {
    const view = buildBaseRate(BASE);
    expect(view.regime).toBe("full");
    expect(view.suppressed).toBe(false);
    expect(view.sentence).toContain("55%"); // percentage form
    expect(view.ciText).toContain("47%");
    expect(view.ciText).toContain("63%");
    expect(view.wideIntervalNote).toBeNull();
    expect(view.baselineLine).toContain("54%");
  });

  it("N 30–99 shows the natural frequency and the wide-interval note, no percentage or CI numerals", () => {
    const view = buildBaseRate({ ...BASE, n: 60, wins: 33 });
    expect(view.regime).toBe("frequency");
    expect(view.sentence).toContain("about 6 in 10"); // 0.55 → ~6 in 10
    expect(view.sentence).not.toContain("55%"); // no percentage
    expect(view.ciText).toBeNull(); // no CI numerals
    expect(view.wideIntervalNote).toBe(copy.baseRate.wideInterval);
  });

  it("N < 30 suppresses the rate entirely", () => {
    const view = buildBaseRate({ ...BASE, n: 12, wins: 7 });
    expect(view.regime).toBe("suppressed");
    expect(view.suppressed).toBe(true);
    expect(view.sentence).toBe(copy.baseRate.insufficient.replace("{n}", "12"));
    expect(view.sentence).not.toContain("%");
    expect(view.baselineLine).toBeNull();
  });
});

describe("buildBaseRate — the tier cap", () => {
  it("caps the tier at weak when the CI spans the baseline (RR Fig 9.3)", () => {
    const view = buildBaseRate({ ...BASE, winRate: 0.55, ciLow: 0.47, ciHigh: 0.65, baseline: 0.55 });
    expect(view.tier).toBe("weak");
  });

  it("lets a clear high rate reach a higher tier", () => {
    const view = buildBaseRate({ ...BASE, winRate: 0.75, ciLow: 0.72, ciHigh: 0.8, baseline: 0.54 });
    expect(view.tier).toBe("strong");
  });
});

describe("buildBaseRate — decay stamp", () => {
  it("carries the publication year, grade, and note when present", () => {
    const view = buildBaseRate(BASE);
    expect(view.decay).toEqual({ year: 2001, grade: "mixed", note: "…" });
  });

  it("is null when the pattern has no provenance", () => {
    const view = buildBaseRate({ ...BASE, publicationYear: null, evidenceGrade: null, decayNote: null });
    expect(view.decay).toBeNull();
  });
});
