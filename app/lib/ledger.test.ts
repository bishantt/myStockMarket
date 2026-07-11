import { describe, expect, it } from "vitest";

import { buildLedgerView, needsCoolingOff, realizedPnl, type PaperTradeRow } from "./ledger";

/**
 * lib/ledger.test.ts — the paper-ledger view-model (plan §7 P6 step 1–2).
 *
 * Realized P&L is directional (a short profits when price falls), the cooling-off check fires inside
 * the 30-minute window, and the weekly frequency mirror counts this week's round trips.
 */

const NOW = new Date("2026-07-11T15:00:00Z");
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const trade = (over: Partial<PaperTradeRow> = {}): PaperTradeRow => ({
  id: "t1",
  symbol: "DEMO",
  side: "buy",
  bucket: "large-mid",
  quantity: 10,
  referenceOpen: 100,
  fillPrice: 100.15,
  costBps: 15,
  signalViewedAt: null,
  openedAt: daysAgo(2),
  status: "open",
  exitFillPrice: null,
  closedAt: null,
  realizedPnl: null,
  note: null,
  ...over,
});

describe("realizedPnl", () => {
  it("is positive for a long that rose", () => {
    const t = trade({ side: "buy", fillPrice: 100, exitFillPrice: 110, quantity: 10, status: "closed" });
    expect(realizedPnl(t)).toBeCloseTo(100, 6); // (110-100)*10
  });

  it("is positive for a short that fell (directional)", () => {
    const t = trade({ side: "sell", fillPrice: 100, exitFillPrice: 90, quantity: 10, status: "closed" });
    expect(realizedPnl(t)).toBeCloseTo(100, 6); // (100-90)*10
  });

  it("is null while the trade is still open", () => {
    expect(realizedPnl(trade({ status: "open", exitFillPrice: null }))).toBeNull();
  });
});

describe("needsCoolingOff", () => {
  it("fires when the signal was viewed under 30 minutes ago", () => {
    expect(needsCoolingOff(minsAgo(10), NOW)).toBe(true);
    expect(needsCoolingOff(minsAgo(29), NOW)).toBe(true);
  });

  it("does not fire at or beyond 30 minutes, or with no signal", () => {
    expect(needsCoolingOff(minsAgo(30), NOW)).toBe(false);
    expect(needsCoolingOff(minsAgo(120), NOW)).toBe(false);
    expect(needsCoolingOff(null, NOW)).toBe(false);
  });
});

describe("buildLedgerView", () => {
  it("splits open and closed, totals realized P&L, and counts this week's round trips", () => {
    const trades = [
      trade({ id: "a", status: "open" }),
      trade({ id: "b", status: "closed", side: "buy", fillPrice: 100, exitFillPrice: 105, quantity: 10, closedAt: daysAgo(1) }),
      trade({ id: "c", status: "closed", side: "buy", fillPrice: 100, exitFillPrice: 98, quantity: 10, closedAt: daysAgo(3) }),
      trade({ id: "d", status: "closed", side: "buy", fillPrice: 100, exitFillPrice: 101, quantity: 5, closedAt: daysAgo(10) }),
    ];
    const view = buildLedgerView(trades, NOW);
    expect(view.openTrades).toHaveLength(1);
    expect(view.closedTrades).toHaveLength(3);
    // realized: +50 (b) −20 (c) +5 (d) = +35
    expect(view.totalRealizedPnl).toBeCloseTo(35, 6);
    // round trips this week (≤7 days): b and c only
    expect(view.roundTripsThisWeek).toBe(2);
    expect(view.frequencyMirrorTriggered).toBe(false);
  });

  it("triggers the frequency mirror above five round trips this week", () => {
    const trades = Array.from({ length: 6 }, (_, i) =>
      trade({ id: `c${i}`, status: "closed", exitFillPrice: 101, closedAt: daysAgo(1) }),
    );
    const view = buildLedgerView(trades, NOW);
    expect(view.roundTripsThisWeek).toBe(6);
    expect(view.frequencyMirrorTriggered).toBe(true);
  });
});
