/**
 * live-truth.mjs — the six questions `check:live` asks production (plan 3.6, ruling E10).
 *
 * THIS FILE IS THE PURE HALF, AND THAT SPLIT IS THE WHOLE DESIGN. It takes rendered pages as strings and
 * a clock and returns verdicts — fetches nothing, reads no environment, knows nothing about cookies, which
 * is what makes it testable against recorded HTML (including a recording of the outage that commissioned
 * it). `check-live.mjs` is the other half: it signs a cookie, fetches the pages, and prints the table.
 *
 * WHY THIS EXISTS (E10 — "the instrument outranks the vibe"): for two days this app told its reader, in
 * four places, that its data ran "through Saturday's close". There is no Saturday close, and every test
 * was green — because every test asked whether the app rendered its data correctly, not whether the data
 * was TRUE. The pipeline can no longer write that lie, but a product whose only proof of health is a glance
 * at a phone has no proof; this turns "is prod right?" into a command with an exit code. And a checker that
 * cannot fail its fixtures is decoration, so live-truth.test.ts runs every check below against BOTH a
 * healthy recording and a reconstruction of the Saturday Desk.
 */

import calendar from "../lib/market-calendar.json" with { type: "json" };

// ── the calendar: the SAME list the app ships and the pipeline is tested against ──────────────

const HOLIDAYS = calendar.holidays;
const HALF_DAYS = new Set(calendar.halfDays);

/** A bare trading day, "YYYY-MM-DD", as the app writes them. */
export function isTradingDay(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !(day in HOLIDAYS);
}

/** The ET calendar date and wall-clock minute of an instant. */
function easternParts(instant) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type).value;
  const hour = Number(get("hour")) % 24;
  return { day: `${get("year")}-${get("month")}-${get("day")}`, minute: hour * 60 + Number(get("minute")) };
}

/** The day before `day`, as a bare trading date. */
function minusOneDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The most recent trading session strictly before `day`. */
export function previousTradingDay(day) {
  let cursor = minusOneDay(day);
  for (let i = 0; i < 14 && !isTradingDay(cursor); i += 1) cursor = minusOneDay(cursor);
  return cursor;
}

/**
 * The most recent trading session whose CLOSING BELL HAS ALREADY RUNG, as of `now`. The twin of the
 * pipeline's trading_calendar.latest_closed_session — it must answer the same way, because the pipeline
 * uses it to decide which session to STAMP and this to decide which the masthead should SHOW; if they
 * disagreed this would red a correct Desk (test_calendars_agree.py walks both through 2028 for that reason).
 */
export function latestClosedSession(now) {
  const { day, minute } = easternParts(now);
  const closeMinute = HALF_DAYS.has(day) ? 13 * 60 : 16 * 60;
  if (isTradingDay(day) && minute >= closeMinute) return day;
  return previousTradingDay(day);
}

// ── reading a page ────────────────────────────────────────────────────────────────────────────

/** The rendered text of a page: scripts and markup gone, whitespace collapsed. What a reader sees. */
export function pageText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/** Parse "Monday, July 13, 2026" → "2026-07-13". Returns null when the page names no date. */
export function parseLongDate(text) {
  const m = text.match(/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), ([A-Z][a-z]+) (\d{1,2}), (\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1]);
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

/**
 * Which edition the masthead is greeting with (CC9). "Morning Edition" appears only once a dawn has run
 * for today (R6); everything else — the Evening Edition, or a strip-only fallback — is graded the way it
 * always was. This is what lets the checks below judge a morning masthead by the morning's rules without
 * relaxing a single evening assertion.
 */
export function mastheadKind(text) {
  return /Morning Edition/i.test(text) ? "morning" : "evening";
}

// One shape for all three verdicts. `owed` is null unless a check is PENDING against a later phase —
// uniform, so a caller can read the field without first asking which kind of verdict it holds.
const pass = (surface, expected, found) => ({ surface, expected, found, verdict: "PASS", owed: null });
const fail = (surface, expected, found) => ({ surface, expected, found, verdict: "FAIL", owed: null });
const pending = (surface, expected, found, owed) =>
  ({ surface, expected, found, verdict: "PENDING", owed });

