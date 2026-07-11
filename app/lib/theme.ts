/**
 * lib/theme.ts — the Desk theme preference (plan §7 P6 step 6).
 *
 * Dark mode is Desk-only and opt-in: the user picks System (follow the OS), Light, or Dark in
 * settings. The choice rides in a cookie so the server render can stamp `data-theme` on the Desk
 * shell before paint (no flash). This module is pure — the cookie read/write happens at the edges
 * (the layout and the settings action) so the vocabulary stays testable and in one place.
 */

export const THEME_COOKIE = "desk-theme";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Coerce an arbitrary cookie value to a valid theme, defaulting to "system". */
export function normaliseTheme(value: string | undefined | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}
