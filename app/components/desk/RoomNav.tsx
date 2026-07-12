"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROOMS, activeRoomHref } from "@/lib/nav";
import { cx } from "@/lib/cx";

/**
 * RoomNav — the desktop top bar's room links, with the current room lit from the route.
 *
 * The active-room logic (lib/nav.ts) is unchanged and still pure: the selection follows the reader
 * rather than being hardcoded, so a ticker drill keeps the Desk lit and a lesson keeps the Academy
 * lit. Only the clothes changed — the links are rounded pills now, and the active one carries an
 * accent wash instead of an ink underline.
 *
 * This renders on desktop only. Phones navigate from the bottom tab bar (D2), so the old horizontal
 * scroll strip — which was a workaround for a nav that did not fit — is gone entirely.
 */
export function RoomNav() {
  const pathname = usePathname();
  const active = activeRoomHref(pathname);

  return (
    <ul className="flex min-w-0 items-center gap-1 font-ui text-sm">
      {ROOMS.filter((room) => room.href !== "/settings").map((room) => {
        const isActive = room.href === active;
        return (
          <li key={room.href} className="shrink-0">
            <Link
              href={room.href}
              aria-current={isActive ? "page" : undefined}
              className={cx(
                "block rounded-control px-3 py-1.5",
                "transition-colors duration-(--duration-quick) ease-(--ease-quiet)",
                isActive
                  ? "bg-accent-soft font-semibold text-accent-deep"
                  : "text-ink-2 hover:text-accent-deep",
              )}
            >
              {room.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
