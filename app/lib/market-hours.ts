/**
 * market-hours.ts — is the US stock market open right now?
 *
 * The nav shows a single word about the exchange's state. The easy version of this function checks
 * the weekday and the clock, and then tells the reader "Open" on Christmas morning. This product
 * does not get to be casually wrong about a fact this checkable, so the NYSE holiday calendar is
 * modelled, and the early closes are too.
 *
 * Everything is computed in America/New_York, which handles daylight saving for free. The user
 * lives on market time (CLAUDE.md), and the market has exactly one clock.
 */

/** Regular session, in minutes from midnight ET: 9:30am to 4:00pm. */
const OPEN_MINUTE = 9 * 60 + 30;
const CLOSE_MINUTE = 16 * 60;

/** On a half day the bell rings at 1:00pm ET instead. */
const HALF_DAY_CLOSE_MINUTE = 13 * 60;

/**
 * NYSE full closures, as ET calendar dates.
 *
 * Hardcoded rather than computed. The rules behind them are genuinely fiddly — Good Friday moves
 * with Easter, a holiday falling on a Saturday is observed on the Friday before — and a subtle bug
 * in a date algorithm would be invisible until the one day a year it mattered. A list is dumb,
 * auditable, and correct. It runs out at the end of 2028, and `marketState` says so loudly rather
 * than guessing past it.
 */
const HOLIDAYS = new Set([
  // 2026
  "2026-01-01", // New Year's Day
  "2026-01-19", // Martin Luther King Jr. Day
  "2026-02-16", // Washington's Birthday
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day (observed — the 4th is a Saturday)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
  // 2027
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26", // Good Friday
  "2027-05-31",
  "2027-06-18", // Juneteenth observed (the 19th is a Saturday)
  "2027-07-05", // Independence Day observed (the 4th is a Sunday)
  "2027-09-06",
  "2027-11-25",
  "2027-12-24", // Christmas observed (the 25th is a Saturday)
  // 2028
  "2028-01-17",
  "2028-02-21",
  "2028-04-14", // Good Friday
  "2028-05-29",
  "2028-06-19",
  "2028-07-04",
  "2028-09-04",
  "2028-11-23",
  "2028-12-25",
]);

/** Days the market closes at 1:00pm ET: the eve of a holiday, and the day after Thanksgiving. */
const HALF_DAYS = new Set([
  "2026-11-27", // day after Thanksgiving
  "2026-12-24", // Christmas Eve
  "2027-11-26",
  "2028-07-03",
  "2028-11-24",
]);

/** The last date this calendar knows about. Past it, we stop claiming to know. */
const CALENDAR_ENDS = "2028-12-31";

export type MarketState = "open" | "closed" | "unknown";

/** The ET calendar date and wall-clock minute of an instant, DST handled by the platform. */
function easternParts(instant: Date): { date: string; minute: number; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  // en-CA renders hour 24 for midnight; normalise it so the arithmetic below stays honest.
  const hour = Number(get("hour")) % 24;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minute: hour * 60 + Number(get("minute")),
    weekday: get("weekday"),
  };
}

/**
 * Whether the US stock market is open at a given instant.
 *
 * Returns "unknown" once the holiday calendar runs out. That is deliberate: a stale calendar that
 * silently degrades into a weekday-and-clock guess is exactly the kind of quiet wrongness this
 * codebase exists to refuse. The nav renders "unknown" as no claim at all.
 */
export function marketState(instant: Date): MarketState {
  const { date, minute, weekday } = easternParts(instant);

  if (date > CALENDAR_ENDS) return "unknown";
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  if (HOLIDAYS.has(date)) return "closed";

  const close = HALF_DAYS.has(date) ? HALF_DAY_CLOSE_MINUTE : CLOSE_MINUTE;
  return minute >= OPEN_MINUTE && minute < close ? "open" : "closed";
}
