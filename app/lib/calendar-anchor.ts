/**
 * lib/calendar-anchor.ts — the Desk calendar's per-day anchor (PD8, plan 9.6 block 8).
 *
 * A story's watch rows link to the calendar module's day, and the calendar module stamps the anchor.
 * The two sides live in different files, so the id format lives in ONE place here — two spellings of
 * the same anchor is exactly how a link and its target silently walk apart.
 *
 * WHY A HASH LINK IS THE HONEST CHOICE. The Desk calendar shows only a forward window of events, so
 * a watch date far enough out may not be on the page. A `#anchor` that matches nothing simply does
 * NOT scroll — it never 404s — so the reader lands on the Desk calendar either way, at the right day
 * when it is shown and at the top of the module when it is not. There is no dead link to render.
 */

/** The anchor id for a bare trading-day ISO string ("2026-07-12"). Both sides call this. */
export function calendarAnchorId(isoDate: string): string {
  return `cal-${isoDate}`;
}

/** The same, from a `Date` — the calendar builder holds Dates, the watch rows hold ISO strings. */
export function calendarAnchorIdFromDate(date: Date): string {
  return calendarAnchorId(date.toISOString().slice(0, 10));
}

/** The href a watch row uses to reach the Desk calendar's day. */
export function calendarDayHref(isoDate: string): string {
  return `/#${calendarAnchorId(isoDate)}`;
}
