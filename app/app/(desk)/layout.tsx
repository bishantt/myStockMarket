import type { Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { PAPER, PAPER_DARK } from "@/lib/tokens";
import { THEME_COOKIE, normaliseTheme } from "@/lib/theme";
import { db } from "@/lib/db";
import { getLessonManifest } from "@/lib/academy";
import { ROUTE_ITEMS, type PaletteItem } from "@/lib/palette";
import { CommandPalette } from "@/components/CommandPalette";
import { RoomNav } from "@/components/desk/RoomNav";

/**
 * The Desk room.
 *
 * Desk and Academy are two rooms with distinct visual grammars, connected only by named
 * doorways (Research Report §9.1). The Desk is cool, dense, and tabular; the Academy is warm,
 * literary, and price-free. The reader should know which room they are in without reading a
 * label — so the room's background and status-bar colour are set here, at the layout, rather
 * than being sprinkled through pages.
 *
 * This route group adds no URL segment: `(desk)/page.tsx` is `/`.
 */

/**
 * The standalone PWA's status bar follows the room, and now the OS colour scheme (P6): a light and a
 * dark variant keyed on prefers-color-scheme. The manifest's theme_color stays light (install-time
 * only) — this is only the live status bar. The explicit Light/Dark toggle recolours the page via the
 * data-theme attribute; the status bar follows the OS, which is the honest default for chrome.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PAPER },
    { media: "(prefers-color-scheme: dark)", color: PAPER_DARK },
  ],
};

export default async function DeskLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The Desk theme rides in a cookie so the shell can stamp data-theme before paint (no flash).
  // Dark is Desk-only: this attribute lives on the Desk shell, never on the Academy.
  const theme = normaliseTheme((await cookies()).get(THEME_COOKIE)?.value);

  // The ⌘K palette index: fixed routes + every authored lesson + the watchlist's tickers.
  const lessons = getLessonManifest();
  const watchlist = await db.watchlistItem.findMany({ select: { symbol: true }, orderBy: { symbol: "asc" } });
  const paletteItems: PaletteItem[] = [
    ...ROUTE_ITEMS,
    ...lessons.map((l) => ({ kind: "lesson" as const, zone: "Academy" as const, label: l.title, href: `/academy/${l.slug}` })),
    ...watchlist.map((w) => ({ kind: "ticker" as const, zone: "Desk" as const, label: w.symbol, href: `/ticker/${w.symbol}` })),
  ];

  return (
    <div data-theme={theme} className="min-h-dvh bg-paper text-ink">
      <CommandPalette items={paletteItems} />
      <DeskNav />
      {/*
       * Max width 1360, 12-column grid, 20px gutters on the phone and 32px on the desktop
       * (plan §3.4). Below 768px this becomes the ritual column: one column, modules in
       * strict order 1 through 8.
       */}
      <main className="mx-auto max-w-[1360px] px-5 pb-16 desk:px-8">{children}</main>
    </div>
  );
}

/**
 * The shell's top bar. Interactive elements are ink plus an underline on hover, never colour:
 * petrol is reserved for focus and active states so that no navigation chrome can ever compete
 * with the semantic red/blue channel that deltas own (plan §3.3).
 */
function DeskNav() {
  return (
    <header className="border-b border-hairline">
      <nav
        aria-label="Rooms"
        className="mx-auto flex max-w-[1360px] items-center gap-4 px-5 py-3 desk:px-8"
      >
        <Link
          href="/"
          className="shrink-0 font-ui text-sm font-bold uppercase tracking-[0.08em]"
        >
          myStockMarket
        </Link>

        {/* The room links live in a scroll strip so a narrow phone scrolls the links, not the page. */}
        <RoomNav />
      </nav>
    </header>
  );
}
