import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";

import { getLessonManifest, getLessonMeta, getLessonSource } from "@/lib/academy";
import { isLessonSoftGated, M3_SLUGS } from "@/lib/academy-progress";
import { db } from "@/lib/db";
import { GLOSSARY } from "@/lib/glossary";
import { TermProse } from "@/components/Term";
import { LessonReadBeacon } from "@/components/academy/LessonReadBeacon";

/**
 * /academy/[slug] — a single lesson (plan §9.3, P5 step 2).
 *
 * A server component reads the lesson's MDX and renders it with compileMDX (no next.config change —
 * next-mdx-remote/rsc compiles at request time in a Server Component). The prose is Newsreader at a
 * 65ch measure; the retrieval questions from the frontmatter close the lesson. A return rail sits at
 * the top and bottom, so a doorway is never a trap.
 */

/**
 * Every lesson is prerendered at build time, and revalidated every ten minutes (§5.3 P-1).
 *
 * The old comment here said lessons were rendered fresh "so a new lesson appears without a rebuild",
 * which was true and expensive: a lesson is an MDX file on disk, and it was being COMPILED on every
 * single visit — `compileMDX` at request time, per reader, per page view, for content that cannot
 * change without a deploy. Since all 25 slugs are known at build, they are compiled once, here.
 *
 * A lesson still cannot go stale: the read beacon busts this path when you finish one, and shipping
 * a new lesson means shipping a file, which means a deploy, which means a build.
 */
export const revalidate = 600;

/**
 * The 25 authored lessons, from the manifest — the same list the Academy index reads.
 *
 * This is what moves the MDX compile from request time to build time. It also means an unknown slug
 * is rendered on demand and 404s through the existing notFound() path, rather than being invented.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return getLessonManifest().map((lesson) => ({ slug: lesson.slug }));
}

/** The reader's finished lessons, or none if the database is unreachable — the M3 soft gate then
 *  simply does not fire. Every lesson is still readable; a build with no database still succeeds. */
async function completedLessons(): Promise<string[]> {
  try {
    const rows = await db.lessonProgress.findMany({ select: { slug: true } });
    return rows.map((row) => row.slug);
  } catch (error) {
    console.error("LessonPage: could not read lesson progress", error);
    return [];
  }
}

/**
 * The MDX element → styled component map: the Academy's reading typography (§5.6).
 *
 * The line-height rises to 1.7 here and the measure holds at 65ch. That pair is the room switch,
 * more than any colour ever was: the Desk is dense because you scan it, and this is airy because
 * you read it. Section headings are serif, not terminal mastheads — a reading room does not number
 * its furniture.
 */
/**
 * The glossary entries this lesson IS. They get no doorway in their own lesson (PD6).
 *
 * The glossary already knows which lesson explains each term (`entry.lesson`), so nobody maintains a
 * second list — the exclusion is derived from the link that already exists. A reader on "Volume and
 * RVOL" does not need a dotted underline under "relative volume" offering to explain relative volume;
 * that is the page. Every OTHER term still opens, which is the actual value: a risk lesson that
 * mentions "base rate" in passing hands the beginner the definition without sending them away.
 */
function selfExplainedBy(slug: string): ReadonlySet<string> {
  return new Set(
    Object.entries(GLOSSARY)
      .filter(([, entry]) => entry.lesson === slug)
      .map(([key]) => key),
  );
}

