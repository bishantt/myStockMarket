import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BaseRate } from "./BaseRate";
import type { BaseRateData } from "@/lib/baserate";
import { copy } from "@/lib/copy";

/**
 * BaseRate renderer tests (plan §6.2 mandatory: all three N regimes, CI text, baseline). The
 * view-model is tested in lib/baserate.test.ts; this proves the component renders each regime.
 */

const BASE: BaseRateData = {
  n: 140, wins: 77, winRate: 0.55, ciLow: 0.47, ciHigh: 0.63, baseline: 0.54,
  horizonDays: 10, refClass: "US large/mid names", years: 5,
  publicationYear: 1992, evidenceGrade: "weak", decayNote: "…",
};

describe("BaseRate", () => {
  it("N ≥ 100 renders the percentage, the CI, the baseline, and the decay stamp", () => {
    render(<BaseRate data={BASE} />);
    expect(screen.getByText(/55%/)).toBeInTheDocument();
    expect(screen.getByText(/95% interval/)).toBeInTheDocument();
    expect(screen.getByText(/read this against that baseline/)).toBeInTheDocument();
    expect(screen.getByText(/since 1992/)).toBeInTheDocument();
  });

  it("N 30–99 renders the natural frequency and the wide-interval note, no percentage", () => {
    render(<BaseRate data={{ ...BASE, n: 60, wins: 33 }} />);
    expect(screen.getByText(/about 6 in 10/)).toBeInTheDocument();
    expect(screen.getByText(copy.baseRate.wideInterval)).toBeInTheDocument();
    expect(screen.queryByText(/95% interval/)).not.toBeInTheDocument();
  });

  it("N < 30 renders only the suppression line", () => {
    render(<BaseRate data={{ ...BASE, n: 12, wins: 7 }} />);
    expect(screen.getByText(/Insufficient history/)).toBeInTheDocument();
    expect(screen.queryByText(/95% interval/)).not.toBeInTheDocument();
  });
});
