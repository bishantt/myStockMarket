import { setTheme } from "@/app/(desk)/settings/theme-actions";
import { THEMES, type Theme } from "@/lib/theme";
import { cx } from "@/lib/cx";

/**
 * ThemeToggle — pick the Desk's theme (plan §7 P6 step 6).
 *
 * Three choices: System (follow the OS), Light, Dark. Dark is Desk-only — the Academy stays light so
 * the room switch is always felt. A plain form per option posting to the cookie action; the current
 * choice reads as the active, ink-filled control. No client JS needed.
 */

const LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

export function ThemeToggle({ current }: { current: Theme }) {
  return (
    <div className="flex flex-wrap gap-2 pt-3" role="group" aria-label="Desk theme">
      {THEMES.map((theme) => {
        const active = theme === current;
        return (
          <form key={theme} action={setTheme}>
            <input type="hidden" name="theme" value={theme} />
            <button
              type="submit"
              aria-pressed={active}
              className={cx(
                "rounded-edge border px-3 py-1.5 font-ui text-xs uppercase tracking-[0.05em]",
                active
                  ? "border-ink bg-ink text-surface"
                  : "border-hairline text-ink hover:border-accent",
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
