import { db } from "@/lib/db";
import { patternLabel } from "@/lib/patterns";
import { percent } from "@/lib/format";

/**
 * lib/track-record.ts — the app's own resolved log (plan P4 step 6, §1.5 rule 7).
 *
 * The honesty engine's final promise: the app shows its own misses. Every fired signal whose horizon
 * has passed carries a resolved outcome (hit / miss / na), insert-only, and this loads them for the
 * /track-record page. The summary counts are computed here from stored outcomes — the app tallies,
 * it does not grade a rate it did not measure.
 */

export type ResolvedRow = {
  id: string;
  firedDate: Date;
  resolvedAt: Date;
  symbol: string;
  patternLabel: string;
  horizonDays: number;
  outcome: "hit" | "miss" | "na";
};

export type TrackRecord = {
  rows: ResolvedRow[];
  summary: { total: number; hits: number; misses: number; na: number; hitRate: string | null };
};

/**
 * Load the resolved log, newest first, with a summary. The rows are limited for display; the summary
 * is computed over ALL resolutions (a grouped count), so a truncated table never understates the
 * record. The hit rate is over resolved hit/miss outcomes only (na — an unresolvable horizon — is
 * counted but excluded from the rate). Returns an empty record if nothing has resolved yet.
 */
export async function getTrackRecord(limit = 200): Promise<TrackRecord> {
  try {
    return await loadTrackRecord(limit);
  } catch (error) {
    // The Desk prerenders with this loader; a build with no database (CI) or a slow table must
    // degrade to an empty record, exactly as getMorning does — never fail the render.
    console.error("getTrackRecord: could not read the resolved log", error);
    return { rows: [], summary: { total: 0, hits: 0, misses: 0, na: 0, hitRate: null } };
  }
}

/** The teaching numbers for the track record's EMPTY state (CC4). */
export type PendingSignals = { logged: number; firstResolutionDue: Date | null };

/**
 * How many signals have been logged, and when the first one resolves (CC4, D4).
 *
 * The empty track record is PRODUCTION's early state — the pipeline fires signals every night, but
 * none has reached its ten-day horizon yet, so `signal_resolution` is empty while `signal_log` is
 * not. Rather than a bare "nothing yet", the page can teach the mechanism from real rows: how many
 * are logged, and the date the first resolution is due (`resolvesOn` is stored, so no trading-day
 * arithmetic is needed here). Degrades to {0, null} when the database is unreachable — the empty
 * state then shows its plain line alone.
 */
export async function getPendingSignals(): Promise<PendingSignals> {
  try {
    const [logged, next] = await Promise.all([
      db.signalLog.count(),
      db.signalLog.findFirst({
        where: { resolution: null },
        orderBy: { resolvesOn: "asc" },
        select: { resolvesOn: true },
      }),
    ]);
    return { logged, firstResolutionDue: next?.resolvesOn ?? null };
  } catch (error) {
    console.error("getPendingSignals: could not read the signal log", error);
    return { logged: 0, firstResolutionDue: null };
  }
}

async function loadTrackRecord(limit: number): Promise<TrackRecord> {
  const [resolutions, counts] = await Promise.all([
    db.signalResolution.findMany({
      orderBy: { resolvedAt: "desc" },
      take: limit,
      select: {
        id: true,
        outcome: true,
        resolvedAt: true,
        signal: { select: { firedDate: true, symbol: true, patternKey: true, horizonDays: true } },
      },
    }),
    db.signalResolution.groupBy({ by: ["outcome"], _count: { _all: true } }),
  ]);

  const rows: ResolvedRow[] = resolutions.map((r) => ({
    id: r.id,
    firedDate: r.signal.firedDate,
    resolvedAt: r.resolvedAt,
    symbol: r.signal.symbol,
    patternLabel: patternLabel(r.signal.patternKey),
    horizonDays: r.signal.horizonDays,
    outcome: r.outcome as "hit" | "miss" | "na",
  }));

  const countOf = (outcome: string) =>
    counts.find((c) => c.outcome === outcome)?._count._all ?? 0;
  const hits = countOf("hit");
  const misses = countOf("miss");
  const na = countOf("na");
  const graded = hits + misses;
  return {
    rows,
    summary: {
      total: hits + misses + na,
      hits,
      misses,
      na,
      hitRate: graded > 0 ? percent(hits / graded) : null,
    },
  };
}
