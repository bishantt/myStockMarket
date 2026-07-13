import { describe, expect, it } from "vitest";

import { RUN_CAPS, RUN_LOOKUP_TIMEOUT_SECONDS } from "@/lib/constants";
import { controlPanel, type ManualRunRow } from "@/lib/pipeline-control";
import type { CompletedRun } from "@/lib/freshness";

/**
 * The control room's state matrix (N6, plan 8.5).
 *
 * `controlPanel` is a pure function of four things — the manual-run ledger, the last completed
 * pipeline run, the clock, and whether the GitHub token exists — so every state the reader can ever
 * see is reachable from a test, with no database, no browser and no network.
 *
 * THE MOST IMPORTANT TESTS IN THIS FILE ARE THE ONES ABOUT THE ABSENCE OF A BUTTON. Plan 8.1 did the
 * honest evaluation and found that on a normal weeknight the pipeline has already run and a manual
 * re-run would recompute identical data — so **the honest control for that case is the explanation,
 * not the button**. Most of the time this panel is a piece of writing, not a row of controls, and
 * the sentences are the feature.
 */

// A Tuesday. The market closed at 4:00pm ET; the nightly fires at 6:37pm ET.
const TUE_10AM = new Date("2026-07-14T14:00:00Z"); // 10:00am ET — market OPEN
const TUE_5PM = new Date("2026-07-14T21:00:00Z"); // 5:00pm ET — closed, before the nightly
const TUE_8PM = new Date("2026-07-15T00:00:00Z"); // 8:00pm ET Tue — after the nightly
const SATURDAY = new Date("2026-07-18T16:00:00Z"); // noon ET Saturday
const THANKSGIVING = new Date("2026-11-26T16:00:00Z"); // noon ET, a full closure

/** Tuesday's edition, landed. */
const TUESDAY_RAN: CompletedRun = {
  runDate: "2026-07-14",
  finishedAt: new Date("2026-07-14T22:41:00Z"),
};
/** Friday's edition — the newest that exists over the weekend. */
const FRIDAY_RAN: CompletedRun = {
  runDate: "2026-07-17",
  finishedAt: new Date("2026-07-17T22:41:00Z"),
};

function panel(over: Partial<Parameters<typeof controlPanel>[0]> = {}) {
  return controlPanel({
    runs: [],
    lastRun: TUESDAY_RAN,
    now: TUE_8PM,
    tokenConfigured: true,
    ...over,
  });
}

/** The row for one action, by name. */
function row(rows: ReturnType<typeof controlPanel>, action: string) {
  const found = rows.find((r) => r.action === action);
  if (!found) throw new Error(`no row for ${action}`);
  return found;
}

function requested(over: Partial<ManualRunRow> = {}): ManualRunRow {
  return {
    id: "req_1",
    action: "macro",
    requestedAt: TUE_8PM,
    status: "requested",
    ghRunId: null,
    finishedAt: null,
    ...over,
  };
}

describe("the panel always offers every action", () => {
  it("renders one row per action, in a fixed order, whatever the state", () => {
    // The rows are the app's own contract with the reader about what it CAN do. A row that vanishes
    // when it is unavailable teaches the reader the feature does not exist.
    expect(panel().map((r) => r.action)).toEqual(["full", "news", "macro", "compute", "briefing"]);
  });
});

describe("the missing GitHub token (P-2)", () => {
  it("puts the dispatchable rows in not_configured", () => {
    const rows = panel({ tokenConfigured: false });

    for (const action of ["news", "macro", "compute", "briefing"]) {
      expect(row(rows, action).state.kind).toBe("not_configured");
    }
  });

  it("does not pretend a run could be dispatched", () => {
    // No row may be `available` without a token — that button would fail on press.
    const rows = panel({ tokenConfigured: false });
    expect(rows.some((r) => r.state.kind === "available")).toBe(false);
  });

  it("STILL tells the reader why `full` could not run anyway — the world outranks the config", () => {
    // A FACT ABOUT THE WORLD OUTRANKS A FACT ABOUT OUR CONFIGURATION.
    //
    // not_configured used to be checked first and it swallowed everything: with P-2 unprovisioned,
    // every row read "not configured" and the four C5 sentences — the best writing on this panel,
    // and the entire point of plan 8.1 — never rendered AT ALL. The reader could not even discover
    // that the product had thought about this.
    //
    // "Markets are open, so today's closing data does not exist yet" is true whether or not we hold
    // a GitHub token. The token is our problem, it is temporary, and the panel states it once at the
    // top rather than on every row.
    const state = row(panel({ tokenConfigured: false, now: TUE_10AM, lastRun: null }), "full").state;

    expect(state.kind).toBe("not_applicable");
    expect(state.kind === "not_applicable" && state.reason).toContain("today's closing data doesn't exist");
  });
});

