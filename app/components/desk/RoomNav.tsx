"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROOMS, activeRoomHref } from "@/lib/nav";
import { cx } from "@/lib/cx";

/**
 * RoomNav — the top bar's room links, with the current room lit from the route (plan §3.8, mobile fix).
 *
 * Two things this fixes: the selection now follows the reader (usePathname → activeRoomHref), and the
 * links live in a horizontal scroll STRIP so a narrow phone scrolls the links, never the whole page.
 * Interactive elements stay ink + underline; petrol is reserved for hover/focus (§3.3).
 */
export function RoomNav() {
  const pathname = usePathname();
  const active = activeRoomHref(pathname);

  return (
    <ul className="no-scrollbar flex min-w-0 flex-1 items-center gap-5 overflow-x-auto whitespace-nowrap font-ui text-xs uppercase tracking-[0.06em]">
      {ROOMS.map((room) => {
        const isActive = room.href === active;
        return (
          <li key={room.href} className="shrink-0">
            <Link
              href={room.href}
              aria-current={isActive ? "page" : undefined}
              className={cx(
                "border-b-2 pb-0.5",
                isActive ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-accent",
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
