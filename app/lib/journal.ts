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
