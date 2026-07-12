"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GraduationCap, LineChart, Newspaper, NotebookPen, ScanSearch } from "lucide-react";

import { activeRoomHref } from "@/lib/nav";
import { cx } from "@/lib/cx";

/**
 * TabBar — the phone's navigation (D2). Below `md` only; desktop keeps the restrained top bar.
 *
 * Five rooms, always in the same place, never hiding on scroll. Position is trust: a bar that
 * slides away when you scroll makes the reader chase it, and chasing is a small anxiety this
 * product has no reason to sell.
 *
 * THE ONE EXCEPTION — and it is the single most-missed bug in mobile web apps:
 *
 * iOS does not resize the layout viewport when the soft keyboard opens. A `position: fixed;
 * bottom: 0` element stays pinned to the *layout* viewport, which the keyboard now covers — so the
 * bar does not sit under the keyboard, it floats in the middle of the screen, on top of the form
 * the reader is typing into. The fix is to watch `visualViewport` (which DOES shrink) and hide the
 * bar while the keyboard is up. It hides rather than animating: a bar sliding away under a
 * keyboard is motion nobody asked for.
 *
 * Settings is deliberately not a tab. Five rooms fit a 375px row with 44px targets; six do not,
 * and Settings is the thing a reader visits monthly, not daily. It lives behind a gear in the top
 * bar (§4.2).
 */

/** The five rooms, in bar order. Icons are functional, never decorative. */
const TABS = [
  { href: "/", label: "Desk", Icon: Newspaper },
  { href: "/scans", label: "Scans", Icon: ScanSearch },
  { href: "/paper", label: "Paper", Icon: NotebookPen },
  { href: "/track-record", label: "Track", Icon: LineChart },
  { href: "/academy", label: "Academy", Icon: GraduationCap },
] as const;

/**
 * How much the visual viewport has to shrink before we call it a keyboard.
 *
 * Small shrinkages happen for innocent reasons — a collapsing URL bar, a scroll-linked toolbar —
 * and hiding the nav for those would be a flicker. No soft keyboard is under 150px tall.
 */
const KEYBOARD_THRESHOLD_PX = 150;

/** True while the soft keyboard is covering the layout viewport. */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const check = () => setOpen(window.innerHeight - viewport.height > KEYBOARD_THRESHOLD_PX);
    check();

    viewport.addEventListener("resize", check);
    return () => viewport.removeEventListener("resize", check);
  }, []);

  return open;
}

export function TabBar() {
  const pathname = usePathname();
  const active = activeRoomHref(pathname);
  const keyboardOpen = useKeyboardOpen();

  return (
    <nav
      aria-label="Rooms"
      data-testid="tab-bar"
      hidden={keyboardOpen}
      className={cx(
        "surface-bar fixed inset-x-0 bottom-0 z-30 border-t border-hairline md:hidden",
        // The safe-area insets, all four sides that matter. Left/right are not paranoia: a browser
        // tab rotates even though the installed app is portrait-locked, and a landscape notch eats
        // the outer tabs whole.
        "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
      )}
    >
      {/* The blur lives on an inner element so iOS clips it to the bar's edges (§3.4). */}
      <ul className="bar-blur flex items-stretch justify-around">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = href === active;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 py-2",
                  "transition-colors duration-(--duration-quick) ease-(--ease-quiet)",
                  isActive ? "text-accent-deep" : "text-muted",
                )}
              >
                {/* The active indicator is a dot above the icon — position, not colour alone. */}
                <span
                  aria-hidden="true"
                  className={cx(
                    "h-[3px] w-3 rounded-pill",
                    isActive ? "bg-accent-deep" : "bg-transparent",
                  )}
                />
                <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                <span className="font-ui text-2xs">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
