import { formatAsOf } from "@/lib/time";

/**
 * SectionMasthead — "01 — MACRO PULSE", a 2px ink rule, and the module's data timestamp.
 *
 * This one component carries half the app's identity (plan §3.4), so it is built first and
 * reused everywhere. Every Desk module opens with one, without exception, and that
 * consistency is what makes the Desk read as a broadsheet rather than a dashboard.
 *
 * The right-aligned timestamp is not decoration either. It is the mechanism that lets offline
 * mode be an honest state instead of an apology: when every module says when its data is
 * from, stale data identifies itself and no banner has to explain it (plan §5.3).
 */

type SectionMastheadProps = {
  /** The module's position in the ritual order, 1 through 8. Rendered zero-padded: "01". */
  index: number;
  /** The module name. Rendered uppercase; pass it in sentence case. */
  title: string;
  /**
   * When this module's data was computed. Omit only for modules that show no data at all
   * (the styleguide, for instance) — never to hide a stale timestamp.
   */
  asOf?: Date;
  /** An optional right-hand affordance, e.g. a "view all" link. Sits left of the timestamp. */
  action?: React.ReactNode;
};

export function SectionMasthead({
  index,
  title,
  asOf,
  action,
}: SectionMastheadProps) {
  return (
    <header className="pt-3">
      <div className="flex items-baseline justify-between gap-4 pb-2">
        {/*
         * Archivo Expanded, uppercase, wide tracking. The index number is part of the
         * typography, not a list marker, so it is not a real <ol> — it names the module's
         * fixed place in the daily ritual, which is the same on every visit.
         */}
        <h2 className="font-ui text-xs font-bold uppercase tracking-[0.07em] font-stretch-[120%] text-ink">
          <span className="tabular-nums">{String(index).padStart(2, "0")}</span>
          <span aria-hidden="true"> — </span>
          {title}
        </h2>

        <div className="flex shrink-0 items-baseline gap-3">
          {action}
          {asOf ? (
            // Mono, muted, small. A timestamp is provenance, and provenance is quiet.
            <time
              dateTime={asOf.toISOString()}
              className="font-mono text-2xs text-muted"
            >
              {formatAsOf(asOf)}
            </time>
          ) : null}
        </div>
      </div>

      {/*
       * The 2px ink rule. This is the app's structural line — the thing hairlines are quiet
       * against. It is a border, not a shadow: there is no elevation anywhere in this design.
       */}
      <div className="h-0.5 bg-ink" />
    </header>
  );
}
