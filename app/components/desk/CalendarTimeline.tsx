import { Disclosure } from "@/components/Disclosure";
import { SectionMasthead } from "@/components/SectionMasthead";
import { Tag } from "@/components/Tag";
import { copy } from "@/lib/copy";
import { cx } from "@/lib/cx";

/**
 * CalendarTimeline — Desk module 03, the US session calendar (plan §9.2, §3.6).
 *
 * What is scheduled and when: earnings (with consensus and prior), macro data releases, Fed days.
 * A beginner's biggest avoidable mistake is being surprised by a known event — buying the day before
 * earnings without realising it. So the calendar states the schedule plainly, soonest first, with
 * the consensus figure where there is one. The if/then branch base rates ("if it beats, historically
 * …") attach in P4; at P2 this is the event and its consensus, no forecast.
 */

/** One scheduled event, already formatted for display. */
export type CalendarRow = {
  /** The event date, formatted, e.g. "Jul 15". */
  dateLabel: string;
  /**
   * The per-day anchor id (`cal-2026-07-15`) a story's watch rows link to (PD8). Optional: rows
   * built outside `buildCalendar` (older tests) omit it, and a row with none simply carries no
   * anchor — a hash link that matches nothing lands on the module without scrolling, never a 404.
   */
  anchorId?: string;
  /** earnings | macro | fed — the data model's classification. Not what the reader sees. */
  kind: string;
  /**
   * What the reader sees on the chip: CPI, JOBS, PPI, GDP, PCE, RETAIL, FOMC, EARNINGS. One small
   * vocabulary, chosen by the pipeline's allowlist (redesign §6.2), never FRED's own release names.
   */
  code: string;
  title: string;
  /** The symbol for a single-name event (earnings, dividend); absent for a macro/Fed event. */
  symbol?: string;
  /** The consensus estimate, formatted, when known. */
  consensus?: string;
  /** The prior figure, formatted, when known. */
  prior?: string;
  /** A high-importance event — the ones a beginner most needs to see coming. */
  high?: boolean;
};

/**
 * CalendarTimeline — Desk module 03.
 *
 * Two rules shape how a high-importance row is marked. It gets an ink dot and the *word* "high",
 * never a colour: outcome must never ride on colour alone, and the amber–orange region is reserved
 * for losses and the two alert consumers (plan §3.3, §1.5). And it is never the loudest thing in
 * the row — a calendar that shouts manufactures the urgency this product refuses to sell.
 */

/**
 * How many ROUTINE rows stay in view before the rest fold away. The cut is on TIME, not on a count —
 * see cutCalendar. These bound it so a busy fortnight cannot rebuild the receipt.
 */
const MIN_VISIBLE = 3;
const MAX_ROUTINE_VISIBLE = 6;

/**
 * Cut the calendar on the axis the station exists to serve: TIME, not an item count.
 *
 * **EVERY HIGH-IMPORTANCE ROW IS ALWAYS VISIBLE. Always.** A CPI print or an FOMC decision is never
 * behind a fold, at any width, whatever else is on the list. That is ruling M2 doing its job: this
 * module's purpose is WARNING, and a module that shows one warning while hiding a second implies a
 * completeness it does not have. There is deliberately no "…and 2 more high-importance events"
 * summary line, because such a line would be an admission that the design had gone wrong — the rows
 * are simply there.
 *
 * What folds is the routine tail: the ordinary earnings dates beyond the first few. They keep their
 * count and their date range in the disclosure's summary (M2's contract), so nothing is hidden
 * silently.
 */
function cutCalendar(events: CalendarRow[]): { visible: CalendarRow[]; folded: CalendarRow[] } {
  const visible: CalendarRow[] = [];
  const folded: CalendarRow[] = [];
  let routineShown = 0;

  for (const [index, event] of events.entries()) {
    const isHigh = event.high === true;
    const withinOpeningRows = index < MIN_VISIBLE;
    const routineHasRoom = routineShown < MAX_ROUTINE_VISIBLE;

    if (isHigh || withinOpeningRows || routineHasRoom) {
      visible.push(event);
      if (!isHigh) routineShown += 1;
    } else {
      folded.push(event);
    }
  }

  return { visible, folded };
}

