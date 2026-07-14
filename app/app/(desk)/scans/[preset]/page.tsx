import Link from "next/link";
import { notFound } from "next/navigation";

import { ScanTable } from "@/components/scans/ScanTable";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { TermProse } from "@/components/Term";
import { RailProvider } from "@/components/rail/Rail";
import { copy, fill } from "@/lib/copy";
import { db } from "@/lib/db";
import { SCAN_PRESETS, criteriaClauses } from "@/lib/scan-presets";
import type { ScanRow } from "@/lib/scan-table";
import { formatUtcDate } from "@/lib/time";

/**
 * /scans/[preset] — the full match set, as a table (APP-FEEL-PLAN §4.2).
 *
 * This route exists because of a specific, measurable failure. /scans rendered each preset's matches
 * as a wall of bare ticker chips, capped at 24, ending in "+ N more" — which was a plain `<li>`. Not
 * a link. Not a button. On the first live pipeline night there were 1,825 matches across the five
 * presets, and almost every one of them was unreachable from the page whose entire job is to show
 * them. The reader could see that 141 names matched and could not find out which.
 *
 * Now every match is reachable, up to a stated cap, in a table that says why each one is here.
 */

/** Cached like every other room (§5.3), busted by the nightly publish. */
export const revalidate = 600;

/**
 * A closed set of five. `dynamicParams = false` is what makes /scans/garbage a REAL 404 — status and
 * all — rather than a 200 carrying a not-found page, which is what an ISR-cached `notFound()` serves
 * (verified: /ticker/GARBAGE does exactly that today).
 *
 * AND IT IS LOAD-BEARING IN A WAY THAT NEARLY TOOK THIS ROOM DOWN IN PRODUCTION. Read drift rule 17
 * before touching anything here.
 *
 * `revalidatePath(path, "layout")` DROPS THE KNOWN-PARAMS SET OF A ROUTE THAT DECLARES
 * `dynamicParams = false`. Every URL in the family then 404s. Permanently — until the next deploy.
 * The theme action called it (since P6) and the watchlist action called it (since F1), so the reader
 * would have found this by changing their theme. Once. And every scan table in the app would have
 * been gone.
 *
 * It was caught by CI (the VRT shot came back as a 404 page) and reproduced locally in two commands:
 * request the page → 200; call a layout revalidation; request it again → 404. The scans index
 * survives it. /academy/[slug] survives it. Only the route that declared a closed param set dies.
 *
 * So there are now NO layout-scoped revalidations anywhere in this app — the theme no longer needs
 * one (it applies client-side since F1), the watchlist names the paths it changes, and drift rule 17
 * greps for the pattern so it cannot come back and quietly delete this room.
 */
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ preset: string }[]> {
  return SCAN_PRESETS.map((preset) => ({ preset: preset.key }));
}

/**
 * The hard cap on rows handed to the client.
 *
 * It is an honest editorial as much as a limit: post-narrowing, a preset matching more than 500 of
 * ~6,000 names has stopped filtering. Above the cap the page says so, in those words, and turns
 * sorting off (M6).
 */
const ROW_CAP = 500;

/** The latest run's matches for one preset, with instrument names joined on. */
async function loadMatches(presetKey: string): Promise<{ rows: ScanRow[]; total: number; runDate: Date | null }> {
  try {
    const latest = await db.scanResult.findFirst({ orderBy: { runDate: "desc" }, select: { runDate: true } });
    if (!latest) return { rows: [], total: 0, runDate: null };

    const matches = await db.scanResult.findMany({
      where: { runDate: latest.runDate, presetKey },
      orderBy: { rank: "asc" },
      select: { symbol: true, rank: true, metrics: true },
    });

    // The name join — the same helper shape lib/morning.ts uses. Only the capped set is named: there
    // is no point looking up 1,300 names the page will never render.
    const capped = matches.slice(0, ROW_CAP);
    const names = await db.instrument.findMany({
      where: { symbol: { in: capped.map((m) => m.symbol) } },
      select: { symbol: true, name: true },
    });
    const nameOf = Object.fromEntries(names.map((n) => [n.symbol, n.name]));

    const rows: ScanRow[] = capped.map((match) => {
      const metrics = (match.metrics ?? {}) as Record<string, unknown>;
      // Only numbers survive. Anything else — a missing key, a null, a stray string — becomes null,
      // which the table renders "—" and sorts last. An unknown is never a zero.
      const numeric: Record<string, number | null> = {};
      for (const [key, value] of Object.entries(metrics)) {
        numeric[key] = typeof value === "number" && Number.isFinite(value) ? value : null;
      }
      return {
        symbol: match.symbol,
        name: nameOf[match.symbol] ?? match.symbol,
        rank: match.rank,
        lottery: metrics.lottery_flag === true,
        metrics: numeric,
      };
    });

    return { rows, total: matches.length, runDate: latest.runDate };
  } catch (error) {
    console.error(`ScanPresetPage: could not load matches for ${presetKey}`, error);
    return { rows: [], total: 0, runDate: null };
  }
}

