/**
 * lib/palette.ts — the ⌘K command palette's index and search (plan §7 P6 step 5).
 *
 * The palette lets the reader jump to a route, a lesson, or a ticker from anywhere. Search is
 * deliberately simple and predictable — a case-insensitive substring match, ranked so a prefix beats
 * a mid-string hit — because a command palette that surprises you is worse than none. Pure, so the
 * ranking is unit-tested; the client component renders the results and the server supplies the index.
 */

export type PaletteZone = "Desk" | "Academy";
export type PaletteKind = "route" | "lesson" | "ticker";

/** One jump target, zone-badged so the reader sees which room it lives in. */
export type PaletteItem = {
  kind: PaletteKind;
  zone: PaletteZone;
  label: string;
  href: string;
};

/** The fixed Desk routes always in the index. */
export const ROUTE_ITEMS: PaletteItem[] = [
  { kind: "route", zone: "Desk", label: "Desk", href: "/" },
  { kind: "route", zone: "Desk", label: "Scans", href: "/scans" },
  { kind: "route", zone: "Desk", label: "Paper desk", href: "/paper" },
  { kind: "route", zone: "Desk", label: "Track record", href: "/track-record" },
  { kind: "route", zone: "Desk", label: "Settings", href: "/settings" },
  { kind: "route", zone: "Academy", label: "The Academy", href: "/academy" },
  { kind: "route", zone: "Academy", label: "Glossary", href: "/academy/glossary" },
  { kind: "route", zone: "Academy", label: "Review", href: "/academy/review" },
];

const MAX_RESULTS = 12;

/**
 * Search the palette. An empty query returns the whole index (capped); otherwise every item whose
 * label contains the query (case-insensitive), ranked so prefix matches come first, then by label
 * length (shorter = tighter match), stable within a rank.
 */
export function searchPalette(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return items.slice(0, MAX_RESULTS);

  const scored = items
    .map((item, index) => {
      const label = item.label.toLowerCase();
      const at = label.indexOf(q);
      return { item, index, at };
    })
    .filter((s) => s.at !== -1)
    .sort((a, b) => {
      const aPrefix = a.at === 0 ? 0 : 1;
      const bPrefix = b.at === 0 ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      if (a.item.label.length !== b.item.label.length) return a.item.label.length - b.item.label.length;
      return a.index - b.index;
    });

  return scored.slice(0, MAX_RESULTS).map((s) => s.item);
}
