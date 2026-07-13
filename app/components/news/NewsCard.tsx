import Link from "next/link";

import { NewsImage } from "@/components/news/NewsImage";
import { Tag } from "@/components/Tag";
import { copy } from "@/lib/copy";
import { cx } from "@/lib/cx";
import { signedPercent } from "@/lib/format";
import { catalystLabel, emphasizeVerifiedNumbers, sourcesLine } from "@/lib/news";
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
 */

type NewsCardProps = {
  card: Card;
  tier: "lead" | "row";
};

/** How many ticker chips a card prints before it collapses the rest into a count. */
const TICKER_CAP = 3;

export function NewsCard({ card, tier }: NewsCardProps) {
  const isLead = tier === "lead";

  return (
    <Link
      href={`/news/${card.id}`}
      data-testid={isLead ? "news-lead" : "news-row"}
      data-cluster={card.id}
      className={cx(
        "surface group block rounded-card border border-hairline p-4 desk:p-5",
        // Instant background feedback. No transition class: the P2 ancestor walk forbids one over
        // a subtree that contains a price, and it is right to.
        "hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-accent",
        isLead ? "flex flex-col gap-3" : "flex flex-row-reverse items-start gap-3",
      )}
    >
      <NewsImage
        image={card.image}
        eventType={card.eventType}
        tickers={card.tickers.map((t) => t.symbol)}
        slot={isLead ? "lead" : "thumb"}
        eager={isLead}
      />

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
          {emphasizeVerifiedNumbers(
            card.headline,
            card.keyNumbers.map((n) => n.value),
          ).map((part, index) =>
            part.verified ? (
              // Set in mono because it was CHECKED. The typeface is the receipt.
              <span key={index} data-p2="true" className="font-mono text-[0.92em] text-ink">
                {part.text}
              </span>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </h3>

        <p className="font-ui text-2xs text-muted">
          {card.articles[0]?.source ? `${card.articles[0].source} · ` : ""}
          {formatEtDate(card.firstSeen)} · {formatEtClock(card.firstSeen)} ET
        </p>

        {card.tickers.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {card.tickers.slice(0, TICKER_CAP).map((ticker) => (
              <li
                key={ticker.symbol}
                data-p2="true"
                className="inline-flex items-center gap-1 rounded-chip border border-hairline bg-surface px-1.5 py-0.5 font-mono text-2xs"
              >
                <span className="text-ink">{ticker.symbol}</span>
                {ticker.ret1 !== null ? (
                  <span className={ticker.ret1 >= 0 ? "text-up-text" : "text-down-text"}>
                    {signedPercent(ticker.ret1)} · 1D
                  </span>
                ) : null}
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

        {/* A null here prints NOTHING. Never a placeholder (P9). */}
        {card.whyItMatters ? (
          <p className="font-serif text-sm italic text-ink-2">{card.whyItMatters}</p>
        ) : null}

        <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
          {sourcesLine(card.sources)}
        </p>
      </div>
    </Link>
  );
}
