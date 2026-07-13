import { Disclosure } from "@/components/Disclosure";
import { Surface } from "@/components/Surface";
import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";

/**
 * SourceStatusFooter — the honest provenance line at the foot of the Desk (plan §9.2, §2, §5.3;
 * APP-FEEL-PLAN §4.1).
 *
 * Every source degrades independently and VISIBLY: if Finnhub was down tonight, the movers ran
 * without their catalysts and this footer says so, by name — the run still succeeded. That honesty
 * is a product commitment, not an error state, so it is stated plainly and without alarm (no colour,
 * no icon). The FRED attribution is a licence condition and always renders here.
 *
 * THE FOLD IS RULING M2's SHARPEST CASE, AND THIS COMPONENT ENFORCES IT RATHER THAN TRUSTING ITS
 * CALLER.
 *
 * The per-provider rows fold behind a one-line summary — but ONLY when every provider is ok. The
 * moment one is degraded the disclosure is `forceOpen`: the rows render with no toggle at all. A
 * summary reading "6 sources · all reporting" with its own refutation folded away underneath is
 * precisely the lie M2 exists to forbid. A caveat may collapse WITH the claim it qualifies; a
 * visible claim may never have a hidden caveat.
 *
 * The rule lives here, in the component, not at the call site — a caller cannot get it wrong,
 * because a caller is never asked.
 */

/** One provider's health for the run: its name and status (ok | degraded | down). */
export type SourceStatus = { name: string; status: string };

/**
 * THE FOOTPRINT SHRINK (NEWS-AND-CONTROL-PLAN Part 4.2), and the component owns it.
 *
 * On a healthy night this footer said "6 sources · all reporting" — one line whose content is
 * "nothing to report" — inside a full Surface card, in the rail. That is the footprint disease in
 * miniature: the app spending its most expensive material on its least surprising fact.
 *
 * So the CHROME now escalates the same way the pipeline strip's does:
 *
 *   all ok    → no card. A plain footer line under the grid. It is a provenance stamp, and a
 *               provenance stamp is not a station.
 *   degraded  → the card stays, forced open, naming what failed. It does not shrink by one pixel,
 *               because the night something broke is the entire reason this surface exists. A
 *               footer that gets quieter as the news gets worse is the exact inversion of the rule.
 *
 * The decision lives here rather than at the call site for the same reason the M2 fold does: a
 * caller cannot get it wrong, because a caller is never asked.
 */
export function SourceStatusFooter({ sources, window }: { sources: SourceStatus[]; window?: string }) {
  const degraded = sources.filter((s) => s.status !== "ok");
  const allOk = degraded.length === 0;

  const rows = (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {sources.map((s) => (
          <span key={s.name} className="font-ui text-2xs uppercase tracking-[0.04em]">
            <span className={cx(s.status === "ok" ? "text-muted" : "font-semibold text-ink")}>{s.name}</span>
            {s.status !== "ok" ? <span className="text-ink-2"> · {s.status}</span> : null}
          </span>
        ))}
      </div>

      {/* Name each degraded source, plainly — the section it feeds is running without it. */}
      {degraded.map((s) => (
        <p key={s.name} className="font-ui text-2xs text-muted">
          {fill(copy.degraded.source, { source: s.name })}
        </p>
      ))}
    </div>
  );

  const body = (
    <>
      {sources.length > 0 ? (
        <>
          {/* The summary line. It only ever claims "all reporting" when that is true. */}
          {allOk ? (
            <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">
              {fill(copy.sources.allOk, { n: sources.length, window: window ?? "tonight" })}
            </p>
          ) : null}

          <Disclosure
            label={copy.disclosure.sources}
            count={sources.length}
            context={allOk ? undefined : "a source is degraded"}
            forceOpen={!allOk}
          >
            {rows}
          </Disclosure>
        </>
      ) : null}

      {/* A licence condition of using the FRED API. Always visible, never behind a fold. */}
      <p className="font-ui text-2xs text-muted">{copy.attribution.fred}</p>
    </>
  );

  // The healthy night: a plain provenance line, no card, no material, no rail slot.
  if (allOk) {
    return (
      <footer
        aria-label="Source status"
        className="flex flex-col gap-2 border-t border-hairline pt-4"
      >
        {body}
      </footer>
    );
  }

  // The bad night: the card, at full strength. This is what the surface is FOR.
  return (
    <Surface as="footer" aria-label="Source status" className="flex flex-col gap-2 p-5">
      {body}
    </Surface>
  );
}
