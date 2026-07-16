import { describe, expect, it } from "vitest";

import { editionState, mastheadEdition, type EditionFacts } from "./edition-state";

/**
 * The edition-state machine (CLARITY-AND-CADENCE CC9, Part 4.7-presentation, ruling R6).
 *
 * The Desk greets as Morning Edition ONLY when a dawn ran for the reader's own wall-clock trading day
 * and it is still before that day's evening publish. Everything else is the Evening Edition of the last
 * closed session — which is the whole of R6, and the point of the 2026-07-11 rejection of "PRE-MARKET".
 *
 * The clock is the reader's, not the server's (MarketStateLine's law): a page cached in the morning and
 * served that evening, or a tab left open across midnight, must grade against WHEN IT IS, never when the
 * render was made. So the machine takes `now` and the tests pin it, exactly as the seeded browser suite
 * pins SEEDED_EVENING. All instants are the seeded world: session Thursday 2026-07-09, evening published
 * 7:36 PM ET, a dawn that ran Friday 2026-07-10 at 6:31 AM ET (stamped on Thursday's run — E1).
 */

/** The seeded evening nightly finished at 7:36 PM ET on the session (Thursday 2026-07-09). */
const EVENING_PUBLISHED = "2026-07-09T19:36:00-04:00";
/** The Friday dawn ran at 6:31 AM ET (stamped beside Thursday's run — the edition stays Thursday, E1). */
const DAWN_RAN = "2026-07-10T06:31:00-04:00";

/** The seeded run's facts, with a dawn stamped for the Friday morning. */
const withDawn: EditionFacts = {
  dawnRanAt: DAWN_RAN,
  eveningPublishedAt: EVENING_PUBLISHED,
  runDate: "2026-07-09",
};

/** The same run BEFORE the Friday dawn has stamped its entry (the overnight window). */
const noDawn: EditionFacts = { ...withDawn, dawnRanAt: null };

const at = (iso: string) => new Date(iso);

describe("editionState — the four states from the reader's clock", () => {
  it("is EVENING from the evening publish to midnight ET", () => {
    // Thursday 11:00 PM ET — the seeded evening. The run has landed; the Friday dawn's date is not today.
    expect(editionState(withDawn, at("2026-07-09T23:00:00-04:00"))).toBe("evening");
    // And right after the publish, same session.
    expect(editionState(withDawn, at("2026-07-09T20:00:00-04:00"))).toBe("evening");
  });

  it("is MORNING once a dawn ran for today, before the 9:30 open", () => {
    // Friday 7:00 AM ET — the dawn ran this morning (6:31), the bell has not rung.
    expect(editionState(withDawn, at("2026-07-10T07:00:00-04:00"))).toBe("morning");
    // The instant the dawn landed.
    expect(editionState(withDawn, at("2026-07-10T06:31:00-04:00"))).toBe("morning");
    // 9:29 AM — still before the open by one minute.
    expect(editionState(withDawn, at("2026-07-10T09:29:00-04:00"))).toBe("morning");
  });

  it("is SESSION from the 9:30 open until the evening publishes (the masthead stays Morning, the pill turns)", () => {
    // 9:30 sharp — the bell.
    expect(editionState(withDawn, at("2026-07-10T09:30:00-04:00"))).toBe("session");
    // Mid-session.
    expect(editionState(withDawn, at("2026-07-10T11:00:00-04:00"))).toBe("session");
    // After the 4pm close but before the ~7:36pm publish — still the morning edition on screen.
    expect(editionState(withDawn, at("2026-07-10T17:00:00-04:00"))).toBe("session");
  });

  it("is the OVERNIGHT GAP after midnight before the dawn has run — never a morning that has not happened (R6)", () => {
    // Friday 2:00 AM ET — past midnight, but the 6:31 dawn has not stamped its entry yet.
    expect(editionState(noDawn, at("2026-07-10T02:00:00-04:00"))).toBe("overnight-gap");
    // Friday 5:00 AM — still before the dawn.
    expect(editionState(noDawn, at("2026-07-10T05:00:00-04:00"))).toBe("overnight-gap");
  });

  it("NEVER claims a stale morning — a dawn from an earlier day is not today's (R6)", () => {
    // Monday 7:00 AM, but the freshest dawn on the run is Friday's — the cache/tab is stale, so the
    // reader's clock refuses the morning greeting and falls back to the evening masthead.
    expect(editionState(withDawn, at("2026-07-13T07:00:00-04:00"))).not.toBe("morning");
    expect(mastheadEdition(editionState(withDawn, at("2026-07-13T07:00:00-04:00")))).toBe("evening");
  });

  it("stays EVENING on a morning with no dawn — a holiday, or a dawn that did not run (risk 3)", () => {
    // Friday morning, but no dawn ran (a holiday, a failed cron). The Desk stays the Evening Edition of
    // Thursday's close rather than greeting a morning the pipeline never produced.
    expect(editionState(noDawn, at("2026-07-10T07:00:00-04:00"))).toBe("overnight-gap");
    expect(mastheadEdition(editionState(noDawn, at("2026-07-10T07:00:00-04:00")))).toBe("evening");
  });
});

describe("mastheadEdition — which masthead a state wears", () => {
  it("wears the MORNING masthead in morning and session", () => {
    expect(mastheadEdition("morning")).toBe("morning");
    expect(mastheadEdition("session")).toBe("morning");
  });

  it("wears the EVENING masthead in the evening and the overnight gap", () => {
    expect(mastheadEdition("evening")).toBe("evening");
    expect(mastheadEdition("overnight-gap")).toBe("evening");
  });
});
