import Link from "next/link";

import { MODULE_TITLES, getLessonManifest, type LessonMeta } from "@/lib/academy";

/**
 * /academy — the curriculum map (plan §9.3, P5 step 1).
 *
 * The Academy's front page: the modules in order, each with its authored lessons and reading time.
 * It grows as lessons land — an honest, incremental curriculum, not a wall of "coming soon". A
 * lesson links straight to its reading; the room is warm and price-free by design.
 */
export default function AcademyIndex() {
  const lessons = getLessonManifest();
  const byModule = groupByModule(lessons);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-ui text-2xl font-bold uppercase tracking-[0.04em] font-stretch-[110%] text-ink">
          The Academy
        </h1>
        <p className="max-w-[62ch] pt-3 font-prose text-prose text-ink-2">
          Short, honest lessons on how markets actually behave — and how to read the numbers the Desk
          shows you. Every myth-versus-evidence lesson cites the research it rests on. No live prices,
          no hype; three to five minutes each.
        </p>
      </header>

      {lessons.length === 0 ? (
        <p className="font-ui text-sm text-muted">Lessons are being written — check back soon.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(byModule).map(([module, moduleLessons]) => (
            <section key={module}>
              <h2 className="font-ui text-xs font-bold uppercase tracking-[0.07em] text-ink">
                {module} · {MODULE_TITLES[module] ?? module}
              </h2>
              <div className="mt-2 h-px bg-hairline" />
              <ul className="pt-3">
                {moduleLessons.map((lesson) => (
                  <li key={lesson.slug} className="border-b border-hairline last:border-b-0">
                    <Link
                      href={`/academy/${lesson.slug}`}
                      className="flex items-baseline justify-between gap-4 py-2.5 hover:text-accent"
                    >
                      <span className="font-prose text-base text-ink">{lesson.title}</span>
                      <span className="shrink-0 font-mono text-2xs text-muted">{lesson.minutes} min</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByModule(lessons: LessonMeta[]): Record<string, LessonMeta[]> {
  const groups: Record<string, LessonMeta[]> = {};
  for (const lesson of lessons) (groups[lesson.module] ??= []).push(lesson);
  return groups;
}
