import { getTrackRecord } from "@/lib/track-record";
import { formatUtcDate } from "@/lib/time";

/**
 * /track-record — the app's own resolved log (plan P4 step 6, §1.5 rule 7).
 *
 * This is the page that keeps the whole product honest: it shows the app's own record, misses and
 * all. Every fired signal whose ten-day horizon has passed is here with its outcome — hit, miss, or
 * na (an unresolvable horizon, e.g. a delisting). The hit rate is over resolved hit/miss outcomes
 * only. No calibration chart yet — that arrives in P6; this is the plain ledger it will be built on.
 */

// Dynamic: the log grows as horizons pass; render it fresh rather than from a long-lived cache.
export const dynamic = "force-dynamic";

export default async function TrackRecordPage() {
  const { rows, summary } = await getTrackRecord();

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-3">
        <div className="pb-2">
          <h1 className="font-ui text-xl font-bold uppercase tracking-[0.06em] font-stretch-[110%] text-ink">
            Track record
          </h1>
        </div>
        <div className="h-0.5 bg-ink" />
        <p className="max-w-[62ch] pt-3 font-prose text-base text-ink-2">
          The app&rsquo;s own resolved signals, misses and all. A signal &ldquo;hit&rdquo; when the price was
          higher ten trading days after it fired. Nothing here is a recommendation — it is the record.
        </p>
      </header>

      {summary.total === 0 ? (
        <p className="font-ui text-sm text-muted">
          — &nbsp; Nothing has resolved yet. Signals resolve ten trading days after they fire; the log
          fills as horizons pass.
        </p>
      ) : (
        <>
          {/* The plain summary — the honest headline, no spin. */}
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <Stat label="Resolved" value={String(summary.total)} />
            <Stat label="Hits" value={String(summary.hits)} />
            <Stat label="Misses" value={String(summary.misses)} />
            <Stat label="Unresolvable" value={String(summary.na)} />
            <Stat label="Hit rate" value={summary.hitRate ?? "—"} />
          </dl>

          {/* The ledger. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse">
              <thead>
                <tr className="border-b border-ink text-left">
                  <Th>Fired</Th>
                  <Th>Symbol</Th>
                  <Th>Pattern</Th>
                  <Th>Horizon</Th>
                  <Th>Outcome</Th>
                  <Th>Resolved</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-hairline">
                    <Td mono>{formatUtcDate(row.firedDate)}</Td>
                    <Td mono>{row.symbol}</Td>
                    <Td>{row.patternLabel}</Td>
                    <Td mono>{row.horizonDays}d</Td>
                    <Td>
                      <Outcome outcome={row.outcome} />
                    </Td>
                    <Td mono>{formatUtcDate(row.resolvedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">{label}</dt>
      <dd className="font-mono text-lg text-ink">{value}</dd>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 pr-4 font-ui text-2xs font-medium uppercase tracking-[0.06em] text-muted">{children}</th>;
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`py-2 pr-4 ${mono ? "font-mono" : "font-ui"} text-sm text-ink-2`}>{children}</td>;
}

/** The outcome, in ink — hits and misses read equally, no green/red celebration (calm tech, §3.3). */
function Outcome({ outcome }: { outcome: "hit" | "miss" | "na" }) {
  const label = outcome === "hit" ? "Hit" : outcome === "miss" ? "Miss" : "Unresolvable";
  return <span className="font-ui text-sm text-ink">{label}</span>;
}
