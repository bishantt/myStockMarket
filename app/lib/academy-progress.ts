/**
 * lib/academy-progress.ts — the M3 soft-gate logic (plan §7 P5 step 1/6).
 *
 * The Academy teaches risk before patterns. So the pattern-heavy modules (M4 "reading the chart" and
 * M5 "indicators and their evidence") carry a SOFT gate: until the risk module M3 is complete, a
 * pattern lesson shows a short notice suggesting the reader do M3 first. It is a nudge, never a lock —
 * the reader can always proceed. Completion is tracked per lesson slug (lesson_progress); this module
 * only decides, given the set of completed slugs, whether a lesson is gated.
 */

/** The four M3 lessons; reading all of them lifts the gate (plan Appendix H). */
export const M3_SLUGS = [
  "position-sizing-before-patterns",
  "stops-and-invalidation",
  "expectancy-and-drawdown-math",
  "why-base-rates-beat-anecdotes",
];

/** The modules whose lessons are soft-gated behind M3. */
export const GATED_MODULES = ["M4", "M5"];

/** True when every M3 lesson has been read. */
export function isM3Complete(completedSlugs: string[]): boolean {
  const done = new Set(completedSlugs);
  return M3_SLUGS.every((slug) => done.has(slug));
}

/** True when a lesson in `module` should show the soft gate given what the reader has completed. */
export function isLessonSoftGated(module: string, completedSlugs: string[]): boolean {
  return GATED_MODULES.includes(module) && !isM3Complete(completedSlugs);
}
