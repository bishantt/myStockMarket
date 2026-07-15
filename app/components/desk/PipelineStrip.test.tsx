import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineStrip } from "@/components/desk/PipelineStrip";

/**
 * The pipeline strip (NEWS-AND-CONTROL-PLAN Part 4.1).
 *
 * What these tests actually guard is the ESCALATION. The strip replaced a full card that said the
 * same quiet thing every day, and the case for replacing it was never "the card was too big" — it
 * was that a card which looks identical on a healthy night and a dead one is not a freshness
 * indicator at all. So the tests below are mostly about the loud states, because the loud states
 * are the only reason the strip exists.
 */

/** A completed run for a trading day, as the server serialises it. */
const ranFor = (date: string) => ({ runDate: date, finishedAt: `${date}T22:41:00Z` });

/** An ET instant in July (EDT, so UTC−4), as an ISO string. */
const etJuly = (date: string, hhmm: string) =>
  new Date(`${date}T${hhmm}:00-04:00`).toISOString();

/** Friday's run, read on Saturday — the healthy weekend. */
const FRESH = { run: ranFor("2026-07-10"), serverNow: etJuly("2026-07-11", "09:00") };
/** Friday's run, read Monday night — Monday's edition never landed. */
const AGING = { run: ranFor("2026-07-10"), serverNow: etJuly("2026-07-13", "22:00") };
/** Friday's run, read Tuesday night — two sessions gone. */
const DEAD = { run: ranFor("2026-07-10"), serverNow: etJuly("2026-07-14", "22:00") };
/** A database with no completed run at all. */
const NEVER = { run: null, serverNow: etJuly("2026-07-13", "22:00") };

/**
 * Only `Date` is faked, never the timers.
 *
 * The strip regrades itself on mount against the BROWSER's clock — that is the whole design (see
 * the component). So a test that sets up "it is Monday night" on the server and then lets the real
 * system clock run the regrade is testing a scenario that does not exist. Every render below fixes
 * both clocks to the same instant, which is what a reader's browser actually does on a healthy load.
 *
 * Faking only Date (not setTimeout) keeps React's own scheduling on real timers, so effects still
 * flush normally under Testing Library.
 */
beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

/** Render the strip as a reader whose clock agrees with the render they were served. */
function renderAt(scenario: { run: { runDate: string; finishedAt: string } | null; serverNow: string }) {
  vi.setSystemTime(new Date(scenario.serverNow));
  return render(<PipelineStrip {...scenario} />);
}

describe("PipelineStrip — the quiet state", () => {
  it("states the session on screen, when the pipeline ran, and when it runs next", () => {
    renderAt(FRESH);
    const strip = screen.getByRole("status");

    // The three facts a reader needs and could not previously get: what am I looking at, was it
    // written, and when does the next edition land. Module 00 answered only the first.
    expect(strip.textContent).toContain("Fri, Jul 10");
    expect(strip.textContent).toContain("next:");
    expect(strip.textContent).toContain("Mon");
  });

  it("is a doorway to the control room", () => {
    renderAt(FRESH);
    expect(screen.getByRole("link")).toHaveAttribute("href", expect.stringContaining("/settings"));
  });

  it("is QUIET — no alert colour on a healthy night", () => {
    // This is the half of the ruling that is easy to forget. Escalation only means something if the
    // normal case is genuinely unremarkable; a strip that is amber every day is a strip nobody
    // reads on the day it turns amber for a reason.
    const { container } = renderAt(FRESH);
    expect(container.innerHTML).not.toMatch(/alert|danger/);
  });

  it("an empty database is not an alarm — it is a pipeline that has not started", () => {
    const { container } = renderAt(NEVER);
    expect(screen.getByRole("status").textContent).toContain("No pipeline run recorded yet");
    expect(container.innerHTML).not.toMatch(/alert|danger/);
  });
});

