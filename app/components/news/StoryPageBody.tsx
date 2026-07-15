import Link from "next/link";
import { notFound } from "next/navigation";

import { AffectedTable, type AffectedRow } from "@/components/news/AffectedTable";
import { NewsImage } from "@/components/news/NewsImage";
import { StoryContext } from "@/components/news/StoryContext";
import { SymbolRecord } from "@/components/SymbolRecord";
import { TickerChip } from "@/components/TickerChip";
import { VerifiedProse } from "@/components/KeyFigure";
import { ExternalLink } from "@/components/ExternalLink";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { isKnownLesson, getLessonMeta } from "@/lib/academy";
import { calendarDayHref } from "@/lib/calendar-anchor";
import { copy, fill } from "@/lib/copy";
import { db } from "@/lib/db";
import { ACADEMY_DOORWAY, catalystLabel, formatModel, sourcesLine, toCard } from "@/lib/news";
import { getSymbolRecord, hasRecord, type SymbolRecord as SymbolRecordData } from "@/lib/record";
import { formatEtStamp, formatUtcDate } from "@/lib/time";

/**
 * StoryPageBody — the story page v2 anatomy, as ONE server component (PD9, plan 11.1 / E9).
 *
 * PD8 built this as the body of /news/[cluster]/page.tsx. PD9 lifts it out unchanged so that TWO
 * routes render the SAME tree: the standalone page (a hard load / shared link) and the intercepting
 * @modal overlay (an in-app tap that opens over the live feed). That is E9's structural guarantee —
 * "one component tree, two presentations" — and it is not a nicety: the reload-while-open e2e asserts
 * the sheet's DOM and the standalone page's DOM are content-identical, and they can only be identical
 * if they are literally the same component. The presentation difference (the sheet chrome, the scrim,
 * the grabber) lives entirely in DetailOverlay, which WRAPS this body; nothing here knows or cares
 * whether it is inside a sheet or filling a page.
 *
 * The ten-block anatomy, its honesty rules, and every "name the absence" branch are exactly as PD8
 * shipped them — see the block comments below. This file did not change what the story page SAYS; it
 * changed only where the code lives, so a second surface can say the same thing.
 */

type StoryPageBodyProps = { clusterId: string };

