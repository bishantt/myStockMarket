/**
 * academy-style.ts — the Academy's module hues.
 *
 * These paint the 4px bar down the side of each module card, and they are DECORATIVE ONLY. The
 * module's title sits immediately beside the bar and carries all of the information; a reader who
 * cannot distinguish these colours — or who cannot see them at all — loses precisely nothing. That
 * is the rule for every colour in this app, and it is why a bar like this is allowed to exist.
 *
 * The hues themselves are constrained twice over (§3.3, §5.6):
 *   · none of them sits in the reserved amber–orange region, where a chip would drown the
 *     verification-gate flag;
 *   · none of them is the accent, because indigo means "you can act here" and a decorative bar is
 *     not an affordance.
 *
 * They resolve through CSS custom properties rather than literals, so they follow the theme: each
 * has a Midnight twin in globals.css, and the same module reads as the same module in both.
 */
export const MODULE_HUE: Record<string, string> = {
  M0: "var(--color-module-foundations)",
  M1: "var(--color-module-foundations)",
  M2: "var(--color-module-risk)",
  M3: "var(--color-module-risk)",
  M4: "var(--color-module-structure)",
  M5: "var(--color-module-patterns)",
  M6: "var(--color-module-structure)",
};
