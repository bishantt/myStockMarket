import Link from "next/link";

import { GLOSSARY, GLOSSARY_KEYS } from "@/lib/glossary";

/**
 * /academy/glossary — the term index (plan §9.3).
 *
 * Every term the Desk can show, defined once and price-free, with a doorway to the lesson that
 * teaches it in full. This is the reference companion to the popovers: the same definitions, laid out
 * to browse. Terms are listed in seed order, which runs roughly from market basics to the app's own
 * honesty machinery.
 */

export const metadata = { title: "Glossary — the Academy" };

export default function GlossaryIndex() {
  const terms = GLOSSARY_KEYS.map((key) => ({ key, ...GLOSSARY[key] }));

  return (
    <section className="flex flex-col">
      <Link
        href="/academy"
        className="flex min-h-11 w-fit items-center font-ui text-sm text-ink-2 transition-colors duration-(--duration-quick) hover:text-accent-deep"
      >
        ← All lessons
      </Link>

      <header className="pt-6">
        <h1 className="font-display text-display font-bold text-ink">Glossary</h1>
        <p className="max-w-[62ch] pt-3 font-prose text-prose leading-[1.7] text-ink-2">
          The {terms.length} terms the Desk uses, defined plainly. Each links to the lesson that goes
          deeper, where one exists.
        </p>
      </header>

      {/*
       * THE TERM IS THE HERO (§5.6). A glossary is not a table of definitions with the words as
       * row labels — it is a set of words, each of which happens to have a definition. So the term
       * is set in the display serif, at title size, and the definition reads as prose beneath it.
       *
       * Two columns above `lg`, because the entries are short and a single 65ch column of them
       * would be a very long, very thin page.
       */}
      <dl className="columns-1 gap-8 pt-8 lg:columns-2">
        {terms.map((term) => (
          <div
            key={term.key}
            className="mb-6 break-inside-avoid border-t border-hairline pt-4"
          >
            <dt className="flex flex-wrap items-baseline gap-3">
              <span className="font-display text-title font-bold text-ink">{term.term}</span>
              {term.lesson ? (
                <Link
                  href={`/academy/${term.lesson}`}
                  className="inline-flex min-h-11 items-center font-ui text-2xs text-accent-deep transition-colors duration-(--duration-quick) hover:underline"
                >
                  Lesson →
                </Link>
              ) : null}
            </dt>
            <dd className="max-w-[52ch] pt-2 font-prose text-base leading-[1.7] text-ink-2">
              {term.long}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
