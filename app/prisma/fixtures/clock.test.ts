import { describe, expect, it } from "vitest";

// clock.mjs is plain ESM — the seed runs under bare `node`, with no TypeScript in the loop — and
// TypeScript infers its types straight from the source, which is exactly what we want here: the
// helpers' return types are checked against their real implementation rather than a hand-written
// declaration that could drift from it.
import { RUN_DATE, SEEDED_SESSION, monthStart, sessionAt, sessionDayIso, sessionPlus } from "./clock.mjs";

/**
 * The seeded world's clock, pinned instant by instant.
 *
 * THIS TEST IS THE PROOF THAT G3 CHANGED NO DATA, and that is why it enumerates rather than
 * generalises. Drift rule 21 (the fuse-finder) demanded that the seed stop scattering absolute date
 * literals and derive every instant from one named anchor. That refactor touched roughly thirty call
 * sites across seed.mjs, news.mjs and macro.mjs — and a refactor of thirty fixture dates is exactly
 * the kind of change that can shift the seeded world by a day without anybody noticing, which would
 * silently repaint a dozen VRT baselines and turn the pixel oracle into a liar.
 *
 * So every instant the seed used to name as a literal is written out here, longhand, and asserted
 * against the expression that now produces it. If the arithmetic is off by one anywhere, this fails
 * in milliseconds with the two strings side by side — rather than in CI, twelve minutes later, as an
 * unexplained wall of pixel diffs.
 *
 * The values below were read directly off the pre-G3 tree (gate-2). They are not what the helpers
 * happen to return; they are what the seed HAS ALWAYS MEANT, and the helpers now have to match them.
 */
describe("the seeded world's clock", () => {
  const iso = (d: Date) => d.toISOString();

  it("anchors on the synthetic Thursday the whole seeded world hangs on", () => {
    expect(SEEDED_SESSION).toBe("2026-07-09");
    expect(iso(RUN_DATE)).toBe("2026-07-09T00:00:00.000Z");
  });

  it("reproduces every instant ON the session day", () => {
    expect(iso(sessionAt("11:30"))).toBe("2026-07-09T11:30:00.000Z"); // the GME downgrade
    expect(iso(sessionAt("13:10"))).toBe("2026-07-09T13:10:00.000Z"); // the SMCI beat
    expect(iso(sessionAt("22:37"))).toBe("2026-07-09T22:37:00.000Z"); // the pipeline run started
    expect(iso(sessionAt("22:39"))).toBe("2026-07-09T22:39:00.000Z"); // the macro board fetched
    expect(iso(sessionAt("22:40"))).toBe("2026-07-09T22:40:00.000Z"); // the pipeline run finished
  });

  it("reproduces the forward calendar — the eight rows the Desk warns about", () => {
    expect(iso(sessionPlus(3))).toBe("2026-07-12T00:00:00.000Z"); // CPI            (high)
    expect(iso(sessionPlus(4))).toBe("2026-07-13T00:00:00.000Z"); // MSFT earnings
    expect(iso(sessionPlus(5))).toBe("2026-07-14T00:00:00.000Z"); // GME earnings
    expect(iso(sessionPlus(6))).toBe("2026-07-15T00:00:00.000Z"); // AAPL earnings
    expect(iso(sessionPlus(7))).toBe("2026-07-16T00:00:00.000Z"); // FOMC decision  (high)
    expect(iso(sessionPlus(8))).toBe("2026-07-17T00:00:00.000Z"); // Jobs report    (high)
    expect(iso(sessionPlus(11))).toBe("2026-07-20T00:00:00.000Z"); // NVDA earnings
    expect(iso(sessionPlus(12))).toBe("2026-07-21T00:00:00.000Z"); // PLTR earnings
  });

  it("reproduces the backward ledger — the signals that fired and resolved", () => {
    expect(iso(sessionPlus(-15))).toBe("2026-06-24T00:00:00.000Z"); // SPY + QQQ fired
    expect(iso(sessionPlus(-16))).toBe("2026-06-23T00:00:00.000Z"); // SMCI fired
    expect(iso(sessionPlus(-1))).toBe("2026-07-08T00:00:00.000Z"); // SPY + QQQ resolve on
    expect(iso(sessionPlus(-2))).toBe("2026-07-07T00:00:00.000Z"); // SMCI resolves on
    expect(iso(sessionPlus(-1, "00:30"))).toBe("2026-07-08T00:30:00.000Z"); // ...and resolved at
    expect(iso(sessionPlus(-2, "00:30"))).toBe("2026-07-07T00:30:00.000Z");
  });

  it("reproduces the news night's prior session, and the macro board's two odd cadences", () => {
    // news.mjs's `yesterday()` — the two clusters that carry a recency decay.
    expect(iso(sessionPlus(-1, "18:00"))).toBe("2026-07-08T18:00:00.000Z");
    // gold: a week old on purpose, which is what drives the amber "stale" cell (ruling C7, rung 5).
    expect(iso(sessionPlus(-7))).toBe("2026-07-02T00:00:00.000Z");
    expect(iso(sessionPlus(-7, "22:39"))).toBe("2026-07-02T22:39:00.000Z");
    // CPI: a MONTHLY series, stamped with the first of the month it describes. June's print.
    expect(iso(monthStart(1))).toBe("2026-06-01T00:00:00.000Z");
    expect(iso(monthStart(0))).toBe("2026-07-01T00:00:00.000Z");
  });

  it("names a date in prose the same way the briefing always did", () => {
    // The seeded briefing's calendar note reads "CPI for June is due 2026-07-12."
    expect(sessionDayIso(3)).toBe("2026-07-12");
    expect(sessionDayIso()).toBe("2026-07-09");
  });
});