export function CalendarTimeline({
  asOf,
  events,
  compact = false,
}: {
  asOf: Date;
  events: CalendarRow[];
  /**
   * The rail variant (§5.1). In the 340px sidebar a row wraps to two lines and the consensus/prior
   * figures drop away — a reader glances at the rail to see what is coming, they do not study it.
   * On the phone the calendar is full-width in its ritual position, so this is off.
   */
  compact?: boolean;
}) {
  const { visible, folded } = cutCalendar(events);

  return (
    <section aria-label="Session calendar">
      <SectionMasthead
        index={3}
        title="Session calendar"
        asOf={asOf}
        provenance="FRED release calendar · FMP earnings"
      />

      {events.length === 0 ? (
        /*
         * The empty calendar is a signature, not an apology.
         *
         * Before the allowlist, this module could not be empty: FRED publishes something every
         * single day, so it always had *rows* — Coinbase Cryptocurrencies, Commercial Paper, daily
         * Treasury quotes. Now that only real catalysts survive, a genuinely quiet fortnight renders
         * as one. The absence of noise IS the product working, and the card says so out loud rather
         * than looking broken.
         */
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="max-w-[34ch] font-prose text-base text-ink-2">{copy.calendar.empty}</p>
          <div className="h-px w-12 bg-hairline-strong" />
          <p className="max-w-[36ch] font-mono text-2xs text-muted">{copy.calendar.emptySub}</p>
        </div>
      ) : (
        <>
        <ul className="pt-2">
          {visible.map((e, i) => (
            <li
              key={`${e.dateLabel}-${e.symbol ?? e.title}-${i}`}
              // The per-day anchor a story's watch rows link to (PD8) — stamped on the FIRST visible
              // row of each day only, so the id is unique. `scroll-mt` clears the sticky top bar so
              // the anchored day is not hidden under it. Folded rows carry no anchor: they are behind
              // a disclosure, and a hash link cannot scroll to something that is not on screen.
              id={
                e.anchorId && visible.findIndex((v) => v.anchorId === e.anchorId) === i
                  ? e.anchorId
                  : undefined
              }
              className={cx(
                "scroll-mt-24 border-b border-hairline py-2.5 last:border-b-0",
                compact ? "flex flex-col gap-1" : "flex items-baseline gap-4",
              )}
            >
              <span className={cx("flex shrink-0 items-center gap-2", compact ? "" : "contents")}>
                <span className="w-14 shrink-0 font-mono text-2xs uppercase tracking-[0.04em] text-muted">
                  {e.dateLabel}
                </span>
                <span className={compact ? "shrink-0" : "w-24 shrink-0"}>
                  <Tag variant="catalyst">{e.code}</Tag>
                </span>
                {e.high && compact ? <HighMark /> : null}
              </span>

              <span className="min-w-0 flex-1 truncate font-ui text-sm text-ink-2">
                {e.symbol ? <span className="font-semibold text-ink">{e.symbol}</span> : null}
                {e.symbol ? " · " : ""}
                {e.title}
                {e.high && !compact ? <HighMark inline /> : null}
              </span>

              {/* The consensus/prior figures drop out of the rail variant — they are study, not glance. */}
              {e.consensus && !compact ? (
                <span className="shrink-0 font-mono text-2xs text-muted">
                  cons. {e.consensus}
                  {e.prior ? ` · prior ${e.prior}` : ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {/*
         * The routine tail folds away. The high-importance rows never do — see the cut above.
         */}
        {folded.length > 0 ? (
          <Disclosure
            label={copy.disclosure.calendar}
            count={folded.length}
            context={`through ${events[events.length - 1].dateLabel}`}
          >
            <ul>
              {folded.map((e, i) => (
                <li
                  key={`folded-${e.dateLabel}-${e.symbol ?? e.title}-${i}`}
                  className="flex items-baseline gap-4 border-b border-hairline py-2.5 last:border-b-0"
                >
                  <span className="w-14 shrink-0 font-mono text-2xs uppercase tracking-[0.04em] text-muted">
                    {e.dateLabel}
                  </span>
                  <Tag variant="catalyst">{e.code}</Tag>
                  <span className="min-w-0 flex-1 font-ui text-sm text-ink-2">{e.title}</span>
                  {e.high ? <HighMark /> : null}
                </li>
              ))}
            </ul>
          </Disclosure>
        ) : null}
        </>
      )}
    </section>
  );
}

/**
 * The high-importance marker: an ink dot and the WORD.
 *
 * Never a colour — outcome may not ride on colour alone, and the amber–orange region is reserved
 * for losses and the two alert consumers. And never the loudest thing in the row: a calendar that
 * shouts is manufacturing the urgency this product exists to refuse.
 */
function HighMark({ inline = false }: { inline?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap", inline ? "ml-2" : "")}>
      <span aria-hidden="true" className="inline-block size-1.5 rounded-pill bg-ink" />
      <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
        {copy.calendar.importanceHigh}
      </span>
    </span>
  );
}
