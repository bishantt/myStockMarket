import { COOLING_OFF_MINUTES } from "./constants";
import { exceedsFrequencyMirror } from "./paper";

/**
 * lib/ledger.ts — the paper-ledger view-model (plan §7 P6 step 1–2).
 *
 * Pure shaping of the paper_trade rows into what the ledger and its friction surfaces show: realized
 * P&L per closed trade (directional — a short profits when price falls), the split of open vs closed,
 * the running total, and this week's round-trip count for the frequency mirror. The cooling-off check
 * lives here too, clock injected so it is testable. No database, no formatting — that stays at the edges.
 */

/** One paper_trade row, as the app reads it (mirrors the Prisma model's fields). */
export type PaperTradeRow = {
  id: string;
  symbol: string;
  side: string;
  bucket: string;
  quantity: number;
  referenceOpen: number;
  fillPrice: number;
  costBps: number;
  signalViewedAt: Date | null;
  openedAt: Date;
  status: string;
  exitFillPrice: number | null;
  closedAt: Date | null;
  realizedPnl: number | null;
  note: string | null;
};

/** Realized P&L for a closed trade, directional; null while the trade is still open. */
export function realizedPnl(trade: PaperTradeRow): number | null {
  if (trade.status !== "closed" || trade.exitFillPrice === null) return null;
  const perShare =
    trade.side === "sell"
      ? trade.fillPrice - trade.exitFillPrice // a short profits when the exit is lower
      : trade.exitFillPrice - trade.fillPrice;
  return perShare * trade.quantity;
}

/**
 * Unrealized P&L for an OPEN trade marked against a price (PD8, the ticker page's paper block).
 *
 * The directional mirror of `realizedPnl`: a long gains when the mark is above its fill, a short
 * when it is below. Null while the trade is closed (its P&L is realized, not marked) or when there
 * is no mark to measure against — a position with no last close is shown without a number, never
 * with a fabricated one.
 */
export function unrealizedPnl(trade: PaperTradeRow, mark: number | null): number | null {
  if (trade.status !== "open" || mark === null) return null;
  const perShare = trade.side === "sell" ? trade.fillPrice - mark : mark - trade.fillPrice;
  return perShare * trade.quantity;
}

/** True when a fired signal on this symbol was viewed less than the cooling-off window ago. */
export function needsCoolingOff(signalViewedAt: Date | null, now: Date): boolean {
  if (signalViewedAt === null) return false;
  const minutes = (now.getTime() - signalViewedAt.getTime()) / 60_000;
  return minutes >= 0 && minutes < COOLING_OFF_MINUTES;
}

export type LedgerView = {
  openTrades: PaperTradeRow[];
  closedTrades: PaperTradeRow[];
  totalRealizedPnl: number;
  roundTripsThisWeek: number;
  frequencyMirrorTriggered: boolean;
};

/** Build the ledger view: open/closed split, total realized P&L, and this week's round-trip count. */
export function buildLedgerView(trades: PaperTradeRow[], now: Date): LedgerView {
  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");

  const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + (realizedPnl(t) ?? 0), 0);

  const weekAgo = now.getTime() - 7 * 86_400_000;
  const roundTripsThisWeek = closedTrades.filter(
    (t) => t.closedAt !== null && t.closedAt.getTime() >= weekAgo,
  ).length;

  return {
    openTrades,
    closedTrades,
    totalRealizedPnl,
    roundTripsThisWeek,
    frequencyMirrorTriggered: exceedsFrequencyMirror(roundTripsThisWeek),
  };
}
