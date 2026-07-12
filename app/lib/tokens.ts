/**
 * tokens.ts — the ONE sanctioned place outside globals.css where a colour may appear as a
 * literal string, and the reason it has to exist.
 *
 * The web app manifest and the browser status-bar colour (`theme-color`) are both consumed by the
 * operating system, not by the page. Neither can read a CSS custom property: the manifest is static
 * JSON read at install time, and the status bar is painted before any stylesheet is parsed. So these
 * values have to be duplicated here as plain strings.
 *
 * Each must stay byte-identical to its counterpart in globals.css. The anti-drift grep (§3.10,
 * rule 1) allows hex colours in exactly two files: globals.css and this one. If you are reaching
 * for a colour anywhere else, the answer is a Tailwind token, not a new constant here.
 *
 * There is no ACADEMY_BG any more. One theme governs the whole app (D1) and one palette paints it
 * (D4): the Academy reads the same sheet, and its identity is structural, not chromatic.
 */

/** The page plane in "Morning" (light). Mirrors `--color-paper`. */
export const PAPER = "#f9f8ff";

/** The page plane in "Midnight" (dark). Mirrors the `[data-theme="dark"]` `--color-paper`. */
export const PAPER_DARK = "#14121f";
