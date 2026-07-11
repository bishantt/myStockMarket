import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";

/**
 * SourceStatusFooter — the honest provenance line at the foot of the Desk (plan §9.2, §2, §5.3).
 *
 * Every source degrades independently and VISIBLY: if Finnhub was down tonight, the movers ran
 * without their catalysts and this footer says so, by name — the run still succeeded. That honesty
 * is a product commitment, not an error state, so it is stated plainly and without alarm (no colour,
 * no icon). The FRED attribution is a licence condition and always renders here.
 */

/** One provider's health for the run: its name and status (ok | degraded | down). */
export type SourceStatus = { name: string; status: string };

export function SourceStatusFooter({ sources }: { sources: SourceStatus[] }) {
  const degraded = sources.filter((s) => s.status !== "ok");

  return (
    <footer aria-label="Source status" className="mt-2 flex flex-col gap-2 border-t border-hairline pt-4">
      {sources.length > 0 ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {sources.map((s) => (
            <span key={s.name} className="font-ui text-2xs uppercase tracking-[0.04em]">
              <span className={cx(s.status === "ok" ? "text-muted" : "font-semibold text-ink")}>{s.name}</span>
              {s.status !== "ok" ? <span className="text-ink-2"> · {s.status}</span> : null}
            </span>
          ))}
        </div>
      ) : null}

      {/* Name each degraded source, plainly — the section it feeds is running without it. */}
      {degraded.map((s) => (
        <p key={s.name} className="font-ui text-2xs text-muted">
          {fill(copy.degraded.source, { source: s.name })}
        </p>
      ))}

      {/* A licence condition of using the FRED API, always shown. */}
      <p className="font-ui text-2xs text-muted">{copy.attribution.fred}</p>
    </footer>
  );
}
