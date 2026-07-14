/**
 * lib/verified.ts — E5 in code: emphasis is EARNED by verification (PD5, plan §8.2.3, ruling E5).
 *
 * The app is allowed to make a number stand out in prose — mono, at a weight the type system
 * actually loads — and that emphasis is itself a CLAIM. It says: *this figure was checked against
 * its source by the deterministic gate.* Applying it to anything that merely looks like a number
 * would have the app vouching for figures it never saw, which is the exact failure the whole
 * honesty ledger exists to prevent (§1.5 rule 10: the LLM narrates, it never computes; the gate
 * blocks what it cannot verify).
 *
 * ── WHY THIS IS A TYPE AND NOT A STRING ──────────────────────────────────────────────────────────
 *
 * E5's guard is written as "the KeyFigure renderer takes verified ids, not raw strings — misuse is
 * a type error FIRST and a unit test second". So a `VerifiedFigure` cannot be typed into existence.
 * There is exactly one way to mint one — `splitVerified`, which checks each candidate against an
 * allow-list the GATE produced — and `KeyFigure` accepts nothing else. A developer who wants to
 * emphasize an arbitrary string has to reach past the compiler to do it, and if they do, KeyFigure
 * throws in development (see the component).
 *
 * ── AN ALLOW-LIST, NEVER A DENY-LIST, AND THIS IS THE LOAD-BEARING DECISION ──────────────────────
 *
 * The allow-list is the SOURCE OF TRUTH about what was verified, and it comes from the pipeline —
 * for a news cluster it is `key_numbers`, the figures the gate cleared against the extraction.
 *
 * The tempting shortcut is to invert it: emphasize every number-shaped token EXCEPT the ones the
 * gate flagged. It is wrong, and it is wrong in a way that would never show up in a test. Inverting
 * it requires the APP to decide what counts as a number — its own regex, its own idea of whether
 * "Q3" or "2.1x" or "4th" is a figure. The pipeline's gate already answers that question
 * (`briefing/verify.py`), and its own header says what a second answer would cost:
 *
 *     "Two definitions of that would be one too many: the day they drifted apart, one of the two
 *      surfaces would start publishing numbers the other would have refused, and nobody would find
 *      out from a test."
 *
 * A deny-list makes the app the second definition. So the app never decides what a number is. It is
 * handed a list of figures that PASSED and it emphasizes exactly those, verbatim. Anything else in
 * the sentence is plain text — which is not a failure state, it is the honest default: unemphasized
 * prose claims nothing.
 */

/**
 * A figure that traced back to a source the deterministic gate accepted.
 *
 * `verified: true` is a literal, not a boolean — there is no such thing as a `VerifiedFigure` with
 * `verified: false`, because that is just a string. The only mint is `splitVerified`.
 */
export type VerifiedFigure = {
  readonly value: string;
  readonly verified: true;
};

/** One run of prose: plain text, or a figure the gate cleared. */
export type ProseRun =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "figure"; readonly figure: VerifiedFigure };

/**
 * Split prose at its verified figures.
 *
 * Every occurrence of an allow-listed value becomes a `figure` run; everything between them is
 * `text`. Matching is VERBATIM — the gate cleared the string "18.4%", so "18.4%" is what gets
 * emphasized, and a merely similar "18.5%" in the same sentence does not.
 *
 * Longest candidates are tried first, so "18.4%" wins over a bare "18" that is also on the list —
 * otherwise a short allow-listed number could eat the prefix of a long one and emphasize half a
 * figure, which is worse than emphasizing none of it.
 *
 * An empty allow-list yields one plain run: nothing was verified, so nothing is emphasized.
 */
export function splitVerified(text: string, allowed: readonly string[]): ProseRun[] {
  const values = allowed.map((value) => value.trim()).filter((value) => value.length > 0);
  if (values.length === 0 || text.length === 0) {
    return [{ kind: "text", text }];
  }

  // Longest first, so "18.4%" wins over a bare "18" that is also a key number.
  const ordered = [...values].sort((a, b) => b.length - a.length);
  const runs: ProseRun[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    // The earliest hit from here; ties broken toward the longer value, for the same reason.
    const hit = ordered
      .map((value) => ({ value, at: text.indexOf(value, cursor) }))
      .filter((candidate) => candidate.at >= 0)
      .sort((a, b) => a.at - b.at || b.value.length - a.value.length)[0];

    if (!hit) break;

    if (hit.at > cursor) runs.push({ kind: "text", text: text.slice(cursor, hit.at) });
    runs.push({ kind: "figure", figure: { value: hit.value, verified: true } });
    cursor = hit.at + hit.value.length;
  }

  if (cursor < text.length) runs.push({ kind: "text", text: text.slice(cursor) });
  return runs.length > 0 ? runs : [{ kind: "text", text }];
}
