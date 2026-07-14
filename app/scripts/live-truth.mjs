/**
 * live-truth.mjs — the six questions `check:live` asks production (plan 3.6, ruling E10).
 *
 * THIS FILE IS THE PURE HALF, AND THAT SPLIT IS THE WHOLE DESIGN. It takes the rendered pages as
 * strings and a clock, and returns verdicts. It fetches nothing, reads no environment, and knows
 * nothing about cookies — which is what makes it testable against recorded HTML, including a
 * recording of the outage that commissioned it. `check-live.mjs` is the other half: it signs a
 * session cookie, fetches the two pages, hands them here, and prints the table.
 *
 * WHY THIS EXISTS AT ALL (ruling E10 — "the instrument outranks the vibe"). For two days this app
 * told its reader, in four places at once, that its data ran "through Saturday's close". There is no
 * Saturday close. Every test was green — because every test was asking whether the app rendered its
 * data correctly, and it did. Nothing anywhere asked whether the data was TRUE. The pipeline can now
 * no longer write that lie (the gate, the bar-derived edition, publish's own lock), but a product
 * whose only proof of production health is somebody glancing at it on a phone has no proof at all.
 * This turns "is prod actually right?" from a vibe into a command with an exit code.
 *
 * A CHECKER THAT CANNOT FAIL ITS FIXTURES IS DECORATION. That is the N-build's hardest lesson, and
 * live-truth.test.ts runs every check below against BOTH a healthy recording of production and a
 * reconstruction of the Saturday Desk — so each check is proven to fire on the disease it names, and
 * not merely to pass on a good day.
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
 * The most recent trading session whose CLOSING BELL HAS ALREADY RUNG, as of `now`.
 *
 * The twin of the pipeline's trading_calendar.latest_closed_session, and it has to answer the same
 * way — the pipeline uses it to decide which session to STAMP, and this uses it to decide which
 * session the masthead should be SHOWING. If they disagreed, this instrument would red on a Desk
 * that is perfectly correct. (pipeline/tests/test_calendars_agree.py walks both calendars day by day
 * through 2028 for exactly that reason.)
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

// One shape for all three verdicts. `owed` is null unless a check is PENDING against a later phase —
// uniform, so a caller can read the field without first asking which kind of verdict it holds.
const pass = (surface, expected, found) => ({ surface, expected, found, verdict: "PASS", owed: null });
const fail = (surface, expected, found) => ({ surface, expected, found, verdict: "FAIL", owed: null });
const pending = (surface, expected, found, owed) =>
  ({ surface, expected, found, verdict: "PENDING", owed });

// ── the six checks ────────────────────────────────────────────────────────────────────────────

/**
 * 1. MASTHEAD SESSION TRUTH — the check this whole instrument was built around.
 *
 * Two questions, and only the first is absolute:
 *
 *   (a) IS THE EDITION DATE A TRADING SESSION? Never negotiable, no timing window, no excuse. A
 *       Saturday masthead is the bug; if this ever fails again, everything else is noise.
 *   (b) IS IT THE CURRENT ONE? Nearly always — but not between the closing bell and the night's
 *       publish. The market shuts at 4:00pm ET and job A does not finish until ~6:40pm, so for
 *       roughly three hours every session day the Desk is CORRECTLY showing yesterday's edition:
 *       today's does not exist yet. The product's own promise is "the briefing lands by 9:00pm ET",
 *       so that is the line drawn here. Before it, one session behind is lawful and is reported as
 *       such rather than gated. After it, a stale masthead means the nightly did not land, which is
 *       exactly what a reader deserves to be told.
 *
 * Gating (b) without (b)'s window would give a guard that reds every single evening — and a guard
 * that cries wolf is not there on the night it is right.
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
 * 2. BOARD PRESENCE — the five figures the user reported as "absent".
 *
 * The failure this catches is the MODULE going missing, not a cell being empty. An empty cell that
 * says "not yet reported" is the product working: it is the honest answer to a source that did not
 * answer. A cell that is not on the page at all is the product lying by omission, and no test in the
 * suite would notice, because a component that renders nothing renders nothing wrong.
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
 * 3. INDEX-LEVEL HONESTY — a number under a name it does not belong to.
 *
 * The bug (R0): the Desk printed the SPY ETF's price under the label "S&P 500", so it read 754.94
 * while the index was near 6,800. An ETF tracks its index's percentage move, never its level.
 *
 * The fix was not "always show the real level" — FRED's index series genuinely go missing, and on
 * the Saturday they all did. The fix was that a slot may show a proxy ONLY IF IT SAYS SO. So this
 * check does not ask "is the number right?" (it cannot know). It asks the question that IS
 * checkable, and is the actual honesty rule: is every index slot's source named? A value with no
 * attribution is the failure — whether or not the value happens to be correct today.
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
 * 4. CALENDAR HYGIENE — the rows that outlived the provider that wrote them.
 *
 * Two failures, and the second one is the interesting one.
 *
 * (a) A RETIRED PROVIDER'S STRINGS. "Coinbase Cryptocurrencies" came from the pre-allowlist catalyst
 *     ingest. The write path was fixed a month ago; the ROWS were not, because nothing deletes them.
 *     This grep stays forever — it costs nothing and it is the only thing that would notice.
 *
 * (b) ROWS DATED IN THE PAST. The calendar is a SESSION calendar: it says what is coming. Every row
 *     it shows must be today's session or later. The plan assumed these would self-heal, because the
 *     refresh "replaces the forward window on each run" — and that is exactly why they did not: a row
 *     that has fallen BEHIND the window is not in the window, so the replace never touches it. The
 *     rows rot in place. That reasoning is why this check exists as well as (a): fixing the write path
 *     does not clean the table, and only something that reads production would ever tell you.
 */
