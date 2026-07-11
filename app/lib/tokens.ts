/**
 * tokens.ts — the ONE sanctioned place outside globals.css where a colour may appear as a
 * literal string, and the reason it has to exist.
 *
 * The web app manifest and the browser status-bar colour (Next's `viewport.themeColor`) are
 * both consumed by the operating system, not by the page. Neither can read a CSS custom
 * property: the manifest is static JSON read at install time, and the status bar is painted
 * before any stylesheet is parsed. So these two values have to be duplicated here as plain
 * strings.
 *
 * Every one of them must stay byte-identical to its counterpart in globals.css. The
 * anti-drift grep (plan §3.10, rule 1) allows hex colours in exactly two files: globals.css
 * and this one. If you are reaching for a colour anywhere else, the answer is a Tailwind
 * token, not a new constant here.
 */

/** The Desk room's page plane. Mirrors `--color-desk-bg`. Cool bone. */
export const DESK_BG = "#f4f5f3";

/** The dark Desk's page plane (P6). Mirrors the `[data-theme="dark"]` `--color-desk-bg`. */
export const DESK_BG_DARK = "#131412";

/** The Academy room's paper. Mirrors `--color-academy-bg`. Warm. */
export const ACADEMY_BG = "#faf6ef";
