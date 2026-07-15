import { describe, expect, it } from "vitest";

import { hasRecord, type SymbolRecord } from "./record";

/**
 * `hasRecord` decides whether the "what our record says" block renders at all — the caller owns the
 * empty state, and an empty record is the COMMON case (most names have no setup, no open signal and
 * no resolved history). A block that renders on nothing would be an apology; this keeps it silent.
 */
const empty: SymbolRecord = { activeSignals: [], setupCard: null, resolved: { hits: 0, misses: 0 } };

describe("hasRecord", () => {
  it("is false when the ledger is silent on this name", () => {
    expect(hasRecord(empty)).toBe(false);
  });

  it("is true when there is a setup card", () => {
    // The SetupCardView shape is opaque here — its presence is what matters.
    const withCard = { ...empty, setupCard: {} as SymbolRecord["setupCard"] };
    expect(hasRecord(withCard)).toBe(true);
  });

  it("is true when there is an open signal", () => {
    const withSignal: SymbolRecord = {
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
    };
    expect(hasRecord(withSignal)).toBe(true);
  });

  it("is true when there is resolved history — a lone miss counts, misses are not hidden", () => {
    expect(hasRecord({ ...empty, resolved: { hits: 0, misses: 1 } })).toBe(true);
    expect(hasRecord({ ...empty, resolved: { hits: 2, misses: 0 } })).toBe(true);
  });
});
