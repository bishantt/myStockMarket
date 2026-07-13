import Link from "next/link";

import { db } from "@/lib/db";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { Surface } from "@/components/Surface";
import { Tag } from "@/components/Tag";
import { copy, fill } from "@/lib/copy";
import { signedPercent } from "@/lib/format";
import { SCAN_PRESETS, criteriaClauses } from "@/lib/scan-presets";

/** Each preset's core concept, so its label carries a glossary doorway into the Academy. */
const PRESET_GLOSSARY: Record<string, string> = {
  "unusual-volume": "rvol",
  "near-52w-high": "52-week-high",
  "gap-3plus": "gap",
  "golden-cross-fresh": "golden-cross",
  "rsi-extreme": "rsi",
};

/**
 * /scans — the recipe index (plan §9.2, Appendix F; APP-FEEL-PLAN §4.2).
 *
 * Every preset shows exactly what it filtered on — the criteria in plain words, verbatim — with its
 * evidence grade, and the folklore-adjacent one labelled FOLKLORE. That transparency is the honesty
 * rule: a scan is a filter with a stated, gradeable basis, never a black-box "signal".
 *
 * WHAT CHANGED AT F3. This page used to print each preset's matches as a wall of bare ticker chips,
 * capped at 24, ending in "+ N more" — which was a plain <li>: not a link, not a button, not
 * anything. On the first live pipeline night, 1,825 matches were unreachable from the page that
 * exists to show them. The wall is gone. Each card now carries a THREE-ROW PREVIEW in the same
 * card-row grammar the full table uses, and a link to the preset's own route where every match is
 * reachable. The preview states its own cut ("First 3 of 41 by scan order") rather than being an
 * unlabelled slice — ruling M8.
 *
 * The cards render in the fixed SCAN_PRESETS order, ALWAYS. Never by match count: ordering the index
 * by how many names each filter caught would be a cross-preset ranking, which is precisely the
 * leaderboard ruling M1 forbids. A busy scan is not a better scan.
 */

export const revalidate = 600;

const PREVIEW_ROWS = 3;

type PreviewRow = { symbol: string; rank: number; ret: number | null };

/** The latest run's matches, grouped by preset — or none, if the database cannot be reached. */
async function latestMatches(): Promise<Map<string, PreviewRow[]>> {
  const byPreset = new Map<string, PreviewRow[]>();
  try {
    const latest = await db.scanResult.findFirst({ orderBy: { runDate: "desc" }, select: { runDate: true } });
    if (!latest) return byPreset;

    const matches = await db.scanResult.findMany({
      where: { runDate: latest.runDate },
      orderBy: [{ presetKey: "asc" }, { rank: "asc" }],
      select: { presetKey: true, symbol: true, rank: true, metrics: true },
    });

    for (const match of matches) {
      const metrics = (match.metrics ?? {}) as Record<string, unknown>;
      const ret = typeof metrics.ret_1 === "number" && Number.isFinite(metrics.ret_1) ? metrics.ret_1 : null;
      const list = byPreset.get(match.presetKey) ?? [];
      list.push({ symbol: match.symbol, rank: match.rank, ret });
      byPreset.set(match.presetKey, list);
    }
    return byPreset;
  } catch (error) {
    console.error("ScansPage: could not read the latest scan matches", error);
    return byPreset;
  }
}

export default async function ScansPage() {
  const byPreset = await latestMatches();

  return (
    <div className="flex flex-col gap-6 py-6">
      <header>
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

      {/* Two-up from lg. The odd fifth card keeps its column width in flow — a full-width last card
          would read as emphasis, and rsi-extreme has earned none. */}
      <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {SCAN_PRESETS.map((preset) => {
          const hits = byPreset.get(preset.key) ?? [];
          const preview = hits.slice(0, PREVIEW_ROWS);

          return (
            <li key={preset.key}>
              <Surface as="article" className="flex h-full flex-col p-5 desk:p-6">
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
                 * The recipe, as a recipe — all the clauses, always, at every width. They are never
                 * collapsed and never abbreviated: the five presets differ by recipe, count and
                 * grade and by nothing else, so the recipes ARE the comparison content of this page.
                 * An anti-black-box card that hides its own recipe behind a "show more" has become
                 * the thing it was built to replace.
                 */}
                <ol className="pt-4">
                  {criteriaClauses(preset.criteria).map((clause, index) => (
                    <li
                      key={clause}
                      className="flex items-baseline gap-3 border-b border-hairline py-2 last:border-b-0"
                    >
                      <span className="shrink-0 font-mono text-2xs text-muted">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="max-w-[62ch] font-ui text-sm text-ink-2">{clause}</span>
                    </li>
                  ))}
                </ol>

                <p className="pt-4 font-mono text-sm text-ink">
                  {hits.length} match{hits.length === 1 ? "" : "es"} today
                </p>

                {preview.length > 0 ? (
                  <div className="flex flex-col pt-3">
                    {/* M8: the cut is named. Never "highlights", never an unlabelled slice. */}
                    <p className="pb-1 font-mono text-2xs uppercase tracking-[0.08em] text-muted">
                      {fill(copy.scans.preview, { k: preview.length, n: hits.length })}
                    </p>
                    {/*
                     * A preview is a teaser, not a comparison instrument: no header row, no sort
                     * affordance. Five header-bearing tables stacked on one index page would
                     * out-receipt the chip walls they replaced.
                     */}
                    <ul className="flex flex-col">
                      {preview.map((row) => (
                        <li
                          key={row.symbol}
                          className="flex items-center justify-between gap-3 border-b border-hairline py-2 last:border-b-0"
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-2xs text-muted">{row.rank}</span>
                            <span className="font-mono text-sm text-ink">{row.symbol}</span>
                          </span>
                          {row.ret !== null ? (
                            <span
                              data-p2="true"
                              className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 font-mono text-2xs ${
                                row.ret >= 0 ? "bg-up-wash text-up-text" : "bg-down-wash text-down-text"
                              }`}
                            >
                              <span aria-hidden="true">{row.ret >= 0 ? "▲" : "▼"}</span>
                              {signedPercent(row.ret)}
                            </span>
                          ) : (
                            <span className="font-mono text-2xs text-muted">—</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* The grave of the dead "+ N more". This one is a link, and every match is behind it. */}
                <div className="flex grow items-end pt-4">
                  {hits.length > 0 ? (
                    <Link
                      href={`/scans/${preset.key}`}
                      className="flex min-h-11 items-center font-ui text-sm text-accent-deep underline-offset-2 hover:underline"
                    >
                      {fill(copy.scans.allMatches, { n: hits.length })}
                    </Link>
                  ) : (
                    <p className="max-w-[62ch] font-ui text-sm text-muted">{copy.scans.empty}</p>
                  )}
                </div>
              </Surface>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
