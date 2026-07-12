import { copy } from "@/lib/copy";
import { signedPercent } from "@/lib/format";

/**
 * VolBandPanel — the empirical volatility bands on the ticker page (plan §3.6 VolBand, §1.5 rule 1).
 *
 * The one forward-looking number the app shows, and it is a RANGE with a frequency label, never a
 * point forecast — and it is NEVER shown without the regime-break caveat (copy.volband.caveat). The
 * bands come straight from the pipeline (empirical quantiles of past h-day paths); this renders the
 * stored lo/hi as a signed-percent range. Hard stop at 20 days, by schema.
 *
 * Rendered as a labelled panel rather than a chart overlay for now — the honest content (the range,
 * the frequency label, and the mandatory caveat) is what the guardrail requires; the on-chart fan is
 * a visual refinement tracked in PROGRESS.
 */

export type VolBandRow = {
  horizonDays: number;
  coverage: number;
  lo: number;
  hi: number;
  label: string;
};

export function VolBandPanel({ bands }: { bands: VolBandRow[] }) {
  if (bands.length === 0) return null;

  // Show the 80% band per horizon (the wider, headline range), ordered by horizon.
  const wide = bands
    .filter((b) => b.coverage === 0.8)
    .sort((a, b) => a.horizonDays - b.horizonDays);
  const rows = wide.length > 0 ? wide : bands.sort((a, b) => a.horizonDays - b.horizonDays);

  return (
    <section data-p2 aria-label="Typical range" className="border-t border-hairline pt-4">
      <h2 className="font-ui text-xs font-bold uppercase tracking-[0.07em] text-ink">Typical range</h2>
      <ul className="pt-3">
        {rows.map((band) => (
          <li key={`${band.horizonDays}-${band.coverage}`} className="flex items-baseline gap-4 py-1">
            <span className="w-14 shrink-0 font-mono text-sm text-ink-2">{band.horizonDays}d</span>
            <span className="font-mono text-sm text-ink">
              {signedPercent(band.lo)} to {signedPercent(band.hi)}
            </span>
            <span className="min-w-0 flex-1 truncate font-ui text-2xs text-muted">{band.label}</span>
          </li>
        ))}
      </ul>
      {/* The regime-break caveat — a band is a forecast without it (§1.5 rule 1). Never omitted. */}
      <p className="max-w-[60ch] pt-2 font-ui text-2xs text-muted">{copy.volband.caveat}</p>
    </section>
  );
}
