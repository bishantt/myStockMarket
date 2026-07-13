/**
 * time.ts — every timestamp the user reads passes through this file.
 *
 * The rule (plan §4.3): store UTC, display America/New_York. The user lives on Long Island
 * and works on market time, so New York is not a preference — it is the market's own clock,
 * and the app would be lying if it showed anything else.
 *
 * There is no ad-hoc date code anywhere else in the app. Two reasons. First, daylight saving:
 * the US Eastern offset changes twice a year, and every "just subtract 5 hours" shortcut is
 * wrong for a third of the year. Second, the nightly pipeline is scheduled in fixed UTC, so
 * the wall-clock time the user sees genuinely shifts with the season; only a real timezone
 * database gets that right.
 *
 * The reader always sees "ET". The EDT/EST distinction is real and this file computes it, but
 * showing it on the Desk would ask the reader to decode which half of the year they are in.
 */

/** The market's timezone, and the only one this app ever formats into. */
const MARKET_TIME_ZONE = "America/New_York";

/**
 * Intl formatters are expensive to construct and completely stateless once built, so we build
 * each one once. Note `hourCycle: "h23"`, which is what makes midnight render as "00:00"
 * rather than "24:00" — the default `hour12: false` still produces 24 in some engines.
 */
const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIME_ZONE,
  month: "short",
  day: "numeric",
});

const zoneNameFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIME_ZONE,
  timeZoneName: "short",
});

/**
 * Returns "EDT" or "EST" for the given instant, according to the real US daylight-saving
 * rules rather than a hardcoded month range.
 *
 * This is for provenance and audit contexts — a pipeline log line, a data-vintage note —
 * where being precise about the offset matters. Reader-facing surfaces use "ET" instead.
 */
export function etAbbreviation(instant: Date): "EDT" | "EST" {
  const zonePart = zoneNameFormatter
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName");

  if (zonePart?.value !== "EDT" && zonePart?.value !== "EST") {
    // Intl is a platform API; if it stops returning a US Eastern abbreviation, something is
    // deeply wrong with the runtime's timezone data and silently guessing would be worse.
    throw new Error(
      `Expected an EDT or EST abbreviation for ${MARKET_TIME_ZONE}, got "${zonePart?.value}". ` +
        `The runtime's timezone database is missing or corrupt.`,
    );
  }
  return zonePart.value;
}

/**
 * The wall-clock time in New York, as a zero-padded 24-hour "HH:MM".
 *
 * 24-hour and zero-padded on purpose: these render in IBM Plex Mono inside a right-aligned
 * column, and "9:30" would be one glyph narrower than "16:05", breaking the alignment that
 * mono numerals exist to guarantee.
 */
export function formatEtClock(instant: Date): string {
  return clockFormatter.format(instant);
}

/**
 * The calendar date in New York, e.g. "Jul 9".
 *
 * The timezone matters more than it looks: an instant at 02:30 UTC is still the previous
 * evening in New York, and a briefing published at 8:40pm ET carries the date the reader
 * would call "today", not tomorrow's UTC date.
 */
export function formatEtDate(instant: Date): string {
  return dateFormatter.format(instant);
}

/**
 * A BARE calendar date, e.g. "Jul 15", formatted by its UTC components — NOT shifted to ET.
 *
 * This is for Prisma `@db.Date` values (a trading day, an earnings date, a pipeline run date): they
 * carry no meaningful time of day and are stored at UTC midnight, so their UTC calendar date already
 * IS the intended date. Running them through the ET formatter (formatEtDate) would wrongly roll them
 * back a day — 2026-07-15 at UTC midnight is still 2026-07-14 in New York. Use this for bare dates
 * and formatEtDate only for real instants (timestamps).
 */
const utcDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

export function formatUtcDate(date: Date): string {
  return utcDateFormatter.format(date);
}

/**
 * The same bare calendar date, written out in full: "Friday, July 10, 2026".
 *
 * The Desk's serif headline needs the long form — a broadsheet's masthead carries the date of the
 * edition, spelled out. It reads the UTC components for exactly the reason above: a run date is a
 * trading day, not an instant, and formatting it in ET would print the day before.
 */
const utcDateLongFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function formatUtcDateLong(date: Date): string {
  return utcDateLongFormatter.format(date);
}

/**
 * The exact provenance line every SectionMasthead renders: "as of 16:05 ET".
 *
 * Every module on the Desk shows one. It is what makes stale data self-identifying, which is
 * the whole reason offline mode can be an honest state rather than an apology (plan §5.3).
 */
export function formatAsOf(instant: Date): string {
  return `as of ${formatEtClock(instant)} ET`;
}

/**
 * The short weekday of a BARE calendar date, e.g. "Fri" — read from its UTC components.
 *
 * The pipeline strip talks in sessions, and a session has a name a reader recognises: "showing
 * Fri's data" lands where "showing 2026-07-10's data" does not. Same UTC-components rule as
 * formatUtcDate above: a trading day is a day, and formatting it in ET rolls it back one.
 */
const utcWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});

export function formatUtcWeekday(date: Date): string {
  return utcWeekdayFormatter.format(date);
}

/** The short weekday of a real instant, in New York, e.g. "Mon" — for "next: Mon 18:37 ET". */
const etWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
});

export function formatEtWeekday(instant: Date): string {
  return etWeekdayFormatter.format(instant);
}

/**
 * The LONG weekday of a bare calendar date, e.g. "Friday" — for the control room's C5 sentences
 * ("Friday's close is the latest data that exists; nothing new lands before Monday").
 *
 * Takes a TradingDate ("2026-07-17"), not an instant, and reads it in UTC. A trading day is a DAY:
 * parse it at UTC noon and read it back in UTC, and it cannot drift a day either way. Doing this
 * arithmetic with a local Date is how you end up naming the wrong weekday for five hours every
 * evening — which is the same class of bug as the relative timestamps N5 refused to ship.
 */
const utcWeekdayLongFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
});

export function formatWeekdayLong(date: string): string {
  return utcWeekdayLongFormatter.format(new Date(`${date}T12:00:00Z`));
}
