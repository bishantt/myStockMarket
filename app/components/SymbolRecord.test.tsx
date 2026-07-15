import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SymbolRecord } from "./SymbolRecord";
import type { SymbolRecord as RecordData } from "@/lib/record";
import type { SetupCardView } from "@/components/desk/SetupCards";
import type { BaseRateData } from "@/lib/baserate";

/**
 * The record block RENDERS what the ledger holds and shows NOTHING when it is silent (P9). It is
 * reuse of the honesty components — the base rate through BaseRate, the resolved outcomes through
 * OutcomeChip at equal weight — so the tests check that each piece appears only when its data does.
 */
const baseRate: BaseRateData = {
  n: 140,
  wins: 77,
  winRate: 0.55,
  ciLow: 0.47,
  ciHigh: 0.63,
  baseline: 0.54,
  horizonDays: 10,
  refClass: "US large/mid names",
  publicationYear: 1992,
  evidenceGrade: "weak",
  decayNote: null,
};

const setupCard: SetupCardView = {
  id: "c1",
  symbol: "SPY",
  patternLabel: "Golden cross",
  patternKey: "golden-cross",
  tier: "weak",
  cause: "the 50-day average crossed above the 200-day",
  baseRate,
  weakeners: [],
  weakenerState: {},
  learnSlug: null,
};

const empty: RecordData = { activeSignals: [], setupCard: null, resolved: { hits: 0, misses: 0 } };

describe("SymbolRecord", () => {
  it("shows the setup card's pattern and its base rate when there is one", () => {
    render(<SymbolRecord record={{ ...empty, setupCard }} />);
    expect(screen.getByText("Golden cross")).toBeInTheDocument();
    expect(screen.getByText(/the 50-day average crossed/)).toBeInTheDocument();
    // The base rate's N reaches the surface (BaseRate renders it) — proof the evidence is shown.
    expect(screen.getAllByText(/140/).length).toBeGreaterThan(0);
  });

  it("shows resolved hits and misses — a miss is as present as a hit", () => {
    render(<SymbolRecord record={{ ...empty, resolved: { hits: 2, misses: 1 } }} />);
    expect(screen.getByText(/Resolved here/i)).toBeInTheDocument();
    expect(screen.getByText(/2 hits/)).toBeInTheDocument();
    expect(screen.getByText(/1 miss/)).toBeInTheDocument();
  });

  it("shows an open signal with its fired and resolves dates", () => {
    render(
      <SymbolRecord
        record={{
          ...empty,
          activeSignals: [
            {
              patternKey: "golden-cross",
              patternLabel: "Golden cross",
              firedDate: new Date("2026-07-01T00:00:00Z"),
              resolvesOn: new Date("2026-07-15T00:00:00Z"),
              horizonDays: 10,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Golden cross")).toBeInTheDocument();
    expect(screen.getByText(/Fired/)).toBeInTheDocument();
  });

  it("renders nothing legible when the ledger is silent — no apology", () => {
    render(<SymbolRecord record={empty} />);
    expect(screen.queryByText(/Resolved here/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Golden cross/)).not.toBeInTheDocument();
  });
});
