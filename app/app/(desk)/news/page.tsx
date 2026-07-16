import { NewsFeed } from "@/components/news/NewsFeed";
import { Surface } from "@/components/Surface";
import { copy, fill } from "@/lib/copy";
import { db } from "@/lib/db";
import { type NewsCard, type NoStoryMover, toCard } from "@/lib/news";
import { getPriorEditionPressTime } from "@/lib/pipeline";
import { formatEtClock, formatUtcDateLong } from "@/lib/time";

/**
 * /news — the Front Page (NEWS-AND-CONTROL-PLAN Part 7.7).
 *
 * A NEWSPAPER, NOT A WIRE. It is assembled once, after the close, and it says so out loud in its own
 * footer (ruling C10). There is no live badge, no "updating", no pulsing dot, and nothing on this
 * page will change while the reader is looking at it. That is not a limitation being apologised
 * for — it is the product. A feed that refreshed under the reader would be manufacturing exactly
 * the urgency this app exists not to sell.
 *
 * WHAT DECIDES THE ORDER, AND WHAT CANNOT. The order is `significance`, computed in
 * `newsdesk/rank.py` from the event's own properties: how broad it is, how many separate outlets
 * carried it, how large a move it explains, what class of catalyst it is, and how recent. Six
 * inputs, every one a property of the EVENT. No behavioural signal — no clicks, no views, no "most
 * read" — is ingested anywhere in this system, and a test on the pipeline side enumerates the
 * formula's signature so that none can be added quietly (ruling C1). The room states the ordering
 * in its own header, in words, because a page that ranks without explaining how is asking to be
 * trusted rather than checked.
 *
 * THE HEADER SENTENCE SAYS THE PAGE TIES, and that is measured, not modest. On the real feed
 * corroboration is 1 for 131 of 134 stories and magnitude is 0 for ~130 of them, so nearly half the
 * formula's weight barely varies and ten or more stories routinely land on exactly the same score.
 * The honest response was to say so, not to invent a tiebreaker — a "US-market relevance" term would
 * be the app forming an editorial opinion about which stories deserve the front page. (Q-N4-1.)
 */

export const revalidate = 600;

/** How far back the room's payload reaches. The reader slices it into Today / This week. */
const WINDOW_DAYS = 7;

/** How many "moved without a story" candidates to read before filtering out the explained ones. */
const MOVER_SCAN = 12;

type FrontPage = {
  cards: NewsCard[];
  movers: NoStoryMover[];
  sessionDate: Date | null;
  pressTime: Date | null;
  articleCount: number;
  weekIncomplete: boolean;
};

/**
 * Tonight's front page, or an honest empty one.
 *
 * The whole week is fetched in one query and sliced in the browser, which is what lets the range
 * control switch instantly with no loading state (ruling C3's consumers all hold their full range).
 */
