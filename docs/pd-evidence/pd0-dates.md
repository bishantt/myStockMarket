# PD0 — Session truth: the dating contract

**Phase:** PD0 (POLISH-AND-DEPTH-PLAN Part 3) · **Tag:** `pd-0` · **Date:** 2026-07-13

*The Desk told the truth about a lie. Four honest formatters faithfully rendered a pipeline run that
should never have stamped a Saturday. This phase makes that class of error impossible to write and
self-evident when it exists.*

---

## 1. What was actually wrong

On **Saturday 2026-07-11 at 15:33 ET**, a manually dispatched nightly asked the wall clock what day
it was. The clock said Saturday. Alpaca — correctly — returned **Friday's** bars, because Saturday
has no close. The run stamped Friday's data with Saturday's date and published.

Nothing failed. Every gate was green. And for two days the app told its reader, in four places at
once, that its data ran "through Saturday's close" — a close that has never existed.

**The defect was never the arithmetic.** The masthead's day-of-week maths was correct; so was every
formatter downstream of it. The defect is that a **non-session day was allowed to become an edition
date at all** — a wrong PREMISE, which every number below it then reported correctly.

---

## 2. The three layers, and why one was not enough

| # | Layer | Where | What it stops |
|---|---|---|---|
| 1 | **The gate** (N6, verified here) | `job_a.full_run_edition` | A run on a day with no session. The cron `37 22 * * 1-5` never fires at a weekend — but it fires on **every market holiday**, a weekday, ~9× a year. |
| 2 | **The derivation** (PD0) | `job_a.full_run_edition` + `nightly.edition_from_bars` | The side door the gate cannot see: a run at **1:00am ET Tuesday** passes the gate (Tuesday *is* a session) and used to stamp a phantom Tuesday over Monday's bars. The edition now comes from **the session the data describes**, cross-checked against the market's calendar. |
| 3 | **The invariant** (PD0, ruling E1) | `publish._require_session` | Everything else. Modes are policy; **publish is law**. No future mode, backfill script or refactor can write a non-session `run_date` without deleting a named function, which a reviewer can see. |

The reason there are three is that **the first one shipped, looked complete, and was not.**

### Where a run's date now comes from (plan 3.1)

| Mode | Before | After |
|---|---|---|
| `full` (job A) | `datetime.now(ET).date()` — the wall clock | `latest_closed_session(now)`, then **proved against `bars["date"].max()`**. A disagreement fails the night before a row is written. |
| `news` / `macro` | `previous_session(now)` | unchanged — always was session-derived |
| `compute` | `bars["date"].max()` | unchanged — the model everyone else has now adopted |
| briefing (job B) | `datetime.now(ET).date()` | **the edition it assembles**: reads the newest `pipeline_run` and stamps *that*. Refuses (and still pings success) when no edition exists for the session that closed. |

**A stale provider now fails the night loudly.** If Alpaca has not posted Monday's bars by 6:37pm,
the old code would have silently republished Friday's edition under a fresh run — everything green,
the night having done nothing. `edition_from_bars` refuses: *"the ingested bars end on 2026-07-10,
but the market calendar says the session that has closed is 2026-07-13."* Same judgment the coverage
floor already makes.

---

## 3. The audit sweep re-run (plan 3.4)

Greps: `weekday` · `getDay(` / `getUTCDay(` · `toLocaleDateString` · `datetime.now(` · `date.today(`
· `strftime %a/%A` · `.weekday()`. **Every surviving site, with its verdict:**

### App

| Site | Verdict |
|---|---|
| `lib/time.ts` × 4 (`weekday: long/short`) | ✅ **The display door.** Every weekday WORD in the app is minted here. |
| `lib/market-hours.ts:107` (`weekday: "short"`) | ✅ **The calendar door.** Asks New York what day it is to answer *"is the market open?"* — compares against `"Sat"/"Sun"`. No reader ever sees the string. |
| `lib/market-hours.ts:180` (`getUTCDay()`) | ✅ `isTradingDay`'s weekend test. A computation, not a word. |
| `lib/morning.ts` (`weekdayName`) | ❌ **DELETED.** A byte-for-byte duplicate of `formatUtcWeekday`. Now imports it. |

### Pipeline

| Site | Verdict |
|---|---|
| `job_a.py:588` `now = datetime.now(ET)` | ✅ Feeds `full_run_edition` — **no longer `.date()` used as a run date.** |
| `job_a.py:505`, `job_a.py:1036` `previous_session(now)` | ✅ macro / news modes — always session-derived. |
| `job_b.py:108` `now = datetime.now(ET)` | ✅ Feeds `briefing_edition`. |
| `job_b.py:141` `session.weekday()` | ✅ The Friday backup test, on the **derived session**. |
| `job_a.py:214`, `nightly.py:602` `datetime.now(UTC)` | ✅ `fetched_at` — an INSTANT (when we asked a provider), not a session claim. Correct. |
| `publish.py:73` `run_date.strftime("%A")` | ✅ Names the weekday **in the refusal message**. A 2am debugger deserves the whole sentence. |

