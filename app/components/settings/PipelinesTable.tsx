"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/DataTable";
import { OutcomeChip, type OutcomeTone } from "@/components/OutcomeChip";
import { OverlayMount } from "@/components/OverlayMount";
import { copy, fill } from "@/lib/copy";
import { describeNextRun, parseCron } from "@/lib/cron";
import type { CompletedRun } from "@/lib/freshness";
import type { ManualRunRow } from "@/lib/pipeline-control";
import type { LastRunFacts, PipelineDef, PipelineDisplay, PipelineId, RunRecord } from "@/lib/pipelines";
import type { Column } from "@/lib/table";

/**
 * PipelinesTable — the control room, as a table of the Desk's schedules (CC7, plan 4.6).
 *
 * It replaces the old flat PipelinePanel with the app's one table (DataTable) plus a per-row detail
 * sheet. The table is INFORMATIVE FROM THE DATABASE ALONE — cadence, next run, last run, duration — so it
 * is never blank, with or without a GitHub token (P-2); the run-now controls, and the token's absence,
 * live in the sheets. The manual modes are actions, not rows: each opens inside the pipeline it belongs
 * to.
 *
 * TWO CLOCKS, ONE RULE. The cadence is clock-independent and computed on the server (pure, from the cron
 * line). The NEXT run turns on what time it is, so it is computed HERE, in the browser, against the
 * reader's own clock — exactly as the control-room states already are, so the table and the nav can never
 * disagree, and the VRT baseline (which pins the clock) stays deterministic instead of rotting with the
 * hour CI happens to run.
 */

/**
 * The sheet chrome loads only on the first open — the same code-split the story/ticker overlays use to
 * keep a room's first-load lean. The table itself is INFORMATIVE FROM DATA ALONE, so nothing the reader
 * sees on arrival waits on this chunk; opening a row fetches the sheet (and, inside it, the Radix dialog).
 */
const PipelineSheet = dynamic(() =>
  import("@/components/settings/PipelineSheet").then((mod) => mod.PipelineSheet),
);

const POLL_MS = 15_000;
const LIVE: ReadonlySet<ManualRunRow["status"]> = new Set(["requested", "queued", "running"]);

const STATUS_TONE: Record<string, OutcomeTone> = {
  OK: "neutral",
  HELD: "neutral",
  DEGRADED: "negative",
  FAILED: "negative",
};

type Props = {
  pipelines: PipelineDisplay[];
  records: RunRecord[];
  runs: ManualRunRow[];
  lastRunSession: CompletedRun | null;
  configured: boolean;
};

/**
 * The poll returns JSON, which has no Date type — so every instant comes back a STRING and the state
 * machine throws where it formats one (the exact bug that shipped past 572 green tests). Convert at the
 * boundary; `new Date(x)` is idempotent on a Date or an ISO string.
 */
export function reviveRuns(payload: unknown): ManualRunRow[] {
  const raw = payload as { runs: ManualRunRow[] };
  return raw.runs.map((run) => ({
    ...run,
    requestedAt: new Date(run.requestedAt),
    finishedAt: run.finishedAt === null ? null : new Date(run.finishedAt),
  }));
}

/** The next fire, in ET, computed against the mounted clock. "—" until the clock lands (first paint). */
function nextRunLabel(def: PipelineDef, now: string | null): string {
  if (!now) return "—";
  try {
    return describeNextRun(parseCron(def.crons[0]), new Date(now));
  } catch {
    return "—";
  }
}

