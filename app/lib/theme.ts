/**
 * lib/theme.ts — the app's theme preference, and the script that applies it before the first paint.
 *
 * ONE THEME GOVERNS THE WHOLE APP (D1). Dark means everything is dark — Desk, Academy, Track
 * Record, Scans, Paper, Settings, login. The old "dark is Desk-only, the Academy stays light" rule
 * was repealed by the user on 2026-07-12; the rooms still feel different, but through typography,
 * spacing, density and pace, never through different palettes.
 *
 * The mechanism matters as much as the rule. `data-theme` is stamped on <html> by a tiny inline
 * script in the root layout, NOT by a server-side cookie read. A `cookies()` call in the root
 * layout would opt every route in the app into dynamic rendering — including /login and /offline,
 * which are `force-static` precisely so the service worker can precache them. So the theme is read
 * from `document.cookie` in a blocking script in <head>: it runs before the first paint, there is
 * no flash, and every static route stays static.
 */

export const THEME_COOKIE = "msm-theme";

/**
 * A year — a theme is a preference, not a session. Both writers of the cookie use this: the Settings
 * server action (theme-actions.ts) and the top-bar one-tap toggle, which writes it client-side so a
 * reader offline in the PWA can still change theme without a round trip that would fail.
 */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Coerce an arbitrary cookie value to a valid theme, defaulting to "system". */
export function normaliseTheme(value: string | undefined | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

/**
 * The theme one tap on the top-bar toggle should produce (CC3, Part 4.2).
 *
 * The toggle is a two-state control — Light ↔ Dark — with System reachable only from Settings. It
 * flips the RESOLVED appearance, not the raw preference: "system" is resolved against the OS first,
 * so a reader on system-follows-a-dark-OS who taps once gets explicit light (the opposite of what
 * they see), never dark again. Pure by construction: the OS preference is passed in, so the browser
 * reads `matchMedia` and this function stays testable.
 */
export function nextTheme(current: Theme, prefersDark: boolean): "light" | "dark" {
  const showingDark = current === "dark" || (current === "system" && prefersDark);
  return showingDark ? "light" : "dark";
}

/**
 * The pre-paint script, as a string, for the root layout to inline in <head>.
 *
 * It does two things, in this order:
 *
 *  1. Stamps `data-theme` on <html> from the cookie. Every token in globals.css hangs off that
 *     attribute, so the whole app is themed by the time the first pixel is painted.
 *
 *  2. Fixes the status-bar colour. Next renders a `theme-color` media pair (light/dark) that
 *     follows the OS — which is right for "system" and WRONG for an explicit choice: a reader who
 *     picked Midnight on a light-mode phone would get a Midnight app under a bone-white status
 *     bar. So when the theme is explicit, the media pair is replaced with a single meta carrying
 *     the chosen paper. On "system" the pair is left exactly as the server rendered it.
 *
 * The colours are interpolated from lib/tokens.ts, which is the one place outside globals.css
 * allowed to hold a hex — the OS reads these before any stylesheet is parsed.
 *
 * It is wrapped in try/catch on purpose: this script runs before anything else, and a thrown error
 * here would leave the page unstyled. A cookie the browser will not hand over is not worth a blank
 * app; the untouched default (system) is a perfectly good answer.
 */
export function themeScript(paperLight: string, paperDark: string): string {
  return `
(function () {
  try {
    var m = document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]*)/);
    var t = m ? decodeURIComponent(m[1]) : "system";
    if (t !== "light" && t !== "dark" && t !== "system") t = "system";
    document.documentElement.dataset.theme = t;

    if (t !== "system") {
      var dark = t === "dark";
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (el) { el.remove(); });
      var meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("content", dark ? "${paperDark}" : "${paperLight}");
      document.head.appendChild(meta);
    }
  } catch (e) {}
})();
`.trim();
}
