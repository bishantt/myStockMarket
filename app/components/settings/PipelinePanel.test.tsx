import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PipelinePanel, revive } from "@/components/settings/PipelinePanel";
import type { ManualRunRow } from "@/lib/pipeline-control";
import type { CompletedRun } from "@/lib/freshness";

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

const LAST_RUN: CompletedRun = {
  runDate: "2026-07-10",
  finishedAt: new Date("2026-07-10T22:41:00.000Z"),
};

const RUNS: ManualRunRow[] = [
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
    const wire = overTheWire({ runs: RUNS, lastRun: LAST_RUN });

    const revived = revive(wire);

    // Every field that carries an instant. Miss one and the panel throws where it prints it.
    expect(revived.runs[0].requestedAt).toBeInstanceOf(Date);
    expect(revived.runs[0].finishedAt).toBeInstanceOf(Date);
    expect(revived.lastRun?.finishedAt).toBeInstanceOf(Date);
  });

  it("RENDERS after the round-trip — the consequence, not the shape", () => {
    // The assertion that would actually have caught it. Checking that the keys survive proves
    // nothing: they always did. What broke was the RENDER, three components away from the parse.
    const revived = revive(overTheWire({ runs: RUNS, lastRun: LAST_RUN }));

    render(
      <PipelinePanel
        runs={revived.runs}
        lastRunSession={revived.lastRun}
        lastRun={null}
        configured
      />,
    );

    // The word is in the chip — a run's outcome never rides on colour alone.
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    // And the panel derived its rows without throwing on a stringified date.
    expect(screen.getByText("Refresh the news")).toBeInTheDocument();
  });

  it("NEGATIVE CONTROL: the raw payload's dates really are strings, not Dates", () => {
    // The guard has to be able to fail, or it is not a guard. This build has shipped three tests
    // that could not. This is the fact the whole bug rests on: JSON has no Date type.
    const raw = overTheWire({ runs: RUNS, lastRun: LAST_RUN }) as {
      runs: ManualRunRow[];
      lastRun: CompletedRun;
    };

    expect(raw.runs[0].requestedAt).not.toBeInstanceOf(Date);
    expect(typeof (raw.runs[0].requestedAt as unknown)).toBe("string");
    // ...and revive() is what turns it back into something the panel can format.
    expect(revive(raw).runs[0].requestedAt).toBeInstanceOf(Date);
  });
});

describe("the missing GitHub token (P-2)", () => {
  it("states the reason ONCE, not once per row", () => {
    // The first build printed it on all five rows — which every test passed, and one screenshot
    // refuted immediately. The STATE is per-row; the REASON is per-panel.
    render(<PipelinePanel runs={[]} lastRunSession={LAST_RUN} lastRun={null} configured={false} />);

    expect(screen.getAllByText(/Manual runs need a GitHub token/)).toHaveLength(1);
    // And no row pretends it could dispatch.
    expect(screen.queryAllByRole("button", { name: "Run" })).toHaveLength(0);
  });
});