export function PipelinesTable({ pipelines, records, runs: initialRuns, lastRunSession, configured }: Props) {
  const [runs, setRuns] = useState(initialRuns);
  const [openId, setOpenId] = useState<PipelineId | null>(null);

  // The clock is read ONCE, on mount. Reading it during render would break hydration; a module var would
  // freeze a tab left open overnight. Same shape as the old panel's `now`.
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe clock; see above
    setNow(new Date().toISOString());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/pipeline/status", { cache: "no-store" });
      if (!response.ok) {
        console.error(`PipelinesTable: the status route answered ${response.status}`);
        return; // a blip must not blank the table; the next tick tries again
      }
      setRuns(reviveRuns(await response.json()));
    } catch (error) {
      // Offline, or the route is down. The table keeps showing what it last knew. Logged, never
      // swallowed: a poll that quietly stopped looks like nothing to report.
      console.error("PipelinesTable: could not read the pipeline's status", error);
    }
  }, []);

  const anyLive = runs.some((r) => LIVE.has(r.status));
  useEffect(() => {
    if (!anyLive) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [anyLive, refresh]);

  const columns = useMemo<Column<PipelineDisplay>[]>(
    () => [
      {
        key: "pipeline",
        header: copy.control.col.pipeline,
        priority: 1,
        sortable: false,
        kind: "text",
        value: (p) => p.def.name,
        render: (p) => (
          <div className="flex flex-col">
            <span className="font-ui text-sm font-bold text-ink">{p.def.name}</span>
            <span className="max-w-[48ch] font-ui text-2xs text-muted">{p.def.description}</span>
          </div>
        ),
      },
      {
        key: "cadence",
        header: copy.control.col.cadence,
        priority: 2,
        sortable: false,
        kind: "text",
        value: (p) => p.cadence,
        render: (p) => <span className="font-ui text-sm text-ink-2">{p.cadence}</span>,
      },
      {
        key: "lastRun",
        header: copy.control.col.lastRun,
        priority: 2,
        sortable: false,
        kind: "text",
        value: (p) => p.lastRun?.status ?? null,
        render: (p) => <LastRunCell facts={p.lastRun} />,
      },
      {
        key: "nextRun",
        header: copy.control.col.nextRun,
        priority: 2,
        sortable: false,
        kind: "text",
        value: (p) => nextRunLabel(p.def, now),
        render: (p) => <span className="font-ui text-sm text-ink-2">{nextRunLabel(p.def, now)}</span>,
      },
      {
        key: "duration",
        header: copy.control.col.duration,
        priority: 2,
        sortable: false,
        kind: "mono",
        value: (p) => p.lastRun?.duration ?? null,
        render: (p) => (
          <span className="font-mono text-sm tabular-nums text-ink-2">{p.lastRun?.duration ?? "—"}</span>
        ),
      },
      {
        key: "open",
        header: "",
        priority: 1,
        sortable: false,
        kind: "text",
        align: "right",
        value: () => "",
        render: (p) => (
          <button
            type="button"
            onClick={() => setOpenId(p.def.id)}
            aria-label={fill(copy.control.openSheet, { name: p.def.name })}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-lg text-muted hover:bg-accent-soft hover:text-accent-deep"
          >
            <span aria-hidden="true">→</span>
          </button>
        ),
      },
    ],
    [now],
  );

  const open = pipelines.find((p) => p.def.id === openId) ?? null;

  return (
    <div>
      <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">
        {copy.control.title}
      </h2>
      <div className="mt-1 h-px bg-hairline-strong" />

      <div className="pt-4">
        <DataTable
          columns={columns}
          rows={pipelines}
          // No column has this key, so DataTable leaves the rows in the order given — the reading order
          // (nightly, dawn, briefing), not an alphabetical sort. sortable is off besides.
          defaultSort={{ key: "reading-order", dir: "asc" }}
          rowKey={(p) => p.def.id}
          ariaLabel={copy.control.tableLabel}
          sortable={false}
        />
      </div>

      {open ? (
        <OverlayMount title={open.def.name} onClose={() => setOpenId(null)}>
          <PipelineSheet
            display={open}
            runs={runs}
            records={records}
            lastRunSession={lastRunSession}
            configured={configured}
            now={now ? new Date(now) : null}
            onDispatched={refresh}
          />
        </OverlayMount>
      ) : null}
    </div>
  );
}

/** The last-run cell: the status word in a chip + when it ran, or the honest "—" when there is no record. */
function LastRunCell({ facts }: { facts: LastRunFacts | null }) {
  if (!facts) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <OutcomeChip tone={STATUS_TONE[facts.status] ?? "neutral"} label={facts.status} />
      <span className="font-mono text-2xs text-muted">{facts.stamp}</span>
    </span>
  );
}
