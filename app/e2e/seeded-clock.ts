/**
 * seeded-clock.ts — the browser suite's ONE clock, and the only place in e2e/ allowed to say a date.
 *
 * THE FUSE THIS DEFUSES (GATE-EFFICIENCY-PLAN G3, recommendation R9; drift rule 21 enforces it).
 *
 * An absolute fixture read under a relative rule has a fuse on it, and this build has now paid for
 * that twice. The clearest telling is in prisma/fixtures/paper.mjs's own header: the paper ledger's
 * closed trades sat on absolute dates while the page counted them against a rolling "last 7 days"
 * window, so the window walked off the end of the fixture. The baseline expired at
 * 2026-07-13T19:50Z — **twenty-eight minutes after the run that last certified it**. Nobody changed
 * a line of code. The gate simply went red one evening, in a way that looked like a regression and
 * was actually a calendar.
 *
 * The cure is not "never write a date". The seeded world IS a fixed morning and has to be — that is
 * what makes the pixel oracle an oracle rather than a photograph of whatever today happens to hold.
 * The cure is that there is exactly ONE date, it has a name, and everything else is derived from it.
 * A second, unnamed clock beside the first is how the two drift apart, and drifting apart is the
 * whole failure.
 *
 * So: the browser suite's date lives here, and nowhere else. `vrt.spec.ts` pins the browser clock to
 * it before it photographs anything, and `desk.spec.ts` pins the same instant for the same reason —
 * both used to carry their own copy of the literal, which is precisely the second clock this file
 * exists to abolish.
 *
 * The seed's own anchor is the twin of this one and lives in prisma/fixtures/clock.mjs. They must
 * agree, and vrt.spec.ts asserts it at runtime: the Desk's pipeline strip has to read FRESH before
 * the shot is taken, and it only reads FRESH if this clock and that seed are the same night.
 */

/** The trading day prisma/seed.mjs publishes — a fixed Thursday, so the seeded world is reproducible. */
export const SEEDED_SESSION = "2026-07-09";

/**
 * 11pm ET on the seeded session — the instant the browser's clock is pinned to.
 *
 * WHY THIS EXACT MOMENT, because it is load-bearing and the first baseline run is how we learned it:
 *
 * The pipeline strip grades freshness in the BROWSER, against the reader's clock — deliberately, so
 * that a cached render can never photograph a dead pipeline as a healthy one. Which means the Desk
 * renders something that depends on WHEN IT IS.
 *
 * The seeded database has one completed run, for a fixed trading day, and real time keeps moving. So
 * the first baseline run photographed the strip in its AGING state ("no run for Friday's session"),
 * which was correct — and would have escalated to DEAD a day later, and the baseline would have
 * started failing on its own, with nobody having changed a line of code. A picture that rots with the
 * calendar is not an oracle; it is a chore with a countdown on it.
 *
 * Pinned to the evening of the seeded session, the run has landed, no further session is owed, and
 * the strip is FRESH — permanently, on every run, forever.
 */
export const SEEDED_EVENING = new Date(`${SEEDED_SESSION}T23:00:00-04:00`);