export async function StoryPageBody({ clusterId }: StoryPageBodyProps) {
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

  const symbols = card.tickers.map((ticker) => ticker.symbol);

  // The instrument names and each affected name's ledger record, in one parallel stage. The record
  // is REUSE of the honesty components (BaseRate / OutcomeChip) — zero new probability UI (9.6).
  const [names, records] = await Promise.all([
    instrumentNames(symbols),
    Promise.all(symbols.map(async (symbol) => ({ symbol, record: await getSymbolRecord(symbol) }))),
  ]);

  const affected: AffectedRow[] = card.tickers.map((ticker) => ({
    symbol: ticker.symbol,
    name: names[ticker.symbol] ?? ticker.symbol,
    ret1: ticker.ret1,
    rvol20: ticker.rvol20,
    hasSetupCard: ticker.hasSetupCard,
  }));

  // Only the affected names our ledger actually holds evidence on — the block is absent when silent.
  const recordsWithData = records.filter((entry) => hasRecord(entry.record));

  // The doorway renders only for a lesson somebody actually wrote — the same manifest gate the
  // evening brief uses. An unauthored slug simply closes the door rather than promising a 404.
  const doorwaySlug = ACADEMY_DOORWAY[card.eventType];
  const lesson = doorwaySlug && isKnownLesson(doorwaySlug) ? getLessonMeta(doorwaySlug) : null;

  const keyNumberValues = card.keyNumbers.map((number) => number.value);

  return (
    // A MEASURE, not the window. Left to fill a 1366px room, the photograph ran the full width while
    // the prose beneath it sat in a 480px column — a picture and a caption pretending to be an
    // article. A story page is a thing to READ, so it is bounded to a reading width, picture and all.
    <article className="mx-auto flex w-full max-w-[900px] flex-col gap-6 pb-8">
      {/* Block 1 — the return rail. A room you can get into and not out of is a trap. */}
      <Link href="/news" className="min-h-11 font-ui text-sm text-accent-deep">
        {copy.news.backToFeed}
      </Link>

      {/* Block 2 — the header. Tags, the serif headline (verified figures in mono), the press time
          and the corroboration COUNT (the named list is block 9, but the count stays up top). */}
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

        <h1 className="max-w-prose font-display text-2xl text-ink desk:text-3xl">
          <VerifiedProse text={card.headline} allowed={keyNumberValues} />
        </h1>

        <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted">
          {sourcesLine(card.sources)}
        </p>
      </header>

      {/* The picture — editorial furniture, and ONLY when a real one is stored (L1/L2). No stored
          image means no figure at all now (CC5, R4): the old generated placeholder that filled this
          slot on every no-photo story was exactly the hole D5 named, a grey slab wedged between the
          headline and the first paragraph. Today that is nearly every story (P-1 is unprovisioned),
          so the common case is a clean text-first read. */}
      {card.image ? (
        <figure className="flex flex-col gap-1.5">
          <NewsImage image={card.image} slot="story" eager />
          {card.image.attributionSource ? (
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
      ) : null}

      {/* Block 3 — what happened. The neutral factual summary; absent when there is no extract. */}
      {card.summary ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.news.whatHappened}</h2>
          <p className="max-w-prose font-serif text-base text-ink-2">{card.summary}</p>
        </section>
      ) : null}

      {/* Block 4 — why it matters. The mechanism, one breath; its absence names WHICH absence. */}
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-ink">{copy.news.whyItMatters}</h2>
        {card.whyItMatters ? (
          <p className="max-w-prose font-serif text-base text-ink-2">
            <VerifiedProse text={card.whyItMatters} allowed={keyNumberValues} />
          </p>
        ) : (
          // A gate that deleted a sentence is the system working loudly; a narrator with nothing to
          // add is the system working quietly. Both are honest, and they are not the same thing.
          <p data-testid="news-note-absent" className="max-w-prose font-ui text-sm text-muted">
            {card.sections.whyItMatters === "dropped" ? copy.news.noteDropped : copy.news.noteAbsent}
          </p>
        )}
      </section>

      {/* Block 5 — context tonight. The v2 insight: mechanism + where the name sits, its numbers in
          mono (E5) and its terms opened (≤2). Absent = SILENT/out-of-budget (nothing) or the gate
          line (DROPPED). A pre-PD7 row has no context and no verdict: it prints nothing at all. */}
      {card.context ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.news.contextTonight}</h2>
          <p data-testid="news-context" className="max-w-prose font-serif text-base text-ink-2">
            <StoryContext text={card.context} cleared={card.contextCleared} />
          </p>
        </section>
      ) : card.sections.context === "dropped" ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.news.contextTonight}</h2>
          <p data-testid="news-context-dropped" className="max-w-prose font-ui text-sm text-muted">
            {copy.news.contextDropped}
          </p>
        </section>
      ) : null}

      {/* By the numbers — the extractor's cleared figures (kept from N5). */}
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

      {/* Block 6 — exposure. The affected names and their snapshot numbers, plus the narrated note;
          symbols are TickerChip doors. C9's "no listing" keeps its heading — the absence is an answer. */}
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg text-ink">{copy.news.affected}</h2>
        {affected.length > 0 ? (
          <>
            <AffectedTable rows={affected} />
            {card.affectedNote ? (
              <p className="max-w-prose font-serif text-sm italic text-muted">{card.affectedNote}</p>
            ) : null}
          </>
        ) : (
          <p className="font-ui text-sm text-muted">{copy.news.noListing}</p>
        )}
      </section>

      {/* Block 7 — what OUR record says. Per affected name the ledger holds evidence on: the setup
          card's base rate (N-gated) and the resolved hits and misses. Absent when the ledger is
          silent — REUSE of the honesty components, zero new probability UI. */}
      {recordsWithData.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">{copy.news.theRecord}</h2>
          {recordsWithData.map((entry) => (
            <RecordForName key={entry.symbol} symbol={entry.symbol} record={entry.record} />
          ))}
        </section>
      ) : null}

      {/* Block 8 — on the calendar. The narrator's snapshotted watch rows, as dated facts, each a
          door to the Desk calendar's day. Absent silently when there are no dated events. */}
      {card.watch.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.news.onTheCalendar}</h2>
          <ul className="flex flex-col gap-1.5">
            {card.watch.map((watch) => {
              const marketWide = watch.kind === "macro" || watch.kind === "fed";
              const scope = marketWide ? copy.news.watchMarketWide : watch.key;
              return (
                <li key={watch.statId || `${watch.code}-${watch.date}`}>
                  <Link
                    href={calendarDayHref(watch.date)}
                    className="flex min-h-11 flex-wrap items-center gap-2 font-ui text-sm text-ink-2"
                  >
                    <Tag variant="catalyst">{watch.code}</Tag>
                    <span>{watch.title}</span>
                    <span className="font-mono text-2xs text-muted">
                      {formatUtcDate(new Date(`${watch.date}T00:00:00Z`))}
                      {scope ? ` · ${scope}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Block 9 — the sources, named. This is what the corroboration count counts. */}
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-2xs font-medium uppercase tracking-[0.08em] text-muted">
          {copy.news.sourceList}
        </h2>
        {card.articles.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {card.articles.map((article) => (
              <li key={article.url} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {/*
                 * THE OUTLET NAME IS A TAP TARGET, NOT A WORD IN A SENTENCE (N7). These links are the
                 * room's whole honesty argument, and on a phone they were TWENTY PIXELS tall. The
                 * padding is touch-only: `md:py-0` leaves every desktop pixel where it was.
                 */}
                <ExternalLink href={article.url} className="font-ui text-sm py-3 md:py-0">
                  {article.source}
                </ExternalLink>
                <span className="font-mono text-2xs text-muted">{formatEtStamp(article.published)}</span>
                <span className="w-full font-serif text-sm text-ink-2">{article.headline}</span>
              </li>
            ))}
          </ul>
        ) : (
          // A story published before the app kept its article list. The count is real and it cannot
          // be checked, and the page says exactly that rather than printing an empty list.
          <p data-testid="news-sources-not-kept" className="max-w-prose font-ui text-sm text-muted">
            {copy.news.sourcesNotKept}
          </p>
        )}
      </section>

      {/* Block 10a — the Academy doorway (manifest-gated). */}
      {lesson ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg text-ink">{copy.news.learn}</h2>
          <Link href={`/academy/${lesson.slug}`} className="min-h-11 font-ui text-sm text-accent-deep">
            {lesson.title} →
          </Link>
        </section>
      ) : null}

      {/* Block 10b — the provenance footer, its models printed from model_meta (9.5), not hardcoded. */}
      <footer className="border-t border-hairline pt-3">
        <p className="font-ui text-2xs text-muted">
          {fill(copy.news.provenance, {
            time: formatEtStamp(card.firstSeen),
            model: provenanceModel(card.modelMeta, card.summary.length > 0),
          })}
        </p>
      </footer>
    </article>
  );
}

/** One affected name's record — its symbol as a door, then the shared record body. */
function RecordForName({ symbol, record }: { symbol: string; record: SymbolRecordData }) {
  return (
    <div className="flex flex-col gap-2">
      <TickerChip symbol={symbol} door />
      <SymbolRecord record={record} />
    </div>
  );
}

/**
 * The provenance footer's model phrase, composed from model_meta (9.5). Never a hardcoded model
 * name: a pre-PD7 row ran SOME extraction but did not record which model, so it says "an earlier
 * run" rather than guessing, and a row with no extract at all keeps the honest "no extract".
 */
function provenanceModel(
  modelMeta: ReturnType<typeof toCard>["modelMeta"],
  hasExtract: boolean,
): string {
  if (modelMeta?.modelExtract && modelMeta.modelSynth) {
    return fill(copy.news.provenanceModels, {
      extract: formatModel(modelMeta.modelExtract),
      synth: formatModel(modelMeta.modelSynth),
    });
  }
  if (modelMeta?.modelExtract) return formatModel(modelMeta.modelExtract);
  if (hasExtract) return copy.news.provenanceEarlier;
  return "no extract";
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