describe("PipelineStrip — the aging state", () => {
  it("names the missed session AND the data actually on screen", () => {
    renderAt(AGING);
    const strip = screen.getByRole("status");

    // Both halves are load-bearing. "No run for Monday" tells the reader something broke; "showing
    // Friday's data" tells them what they are therefore looking at — which is the fact that changes
    // what they do next.
    expect(strip.textContent).toContain("Mon");
    expect(strip.textContent).toContain("Fri");
    expect(strip.textContent).toContain("check the pipeline");
  });

  it("carries the WORD, not just the colour", () => {
    // P11's redundant-encoding rule. Colour is never the only carrier of a state: a reader who
    // cannot distinguish the amber must still be able to read the word "stale".
    renderAt(AGING);
    expect(screen.getByText("stale")).toBeInTheDocument();
  });

  it("earns the amber token — this is exactly what amber is reserved for", () => {
    const { container } = renderAt(AGING);
    expect(container.innerHTML).toMatch(/-alert\b/);
  });
});

describe("PipelineStrip — the dead state", () => {
  it("states the last good night and what every number on the page therefore is", () => {
    renderAt(DEAD);
    const strip = screen.getByRole("alert");

    // The whole point of the loudest surface in the app: not "an error occurred" but "everything you
    // are about to read is from Friday". A dead pipeline that serves stale data silently is the
    // catastrophic failure mode this component exists to make impossible.
    expect(strip.textContent).toContain("has not run since");
    expect(strip.textContent).toContain("Fri");
    expect(strip.textContent).toContain("Every number on this page is from that night");
  });

  it("escalates from status to ALERT — assistive tech is told too, not just the eye", () => {
    // The aging strip is role=status (polite). The dead one is role=alert (assertive). If the
    // escalation is only a colour, a screen-reader user gets the app's calmest voice on its worst
    // night.
    renderAt(DEAD);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("carries the word 'pipeline down' beside its red", () => {
    renderAt(DEAD);
    expect(screen.getByText("pipeline down")).toBeInTheDocument();
  });

  it("uses DANGER, not amber — a dead pipeline is not the same claim as a degraded source", () => {
    const { container } = renderAt(DEAD);
    expect(container.innerHTML).toMatch(/-danger\b/);
  });

  it("cannot be dismissed — there is no control that hides it", () => {
    // "This banner may never be dismissed; it clears only when a run succeeds." A dismissible
    // catastrophe notice is a catastrophe notice that will be dismissed, once, and then never seen
    // again on any of the nights that follow.
    renderAt(DEAD);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("PipelineStrip — the clock is the reader's, not the cache's", () => {
  it("regrades a STALE CACHED render against the real clock, and finds the dead pipeline", async () => {
    // THE BUG THIS PREVENTS, which is the reason the strip is a client component at all.
    //
    // The Desk is cached. A render made on Monday morning — when the pipeline was healthy — carries
    // Monday morning's clock. If the pipeline then dies and nobody visits, nothing revalidates that
    // cache. On Tuesday the reader's FIRST PAINT is that Monday render, and a server-graded strip
    // would tell them, in the app's calmest voice, that everything is fine.
    //
    // The one surface whose entire job is to catch a dead pipeline would have been silenced by the
    // cache, on precisely the morning it mattered.
    //
    // So: the server sends the run (data — cacheable), and the browser supplies the clock (not
    // data). Here the server's clock says Monday 8am (fresh, nothing owed yet) and the real clock
    // says Wednesday night, with Monday, Tuesday and Wednesday all missed.
    vi.setSystemTime(new Date("2026-07-15T22:00:00-04:00"));

    render(<PipelineStrip run={ranFor("2026-07-10")} serverNow={etJuly("2026-07-13", "08:00")} />);

    // The effect runs on mount and regrades. The banner is what the reader actually ends up seeing.
    await vi.waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("has not run since");
    });
  });

  it("a healthy night agrees with itself — the browser changes nothing", async () => {
    // The other half. If the regrade fired on every load and produced a different answer, the strip
    // would flicker on every healthy morning, and the shift would be a real CLS bug rather than the
    // page speaking up on a bad night. When the pipeline is fine, server and browser reach the same
    // verdict and nothing moves.
    renderAt(FRESH);
    await vi.waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("Fri, Jul 10");
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("PipelineStrip — stillness", () => {
  it("never animates, in any state", () => {
    // The strip sits directly above the Desk's hero figure. A transition here would animate the
    // frame around a money visual, and P2's ancestor walk would be entitled to fail the build for
    // it. It also has nothing to gain: a status line that fades in is a status line you read late.
    for (const f of [FRESH, AGING, DEAD, NEVER]) {
      const { container } = renderAt(f);
      expect(container.innerHTML).not.toMatch(/transition|animate-/);
    }
  });
});