function mdxComponentsFor(slug: string) {
  const exclude = selfExplainedBy(slug);

  return {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="max-w-[65ch] pt-10 font-display text-title font-bold text-ink" {...props} />
  ),
  /*
   * THE LESSON'S PROSE IS WHERE A BEGINNER MEETS THE VOCABULARY, so it is where the doorways go —
   * and it is also the room with the least tolerance for noise, because a reading room is for
   * reading. The restraint is not a judgement call; it is three rules composing:
   *
   *   · at most TWO doorways per paragraph (lib/prose.ts), and
   *   · each term opens exactly ONCE per view (the React `cache` registry) — so across a whole
   *     lesson a term is underlined once, in the first paragraph that happens to use it, and reads
   *     as plain words every time after, and
   *   · a lesson never opens a doorway onto ITSELF (`exclude`, above).
   *
   * A long lesson therefore carries a handful of underlines, not a forest, and nothing here needed a
   * number to be tuned by eye.
   */
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="max-w-[65ch] pt-4 font-prose text-prose leading-[1.7] text-ink-2" {...props}>
      <TermProse text={children} exclude={exclude} />
    </p>
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="max-w-[65ch] list-disc pt-3 pl-5 font-prose text-prose leading-[1.7] text-ink-2 marker:text-muted" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="max-w-[65ch] list-decimal pt-3 pl-5 font-prose text-prose leading-[1.7] text-ink-2 marker:text-muted" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => <li className="pt-1.5" {...props} />,
  strong: (props: React.HTMLAttributes<HTMLElement>) => <strong className="font-semibold text-ink" {...props} />,
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-accent-deep underline underline-offset-2" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="max-w-[65ch] border-l-2 border-hairline pl-4 pt-4 font-prose text-prose italic text-ink" {...props} />
  ),
  };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = getLessonMeta(slug);
  const source = getLessonSource(slug);
  if (!meta || source === null) notFound();

  // The M3 soft gate: a pattern lesson (M4/M5) shows a "risk first" notice until M3 is complete.
  const completed = await completedLessons();
  const gated = isLessonSoftGated(meta.module, completed);

  const { content } = await compileMDX({
    source,
    options: { parseFrontmatter: true },
    components: mdxComponentsFor(slug),
  });

  return (
    // The lesson's reading column CENTERS on a wide screen (CC4, D4). Its blocks are already capped at
    // a ~65ch measure, but the article ran full-width and left-anchored them — a vast right void on a
    // 16" desk. `mx-auto` with a measure a touch wider than the content pins the column to the middle.
    // The Academy keeps its own reading-room grammar (serif kickers, solid cards); only the measure
    // moves here.
    <article className="mx-auto flex w-full max-w-[72ch] flex-col">
      {/*
       * The 44px touch box was missing here, and PD3 is when anything finally looked (Q-G3-2).
       *
       * Its twin on /academy/review has carried `flex min-h-11 w-fit items-center` since it shipped.
       * This one — the same link, one directory over — was 17px tall. Nothing failed, because the
       * lesson family was the one room in the manifest with an EMPTY `sweeps` list: the Academy's
       * frame is swept at /academy, so a lesson looked covered, and its own controls had never been
       * measured by anything. The sweep found this on its very first run.
       */}
      <Link
        href="/academy"
        className="flex min-h-11 w-fit items-center font-ui text-xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent"
      >
        ← All lessons
      </Link>

      <header className="pt-4">
        <p className="font-ui text-2xs uppercase tracking-[0.07em] text-muted">
          {meta.module} · {meta.minutes} min read
        </p>
        <h1 className="max-w-[24ch] pt-3 font-display text-display font-bold text-ink">{meta.title}</h1>
      </header>

      {/* SOFT GATE — a nudge, never a lock. The reader may keep going. */}
      {gated ? (
        <aside className="mt-4 max-w-[65ch] rounded-panel border border-hairline bg-surface p-4" aria-label="Suggested order">
          <p className="font-ui text-2xs font-semibold uppercase tracking-[0.06em] text-ink">
            Risk before patterns
          </p>
          <p className="pt-1.5 font-prose text-sm text-ink-2">
            This is a pattern lesson. The Academy suggests finishing module M3 —{" "}
            <Link href={`/academy/${M3_SLUGS[0]}`} className="text-accent underline underline-offset-2">
              the risk lessons
            </Link>{" "}
            — first, so a pattern is read against sizing and expectancy, not on its own. You are free to
            continue now; this is only a suggestion.
          </p>
        </aside>
      ) : null}

      <div className="pt-2">{content}</div>

      {/* Retrieval questions — the lesson's own check, from its frontmatter. */}
      {meta.questions.length > 0 ? (
        <section className="mt-10 border-t border-hairline pt-6" aria-label="Check yourself">
          <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">Check yourself</h2>
          <dl className="pt-3">
            {meta.questions.map((question, index) => (
              <div key={index} className="max-w-[65ch] pt-4">
                {/* Frontmatter, so these are plain strings — no markup to walk around. */}
                <dt className="font-prose text-prose text-ink">
                  <TermProse text={question.q} exclude={selfExplainedBy(slug)} />
                </dt>
                <dd className="pt-1.5 font-prose text-base text-ink-2">
                  <TermProse text={question.a} exclude={selfExplainedBy(slug)} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* AND THE SAME 44px TOUCH BOX AS ITS TWIN AT THE TOP OF THIS FILE (PD6).
       *
       * PD3 found the missing touch target on the return rail above and fixed it — HERE, on the same
       * link, in the same file, forty lines down, it was still 17px tall. The sweep measures a room's
       * controls and this one had simply never been reported, because the fix was applied where the
       * bug was FOUND rather than everywhere the bug LIVED. Same law as the six delta chips: when you
       * fix something, grep for its siblings. This one was in the same file. */}
      <Link
        href="/academy"
        className="mt-10 flex min-h-11 w-fit items-center font-ui text-xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent"
      >
        ← All lessons
      </Link>

      {/* Opening the lesson is the read — record it for the M3 soft gate. */}
      <LessonReadBeacon slug={meta.slug} />
    </article>
  );
}