// ── the six checks ────────────────────────────────────────────────────────────────────────────

/**
 * 1. MASTHEAD SESSION TRUTH — the check this whole instrument was built around. Two questions, only the
 * first absolute: (a) IS THE EDITION DATE A TRADING SESSION? Never negotiable — a Saturday masthead is the
 * bug. (b) IS IT THE CURRENT ONE? Nearly always, but not between the 4:00pm close and the ~6:40pm publish:
 * for ~three hours each session the Desk CORRECTLY shows yesterday's edition (today's does not exist yet),
 * so the line is drawn at the product's own "briefing by 9:00pm ET" promise — before it, one session behind
 * is lawful and reported as such; after it, a stale masthead means the nightly did not land. Gating (b)
 * without its window would red every evening, and a guard that cries wolf is not there on the night it is right.
 */
export function checkMasthead(deskText, now) {
  const shown = parseLongDate(deskText);
  if (!shown) return fail("masthead · session truth", "an edition date", "the Desk names no date at all");

  if (!isTradingDay(shown)) {
    const weekday = new Date(`${shown}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    return fail(
      "masthead · session truth",
      "an edition dated to a real trading session",
      `${shown} — a ${weekday}. The market never opened. There was no close for this data to be "through".`,
    );
  }

  // THE MORNING EDITION (CC9, R6, and the Q-CC5-2 fix). A Morning masthead is dated TODAY — the reader's
  // own session — which is legitimately AHEAD of the last closed session. The evening logic below would
  // read that as "an edition from the FUTURE" and red a perfectly healthy morning Desk; that false red is
  // exactly what the edition-state machine was built to end. So a morning masthead is judged by the
  // morning's rule: it is honest when its date is today and today is a real session, stale otherwise.
  if (mastheadKind(deskText) === "morning") {
    const today = easternParts(now).day;
    if (shown === today) {
      return pass("masthead · session truth", `${today} (morning edition)`, `${shown} — today's Morning Edition`);
    }
    return fail(
      "masthead · session truth",
      `${today} — today's morning session`,
      `${shown} — a Morning Edition that is not today's. A stale morning the reader's clock should have corrected (R6).`,
    );
  }

  const current = latestClosedSession(now);
  if (shown === current) return pass("masthead · session truth", current, shown);

  if (shown > current) {
    return fail("masthead · session truth", `${current} or earlier`, `${shown} — an edition from the FUTURE`);
  }

  const { day, minute } = easternParts(now);
  const beforeTonightsPublish = isTradingDay(day) && minute < 21 * 60; // the 9:00pm ET promise
  if (beforeTonightsPublish && shown === previousTradingDay(current)) {
    return pending(
      "masthead · session truth",
      current,
      `${shown} — the previous session. Tonight's edition has not been published yet (it is promised by 9:00pm ET).`,
      "tonight's nightly",
    );
  }

  return fail(
    "masthead · session truth",
    current,
    `${shown} — the Desk is showing a STALE edition. The nightly for ${current} did not land.`,
  );
}

/**
 * 2. BOARD PRESENCE — the five figures the user reported as "absent". This catches the MODULE going
 * missing, not a cell being empty: an empty cell saying "not yet reported" is the product working, but a
 * cell not on the page at all is the product lying by omission, and no test notices because a component that
 * renders nothing renders nothing wrong.
 */
const BOARD = [
  { label: "30-yr mortgage", absence: "not yet reported" },
  { label: "Inflation (CPI YoY)", absence: "not yet reported" },
  { label: "Gold (oz)", absence: "not yet reported" },
  { label: "USD → NPR", absence: "not yet reported" },
  { label: "Mood gauge", absence: "Insufficient inputs" },
];

export function checkBoard(deskText) {
  const missing = BOARD.filter((cell) => !deskText.includes(cell.label));
  if (missing.length > 0) {
    return fail(
      "macro board · presence",
      "all five figures on the page",
      `${missing.length} absent from the DOM entirely: ${missing.map((c) => c.label).join(", ")}`,
    );
  }
  return pass("macro board · presence", "all five figures", "mortgage · CPI · gold · rupee · mood");
}

