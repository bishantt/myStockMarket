import { GLOSSARY } from "@/lib/glossary";

/**
 * lib/prose.ts — finding the glossary terms inside a paragraph of prose (PD5, plan §8.2.2).
 *
 * The Desk's brief and the news room's insight sections arrive from the pipeline as PLAIN STRINGS.
 * There is no markup in them and there must not be: the narrator writes sentences, not HTML, and
 * every phase of this build has kept it that way on purpose (an LLM that can emit markup is an LLM
 * that can emit a link). So if a term in that prose is to become a doorway, the APP has to find it.
 *
 * This module does the finding. It is pure, so it is unit-tested without a database or a renderer,
 * and it hands back a list of runs that `TermProse` turns into markup.
 *
 * ── THE BUDGET: AT MOST TWO PER PARAGRAPH, AND WHY A BUDGET AT ALL ───────────────────────────────
 *
 * An underline is a promise that something is behind it. A paragraph with seven dotted underlines
 * has made seven promises and communicated nothing — the reader's eye stops being drawn to the
 * doorway and starts being annoyed by the texture. The plan's number is two, and two is right:
 * enough that a beginner meeting "RVOL" and "base rate" in the same sentence can open both, few
 * enough that the underline still MEANS something.
 *
 * The budget is per PARAGRAPH. There is a second, older discipline stacked on top of it — first
 * occurrence per VIEW (lib/glossary's registry, enforced in components/Term.tsx) — and the two are
 * different rules doing different jobs:
 *
 *   · The BUDGET stops one paragraph from becoming a forest.
 *   · The REGISTRY stops the same word being underlined in five paragraphs down the page.
 *
 * They compose, and the composition is why a paragraph may legitimately render FEWER than two
 * doorways: the registry can veto a term this paragraph asked for, because an earlier paragraph
 * already spent it. That is correct. The budget is a ceiling, never a quota — nothing here goes
 * hunting for a second term to fill an empty slot.
 *
 * ── WHAT COUNTS AS A MATCH ───────────────────────────────────────────────────────────────────────
 *
 * A term matches on its display name, case-insensitively, at a word boundary. The boundary is
 * checked by hand rather than with `\b`, because half this glossary would break under `\b`: the
 * terms include "50-day average", "Bid–ask spread" (an EN DASH), "Advance/decline" and "BMO / AMC",
 * and `\b` has opinions about digits, dashes and slashes that do not survive contact with any of
 * them. The rule enforced here is the one a reader would state: a term matches when the characters
 * either side of it are not letters or digits — so "RVOL" matches in "the RVOL was high" and in
 * "(RVOL)", and does NOT match inside "RVOLATILITY".
 */

/** One run of a paragraph: plain text, or a word the glossary can define. */
export type TermRun =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "term"; readonly key: string; readonly text: string };

/** The plan's number (§8.2.2). A ceiling, not a quota. */
export const TERMS_PER_PARAGRAPH = 2;

/** Is the character at `index` part of a word? Anything outside a term's edges must NOT be. */
function isWordChar(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  return /[a-z0-9]/i.test(text[index]);
}

/**
 * Every WORDING of every glossary term — its display title and its aliases — longest first.
 *
 * TWO THINGS ARE HAPPENING HERE, AND BOTH WERE LEARNED BY LOOKING AT THE PAGE.
 *
 * 1. ALIASES, because prose is not written in titles. The glossary's display term is "RVOL"; the
 *    narrator writes "relative volume", because that is what a person would say. On PD5's first run
 *    the seeded brief's lede read "…on relative volume of 4.7×" and this matcher, knowing only the
 *    title, walked straight past it and decorated nothing. A matcher over NARRATED prose has to
 *    match the words the narrator actually uses, or it is decoration pretending to be a feature.
 *
 * 2. LONGEST FIRST, which stops a short wording from eating a long one: "gap" must not win inside
 *    "gaps", and "average" must never claim the tail of "50-day average" and hand the reader a
 *    doorway to a vaguer definition than the one the sentence is about.
 *
 * Computed once at module load — the glossary is a frozen seed, not a query.
 */
