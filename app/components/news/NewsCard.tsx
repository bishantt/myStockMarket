import Link from "next/link";

import { ExternalLink } from "@/components/ExternalLink";
import { NewsImage } from "@/components/news/NewsImage";
import { Tag } from "@/components/Tag";
import { TickerChip } from "@/components/TickerChip";
import { VerifiedProse } from "@/components/KeyFigure";
import { copy } from "@/lib/copy";
import { cx } from "@/lib/cx";
import { directionOf, signedPercent } from "@/lib/format";
import { catalystLabel, sourcesLine } from "@/lib/news";
import type { NewsCard as Card } from "@/lib/news";
import { formatEtClock, formatEtDate } from "@/lib/time";

/**
 * NewsCard — one story on the Front Page, in either of the room's two tiers (plan 7.7).
 *
 * The `lead` tier is a full-bleed image over the headline; the `row` tier is a thumbnail beside it.
 * They are the SAME card with the same claims — the lead is a POSITION, not a promotion, and
 * nothing about being first makes a story truer or bigger. (Ruling C4. The seeded night proves it:
 * the largest move on the tape ranks third.)
 *
 * FOUR THINGS THIS CARD IS NOT ALLOWED TO DO, and each of them is a rule with a scar behind it:
 *
 * 1. **It does not move.** Its ticker chips carry real price deltas, so they are `data-p2`, and no
 *    ancestor of a P2 node may animate, transition or transform — which rules out the hover-lift
 *    every card on the internet has. Hover feedback is a background change, applied instantly. A
 *    price that eases into place is a price that looks like it is happening right now.
 *
 * 2. **It does not print a placeholder where the context line would be.** `whyItMatters` is null
 *    whenever the verification gate deleted the sentence or the narrator had nothing to add, and a
 *    null renders NOTHING (P9). No "no summary available", no greyed-out italic apology. The facts
 *    stand on their own, which they can.
 *
 * 3. **It does not emphasize a number the gate never checked.** A figure in the headline is set in
 *    mono if and only if it is one of the cluster's verified key_numbers. The emphasis is itself a
 *    claim — it says "this was checked against its source" — and applying it to anything that
 *    merely looks like a number would have the app vouching for figures it never saw.
 *
 * 4. **It does not say "3h ago".** The room is an ISR-cached page, so a relative timestamp would be
 *    computed when the page was BUILT and then served, frozen, to every reader after. This build
 *    has now shipped that exact bug twice — F4's cooling-off stamp and N4's "markets open" strip —
 *    and both times the string was well-formed and simply false. The article's timestamp is
 *    absolute, in ET, and cannot rot. The room states its press time at the top; between the two,
 *    the reader knows exactly how old everything is, which is more than "3h ago" ever told them.
 *
 * ── THE BYLINE IS A DOOR OUT NOW (PD8, plan 9.4/9.7) ─────────────────────────────────────────────
 *
 * The outlet name is a REAL external anchor to the first source (E8). It cannot live inside the card
 * because the card is one big `<Link>` to the story, and an anchor inside an anchor is invalid HTML —
 * the browser closes the outer one and the reader gets a card whose bottom half silently stops
 * working (the exact TickerChip / drift-rule-26 hazard). So the card is a `<div>` now, holding TWO
 * siblings: the story `<Link>` (the main surface — image, headline, chips) and a FOOTER row with the
 * byline anchor in its own padding box, visually separated by a hairline. One door in, one door out.
 * The anchor is ≥44px on touch (the phone sweep measures it), rel/target set by ExternalLink.
 */

type NewsCardProps = {
  card: Card;
  tier: "lead" | "row";
};

/** How many ticker chips a card prints before it collapses the rest into a count. */
const TICKER_CAP = 3;

