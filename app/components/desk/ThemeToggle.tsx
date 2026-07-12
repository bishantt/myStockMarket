"use client";

import { useSyncExternalStore } from "react";

import { setTheme } from "@/app/(desk)/settings/theme-actions";
import { THEMES, normaliseTheme, type Theme } from "@/lib/theme";
import { cx } from "@/lib/cx";

/**
 * ThemeToggle — pick the app's theme (D1).
 *
 * Three choices: System (follow the OS), Light ("Morning"), Dark ("Midnight"). The setting governs
 * the ENTIRE app now, the Academy included — the old "dark is Desk-only" rule was repealed by the
 * user on 2026-07-12. The rooms still feel distinct, but through structure and pace, never palette.
 *
 * WHY THIS READS THE DOM INSTEAD OF A COOKIE ON THE SERVER (§4.7, §5.3 P-1).
 *
 * The settings page used to learn the current theme with `cookies()`. That single call was the only
 * thing forcing the whole route to re-render on every visit — a 517ms wait, to find out which of
 * three buttons should look pressed. So the read moved here, to the browser.
 *
 * It is the SAME source of truth, not a substitute for it: the pre-paint script in the root layout
 * already reads that very cookie and stamps it on <html data-theme> before the first pixel is
 * painted, and it stamps the raw preference — "system" included, not just the resolved light/dark —
 * which is exactly what this control needs to know.
 *
 * The attribute IS the state, so the component subscribes to it rather than keeping a copy. On the
 * server there is no document to ask, so the server snapshot is `null` — nothing pressed — and the
 * browser fills it in on its first render. No copy to fall out of step, and no hydration mismatch.
 *
 * Picking a theme also STAMPS the attribute, and that is a small repair rather than a flourish. The
 * buttons are plain forms posting a server action, which sets the cookie — but the cookie is only
 * ever read by the pre-paint script, which runs at page LOAD. So before this, choosing Midnight set
 * the cookie, marked the button pressed, and left the app sitting there in Morning until the next
 * full page load. Now the same click writes the attribute the whole token sheet hangs off, so the
 * app changes theme when you ask it to.
 */

const LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

/** Watch <html data-theme>. It is set by the pre-paint script, and by the buttons below. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const current = useSyncExternalStore<Theme | null>(
    subscribe,
    () => normaliseTheme(document.documentElement.dataset.theme),
    () => null, // the server cannot know, and a guess would be a flash of the wrong button
  );

  return (
    <div className="flex flex-wrap gap-1 pt-3" role="group" aria-label="Theme">
      {THEMES.map((theme) => {
        const active = theme === current;
        return (
          <form key={theme} action={setTheme}>
            <input type="hidden" name="theme" value={theme} />
            <button
              type="submit"
              aria-pressed={active}
              // Apply the choice to the live document as well as posting it. The server action
              // writes the cookie for next time; this is what themes the app NOW. The subscription
              // above then re-renders this control, so the pressed state follows from the same
              // attribute the rest of the app is reading — one source of truth, not two.
              onClick={() => {
                document.documentElement.dataset.theme = theme;
              }}
              className={cx(
                "min-h-11 rounded-control border px-4 py-1.5 font-ui text-sm",
                "transition-colors duration-(--duration-quick) ease-(--ease-quiet)",
                active
                  ? "border-transparent bg-accent-soft font-semibold text-accent-deep"
                  : "border-hairline text-ink-2 hover:border-hairline-strong",
              )}
            >
              {LABELS[theme]}
            </button>
          </form>
        );
      })}
    </div>
  );
}