/**
 * 3. INDEX-LEVEL HONESTY — a number under a name it does not belong to. The bug (R0): the Desk printed the
 * SPY ETF's price under "S&P 500", reading 754.94 while the index was near 6,800. The fix was not "always
 * show the real level" (FRED's series genuinely go missing, and on the Saturday all did) but that a slot may
 * show a proxy ONLY IF IT SAYS SO. So this asks the checkable honesty question, not "is the number right?":
 * is every index slot's source named? An unattributed value is the failure, correct or not.
 */
const INDEX_SLOTS = ["S&P 500", "Nasdaq Composite", "Dow"];

export function checkIndexHonesty(deskText) {
  const unattributed = INDEX_SLOTS.filter((slot) => {
    if (!deskText.includes(slot)) return false; // absent slots are check 2's business, not this one
    // The provenance line names each slot's source: "…: FRED, prior close" (the real level) or
    // "…: SPY ETF close" (the labelled proxy). Either is honest. Neither is not.
    const attributed = new RegExp(`${slot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^·\\n]{0,60}?(FRED|ETF)`);
    return !attributed.test(deskText);
  });

  if (unattributed.length > 0) {
    return fail(
      "macro pulse · index honesty",
      "every index slot names its source (a real level, or a proxy that says it is one)",
      `unattributed: ${unattributed.join(", ")} — a number under an index's name with nothing saying where it came from`,
    );
  }
  return pass("macro pulse · index honesty", "every slot attributed", "FRED levels, or an ETF proxy that says so");
}

/**
 * 4. CALENDAR HYGIENE — the rows that outlived the provider that wrote them. Two failures: (a) A RETIRED
 * PROVIDER'S STRINGS — "Coinbase Cryptocurrencies" from the pre-allowlist ingest; the write path was fixed
 * a month ago but nothing deletes the ROWS, so this grep stays forever. (b) ROWS DATED IN THE PAST — the
 * calendar is a SESSION calendar (what is coming), and the plan assumed these self-heal because the refresh
 * "replaces the forward window", which is exactly why they don't: a row that fell BEHIND the window is not
 * in it, so the replace never touches it. Fixing the write path does not clean the table; only reading
 * production tells you.
 */
const RETIRED_PROVIDERS = ["Coinbase Cryptocurrencies"];

/**
 * The full date of a calendar row, from its "Jul 14" label, resolved against the edition it sits on. The
 * rows carry no year, so one is inferred from the EDITION — and it must survive the year turn: a "Jan 2"
 * row on a December edition belongs to NEXT year, and stamping the edition's year would make it look 363
 * days stale and red this every Christmas. The calendar looks only a fortnight ahead, so a row far in the
 * edition's past is really in its future, a year on.
 */