describe("`full` — the one action with real reasons to refuse (plan 8.4, the session-night guard)", () => {
  it("is NOT available while the market is open, and says today's close does not exist yet", () => {
    const state = row(panel({ now: TUE_10AM, lastRun: null }), "full").state;

    expect(state.kind).toBe("not_applicable");
    // THE POINT OF THE WHOLE PHASE. Ingesting today's EOD bars before the close is impossible by
    // design — the data does not exist. A `full` run at 10am would write half a day of unformed
    // bars over the last good close.
    expect(state.kind === "not_applicable" && state.reason).toContain("today's closing data doesn't exist");
  });

  it("is NOT available once tonight's run has already succeeded — there is nothing newer to fetch", () => {
    const state = row(panel({ now: TUE_8PM, lastRun: TUESDAY_RAN }), "full").state;

    expect(state.kind).toBe("not_applicable");
    expect(state.kind === "not_applicable" && state.reason).toContain("already succeeded");
  });

  it("IS available after the close when tonight's edition never landed — the recovery case", () => {
    // This is reason (a) in plan 8.1, and the single most valuable button here: the nightly failed
    // or never fired, and recovering it currently means going to the GitHub UI.
    const monday: CompletedRun = { runDate: "2026-07-13", finishedAt: new Date("2026-07-13T22:41:00Z") };

    expect(row(panel({ now: TUE_8PM, lastRun: monday }), "full").state.kind).toBe("available");
  });

  it("IS available after the close and before the nightly fires — the data exists, the run has not happened", () => {
    const monday: CompletedRun = { runDate: "2026-07-13", finishedAt: new Date("2026-07-13T22:41:00Z") };

    // 5pm Tuesday: the market shut at 4, so Tuesday's close is real and ingestable, and the
    // scheduled run is still 1h37m away. Running early is legitimate.
    expect(row(panel({ now: TUE_5PM, lastRun: monday }), "full").state.kind).toBe("available");
  });

  it("names the weekend, and names the day the next data lands", () => {
    const state = row(panel({ now: SATURDAY, lastRun: FRIDAY_RAN }), "full").state;

    expect(state.kind).toBe("not_applicable");
    const reason = state.kind === "not_applicable" ? state.reason : "";
    expect(reason).toContain("weekend");
    expect(reason).toContain("Friday"); // the last close that exists
    expect(reason).toContain("Monday"); // when anything new lands
  });

  it("names the HOLIDAY — not just 'closed'", () => {
    const wednesday: CompletedRun = { runDate: "2026-11-25", finishedAt: new Date("2026-11-25T22:41:00Z") };
    const state = row(panel({ now: THANKSGIVING, lastRun: wednesday }), "full").state;

    expect(state.kind).toBe("not_applicable");
    // "US markets are closed today (Thanksgiving)". The name is why the holiday list carries names
    // as DATA now rather than as `//` comments — a comment is a name the program cannot read.
    expect(state.kind === "not_applicable" && state.reason).toContain("Thanksgiving");
  });
});

describe("the other four actions are safe at any hour, by construction", () => {
  it.each(["news", "macro", "compute", "briefing"])(
    "%s stays available with the market open — it does not touch a price",
    (action) => {
      // `news` re-reads news. `macro` re-reads rates. `compute` reads STORED bars. `briefing`
      // re-assembles stored data. Not one of them depends on a session having closed, which is
      // exactly why they are the four cases plan 8.1 found that earn a real button.
      expect(row(panel({ now: TUE_10AM }), action).state.kind).toBe("available");
    },
  );

  it("keeps them available on a weekend too", () => {
    const rows = panel({ now: SATURDAY, lastRun: FRIDAY_RAN });
    for (const action of ["news", "macro", "compute", "briefing"]) {
      expect(row(rows, action).state.kind).toBe("available");
    }
  });
});

