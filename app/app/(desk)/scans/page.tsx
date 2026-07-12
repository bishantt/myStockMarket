import Link from "next/link";

import { db } from "@/lib/db";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { SCAN_PRESETS, criteriaClauses } from "@/lib/scan-presets";
import { capMatches } from "@/lib/scan-view";

/** Each preset's core concept, so its label carries a glossary doorway into the Academy. */
const PRESET_GLOSSARY: Record<string, string> = {
  "unusual-volume": "rvol",
  "near-52w-high": "52-week-high",
  "gap-3plus": "gap",
  "golden-cross-fresh": "golden-cross",
  "rsi-extreme": "rsi",
};

/**
 * /scans — the five scan presets with fully visible criteria (plan §9.2, Appendix F, P4 step 6).
 *
 * Every preset shows exactly what it filtered on — the criteria in plain words — with its RR Part 4
 * evidence grade, and the folklore-adjacent one labelled FOLKLORE. That transparency is the honesty
 * rule: a scan is a filter with a stated, gradeable basis, never a black-box "signal". The matched
 * symbols for the latest run sit beneath each preset. No percentages here — a scan match is a filter
 * hit, not a base rate.
 */

/**
 * Served from the cache, revalidated every ten minutes, and busted outright by the nightly publish
 * (§5.3 P-1). The scans change once a night; re-rendering them on every tap cost the reader ~850ms
 * of frozen screen and bought nothing. The as-of stamp on the page is what keeps a cached page
 * honest (ruling M5).
 */
export const revalidate = 600;

/**
 * The latest run's matches — or none, if the database cannot be reached.
 *
 * The wrapping is not defensive habit, it is a build requirement: now that this route prerenders,
 * this query runs at `next build`, and CI builds the app on every push with NO database. An
 * unreachable table degrades the page to its honest empty state ("the filter ran and found
 * nothing"); it does not fail the build. Same pattern as the Desk layout's palette read, and for
 * exactly the same reason (LESSONS 2026-07-12).
 */
async function latestMatches() {
  try {
    const latest = await db.scanResult.findFirst({ orderBy: { runDate: "desc" }, select: { runDate: true } });
    if (!latest) return [];
    return await db.scanResult.findMany({
      where: { runDate: latest.runDate },
      orderBy: [{ presetKey: "asc" }, { rank: "asc" }],
      select: { presetKey: true, symbol: true },
    });
  } catch (error) {
    console.error("ScansPage: could not read the latest scan matches", error);
    return [];
  }
}

export default async function ScansPage() {
  const matches = await latestMatches();

  const bySymbol = new Map<string, string[]>();
  for (const m of matches) {
    const list = bySymbol.get(m.presetKey) ?? [];
    list.push(m.symbol);
    bySymbol.set(m.presetKey, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-3">
        <div className="pb-2">
          <h1 className="font-display text-display font-bold text-ink">Scans</h1>
        </div>
        <div className="h-px bg-hairline-strong" />
        <p className="max-w-[62ch] pt-3 font-prose text-base text-ink-2">
          Each scan is a filter with a stated, gradeable basis — you can see exactly what it looked
          for. A match is a filter hit, not a forecast; the evidence grade says how much weight the
          research supports.
        </p>
      </header>

      <ul className="flex flex-col gap-6">
        {SCAN_PRESETS.map((preset) => {
          const hits = bySymbol.get(preset.key) ?? [];
          const clauses = criteriaClauses(preset.criteria);
          const capped = capMatches(hits);

          return (
            <li key={preset.key}>
              <Surface as="article" className="p-5 desk:p-6">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="font-display text-title font-bold text-ink">
                    {PRESET_GLOSSARY[preset.key] ? (
                      <GlossaryTerm term={PRESET_GLOSSARY[preset.key]}>{preset.label}</GlossaryTerm>
                    ) : (
                      preset.label
                    )}
                  </h2>
                  {preset.folklore ? (
                    <Tag variant="folklore" />
                  ) : (
                    <Tag variant="grade" grade={preset.grade}>
                      {preset.grade}
                    </Tag>
                  )}
                </div>

                {/*
                 * The recipe, as a recipe. Each criterion gets its own numbered, hairline-separated
                 * row — something a reader can check off by eye, rather than a paragraph they have
                 * to parse. The words are the scan's own, verbatim: the promise of this page is that
                 * you see exactly what the filter did.
                 */}
                <ol className="pt-4">
                  {clauses.map((clause, index) => (
                    <li
                      key={clause}
                      className="flex items-baseline gap-3 border-b border-hairline py-2 last:border-b-0"
                    >
                      <span className="shrink-0 font-mono text-2xs text-faint">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="max-w-[62ch] font-ui text-sm text-ink-2">{clause}</span>
                    </li>
                  ))}
                </ol>

                {/*
                 * The result. A scan that fires nothing is information — "0 matches today" stays
                 * visible with the recipe, because knowing the filter found nothing is knowing
                 * something. There are no percentages anywhere on this page: a match is a filter
                 * hit, not a base rate.
                 */}
                <p className="pt-4 font-mono text-sm text-ink">
                  {hits.length} match{hits.length === 1 ? "" : "es"} today
                </p>

                {hits.length > 0 ? (
                  <ul className="flex flex-wrap gap-2 pt-3">
                    {capped.shown.map((symbol) => (
                      <li key={symbol}>
                        <Link
                          href={`/ticker/${symbol}`}
                          className="flex min-h-11 items-center rounded-chip border border-hairline bg-surface px-3 font-mono text-sm text-ink transition-colors duration-(--duration-quick) ease-(--ease-quiet) hover:border-hairline-strong hover:text-accent-deep"
                        >
                          {symbol}
                        </Link>
                      </li>
                    ))}
                    {capped.more > 0 ? (
                      <li className="flex min-h-11 items-center font-mono text-sm text-faint">
                        + {capped.more} more
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </Surface>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
