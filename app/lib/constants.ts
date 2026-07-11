/**
 * lib/constants.ts — the quant display constants and the tier logic (plan Appendix F, P4).
 *
 * These mirror the pipeline's Appendix F constants; both sides reference the plan as the source of
 * truth, and both are tested against it. The app never computes a base rate — but it does decide how
 * to LABEL one (the tendency tier and the N-gate), and that logic lives here, in one place, so a
 * scan row, a calendar branch, and a setup card all tier a rate identically.
 */

/** The tendency-tier win-rate bands (Appendix F): < 58% weak, 58–70% moderate, > 70% strong. */
export const TIER_WEAK_MAX = 0.58;
export const TIER_MODERATE_MAX = 0.7;

/** The always-up baseline band the RR cites (~53–55%); shown on every card and used by the cap. */
export const ALWAYS_UP_BASELINE = 0.54;

/** The N-gate thresholds (Appendix F / RR Part 8): ≥ 100 → % + CI; 30–99 → "X in 10" + wide-interval
 * note; < 30 → suppressed. */
export const N_FULL = 100;
export const N_SUPPRESS = 30;

export type Tier = "weak" | "moderate" | "strong";

/**
 * The tendency tier for a base rate, with the CI-spans-baseline cap (Appendix F, §1.5 rule 3).
 *
 * If the confidence interval straddles the always-up baseline, the rate cannot be told apart from
 * simply being long, so the tier is capped at weak no matter how high the point estimate — the RR
 * Fig 9.3 rule. Otherwise the win-rate bands apply. `baseline` defaults to the always-up figure.
 */
export function tierFor(
  winRate: number,
  ciLow: number,
  ciHigh: number,
  baseline: number = ALWAYS_UP_BASELINE,
): Tier {
  if (ciLow <= baseline && baseline <= ciHigh) return "weak";
  if (winRate < TIER_WEAK_MAX) return "weak";
  if (winRate <= TIER_MODERATE_MAX) return "moderate";
  return "strong";
}

/** Which N-gate regime a sample falls in — the display precision depends on it (Appendix F). */
export type NRegime = "full" | "frequency" | "suppressed";

export function nRegime(n: number): NRegime {
  if (n >= N_FULL) return "full";
  if (n >= N_SUPPRESS) return "frequency";
  return "suppressed";
}
