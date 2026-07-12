import { formatAsOf } from "@/lib/time";
import { JournalPrompt } from "@/components/desk/JournalPrompt";

/** The resolved-log summary the scorecard now grades against (from signal_resolution). */
export type ScorecardSummary = { total: number; hits: number; misses: number; hitRate: string | null };

/**
 * ScorecardPM — the evening scorecard and journal (plan P3 step 4 / P4 step 6, §9.2 the PM ritual).
 *
 * Grading is now live off signal_resolution (P4): the scorecard shows the app's own resolved record
 * — hits, misses, and the plain hit rate — with a link to the full track record. No fake score, no
 * streak; misses read the same as hits (calm tech). Beneath it sits the evening journal, whose
 * entries feed the calibration work in P6.
 *
 * This is the evening counterpart to the eight morning modules, so it carries a title-only masthead
 * (the numbered mastheads are reserved for the AM ritual, §3.10) — the same broadsheet rule, no index.
 */
export function ScorecardPM({ asOf, resolved }: { asOf?: Date; resolved?: ScorecardSummary }) {
  return (
    <section aria-label="Evening scorecard">
      <header className="pt-3">
        <div className="flex items-baseline justify-between gap-4 pb-2">
          <h2 className="font-ui text-xs font-bold uppercase tracking-[0.07em] text-ink">
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

      {resolved && resolved.total > 0 ? (
        <p className="pt-4 font-ui text-sm text-ink-2">
          The app&rsquo;s record so far: {resolved.hits} hit{resolved.hits === 1 ? "" : "s"} and{" "}
          {resolved.misses} miss{resolved.misses === 1 ? "" : "es"}
          {resolved.hitRate ? ` (hit rate ${resolved.hitRate})` : ""}.{" "}
          <a href="/track-record" className="text-ink underline underline-offset-2 hover:text-accent">
            See the full track record →
          </a>
        </p>
      ) : (
        <p className="pt-4 font-ui text-sm text-muted">
          — &nbsp; No signals have resolved yet. The app&rsquo;s record fills as horizons pass; tonight&rsquo;s
          journal entry is recorded alongside it.
        </p>
      )}
      <JournalPrompt />
    </section>
  );
}
