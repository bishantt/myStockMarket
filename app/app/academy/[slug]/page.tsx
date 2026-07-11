import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";

import { getLessonMeta, getLessonSource } from "@/lib/academy";

/**
 * /academy/[slug] — a single lesson (plan §9.3, P5 step 2).
 *
 * A server component reads the lesson's MDX and renders it with compileMDX (no next.config change —
 * next-mdx-remote/rsc compiles at request time in a Server Component). The prose is Newsreader at a
 * 65ch measure; the retrieval questions from the frontmatter close the lesson. A return rail sits at
 * the top and bottom, so a doorway is never a trap.
 */

// Lessons are static content; render them fresh so a new lesson appears without a rebuild.
export const dynamic = "force-dynamic";

/** The MDX element → styled component map: the Academy's warm, literary prose (plan §3.2). */
const mdxComponents = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="max-w-[65ch] pt-8 font-ui text-lg font-bold uppercase tracking-[0.04em] text-ink" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="max-w-[65ch] pt-4 font-prose text-prose text-ink-2" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="max-w-[65ch] list-disc pt-3 pl-5 font-prose text-prose text-ink-2 marker:text-muted" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="max-w-[65ch] list-decimal pt-3 pl-5 font-prose text-prose text-ink-2 marker:text-muted" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => <li className="pt-1.5" {...props} />,
  strong: (props: React.HTMLAttributes<HTMLElement>) => <strong className="font-semibold text-ink" {...props} />,
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-ink underline underline-offset-2 hover:text-accent" {...props} />
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
        <h1 className="max-w-[65ch] pt-2 font-prose text-2xl text-ink">{meta.title}</h1>
      </header>

      <div className="pt-2">{content}</div>

      {/* Retrieval questions — the lesson's own check, from its frontmatter. */}
      {meta.questions.length > 0 ? (
        <section className="mt-10 border-t border-hairline pt-6" aria-label="Check yourself">
          <h2 className="font-ui text-xs font-bold uppercase tracking-[0.07em] text-ink">Check yourself</h2>
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
    </article>
  );
}