const TERMS_BY_LENGTH: ReadonlyArray<{ key: string; term: string }> = Object.entries(GLOSSARY)
  .flatMap(([key, entry]) =>
    [entry.term, ...(entry.aliases ?? [])].map((term) => ({ key, term })),
  )
  .sort((a, b) => b.term.length - a.term.length);

/**
 * Split a paragraph into runs, decorating at most `budget` DISTINCT terms — each at its first
 * occurrence, in the order they appear in the sentence.
 *
 * The prose is never altered: concatenating every run's `text` returns the input exactly. A
 * renderer that dropped a run would be rewriting the narrator's sentence, and the one thing this
 * app may never do to a verified sentence is edit it.
 */
export function splitTerms(
  text: string,
  budget: number = TERMS_PER_PARAGRAPH,
  /**
   * Glossary keys this paragraph may NOT open — the Academy's "reading-room restraint" (PD6).
   *
   * A lesson ABOUT relative volume must not underline "relative volume" in its own prose and offer
   * the reader a popover whose footer says "read the lesson: Volume and RVOL". They are reading it.
   * A doorway back into the room you are standing in is not a doorway, it is furniture in the way.
   *
   * So the lesson page excludes every glossary entry whose `lesson` IS this lesson, and the terms it
   * borrows from elsewhere in the glossary — the ones a reader genuinely might not know — still open.
   */
  exclude: ReadonlySet<string> = new Set(),
): TermRun[] {
  if (text.length === 0 || budget <= 0) return [{ kind: "text", text }];

  const lower = text.toLowerCase();

  // Find the first occurrence of every term, then keep the earliest `budget` of them. Sorting by
  // POSITION (not by the glossary's seed order) is what makes the decoration follow the reader's
  // eye: the first two definable words in the sentence are the two that open.
  const hits: Array<{ key: string; at: number; length: number }> = [];

  for (const { key, term } of TERMS_BY_LENGTH) {
    if (exclude.has(key)) continue;

    const at = lower.indexOf(term.toLowerCase());
    if (at < 0) continue;
    if (isWordChar(text, at - 1) || isWordChar(text, at + term.length)) continue;

    // Skip a wording that sits inside one already claimed — "gap" within "gaps", "average" within
    // "50-day average". Longest-first ordering is what makes this the right way round.
    const overlaps = hits.some((hit) => at < hit.at + hit.length && hit.at < at + term.length);
    if (overlaps) continue;

    // ONE DOORWAY PER CONCEPT, not per wording. A paragraph that says "RVOL" and then "relative
    // volume" is talking about ONE thing twice, and it gets ONE underline — otherwise a single
    // concept would eat the whole per-paragraph budget by being written two different ways, and the
    // registry would render the second one plain anyway. Earliest occurrence wins.
    const claimed = hits.find((hit) => hit.key === key);
    if (claimed) {
      if (at < claimed.at) {
        claimed.at = at;
        claimed.length = term.length;
      }
      continue;
    }

    hits.push({ key, at, length: term.length });
  }

  const chosen = hits.sort((a, b) => a.at - b.at).slice(0, budget);
  if (chosen.length === 0) return [{ kind: "text", text }];

  const runs: TermRun[] = [];
  let cursor = 0;

  for (const hit of chosen) {
    if (hit.at > cursor) runs.push({ kind: "text", text: text.slice(cursor, hit.at) });
    // The term's text is taken from the PROSE, not from the glossary, so the narrator's own casing
    // survives: "Breadth was narrow" keeps its capital B, and a mid-sentence "breadth" keeps its
    // lowercase one. The glossary supplies the definition; the writer supplies the sentence.
    runs.push({ kind: "term", key: hit.key, text: text.slice(hit.at, hit.at + hit.length) });
    cursor = hit.at + hit.length;
  }

  if (cursor < text.length) runs.push({ kind: "text", text: text.slice(cursor) });
  return runs;
}
