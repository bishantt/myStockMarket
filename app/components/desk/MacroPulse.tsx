import { GlossaryTerm } from "@/components/GlossaryTerm";
import { SectionMasthead } from "@/components/SectionMasthead";
import { StatFigure } from "@/components/StatFigure";
import { Tag } from "@/components/Tag";
import { copy } from "@/lib/copy";
import type { IndexQuote } from "@/lib/morning";

/**
 * MacroPulse — Desk module 01, the market's opening posture at a glance (plan §9.2, Figure 9.2).
 *
 * Every documented professional routine starts macro-first, so this is the top of the ritual
 * column. It carries THE hero numeral of the whole app — the S&P 500 level — and the hero rule is
 * strict: the 64px figure renders in ink, never in the up/down colour, with direction in small type
 * beside it (plan §3.6). Only this module, on the Desk route, may use the hero scale.
 *
 * What this module must never do (redesign §6.1): print an ETF's price under an index's name. Every
 * slot arrives already carrying its own `source` and its own label — an index level, or an ETF that
 * says it is an ETF. This component's whole job on that front is to render the "ETF proxy" chip
 * wherever a proxy is being shown, so the fallback is visible rather than silent.
 *
 * The breadth strip answers "broad or narrow?" — a rally on narrow breadth is a different thing
 * from a broad one, and that is invisible in a price-only view (Research Report §9.2).
 */

type MacroPulseProps = {
  asOf: Date;
  /** The S&P 500 — the hero. */
  spx: IndexQuote;
  /** The other index slots (Nasdaq, Dow, Russell — the last of which is always an ETF proxy). */
  indices: IndexQuote[];
  /** Breadth of the ingested universe. */
  breadth: { advancers: number; decliners: number; pctAbove50dma: string };
  /** Context cells pulled from FRED. */
  vix: string;
  tenYear: string;
};

/**
 * One index slot, with the proxy chip beside it when the number is an ETF's rather than an index's.
 *
 * The chip is the whole honesty mechanism made visible: a reader glancing at "Russell 2000 · IWM
 * (ETF proxy) — 220.00" cannot mistake 220 for the level of an index that trades near 2,300.
 */
function IndexSlot({ quote, scale }: { quote: IndexQuote; scale: "hero" | "body" }) {
  const delta =
    quote.deltaPct === "—" ? undefined : { value: quote.deltaPct, direction: quote.direction };

  return (
    <div className="flex flex-col gap-1">
      <StatFigure label={quote.label} value={quote.value} scale={scale} delta={delta} />
      {quote.source === "etf-proxy" ? (
        <span title={quote.proxySymbol ? copy.macro.proxyNote.replace("{symbol}", quote.proxySymbol) : undefined}>
          <Tag variant="catalyst">{copy.macro.proxyChip}</Tag>
        </span>
      ) : null}
    </div>
  );
}

export function MacroPulse({ asOf, spx, indices, breadth, vix, tenYear }: MacroPulseProps) {
  return (
    <section aria-label="Macro pulse">
      <SectionMasthead index={1} title="Macro pulse" asOf={asOf} />

      <div className="flex flex-col gap-6 pt-4">
        {/* The hero: the S&P 500 level, 64px ink, direction beside it in small type. */}
        <IndexSlot quote={spx} scale="hero" />

        {/* The index row: Nasdaq / Dow / Russell, then the two FRED context cells. */}
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          {indices.map((idx) => (
            <IndexSlot key={idx.label} quote={idx} scale="body" />
          ))}
          <StatFigure label="VIX" value={vix} scale="body" />
          <StatFigure label="10-year" value={tenYear} scale="body" />
        </div>

        {/* Where the levels came from. Timestamps and provenance are not optional furniture. */}
        <p className="font-mono text-2xs text-muted">{copy.macro.provenance}</p>

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
