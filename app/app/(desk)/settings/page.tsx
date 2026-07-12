import { db } from "@/lib/db";
import { Surface } from "@/components/Surface";
import { FOCUS_CAP } from "@/lib/watchlist";
import { ThemeToggle } from "@/components/desk/ThemeToggle";
import { AddWatchlistForm } from "./AddWatchlistForm";
import { WatchlistManager, type ManagedItem } from "./WatchlistManager";

/**
 * /settings — watchlist management (plan §9.2, the route table lists Watchlist management here).
 *
 * The Desk shows the focus watchlist read-only; this is where the user curates it: add a name with
 * the reason they are watching it, mark up to three as focus, remove what no longer earns a slot.
 * A server component reads the current list; the writes happen through the server actions in
 * actions.ts, which the two client components below drive.
 */

/**
 * Served from the cache (§5.3 P-1), busted by the settings actions on every write.
 *
 * This route's ONLY reason for re-rendering on every visit was a server-side cookie read, used to
 * find out which of three theme buttons should look pressed. That one line cost the reader 517ms per
 * tap. The theme control now reads the same value from `<html data-theme>` in the browser (§4.7) —
 * the pre-paint script puts it there before the first paint — and the page is free. No request-time
 * input is read here any more, which is precisely what makes the route cacheable.
 */
export const revalidate = 600;

/**
 * The managed watchlist, or an empty list if the database is unreachable — this route prerenders
 * now, and CI builds with no database. An empty manager still renders its "add a name" form.
 */
async function watchlistRows() {
  try {
    return await db.watchlistItem.findMany({
      orderBy: [{ isFocus: "desc" }, { addedAt: "asc" }],
      select: { id: true, symbol: true, reason: true, isFocus: true, instrument: { select: { name: true } } },
    });
  } catch (error) {
    console.error("SettingsPage: could not read the watchlist", error);
    return [];
  }
}

export default async function SettingsPage() {
  const rows = await watchlistRows();
  const items: ManagedItem[] = rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    name: r.instrument.name,
    reason: r.reason,
    isFocus: r.isFocus,
  }));
  const focusCount = items.filter((i) => i.isFocus).length;

  return (
    <div className="flex flex-col gap-8 py-6">
      <header>
        <h1 className="font-ui text-sm font-bold uppercase tracking-[0.08em] text-ink">Watchlist</h1>
        <div className="mt-1 h-px bg-hairline-strong" />
        <p className="pt-3 font-ui text-sm text-muted">
          Add a name and the reason you are watching it. Mark up to {FOCUS_CAP} as focus — the list
          the Desk keeps in front of you.
        </p>
      </header>

      {/*
       * Three cards, because this page has always been three things — add a name, curate the list,
       * pick a look — and it was rendering them as three unbounded runs of prose down one column.
       * The cards do not add anything; they admit what was already there.
       */}
      <Surface as="section" aria-label="Add a name" className="p-5 desk:p-6">
        <AddWatchlistForm />
      </Surface>

      <Surface as="section" aria-label="Your watchlist" className="p-5 desk:p-6">
        <WatchlistManager items={items} focusCount={focusCount} />
      </Surface>

      <Surface as="section" aria-label="Theme" className="p-5 desk:p-6">
        <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">Theme</h2>
        <div className="mt-1 h-px bg-hairline-strong" />
        <p className="pt-3 font-ui text-sm text-muted">
          Applies everywhere — Morning or Midnight, one look at a time. System follows your device.
        </p>
        <ThemeToggle />
      </Surface>
    </div>
  );
}
