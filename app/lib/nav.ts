/**
 * lib/nav.ts — the Desk's room navigation model and active-room logic (plan §3.8, mobile fix).
 *
 * The top bar links to the app's rooms. Which one is "current" is computed from the pathname, not
 * hardcoded, so the selection moves as the reader does — /scans lights Scans, a lesson lights
 * Academy, a ticker page stays on the Desk. The matching is pure so it is unit-tested, and the nav
 * component (RoomNav) simply renders the result.
 */

export type Room = { label: string; href: string };

/** The rooms, in bar order. The Desk is "/" (the ritual); the rest are their own routes. */
export const ROOMS: Room[] = [
  { label: "Desk", href: "/" },
  { label: "Scans", href: "/scans" },
  { label: "Paper", href: "/paper" },
  { label: "Track record", href: "/track-record" },
  { label: "Academy", href: "/academy" },
  { label: "Settings", href: "/settings" },
];

/**
 * The href of the room a path belongs to. A sub-route belongs to its room's section: /ticker/* is
 * still the Desk (the drill), /academy/* is the Academy. The Desk matches only the exact root or a
 * ticker drill, so it does not greedily claim every path.
 */
export function activeRoomHref(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/ticker")) return "/";
  // Longest specific prefixes first so /track-record is not shadowed by anything shorter.
  const ordered = ["/track-record", "/scans", "/paper", "/academy", "/settings"];
  for (const href of ordered) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return href;
  }
  return "/";
}