function rowDate(monthAbbr, dayOfMonth, edition) {
  const month = MONTHS.findIndex((name) => name.startsWith(monthAbbr));
  if (month < 0) return null;
  const stamp = (y) => `${y}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;

  const candidate = stamp(Number(edition.slice(0, 4)));
  const daysBehind = (new Date(`${edition}T00:00:00Z`) - new Date(`${candidate}T00:00:00Z`)) / 86_400_000;
  return daysBehind > 180 ? stamp(Number(edition.slice(0, 4)) + 1) : candidate;
}

export function checkCalendar(deskText, now) {
  const section = deskText.slice(deskText.indexOf("Session calendar"));
  const scope = section.slice(0, 600); // the module, not the whole page

  const retired = RETIRED_PROVIDERS.filter((name) => scope.includes(name));
  if (retired.length > 0) {
    return fail(
      "session calendar · hygiene",
      "no rows from a retired provider",
      `still showing: ${retired.join(", ")} — written by the pre-allowlist ingest and never deleted`,
    );
  }

  // Rows read "Jul 14 EARNINGS …"; anything dated before THE FLOOR is stale — measured against the data
  // session (lib/morning.ts's calendarFloor is the run's date), not the clock. In the EVENING the masthead
  // date IS that session, so the evening path is unchanged. In the MORNING the masthead is dated today,
  // which is ahead of the floor; measuring today's leading rows against the display date would flag them,
  // so the morning path measures against the last close — the calendar's real floor. Against the WALL
  // CLOCK this once called the edition's own FOMC decision "a row in the past" the moment midnight rolled
  // over; an edition-derived surface is measured against the edition, or the two disagree every night.
  const edition = mastheadKind(deskText) === "morning" ? latestClosedSession(now) : parseLongDate(deskText);
  if (!edition) {
    return fail("session calendar · hygiene", "an edition to measure against", "the Desk names no date");
  }

  const stale = [...scope.matchAll(/\b([A-Z][a-z]{2}) (\d{1,2})\b/g)]
    .map((m) => rowDate(m[1], Number(m[2]), edition))
    .filter((day) => day !== null && day < edition);

  if (stale.length > 0) {
    return fail(
      "session calendar · hygiene",
      `every row dated ${edition} (the edition) or later`,
      `${stale.length} row(s) behind the edition: ${[...new Set(stale)].join(", ")} — the forward-window refresh never reaches a row that has fallen behind it`,
    );
  }

  return pass("session calendar · hygiene", "no retired providers, no rows behind the edition", "clean");
}

/**
 * 5. PRESS-TIME TRUTH — /news's own claim about when it went to press. "Assembled Saturday, July 11, 2026"
 * was the fourth surface that rendered the poisoned stamp: a Saturday press time for a market paper is the
 * same lie as a Saturday close. The byline half (plan 3.6 #5 — "every card byline carries a resolvable url")
 * is PENDING and not gated: publisher names are PLAIN TEXT today, and PD8 (plan 9.4) makes them anchors; it
 * is probed and reported from now so it is already measured the day it lands (a check added only when the
 * feature ships is one nobody remembers to add).
 */
export function checkPressTime(newsText) {
  const shown = parseLongDate(newsText);
  if (!shown) return fail("news · press-time truth", "an assembled date", "/news names no date");

  if (!isTradingDay(shown)) {
    const weekday = new Date(`${shown}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    return fail(
      "news · press-time truth",
      "a press time on a real session",
      `assembled ${shown} — a ${weekday}. No newsroom sat down for a market that never opened.`,
    );
  }
  return pass("news · press-time truth", "a real session", shown);
}

