/**
 * lib/academy.ts — the Academy lesson manifest (plan Appendix H, P5).
 *
 * The full curriculum (25 contractual slugs) ships as filesystem MDX lessons in P5. Until then the
 * manifest is intentionally EMPTY: a briefing's learning_link_slug is validated against it at
 * render, and because nothing matches yet, early briefs carry no Learn doorway — by design, not by
 * error (plan P3 step 4). When the lessons land, their slugs populate LESSON_SLUGS and the doorways
 * light up with no change to the briefing pipeline.
 */

/** The known Academy lesson slugs. Empty until P5; the 25 contractual slugs (Appendix H) fill it. */
export const LESSON_SLUGS: ReadonlySet<string> = new Set<string>();

/** True if a briefing's learning-link slug names a lesson that exists — the doorway gate. */
export function isKnownLesson(slug: string): boolean {
  return LESSON_SLUGS.has(slug);
}
