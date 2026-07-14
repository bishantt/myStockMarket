/**
 * clock.mjs — the seeded world's ONE date, and the only place in prisma/ allowed to say one.
 *
 * THE FUSE THIS DEFUSES (GATE-EFFICIENCY-PLAN G3, recommendation R9; drift rule 21 enforces it).
 *
 * An absolute fixture read under a relative rule has a fuse on it, and this build has paid for that
 * twice. The clearest telling is in paper.mjs's own header: the paper ledger's closed trades sat on
 * absolute dates while the page counted them against a rolling "last 7 days" window. The window
 * walked forward; the fixture did not.
 *
 *     nc-6's CI ran 2026-07-13 19:22Z → cutoff 07-06 19:22 → the 07-06T19:50 trade was IN  → 2 ✅
 *     nc-final's   ran 2026-07-13 20:39Z → cutoff 07-06 20:39 → the same trade was OUT     → 1 ❌
 *
 * The baseline expired twenty-eight minutes after the run that last certified it. Nobody had changed
 * a line of code. The gate went red because of the calendar, and it looked exactly like a regression.
 *
 * THE RULE IS NOT "NEVER WRITE A DATE", and getting that distinction right is the whole design. The
 * seeded world IS a fixed morning and has to be: a seed that drifted with the calendar would repaint
 * every VRT baseline every night, and the pixel oracle would be photographing whatever today happened
 * to hold instead of a known state. The rule is that there is exactly ONE date, it has a name, and
 * everything else is DERIVED from it. Before G3 there were twenty-odd unanchored literals scattered
 * across the seed and its fixtures — twenty-odd chances for one of them to be moved and the rest
 * left behind.
 *
 * Its twin is e2e/seeded-clock.ts, which pins the BROWSER's clock to the evening of this same
 * session. The two must agree, and vrt.spec.ts checks it at runtime rather than trusting it: the
 * Desk's pipeline strip has to read FRESH before any shot is taken, and it only reads FRESH if the
 * pinned clock and this seed are the same night.
 *
 * EVERY DERIVED CALL SITE CARRIES ITS ANSWER IN A TRAILING COMMENT — `sessionPlus(3)  // 2026-07-12`.
 * That is deliberate and drift rule 21 exempts comments precisely to allow it: a reader has to be
 * able to check the arithmetic against a calendar without running the code. The comment is for the
 * human; the expression is what keeps the fuse from burning.
 */

/** The synthetic trading day the whole seeded world hangs on — a fixed Thursday, so it is reproducible. */
export const SEEDED_SESSION = "2026-07-09";

/** Midnight UTC on the session. The anchor every other instant here is measured from. */
export const RUN_DATE = new Date(`${SEEDED_SESSION}T00:00:00.000Z`);

/** Build an instant `days` from the session, at `hh:mm` UTC. The one place the arithmetic happens. */
function offset(days, hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const when = new Date(RUN_DATE);
  when.setUTCDate(when.getUTCDate() + days);
  when.setUTCHours(hours, minutes, 0, 0);
  return when;
}

/** A time on the session day itself: `sessionAt("22:40")` → 2026-07-09T22:40:00.000Z. */
export const sessionAt = (hhmm) => offset(0, hhmm);

/** A day before or after the session: `sessionPlus(3)` → 2026-07-12, `sessionPlus(-1, "00:30")` → 07-08 00:30. */
export const sessionPlus = (days, hhmm = "00:00") => offset(days, hhmm);

/** The bare YYYY-MM-DD of a day near the session — for the prose that has to NAME a date to a reader. */
export const sessionDayIso = (days = 0) => offset(days, "00:00").toISOString().slice(0, 10);

/**
 * The first of the month, `monthsBack` months before the session's month.
 *
 * This one exists so the macro board stays readable. CPI is a MONTHLY series stamped with the first
 * of the month it describes, and the seeded row is June's print — `monthStart(1)` says that. Writing
 * it as a day offset would be honest and unreadable: `sessionPlus(-38)` is a number nobody can check
 * against a calendar, and a fixture nobody can check is how the wrong one survives.
 */
export function monthStart(monthsBack = 0) {
  const when = new Date(RUN_DATE);
  when.setUTCDate(1);
  when.setUTCMonth(when.getUTCMonth() - monthsBack);
  when.setUTCHours(0, 0, 0, 0);
  return when;
}
