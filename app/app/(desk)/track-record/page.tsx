import { getTrackRecord } from "@/lib/track-record";
import { getForecastRecord } from "@/lib/forecasts";
import { formatUtcDate } from "@/lib/time";
import { copy } from "@/lib/copy";
import { CalibrationScatter } from "@/components/desk/CalibrationScatter";
import { ForecastResolver } from "@/components/desk/ForecastResolver";

/**
 * /track-record — the app's own resolved log (plan P4 step 6, §1.5 rule 7).
 *
 * This is the page that keeps the whole product honest: it shows the app's own record, misses and
 * all. Every fired signal whose ten-day horizon has passed is here with its outcome — hit, miss, or
 * na (an unresolvable horizon, e.g. a delisting). The hit rate is over resolved hit/miss outcomes
 * only. No calibration chart yet — that arrives in P6; this is the plain ledger it will be built on.
 */

/**
 * Served from the cache, revalidated every ten minutes (§5.3 P-1).
 *
 * The log grows as horizons pass — which happens in the nightly job, not while the reader is
 * looking. The publish busts this path, and so does every write that changes it: resolving a
 * forecast, and (as of F1) FILING one, which used to bust only the Desk even though this page is
 * where open forecasts are read. Two writes, one cache, no stale record.
 */
export const revalidate = 600;

export default async function TrackRecordPage() {
  // One parallel stage rather than two sequential awaits: these two reads have nothing to say to
  // each other, and at revalidation time each one pays the full cross-region round trip.
  const [{ rows, summary }, forecasts] = await Promise.all([getTrackRecord(), getForecastRecord()]);

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-3">
        <div className="pb-2">
          <h1 className="font-display text-display font-bold text-ink">
            Track record
          </h1>
        </div>
        <div className="h-px bg-hairline-strong" />
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

      {/* YOUR FORECASTS — the user's own calibration, graded the same public way (plan §7 P6 step 4). */}
      <section aria-label="Your forecasts" className="pt-2">
        <h2 className="font-ui text-sm font-bold uppercase tracking-[0.06em] text-ink">Your forecasts</h2>
        <div className="mt-2 h-px bg-hairline" />
        <p className="max-w-[62ch] pt-3 font-prose text-base text-ink-2">
          The forecasts you attach to journal entries, scored once they resolve. The same Brier score
          the app uses on itself — {copy.brier.anchor}.
        </p>

        {forecasts.resolvedCount === 0 ? (
          <p className="pt-3 font-ui text-sm text-muted">
            — No resolved forecasts yet. Attach a probability to a journal entry, then resolve it here
            once its date passes.
          </p>
        ) : (
          <div className="flex flex-wrap items-start gap-10 pt-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Rolling Brier</span>
              <span className="font-mono text-lg text-ink">{forecasts.rollingBrier?.toFixed(3) ?? "—"}</span>
              <span className="font-ui text-2xs text-muted">over {forecasts.resolvedCount} resolved</span>
            </div>
            <div>
              <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Calibration</span>
              <CalibrationScatter buckets={forecasts.buckets} />
            </div>
          </div>
        )}

        {forecasts.open.length > 0 ? (
          <div className="pt-6">
            <p className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">Open forecasts</p>
            <ul className="pt-2">
              {forecasts.open.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 border-b border-hairline py-2">
                  <span className="max-w-[40ch] font-prose text-sm text-ink">{f.forecast}</span>
                  <span className="font-mono text-2xs text-muted">
                    {Math.round(f.probability * 100)}% · by {formatUtcDate(f.resolvesOn)}
                  </span>
                  <ForecastResolver id={f.id} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
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
  return <th className="py-2 pr-4 font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-muted">{children}</th>;
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`py-2 pr-4 ${mono ? "font-mono" : "font-ui"} text-sm text-ink-2`}>{children}</td>;
}

/**
 * The outcome chip.
 *
 * The redesign lets these carry colour, where they used to be plain ink — but the rules that make
 * them honest did not move an inch:
 *
 *  · **The word is inside the chip.** Outcome may never ride on colour alone (§3.3, P7). A
 *    colourblind reader reads "Miss", not a hue they cannot distinguish.
 *  · **A miss is the same SIZE and the same WEIGHT as a hit.** Only the hue differs. This is the
 *    page that keeps the whole product honest — it exists to show the app's own failures — and the
 *    moment a miss renders smaller, quieter, or greyer than a hit, the page has started editorialising
 *    in its own favour (§5.4, P5).
 *
 * There is no celebration state. A hit is a fact, not a win.
 */
function Outcome({ outcome }: { outcome: "hit" | "miss" | "na" }) {
  const CHIP: Record<typeof outcome, { label: string; className: string }> = {
    hit: { label: "Hit", className: "bg-up-wash text-up-text" },
    miss: { label: "Miss", className: "bg-down-wash text-down-text" },
    na: { label: "Unresolvable", className: "bg-surface text-muted" },
  };
  const { label, className } = CHIP[outcome];

  return (
    <span
      className={`inline-flex items-center rounded-chip border border-hairline px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-[0.04em] ${className}`}
    >
      {label}
    </span>
  );
}
