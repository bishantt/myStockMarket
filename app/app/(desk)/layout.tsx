import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";

import { db } from "@/lib/db";
import { getLessonManifest } from "@/lib/academy";
import { ROUTE_ITEMS, type PaletteItem } from "@/lib/palette";
import { AppWash } from "@/components/AppWash";
import { CommandPalette } from "@/components/CommandPalette";
import { PageContainer } from "@/components/PageContainer";
import { MarketState } from "@/components/desk/MarketState";
import { RoomNav } from "@/components/desk/RoomNav";
import { TabBar } from "@/components/desk/TabBar";
import { Wordmark } from "@/components/Wordmark";

/**
 * The Desk room.
 *
 * Desk and Academy remain two rooms connected by named doorways (Research Report §9.1) — but as of
 * the redesign they are no longer two palettes. One theme governs the whole app (D1) and one wash
 * paints both rooms (D4). What tells the reader which room they are in is the FURNITURE: the Desk
 * is dense, tabular, instrument-like; the Academy is solid paper, serif kickers, and air.
 *
 * `data-theme` used to be stamped here. It now lives on <html>, set by a pre-paint script in the
 * root layout, because the Academy has to theme too. This layout no longer reads the cookie at all.
 *
 * This route group adds no URL segment: `(desk)/page.tsx` is `/`.
 */

/**
 * The watchlist symbols for the ⌘K palette, or an empty list if the database cannot be reached.
 *
 * Wrapped, like every other read in this app: an unreachable table degrades one feature, it does
 * not take the page down. That rule was always the intent — but this particular read was NOT
 * wrapped, and it got away with it only because the layout used to call `cookies()`, which forced
 * the route dynamic and kept the query out of the build. Removing that cookie read (R2, so the
 * theme could live on <html>) made the Desk statically prerenderable, the query started running at
 * build time, and a build machine with no DATABASE_URL crashed on it.
 *
 * A degraded palette still finds every room and every lesson. It simply cannot jump to a ticker.
 */
async function watchlistSymbols(): Promise<string[]> {
  try {
    const rows = await db.watchlistItem.findMany({
      select: { symbol: true },
      orderBy: { symbol: "asc" },
    });
    return rows.map((row) => row.symbol);
  } catch (error) {
    console.error("DeskLayout: could not read the watchlist for the command palette", error);
    return [];
  }
}

export default async function DeskLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The ⌘K palette index: fixed routes + every authored lesson + the watchlist's tickers.
  const lessons = getLessonManifest();
  const watchlist = await watchlistSymbols();
  const paletteItems: PaletteItem[] = [
    ...ROUTE_ITEMS,
    ...lessons.map((l) => ({
      kind: "lesson" as const,
      zone: "Academy" as const,
      label: l.title,
      href: `/academy/${l.slug}`,
    })),
    ...watchlist.map((symbol) => ({
      kind: "ticker" as const,
      zone: "Desk" as const,
      label: symbol,
      href: `/ticker/${symbol}`,
    })),
  ];

  return (
    <div className="min-h-dvh text-ink">
      <AppWash />

      <div className="relative z-10">
        <CommandPalette items={paletteItems} />
        <DeskNav />

        {/*
         * The broadsheet container. The bottom padding clears the phone's tab bar plus its
         * safe-area inset — without it the last module hides behind the bar, which is the kind of
         * bug that only ever shows up on a real device.
         */}
        <PageContainer as="main" className="pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-16">
          {children}
        </PageContainer>

        <TabBar />
      </div>
    </div>
  );
}

/**
 * The shell's top bar — now sticky, and now glass.
 *
 * The accent appears here and almost nowhere else in the chrome, because indigo means "you can act
 * here". The market-state dot is pointedly NOT accent: it is status, not an affordance, and it
 * never pulses. A glowing live-status dot is urgency theatre, and session state is peripheral
 * information — so it sits quietly beside its own text label.
 */
function DeskNav() {
  return (
    <header className="surface-bar sticky top-0 z-30 border-b border-hairline pt-[env(safe-area-inset-top)]">
      <div className="bar-blur">
        <PageContainer as="nav" aria-label="Rooms" className="flex items-center gap-4 py-3">
          <Wordmark />

          {/* The room links are desktop-only. Phones navigate from the bottom tab bar (D2). */}
          <div className="hidden min-w-0 flex-1 md:block">
            <RoomNav />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <MarketState />

            {/* Settings leaves the phone tab bar and lives here, behind a gear (§4.2). */}
            <Link
              href="/settings"
              aria-label="Settings"
              className="flex size-11 items-center justify-center rounded-control text-muted transition-colors duration-(--duration-quick) hover:text-accent-deep md:size-auto md:p-1"
            >
              <SettingsIcon size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </PageContainer>
      </div>
    </header>
  );
}
