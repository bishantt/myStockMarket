import { db } from "@/lib/db";

/**
 * pipeline.ts — the app's read of the nightly pipeline's own heartbeat.
 *
 * At P0 this is the whole data layer: the Desk shows when the cloud pipeline last ran, read from
 * the `pipeline_run` row that Job A writes. The rich morning payload (briefing, scans, movers,
 * cards) is assembled by lib/morning.ts from P1 onward; this stays as the pipeline-status read.
 */

/** The shape the Desk needs from the most recent run. */
export type LatestRun = {
  /** The trading day the run processed. */
  runDate: Date;
  /** When it finished, if it did. Null while a run is still in flight. */
  finishedAt: Date | null;
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
    return row ?? null;
  } catch (error) {
    console.error("getLatestRun: could not read pipeline_run", error);
    return null;
  }
}
