import { setTheme } from "@/app/(desk)/settings/theme-actions";
import { THEMES, type Theme } from "@/lib/theme";
import { cx } from "@/lib/cx";

/**
 * ThemeToggle — pick the app's theme (D1).
 *
 * Three choices: System (follow the OS), Light ("Morning"), Dark ("Midnight"). The setting governs
 * the ENTIRE app now, the Academy included — the old "dark is Desk-only" rule was repealed by the
 * user on 2026-07-12. The rooms still feel distinct, but through structure and pace, never palette.
 *
 * A plain form per option, posting to the cookie action. No client JavaScript: the choice is a
 * cookie, and the pre-paint script in the root layout applies it before the next paint.
 */

const LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

export function ThemeToggle({ current }: { current: Theme }) {
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
