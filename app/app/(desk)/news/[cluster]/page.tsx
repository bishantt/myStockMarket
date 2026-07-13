import Link from "next/link";
import { notFound } from "next/navigation";

import { AffectedTable, type AffectedRow } from "@/components/news/AffectedTable";
import { NewsImage } from "@/components/news/NewsImage";
import { ExternalLink } from "@/components/ExternalLink";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { isKnownLesson, getLessonMeta } from "@/lib/academy";
import { copy, fill } from "@/lib/copy";
import { db } from "@/lib/db";
import { ACADEMY_DOORWAY, catalystLabel, sourcesLine, toCard } from "@/lib/news";
import { formatEtClock, formatEtDate } from "@/lib/time";

/**
 * /news/[cluster] — one story, in full (NEWS-AND-CONTROL-PLAN Part 7.8).
 *
 * THE PAGE THE CORROBORATION COUNT POINTS AT. The feed card whispers "5 sources"; this is where
 * those five are named, timed, and linked out to. Until N5 the count existed and the articles did
 * not, so the second-heaviest term in the whole ranking formula was a number the reader simply had
 * to believe. A claim that cannot be opened is the exact species of claim this product argues
 * against — so the sources are the first thing on the page, above the picture and the prose.
 *
 * WHAT HAPPENS WHEN THERE IS NO "WHY IT MATTERS". On a card, a missing context line prints nothing
 * at all — silence there is restraint (P9). Here it cannot be, because a reader who opened THIS
 * page did so to find out why the story matters, and a blank space where the answer goes reads as a
 * bug. So the absence speaks, and it distinguishes its two causes: a line the verification gate
 * DELETED (a number in it traced back to no source) is a different event from a line the narrator
 * never wrote, and conflating them would hide the more interesting one. The gate deleting a
 * sentence is the system working loudly, and the page says so.
 */

export const revalidate = 600;

/**
 * The empty array is what turns runtime ISR ON for this route, and it is not optional.
 *
 * The framework's own rule, which this repo learned once already on /ticker/[symbol]: "You must
 * always return an array from generateStaticParams, even if it's empty. Otherwise, the route will
 * be dynamically rendered." Ship the `revalidate` above without this and the route caches NOTHING —
 * every story page re-renders on every request, the B1 budget fails, and the reason is invisible in
 * the code because the `revalidate` line is right there looking correct.
 *
 * Empty, specifically, because there is no useful set to prerender: a night publishes ~190 stories,
 * the reader opens a handful, and the set turns over completely every evening. Each story renders
 * once, on first request, and is served from the cache after. The nightly publish revalidates the
 * whole family (`/news/[cluster]`), so a re-published night cannot leave a stale story behind.
 */
export async function generateStaticParams(): Promise<{ cluster: string }[]> {
  return [];
}

type StoryPageProps = { params: Promise<{ cluster: string }> };

