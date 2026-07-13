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
/*
 * The names are DATA now, not comments, and N6 is why.
 *
 * The control room has to tell the reader why a button is not there: "US markets are closed today
 * (Thanksgiving) — Wednesday's close stands until Friday." That sentence needs the holiday's NAME,
 * and a name that lives in a `//` comment is a name the program cannot read.
 *
 * The alternative was a second list somewhere else mapping dates to names, which is a second NYSE
 * calendar to keep in step — and it would fall out of step, in the same way and for the same reason
 * every duplicated calendar in this codebase has. One list. It already had the names; they were just
 * written where only a human could see them.
 */
const HOLIDAYS = new Map<string, string>([
  // 2026
  ["2026-01-01", "New Year's Day"],
  ["2026-01-19", "Martin Luther King Jr. Day"],
  ["2026-02-16", "Washington's Birthday"],
  ["2026-04-03", "Good Friday"],
  ["2026-05-25", "Memorial Day"],
  ["2026-06-19", "Juneteenth"],
  ["2026-07-03", "Independence Day"], // observed — the 4th is a Saturday
  ["2026-09-07", "Labor Day"],
  ["2026-11-26", "Thanksgiving"],
  ["2026-12-25", "Christmas"],
  // 2027
  ["2027-01-01", "New Year's Day"],
  ["2027-01-18", "Martin Luther King Jr. Day"],
  ["2027-02-15", "Washington's Birthday"],
  ["2027-03-26", "Good Friday"],
  ["2027-05-31", "Memorial Day"],
  ["2027-06-18", "Juneteenth"], // observed — the 19th is a Saturday
  ["2027-07-05", "Independence Day"], // observed — the 4th is a Sunday
  ["2027-09-06", "Labor Day"],
  ["2027-11-25", "Thanksgiving"],
  ["2027-12-24", "Christmas"], // observed — the 25th is a Saturday
  // 2028
  ["2028-01-17", "Martin Luther King Jr. Day"],
  ["2028-02-21", "Washington's Birthday"],
  ["2028-04-14", "Good Friday"],
  ["2028-05-29", "Memorial Day"],
  ["2028-06-19", "Juneteenth"],
  ["2028-07-04", "Independence Day"],
  ["2028-09-04", "Labor Day"],
  ["2028-11-23", "Thanksgiving"],
  ["2028-12-25", "Christmas"],
]);

/**
 * The name of the holiday closing the market on this date, or null if it is not a holiday.
 *
 * Used by the control room to explain, in words, why there is no button today. A closed market is
 * information, not an error, and a sentence that names the reason is the whole feature (ruling C5).
 */
export function holidayName(date: TradingDate): string | null {
  return HOLIDAYS.get(date) ?? null;
}

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

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * The trading-day calendar, walkable.
 *
 * `marketState` above answers "is the market open at this instant?". The pipeline's freshness
 * (lib/freshness.ts) asks a different question — "which DAYS owed us an edition?" — and to answer
 * it, something has to be able to step over weekends and holidays a day at a time. That walk lives
 * here, next to the holiday list, because a second copy of the NYSE calendar is a second calendar
 * to keep in step, and it would fall out of step.
 *
 * The unit is an ET calendar date as a plain "YYYY-MM-DD" string. Dates, not instants: a trading
 * day is a day, and doing this arithmetic with Date objects in a timezone is how you end up one day
 * off for five hours every evening.
 * ──────────────────────────────────────────────────────────────────────────────────────────── */

/** An ET calendar date, "YYYY-MM-DD" — the day the reader in New York is living in. */
export type TradingDate = string;

/** The ET calendar date of an instant. */
export function etDateOf(instant: Date): TradingDate {
  return easternParts(instant).date;
}

/** The ET wall-clock minute of an instant (minutes since ET midnight). */
export function etMinuteOf(instant: Date): number {
  return easternParts(instant).minute;
}

/**
 * Is this calendar date a trading session?
 *
 * A half day IS a session — it opens, it closes, it has a close price, and the pipeline owes an
 * edition for it. Only weekends and full closures are not sessions.
 *
 * Past the end of the hardcoded holiday list this falls back to "any weekday", and says so here
 * rather than silently. The consequence is bounded and one-directional: after 2028 the strip could
 * show an amber "no run" on a holiday. That over-alarms; it never under-alarms. A freshness lamp
 * that errs toward "check the pipeline" is the safe direction to err in.
 */
export function isTradingDay(date: TradingDate): boolean {
  // Parsed as UTC midnight and read back in UTC — pure calendar arithmetic, no timezone anywhere.
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !HOLIDAYS.has(date);
}

/** Step one calendar day. */
function shiftDate(date: TradingDate, days: number): TradingDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The most recent session STRICTLY before this date. */
export function previousTradingDay(date: TradingDate): TradingDate {
  let cursor = shiftDate(date, -1);
  // A ten-day bound: the longest gap the NYSE calendar can produce is a holiday against a weekend,
  // which is four days. Ten is slack, and it means a malformed date can never spin forever.
  for (let i = 0; i < 10 && !isTradingDay(cursor); i += 1) cursor = shiftDate(cursor, -1);
  return cursor;
}

/** The next session STRICTLY after this date. */
export function nextTradingDay(date: TradingDate): TradingDate {
  let cursor = shiftDate(date, 1);
  for (let i = 0; i < 10 && !isTradingDay(cursor); i += 1) cursor = shiftDate(cursor, 1);
  return cursor;
}

/**
 * How many SESSIONS fall strictly after `from`, up to and including `to`.
 *
 * This is the app's one answer to "how old is this?", and counting in sessions rather than days is
 * the whole reason it exists. A weekend is not staleness. A holiday is not staleness. A gold price
 * from Friday, read on Monday, is three calendar days old and ZERO sessions old — the market simply
 * was not open, and there is no newer price to have. A lamp that goes amber every Monday morning is
 * a lamp nobody reads by Tuesday, and then it is not there on the night it actually matters.
 *
 * It lived privately inside freshness.ts until N3, when the macro board's stale-cell rule needed the
 * identical judgement. Two copies of "what counts as old" is one copy too many.
 */
export function sessionsBetween(from: TradingDate, to: TradingDate): number {
  let count = 0;
  let cursor = nextTradingDay(from);
  // Bounded so a corrupt date can never hang a page render. Anything past this is emphatically old
  // already, and every surface says the same thing at 60 missed sessions as it does at 600.
  while (cursor <= to && count < 500) {
    count += 1;
    cursor = nextTradingDay(cursor);
  }
  return count;
}
