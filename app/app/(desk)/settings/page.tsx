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
 * THE ONE ROOM THAT IS NOT CACHED, AND THE RULE THAT PUT IT HERE.
 *
 * F1 made this route ISR (`revalidate = 600`), and on paper it qualified: after the theme control
 * stopped reading a cookie on the server, nothing here depended on the request. But a cached page
 * has one more requirement nobody wrote down, and this page is the only one in the app that breaks
 * it:
 *
 *     A page may be CACHED, or it may be written to and read back in the SAME CLICK.
 *     It cannot be both. Never revalidate the path you were invoked from.
 *
 * Every other room is a reader: you arrive, you look, and anything you change is somewhere else. The
 * settings page is a writer — its entire content is the thing you just changed by clicking on it.
 * Add a name, focus it, remove it: each click runs a server action which re-renders THIS page as its
 * reply, and if that reply can come from a cache entry written before your click, then the page you
 * get back is the page as it was before you touched it. That is what happened: the row a test had
 * just added vanished on the next click, intermittently, because the race is a race and sometimes
 * you win it. (It is the same family as the Desk's deadlock — a page revalidating itself from inside
 * its own action — and it is the second time this shape has cost us. Hence the rule, stated once,
 * above.)
 *
 * So this room renders on request. The cost is real and it is small: this is the one room nobody
 * taps for speed, it is visited rarely, and it has a loading.tsx so the reader is never looking at
 * nothing. B1 is 9 of 10 rooms cached with this one declared in the allowlist and the reason
 * written down — which is what the allowlist is for.
 */
export const dynamic = "force-dynamic";

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
