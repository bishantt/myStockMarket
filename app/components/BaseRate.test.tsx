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

/**
 * C3, ASSERTED ON THE RENDERED TREE — not just on the type.
 *
 * RangeControl's own tests prove the component refuses to mount on an evidence surface. This proves
 * the other direction: that the evidence surface, as it actually renders, contains no time control
 * of any kind — no radiogroup, no range fieldset, nothing a reader could push to change the horizon.
 *
 * Both halves are needed, and they fail differently. The type test catches someone importing
 * RangeControl into BaseRate. THIS catches someone hand-rolling a horizon toggle out of plain
 * buttons, which the type system would never see, and which is exactly how the rule would actually
 * be broken — nobody breaks an honesty rule by importing the component named after it.
 *
 * The horizon is a PROPERTY of the pattern (10 trading days, because that is what the evidence
 * measured). It is not a preference, and a reader must never be able to fish across horizons until
 * one of them flatters the pattern.
 */
describe("C3 — a base rate offers NO way to change its horizon", () => {
  it("renders no radiogroup, no range control, and no horizon buttons", () => {
    const { container } = render(<BaseRate data={BASE} />);

    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(container.querySelector("fieldset")).toBeNull();
    // No interactive control at all: a base rate is a statement, and a statement has no settings.
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("states its horizon as a FACT, in the sentence, where it cannot be mistaken for a setting", () => {
    render(<BaseRate data={BASE} />);
    // "10 trading days" appears as prose. The number is the evidence's, not the reader's.
    expect(screen.getByText(/10 trading days/)).toBeInTheDocument();
  });
});
