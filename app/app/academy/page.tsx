import Link from "next/link";
import { Check } from "lucide-react";

import { MODULE_TITLES, getLessonManifest, type LessonMeta } from "@/lib/academy";
import { GATED_MODULES, isM3Complete } from "@/lib/academy-progress";
import { MODULE_HUE } from "@/lib/academy-style";
import { Surface } from "@/components/Surface";
import { copy } from "@/lib/copy";
import { db } from "@/lib/db";

/**
 * /academy — the curriculum map, and the clearest statement of what the Academy IS.
 *
 * The rooms share one palette and one theme now (D1/D4). The Academy's old warm-cream page is gone,
 * and with it the easiest way to say "you are somewhere else". So the room switch has to be carried
 * entirely by the furniture — and it is:
 *
 *   · **solid paper cards** — no glass, no blur, no shadow. The Desk's material says "instrument";
 *     this one says "book". In Midnight the same move reads as matte page against glass panel.
 *   · **serif kickers** instead of numbered terminal mastheads. The Desk counts its modules 01–08
 *     because it is a routine you walk in order. A reading room does not number its furniture.
 *   · **reading typography** — a longer line, a taller line-height, and more air between things
 *     than the Desk would ever allow.
 *
 * Same light. Different furniture. That is the whole thesis of the one-palette decision, and this
 * page is where it either works or it does not.
 */
export const dynamic = "force-dynamic";

export default async function AcademyIndex() {
  const lessons = getLessonManifest();
  const byModule = groupByModule(lessons);
  const completed = new Set(
    (await db.lessonProgress.findMany({ select: { slug: true } })).map((r) => r.slug),
  );
  const m3Done = isM3Complete([...completed]);

  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-[65ch]">
        <h1 className="font-display text-display font-bold text-ink">The Academy</h1>
        <p className="pt-4 font-prose text-prose leading-[1.7] text-ink-2">
          Short, honest lessons on how markets actually behave — and how to read the numbers the Desk
          shows you. Every myth-versus-evidence lesson cites the research it rests on. No live
          prices, no hype; three to five minutes each.
        </p>
        <nav className="flex gap-5 pt-5" aria-label="Academy sections">
          <Link
            href="/academy/glossary"
            className="font-ui text-sm text-accent-deep transition-colors duration-(--duration-quick) hover:underline"
          >
            Glossary →
          </Link>
          <Link
            href="/academy/review"
            className="font-ui text-sm text-accent-deep transition-colors duration-(--duration-quick) hover:underline"
          >
            Review →
          </Link>
        </nav>
      </header>

      {lessons.length === 0 ? (
        <p className="font-ui text-sm text-muted">Lessons are being written — check back soon.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(byModule).map(([moduleKey, moduleLessons]) => {
            const allRead = moduleLessons.every((l) => completed.has(l.slug));
            const gated = GATED_MODULES.includes(moduleKey) && !m3Done;

            return (
              <Surface key={moduleKey} level="solid" as="section" className="overflow-hidden">
                <div className="flex">
                  {/*
                   * The 4px category bar. DECORATIVE ONLY — the module's title sits right beside it
                   * and carries the information. Colour is never the sole encoding of anything in
                   * this app, and a reader who cannot see this bar loses nothing.
                   */}
                  <div
                    aria-hidden="true"
                    className="w-1 shrink-0"
                    style={{ background: MODULE_HUE[moduleKey] ?? "var(--color-hairline)" }}
                  />

                  <div className="min-w-0 flex-1 p-5 desk:p-6">
                    {/* The serif kicker — the Academy's answer to the Desk's numbered masthead. */}
                    <div className="flex flex-wrap items-baseline gap-3 border-b border-hairline pb-3">
                      <h2 className="font-prose text-title italic text-ink">
                        <span className="font-mono text-sm not-italic text-muted">{moduleKey}</span>{" "}
                        {MODULE_TITLES[moduleKey] ?? moduleKey}
                      </h2>
                      {allRead ? (
                        <span className="inline-flex items-center gap-1 font-ui text-2xs text-muted">
                          <Check size={12} strokeWidth={2} aria-hidden="true" />
                          read
                        </span>
                      ) : null}
                      {gated ? (
                        <span className="font-ui text-2xs text-muted">
                          — finish M3 first (suggested)
                        </span>
                      ) : null}
                    </div>

                    <ul>
                      {moduleLessons.map((lesson) => (
                        <li key={lesson.slug} className="border-b border-hairline last:border-b-0">
                          <Link
                            href={`/academy/${lesson.slug}`}
                            className="flex items-baseline justify-between gap-4 py-3 transition-colors duration-(--duration-quick) ease-(--ease-quiet) hover:text-accent-deep"
                          >
                            <span className="flex items-baseline gap-2 font-prose text-base text-ink">
                              {completed.has(lesson.slug) ? (
                                <Check
                                  size={14}
                                  strokeWidth={2}
                                  aria-label="read"
                                  className="shrink-0 translate-y-0.5 text-accent-deep"
                                />
                              ) : null}
                              {lesson.title}
                            </span>
                            <span className="shrink-0 font-mono text-2xs text-muted">
                              {lesson.minutes} min
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Surface>
            );
          })}
        </div>
      )}

      {/*
       * The closing pull quote. ONE fixed quote, never rotating: a quote that changes on every visit
       * is a slot machine, and this room does not have one.
       */}
      <Surface level="solid" as="aside" className="max-w-[62ch] p-6 desk:p-8">
        <blockquote className="font-prose text-lg italic leading-[1.6] text-ink-2">
          {copy.academy.quote}
        </blockquote>
      </Surface>
    </div>
  );
}

function groupByModule(lessons: LessonMeta[]): Record<string, LessonMeta[]> {
  const groups: Record<string, LessonMeta[]> = {};
  for (const lesson of lessons) (groups[lesson.module] ??= []).push(lesson);
  return groups;
}
