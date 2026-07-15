/**
 * time.ts — every timestamp the user reads passes through this file, and nothing else in the app
 * may construct an Intl.DateTimeFormat (ruling R1; check-drift rule 29 fails the build otherwise).
 *
 * Store UTC, display America/New_York. The user lives on Long Island and works on market time, so
 * New York is not a preference — it is the market's own clock. Daylight saving is why this must be a
 * real timezone database and not "subtract 5 hours": the Eastern offset changes twice a year, and the
 * nightly pipeline is scheduled in fixed UTC, so the wall-clock time the reader sees shifts with the
 * season. The reader always sees "ET"; the EDT/EST distinction is computed here but shown only in
 * provenance contexts (etAbbreviation), never on a reader-facing surface.
 *
 * The shapes (R1): clocks are 12-hour with AM/PM ("7:36 PM"), dates carry their weekday ("Tue, Jul
 * 14"). A mono COLUMN may zero-pad the hour ("07:36 PM"); prose does not.
 */

/** The market's timezone, and the only one this app ever formats an instant into. */
const MARKET_TIME_ZONE = "America/New_York";

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Same clock, hour zero-padded — for a mono column only, where "9:30" and "10:05" must align. */
const clockPaddedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const zoneNameFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIME_ZONE,
  timeZoneName: "short",
});

/**
 * Returns "EDT" or "EST" for the given instant, by the real US daylight-saving rules.
 *
 * For provenance and audit contexts — a pipeline log line, a data-vintage note — where the exact
 * offset matters. Reader-facing surfaces use "ET" instead.
 */
export function etAbbreviation(instant: Date): "EDT" | "EST" {
  const zonePart = zoneNameFormatter
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName");

  if (zonePart?.value !== "EDT" && zonePart?.value !== "EST") {
    // If Intl stops returning a US Eastern abbreviation, the runtime's timezone data is missing or
    // corrupt — silently guessing an offset would be worse than failing loudly.
    throw new Error(
      `Expected an EDT or EST abbreviation for ${MARKET_TIME_ZONE}, got "${zonePart?.value}". ` +
        `The runtime's timezone database is missing or corrupt.`,
    );
  }
  return zonePart.value;
}

/** The wall-clock time in New York, 12-hour with AM/PM and no leading zero: "7:36 PM" (R1). */
export function formatEtClock(instant: Date): string {
  return clockFormatter.format(instant);
}

/** The same time, hour zero-padded for mono-column alignment: "07:36 PM" (control-room table only). */
export function formatEtClockPadded(instant: Date): string {
  return clockPaddedFormatter.format(instant);
}

/**
 * The calendar date in New York with its weekday: "Thu, Jul 9".
 *
 * The timezone matters: an instant at 02:30 UTC is still the previous evening in New York, so a
 * briefing published at 8:40pm ET carries the date the reader calls "today", not tomorrow's UTC date.
 */
export function formatEtDate(instant: Date): string {
  return dateFormatter.format(instant);
}

/**
 * A BARE calendar date with its weekday, "Tue, Jul 15", read from its UTC components — NOT shifted to
 * ET.
 *
 * For Prisma `@db.Date` values (a trading day, an earnings date, a run date): they carry no meaningful
 * time of day and are stored at UTC midnight, so their UTC calendar date already IS the intended date.
 * Running them through formatEtDate would roll them back a day — 2026-07-15 at UTC midnight is still
 * 2026-07-14 in New York. Use this for bare dates and formatEtDate only for real instants.
 */
const utcDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function formatUtcDate(date: Date): string {
  return utcDateFormatter.format(date);
}

/**
 * The same bare calendar date written out in full: "Friday, July 10, 2026", for the Desk's masthead.
 * Reads the UTC components for the same reason as formatUtcDate — a run date is a trading day, not an
 * instant, and formatting it in ET would print the day before.
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

/** The provenance line every SectionMasthead renders: "as of 7:36 PM ET" — stale data self-identifies. */
export function formatAsOf(instant: Date): string {
  return `as of ${formatEtClock(instant)} ET`;
}

/** One-line provenance for footers and sheets: "Tue, Jul 14 · 7:36 PM ET" — the date, the time, ET. */
export function formatEtStamp(instant: Date): string {
  return `${formatEtDate(instant)} · ${formatEtClock(instant)} ET`;
}

/**
 * The short weekday of a BARE calendar date, "Fri", read from its UTC components.
 *
 * The pipeline strip talks in sessions, and a session has a name a reader recognises. Same
 * UTC-components rule as formatUtcDate: a trading day is a day, and formatting it in ET rolls it back.
 */
const utcWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});

export function formatUtcWeekday(date: Date): string {
  return utcWeekdayFormatter.format(date);
}

/** The short weekday of a real instant, in New York, "Mon" — for "next: Mon 7:36 PM ET". */
const etWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
});

export function formatEtWeekday(instant: Date): string {
  return etWeekdayFormatter.format(instant);
}

/**
 * The LONG weekday of a bare calendar date, "Friday" — for the control room's C5 sentences
 * ("Friday's close is the latest data that exists; nothing new lands before Monday").
 *
 * Takes a TradingDate ("2026-07-17"), not an instant, and reads it in UTC: parse it at UTC noon and
 * read it back in UTC and it cannot drift a day either way. Doing this with a local Date is how you
 * name the wrong weekday for five hours every evening.
 */
const utcWeekdayLongFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
});

export function formatWeekdayLong(date: string): string {
  return utcWeekdayLongFormatter.format(new Date(`${date}T12:00:00Z`));
}
