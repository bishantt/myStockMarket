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
      <Link href="/academy" className="font-ui text-xs uppercase tracking-[0.06em] text-ink-2 hover:text-accent">
        ← All lessons
      </Link>

      <header className="pt-4">
        <h1 className="font-prose text-2xl text-ink">Glossary</h1>
        <p className="max-w-[62ch] pt-2 font-prose text-base text-ink-2">
          The {terms.length} terms the Desk uses, defined plainly. Each links to the lesson that goes
          deeper, where one exists.
        </p>
      </header>

      <dl className="pt-6">
        {terms.map((term) => (
          <div key={term.key} className="max-w-[65ch] border-t border-hairline py-4 first:border-t-0">
            <dt className="flex flex-wrap items-baseline gap-3">
              <span className="font-ui text-sm font-semibold uppercase tracking-[0.04em] text-ink">
                {term.term}
              </span>
              {term.lesson ? (
                <Link
                  href={`/academy/${term.lesson}`}
                  className="font-ui text-2xs uppercase tracking-[0.06em] text-accent hover:underline"
                >
                  Lesson →
                </Link>
              ) : null}
            </dt>
            <dd className="pt-1.5 font-prose text-base text-ink-2">{term.long}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
