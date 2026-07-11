import type { BaseRateData } from "./baserate";
import { nRegime } from "./constants";

/**
 * lib/worked-example.ts — the fixed three-step worked-example template (plan §7 P5 step 4).
 *
 * A worked example turns one live setup into a teaching walk-through, always in the same three steps
 * so the reader learns the SHAPE of honest reasoning, not just this instance:
 *   1. What happened in the data — the concrete observation.
 *   2. What pattern this matches, and why it is believed to matter — with the evidence grade, so the
 *      belief and its support arrive together.
 *   3. What happened the last N times — including the failure count, never hidden. When the sample is
 *      too small (N < 30), the step says so honestly rather than dressing a dozen cases as a rate.
 *
 * Each step has a numbered marker (1–3) that a chart can place on the price path, so the annotation
 * and the prose stay in lock-step. Pure and view-model only — the numbers all arrive pre-computed.
 */

export type WorkedExampleStep = { n: number; title: string; body: string };
export type WorkedExampleMarker = { n: number; step: number; label: string };

export type WorkedExample = {
  symbol: string;
  patternLabel: string;
  steps: WorkedExampleStep[];
  markers: WorkedExampleMarker[];
  /** Times price was NOT higher at the horizon (N − wins). Kept even when suppressed, for callers. */
  failureCount: number;
  /** True when N < 30 — the outcome step is a suppression note, not a count. */
  suppressed: boolean;
};

export type WorkedExampleInput = {
  symbol: string;
  patternKey: string;
  patternLabel: string;
  cause: string;
  baseRate: BaseRateData;
};

/**
 * Why each pattern is BELIEVED to matter, paired with what the evidence actually says. Honest by
 * construction: the belief and its grade sit in one sentence so neither travels alone.
 */
const PATTERN_BELIEF: Record<string, string> = {
  "golden-cross":
    "The idea is that a rising 50-day average crossing above the 200-day marks a shift into an uptrend. The evidence grades this weak — the classic moving-average rules worked in-sample and did not survive honest out-of-sample testing net of costs.",
  "52w-high-proximity":
    "The idea is that new highs beget continuation. The evidence is mixed: a small in-sample effect that weakened after publication and failed in Japan — a context signal, not an edge.",
  "gap-with-catalyst":
    "The folklore is that gaps always fill. The one serious study finds momentum in the gap's direction, not reversal, so this is graded folklore — a claim to check, not a fact.",
  "rsi-extreme":
    "The idea is that an oscillator reaching an extreme marks exhaustion. The evidence is weak: no significant net profit at standard settings once costs are counted.",
  "unusual-volume":
    "The idea is that a volume surge marks informed activity. The evidence is mixed: some information, but concentrated in small names with the widest spreads — information, not a strategy.",
  "breadth-regime":
    "The idea is that broad participation confirms a move. It is context, not a trade: read the breadth cross alongside the base rate, never on its own.",
};

const GENERIC_BELIEF =
  "This pattern is one many traders watch. Read its belief against the evidence grade and the base rate below, rather than taking the name as a verdict.";

/** Build the three-step worked example for one live setup. */
export function buildWorkedExample(input: WorkedExampleInput): WorkedExample {
  const { symbol, patternLabel, cause, baseRate } = input;
  const failureCount = Math.max(0, baseRate.n - baseRate.wins);
  const suppressed = nRegime(baseRate.n) === "suppressed";

  const step1: WorkedExampleStep = {
    n: 1,
    title: "What happened in the data",
    body: `On ${symbol}, ${lowerFirst(cause)} That observation is the whole starting point — a fact from the price history, not a prediction.`,
  };

  const step2: WorkedExampleStep = {
    n: 2,
    title: "What pattern this matches, and why it is believed to matter",
    body: `This matches the "${patternLabel}" pattern. ${PATTERN_BELIEF[input.patternKey] ?? GENERIC_BELIEF}`,
  };

  const step3: WorkedExampleStep = {
    n: 3,
    title: `What happened the last ${baseRate.n} times`,
    body: suppressed
      ? `Only ${baseRate.n} past cases match — below the threshold where a frequency means anything. Insufficient history: treat this as an anecdote, not a statistic.`
      : outcomeBody(baseRate, failureCount),
  };

  const markers: WorkedExampleMarker[] = [
    { n: 1, step: 1, label: "The trigger bar" },
    { n: 2, step: 2, label: "The pattern completes" },
    { n: 3, step: 3, label: `${baseRate.horizonDays} trading days later` },
  ];

  return { symbol, patternLabel, steps: [step1, step2, step3], markers, failureCount, suppressed };
}

/** Step three's outcome sentence — wins AND failures, plus the always-up baseline for contrast. */
function outcomeBody(baseRate: BaseRateData, failureCount: number): string {
  const baselineClause =
    baseRate.baseline === null
      ? ""
      : ` Over the same ${baseRate.horizonDays} days, price rose anyway about ${Math.round(baseRate.baseline * 100)}% of the time — read the count against that baseline before calling it an edge.`;
  return `In the ${baseRate.n} matching cases, price was higher ${baseRate.horizonDays} trading days later ${baseRate.wins} times and was not higher the other ${failureCount} times. The failures are shown on purpose.${baselineClause}`;
}

/** Lowercase the first character of a sentence so it reads after a lead-in clause. */
function lowerFirst(text: string): string {
  return text.length > 0 ? text[0].toLowerCase() + text.slice(1) : text;
}
