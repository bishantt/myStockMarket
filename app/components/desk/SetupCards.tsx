import Link from "next/link";
import { Chevron } from "@/components/Chevron";
import { SectionMasthead } from "@/components/SectionMasthead";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { BaseRate } from "@/components/BaseRate";
import { WeakenerChecklist } from "@/components/desk/WeakenerChecklist";
import { WorkedExampleDrawer } from "@/components/desk/WorkedExampleDrawer";
import { copy } from "@/lib/copy";
import { PracticeDoorway } from "@/components/desk/PracticeDoorway";
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

/**
 * The setup cards. **The caller owns the empty state** — this renders a list that HAS cards in it.
 *
 * It used to carry its own empty branch ("— No setup cards today.") and PD3 took it away, which is a
 * change worth explaining because it looks like a component losing a capability.
 *
 * Law 2 says an empty module is a slim information band of a stated height. A module that renders its
 * own bespoke empty state is a module whose empty height nobody controls — and six modules doing that
 * is six different empty states, six different heights, and no way to hold any of them to a budget.
 * That is precisely the disease Law 2 exists to cure. So there is now ONE empty state in this app
 * (components/EmptyModule.tsx), and the Desk decides when to show it.
 *
 * Measured, before and after: the old bespoke state came to 124px against the plan's ~112px band.
 * The shared one comes to ~104px, and it carries the run's timestamp — because "no setups fired
 * tonight" is a FINDING as of a moment, not an absence of information.
 */
export function SetupCards({
  asOf,
  editionAsOf,
  cards,
}: {
  asOf: Date;
  /** The edition's own stamp, for the as-of matches/differs treatment (CC4). */
  editionAsOf?: Date;
  cards: SetupCardView[];
}) {
  return (
    <section aria-label="Setup cards">
      <SectionMasthead index={6} title="Setup cards" asOf={asOf} editionAsOf={editionAsOf} />
      {
        /*
         * Two-up on the widest desks (NEWS-AND-CONTROL-PLAN Part 4.3). Setup cards are independent
         * cards, not prose, so they tile — unlike the brief and the movers, which stay one column at
         * every width because they exist to be read through.
         *
         * The `wide:border-b` is not redundant with the `border-b` beside it. It reinstates the rule
         * on the LAST card, which `last:border-b-0` removes. In one column that removal is right —
         * a trailing rule against the card's own edge is a double line. In two columns it is wrong:
         * the last card would be the only one in its row without a rule under it, and the grid would
         * look broken rather than designed. Responsive variants sort after pseudo-class variants in
         * Tailwind's output, so the wide rule wins inside its media query and nowhere else.
         */
        <ul className="pt-2 wide:grid wide:grid-cols-2 wide:gap-x-8">
          {cards.map((card) => (
            <li key={card.id} className="border-b border-hairline last:border-b-0 wide:border-b">
              <SetupCard card={card} />
            </li>
          ))}
        </ul>
      }
    </section>
  );
}

function SetupCard({ card }: { card: SetupCardView }) {
  return (
    <details className="group py-3">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 py-1">
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

        {/*
         * The footer doorways. Both are plain links at footnote weight — never buttons.
         */}
        {/*
         * A PARAGRAPH of inline links — deliberately not a flex row.
         *
         * A flex item is BLOCKIFIED: `display: inline` becomes `display: block`, whatever the class
         * says. That matters here because both of these are footnote links sitting in running text,
         * and the touch sweep exempts exactly that (WCAG 2.5.8: a target "in a sentence or block of
         * text" is sized by its line, and padding it to 44px would wreck the paragraph for no
         * accessibility gain — a reader taps the word where the word is). Wrapping them in a flex
         * container silently revoked that exemption and the sweep failed them both, correctly.
         */}
        <p className="font-ui text-2xs leading-relaxed text-muted">
          {/* The Academy doorway, only when the lesson manifest knows the slug. */}
          {card.learnSlug ? (
            <>
              <Link
                href={`/academy/${card.learnSlug}`}
                className="text-ink underline underline-offset-2 hover:text-accent"
              >
                Learn: how this pattern is judged →
              </Link>
              <span aria-hidden="true"> · </span>
            </>
          ) : null}

          {/*
           * THE PRACTICE DOORWAY — ruling M10, and the most carefully bounded link in the app.
           *
           * It sits directly under a base rate, at the moment of maximum conviction, and it goes to
           * an order ticket. That is exactly the kind of link a product like this one should be
           * suspicious of, so it earns the strictest ruling in the plan and all four of its
           * conditions hold here BY CONSTRUCTION:
           *
           *   1. the destination is the PAPER room — this ruling can never be cited for a live order;
           *   2. it carries `signalViewedAt`, which is what ARMS the cooling-off interstitial;
           *   3. the ticket it lands on has no side default (M9) — a bullish card cannot pre-set Buy;
           *   4. the label is mechanical and practice-framed, and it is a plain link, not a button.
           *
           * And the honest case FOR it, which is the reason it exists: the cooling-off pause is built,
           * tested, and — until this link — completely unreachable. Nothing in the product ever
           * constructed the URL that arms it; only the e2e test did. Meanwhile the organic path (open
           * this card, tap the Paper tab, type the symbol) reaches the very same ticket with NO pause
           * at all. This link is strictly MORE protective than the walk it replaces.
           *
           * The boundary bites too: mover rows and scan-table rows get no such link, ever. They are
           * filter hits with no base rate, no interval and no weakener list — no evidence anatomy, no
           * doorway.
           */}
          <PracticeDoorway symbol={card.symbol} />
        </p>
      </div>
    </details>
  );
}