export default async function StoryPage({ params }: StoryPageProps) {
  const { cluster: clusterId } = await params;

  const row = await db.newsCluster.findUnique({
    where: { id: clusterId },
    include: { image: true, links: { orderBy: { symbol: "asc" } } },
  });
  if (!row) notFound();

  const card = toCard({
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
  });

  const names = await instrumentNames(card.tickers.map((ticker) => ticker.symbol));
  const affected: AffectedRow[] = card.tickers.map((ticker) => ({
    symbol: ticker.symbol,
    name: names[ticker.symbol] ?? ticker.symbol,
    ret1: ticker.ret1,
    rvol20: ticker.rvol20,
    hasSetupCard: ticker.hasSetupCard,
  }));

  // The doorway renders only for a lesson somebody actually wrote — the same manifest gate the
  // evening brief uses. An unauthored slug simply closes the door rather than promising a 404.
  const doorwaySlug = ACADEMY_DOORWAY[card.eventType];
  const lesson = doorwaySlug && isKnownLesson(doorwaySlug) ? getLessonMeta(doorwaySlug) : null;

  return (
    <article className="flex flex-col gap-6 pb-8">
      {/* The return rail. A room you can get into and not out of is a trap (the doorways rule). */}
      <Link href="/news" className="min-h-11 font-ui text-sm text-accent-deep">
        {copy.news.backToFeed}
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag variant="catalyst">{catalystLabel(card.eventType)}</Tag>
          {card.sectors.map((sector) => (
            <Tag key={sector} variant="catalyst">
              {sector}
            </Tag>
          ))}
          {card.themes.map((theme) => (
            <Tag key={theme} variant="catalyst">
              {theme}
            </Tag>
          ))}
        </div>

        <h1 className="max-w-prose font-display text-2xl text-ink desk:text-3xl">{card.headline}</h1>

        <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
          {sourcesLine(card.sources)}
        </p>
      </header>

      {/* The sources, named. This is what the corroboration count counts. */}
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">
          {copy.news.sourceList}
        </h2>
        {card.articles.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {card.articles.map((article) => (
              <li key={article.url} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <ExternalLink href={article.url} className="font-ui text-sm">
                  {article.source}
                </ExternalLink>
                <span className="font-mono text-2xs text-muted">
                  {formatEtDate(article.published)} · {formatEtClock(article.published)} ET
                </span>
                <span className="w-full font-serif text-sm text-ink-2">{article.headline}</span>
              </li>
            ))}
          </ul>
        ) : (
          // A story published before the app kept its article list. The count is real and it cannot
          // be checked, and the page says exactly that rather than printing an empty list under a
          // heading — which would tell the reader the story had no sources, which is false.
          <p data-testid="news-sources-not-kept" className="max-w-prose font-ui text-sm text-muted">
            {copy.news.sourcesNotKept}
          </p>
        )}
      </section>

      <figure className="flex flex-col gap-1.5">
        <NewsImage
          image={card.image}
          eventType={card.eventType}
          tickers={card.tickers.map((ticker) => ticker.symbol)}
          slot="story"
          eager
        />
        {card.image?.attributionSource ? (
          <figcaption className="font-ui text-2xs text-muted">
            {card.image.attributionUrl ? (
              <ExternalLink href={card.image.attributionUrl}>
                {fill(copy.news.photoVia, { source: card.image.attributionSource })}
              </ExternalLink>
            ) : (
              fill(copy.news.photoVia, { source: card.image.attributionSource })
            )}
          </figcaption>
        ) : null}
      </figure>

      {card.summary ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.news.whatHappened}</h2>
          <p className="max-w-prose font-serif text-base text-ink-2">{card.summary}</p>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-ink">{copy.news.whyItMatters}</h2>
        {card.whyItMatters ? (
          <>
            <p className="max-w-prose font-serif text-base text-ink-2">{card.whyItMatters}</p>
            {card.affectedNote ? (
              <p className="max-w-prose font-serif text-sm italic text-muted">{card.affectedNote}</p>
            ) : null}
          </>
        ) : (
          // The absence, and WHICH absence. A gate that deleted a sentence is the system working
          // loudly; a narrator with nothing to add is the system working quietly. Both are honest,
          // and they are not the same thing.
          <p data-testid="news-note-absent" className="max-w-prose font-ui text-sm text-muted">
            {card.noteDropped ? copy.news.noteDropped : copy.news.noteAbsent}
          </p>
        )}
      </section>

      {card.keyNumbers.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.news.byTheNumbers}</h2>
          <Surface level="tinted" className="p-4">
            <dl className="flex flex-col gap-2">
              {card.keyNumbers.map((number) => (
                <div key={`${number.value}-${number.what}`} className="flex items-baseline gap-3">
                  <dt data-p2="true" className="font-mono text-base text-ink">
                    {number.value}
                  </dt>
                  <dd className="font-ui text-sm text-muted">{number.what}</dd>
                </div>
              ))}
            </dl>
          </Surface>
        </section>
      ) : null}

      {affected.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.news.affected}</h2>
          <AffectedTable rows={affected} />
        </section>
      ) : (
        // C9 again, on the story's own page: it affects everything and names nothing.
        <p className="font-ui text-sm text-muted">{copy.news.noListing}</p>
      )}

      {lesson ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.news.learn}</h2>
          <Link href={`/academy/${lesson.slug}`} className="min-h-11 font-ui text-sm text-accent-deep">
            {lesson.title} →
          </Link>
        </section>
      ) : null}

      <footer className="border-t border-hairline pt-3">
        <p className="font-ui text-2xs text-muted">
          {fill(copy.news.provenance, {
            time: `${formatEtDate(card.firstSeen)} ${formatEtClock(card.firstSeen)} ET`,
            model: card.summary ? "Claude Haiku" : "no extract",
          })}
        </p>
      </footer>
    </article>
  );
}

/** The instrument names for the affected table. A symbol we hold no name for is its own name. */
async function instrumentNames(symbols: string[]): Promise<Record<string, string>> {
  if (symbols.length === 0) return {};
  try {
    const rows = await db.instrument.findMany({
      where: { symbol: { in: symbols } },
      select: { symbol: true, name: true },
    });
    return Object.fromEntries(rows.map((row) => [row.symbol, row.name]));
  } catch {
    return {};
  }
}
