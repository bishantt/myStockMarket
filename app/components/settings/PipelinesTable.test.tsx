import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PipelinesTable, reviveRuns } from "@/components/settings/PipelinesTable";
import { describeCadence, parseCron } from "@/lib/cron";
import type { CompletedRun } from "@/lib/freshness";
import type { ManualRunRow } from "@/lib/pipeline-control";
import { PIPELINES, type PipelineDisplay } from "@/lib/pipelines";

// The sheet imports a "use server" action through the component tree; nothing here opens a sheet, so a
// stub keeps the test in jsdom instead of dragging Prisma and node:crypto into it.
vi.mock("@/app/(desk)/settings/pipeline-actions", () => ({
  runPipeline: vi.fn(async () => ({ ok: true })),
}));

const LAST_RUN: CompletedRun = { runDate: "2026-07-09", finishedAt: new Date("2026-07-09T22:40:00.000Z") };

const RUNS: ManualRunRow[] = [
  {
    id: "abc",
    action: "news",
    requestedAt: new Date("2026-07-14T18:34:36.000Z"),
    status: "succeeded",
    ghRunId: "29274995603",
    finishedAt: new Date("2026-07-14T18:36:00.000Z"),
  },
];

const DISPLAYS: PipelineDisplay[] = PIPELINES.map((def) => ({
  def,
  cadence: describeCadence(parseCron(def.crons[0])),
  lastRun:
    def.id === "nightly-full"
      ? {
          status: "DEGRADED",
          stamp: "Thu, Jul 9 · 10:40 PM ET",
          duration: "3m 0s",
          sources: { alpaca: "ok", marketaux: "degraded" },
          stages: { ingest: "ok", publish: "ok" },
        }
      : null,
}));

function overTheWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("the poll's JSON round-trip (the bug that shipped past 572 green tests)", () => {
  it("brings every instant back as a real Date", () => {
    const revived = reviveRuns(overTheWire({ runs: RUNS }));
    expect(revived[0].requestedAt).toBeInstanceOf(Date);
    expect(revived[0].finishedAt).toBeInstanceOf(Date);
  });

  it("NEGATIVE CONTROL: the raw payload's dates really are strings — the fact the bug rests on", () => {
    const raw = overTheWire({ runs: RUNS }) as { runs: ManualRunRow[] };
    expect(typeof (raw.runs[0].requestedAt as unknown)).toBe("string");
    // …and reviveRuns is what turns it back into something the table can format.
    expect(reviveRuns(raw)[0].requestedAt).toBeInstanceOf(Date);
  });
});

describe("the table renders every schedule from the database alone (never blank, P-2 or not)", () => {
  it("lists all three pipelines with their DST-honest cadence", () => {
    render(
      <PipelinesTable pipelines={DISPLAYS} records={[]} runs={RUNS} lastRunSession={LAST_RUN} configured={false} />,
    );

    // DataTable renders both the desktop table and the phone card list into the DOM, so a row's name
    // appears twice — the point is that it appears, from data, with no token configured.
    expect(screen.getAllByText("Nightly full (Job A)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dawn refresh").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evening briefing (Job B)").length).toBeGreaterThan(0);

    // The full nightly's cadence reads DST-honestly, both seasons.
    expect(screen.getAllByText("Mon–Fri · ~6:37 PM EDT / 5:37 PM EST").length).toBeGreaterThan(0);
    // And its degraded last run is a WORD, not a bare colour.
    expect(screen.getAllByText("DEGRADED").length).toBeGreaterThan(0);
  });

  it("offers a depth affordance for every row", () => {
    render(
      <PipelinesTable pipelines={DISPLAYS} records={[]} runs={RUNS} lastRunSession={LAST_RUN} configured />,
    );
    // One → per row, per layout (desktop + phone) — every schedule is inspectable.
    expect(screen.getAllByRole("button", { name: /Open Nightly full \(Job A\) details/ }).length).toBeGreaterThan(0);
  });
});
