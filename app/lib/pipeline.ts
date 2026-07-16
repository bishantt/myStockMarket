import { db } from "@/lib/db";
import type { TradingDate } from "@/lib/market-hours";

/**
 * pipeline.ts — the app's read of the nightly pipeline's own heartbeat.
 *
 * At P0 this is the whole data layer: the Desk shows when the cloud pipeline last ran, read from
 * the `pipeline_run` row that Job A writes. The rich morning payload (briefing, scans, movers,
 * cards) is assembled by lib/morning.ts from P1 onward; this stays as the pipeline-status read.
 */

/** The key the dawn refresh's entry lives under, inside the night's source_status (CC8, publish_dawn). */
export const DAWN_KEY = "dawn";

/** The dawn refresh's own entry, stamped beside the night's source_status by publish_dawn (CC8). */
export type DawnEntry = {
  ranAt?: string;
  sources?: Record<string, string>;
  stages?: Record<string, string>;
};

/**
 * The dawn entry publish_dawn merged into a run's source_status, or null if no dawn has run. It rides
 * BESIDE the night's per-provider strings (never overwriting them), so the reader must be a non-string
 * object under `dawn`. One definition, here in the base module — pipelines.ts (the control room) and the
 * edition-state machine both read the SAME entry, so a dawn is a dawn everywhere (the sibling-bug rule).
 */
export function readDawnEntry(sourceStatus: unknown): DawnEntry | null {
  if (!sourceStatus || typeof sourceStatus !== "object") return null;
  const dawn = (sourceStatus as Record<string, unknown>)[DAWN_KEY];
  if (!dawn || typeof dawn !== "object") return null;
  return dawn as DawnEntry;
}

/** The key the janitor's retirements live under, inside the night's source_status (CC10, publish_janitor). */
export const JANITOR_KEY = "janitor";

/** The janitor's report, stamped beside the night's source_status by publish_janitor (CC10, plan 4.8). */
export type JanitorEntry = {
  ranAt?: string;
  /** Total news rows retired across the news group — the "N news items" the reader sees. */
  news?: number;
  /** The trailing window for news, in days (45). */
  days?: number;
  /** How many whole sessions of scan rows fell past the 30-session window. */
  scans?: number;
  /** Weekly database dumps kept under R2 `backups/`, and how many were there to begin with. */
  backupsKept?: number;
  backupsSeen?: number;
  /** The full per-table breakdown, kept for the record. */
  deleted?: Record<string, number>;
};

/**
 * The janitor entry publish_janitor merged into a run's source_status, or null if no janitor has run.
 * The twin of readDawnEntry: it rides BESIDE the night's per-provider strings as a non-string object, so
 * the control room reads it here and everything that walks the provider strings (statusFromRun, the
 * SourceStatusFooter, nightSources) skips it — deletion is not a provider's health.
 */
export function readJanitorEntry(sourceStatus: unknown): JanitorEntry | null {
  if (!sourceStatus || typeof sourceStatus !== "object") return null;
  const janitor = (sourceStatus as Record<string, unknown>)[JANITOR_KEY];
  if (!janitor || typeof janitor !== "object") return null;
  return janitor as JanitorEntry;
}

/** The shape the Desk needs from the most recent run. Dates are ISO strings because this is cached
 * (the data cache serialises to JSON); the page reconstructs them. */
export type LatestRun = {
  /** The trading day the run processed (ISO date string). */
  runDate: string;
  /** When it finished, if it did (ISO string). Null while a run is still in flight. */
  finishedAt: string | null;
  /** When a dawn ran for the reader's session, if one has (CC9) — the edition-state machine's key fact. */
  dawnRanAt: string | null;
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
      select: { runDate: true, finishedAt: true, sourceStatus: true },
    });
    if (!row) return null;
    const dawn = readDawnEntry(row.sourceStatus);
    return {
      runDate: row.runDate.toISOString(),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      // The dawn's own instant (`ranAt`), not the night's finish — the morning edition is keyed on
      // when the dawn ran, and a dawn stamps its own time (CC8).
      dawnRanAt: dawn?.ranAt ?? null,
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

/**
 * The moment the PRIOR edition went to press — the finish time of the second-most-recent finished run
 * (CC10, R8). Null when only one edition exists (a fresh database): with no prior edition to compare
 * against, nothing is "new since last edition", which is the honest default rather than tagging everything.
 *
 * It is a fact about the RUN, not the reader — so a "new since last edition" tag computed from it is
 * edition-relative, safe on a cached page, and tracks nobody (R8).
 */
export async function getPriorEditionPressTime(): Promise<Date | null> {
  try {
    const rows = await db.pipelineRun.findMany({
      where: { finishedAt: { not: null } },
      orderBy: { runDate: "desc" },
      take: 2,
      select: { finishedAt: true },
    });
    return rows.length >= 2 ? rows[1].finishedAt : null;
  } catch (error) {
    console.error("getPriorEditionPressTime: could not read pipeline_run", error);
    return null;
  }
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
