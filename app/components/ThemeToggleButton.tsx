"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { copy, fill } from "@/lib/copy";
import { cx } from "@/lib/cx";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  nextTheme,
  normaliseTheme,
  type Theme,
} from "@/lib/theme";

/**
 * ThemeToggleButton — one tap flips Light ↔ Dark, in every top bar, both zones (CC3, Part 4.2).
 *
 * It is the FAST path; Settings keeps the canonical three-way System/Light/Dark control. So this
 * button never lands on "system" — it reads what the reader is currently seeing and flips it.
 *
 * WHY IT WRITES THE COOKIE IN THE BROWSER, not through the Settings server action. The theme is a
 * pure client preference: the only thing that ever reads the cookie is the pre-paint script in the
 * root layout (lib/theme.ts), which parses `document.cookie` before the first paint. Writing it here
 * — the same cookie, the same name, the same lifetime — means a reader offline in the installed PWA
 * can still change theme, where a server-action round trip would simply fail. (Settings keeps its
 * action, unchanged; the two writers share THEME_COOKIE and THEME_COOKIE_MAX_AGE.)
 *
 * The current theme and the OS preference are both read from OUTSIDE React, so both come through
 * useSyncExternalStore: the server snapshot is the honest "I cannot know" (null / false), and the
 * browser fills in the truth on its first render without a hydration mismatch — the same pattern the
 * Settings ThemeToggle uses to decide which button looks pressed.
 */

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Watch <html data-theme> — stamped by the pre-paint script and by every theme write. */
function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Watch the OS colour-scheme preference — it only decides the flip when the theme is "system". */
function subscribeOsScheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const readTheme = (): Theme => normaliseTheme(document.documentElement.dataset.theme);
const readPrefersDark = (): boolean => window.matchMedia(DARK_QUERY).matches;

export function ThemeToggleButton() {
  const current = useSyncExternalStore<Theme | null>(subscribeTheme, readTheme, () => null);
  const prefersDark = useSyncExternalStore(subscribeOsScheme, readPrefersDark, () => false);

  // Where one tap lands. Before hydration `current` is null (the server cannot know) — treat that as
  // the default "system"; the browser corrects it on its first render.
  const target = nextTheme(current ?? "system", prefersDark);

  function toggle() {
    // Re-read the live document at click time, so a tap that raced hydration still flips what is
    // actually on screen rather than the server's guess.
    const to = nextTheme(readTheme(), readPrefersDark());
    document.documentElement.dataset.theme = to; // theme the app NOW — the whole token sheet hangs off this
    document.cookie = `${THEME_COOKIE}=${to};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Name the DESTINATION, so the spoken label and the icon say the same thing.
      aria-label={fill(copy.theme.toggleAria, { mode: target })}
      className={cx(
        "flex size-11 items-center justify-center rounded-control text-muted",
        "transition-colors duration-(--duration-quick) hover:text-accent-deep md:size-auto md:p-1",
      )}
    >
      {target === "dark" ? (
        <Moon size={16} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Sun size={16} strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}
