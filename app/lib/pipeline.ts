import { db } from "@/lib/db";
import type { TradingDate } from "@/lib/market-hours";

/**
 * pipeline.ts — the app's read of the nightly pipeline's own heartbeat.
 *
 * At P0 this is the whole data layer: the Desk shows when the cloud pipeline last ran, read from
 * the `pipeline_run` row that Job A writes. The rich morning payload (briefing, scans, movers,
 * cards) is assembled by lib/morning.ts from P1 onward; this stays as the pipeline-status read.
 */

/** The shape the Desk needs from the most recent run. Dates are ISO strings because this is cached
 * (the data cache serialises to JSON); the page reconstructs them. */
export type LatestRun = {
  /** The trading day the run processed (ISO date string). */
  runDate: string;
  /** When it finished, if it did (ISO string). Null while a run is still in flight. */
  finishedAt: string | null;
};

/**
 * Returns the most recent pipeline run, or null.
 *
 * Null means one of two honest things: no run has been recorded yet (a fresh database), or the
 * database could not be reached. Both render as the same quiet "—" on the Desk at P0 — the
 * SourceStatusFooter that distinguishes them arrives in P1. A database error is logged on the
 * server rather than swallowed, and it degrades the one module rather than crashing the page:
 * an unreachable pipeline status must never take down the whole Desk.
 */
export async function getLatestRun(): Promise<LatestRun | null> {
  try {
    const row = await db.pipelineRun.findFirst({
      orderBy: { runDate: "desc" },
      select: { runDate: true, finishedAt: true },
    });
    if (!row) return null;
    return {
      runDate: row.runDate.toISOString(),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    };
  } catch (error) {
    console.error("getLatestRun: could not read pipeline_run", error);
    return null;
  }
}

/**
 * The most recent run that actually FINISHED — the edition on screen.
 *
 * This is deliberately not `getLatestRun`, and the difference is the whole point. Job A writes its
 * `pipeline_run` row when it STARTS and stamps `finishedAt` when it is done. So a job that crashed
 * halfway leaves a row for tonight with a null `finishedAt` — forever. A freshness check that read
 * "the newest row" would find that row, see tonight's date, and report a healthy pipeline. It would
 * photograph a crash as a success, which is the exact species of silent failure this whole phase is
 * about.
 *
 * A row is not an edition. A finished row is an edition.
 */
export type CompletedRunRow = {
  /**
   * The trading day the run processed, as a BARE calendar date: "2026-07-10". Not a timestamp.
   *
   * This is load-bearing, and getting it wrong cost a build. `pipeline_run.runDate` is a Prisma
   * `@db.Date` — a trading DAY, stored at UTC midnight — and calling `.toISOString()` on it (as the
   * rest of this file does, correctly, for real instants) yields "2026-07-10T00:00:00.000Z". The
   * freshness state machine walks the trading calendar in bare dates, so it built
   * `new Date("2026-07-10T00:00:00.000Z" + "T00:00:00Z")` — an Invalid Date, and a RangeError the
   * moment anything tried to format it.
   *
   * The unit tests never saw it, because they hand-fed the state machine bare dates. The bug lived
   * exactly in the SEAM between the database row and the machine, which is precisely the place a
   * test that constructs its own fixtures cannot look. The prerender caught it; there is now a test
   * on this function's own shape (lib/pipeline.test.ts) so the seam is guarded rather than lucky.
   */
  runDate: TradingDate;
  /** When it finished — never null, by construction. That is the whole point of this type. */
  finishedAt: string;
};

/** A `@db.Date` value as the bare calendar date it actually represents. */
export function toTradingDate(date: Date): TradingDate {
  return date.toISOString().slice(0, 10);
}

export async function getLatestCompletedRun(): Promise<CompletedRunRow | null> {
  try {
    const row = await db.pipelineRun.findFirst({
      where: { finishedAt: { not: null } },
      orderBy: { runDate: "desc" },
      select: { runDate: true, finishedAt: true },
    });
    if (!row || !row.finishedAt) return null;
    return { runDate: toTradingDate(row.runDate), finishedAt: row.finishedAt.toISOString() };
  } catch (error) {
    console.error("getLatestCompletedRun: could not read pipeline_run", error);
    return null;
  }
}
