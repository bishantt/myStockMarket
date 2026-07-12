import { getTrackRecord } from "@/lib/track-record";
import { getForecastRecord } from "@/lib/forecasts";
import { formatUtcDate } from "@/lib/time";
import { decimal } from "@/lib/format";
import { copy } from "@/lib/copy";
import { CalibrationScatter } from "@/components/desk/CalibrationScatter";
import { TrackRecordTable } from "@/components/desk/TrackRecordTable";
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

          {/*
           * The ledger, as the house table (F6). This kills the app's last `overflow-x-auto` table —
           * a six-column grid peeked through a 390px keyhole was the phone experience here.
           *
           * The filter defaults to ALL. A default of "hits" would be a product grading its own
           * homework, and the misses ride the same table at the same weight (P5).
           */}
          <TrackRecordTable
            rows={rows.map((row) => ({
              id: row.id,
              firedDate: formatUtcDate(row.firedDate),
              symbol: row.symbol,
              patternLabel: row.patternLabel,
              horizonDays: row.horizonDays,
              outcome: row.outcome,
              resolvedAt: formatUtcDate(row.resolvedAt),
            }))}
          />
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
              <span className="font-mono text-lg text-ink">
                {forecasts.rollingBrier === null ? "—" : decimal(forecasts.rollingBrier, 3)}
              </span>
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



