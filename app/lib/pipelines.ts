import { type RunAction } from "@/lib/constants";
import { copy, fill } from "@/lib/copy";
import { describeCadence, parseCron } from "@/lib/cron";
import { db } from "@/lib/db";
import type { ManualRunRow } from "@/lib/pipeline-control";
import { DAWN_KEY, JANITOR_KEY, readDawnEntry, readJanitorEntry, toTradingDate } from "@/lib/pipeline";
import { formatEtStamp, formatUtcDate } from "@/lib/time";

/**
 * pipelines.ts — the control room's rows (CC7, plan 4.6).
 *
 * The Desk runs on three schedules, and this is where they are named. The manual modes the reader can
 * fire by hand are not rows — they are ACTIONS that live inside the pipeline they belong to (macro under
 * the dawn refresh, because the dawn cron IS macro mode; full/news/compute under the nightly; briefing
 * under Job B). Every one of the five has exactly one home, and a test proves it.
 *
 * The split is the same one pipeline-control/pipeline-runs already draw: the pure decisions (the
 * definitions, the OK/DEGRADED/FAILED/HELD mapping, the duration format, the run merge) are here and
 * tested; loadPipelines is the messy half (Prisma, a clock), untested like readPanel.
 */

export type PipelineId = "nightly-full" | "dawn-refresh" | "evening-briefing" | "janitor";

/** A run's verdict, with the word in the chip (colour is redundant). HELD is a briefing-only state. */
export type PipelineStatus = "OK" | "DEGRADED" | "FAILED" | "HELD";

export type PipelineDef = {
  id: PipelineId;
  /** The row's name, as the reader sees it in the table. */
  name: string;
  /** One plain-English line of what it does (copy.ts). */
  description: string;
  /** The cron line(s) — DST-honest cadence and next-run are computed from these (lib/cron). */
  crons: string[];
  workflow: "nightly-a.yml" | "nightly-b.yml";
  /** The manual modes that live in this pipeline's sheet. Each of the five appears in exactly one sheet. */
  actions: RunAction[];
  /** The stages this pipeline runs, named for the sheet. */
  stages: string[];
  /** The providers this pipeline reads, named for the sheet. */
  providers: string[];
  /** Does this pipeline write its own `pipeline_run` record? Only the full nightly does (CC7). */
  writesPipelineRun: boolean;
};

/**
 * The three rows, in reading order. Since CC8 the dawn refresh IS the Morning Edition's engine (it
 * runs `dawn` mode pre-open — macro + news + calendar), and `publish_dawn` stamps a distinct dawn
 * entry BESIDE the night's on the shared `pipeline_run` row. So it still writes no run row of its own
 * (writesPipelineRun stays false — the row is the night's), but its Last run now reads that dawn entry
 * (lastRunForDawn) rather than "—". Its one hand-only button stays `macro`, the cheap number-refresh.
 */
export const PIPELINES: PipelineDef[] = [
  {
    id: "nightly-full",
    name: copy.control.pipelines.nightlyFull.name,
    description: copy.control.pipelines.nightlyFull.description,
    crons: ["37 22 * * 1-5"],
    workflow: "nightly-a.yml",
    actions: ["full", "news", "compute"],
    stages: ["ingest", "compute", "scan", "publish"],
    providers: ["alpaca", "finnhub", "marketaux", "fmp", "fred"],
    writesPipelineRun: true,
  },
  {
    id: "dawn-refresh",
    name: copy.control.pipelines.dawnRefresh.name,
    description: copy.control.pipelines.dawnRefresh.description,
    crons: ["30 10 * * 1-5"],
    workflow: "nightly-a.yml",
    actions: ["macro"],
    // Since CC8 the dawn runs `dawn` mode — the full Morning-Edition refresh, not the macro-only fix it
    // began as (Q-CC8-1). Its stages and providers now describe what it actually does at breakfast.
    stages: ["macro", "news", "catalysts", "publish", "revalidate"],
    providers: ["fred", "finnhub", "marketaux"],
    writesPipelineRun: false,
  },
  {
    id: "evening-briefing",
    name: copy.control.pipelines.eveningBriefing.name,
    description: copy.control.pipelines.eveningBriefing.description,
    crons: ["25 0 * * 2-6"],
    workflow: "nightly-b.yml",
    actions: ["briefing"],
    stages: ["extract", "verify", "synthesize", "publish"],
    providers: ["anthropic"],
    writesPipelineRun: false,
  },
  {
    // CC10 (plan 4.8): the janitor is a stage OF the nightly full run — it shares that cron and writes no
    // run row of its own (its report rides the night's source_status, read by lastRunForJanitor). It fetches
    // nothing and has no hand-only button: deletion is scheduled, boring and countable, never fired by a reader.
    id: "janitor",
    name: copy.control.pipelines.janitor.name,
    description: copy.control.pipelines.janitor.description,
    crons: ["37 22 * * 1-5"],
    workflow: "nightly-a.yml",
    actions: [],
    stages: [],
    providers: [],
    writesPipelineRun: false,
  },
];

