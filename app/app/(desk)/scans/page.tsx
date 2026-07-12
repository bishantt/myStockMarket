import { db } from "@/lib/db";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { Tag } from "@/components/Tag";
import { SCAN_PRESETS } from "@/lib/scan-presets";
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

export const dynamic = "force-dynamic";

export default async function ScansPage() {
  const latest = await db.scanResult.findFirst({ orderBy: { runDate: "desc" }, select: { runDate: true } });
  const matches = latest
    ? await db.scanResult.findMany({
        where: { runDate: latest.runDate },
        orderBy: [{ presetKey: "asc" }, { rank: "asc" }],
        select: { presetKey: true, symbol: true },
      })
    : [];

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
          <h1 className="font-ui text-xl font-bold uppercase tracking-[0.06em] text-ink">
            Scans
          </h1>
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
          return (
            <li key={preset.key} className="border-t border-hairline pt-4 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-ui text-base font-semibold text-ink">
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
              <p className="max-w-[62ch] pt-1 font-prose text-base text-ink-2">{preset.criteria}</p>
              <p className="pt-2 font-ui text-2xs uppercase tracking-[0.06em] text-muted">
                {hits.length === 0 ? "No matches today" : `${hits.length} match${hits.length === 1 ? "" : "es"} today`}
              </p>
              {hits.length > 0
                ? (() => {
                    // Show a calm, capped run of tickers with an honest "+ N more" tail — never a wall.
                    const capped = capMatches(hits);
                    return (
                      <p className="pt-1 font-mono text-sm text-ink-2">
                        {capped.shown.join(" · ")}
                        {capped.more > 0 ? (
                          <span className="text-muted"> · + {capped.more} more</span>
                        ) : null}
                      </p>
                    );
                  })()
                : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
