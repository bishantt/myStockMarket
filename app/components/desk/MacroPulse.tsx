import { GlossaryTerm } from "@/components/GlossaryTerm";
import { SectionMasthead } from "@/components/SectionMasthead";
import { StatFigure, type Direction } from "@/components/StatFigure";

/**
 * MacroPulse — Desk module 01, the market's opening posture at a glance (plan §9.2, Figure 9.2).
 *
 * Every documented professional routine starts macro-first, so this is the top of the ritual
 * column. It carries THE hero numeral of the whole app — the S&P 500 day change — and the hero
 * rule is strict: the 64px figure renders in ink, never in the up/down colour, with direction in
 * small type beside it (plan §3.6). Only this module, on the Desk route, may use the hero scale.
 *
 * The breadth strip answers "broad or narrow?" — a rally on narrow breadth is a different thing
 * from a broad one, and that is invisible in a price-only view (Research Report §9.2).
 */

type IndexQuote = {
  label: string;
  /** Already formatted (e.g. "17,204.10"). This component never formats a number itself. */
  value: string;
  deltaPct: string;
  direction: Direction;
};

type MacroPulseProps = {
  asOf: Date;
  /** The S&P 500 — the hero. */
  spx: { value: string; deltaPct: string; direction: Direction };
  /** The other index ETFs shown as a row (Nasdaq, Dow, Russell). */
  indices: IndexQuote[];
  /** Breadth of the ingested universe. */
  breadth: { advancers: number; decliners: number; pctAbove50dma: string };
  /** Context cells pulled from FRED. */
  vix: string;
  tenYear: string;
};

export function MacroPulse({ asOf, spx, indices, breadth, vix, tenYear }: MacroPulseProps) {
  return (
    <section aria-label="Macro pulse">
      <SectionMasthead index={1} title="Macro pulse" asOf={asOf} />

      <div className="flex flex-col gap-6 pt-4">
        {/* The hero: S&P 500 day change, 64px ink, direction beside it in small Wong-coloured type. */}
        <StatFigure label="S&P 500" value={spx.value} scale="hero" delta={{ value: spx.deltaPct, direction: spx.direction }} />

        {/* The index row: Nasdaq / Dow / Russell, then the two FRED context cells. */}
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          {indices.map((idx) => (
            <StatFigure
              key={idx.label}
              label={idx.label}
              value={idx.value}
              scale="body"
              delta={{ value: idx.deltaPct, direction: idx.direction }}
            />
          ))}
          <StatFigure label="VIX" value={vix} scale="body" />
          <StatFigure label="10-year" value={tenYear} scale="body" />
        </div>

        {/* Breadth strip — quiet, factual, no colour: advancers/decliners and % above the 50-day. */}
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 border-t border-hairline pt-3">
          <span className="font-ui text-2xs uppercase tracking-[0.06em] text-muted">
            <GlossaryTerm term="breadth">Breadth</GlossaryTerm>
          </span>
          <span className="font-mono text-sm text-ink-2">
            {breadth.advancers} <GlossaryTerm term="advance-decline">advancing</GlossaryTerm> ·{" "}
            {breadth.decliners} declining
          </span>
          <span className="font-mono text-sm text-ink-2">
            {breadth.pctAbove50dma} above the{" "}
            <GlossaryTerm term="50-day-average">50-day average</GlossaryTerm>
          </span>
        </div>
      </div>
    </section>
  );
}
