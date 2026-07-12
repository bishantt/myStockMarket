import Link from "next/link";

import { formatAsOf } from "@/lib/time";
import { Disclosure } from "@/components/Disclosure";
import { JournalPrompt } from "@/components/desk/JournalPrompt";
import { copy } from "@/lib/copy";
import { JOURNAL_PROMPT } from "@/lib/journal";

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
export function ScorecardPM({
  asOf,
  resolved,
  savedTonight = 0,
}: {
  asOf?: Date;
  resolved?: ScorecardSummary;
  /** How many journal entries exist for tonight (0 or 1). The disclosure reports it (M2). */
  savedTonight?: number;
}) {
  return (
    <section aria-label="Evening scorecard">
      <header className="pt-3">
        <div className="flex items-baseline justify-between gap-4 pb-2">
          <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">
            Evening — scorecard &amp; journal
          </h2>
          {asOf ? (
            <time dateTime={asOf.toISOString()} className="shrink-0 font-mono text-2xs text-muted">
              {formatAsOf(asOf)}
            </time>
          ) : null}
        </div>
        <div className="h-px bg-hairline-strong" />
      </header>

      {resolved && resolved.total > 0 ? (
        <p className="pt-4 font-ui text-sm text-ink-2">
          The app&rsquo;s record so far: {resolved.hits} hit{resolved.hits === 1 ? "" : "s"} and{" "}
          {resolved.misses} miss{resolved.misses === 1 ? "" : "es"}
          {resolved.hitRate ? ` (hit rate ${resolved.hitRate})` : ""}.{" "}
          <Link href="/track-record" className="text-ink underline underline-offset-2 hover:text-accent">
            See the full track record →
          </Link>
        </p>
      ) : (
        <p className="pt-4 font-ui text-sm text-muted">
          — &nbsp; No signals have resolved yet. The app&rsquo;s record fills as horizons pass; tonight&rsquo;s
          journal entry is recorded alongside it.
        </p>
      )}
      {/*
       * THE JOURNAL, BEHIND ONE LABELLED TAP.
       *
       * The textarea is the tallest always-empty region on the phone Desk — a big blank box at the
       * bottom of the ritual, every night, whether or not there is anything to write. It folds now,
       * and the summary row IS the prompt ("What did today's session teach you…"), so the disclosure
       * is not chrome hiding a form; it is the question, asked once, with the form behind it.
       *
       * The count keeps it honest (M2): a collapsed row still reports its state — "1 saved tonight",
       * or "none saved tonight". A zero is a state, not an offer of more. The friction to write is
       * unchanged: one tap, which is what it took to reach the bottom of the page anyway.
       */}
      <Disclosure
        label={JOURNAL_PROMPT}
        count={savedTonight}
        context={savedTonight === 0 ? copy.journal.savedNone : copy.journal.savedOne}
      >
        <JournalPrompt />
      </Disclosure>
    </section>
  );
}
