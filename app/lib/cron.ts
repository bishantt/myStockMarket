import { etAbbreviation, formatEtClock, formatEtWeekday } from "@/lib/time";

/**
 * cron.ts — read a UTC cron line as an ET cadence and the next fire, DST-honestly (CC7, plan 4.6).
 *
 * The pipeline crons are pinned in fixed UTC on purpose (nightly-a.yml explains why), so the reader's
 * ET wall-clock reading of them shifts with the season: 22:37 UTC is 6:37 PM in summer (EDT) and 5:37
 * PM in winter (EST). Worse, a slot near UTC midnight rolls its WEEKDAY back a day in ET — nightly-b's
 * 00:25 UTC Tue–Sat is 8:25 PM ET Mon–Fri. "Subtract five hours" gets both wrong; only a real timezone
 * conversion (through lib/time.ts, the one Intl door) is honest.
 *
 * Everything here is a PURE function — `nextRun` takes the clock as an argument — so every rendering is
 * pinned by a unit test, and the panel can compute the next fire in the browser against the reader's own
 * clock (as the control room already computes its states there).
 */

export type Cron = {
  /** UTC minute (0–59). */
  minute: number;
  /** UTC hour (0–23). */
  hour: number;
  /** UTC weekdays the cron fires on, 0=Sun … 6=Sat, ascending. */
  dows: number[];
};

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const EN_DASH = "–";

/** DST anchors — a summer week (EDT) and a winter week (EST). Fixed literals are lawful in lib/ (drift
 *  rule 21 binds seed/fixtures/e2e); these name daylight-saving regimes, not a seeded world. */
const SUMMER_REF = Date.UTC(2026, 6, 1); // July 2026 — always EDT
const WINTER_REF = Date.UTC(2026, 0, 1); // January 2026 — always EST

/**
 * Parse a five-field cron line. We model WEEKDAY schedules only — the pipeline's crons all constrain
 * the day of week and leave day-of-month and month unrestricted — so a line that pins a day-of-month is
 * refused rather than silently mis-rendered.
 */
export function parseCron(line: string): Cron {
  const parts = line.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`cron: expected 5 fields, got ${parts.length} in "${line}"`);
  }
  const [min, hr, dom, mon, dow] = parts;
  if (dom !== "*" || mon !== "*") {
    throw new Error(`cron: only weekday schedules are modelled (day-of-month and month must be "*"): "${line}"`);
  }
  const minute = Number(min);
  const hour = Number(hr);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error(`cron: bad minute "${min}"`);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error(`cron: bad hour "${hr}"`);
  return { minute, hour, dows: expandDows(dow) };
}

/** Expand a cron weekday field ("1-5", "1,3,5", "*") into a sorted list of 0–6. Cron's 7 means Sunday. */
function expandDows(field: string): number[] {
  if (field === "*") return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<number>();
  for (const token of field.split(",")) {
    const range = token.match(/^([0-7])-([0-7])$/);
    if (range) {
      for (let d = Number(range[1]); d <= Number(range[2]); d++) out.add(d % 7);
    } else if (/^[0-7]$/.test(token)) {
      out.add(Number(token) % 7);
    } else {
      throw new Error(`cron: bad weekday token "${token}"`);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * The next UTC instant at or after `now` that matches the cron. A weekly cron always fires within 8
 * days, so the search is bounded; an empty weekday set (impossible from parseCron) throws rather than
 * looping forever.
 */
export function nextRun(cron: Cron, now: Date): Date {
  for (let i = 0; i <= 8; i++) {
    const base = new Date(now.getTime());
    base.setUTCDate(now.getUTCDate() + i);
    const candidate = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), cron.hour, cron.minute, 0, 0),
    );
    if (cron.dows.includes(candidate.getUTCDay()) && candidate.getTime() >= now.getTime()) {
      return candidate;
    }
  }
  throw new Error("cron: no fire within 8 days — the weekday set is empty");
}

/** "Wed · ~6:37 PM ET" — the next fire, in the reader's one timezone. The "~" honours runner jitter. */
export function describeNextRun(cron: Cron, now: Date): string {
  const instant = nextRun(cron, now);
  return `${formatEtWeekday(instant)} · ~${formatEtClock(instant)} ET`;
}

/**
 * "Mon–Fri · ~6:37 PM EDT / 5:37 PM EST" — the schedule as an ET cadence, with BOTH seasonal times when
 * they differ (a UTC-fixed cron always differs by an hour across DST, so both show; a hypothetical
 * DST-invariant slot would collapse to one). The weekday range is read in ET too, so nightly-b's
 * midnight-UTC slot correctly reads Mon–Fri, not the UTC Tue–Sat.
 */
export function describeCadence(cron: Cron): string {
  const days = renderDowRange(etWeekdays(cron));
  const summer = sampleForDow(SUMMER_REF, cron.dows[0], cron);
  const winter = sampleForDow(WINTER_REF, cron.dows[0], cron);
  const summerClock = formatEtClock(summer);
  const winterClock = formatEtClock(winter);
  const time =
    summerClock === winterClock
      ? `${summerClock} ET`
      : `${summerClock} ${etAbbreviation(summer)} / ${winterClock} ${etAbbreviation(winter)}`;
  return `${days} · ~${time}`;
}

/** The ET weekday indices the cron fires on — read from summer samples, so a UTC→ET day-shift is honoured. */
function etWeekdays(cron: Cron): number[] {
  const et = new Set<number>();
  for (const dow of cron.dows) {
    et.add(DOW_SHORT.indexOf(formatEtWeekday(sampleForDow(SUMMER_REF, dow, cron)) as (typeof DOW_SHORT)[number]));
  }
  return [...et].sort((a, b) => a - b);
}

/** Render a sorted weekday-index list as "Mon–Fri" (contiguous), "Mon" (single) or "Mon, Wed, Fri". */
function renderDowRange(dows: number[]): string {
  if (dows.length === 0) return "";
  if (dows.length === 1) return DOW_SHORT[dows[0]];
  const contiguous = dows.every((d, i) => i === 0 || d === dows[i - 1] + 1);
  return contiguous
    ? `${DOW_SHORT[dows[0]]}${EN_DASH}${DOW_SHORT[dows[dows.length - 1]]}`
    : dows.map((d) => DOW_SHORT[d]).join(", ");
}

/** An instant in the reference month on the given UTC weekday, at the cron's hour:minute. */
function sampleForDow(monthStartUtc: number, dow: number, cron: Cron): Date {
  for (let i = 0; i < 14; i++) {
    const d = new Date(monthStartUtc);
    d.setUTCDate(d.getUTCDate() + i);
    const candidate = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), cron.hour, cron.minute, 0, 0),
    );
    if (candidate.getUTCDay() === dow) return candidate;
  }
  throw new Error(`cron: no ${DOW_SHORT[dow]} found in the reference month`);
}
