import {
  FREQUENCY_MIRROR_WEEKLY_ROUND_TRIPS,
  KELLY_FRACTION_CAP,
  SLIPPAGE_BP,
  SPREAD_BP_LARGE_MID,
  SPREAD_BP_SMALL,
} from "./constants";

/**
 * lib/paper.ts — the paper-desk arithmetic (plan §7 P6, Appendix F §8.1).
 *
 * The paper desk exists to make the certain costs of trading visible before the uncertain gains. So
 * every number here is a cost or a cap, spelled out so the UI can show the arithmetic:
 *   - simulateFill: the honest fill — next-session open moved against the trader by half the at-open
 *     spread plus slippage. No mid-price fantasy.
 *   - halfKellyFraction: a size SUGGESTION capped at half of Kelly, computed from the CI-lower-bound
 *     win rate — a teaching device, never a conviction dial, and it is zero whenever the edge is not
 *     positive.
 *   - costMirrorDrag: projected annual drag = effective spread × the user's own turnover.
 * All pure, so the acceptance arithmetic is unit-tested without a database.
 */

export type TradeSide = "buy" | "sell";
export type Bucket = "large-mid" | "small";

export type FillResult = {
  fillPrice: number;
  /** How far the fill moved against the trader, in basis points (half-spread + slippage). */
  costBps: number;
  spreadBps: number;
  slippageBps: number;
};

/** The at-open spread for a bucket (Appendix F): large/mid 20bp, small 60bp. */
function spreadBpsFor(bucket: Bucket): number {
  return bucket === "small" ? SPREAD_BP_SMALL : SPREAD_BP_LARGE_MID;
}

/**
 * Simulate a paper fill: the next-session open moved against the trader by half the bucket's at-open
 * spread plus a fixed slippage. A buy fills above the open, a sell below it — the cost is always real.
 */
export function simulateFill({
  side,
  nextOpen,
  bucket,
}: {
  side: TradeSide;
  nextOpen: number;
  bucket: Bucket;
}): FillResult {
  const spreadBps = spreadBpsFor(bucket);
  const costBps = spreadBps / 2 + SLIPPAGE_BP;
  const direction = side === "buy" ? 1 : -1;
  const fillPrice = nextOpen * (1 + (direction * costBps) / 10_000);
  return { fillPrice, costBps, spreadBps, slippageBps: SLIPPAGE_BP };
}

/**
 * Half of the Kelly fraction for a bet with win probability `winProb` (use the CI lower bound) and
 * payoff ratio `payoffRatio` (average win ÷ average loss). Zero when the edge is not positive, and
 * capped so the suggestion never exceeds half-Kelly (Appendix F, §8.1).
 */
export function halfKellyFraction(winProb: number, payoffRatio: number): number {
  if (payoffRatio <= 0) return 0;
  const kelly = winProb - (1 - winProb) / payoffRatio;
  if (kelly <= 0) return 0;
  return Math.min(kelly * KELLY_FRACTION_CAP, KELLY_FRACTION_CAP);
}

/** The cost mirror: projected annual drag = effective spread × turnover (round trips per year). */
export function costMirrorDrag({
  roundTripsPerYear,
  effectiveSpreadBps,
}: {
  roundTripsPerYear: number;
  effectiveSpreadBps: number;
}): { annualDragBps: number; annualDragFraction: number } {
  const annualDragBps = roundTripsPerYear * effectiveSpreadBps;
  return { annualDragBps, annualDragFraction: annualDragBps / 10_000 };
}

/** True when the week's paper round trips exceed the frequency-mirror threshold (Appendix F). */
export function exceedsFrequencyMirror(roundTripsThisWeek: number): boolean {
  return roundTripsThisWeek > FREQUENCY_MIRROR_WEEKLY_ROUND_TRIPS;
}
