import { Fragment } from "react";

import { KeyFigure } from "@/components/KeyFigure";
import { Term } from "@/components/Term";
import { splitVerified } from "@/lib/verified";
import { splitTerms, TERMS_PER_PARAGRAPH } from "@/lib/prose";

/**
 * StoryContext — the v2 insight's context prose, with BOTH honesty treatments (PD8, plan 9.6 block 5).
 *
 * Two rules apply to this one paragraph and they COMPOSE here:
 *   · Its verified numbers are set in mono (E5) — a figure is emphasized IF AND ONLY IF the gate
 *     cleared it, so the allow-list is the context section's own `cleared` list and nothing else.
 *   · Its glossary terms open a doorway (≤2 per paragraph) — the same discipline the brief keeps.
 *
 * They compose in that ORDER: `splitVerified` cuts the prose at its cleared figures first, and then
 * the glossary matcher runs only over the PLAIN text between figures. A figure is a number, never a
 * word, so no term can sit inside one — and the term budget is spent ACROSS the whole paragraph
 * (decremented run to run), not reset at every figure, so a sentence broken by three figures still
 * opens at most two doorways. That is the exact rule `TermProse` keeps; this is the same rule with
 * verified figures interleaved.
 *
 * A server component: `Term` reads the per-view glossary registry, which only memoises on the server.
 */
export function StoryContext({ text, cleared }: { text: string; cleared: readonly string[] }) {
  // A plain loop that accumulates into a local array, not a `.map` closing over a counter: React's
  // compiler rejects reassigning an outer variable after render (and is right to — it can run after
  // the render that created it). Nothing here escapes this call. Same shape as Term.tsx's `decorate`.
  const out: React.ReactNode[] = [];
  let termBudget = TERMS_PER_PARAGRAPH; // one glossary budget for the whole paragraph

  for (const [runIndex, run] of splitVerified(text, cleared).entries()) {
    if (run.kind === "figure") {
      out.push(<KeyFigure key={runIndex} figure={run.figure} />);
      continue;
    }

    const termRuns = splitTerms(run.text, termBudget);
    termBudget -= termRuns.filter((termRun) => termRun.kind === "term").length;

    for (const [termIndex, termRun] of termRuns.entries()) {
      const key = `${runIndex}-${termIndex}`;
      out.push(
        termRun.kind === "term" ? (
          <Term key={key} term={termRun.key}>
            {termRun.text}
          </Term>
        ) : (
          <Fragment key={key}>{termRun.text}</Fragment>
        ),
      );
    }
  }

  return <>{out}</>;
}