**Zero `datetime.now().date()` values are used as an edition date anywhere in the pipeline.**

### The census correction

> **Plan Part 3.3 says the census "found exactly one" local weekday formatter. It found one
> DISPLAY formatter. There were two things using `{weekday}`** — the second is `market-hours.ts`,
> and it is not a duplicate at all: it *decides* with a weekday rather than *rendering* one. A rule
> banning it would have forced the market-state check to import a display formatter to do arithmetic
> with, which is worse than the thing it prevents. **Drift rule 22 therefore names two doors, each
> with its reason, and a third fails the build.**

---

## 4. The instruments this phase leaves behind

### `npm run check:live` — the standing production instrument (ruling E10)

Every other guard in this repo asks whether the code is correct. **This one asks whether production
is RIGHT** — and it is the only one that can, because every other guard runs against a database it
built itself thirty seconds earlier. That gap is how the app spent two days claiming a Saturday close
with green CI on every commit.

Six checks, run against the deployed origin. **On its first run against production it found a real,
live defect that nobody had reported:**

```
✓ masthead · session truth      expected: 2026-07-13   found: 2026-07-13
✓ macro board · presence        expected: all five     found: mortgage · CPI · gold · rupee · mood
✓ macro pulse · index honesty   expected: every slot attributed
✗ session calendar · hygiene    found: still showing "Coinbase Cryptocurrencies"
✓ news · press-time truth       found: 2026-07-13
… news · byline links           PENDING → PD8 (plan 9.4): publisher names are plain text
✓ strip · next-edition promise  found: Tue
```

**The plan predicted the Coinbase rows would self-heal on the next run (1.3 #2). They did not, and
the reason is exactly why the check exists:** the calendar refresh replaces the **forward window**,
and a row that has fallen **behind** the window is not in it. Fixing the write path does not clean
the table. Only something that reads production would ever have told you. **→ PD1.**

**It is proven against the disease, not just the health.** `scripts/live-truth.test.ts` runs all six
checks against a real recording of the healthy Desk **and a reconstruction of the Saturday Desk**
(`desk-poisoned-saturday-RECONSTRUCTED.txt` — reconstructed, and the filename says so; the header
sources every string in it). *A checker that cannot fail its fixtures is decoration.*

It also **does not cry wolf**: between the 4:00pm bell and the night's ~6:40pm publish, a Desk showing
yesterday's edition is CORRECT — today's does not exist yet — so that window reports PENDING against
the product's own 9:00pm promise rather than failing. A guard that fails every evening is not there
on the night it is right.

### The two calendars now have to agree

There are two trading calendars in this product and there have to be: `exchange_calendars` (XNYS) in
the pipeline, and a hand-written table in the app (it runs in a browser). **What they may not be is
different** — and every failure mode of a disagreement lands on the *guard*, not the product:
`check:live` would red against a Desk that is perfectly correct, because it would be judging the
truth against the wrong calendar.

- The holiday table is now **one JSON file with three readers** (`lib/market-calendar.json`): the app,
  `check-live.mjs`, and the pipeline's test.
- `pipeline/tests/test_calendars_agree.py` walks **every day from 2026-01-01 to 2028-12-31** and
  compares the ANSWERS, not the lists. They agree. 

> **A horizon fact worth knowing:** `xcals.get_calendar("XNYS")` builds a **rolling** window — 20
> years back, **one year forward**. The pipeline's calendar today knows sessions only to
> **2027-07-13**, and asking beyond it *raises* rather than answering False. Not reachable from a run
> (an edition is always about now), and now pinned by a test — but `_require_session` sits on the
> publish path, so it is written down rather than discovered.

### The seed validator + the TZ matrix

- **`prisma/fixtures/sessions.test.ts`** — every seeded `runDate`/`firedDate`/`resolvesOn` must be a
  trading session. *A fixture that can certify what production forbids is not a fixture; it is a trap
  with a green tick on it.* The seed cannot be imported (it calls `main()` and would write to a
  database), so the test reads its **source** — the same way `test_ci_tag_families.py` reads `ci.yml`.
  Negative-controlled: it fails if it sweeps fewer than 20 dates.
  The offsets are **calendar** days, not sessions: `sessionPlus(-15)` is lawful, `sessionPlus(-12)`
  would land on a Saturday. Nothing about the anchor told you which. Now something does.
- **The TZ matrix** — CI runs the unit suite **twice**, `TZ=UTC` and `TZ=America/New_York`. Until now
  it ran in whatever timezone the machine happened to be in, and nothing pinned it. **Proven capable
  of failing:** a deliberately tz-naive formatter reading a bare trading day passes under UTC and
  fails under New York with `expected 'Thu' to be 'Fri'` — the five-hour-wide bug this app renders
  past every evening. Both legs are green today; the matrix keeps them that way.

---

## 5. Bundle cost, booked rather than buried

`/news`: **195.1 → 196.3 KB** against the **200 KB hard ceiling that does not move.** The cost is
`market-calendar.json` entering the client bundle (the app's market-state line needs the holiday list
on every route).

- An explanatory `_comment` key inside the JSON cost **0.6 KB of browser payload** on its own, and was
  removed — a comment in a bundled JSON is a comment shipped to every reader. The prose lives in
  `market-hours.ts`, where the compiler strips it.
- **Remaining headroom: ≈3.7 KB** (was ≈4.9 KB). **PD5's shared kit and PD9's overlay both spend from
  this same pot** — PD9's code-split is already pre-authorized for exactly this reason. Plan against
  **3.7 KB**, not 4.9.

---

## 6. Deliberate deletions

- **`nightly.py`'s `if is_trading_session(deps.run_date)` guard** around the `fred-indexes` source key.
  Not weakened — **made unreachable**. The edition is now derived from the bars and cross-checked, and
  publish refuses a non-session date, so a night that reaches that line is a night the market had. Its
  test (`test_a_non_session_night_does_not_flag_the_indexes_degraded`) described a state that can no
  longer exist, and was replaced by two stronger ones: a night whose bars **disagree with the
  calendar** publishes nothing, and a night whose bars land on a **Saturday** publishes nothing.
- **`test_nightly.py`'s fixture nights were themselves dishonest.** Bars walked *calendar* days (so a
  fixture night could end on a Saturday) and were anchored at the START, while `run_date` sat beside
  them as a hard-coded constant that did not move when a history's length did. The fixtures described
  one session and claimed another: **the production bug, reproduced inside the test suite, green, for
  months.** They now walk trading sessions and anchor on the session they END on.