export default async function ScanPresetPage({ params }: { params: Promise<{ preset: string }> }) {
  const { preset: presetKey } = await params;
  const preset = SCAN_PRESETS.find((p) => p.key === presetKey);
  if (!preset) notFound();

  const { rows, total, runDate } = await loadMatches(presetKey);
  const capped = total > ROW_CAP;

  return (
    <RailProvider>
      <div className="flex flex-col gap-6 py-6">
        <Link
          href="/scans"
          className="flex min-h-11 w-fit items-center font-ui text-sm text-ink-2 transition-colors duration-(--duration-quick) hover:text-accent-deep"
        >
          ← All scans
        </Link>

        {/*
         * The honesty spine, and it is FIRST IN FLOW — never collapsible, never sticky. "Visible"
         * means present and unhidden, not pinned to the top of the screen: a sticky multi-line header
         * would eat half a phone viewport and walk straight into the iOS sticky traps this plan
         * deliberately avoids. The honesty message brackets the content instead — the recipe at the
         * head, and copy.scans.tableNote at the foot, under the table.
         */}
        <Surface as="section" aria-label="Scan recipe" className="p-5 desk:p-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-display font-bold text-ink">{preset.label}</h1>
            {preset.folklore ? (
              <Tag variant="folklore" />
            ) : (
              <Tag variant="grade" grade={preset.grade}>
                {preset.grade}
              </Tag>
            )}
          </div>

          {/*
           * The recipe and the count share a row from `desk:` (NEWS-AND-CONTROL-PLAN Part 4.3), in a
           * 7/5 split. Below that they stack, exactly as before.
           *
           * The two belong beside each other because they are the same sentence: these are the
           * clauses, and this is how many names cleared them. Read side by side, the count is
           * obviously the OUTPUT of the criteria next to it — which is the whole reason the recipe is
           * on this page at all. Stacked down a 1360px column with 700px of white space to the right
           * of each, they read as two unrelated facts that happen to share a card.
           */}
          <div className="grid grid-cols-1 gap-x-10 desk:grid-cols-12">
            <ol className="pt-4 desk:col-span-7">
              {criteriaClauses(preset.criteria).map((clause, index) => (
                <li key={clause} className="flex items-baseline gap-3 border-b border-hairline py-2 last:border-b-0">
                  <span className="shrink-0 font-mono text-2xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                  {/* The recipe is the vocabulary lesson. Same doorway as the index (PD6). */}
                  <span className="max-w-[62ch] font-ui text-sm text-ink-2">
                    <TermProse text={clause} />
                  </span>
                </li>
              ))}
            </ol>

            <div className="pt-4 desk:col-span-5">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="font-mono text-num-lg tabular-nums text-ink">
                  {total} match{total === 1 ? "" : "es"} today
                </p>
                {runDate ? (
                  <time
                    dateTime={runDate.toISOString()}
                    data-vrt="mask"
                    className="font-mono text-2xs uppercase tracking-[0.08em] text-muted"
                  >
                    as of {formatUtcDate(runDate)}
                  </time>
                ) : null}
              </div>

              {capped ? (
                <p className="max-w-[62ch] pt-3 font-ui text-sm text-ink-2">{fill(copy.scans.cap, { n: total })}</p>
              ) : null}
            </div>
          </div>
        </Surface>

        {rows.length > 0 ? (
          <Surface className="p-5 desk:p-6">
            <ScanTable presetKey={presetKey} rows={rows} capped={capped} />
          </Surface>
        ) : (
          // An empty scan is a result, not a shelf to apologise for.
          <Surface className="p-5 desk:p-6">
            <p className="max-w-[62ch] font-ui text-sm text-ink-2">{copy.scans.empty}</p>
          </Surface>
        )}
      </div>
    </RailProvider>
  );
}
