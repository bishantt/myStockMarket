import { cache } from "react";

import { createGlossaryRegistry, lookupTerm } from "@/lib/glossary";
import { splitTerms, TERMS_PER_PARAGRAPH } from "@/lib/prose";
import { GlossaryPopover } from "./GlossaryPopover";

/**
 * Term — the glossary doorway (PD5, plan §8.2.2). It SUPERSEDES components/GlossaryTerm.tsx, which
 * is deleted: two components decorating the same word with the same underline would be two doors to
 * one room, and this codebase does not keep those.
 *
 * A term is set as inline text with a dotted underline, in INK — not accent. That is the whole
 * design decision in this file, and it is a claim about what the underline MEANS:
 *
 *     Accent is the colour of "do something" (E6 — colour means interactivity, and nothing else).
 *     A definition is not a call to act. It is a word that has more behind it if you want it, and
 *     nothing at all if you don't.
 *
 * So the doorway is quiet: ink text, a dotted rule under it, and a popover on tap. It never pulls
 * the eye away from the sentence it belongs to — an underline that competed with the prose would be
 * emphasis for its own sake, which is precisely what E5 forbids.
 *
 * ── TWO DISCIPLINES, STACKED ─────────────────────────────────────────────────────────────────────
 *
 * 1. FIRST OCCURRENCE PER VIEW (the registry, unchanged since P5). The same term mentioned five
 *    times on the Desk is dotted ONCE. React `cache` scopes one registry to each server render, so
 *    the discipline holds across every component in the tree without anything being threaded
 *    through props. A later repeat renders as plain text — the word still reads, it simply carries
 *    no second doorway.
 *
 * 2. AT MOST TWO PER PARAGRAPH (the budget, new in PD5 — `TermProse` below). An underline forest is
 *    noise. lib/prose.ts holds the reasoning and the matcher.
 *
 * These are server components: the registry decision happens during render, and the only thing that
 * crosses to the client is the small popover island — which matters, because /news sits ~4 KB under
 * a hard 200 KB first-load budget and a client-side glossary would have spent it.
 */

// One glossary registry per request. cache() memoises the call for the lifetime of a single render.
const requestRegistry = cache(() => createGlossaryRegistry());

/**
 * One term, named explicitly by the caller.
 *
 * Used where the app's OWN copy names a concept it wants to define — a scan's criteria line, the
 * macro pulse's labels. An unknown key (or a later repeat in this view) renders as plain text.
 */
export function Term({ term, children }: { term: string; children?: React.ReactNode }) {
  const entry = lookupTerm(term);
  const label = children ?? entry?.term ?? term;

  // Unknown term, or not its first appearance this view → plain text, no doorway.
  if (!entry || !requestRegistry().firstOccurrence(term)) {
    return <>{label}</>;
  }

  return (
    <GlossaryPopover entry={entry} termKey={term}>
      {label}
    </GlossaryPopover>
  );
}

/**
 * A paragraph of NARRATED prose, with its glossary terms found and opened automatically.
 *
 * This is the half that is new in PD5, and it exists because the brief and the news insights arrive
 * as plain strings from the pipeline — nobody hand-marks a term in a sentence an LLM wrote last
 * night. The matcher finds at most two per paragraph (lib/prose.ts); the registry may then veto one
 * that an earlier paragraph already spent, which is correct and is why a paragraph can honestly
 * render fewer than two.
 *
 * THE SENTENCE IS NEVER EDITED. The runs concatenate back to the exact input string — the narrator's
 * words, its casing, its punctuation. Decorating a verified sentence is allowed; rewriting one is
 * not, and a renderer that dropped a run would be doing the second while looking like the first.
 */
export function TermProse({
  text,
  budget = TERMS_PER_PARAGRAPH,
}: {
  text: string;
  /** The per-paragraph ceiling. A ceiling, never a quota — see lib/prose.ts. */
  budget?: number;
}) {
  const runs = splitTerms(text, budget);

  return (
    <>
      {runs.map((run, index) =>
        run.kind === "term" ? (
          <Term key={index} term={run.key}>
            {run.text}
          </Term>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}
