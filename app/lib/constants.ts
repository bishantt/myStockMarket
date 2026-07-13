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

/**
 * Paper-fill constants (Appendix F — "Paper fills"). A paper order fills at the next-session open,
 * moved against the trader by half the per-bucket at-open spread plus a fixed slippage. These mirror
 * pipeline/config.py; both cite the plan, and changing either is a structural decision.
 * Values are basis points (1bp = 0.01%). The at-open spread is wider than mid-session on purpose —
 * the open is the ritual's realistic fill window (RR §6.3).
 */
export const SPREAD_BP_LARGE_MID = 20;
export const SPREAD_BP_SMALL = 60;
export const SLIPPAGE_BP = 5;

/** Cooling-off + frequency-mirror thresholds (Appendix F — "Cooling-off window"). */
export const COOLING_OFF_MINUTES = 30;
export const FREQUENCY_MIRROR_WEEKLY_ROUND_TRIPS = 5;

/** The size-suggestion cap: never above half of the Kelly fraction (Appendix F, §8.1). */
export const KELLY_FRACTION_CAP = 0.5;

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * The control room (N6, plan 8.4) — what the user may fire by hand, and how often.
 * ──────────────────────────────────────────────────────────────────────────────────────────── */

/** The five things the reader can run. `briefing` is Job B; the rest are Job A's modes. */
export const RUN_ACTIONS = ["full", "news", "macro", "compute", "briefing"] as const;
export type RunAction = (typeof RUN_ACTIONS)[number];

/**
 * The daily cap on each action, and the cooldown between two runs of it.
 *
 * These are not arbitrary round numbers — each one is bounded by something real:
 *
 * · `news` 2/day, because of PROVIDER ARITHMETIC. One news run spends ~20 of Marketaux's 100 daily
 *   requests. The nightly already spends ~20, so nightly + 2 manual runs ≈ 60 in any 24h window,
 *   which leaves real headroom rather than an assumed one. A third button press could put a normal
 *   Tuesday inside touching distance of the ceiling, and a provider that runs out mid-run degrades
 *   the front page for the rest of the day.
 *
 * · `news` also spends LLM budget (up to 60 Haiku extracts + 1 Sonnet call), which is why it is the
 *   only action whose cost is PRINTED on its own button. See NEWS_RUN_COST_USD.
 *
 * · `macro` 6/day with a 30-minute cooldown, because it is nearly free (four small HTTP reads, no
 *   model, no market) and its sources genuinely move during the day. The cooldown exists because
 *   nothing it reads changes faster than that, so a second press inside 30 minutes would refetch
 *   identical numbers — the honest control for that is the explanation, not the button (plan 8.1).
 *
 * · `full` 1/day, because on a normal weeknight it recomputes identical data. It exists for the
 *   recovery case: the nightly failed or never ran.
 *
 * · `compute` 2/day and `briefing` 2/day — both cheap, both idempotent, both for the "I fixed
 *   something, run it again" case.
 */
export const RUN_CAPS: Record<RunAction, { perDay: number; cooldownMinutes: number }> = {
  full: { perDay: 1, cooldownMinutes: 0 },
  news: { perDay: 2, cooldownMinutes: 0 },
  macro: { perDay: 6, cooldownMinutes: 30 },
  compute: { perDay: 2, cooldownMinutes: 0 },
  briefing: { perDay: 2, cooldownMinutes: 0 },
};

/** Which workflow file each action dispatches. */
export const RUN_WORKFLOW: Record<RunAction, string> = {
  full: "nightly-a.yml",
  news: "nightly-a.yml",
  macro: "nightly-a.yml",
  compute: "nightly-a.yml",
  briefing: "nightly-b.yml",
};

/**
 * What one `news` run costs in API budget, printed on the button (plan 8.4: "the panel prints it so
 * the cost is a stated fact, not a hidden one").
 *
 * MEASURED, not estimated. From the live news-mode run recorded in docs/nc-evidence/n5-frontpage.md:
 * 59 Haiku extraction calls and 1 Sonnet narration call. At the published prices for those models,
 * with the article-sized prompts this pipeline actually sends, that run costs a few cents. The
 * figure below is rounded UP to the nearest five cents, because a cost line that under-promises is
 * the only kind worth printing.
 */
export const NEWS_RUN_COST_USD = 0.15;

/**
 * How long the panel will wait for a dispatched run to become findable before it says so.
 *
 * THIS EXISTS BECAUSE THE DISPATCH API TELLS US NOTHING. It answers 204 with an empty body — no run
 * id (recorded 2026-07-13; the plan and GitHub's own docs both say otherwise and are both wrong). So
 * the app dispatches, then hunts for its run by matching the request id in the run's name, and there
 * is a real gap of a second or two before GitHub has created the run at all.
 *
 * That gap is normal. What is NOT normal is the gap never closing — and if the panel simply showed
 * "requested…" forever, then a run that fired and a run that never fired would look exactly the
 * same from the couch. After this many seconds the panel stops guessing and says the run could not
 * be found, with a link to the Actions tab. An unfindable run is a fact, and it gets said out loud.
 */
export const RUN_LOOKUP_TIMEOUT_SECONDS = 90;

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