/**
 * A run counts as DEGRADED if a source misbehaved, FAILED if a stage broke — the graver fact wins.
 *
 * Only STRING values are verdicts. Since CC8 the dawn stamps a nested object under `dawn` in the
 * night's source_status; a non-string entry is metadata, not a provider's health, so it is ignored
 * here — otherwise a healthy nightly would read DEGRADED the moment a dawn entry sat beside it.
 */
export function statusFromRun(
  stageStatus: Record<string, unknown>,
  sourceStatus: Record<string, unknown>,
): PipelineStatus {
  const stages = Object.values(stageStatus).filter((s): s is string => typeof s === "string");
  const sources = Object.values(sourceStatus).filter((s): s is string => typeof s === "string");
  if (stages.some((s) => s === "failed" || s === "error")) return "FAILED";
  if (sources.some((s) => s !== "ok")) return "DEGRADED";
  return "OK";
}

/** The night's own per-provider map — the string entries, with the dawn (CC8) and janitor (CC10)
 * sub-entries removed: both are nested objects that belong to their own rows, not the nightly's providers. */
function nightSources(sourceStatus: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(sourceStatus)) {
    if (key !== DAWN_KEY && key !== JANITOR_KEY && typeof value === "string") out[key] = value;
  }
  return out;
}

/** The briefing's own status field carries HELD — a brief the gate flagged but still published. */
export function statusFromBriefing(status: string): PipelineStatus {
  if (status === "published") return "OK";
  if (status === "held") return "HELD";
  // skipped, or a value a newer pipeline invents — the safe direction is "go and look".
  return "FAILED";
}

/** "3m 12s" from a millisecond span, "45s" under a minute, null when there is no timing to show. */
export function formatDuration(ms: number | null): string | null {
  if (ms === null) return null;
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** A `pipeline_run` row, mapped for the merged history. */
export type RunRecord = {
  runDate: string;
  finishedAt: Date | null;
  status: PipelineStatus;
};

/** One line of a pipeline's recent-runs list — a scheduled run or a hand-fired one. */
export type RunEvent = {
  key: string;
  when: Date;
  kind: "scheduled" | "manual";
  label: string;
  status: string;
  url: string | null;
};

const REPO = "bishantt/myStockMarket";

function runUrl(ghRunId: string | null): string | null {
  return ghRunId === null ? null : `https://github.com/${REPO}/actions/runs/${ghRunId}`;
}

/**
 * The last ten runs of one pipeline, newest first — its own manual dispatches, plus the scheduled
 * `pipeline_run` records IF it is the pipeline that writes them. A scheduled record is attributed to at
 * most one pipeline: the nightly full owns the run record, so a dawn or briefing sheet never borrows it.
 */
export function mergeRuns(def: PipelineDef, manual: ManualRunRow[], records: RunRecord[]): RunEvent[] {
  const mine: RunEvent[] = manual
    .filter((r) => def.actions.includes(r.action))
    .map((r) => ({
      key: `m:${r.id}`,
      when: r.requestedAt,
      kind: "manual" as const,
      label: r.action,
      status: r.status,
      url: runUrl(r.ghRunId),
    }));

  const scheduled: RunEvent[] = def.writesPipelineRun
    ? records.map((r) => ({
        key: `s:${r.runDate}`,
        // A record's instant is when it finished; a still-running record falls back to its trading day.
        when: r.finishedAt ?? new Date(`${r.runDate}T12:00:00Z`),
        kind: "scheduled" as const,
        label: def.name,
        status: r.status,
        url: null,
      }))
    : [];

  return [...mine, ...scheduled].sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, 10);
}

/** The formatted last-run facts a table row shows — or null when the pipeline has no record to show. */
export type LastRunFacts = {
  status: PipelineStatus;
  stamp: string;
  duration: string | null;
  sources: Record<string, string> | null;
  stages: Record<string, string> | null;
  /** CC10: the janitor row's "Retired last night" line — null on every other pipeline. */
  report: string | null;
};

export type PipelineDisplay = {
  def: PipelineDef;
  cadence: string;
  lastRun: LastRunFacts | null;
};

type RunRow = {
  startedAt: Date;
  finishedAt: Date | null;
  stageStatus: unknown;
  sourceStatus: unknown;
};