---

## 7. The second defect this phase found, and it was in the instruments

**The `db` test fixture promised to truncate every table between tests. It truncated nine of the
schema's twenty-three.**

`briefing`, the P4 analytics set (`base_rate_stat`, `setup_card`, `vol_band`), the news set
(`news_cluster`, `news_image`, `catalyst_link`), the macro board (`macro_stat`), the control room
(`manual_run`), the reader's own state (`paper_trade`, `journal_entry`, `lesson_progress`,
`concept_state`) and `signal_resolution` were **never cleared** — so their rows accumulated across a
whole pytest session and leaked from one test into the next.

**How it surfaced:** PD0's new `test_publish_briefing_accepts_a_real_session` asked
`SELECT run_date FROM briefing` and read back **2026-06-30** — a row written by `test_publish.py`,
twelve tests earlier.

**Why it had never surfaced before, and this is the part to keep:** every db-backed test **SKIPS on a
machine with no Postgres**. The local suite was green. The leak was structurally invisible to the
person most likely to introduce it, and could only ever have been caught in CI. *A fixture whose
docstring is a promise it does not keep is worse than no fixture, because every test written against
it believes the promise.*

Fixed both ways, because either alone leaves a trap: the fixture truncates all 23 tables, **and** the
new test asks for *the row it wrote* rather than for "the only row in the table" — a test that depends
on a table being otherwise empty depends on every other test in the suite.

---

## 8. Gate

| Step | Result |
|---|---|
| `typecheck && lint && test` | ✅ **617** unit tests (was 586) |
| `uv run pytest` | ✅ **504** local / **533** in CI (was 464 / 490) |
| `build` + `check:routes` + `check:bundles` + `check:fonts` | ✅ B1 all cached · B4 worst **196.3 KB** ≤ 200 · fonts **243 KB** / 560 |
| `e2e:local` | ✅ 177 passed (snapshots ignored — CI is the pixel oracle) |
| `check:drift` | ✅ **22** rules (rule 22 added: the weekday door) |
| `check:migrations` (once per phase, local) | ✅ the live database runs the schema in this repo |
| Branch run (app + pipeline) | ✅ [29303996663](https://github.com/bishantt/myStockMarket/actions/runs/29303996663) on `76d69eb` |
| **Rehearsal** — the full oracle, before the tag existed | ✅ [29304013873](https://github.com/bishantt/myStockMarket/actions/runs/29304013873) on `76d69eb`, all three shards |
| **Tag run `pd-0`** | ✅ [29304373351](https://github.com/bishantt/myStockMarket/actions/runs/29304373351) — **green first try, 8 m 4 s** |

**One red, and it was real — not a flake.** The first push (`1af583f`) failed the pipeline job on
`test_publish_briefing_accepts_a_real_session`. Diagnosed rather than re-rolled: it was §7's fixture
defect, fixed forward in `76d69eb`, which is the SHA that was rehearsed and tagged. **Six tags, six
first-try greens on the tagged SHA.**

**Gate size at `pd-0`:** **22 drift rules · 76 VRT baselines · 22 e2e specs · 617 unit tests ·
16 bundle baselines · 14 manifest rooms · tag run 8 m 4 s.**

**Growth booked:** +1 drift rule (22 — E2's weekday door, two named doors and a third fails the
build) · +31 unit tests (the seed validator, `check:live`'s fixture suite) · +40 pipeline tests
(the dating contract, the publish invariant, the two-calendar agreement) · **+1 gate command**
(`check:live`, which joins the standing gate at **PD1**, not here — it is currently RED on a genuine
production defect that PD1 repairs).
