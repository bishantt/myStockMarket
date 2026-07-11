/**
 * watchlist.ts — the pure rules for the focus watchlist (plan §9.2, Appendix B).
 *
 * Two disciplines the product cares about live here, apart from any database:
 *
 *  1. A reason is required per name. The app makes the user articulate WHY they are watching
 *     something before it will hold it — the antidote to a sprawling, emotional list (Research
 *     Report §9.2). validateAdd refuses a blank reason.
 *
 *  2. The focus list is capped at three. Professionals cap attention deliberately; an unbounded
 *     focus list is just noise. canSetFocus is the gate, enforced in the write path so the rule
 *     carries its own explanatory message rather than surfacing as a raw database error.
 *
 * These are pure functions so the rules are unit-tested without a database; the server actions in
 * settings/actions.ts apply them and do the persistence.
 */

/** The most names that may be marked "focus" at once (plan Appendix B: "focus cap enforced in UI (3)"). */
export const FOCUS_CAP = 3;

/** The longest a written reason may be — long enough for a real sentence, short enough to stay a note. */
export const MAX_REASON_LENGTH = 280;

// A ticker: a leading letter, then up to nine letters/digits/dot/dash (BRK.B, RDS-A). Upper-cased
// before the test. Deliberately permissive on punctuation, strict on shape.
const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.\-]{0,9}$/;

export type AddInput = { symbol: string; reason: string };
export type ValidatedAdd = { symbol: string; reason: string };
export type ValidationError = { field: "symbol" | "reason"; message: string };
export type AddValidation = { ok: true; value: ValidatedAdd } | { ok: false; error: ValidationError };

/** Trim and upper-case a symbol so "  aapl " and "AAPL" are the same name. */
export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Validate an add request: a well-formed ticker and a non-empty, not-too-long written reason.
 * Returns the cleaned values on success, or the first offending field and a plain-English message.
 */
export function validateAdd(input: AddInput): AddValidation {
  const symbol = normalizeSymbol(input.symbol ?? "");
  if (!SYMBOL_PATTERN.test(symbol)) {
    return { ok: false, error: { field: "symbol", message: "Enter a valid ticker symbol." } };
  }

  const reason = (input.reason ?? "").trim();
  if (reason.length === 0) {
    return { ok: false, error: { field: "reason", message: "Write why you are watching it — a reason is required." } };
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return {
      ok: false,
      error: { field: "reason", message: `Keep the reason under ${MAX_REASON_LENGTH} characters.` },
    };
  }

  return { ok: true, value: { symbol, reason } };
}

/**
 * Whether a name may take the given focus state, given how many names are focus now and whether
 * this one already is. Turning focus off is always allowed; turning it on is allowed only while
 * the count is under the cap (a name already focus does not add to the count).
 */
export function canSetFocus(currentFocusCount: number, isCurrentlyFocus: boolean, next: boolean): boolean {
  if (!next) return true;
  if (isCurrentlyFocus) return true;
  return currentFocusCount < FOCUS_CAP;
}