async function readFrontPage(): Promise<FrontPage> {
  const empty: FrontPage = {
    cards: [],
    movers: [],
    sessionDate: null,
    pressTime: null,
    articleCount: 0,
    weekIncomplete: true,
  };

  try {
    const latest = await db.newsCluster.findFirst({
      orderBy: { runDate: "desc" },
      select: { runDate: true },
    });
    if (!latest) return empty;

    const since = new Date(latest.runDate);
    since.setUTCDate(since.getUTCDate() - (WINDOW_DAYS - 1));

    const [rows, run, movers, oldest, priorPressTime] = await Promise.all([
      db.newsCluster.findMany({
        where: { runDate: { gte: since } },
        // significance v2, ties NEWEST-first (CC6) — the same sort the Desk preview and the pipeline use.
        orderBy: [{ significance: "desc" }, { firstSeen: "desc" }, { id: "asc" }],
        include: { image: true, links: { orderBy: { symbol: "asc" } } },
      }),
      db.pipelineRun.findUnique({ where: { runDate: latest.runDate } }),
      // The movers are the same ones the Desk shows: the volume-confirmed moves, which are the
      // "unusual-volume" scan's matches in the pipeline's own rank order. Reading them from the
      // same place the Desk does is the point — two definitions of "a mover" would eventually
      // disagree, and then the Desk and the Front Page would print two different markets.
      db.scanResult.findMany({
        where: { presetKey: "unusual-volume" },
        orderBy: [{ runDate: "desc" }, { rank: "asc" }],
        take: MOVER_SCAN,
        select: { symbol: true, metrics: true },
      }),
      db.newsCluster.findFirst({ orderBy: { runDate: "asc" }, select: { runDate: true } }),
      // CC10 (R8): when the prior edition went to press — a cluster first seen after it wears a "new" tag.
      getPriorEditionPressTime(),
    ]);

    const cards = rows.map((row) =>
      toCard({
        ...row,
        image: row.image
          ? {
              urlCard: row.image.urlCard,
              urlThumb: row.image.urlThumb,
              urlFull: row.image.urlFull,
              width: row.image.width,
              height: row.image.height,
              blurDataUrl: row.image.blurDataUrl,
              attributionSource: row.image.attributionSource,
              attributionUrl: row.image.attributionUrl,
            }
          : null,
        links: row.links.map((link) => ({
          symbol: link.symbol,
          ret1: link.ret1,
          rvol20: link.rvol20,
          hasSetupCard: link.hasSetupCard,
        })),
      }, priorPressTime),
    );

    // The archive has to actually SPAN a week before "This week" can promise one. Otherwise the
    // control would offer a window the data cannot fill, which is a small lie told by a control.
    const spanDays = oldest
      ? Math.round((latest.runDate.getTime() - oldest.runDate.getTime()) / 86_400_000)
      : 0;

    return {
      cards,
      movers: movers.map((mover) => {
        const metrics = (mover.metrics ?? {}) as Record<string, unknown>;
        const ret = Number(metrics.ret_1);
        return { symbol: mover.symbol, ret1: Number.isFinite(ret) ? ret : null };
      }),
      sessionDate: latest.runDate,
      pressTime: run?.finishedAt ?? run?.startedAt ?? null,
      // The count the header states is COUNTED, from the articles the page actually carries — never
      // typed in, and never a number from somewhere else that happens to be near enough.
      articleCount: cards.reduce((total, card) => total + card.articles.length, 0),
      weekIncomplete: spanDays < WINDOW_DAYS - 1,
    };
  } catch {
    // A database the room cannot reach is an empty front page, not a crashed one. The rest of the
    // app keeps working, and the reader is told there is nothing rather than shown a stack trace.
    return empty;
  }
}

export default async function NewsPage() {
  const page = await readFrontPage();

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-ink desk:text-4xl">{copy.news.roomTitle}</h1>

        {page.sessionDate && page.pressTime ? (
          <p data-testid="news-press-time" className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
            {fill(copy.news.pressTime, {
              date: formatUtcDateLong(page.sessionDate),
              time: formatEtClock(page.pressTime),
              articles: page.articleCount,
              clusters: page.cards.length,
            })}
          </p>
        ) : null}

        {/* Ruling C1, spoken. A page that ranks without explaining how asks to be trusted. */}
        <p className="max-w-prose font-serif text-sm text-ink-2">{copy.news.ordering}</p>
      </header>

      {page.cards.length === 0 || !page.sessionDate ? (
        <Surface level="card" className="p-5">
          <p className="font-serif text-base text-ink-2">
            No front page has been assembled yet. It is built by the nightly run, after the US close.
          </p>
        </Surface>
      ) : (
        <NewsFeed
          cards={page.cards}
          movers={page.movers}
          sessionDate={page.sessionDate.toISOString()}
          weekIncomplete={page.weekIncomplete}
        />
      )}

      {/* C10: the cadence, stated. The room is honest about being a newspaper. */}
      <footer className="border-t border-hairline pt-3">
        <p className="font-ui text-2xs text-muted">{copy.news.cadence}</p>
      </footer>
    </div>
  );
}