export function NewsCard({ card, tier }: NewsCardProps) {
  const isLead = tier === "lead";
  const primarySource = card.articles[0];

  return (
    <div
      data-testid={isLead ? "news-lead" : "news-row"}
      data-cluster={card.id}
      className={cx(
        "surface group flex flex-col rounded-card border border-hairline",
        // Instant background feedback on the whole card. No transition class: the P2 ancestor walk
        // forbids one over a subtree that contains a price, and it is right to.
        "hover:bg-surface-raised",
      )}
    >
      <Link
        href={`/news/${card.id}`}
        className={cx(
          "block p-4 focus-visible:outline-2 focus-visible:outline-accent desk:p-5",
          isLead
            ? // THE LEAD TURNS SIDEWAYS ON A DESKTOP, and it is the fold that decides it. Stacked, a
              // 1.91:1 photograph across a 1366px column is ~715px tall, and with the masthead and the
              // two filter rows above it the lead story's OWN HEADLINE lands below the fold. A front
              // page whose lead headline you have to scroll to find is not a front page.
              //
              // So above `lg` the lead sets the way a broadsheet sets one: the picture on the left, the
              // headline beside it. The photo keeps its ratio, the headline is the first thing read,
              // and the card costs ~420px instead of ~1000. On a phone it stacks, which is right there:
              // at 390px the same ratio is a comfortable 204px and there is no fold to lose.
              "flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5"
            : "flex flex-row-reverse items-start gap-3",
        )}
      >
        <div className={isLead ? "lg:w-[55%] lg:shrink-0" : "contents"}>
          <NewsImage
            image={card.image}
            eventType={card.eventType}
            tickers={card.tickers.map((t) => t.symbol)}
            slot={isLead ? "lead" : "thumb"}
            eager={isLead}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag variant="catalyst">{catalystLabel(card.eventType)}</Tag>
            {card.sectors.slice(0, 1).map((sector) => (
              <Tag key={sector} variant="catalyst">
                {sector}
              </Tag>
            ))}
          </div>

          <h3
            title={card.headline}
            className={cx(
              "line-clamp-2 font-display text-ink",
              isLead ? "text-xl desk:text-2xl" : "text-base",
            )}
          >
            {/* The N5 headline renderer, now the app's ONE emphasis path (PD5). A figure is set in
             * mono if and only if the gate cleared it — the typeface is the receipt. */}
            <VerifiedProse text={card.headline} allowed={card.keyNumbers.map((n) => n.value)} />
          </h3>

          {card.tickers.length > 0 ? (
          // The testid names the SYMBOLS specifically. The browser suite needs to find a card that
          // NAMES a ticker (to prove the chip is a door on the story behind it), and "has a data-p2
          // node" is not that question: a headline carrying a gate-verified figure is also data-p2,
          // and plenty of those name no symbol at all.
          <ul data-testid="card-tickers" className="flex flex-wrap gap-1.5">
            {card.tickers.slice(0, TICKER_CAP).map((ticker) => (
              <li key={ticker.symbol}>
                {/*
                 * LABEL MODE, and it is not a choice — this whole card is one `<Link>` to the story,
                 * and an anchor inside an anchor is invalid HTML. The browser closes the outer one
                 * where the inner begins, and the reader gets a card whose bottom half has silently
                 * stopped being clickable. The symbol still LOOKS like every other symbol in the app,
                 * which is the point of the chip; the door here belongs to the story.
                 */}
                <TickerChip
                  symbol={ticker.symbol}
                  move={
                    ticker.ret1 !== null
                      ? {
                          value: signedPercent(ticker.ret1),
                          direction: directionOf(ticker.ret1),
                          window: copy.window.d1,
                        }
                      : undefined
                  }
                />
              </li>
            ))}
            {card.tickers.length > TICKER_CAP ? (
              <li className="inline-flex items-center rounded-chip border border-hairline bg-surface px-1.5 py-0.5 font-mono text-2xs text-muted">
                +{card.tickers.length - TICKER_CAP}
              </li>
            ) : null}
          </ul>
        ) : null}

        {/* C9, on the card: it affects everything and names nothing. That is a fact, not a gap. */}
        {card.tickers.length === 0 ? (
          <p className="font-ui text-2xs text-muted">{copy.news.noListing}</p>
        ) : null}

        {/* A null here prints NOTHING. Never a placeholder (P9). The figures inside it earn their
         * mono the same way the headline's do — from the same allow-list, through the same door. */}
        {card.whyItMatters ? (
          <p className="font-serif text-sm italic text-ink-2">
            <VerifiedProse
              text={card.whyItMatters}
              allowed={card.keyNumbers.map((n) => n.value)}
            />
          </p>
        ) : null}

          <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
            {sourcesLine(card.sources)}
          </p>
        </div>
      </Link>

      {/*
       * THE BYLINE FOOTER — one door OUT (E8, plan 9.4). A SIBLING of the story link, never nested
       * inside it, in its own hairline-separated box. The outlet name is the external anchor; the
       * timestamp rides beside it. `min-h-11` on touch makes it a real 44px target (the phone sweep
       * measures it), given back above `md` where a mouse needs no floor. A card with no kept
       * articles (a pre-N5 row) shows only its timestamp — no dead anchor.
       */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-hairline px-4 py-1.5 desk:px-5">
        {primarySource ? (
          <ExternalLink
            href={primarySource.url}
            className="flex min-h-11 items-center font-ui text-2xs text-muted md:min-h-0 md:py-2"
          >
            {primarySource.source}
          </ExternalLink>
        ) : null}
        <span className="font-mono text-2xs text-muted">
          {formatEtDate(card.firstSeen)} · {formatEtClock(card.firstSeen)} ET
        </span>
      </div>
    </div>
  );
}
