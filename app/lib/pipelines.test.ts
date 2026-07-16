import { describe, expect, it } from "vitest";

import { RUN_ACTIONS } from "@/lib/constants";
import type { ManualRunRow } from "@/lib/pipeline-control";
import {
  PIPELINES,
  formatDuration,
  lastRunForDawn,
  lastRunForJanitor,
  mergeRuns,
  statusFromBriefing,
  statusFromRun,
  type RunRecord,
} from "@/lib/pipelines";

/**
 * pipelines.test.ts — the control-room table's pure logic (CC7, plan 4.6).
 *
 * The DB reads live in loadPipelines (the messy half, like readPanel); everything provable without a
 * database is here: the row definitions, the OK/DEGRADED/FAILED/HELD mapping, the duration format, and
 * the manual+scheduled run merge.
 */

describe("the pipeline definitions", () => {
  it("names the rows in reading order — the three CC7 schedules, then CC10's janitor", () => {
    expect(PIPELINES.map((p) => p.id)).toEqual([
      "nightly-full", "dawn-refresh", "evening-briefing", "janitor",
    ]);
  });

  it("gives the janitor no hand-fired mode — deletion is scheduled, never a reader's button (CC10)", () => {
    expect(PIPELINES.find((p) => p.id === "janitor")?.actions).toEqual([]);
    // It rides the nightly full's cron and writes no run row of its own.
    expect(PIPELINES.find((p) => p.id === "janitor")?.crons).toEqual(["37 22 * * 1-5"]);
    expect(PIPELINES.find((p) => p.id === "janitor")?.writesPipelineRun).toBe(false);
  });

  it("assigns every manual action to exactly one sheet — no action is unreachable or duplicated", () => {
    const assigned = PIPELINES.flatMap((p) => p.actions);
    // Every one of the five actions has a home…
    expect([...assigned].sort()).toEqual([...RUN_ACTIONS].sort());
    // …and no action lives in two sheets.
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it("keeps macro as the dawn refresh's one hand-only button (a stage of the dawn run, CC8)", () => {
    expect(PIPELINES.find((p) => p.id === "dawn-refresh")?.actions).toEqual(["macro"]);
  });

  it("carries a real cron line for each row (CC8 moved the dawn to Mon–Fri, pre-open)", () => {
    expect(PIPELINES.find((p) => p.id === "nightly-full")?.crons).toEqual(["37 22 * * 1-5"]);
    expect(PIPELINES.find((p) => p.id === "dawn-refresh")?.crons).toEqual(["30 10 * * 1-5"]);
    expect(PIPELINES.find((p) => p.id === "evening-briefing")?.crons).toEqual(["25 0 * * 2-6"]);
  });
});

describe("statusFromRun — a run's health from its stage and source maps", () => {
  it("is OK when every stage ran and every source reported normally", () => {
    expect(statusFromRun({ ingest: "ok", publish: "ok" }, { alpaca: "ok", fred: "ok" })).toBe("OK");
  });

  it("is DEGRADED when a source did not report normally (the seed's marketaux case)", () => {
    expect(statusFromRun({ ingest: "ok" }, { alpaca: "ok", marketaux: "degraded" })).toBe("DEGRADED");
  });

  it("is FAILED when a stage failed — a stage failure outranks a source degradation", () => {
    expect(statusFromRun({ ingest: "ok", compute: "failed" }, { alpaca: "degraded" })).toBe("FAILED");
  });

  it("ignores the nested dawn entry — a dawn beside the night's sources cannot degrade the night (CC8)", () => {
    // publish_dawn stamps `dawn` as an object; a healthy nightly must stay OK, and a degraded dawn
    // must not leak into the nightly's verdict.
    const dawnBeside = { alpaca: "ok", fred: "ok", dawn: { ranAt: "x", sources: { fred: "degraded" } } };
    expect(statusFromRun({ ingest: "ok", publish: "ok" }, dawnBeside)).toBe("OK");
  });
});

describe("lastRunForDawn — the dawn refresh reads its own stamp from the night's row (CC8, Q-CC7-1)", () => {
  const finishedNight = new Date("2026-07-14T23:36:00Z");
  const nightRow = (sourceStatus: Record<string, unknown>) => ({
    startedAt: new Date("2026-07-14T23:33:00Z"),
    finishedAt: finishedNight,
    stageStatus: { ingest: "ok", publish: "ok" },
    sourceStatus,
  });

  it("is null until a dawn has run — the honest '—', which the seeded world (no dawn) still shows", () => {
    expect(lastRunForDawn(null)).toBeNull();
    // A night with no dawn entry beside it: still no dawn Last run.
    expect(lastRunForDawn(nightRow({ alpaca: "ok" }))).toBeNull();
  });

  it("reads the dawn's own instant, sources and stages once publish_dawn has stamped one", () => {
    const dawn = {
      ranAt: "2026-07-15T10:31:00Z",
      sources: { fred: "ok", fmp: "ok" },
      stages: { macro: "ok", news: "ok", catalysts: "ok", publish: "ok" },
    };
    const facts = lastRunForDawn(nightRow({ alpaca: "ok", marketaux: "degraded", dawn }));
    expect(facts?.status).toBe("OK");
    expect(facts?.sources).toEqual({ fred: "ok", fmp: "ok" }); // the DAWN's sources, not the night's
    expect(facts?.stages).toEqual(dawn.stages);
    expect(facts?.duration).toBeNull(); // the dawn carries an instant, not a span
  });

  it("reports the dawn DEGRADED when a dawn source misbehaved — independent of the night's verdict", () => {
    const dawn = { ranAt: "2026-07-15T10:31:00Z", sources: { fred: "degraded" }, stages: { macro: "ok" } };
    const facts = lastRunForDawn(nightRow({ alpaca: "ok", dawn }));
    expect(facts?.status).toBe("DEGRADED");
  });
});

describe("lastRunForJanitor — the janitor reads its retirements from the night's row (CC10, plan 4.8)", () => {
  const nightRow = (sourceStatus: Record<string, unknown>) => ({
    startedAt: new Date("2026-07-14T23:33:00Z"),
    finishedAt: new Date("2026-07-14T23:36:00Z"),
    stageStatus: { ingest: "ok", publish: "ok" },
    sourceStatus,
  });

  it("is null until a janitor has run — the honest '—' the seeded world shows if it models none", () => {
    expect(lastRunForJanitor(null)).toBeNull();
    expect(lastRunForJanitor(nightRow({ alpaca: "ok" }))).toBeNull();
  });

  it("formats the 'Retired last night' line from the entry's counts, in the mechanical voice", () => {
    const janitor = {
      ranAt: "2026-07-14T23:37:00Z",
      news: 214, days: 45, scans: 1, backupsKept: 8, backupsSeen: 9,
      deleted: { news_item: 200, news_cluster: 12, catalyst_link: 2, scan_result: 30 },
    };
    const facts = lastRunForJanitor(nightRow({ alpaca: "ok", janitor }));
    expect(facts?.status).toBe("OK");
    expect(facts?.report).toBe(
      "Retired last night: 214 news items past 45d · 1 sessions of scan rows · backups kept 8",
    );
  });
});

describe("statusFromBriefing — the briefing's own status field, where HELD lives", () => {
  it("maps a published brief to OK", () => {
    expect(statusFromBriefing("published")).toBe("OK");
  });

  it("maps a held brief to HELD (the gate flagged something; it published, quietly)", () => {
    expect(statusFromBriefing("held")).toBe("HELD");
  });

  it("maps a skipped or unknown status to FAILED — go and look", () => {
    expect(statusFromBriefing("skipped")).toBe("FAILED");
    expect(statusFromBriefing("nonsense")).toBe("FAILED");
  });
});

describe("formatDuration", () => {
  it("is the honest unknown when there is no timing", () => {
    expect(formatDuration(null)).toBeNull();
  });

  it("reads seconds under a minute", () => {
    expect(formatDuration(45_000)).toBe("45s");
  });

  it("reads minutes and seconds — the seed's 3-minute nightly", () => {
    expect(formatDuration(180_000)).toBe("3m 0s");
    expect(formatDuration(192_000)).toBe("3m 12s");
  });
});

describe("mergeRuns — manual + scheduled, newest first, per pipeline", () => {
  const nightlyFull = PIPELINES.find((p) => p.id === "nightly-full")!;
  const dawn = PIPELINES.find((p) => p.id === "dawn-refresh")!;

  const manual: ManualRunRow[] = [
    { id: "m1", action: "news", requestedAt: new Date("2026-07-14T18:00:00Z"), status: "succeeded", ghRunId: "1", finishedAt: new Date("2026-07-14T18:05:00Z") },
    { id: "m2", action: "macro", requestedAt: new Date("2026-07-14T12:00:00Z"), status: "failed", ghRunId: "2", finishedAt: null },
    { id: "m3", action: "briefing", requestedAt: new Date("2026-07-13T20:00:00Z"), status: "succeeded", ghRunId: "3", finishedAt: null },
  ];
  const records: RunRecord[] = [
    { runDate: "2026-07-14", finishedAt: new Date("2026-07-14T22:40:00Z"), status: "DEGRADED" },
  ];

  it("keeps only the manual actions this sheet owns, plus the sheet's scheduled records", () => {
    const events = mergeRuns(nightlyFull, manual, records);
    // news is a nightly-full action; macro and briefing are NOT (they belong to other sheets).
    expect(events.map((e) => e.kind + ":" + e.label)).toEqual([
      `scheduled:${nightlyFull.name}`, // 22:40 — newest
      "manual:news", // 18:00
    ]);
  });

  it("attributes scheduled pipeline_run records only to the pipeline that writes them", () => {
    // The dawn refresh owns `macro` but writes NO pipeline_run of its own (CC7) — so no scheduled row.
    const events = mergeRuns(dawn, manual, records);
    expect(events.map((e) => e.label)).toEqual(["macro"]);
    expect(events.every((e) => e.kind === "manual")).toBe(true);
  });

  it("caps the merged list at ten", () => {
    const many: ManualRunRow[] = Array.from({ length: 15 }, (_, i) => ({
      id: `x${i}`,
      action: "news" as const,
      requestedAt: new Date(Date.UTC(2026, 6, 1, i)),
      status: "succeeded" as const,
      ghRunId: String(i),
      finishedAt: null,
    }));
    expect(mergeRuns(nightlyFull, many, []).length).toBe(10);
  });
});
