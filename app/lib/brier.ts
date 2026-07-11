/**
 * lib/brier.ts — forecast scoring and calibration (plan §7 P6 step 3–4).
 *
 * A forecast is a stated probability with a yes/no outcome once it resolves. The Brier score measures
 * how good those probabilities were — lower is better, and 0.25 is a coin flip (copy.brier.anchor).
 * Calibration groups forecasts into probability buckets and asks the honest question: of the things
 * called ~70% likely, did about 70% actually happen? All pure, so the arithmetic is unit-tested and
 * the same numbers score the app's own flags and the user's forecasts (the track record grades both).
 */

/** A resolved forecast: the probability stated, and whether it happened (1) or not (0). */
export type ResolvedForecast = { probability: number; outcome: 0 | 1 };

/** The Brier score for one forecast: (probability − outcome)². */
export function brierScore(probability: number, outcome: 0 | 1): number {
  const diff = probability - outcome;
  return diff * diff;
}

/** The mean Brier score across resolved forecasts, or null when there are none. */
export function rollingBrier(forecasts: ResolvedForecast[]): number | null {
  if (forecasts.length === 0) return null;
  const total = forecasts.reduce((sum, f) => sum + brierScore(f.probability, f.outcome), 0);
  return total / forecasts.length;
}

/** One calibration bucket: a probability decile with the mean predicted rate and the actual rate. */
export type CalibrationBucket = {
  /** The lower edge of the decile (0, 0.1, … 0.9). */
  lower: number;
  n: number;
  predictedMean: number;
  actual: number;
};

/**
 * Group resolved forecasts into probability deciles and report, per non-empty decile, the mean
 * predicted probability, the actual hit rate, and N. Empty deciles are omitted so a scatter shows
 * only measured points (and a bucket's N gates how much weight it deserves).
 */
export function calibrationBuckets(forecasts: ResolvedForecast[]): CalibrationBucket[] {
  const byDecile = new Map<number, ResolvedForecast[]>();
  for (const forecast of forecasts) {
    // 1.0 folds into the top (0.9) decile so a certain forecast still lands somewhere.
    const decile = Math.min(0.9, Math.floor(forecast.probability * 10) / 10);
    const list = byDecile.get(decile) ?? [];
    list.push(forecast);
    byDecile.set(decile, list);
  }

  return [...byDecile.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lower, list]) => ({
      lower,
      n: list.length,
      predictedMean: list.reduce((s, f) => s + f.probability, 0) / list.length,
      actual: list.reduce((s, f) => s + f.outcome, 0) / list.length,
    }));
}
