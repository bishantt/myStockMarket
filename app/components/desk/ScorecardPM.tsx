import { formatAsOf } from "@/lib/time";
import { JournalPrompt } from "@/components/desk/JournalPrompt";

/**
 * ScorecardPM — the evening scorecard and journal (plan P3 step 4, §9.2 the PM ritual).
 *
 * The scorecard grades the user's own forecasts against what actually happened, using the Brier
 * score — but that needs resolved outcomes, so grading does not go live until P4 (signal_resolution
 * and the resolver). Until then this shows an honest "grading begins" state over the one thing that
 * IS live now: the evening journal, whose entries the scorecard will later grade.
 *
 * This is the evening counterpart to the eight morning modules, so it carries a title-only masthead
 * (the numbered mastheads are reserved for the AM ritual, §3.10) — the same broadsheet rule, no
 * index. The mechanical honesty carries through: no fake score, no gamified streak.
 */
export function ScorecardPM({ asOf }: { asOf?: Date }) {
  return (
    <section aria-label="Evening scorecard">
      <header className="pt-3">
        <div className="flex items-baseline justify-between gap-4 pb-2">
          <h2 className="font-ui text-xs font-bold uppercase tracking-[0.07em] font-stretch-[120%] text-ink">
            Evening — scorecard &amp; journal
          </h2>
          {asOf ? (
            <time dateTime={asOf.toISOString()} className="shrink-0 font-mono text-2xs text-muted">
              {formatAsOf(asOf)}
            </time>
          ) : null}
        </div>
        <div className="h-0.5 bg-ink" />
      </header>

      <p className="pt-4 font-ui text-sm text-muted">
        — &nbsp; Grading begins in P4, once forecasts can be resolved against outcomes. Tonight&rsquo;s
        entry is recorded for later grading.
      </p>
      <JournalPrompt />
    </section>
  );
}