describe("caps and cooldowns (plan 8.4)", () => {
  it("counts down the cap in the reader's own words", () => {
    const rows = panel({ runs: [requested({ action: "news", status: "succeeded" })] });
    // news is 2/day, and one is spent.
    expect(row(rows, "news").capLine).toBe("1 of 2 left today");
  });

  it("caps an action once its daily allowance is spent, and says when it resets", () => {
    const twoNewsRuns = [
      requested({ id: "a", action: "news", status: "succeeded" }),
      requested({ id: "b", action: "news", status: "succeeded" }),
    ];

    expect(row(panel({ runs: twoNewsRuns }), "news").state.kind).toBe("capped");
  });

  it("counts a FAILED run against the cap — the provider requests were still spent", () => {
    const twoNewsRuns = [
      requested({ id: "a", action: "news", status: "succeeded" }),
      requested({ id: "b", action: "news", status: "failed", finishedAt: TUE_8PM }),
    ];

    // A news run that died halfway still called Marketaux. Pretending otherwise is how a cap
    // designed around a 100-request daily budget quietly stops protecting it.
    expect(row(panel({ runs: twoNewsRuns }), "news").state.kind).toBe("capped");
  });

  it("does not count YESTERDAY's runs — the cap resets at midnight ET", () => {
    const yesterday = new Date("2026-07-14T03:00:00Z"); // 11pm ET on MONDAY
    const rows = panel({
      now: TUE_8PM,
      runs: [
        requested({ id: "a", action: "news", status: "succeeded", requestedAt: yesterday }),
        requested({ id: "b", action: "news", status: "succeeded", requestedAt: yesterday }),
      ],
    });

    // Counted in ET, not UTC. Both of those runs are 11pm Monday ET — which is already Tuesday in
    // UTC. Count them in UTC and the reader loses two of Tuesday's runs to Monday's spending.
    expect(row(rows, "news").state.kind).toBe("available");
    expect(row(rows, "news").capLine).toBe("2 of 2 left today");
  });

  it("holds macro in cooldown for 30 minutes and says when it comes back", () => {
    const tenMinutesAgo = new Date(TUE_8PM.getTime() - 10 * 60_000);
    const rows = panel({ runs: [requested({ action: "macro", status: "succeeded", requestedAt: tenMinutesAgo })] });

    const state = row(rows, "macro").state;
    expect(state.kind).toBe("cooldown");
    // Nothing macro reads moves faster than half an hour, so a second press inside it would refetch
    // identical numbers. The honest control for that is the explanation, not the button.
    expect(state.kind === "cooldown" && state.availableAt.getTime()).toBe(
      tenMinutesAgo.getTime() + RUN_CAPS.macro.cooldownMinutes * 60_000,
    );
  });

  it("lets macro go again once the cooldown has passed", () => {
    const longAgo = new Date(TUE_8PM.getTime() - 31 * 60_000);
    const rows = panel({ runs: [requested({ action: "macro", status: "succeeded", requestedAt: longAgo })] });

    expect(row(rows, "macro").state.kind).toBe("available");
  });
});

describe("a run in flight", () => {
  it("shows the run's own row as requested while GitHub is still creating it", () => {
    const rows = panel({ runs: [requested({ action: "macro", status: "requested" })] });
    expect(row(rows, "macro").state.kind).toBe("requested");
  });

  it("BLOCKS every other action while one run is pending — runs are serialized", () => {
    const rows = panel({ runs: [requested({ action: "macro", status: "running", ghRunId: "99" })] });

    // The jobs share a concurrency group and GitHub keeps only the LATEST queued run in a group,
    // silently discarding the ones it superseded. A second dispatch now might simply evaporate. So
    // the panel refuses it as a state, rather than offering a button whose result is a run that
    // quietly never happened.
    expect(row(rows, "news").state.kind).toBe("blocked");
    expect(row(rows, "compute").state.kind).toBe("blocked");
    expect(row(rows, "macro").state.kind).toBe("running");
  });

  it("reports a running run with the link to its log", () => {
    const state = row(panel({ runs: [requested({ action: "news", status: "running", ghRunId: "12345" })] }), "news").state;

    expect(state.kind).toBe("running");
    expect(state.kind === "running" && state.runUrl).toContain("12345");
  });

  it("reports a failed run plainly, and links the log so the reader can see why", () => {
    const rows = panel({
      runs: [requested({ action: "news", status: "failed", ghRunId: "777", finishedAt: TUE_8PM })],
    });

    const state = row(rows, "news").state;
    expect(state.kind).toBe("failed");
    expect(state.kind === "failed" && state.runUrl).toContain("777");
  });
});

