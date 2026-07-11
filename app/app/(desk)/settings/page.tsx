import { db } from "@/lib/db";
import { FOCUS_CAP } from "@/lib/watchlist";
import { AddWatchlistForm } from "./AddWatchlistForm";
import { WatchlistManager, type ManagedItem } from "./WatchlistManager";

/**
 * /settings — watchlist management (plan §9.2, the route table lists Watchlist management here).
 *
 * The Desk shows the focus watchlist read-only; this is where the user curates it: add a name with
 * the reason they are watching it, mark up to three as focus, remove what no longer earns a slot.
 * A server component reads the current list; the writes happen through the server actions in
 * actions.ts, which the two client components below drive. Install-app and dark-mode rows (also
 * specced for this route) arrive in P6.
 */

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const rows = await db.watchlistItem.findMany({
    orderBy: [{ isFocus: "desc" }, { addedAt: "asc" }],
    select: { id: true, symbol: true, reason: true, isFocus: true, instrument: { select: { name: true } } },
  });
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
        <div className="mt-1 h-0.5 bg-ink" />
        <p className="pt-3 font-ui text-sm text-muted">
          Add a name and the reason you are watching it. Mark up to {FOCUS_CAP} as focus — the list
          the Desk keeps in front of you.
        </p>
      </header>

      <section aria-label="Add a name">
        <AddWatchlistForm />
      </section>

      <section aria-label="Your watchlist">
        <WatchlistManager items={items} focusCount={focusCount} />
      </section>
    </div>
  );
}
