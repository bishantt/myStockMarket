import { SectionMasthead } from "@/components/SectionMasthead";
import { Tag } from "@/components/Tag";

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
  /** earnings | macro | fed | div | other — the chip label. */
  kind: string;
  title: string;
  /** The symbol for a single-name event (earnings, dividend); absent for a macro/Fed event. */
  symbol?: string;
  /** The consensus estimate, formatted, when known. */
  consensus?: string;
  /** The prior figure, formatted, when known. */
  prior?: string;
};

export function CalendarTimeline({ asOf, events }: { asOf: Date; events: CalendarRow[] }) {
  return (
    <section aria-label="Session calendar">
      <SectionMasthead index={3} title="Session calendar" asOf={asOf} />

      {events.length === 0 ? (
        <p className="pt-4 font-ui text-sm text-muted">No scheduled events in the days ahead.</p>
      ) : (
        <ul className="pt-2">
          {events.map((e, i) => (
            <li
              key={`${e.dateLabel}-${e.symbol ?? e.title}-${i}`}
              className="flex items-baseline gap-4 border-b border-hairline py-2 last:border-b-0"
            >
              <span className="w-14 shrink-0 font-mono text-2xs uppercase tracking-[0.04em] text-muted">
                {e.dateLabel}
              </span>
              <span className="w-24 shrink-0">
                <Tag variant="catalyst">{e.kind}</Tag>
              </span>
              <span className="min-w-0 flex-1 truncate font-ui text-sm text-ink-2">
                {e.symbol ? <span className="font-semibold text-ink">{e.symbol}</span> : null}
                {e.symbol ? " · " : ""}
                {e.title}
              </span>
              {e.consensus ? (
                <span className="shrink-0 font-mono text-2xs text-muted">
                  cons. {e.consensus}
                  {e.prior ? ` · prior ${e.prior}` : ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
