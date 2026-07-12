import { db } from "@/lib/db";
import { calibrationBuckets, rollingBrier, type CalibrationBucket, type ResolvedForecast } from "@/lib/brier";

/**
 * lib/forecasts.ts — the user's forecasts, loaded from journal_entry for the track record
 * (plan §7 P6 step 3–4).
 *
 * A journal entry with a probability is a forecast. Once resolved (outcome set), it is Brier-scored;
 * until then it is open, awaiting its resolution date. This module shapes those rows into what the
 * track record shows: the rolling Brier, the calibration buckets, and the open forecasts still due.
 */

export type OpenForecast = {
  id: string;
  forecast: string;
  probability: number;
  resolvesOn: Date;
};

export type ForecastRecord = {
  rollingBrier: number | null;
  resolvedCount: number;
  buckets: CalibrationBucket[];
  open: OpenForecast[];
};

export async function getForecastRecord(): Promise<ForecastRecord> {
  // An unreachable database means "no forecasts on record", not a broken page. The track-record
  // route prerenders since F1, so this query now runs at build time too — and CI builds with no
  // database at all. A forecast record that cannot be read degrades to an empty one, which the page
  // already renders honestly.
  let rows: { id: string; forecast: string | null; probability: number | null; resolvesOn: Date | null; outcome: string | null }[];
  try {
    rows = await db.journalEntry.findMany({
      where: { probability: { not: null } },
      orderBy: { date: "desc" },
      select: { id: true, forecast: true, probability: true, resolvesOn: true, outcome: true },
    });
  } catch (error) {
    console.error("getForecastRecord: could not read the journal's forecasts", error);
    rows = [];
  }

  const resolved: ResolvedForecast[] = [];
  const open: OpenForecast[] = [];
  for (const row of rows) {
    if (row.probability === null) continue;
    if (row.outcome === "hit" || row.outcome === "miss") {
      resolved.push({ probability: row.probability, outcome: row.outcome === "hit" ? 1 : 0 });
    } else if (row.resolvesOn) {
      open.push({ id: row.id, forecast: row.forecast ?? "(no text)", probability: row.probability, resolvesOn: row.resolvesOn });
    }
  }

  return {
    rollingBrier: rollingBrier(resolved),
    resolvedCount: resolved.length,
    buckets: calibrationBuckets(resolved),
    open,
  };
}
