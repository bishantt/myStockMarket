import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";

import { getLessonManifest, getLessonMeta, getLessonSource } from "@/lib/academy";
import { isLessonSoftGated, M3_SLUGS } from "@/lib/academy-progress";
import { db } from "@/lib/db";
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
const mdxComponents = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="max-w-[65ch] pt-10 font-display text-title font-bold text-ink" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="max-w-[65ch] pt-4 font-prose text-prose leading-[1.7] text-ink-2" {...props} />
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
    components: mdxComponents,
  });

  return (
    <article className="flex flex-col">
      <Link href="/academy" className="font-ui text-xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent">
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
                <dt className="font-prose text-prose text-ink">{question.q}</dt>
                <dd className="pt-1.5 font-prose text-base text-ink-2">{question.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <Link href="/academy" className="pt-10 font-ui text-xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent">
        ← All lessons
      </Link>

      {/* Opening the lesson is the read — record it for the M3 soft gate. */}
      <LessonReadBeacon slug={meta.slug} />
    </article>
  );
}