const RETIRED_PROVIDERS = ["Coinbase Cryptocurrencies"];

/**
 * The full date of a calendar row, from its "Jul 14" label, resolved against the edition it sits on.
 *
 * The rows carry no year, so one has to be inferred — and it is inferred from the EDITION, like
 * everything else here. It also has to survive the turn of the year: a "Jan 2" row on a December
 * edition belongs to the NEXT year, and naively stamping the edition's year onto it would make it
 * look 363 days stale and red this gate every Christmas. The calendar only ever looks a fortnight
 * ahead, so a row that lands far in the edition's past is really a row in its future, a year on.
 */
function rowDate(monthAbbr, dayOfMonth, edition) {
  const month = MONTHS.findIndex((name) => name.startsWith(monthAbbr));
  if (month < 0) return null;
  const stamp = (y) => `${y}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;

  const candidate = stamp(Number(edition.slice(0, 4)));
  const daysBehind = (new Date(`${edition}T00:00:00Z`) - new Date(`${candidate}T00:00:00Z`)) / 86_400_000;
  return daysBehind > 180 ? stamp(Number(edition.slice(0, 4)) + 1) : candidate;
}

export function checkCalendar(deskText) {
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

  // Rows read "Jul 14 EARNINGS …". Anything dated before THE EDITION's session is stale.
  //
  // Against the edition, not against the clock — the third surface in this file to be corrected the
  // same way, and the reason is worth stating once more. The Desk serves a dated edition, and the
  // calendar is floored at that edition's own session (lib/morning.ts, calendarFloor): an event ON
  // the edition's day is part of that edition and belongs on it. Measured against the WALL CLOCK,
  // this check called the edition's own FOMC decision "a row in the past" at 00:25 ET the moment the
  // date rolled over — a red gate on a Desk that was completely correct. An edition-derived surface
  // is measured against the edition, or the two disagree for a few hours every night.
  const edition = parseLongDate(deskText);
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
 * 5. PRESS-TIME TRUTH — /news's own claim about when it went to press.
 *
 * "Assembled Saturday, July 11, 2026" was the fourth surface that rendered the poisoned stamp
 * faithfully. A press time is a claim that a newsroom sat down that evening; a Saturday press time
 * for a market paper is the same lie as a Saturday close.
 *
 * The byline half of this check (plan 3.6 #5 — "every feed card byline carries a resolvable external
 * url") is PENDING, and deliberately not gated: the feed's publisher names are PLAIN TEXT today, and
 * PD8 (plan 9.4) is the phase that makes them real anchors. It is probed and reported from now, so
 * the day it lands it is already measured — a check added only when the feature ships is a check
 * nobody remembers to add. (This is check-nav.mjs's PENDING mechanism, and the same reasoning.)
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
 * 6. STRIP FUTURE-TRUTH — the "next:" promise.
 *
 * The strip ends with "next: Tue 18:37 ET" — a promise about when the following edition lands. A
 * promise naming a day in the past is worse than no promise; it is the surface most likely to go
 * quietly wrong, because it is derived from the edition date, and the edition date is the thing that
 * was broken. (On the Saturday it read "next: Mon" and was, by accident, right — which is precisely
 * why a check that only looked at this one would have seen nothing.)
 *
 * IT IS MEASURED AGAINST THE EDITION, AND IT TAKES NO CLOCK. This check used to walk forward from
 * `now`, and PD1 caught it the night check:live joined the standing gate: at 00:07 ET on a Tuesday it
 * demanded the strip say "Wed", while the Desk — still serving Monday's edition, correctly promising
 * that evening's — said "Tue". It failed a healthy product, and would have done so every night
 * between midnight and the evening run.
 *
 * The promise is a fact ABOUT THE EDITION ("the next paper after this one"), so the edition is what
 * it is measured against. That is the same lesson as the calendar floor in lib/morning.ts, found in
 * the same hour: a surface derived from the edition must never be checked against the wall clock, or
 * the two disagree for a few hours every night. A STALE masthead is assertion 1's job — and assertion
 * 1 does it loudly, so nothing is lost by taking the clock out of this one.
 */
export function checkNextEdition(deskText) {
  const m = deskText.match(/next: (Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/);
  if (!m) return fail("strip · next-edition promise", "a named next session", "the strip promises nothing");

  const edition = parseLongDate(deskText);
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

/** All six, in the order plan 3.6 lists them. `now` is injected so the tests own the clock. */
export function checkLive({ deskHtml, newsHtml, now }) {
  const deskText = pageText(deskHtml);
  const newsText = pageText(newsHtml);

  return [
    checkMasthead(deskText, now),
    checkBoard(deskText),
    checkIndexHonesty(deskText),
    checkCalendar(deskText),
    checkPressTime(newsText),
    checkBylines(newsHtml),
    checkNextEdition(deskText),
  ];
}