export function checkBylines(newsHtml) {
  const anchors = [...newsHtml.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"/g)]
    .map((m) => m[1])
    .filter((url) => !url.includes("vercel.app"));

  if (anchors.length === 0) {
    return pending(
      "news · byline links",
      "every feed card's publisher is a real external anchor (E8)",
      "publisher names render as PLAIN TEXT — the feed has no outbound link at all",
      "PD8 (plan 9.4)",
    );
  }
  return pass("news · byline links", "external anchors on the feed", `${anchors.length} outbound link(s)`);
}

/** The next trading session strictly after `day`. */
export function nextTradingDay(day) {
  let cursor = day;
  for (let i = 0; i < 14; i += 1) {
    const next = new Date(`${cursor}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
    if (isTradingDay(cursor)) break;
  }
  return cursor;
}

/**
 * 6. STRIP FUTURE-TRUTH — the "next edition" promise. The strip ends "next edition Tue ~6:37 PM ET" (CC3
 * slimmed it to provenance voice; the phrase was "next: Tue …" before), a promise about when the following
 * edition lands. A promise naming a past day is worse than none, and it is the surface most likely
 * to go quietly wrong because it derives from the edition date — the thing that was broken. (On the Saturday
 * it read "Mon" and was accidentally right, which is why a check that looked only here would see
 * nothing.) IT IS MEASURED AGAINST THE EDITION AND TAKES NO CLOCK: it used to walk from `now`, and PD1 caught
 * it the night check:live joined the gate — at 00:07 ET Tuesday it demanded "Wed" while the Desk, correctly
 * serving Monday's edition, said "Tue". The promise is a fact ABOUT THE EDITION, so the edition is what it is
 * measured against (the calendar-floor lesson again). A STALE masthead is assertion 1's loud job.
 */
export function checkNextEdition(deskText, now) {
  const m = deskText.match(/next edition (Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/);
  if (!m) return fail("strip · next-edition promise", "a named next session", "the strip promises nothing");

  // The strip promises the NEXT nightly, which follows the last CLOSED session — the same session the
  // strip's own freshness derives from. In the evening the masthead date IS that session (unchanged path).
  // In the morning the masthead is dated today, and today's OWN evening is the next edition — so the promise
  // is measured against the last close, exactly as the strip computes it, not against the morning display date.
  const edition = mastheadKind(deskText) === "morning" ? latestClosedSession(now) : parseLongDate(deskText);
  if (!edition) {
    return fail("strip · next-edition promise", "an edition to promise from", "the Desk names no date");
  }

  const promised = m[1];
  const expected = new Date(`${nextTradingDay(edition)}T12:00:00Z`)
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

  if (promised !== expected) {
    return fail(
      "strip · next-edition promise",
      `${expected} (the next session after the ${edition} edition)`,
      `the strip says ${promised}`,
    );
  }
  return pass("strip · next-edition promise", `${expected}, the session after this edition`, promised);
}

/**
 * 7. MORNING WINDOW (CC9, R6) — run only under `--window=morning`, when the gate is checking a production
 * dawn window. It asks the two questions the evening six cannot: (a) IS THE DESK GREETING THE MORNING? A
 * dawn ran, so the masthead must claim the Morning Edition — the edition claim matching the dawn's
 * presence is R6's own promise, and an Evening masthead in a morning window is a morning that never got
 * greeted. (b) WAS THE DAWN A REAL PRE-OPEN RUN? "news & macro refreshed 6:31 AM ET" must name a time
 * before the 9:30 bell; a refresh stamp at, say, 11:00 AM is not the dawn the morning edition promises.
 */
export function checkMorning(deskText) {
  if (mastheadKind(deskText) !== "morning") {
    return fail(
      "masthead · morning window",
      "the Morning Edition (a dawn ran for today — R6)",
      "the Desk is still the Evening Edition — no morning was greeted in the morning window",
    );
  }

  const m = deskText.match(/refreshed (\d{1,2}):(\d{2})\s*(AM|PM) ET/i);
  if (!m) {
    return fail(
      "masthead · morning window",
      "a 'refreshed {time}' stamp before the 9:30 AM ET open",
      "the morning masthead names no refresh time",
    );
  }

  const meridiem = m[3].toUpperCase();
  const minute = ((Number(m[1]) % 12) + (meridiem === "PM" ? 12 : 0)) * 60 + Number(m[2]);
  const stamp = `${m[1]}:${m[2]} ${meridiem} ET`;
  if (minute >= 9 * 60 + 30) {
    return fail(
      "masthead · morning window",
      "a dawn refreshed before the 9:30 AM ET open",
      `refreshed ${stamp} — not a pre-open dawn`,
    );
  }
  return pass("masthead · morning window", "a Morning Edition refreshed before the open", `refreshed ${stamp}`);
}

/**
 * The checks, in the order plan 3.6 lists them. `now` is injected so the tests own the clock. Under
 * `--window=morning` the morning assertion is appended (CC9); the evening six never relax — they run
 * exactly the same, and a morning masthead simply changes how the date-derived three judge it.
 *
 * @param {{ deskHtml: string, newsHtml: string, now: Date, window?: string | null }} args
 */
export function checkLive({ deskHtml, newsHtml, now, window = null }) {
  const deskText = pageText(deskHtml);
  const newsText = pageText(newsHtml);

  const checks = [
    checkMasthead(deskText, now),
    checkBoard(deskText),
    checkIndexHonesty(deskText),
    checkCalendar(deskText, now),
    checkPressTime(newsText),
    checkBylines(newsHtml),
    checkNextEdition(deskText, now),
  ];
  if (window === "morning") checks.push(checkMorning(deskText));
  return checks;
}
