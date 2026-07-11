import { SectionMasthead } from "@/components/SectionMasthead";
import { Tag } from "@/components/Tag";
import { BaseRate } from "@/components/BaseRate";
import { WeakenerChecklist } from "@/components/desk/WeakenerChecklist";
import { copy } from "@/lib/copy";
import type { BaseRateData } from "@/lib/baserate";
import type { Weakener } from "@/lib/weakeners";
import type { Tier } from "@/lib/constants";

/**
 * SetupCards — Desk module 06, the signature unit (plan §3.6 SetupCardRow/SetupCard, §9.2).
 *
 * A setup card is a pattern that fired on a served symbol, shown honest-by-construction: the tier
 * lexicon word (never a colour — a tier tag is neutral grey by law, §3.3), the base rate with its N,
 * interval, and always-up baseline, the decay stamp, the weakener checklist, the scope line, and the
 * provenance. It glances as a row and opens to the full card inline (a drill-level-2 disclosure —
 * the shared rail is symbol-fixed, so cards use an accessible <details>; logged in DECISIONS).
 *
 * The tier is the only judgment on the card, and it is capped honest: an interval that spans the
 * always-up baseline is WEAK, whatever the point estimate. Everything else is the reader's to weigh
 * — which is the point of the weakeners.
 */

/** The tier lexicon words (copy.tier) — observational, never acquisitional (RR §9.4). */
const TIER_COPY: Record<Tier, string> = {
  strong: copy.tier.strong,
  moderate: copy.tier.moderate,
  weak: copy.tier.weak,
};

export type SetupCardView = {
  id: string;
  symbol: string;
  patternLabel: string;
  patternKey: string;
  tier: Tier;
  cause: string;
  baseRate: BaseRateData;
  weakeners: Weakener[];
  weakenerState: Record<string, boolean>;
  learnSlug: string | null;
};

export function SetupCards({ asOf, cards }: { asOf: Date; cards: SetupCardView[] }) {
  return (
    <section aria-label="Setup cards">
      <SectionMasthead index={6} title="Setup cards" asOf={asOf} />
      {cards.length === 0 ? (
        <p className="pt-4 font-ui text-sm text-muted">— &nbsp; No setup cards today.</p>
      ) : (
        <ul className="pt-2">
          {cards.map((card) => (
            <li key={card.id} className="border-b border-hairline last:border-b-0">
              <SetupCard card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SetupCard({ card }: { card: SetupCardView }) {
  return (
    <details className="group py-2">
      <summary className="flex cursor-pointer list-none items-baseline gap-3">
        <span className="font-ui text-sm font-semibold text-ink">{card.patternLabel}</span>
        <span className="font-mono text-sm text-ink-2">{card.symbol}</span>
        <Tag variant="tier">{TIER_COPY[card.tier]}</Tag>
        <span className="min-w-0 flex-1 truncate font-ui text-2xs text-muted">{card.cause}</span>
        <span className="shrink-0 font-ui text-2xs text-muted group-open:hidden">open</span>
      </summary>

      <div className="flex flex-col gap-4 pl-1 pt-4">
        {/* BASE RATE — the one renderer, with N, interval, baseline, and the decay stamp. */}
        <BaseRate data={card.baseRate} />

        {/* WEAKENERS — the reader's own checklist against the case. */}
        <WeakenerChecklist cardId={card.id} items={card.weakeners} checked={card.weakenerState} />

        {/* The scope line — four words doing most of the product's ethical work. */}
        <p className="font-ui text-2xs uppercase tracking-wide text-muted">{copy.scope.line}</p>

        {/* The one Academy doorway, only when the lesson manifest knows the slug (empty until P5). */}
        {card.learnSlug ? (
          <p>
            <a href={`/academy/${card.learnSlug}`} className="font-ui text-2xs text-ink underline underline-offset-2 hover:text-accent">
              Learn: how this pattern is judged →
            </a>
          </p>
        ) : null}
      </div>
    </details>
  );
}
