import { Chevron } from "@/components/Chevron";
import { SectionMasthead } from "@/components/SectionMasthead";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { BaseRate } from "@/components/BaseRate";
import { WeakenerChecklist } from "@/components/desk/WeakenerChecklist";
import { WorkedExampleDrawer } from "@/components/desk/WorkedExampleDrawer";
import { copy } from "@/lib/copy";
import type { BaseRateData } from "@/lib/baserate";
import { buildWorkedExample } from "@/lib/worked-example";
import type { Weakener } from "@/lib/weakeners";
import type { Tier } from "@/lib/constants";

/**
 * SetupCards — Desk module 06, the signature unit (plan §3.6 SetupCardRow/SetupCard, §9.2).
 *
 * A setup card is a pattern that fired on a served symbol, shown honest-by-construction: the tier
 * lexicon word, the base rate with its N, interval and always-up baseline, the decay stamp, the
 * weakener checklist, the scope line, and the provenance. It glances as a row and opens to the full
 * card inline (a drill-level-2 disclosure — the shared rail is symbol-fixed, so cards use an
 * accessible <details>; logged in DECISIONS).
 *
 * TWO RULES SHAPE THE COLLAPSED ROW, and both were tightened in the redesign:
 *
 * 1. **The only number on it is `n=`.** No proportion, no percentage, no bar. A base rate may not
 *    appear without its interval, its baseline and its WEAK cap, and those live inside BaseRate —
 *    which is inside the expansion. A "56%" on the summary row would be a rate stripped of every
 *    piece of context that keeps it honest, sitting where it is easiest to skim. (§5.1, P4.)
 *
 * 2. **The expansion is INSTANT.** General UI motion is allowed in this design now, and a fading
 *    <details> reveal is exactly the sort of pleasant thing it permits — but this subtree is a base
 *    rate, an interval and a dot array, and probability visuals never move (P2). Only the chevron
 *    rotates. A jsdom test walks up from every [data-p2] node to enforce it.
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
    <details className="group py-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
        {/*
         * The pattern name is set in Newsreader italic, not Playfair: the serif floor (§3.1) puts
         * the display face at 19px and above, and a display serif's hairlines collapse below it.
         * A text serif holds them.
         */}
        <span className="font-prose text-title italic text-ink">{card.patternLabel}</span>
        <span className="font-mono text-sm text-ink-2">{card.symbol}</span>
        <Tag variant="tier" tier={card.tier}>{TIER_COPY[card.tier]}</Tag>

        {/* The ONLY number on the collapsed row. See the rule at the top of this file. */}
        <span className="font-mono text-2xs text-muted">n={card.baseRate.n}</span>

        <span className="min-w-0 flex-1 truncate font-ui text-2xs text-muted">{card.cause}</span>

        {/* The chevron may rotate: it is a sibling of the probability visuals, never an ancestor. */}
        <Chevron />
      </summary>

      <div className="flex flex-col gap-5 pt-4">
        {/* BASE RATE — the one renderer: N, interval, baseline, decay stamp, proportion bar, dots. */}
        <Surface level="tinted" as="div" className="p-4">
          <BaseRate data={card.baseRate} />
        </Surface>

        {/* WEAKENERS — the reader's own checklist against the case. */}
        <WeakenerChecklist cardId={card.id} items={card.weakeners} checked={card.weakenerState} />

        {/* WORKED EXAMPLE — the three-step walk-through (data → pattern+belief → last N, failures shown). */}
        <WorkedExampleDrawer
          example={buildWorkedExample({
            symbol: card.symbol,
            patternKey: card.patternKey,
            patternLabel: card.patternLabel,
            cause: card.cause,
            baseRate: card.baseRate,
          })}
        />

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
