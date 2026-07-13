import { db } from "@/lib/db";
import { Surface } from "@/components/Surface";
import { FOCUS_CAP } from "@/lib/watchlist";
import { ThemeToggle } from "@/components/desk/ThemeToggle";
import { PipelinePanel } from "@/components/settings/PipelinePanel";
import { readPanel } from "@/lib/pipeline-runs";
import { toTradingDate } from "@/lib/pipeline";
import { formatEtClock, formatEtDate } from "@/lib/time";
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

/**
 * The control room's data (N6): what can be run, what cannot, and what the pipeline last did.
 *
 * Wrapped like watchlistRows() above, and for the same reason: CI builds with no database, and a
 * settings page that cannot render without one is a settings page that fails the build. An absent
 * panel is also the honest state here — if we cannot read the ledger, we cannot say what is safe to
 * run, and the last thing this surface should do is guess.
 */
async function pipelinePanel() {
  try {
    // These two reads know nothing about each other, so they go together. /settings is the ONE room
    // in the app that is deliberately not cached (it is a writer — see B1's allowlist), which means
    // every visit pays for its queries in real time: at N7 it measured 455ms against a 150ms budget,
    // and each sequential round-trip to Supabase is roughly a hundred of those milliseconds. Awaiting
    // these in series spent one for nothing.
    const [panel, run] = await Promise.all([
      readPanel(),
      db.pipelineRun.findFirst({
        where: { finishedAt: { not: null } },
        orderBy: { runDate: "desc" },
        select: { runDate: true, finishedAt: true, stageStatus: true, sourceStatus: true },
      }),
    ]);

    return {
      ...panel,
      // The provenance block: what the last run did, and how each provider behaved while it did.
      // Formatted here because it never changes — unlike the row STATES, which are derived in the
      // browser against the reader's clock (see PipelinePanel).
      lastRunDisplay: run?.finishedAt
        ? {
            session: toTradingDate(run.runDate),
            finishedAt: `${formatEtDate(run.finishedAt)} ${formatEtClock(run.finishedAt)}`,
            stages: (run.stageStatus ?? {}) as Record<string, string>,
            sources: (run.sourceStatus ?? {}) as Record<string, string>,
          }
        : null,
    };
  } catch (error) {
    console.error("SettingsPage: could not read the pipeline panel", error);
    return null;
  }
}

export default async function SettingsPage() {
  const [rows, panel] = await Promise.all([watchlistRows(), pipelinePanel()]);

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
       *
       * Two-up from `lg:` (NEWS-AND-CONTROL-PLAN Part 4.3). The two SMALL cards — a four-field form
       * and a three-way toggle — sit side by side, and the watchlist spans the full width beneath
       * them, because it is a list and a list wants width. Stacking a 200px form on top of a 60px
       * toggle down the middle of a 1500px screen is the receipt problem in its purest form.
       *
       * The DOM order is add → look → curate, which is also the reading and tab order, so nothing
       * here depends on the grid to make sense.
       */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Surface as="section" aria-label="Add a name" className="p-5 desk:p-6">
          <AddWatchlistForm />
        </Surface>

        <Surface as="section" aria-label="Theme" className="p-5 desk:p-6">
          <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">Theme</h2>
          <div className="mt-1 h-px bg-hairline-strong" />
          <p className="pt-3 font-ui text-sm text-muted">
            Applies everywhere — Morning or Midnight, one look at a time. System follows your device.
          </p>
          <ThemeToggle />
        </Surface>

        <Surface as="section" aria-label="Your watchlist" className="p-5 desk:col-span-2 desk:p-6 lg:col-span-2">
          <WatchlistManager items={items} focusCount={focusCount} />
        </Surface>

        {/*
         * THE CONTROL ROOM (N6, plan 8.5). Full width, below the watchlist, because it is a
         * READ station before it is a control one — most weeknights every row here is a sentence
         * explaining why there is nothing worth pressing, and sentences want a measure to be read at.
         *
         * It renders even with no GitHub token (P-2 is unprovisioned): every row says so plainly and
         * none of them pretends it could dispatch. A panel that hid itself when its secret was
         * missing would leave the reader with no way to discover the feature exists, or what it needs.
         */}
        {/*
         * `id="pipeline"` IS THE OTHER HALF OF A DOORWAY THAT HAS BEEN HALF-BUILT SINCE N2.
         *
         * The Desk's freshness strip has linked to `/settings#pipeline` from all three of its states
         * — including the loud one, the alert a reader sees when the pipeline is DEAD and they most
         * need to get here and re-run it. There was no element with that id, so the fragment matched
         * nothing and the browser silently dropped the reader at the top of the settings page,
         * looking at a form for adding a stock to a watchlist.
         *
         * It never 404'd and nothing ever failed, which is exactly why it survived: a fragment that
         * matches nothing is not an error, it is just a link that quietly does half of what it says.
         */}
        {panel ? (
          <Surface
            as="section"
            id="pipeline"
            aria-label="Pipeline"
            className="scroll-mt-24 p-5 desk:col-span-2 desk:p-6 lg:col-span-2"
          >
            <PipelinePanel
              runs={panel.runs}
              lastRunSession={panel.lastRun}
              lastRun={panel.lastRunDisplay}
              configured={panel.configured}
            />
          </Surface>
        ) : null}
      </div>
    </div>
  );
}