function lastRunForNightly(run: RunRow | null): LastRunFacts | null {
  if (!run?.finishedAt) return null;
  const stages = (run.stageStatus ?? {}) as Record<string, string>;
  // The dawn entry rides in the night's source_status (CC8); it belongs to the dawn row, not this
  // one, so it is dropped from the nightly's provider list.
  const sources = nightSources((run.sourceStatus ?? {}) as Record<string, unknown>);
  return {
    status: statusFromRun(stages, sources),
    stamp: formatEtStamp(run.finishedAt),
    duration: formatDuration(run.finishedAt.getTime() - run.startedAt.getTime()),
    sources,
    stages,
    report: null,
  };
}

/**
 * The dawn refresh's Last run, read from the entry publish_dawn stamps beside the night's
 * source_status (CC8, closes Q-CC7-1). Null until a dawn has actually run — the honest "—", exactly
 * what the seeded world (no dawn run) still shows. The dawn carries its own instant (`ranAt`), so its
 * stamp is independent of the night's finishedAt.
 */
export function lastRunForDawn(run: RunRow | null): LastRunFacts | null {
  const dawn = readDawnEntry(run?.sourceStatus);
  if (!dawn?.ranAt) return null;
  const sources = dawn.sources ?? {};
  const stages = dawn.stages ?? {};
  return {
    status: statusFromRun(stages, sources),
    stamp: formatEtStamp(new Date(dawn.ranAt)),
    duration: null,
    sources,
    stages,
    report: null,
  };
}

/**
 * The janitor's Last run, read from the entry publish_janitor stamps beside the night's source_status
 * (CC10, plan 4.8). Null until a janitor has actually run — the honest "—" the seeded world shows if it
 * models none. The stamp is the janitor's own instant; the "Retired last night" line is formatted here,
 * in the mechanical voice (copy.ts), from the counts the entry carries.
 */
export function lastRunForJanitor(run: RunRow | null): LastRunFacts | null {
  const janitor = readJanitorEntry(run?.sourceStatus);
  if (!janitor?.ranAt) return null;
  return {
    status: "OK",
    stamp: formatEtStamp(new Date(janitor.ranAt)),
    duration: null,
    sources: null,
    stages: null,
    report: fill(copy.control.sheet.janitorReport, {
      news: janitor.news ?? 0,
      days: janitor.days ?? 45,
      scans: janitor.scans ?? 0,
      kept: janitor.backupsKept ?? 0,
    }),
  };
}

function lastRunForBriefing(brief: { runDate: Date; status: string } | null): LastRunFacts | null {
  if (!brief) return null;
  return {
    status: statusFromBriefing(brief.status),
    // A briefing carries no wall-clock finish, only its session day — so the stamp is the bare date.
    stamp: formatUtcDate(brief.runDate),
    duration: null,
    sources: null,
    stages: null,
    report: null,
  };
}

/**
 * Everything the table needs from the database — the three rows with their cadence and last-run facts,
 * plus the recent scheduled records for the merged history. The cadence is pure (from the cron); the
 * next run is computed in the browser against the reader's clock (like the control room's states).
 *
 * The dawn refresh's Last run reads the `dawn` entry publish_dawn stamps into the latest run's
 * source_status (CC8) — or "—" until a dawn has run (the seeded world, which has none, still shows it).
 */
export async function loadPipelines(): Promise<{ pipelines: PipelineDisplay[]; records: RunRecord[] }> {
  const [latestRun, recentRuns, latestBriefing] = await Promise.all([
    db.pipelineRun.findFirst({
      where: { finishedAt: { not: null } },
      orderBy: { runDate: "desc" },
      select: { startedAt: true, finishedAt: true, stageStatus: true, sourceStatus: true },
    }),
    db.pipelineRun.findMany({
      orderBy: { runDate: "desc" },
      take: 10,
      select: { runDate: true, finishedAt: true, stageStatus: true, sourceStatus: true },
    }),
    db.briefing.findFirst({ orderBy: { runDate: "desc" }, select: { runDate: true, status: true } }),
  ]);

  const records: RunRecord[] = recentRuns.map((r) => ({
    runDate: toTradingDate(r.runDate),
    finishedAt: r.finishedAt,
    status: statusFromRun(
      (r.stageStatus ?? {}) as Record<string, string>,
      (r.sourceStatus ?? {}) as Record<string, string>,
    ),
  }));

  const pipelines: PipelineDisplay[] = PIPELINES.map((def) => ({
    def,
    cadence: describeCadence(parseCron(def.crons[0])),
    lastRun:
      def.id === "nightly-full"
        ? lastRunForNightly(latestRun)
        : def.id === "evening-briefing"
          ? lastRunForBriefing(latestBriefing)
          : def.id === "dawn-refresh"
            ? lastRunForDawn(latestRun)
            : def.id === "janitor"
              ? lastRunForJanitor(latestRun)
              : null,
  }));

  return { pipelines, records };
}
