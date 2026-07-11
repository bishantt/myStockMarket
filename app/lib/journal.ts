/**
 * lib/journal.ts — the PM journal's fixed prompt and its pure validation (plan P3 step 4, §9.2).
 *
 * The evening journal is the accountability record the PM scorecard grades from P4 on. In P3 it is
 * a plain reflection: a fixed prompt and a written body. The forecast fields (a call, a probability,
 * a Brier score) fill in later — the schema already carries them. Validation lives here as a pure
 * function so the rule is testable without a database and speaks its own plain message.
 */

/** The question the evening journal poses. Mechanical, sentence case, no exclamation (plan §3.9). */
export const JOURNAL_PROMPT =
  "What did today's session teach you — and what will you do differently tomorrow?";

/** The most a journal entry may hold, so a runaway paste cannot bloat the row. */
export const JOURNAL_MAX = 4000;

/** The result of validating a journal body: the trimmed text, or a plain reason it was refused. */
export type JournalValidation =
  | { ok: true; value: { body: string } }
  | { ok: false; error: string };

/** Validate a journal body: it must be non-empty after trimming and within the length cap. */
export function validateJournal(body: unknown): JournalValidation {
  if (typeof body !== "string") return { ok: false, error: "Write a few words before saving." };
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: "Write a few words before saving." };
  if (trimmed.length > JOURNAL_MAX) {
    return { ok: false, error: `Keep it under ${JOURNAL_MAX} characters.` };
  }
  return { ok: true, value: { body: trimmed } };
}

export const FORECAST_MAX = 500;

/** A validated forecast: the call, its probability as a 0–1 fraction, and its resolution date. */
export type ForecastValidation =
  | { ok: true; value: { forecast: string; probability: number; resolvesOn: Date } }
  | { ok: false; error: string };

/**
 * Validate an optional forecast attached to a journal entry: a call, a probability (entered as a
 * percentage 1–99 and stored as a 0–1 fraction — 0 and 100 are not honest forecasts), and a future
 * resolution date. Pure, so the rule is tested without a database.
 */
export function validateForecast(
  forecast: unknown,
  probabilityPct: unknown,
  resolvesOn: unknown,
  today: Date,
): ForecastValidation {
  if (typeof forecast !== "string" || forecast.trim().length === 0) {
    return { ok: false, error: "Write the call you are forecasting." };
  }
  if (forecast.trim().length > FORECAST_MAX) {
    return { ok: false, error: `Keep the forecast under ${FORECAST_MAX} characters.` };
  }
  const pct = Number(probabilityPct);
  if (!Number.isFinite(pct) || pct < 1 || pct > 99) {
    return { ok: false, error: "Give a probability between 1 and 99 percent." };
  }
  if (typeof resolvesOn !== "string" || resolvesOn.length === 0) {
    return { ok: false, error: "Pick a date the forecast resolves." };
  }
  const date = new Date(resolvesOn);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "That resolution date is not valid." };
  if (date.getTime() <= today.getTime()) {
    return { ok: false, error: "The resolution date must be in the future." };
  }
  return { ok: true, value: { forecast: forecast.trim(), probability: pct / 100, resolvesOn: date } };
}
