import Link from "next/link";

import { ExternalLink } from "@/components/ExternalLink";
import { NewsImage } from "@/components/news/NewsImage";
import { Tag } from "@/components/Tag";
import { TickerChip } from "@/components/TickerChip";
import { VerifiedProse } from "@/components/KeyFigure";
import { copy } from "@/lib/copy";
import { cx } from "@/lib/cx";
import { directionOf, signedPercent } from "@/lib/format";
import { bylineSourceCount, catalystLabel } from "@/lib/news";
import type { NewsCard as Card } from "@/lib/news";
import { formatEtStamp } from "@/lib/time";

/**
 * NewsCard — one story on the Front Page, in either of the room's two tiers (plan 4.4, CC5).
 *
 * THE ROOM IS TEXT-FIRST. The headline is the visual. A card renders a photograph only when a real
 * one is stored (L1/L2, needs P-1), and the old grey catalyst frame that used to ship on every card
 * — taller than the headline it sat above, saying nothing the catalyst Tag did not — is GONE (R4).
 * With no photo the card is its words: tags, headline, why-it-matters, the affected chips, a byline.
 *
 * The two tiers differ by WEIGHT, not by kind:
 *   · lead — the hero. Headline up to three lines, its why-it-matters line, a photo right-of-headline
 *     at 40% when one exists. It is a POSITION, not a promotion — nothing about being first makes a
 *     story truer or bigger (C4; the seeded night proves it, the largest move on the tape ranks third).
 *   · row — compact. Headline two lines, its chips, its byline; no why-it-matters, and a small thumb
 *     only when a photo exists. Built to be scanned.
 *
 * FOUR THINGS THIS CARD IS NOT ALLOWED TO DO, and each is a rule with a scar behind it:
 *
 * 1. **It does not move.** Its ticker chips carry real price deltas, so they are `data-p2`, and no
 *    ancestor of a P2 node may animate, transition or transform — which rules out the hover-lift
 *    every card on the internet has. Hover feedback is a background change, applied instantly. A
 *    price that eases into place is a price that looks like it is happening right now.
 *
 * 2. **It does not print a placeholder where a line would be.** `whyItMatters` is null whenever the
 *    verification gate deleted the sentence or the narrator had nothing to add, and a null renders
 *    NOTHING (P9). No "no summary available", no greyed-out italic apology. The facts stand alone.
 *
 * 3. **It does not emphasize a number the gate never checked.** A figure in the headline is set in
 *    mono if and only if it is one of the cluster's verified key_numbers. The emphasis is itself a
 *    claim — "this was checked against its source" — so applying it to anything that merely looks
 *    like a number would have the app vouching for figures it never saw.
 *
 * 4. **It does not say "3h ago".** The room is an ISR-cached page, so a relative timestamp would be
 *    computed when the page was BUILT and served frozen to every later reader. This build shipped
 *    that exact bug twice (F4, N4) — the string was well-formed and simply false. The byline is
 *    absolute, in ET, and cannot rot.
 *
 * ── THE BYLINE (CC5, E8/9.4) ─────────────────────────────────────────────────────────────────────
 *
 * One line, its own hairline-topped box: outlet · date · time · source count. It carries the ONE door
 * OUT — the outlet is a real external anchor to the first source. It cannot live inside the story link
 * (an anchor inside an anchor is invalid HTML; the browser closes the outer one and the card's bottom
 * half silently stops working — the TickerChip / drift-rule-26 hazard), so the card is a `<div>`
 * holding two siblings: the story `<Link>` and this byline. The source count speaks only when it
 * OUTRANKS the default (>1) — one outlet is the baseline, and "1 SOURCE" on every card was D5's noise;
 * two or more IS the news, because corroboration is the only thing the count buys.
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
  const sourceCount = bylineSourceCount(card.sources);
  const keyNumbers = card.keyNumbers.map((n) => n.value);

  // Text-first: with no stored photo the card is a plain block of words; a photo turns the lead
  // sideways (headline left, picture right at 40%) and gives a row its small thumb on the right.
  const layout = card.image
    ? isLead
      ? "flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5"
      : "flex flex-row items-start gap-3"
    : "block";

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
        className={cx("p-4 focus-visible:outline-2 focus-visible:outline-accent desk:p-5", layout)}
      >
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
              "font-display text-ink",
              // The lead earns a third line (was clamp-2 everywhere); a row stays two, to scan.
              isLead ? "line-clamp-3 text-xl desk:text-2xl" : "line-clamp-2 text-base",
            )}
          >
            {/* The N5 headline renderer, now the app's ONE emphasis path (PD5). A figure is set in
             * mono if and only if the gate cleared it — the typeface is the receipt. */}
            <VerifiedProse text={card.headline} allowed={keyNumbers} />
          </h3>

          {/* Why-it-matters is the LEAD's alone (CC5) — the hero gets the breath, a row gets scanned.
           * A null prints NOTHING, never a placeholder (P9). Its figures earn their mono the same way
           * the headline's do — the same allow-list, the same door. */}
          {isLead && card.whyItMatters ? (
            <p className="font-serif text-sm italic text-ink-2">
              <VerifiedProse text={card.whyItMatters} allowed={keyNumbers} />
            </p>
          ) : null}

          {card.tickers.length > 0 ? (
            // The testid names the SYMBOLS specifically. The browser suite needs a card that NAMES a
            // ticker (to prove the chip is a door on the story behind it), and "has a data-p2 node"
            // is not that question: a headline carrying a gate-verified figure is also data-p2.
            <ul data-testid="card-tickers" className="flex flex-wrap gap-1.5">
              {card.tickers.slice(0, TICKER_CAP).map((ticker) => (
                <li key={ticker.symbol}>
                  {/*
                   * LABEL MODE, and it is not a choice — this whole card is one `<Link>` to the story,
                   * and an anchor inside an anchor is invalid HTML. The symbol still LOOKS like every
                   * other symbol in the app; the door here belongs to the story.
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
          ) : (
            // C9, at card scale: it affects everything and names nothing. One mono word, not the full
            // sentence eight times over — that sentence keeps its room on the story sheet (CC5).
            <p className="font-mono text-2xs text-muted">{copy.news.marketWide}</p>
          )}
        </div>

        {/* A real photograph, when one is stored (L1/L2). The lead sets it beside the headline at 40%
         * above `lg`; a row gives it a small thumb. With no image this renders nothing at all. */}
        {card.image ? (
          isLead ? (
            <div className="lg:w-[40%] lg:shrink-0">
              <NewsImage image={card.image} slot="lead" eager />
            </div>
          ) : (
            <NewsImage image={card.image} slot="thumb" />
          )
        ) : null}
      </Link>

      {/*
       * THE BYLINE — one door OUT (E8, plan 9.4), a SIBLING of the story link in its own hairline box:
       * outlet · date · time · source count. `min-h-11` on the outlet makes it a real 44px target on
       * touch (the phone sweep measures it), given back above `md`. A card with no kept articles shows
       * only its stamp — no dead anchor. The middots are aria-hidden; a screen reader reads the facts,
       * not the punctuation.
       */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-hairline px-4 py-1.5 font-mono text-2xs text-muted desk:px-5">
        {primarySource ? (
          <>
            <ExternalLink
              href={primarySource.url}
              className="flex min-h-11 items-center font-ui text-muted md:min-h-0 md:py-2"
            >
              {primarySource.source}
            </ExternalLink>
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        <span>{formatEtStamp(card.firstSeen)}</span>
        {sourceCount ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{sourceCount}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