describe("THE SILENT FAILURE: a run that was dispatched and never appeared", () => {
  /*
   * The hazard this phase was warned about, and it is real here in a way it is not anywhere else in
   * the app: **a run that did nothing and a run that was never dispatched look the same from the
   * couch.**
   *
   * The dispatch API answers 204 with an EMPTY BODY — no run id, contrary to both the plan and
   * GitHub's own REST docs (recorded 2026-07-13). So the app must HUNT for its run by matching the
   * request id in the run's name. Usually that takes a second or two.
   *
   * If it never resolves — a bad token, a deleted workflow, a GitHub incident — and the panel simply
   * kept showing "requested…", then the reader would sit watching a spinner for a run that does not
   * exist and never will, with nothing anywhere telling them so. The absence has to be COUNTED and
   * SAID.
   */
  it("gives up looking after the timeout and SAYS the run never appeared", () => {
    const longAgo = new Date(TUE_8PM.getTime() - (RUN_LOOKUP_TIMEOUT_SECONDS + 5) * 1000);
    const rows = panel({
      runs: [requested({ action: "macro", status: "requested", ghRunId: null, requestedAt: longAgo })],
    });

    expect(row(rows, "macro").state.kind).toBe("lost");
  });

  it("does NOT cry lost while the run is still plausibly being created", () => {
    // A bound that trips on a healthy run is not a safety rail, it is a false alarm — the lesson
    // from N5's 30-second extraction timeout, which was itself too tight.
    const justNow = new Date(TUE_8PM.getTime() - 3000);
    const rows = panel({
      runs: [requested({ action: "macro", status: "requested", ghRunId: null, requestedAt: justNow })],
    });

    expect(row(rows, "macro").state.kind).toBe("requested");
  });

  it("never calls a run lost once it HAS been found — a slow run is not a missing one", () => {
    const longAgo = new Date(TUE_8PM.getTime() - 30 * 60_000);
    const rows = panel({
      runs: [requested({ action: "full", status: "running", ghRunId: "42", requestedAt: longAgo })],
    });

    // Thirty minutes into a full nightly is perfectly normal. It has a run id; it is running.
    expect(row(rows, "full").state.kind).toBe("running");
  });

  it("stops blocking the other actions once a run is lost — the panel must not deadlock", () => {
    // If a lost run kept the `blocked` state, one failed dispatch would freeze the whole panel
    // until midnight and the reader would have no way out.
    const longAgo = new Date(TUE_8PM.getTime() - (RUN_LOOKUP_TIMEOUT_SECONDS + 5) * 1000);
    const rows = panel({
      runs: [requested({ action: "macro", status: "requested", ghRunId: null, requestedAt: longAgo })],
    });

    expect(row(rows, "news").state.kind).toBe("available");
  });
});

describe("precedence — the order the reasons are applied", () => {
  it("shows a LIVE run above everything — a lie about the present is the worst lie here", () => {
    // A `full` run writes its pipeline_run row at PUBLISH, near the end of its work. So for the last
    // stretch of a recovery run, "tonight's run already succeeded" is technically true while the run
    // the reader started is visibly still going. Printing that over a live run — or printing "daily
    // limit reached" over it — is the most confusing thing this panel could do.
    const rows = panel({
      now: TUE_8PM,
      lastRun: TUESDAY_RAN, // tonight's edition HAS landed — full would otherwise be not_applicable
      runs: [requested({ action: "full", status: "running", ghRunId: "42" })],
    });

    expect(row(rows, "full").state.kind).toBe("running");
  });

  it("puts a live run above a cap — the reader must always be able to see what is running", () => {
    const runs = [
      requested({ id: "a", action: "news", status: "succeeded" }),
      requested({ id: "b", action: "news", status: "running", ghRunId: "5" }),
    ];
    // news is capped at 2/day and both are spent — but one of them is ON SCREEN RIGHT NOW. Showing
    // "daily limit reached" over a run that is actively executing would be a lie about the present.
    expect(row(panel({ runs }), "news").state.kind).toBe("running");
  });

  it("puts not_applicable above a cooldown for full — the reason it cannot run is the true one", () => {
    const rows = panel({
      now: TUE_10AM,
      lastRun: null,
      runs: [requested({ action: "full", status: "succeeded", requestedAt: new Date(TUE_10AM.getTime() - 60_000) })],
    });

    // Telling the reader "available again at 10:31am" would be false: the market is open, and it
    // will not be available at 10:31 either. Say the true thing.
    expect(row(rows, "full").state.kind).toBe("not_applicable");
  });
});
