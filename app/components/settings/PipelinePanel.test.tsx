import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PipelinePanel, revive } from "@/components/settings/PipelinePanel";
import type { ActionRow, ManualRunRow } from "@/lib/pipeline-control";

// The panel imports a "use server" action. Nothing here presses a button, so a stub keeps the test
// in jsdom instead of dragging Prisma and node:crypto into it.
vi.mock("@/app/(desk)/settings/pipeline-actions", () => ({
  runPipeline: vi.fn(async () => ({ ok: true })),
}));

/**
 * THE BUG THIS FILE EXISTS FOR, AND IT SHIPPED PAST 572 GREEN TESTS.
 *
 * The panel's first render comes from a server component, which hands it real `Date` objects. It
 * mounts perfectly. Then it POLLS — and `JSON.parse` has no Date type, so every instant comes back
 * as a **string**. `formatEtClock("2026-07-13T19:04:00.000Z")` throws `RangeError: Invalid time
 * value`, the panel died on re-render, and React kept the old DOM on screen.
 *
 * So a REAL run — dispatched, accepted by GitHub, executed, completed, and written to the ledger —
 * left the screen showing a Run button and "2 of 2 left today", exactly as if the press had done
 * nothing. **A run that fired and a run that never fired looked identical from the couch.** That is
 * the exact failure this phase was warned about, reached by a route I had not guarded.
 *
 * Not one unit test could see it, because they all built their inputs in memory, where a Date is a
 * Date. The bug lives ONLY on the wire. So this test puts the payload ON the wire.
 */

const COOLDOWN_ROW: ActionRow = {
  action: "macro",
  label: "Refresh macro stats",
  description: "Re-read rates, gold, FX and the gauge inputs.",
  state: { kind: "cooldown", availableAt: new Date("2026-07-13T19:04:00.000Z") },
  capLine: "5 of 6 left today",
};

const RUNNING_ROW: ActionRow = {
  action: "news",
  label: "Refresh the news",
  description: "Fetch today's articles, re-rank the front page. ~$0.15 of API budget.",
  state: {
    kind: "running",
    since: new Date("2026-07-13T19:00:00.000Z"),
    runUrl: "https://github.com/bishantt/myStockMarket/actions/runs/123",
  },
  capLine: null,
};

const HISTORY: ManualRunRow[] = [
  {
    id: "abc",
    action: "macro",
    requestedAt: new Date("2026-07-13T18:34:36.000Z"),
    status: "succeeded",
    ghRunId: "29274995603",
    finishedAt: new Date("2026-07-13T18:36:00.000Z"),
  },
];

/** Exactly what the poll does: serialize on the server, parse on the client. */
function overTheWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("the JSON round-trip the panel's own poll performs", () => {
  it("brings every instant back as a real Date", () => {
    const wire = overTheWire({ rows: [COOLDOWN_ROW, RUNNING_ROW], history: HISTORY });

    const revived = revive(wire);

    // The three fields that carry an instant. Miss any one and the panel throws where it prints it.
    const cooldown = revived.rows[0].state;
    expect(cooldown.kind === "cooldown" && cooldown.availableAt).toBeInstanceOf(Date);
    const running = revived.rows[1].state;
    expect(running.kind === "running" && running.since).toBeInstanceOf(Date);
    expect(revived.history[0].requestedAt).toBeInstanceOf(Date);
    expect(revived.history[0].finishedAt).toBeInstanceOf(Date);
  });

  it("RENDERS after the round-trip — the consequence, not the shape", () => {
    // The assertion that would actually have caught it. Checking that the keys survive proves
    // nothing: they always did. What broke was the RENDER, three components away from the parse.
    const revived = revive(overTheWire({ rows: [COOLDOWN_ROW, RUNNING_ROW], history: HISTORY }));

    render(
      <PipelinePanel rows={revived.rows} history={revived.history} lastRun={null} configured />,
    );

    expect(screen.getByText(/available again at/)).toBeInTheDocument();
    expect(screen.getByText(/running —/)).toBeInTheDocument();
    // The word is in the chip — a run's outcome never rides on colour alone.
    expect(screen.getByText("succeeded")).toBeInTheDocument();
  });

  it("NEGATIVE CONTROL: without revive(), the same payload throws where it prints the time", () => {
    // The guard has to be able to fail, or it is not a guard. This build has shipped three tests
    // that could not. Feed the panel the raw parsed payload — strings where Dates should be — and
    // it must blow up exactly as it did in production.
    const raw = overTheWire({ rows: [COOLDOWN_ROW], history: [] }) as {
      rows: ActionRow[];
      history: ManualRunRow[];
    };

    expect(() =>
      render(<PipelinePanel rows={raw.rows} history={raw.history} lastRun={null} configured />),
    ).toThrow(/Invalid time value/);
  });
});
