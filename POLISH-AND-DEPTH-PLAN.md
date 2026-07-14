<!-- POLISH-AND-DEPTH-PLAN.md — authored 2026-07-13 (evening), by a planning session running
     while the News & Control build's last phase (N7) was still pending in a parallel session.
     Companion to DEVELOPMENT-PLAN.md, UI-REDESIGN-PLAN.md, APP-FEEL-PLAN.md, and
     NEWS-AND-CONTROL-PLAN.md. Typeset copy: docs/Polish-And-Depth-Plan.pdf.
     Because the tree was a moving target while this was written, this plan cites INTENT and
     ACCEPTANCE CRITERIA, never line numbers. Where it names a file, re-verify against the
     working tree at build time. Where this plan and the tree disagree on a detail, the tree
     wins on the detail and this plan wins on the intent. -->

# POLISH & DEPTH PLAN — "The Second Edition"

*A newspaper's second edition does two things, in a fixed order: it corrects the record, and
then it earns its masthead. This plan is both. First the corrections: the Desk told the truth
about a lie — four honest formatters faithfully rendered a pipeline run that should never have
stamped a Saturday — and the paper's own instruments must now make that class of error
impossible and self-evident. Then the masthead: the paper gets its real name on the door (the
logo, everywhere an app carries identity), a desktop composition that reads as designed rather
than stacked, a phone that never spills, an editorial voice with weight and emphasis where
information earns it, and — the heart of the commission — story pages and ticker pages deep
enough to be worth opening. The organizing rule for every part: right first, then rich. A
beautiful page showing a wrong day is worse than a plain one showing the right day.*

**Executor:** Claude Opus 4.8, unattended, same working rules as DEVELOPMENT-PLAN.md (TDD per
its §6.2, plain-English code and docs, session ritual, DECISIONS/LESSONS logging, phase gates,
ONE PHASE PER SESSION per CLAUDE.md).

**THE AUTONOMY CONTRACT (binding; restates the user's standing directive of 2026-07-11 so this
plan is self-contained).** The user is not watching and will not answer mid-build. Run PD0 →
PD10 to completion, in order, without a single pause for permission:

- **Never ask. Never check in. Never wait.** Do not present options, do not end a reply with
  "shall I continue?" — after a completed step, the next action IS the next step. A phase gate
  passing is not a checkpoint to report and wait at; tag it, and the NEXT session rolls into
  the next phase (one phase per session is the standing rhythm; within a phase, no pauses).
- **Anything that would have been a question goes to QUESTIONS-FOR-BISHANT.md** — marked
  [NEED], [VETO?], or [FYI] as the existing file does — then make the most reasonable
  assumption, mark whatever is built on it (code comment + DECISIONS.md + PROGRESS.md), and
  keep going. The one pre-logged decision in Part 0 proceeds on its stated default if the
  user has not answered it by the time PD1 needs it.
- **The only stop is a genuine, unworkaroundable blocker.** Part 0.3's provisioning list has a
  fixture-backed or fallback path for everything, including the logo file itself. A failing
  gate is not a stop — diagnose, fix, re-run. A time-gated item (tonight's scheduled run, a
  baselines dispatch) is not a stop — dispatch it, poll it (`gh run watch`), and do
  parallelizable work while it runs.
- **Sessions are resumable, not restartable.** Every session: the CLAUDE.md ritual first
  (pull → constitution → PROGRESS → LESSONS → DECISIONS diff for user vetoes → both test
  suites), resume from the position PROGRESS.md records, and before context runs out
  mid-phase, write the exact resumable state to PROGRESS.md and push.
- **Done means done:** `pd-final` tagged with its CI green, every evidence file printed into
  `docs/pd-evidence/`, the Part 12 docs sync executed, and a closing PROGRESS.md entry written
  for the user to read — not a message asking them to look.

**When this plan starts.** After NEWS-AND-CONTROL-PLAN.md is complete: **PD0 begins only after
`nc-final` is tagged with green CI.** If the session ritual finds the news build unfinished
(N7 was open when this was authored), finishing it under its own plan comes first — the two
plans are sequential, never interleaved. Every phase here opens by re-verifying the piece of
the tree it is about to change.

**Authority order for this work:** honesty rules (UI-REDESIGN-PLAN.md Part 2 P1–P14 +
APP-FEEL-PLAN.md Part 2 M-rulings + NEWS-AND-CONTROL-PLAN.md Part 2 C-rulings + this plan's
Part 2 E-rulings) > this plan on **session-dating, brand, detail depth, sheets, and the two
layout defects** > NEWS-AND-CONTROL-PLAN.md on **news/macro/control mechanics** >
APP-FEEL-PLAN.md on **containers, navigation, performance patterns** > UI-REDESIGN-PLAN.md on
**look** (tokens, type, color, material, motion) > DEVELOPMENT-PLAN.md > judgment. This plan
makes three deliberate, user-commissioned amendments to earlier plans (each argued where it
lands, each logged as structural in DECISIONS.md): the macro shelves on the phone become
grids (amends APP-FEEL §4.1's shelf choice — Part 7), the Desk's ≥lg reading order becomes
main-column-then-rail (amends the "DOM order = ritual order at every width" clause — Part 6),
and drift rule 20's imagery single-door gains a second sanctioned door for the brand mark
(Part 5). Where anything in this plan seems to collide with an honesty rule, the honesty rule
wins and the collision gets logged.

**Evidence.** Part 1 is built from: the user's production screenshot of 2026-07-13 10:09am ET
(iPhone, the Desk); the GitHub Actions run ledger for 2026-07-10 → 2026-07-13 (queried live
while authoring); the `cal(1)` calendar for July 2026; a four-way code census of the working
tree taken the same evening (dates/session derivation, layout mechanics, news/data model,
brand/guards inventory — each finding cites its file); QUESTIONS-FOR-BISHANT.md's Q-N6-1 and
Q-N6-2 (the builder's own record of the Saturday defect); and the N6 evidence table. Nothing
in Part 1 is inferred from vibes; where a claim could not be verified it says so and PD0/PD1
re-verify before relying on it.

**Adversarial pass:** Part 14. This plan was attacked along the commission's six lenses
(honesty broken by richness, honesty broken by "insight" copy, executor stalls,
stretched-not-designed desktops, mobile regressions, missed brand assets, unmeasured claims) before
delivery; fixes are integrated inline and Part 14 records the attacks and where each landed.

---

## Part 0 — Decisions I need from you: ONE (plus the decided table and one provisioning item)

*The commissioning instruction: decide local choices, collect global ones here, and pause.
After working the plan to the bottom, exactly one choice needs your hand — it deletes
production rows, which the N6 builder explicitly declined to do on its own judgment (Q-N6-1),
and I will not overrule that instinct on your behalf. It has a stated default so the build
never stalls. Everything else that came close is in 0.2: decided, logged, vetoable.*

### 0.1 THE decision: delete the three Saturday-stamped production rows

Production still holds the poisoned edition: `pipeline_run`, `market_context`, and
`scan_result` rows stamped `2026-07-11` — a Saturday, a day with no session (Part 1.2). From
tonight's Monday run onward they are invisible to every *display* (the Desk serves the latest
row), but they will sit inside any series that ever walks `market_context` or `scan_result`
by date — breadth history, future base-rate work, the evidence tables. The N6 builder wrote
the deletion SQL and parked it in QUESTIONS-FOR-BISHANT.md (Q-N6-1) rather than delete
production data unprompted. This plan turns that question into a decision:

| Option | What happens | Cost |
|---|---|---|
| **A — delete (RECOMMENDED, and the default if unanswered)** | PD1 runs Q-N6-1's exact SQL (against `market_context`, `scan_result`, `pipeline_run` for `run_date = '2026-07-11'`) **after** Monday's real edition has landed and been verified, and records before/after row counts in the evidence file. `signal_log` is untouchable by design (insert-only, trigger-guarded) and is deliberately not in the list. | Three rows of false history are gone. Nothing else changes — no display reads them once Monday's row exists. |
| B — keep, but fence | The rows stay; every future series that walks these tables by date must exclude non-session dates through the trading calendar (a filter the code should arguably grow anyway; E1 adds it at the write side). | False rows remain as a permanent trap for any future reader who forgets the fence. |

**Default: A.** Rationale: the rows describe a session that never happened; the product's own
constitution says a date may only claim a session that occurred (E1). The one honest ledger —
`signal_log` — is explicitly preserved. Veto hook: answer here, a user line in DECISIONS.md,
or editing Q-N6-1 in QUESTIONS-FOR-BISHANT.md; PD1 reads all three before executing.

> **ANSWERED by the user, 2026-07-13 (at commissioning): A — delete them.** PD1 executes
> Q-N6-1's SQL after Monday's edition is verified, exactly as option A describes. This line
> is the user's answer, not an assumption; log it in DECISIONS.md as user-authored when PD1
> runs, and close Q-N6-1 in QUESTIONS-FOR-BISHANT.md with a pointer here.

### 0.2 The calls that came closest to needing you — decided, logged, vetoable

| # | The call | What I chose | Why it did not need you | Veto hook |
|---|---|---|---|---|
| 0.2.1 | **The phone's two macro swipe-shelves become fixed grids** | The "MARKETS — 5 FIGURES, SWIPE" and "MONEY & MOOD — 4 FIGURES, SWIPE" shelves are replaced by static grids sized so every figure is visible at once (Part 7.1): risk gauges 2-up, index echoes 3-up, money stats 2×2. The `Shelf` primitive survives for filter-chip rows. This amends APP-FEEL §4.1's shelf choice for these two modules only. | Your commission asked exactly this question ("evaluate whether that horizontal scroll can be eliminated entirely… WITHOUT demoting any stat"). The shelf's own justification was "position is visibility"; a grid that shows ALL figures at once is strictly more visible than a shelf that hides two off-screen, and the arithmetic fits (Part 7.1). The overflow bug that made the shelves read as a spill is fixed at the component level regardless (Part 7.2). | DECISIONS.md (structural) |
| 0.2.2 | **Desk ≥lg reading order: main column first, then rail** | To fix the dead-gap defect at its root (row-track coupling, Part 1.4), the main column and rail must flow independently at ≥lg. The phone's ritual order stays EXACTLY as it is — 01 pulse, 02 brief, 03 calendar, 04 movers, 05 watchlist, 06 setups, 07/08, scorecard, sources. On desktop, reading/tab order becomes: main stations in ritual order (02, 04, 06, 07/08, scorecard), then the rail's reference matter (03 calendar, 05 watchlist). | The rail is reference matter by the app's own definition (APP-FEEL: "the rail exists to keep reference matter glanceable"). A broadsheet is read column-first; nobody reads a newspaper row-by-row across columns. The phone ritual — the ritual that matters, the evening read — is untouched. The alternative (keeping one shared grid) is the diagnosed cause of the hole. | DECISIONS.md (structural) |
| 0.2.3 | **Deep insight is budgeted: top-8 clusters per night, cost printed at the gate** | The structured multi-section insight (Part 9.3) is generated for the top 8 clusters by significance; every other cluster keeps the existing one-line `why_it_matters`. The nightly gate prints measured token usage and dollar cost; the cap is a constant. Estimated delta ≈ $0.03–0.06/night on top of the current ~$0.33 (measured at PD7's gate, not promised). | The commission orders depth; the cap merely prices it responsibly. Raising the cap later is a one-constant change plus a DECISIONS line. | DECISIONS.md (structural: cost) |
| 0.2.4 | **PWA home-screen name stays "Desk"** | `manifest.ts` `short_name` remains "Desk"; the full name stays "myStockMarket". | "myStockMarket" (13 chars) truncates or shrinks under a home-screen icon on iOS; "Desk" is the app's own name for its main room and reads cleanly under the new mark. The logo carries the brand; the label carries the room. | DECISIONS.md (local) |
| 0.2.5 | **Social preview is ONE static brand card** | `openGraph`/`twitter` metadata point at a single static 1200×630 brand card (logo + wordmark + tagline on the midnight field), served from the already-public `/icons/` prefix. No per-page OG images, no data in previews. | Every page is behind the login wall; a per-page OG image would either leak data to link unfurlers or render blank. One handsome, data-free card is the honest maximum. It also needs zero middleware changes. | DECISIONS.md (local) |
| 0.2.6 | **Android monochrome icon keeps the M glyph** | `icon-monochrome-96.png` keeps deriving from `mark-glyph.svg` (the white M), not from the photographic logo. | A themed/monochrome icon must be a flat silhouette; flattening a full-color raster logo produces mud. The logo's own dominant letterform IS an M — the glyph is consistent with it. | DECISIONS.md (local) |
| 0.2.7 | **Detail overlays: sheet on phone, centered overlay on desktop, full page on deep link** | Tapping a story or ticker from a list opens an in-place overlay (bottom sheet <md, centered L4 overlay ≥md) via Next.js intercepting routes; a direct URL load or refresh renders the same content as the full standalone page. Dismissal returns you exactly where you were (Part 11). | The commission specifies the phone sheet; the desktop overlay is the same "peek without losing your place" need answered with the house's existing L4 overlay material; the full page remains the canonical, shareable form. | DECISIONS.md (structural) |
| 0.2.8 | **Overlay motion: opacity-only entrance; dismissal by scroll physics** | Sheets/overlays that can contain money or probability visuals enter with a 200ms opacity fade (no translate, no scale) and dismiss via overscroll-past-top (scroll mechanics), scrim tap, Esc, the ✕ button, or back. No transform ever animates above a `data-p2` node; the jsdom ancestor walk keeps enforcing it. | P2's ancestor rule is the constitution's sharpest tooth; an entrance slide with a StatFigure inside would break it. Scrolling already moves P2 visuals lawfully — dismissal-by-overscroll is scrolling. This extends the route-fade precedent, same reasoning, and it is enforced by the existing test. | DECISIONS.md (structural: honesty) |
| 0.2.9 | **Richness adds ZERO new color meanings** | The entire visual-richness program (Part 8) spends type, weight-where-loaded, structure, and the EXISTING semantic hues. No new hue acquires a meaning; catalyst types and sectors stay word-chips without color families. | "Color is scarce and always means something" survives only if the meanings stay countable. Nine catalyst-type hues would be confetti with a taxonomy. The richness the user asked for is editorial (emphasis, hierarchy, texture), not chromatic. | DECISIONS.md (structural: honesty) |
| 0.2.10 | **`favicon.ico` becomes a real multi-size .ico via one new devDependency** | `png-to-ico` (tiny, dev-only) joins sharp in the asset generator; `/favicon.ico` finally serves a real 16+32+48 container. Everything else stays sharp-generated PNG/WebP. | Sharp cannot write .ico; the path is already allowlisted and currently serves NOTHING (Part 1.7 — the file does not exist). A real .ico is the only correct fix for the one icon format browsers request by convention. | DECISIONS.md (local) |

### 0.3 Provisioning (actions, not decisions — the build starts without them)

| # | Provision | Where it goes | Needed by | Until it lands |
|---|---|---|---|---|
| PP-1 | **The logo file.** Place `myLogo11.png` (the circular mark on transparency, ~1024×1024) at **`assets/brand/logo-source.png`** (repo root `assets/` — deliberately OUTSIDE `app/public/`, so the 1.3MB master never ships to a browser). | `assets/brand/logo-source.png` | PD2 | PD2's first step checks the path; if absent it copies the file itself from `~/Desktop/myLogo11.png` (verified present on this machine, 2026-07-13) and logs the copy. If BOTH are absent, PD2 alone parks with a [NEED] in QUESTIONS and the build continues with PD3 — nothing else depends on the pixels. |

That is the whole list. Every other secret this plan touches (AUTH_COOKIE_SECRET for the live
smoke, ANTHROPIC_API_KEY for the insight stage, GOLDAPI_KEY for the board) already exists and
is verified live per the N-build's records. The still-open P-2 (GitHub PAT for the control
room's buttons) belongs to the news plan and blocks nothing here.

---
## Part 1 — The diagnosis (evidence first)

*Six defects were commissioned. Each gets the same treatment: what production actually shows,
what the code actually does, the root cause with its file, what is ALREADY fixed (the N6
session found part of this first), what remains, and the test that would have caught it. One
correction to the commission itself leads, because everything else in Part 1.2 depends on it.*

### 1.1 The calendar truth: July 11, 2026 was a Saturday

The commission states: *"Production reads 'Saturday, July 11, 2026' — but July 11, 2026 was a
FRIDAY."* The premise is wrong, and the plan must say so before building on it. `cal 7 2026`:

```
     July 2026
Su Mo Tu We Th Fr Sa
          1  2  3  4
 5  6  7  8  9 10 11
12 13 14 15 16 17 18
```

**July 11, 2026 fell on a Saturday.** (Cross-check: July 4, 2026 was a Saturday — which is
why the market observed Independence Day on Friday July 3.) The masthead's day-of-week math
was CORRECT. So was every formatter downstream of it — the audit in 1.2 proves each one
tz-safe.

The user's instinct, however, was still right, and it matters that we say this too: **the app
was claiming things about a Saturday that can never be true of a Saturday.** "63% above the
50-day average · at Sat's close" — there is no Saturday close. "Data through Sat Jul 11 close"
— no such close exists. A pipeline that "ran at 15:33 ET" on a Saturday — true as a timestamp,
but it should never have produced an *edition*. The defect is not day-of-week arithmetic; it
is that a non-session day was allowed to become an edition date at all. That is bug 1.2's
actual shape, diagnosed next.

### 1.2 Anatomy of the Saturday edition

**The event, from the GitHub Actions ledger (queried 2026-07-13):**

| When (UTC) | Workflow | Trigger | Result |
|---|---|---|---|
| 2026-07-10 23:35 | nightly-a | schedule (cron `37 22 * * 1-5`, GitHub ran it late) | success — Friday's real edition |
| 2026-07-11 03:49 | nightly-b | schedule | success — Friday's briefing (job B stamps the ET date, still Jul 10) |
| **2026-07-11 19:25** | **nightly-a** | **workflow_dispatch (manual)** | **success — THE poisoned run.** 19:25 UTC = 3:25pm EDT; its `finishedAt` ≈ 15:33 ET is exactly the "ran at 15:33 ET on a Saturday" the user saw. |
| 2026-07-13 14:02–14:06 | nightly-a | workflow_dispatch ×3 (the N-build's morning testing) | fail, success, success — these wrote the fresh `macro_stat` rows (gold "Jul 13") visible in the user's 10:09am screenshot |

**Root cause, in the code (all verified in the tree):** `pipeline/jobs/job_a.py`'s `full` mode
derives its identity from the wall clock — `run_date = datetime.now(America/New_York).date()`
— not from the market. On Saturday July 11 someone (a build session, mid-N-phase testing)
manually dispatched the nightly; the run ingested Friday's bars (Alpaca returns the last
session), stamped everything `2026-07-11`, published, and every gate stayed green because
nothing *failed*. Four surfaces then rendered the stamp faithfully:

| Surface | Component → source | Verdict |
|---|---|---|
| Masthead "Saturday, July 11, 2026" | `DeskHeader` → `formatUtcDateLong(pipeline_run.runDate)` | formatter correct; date poisoned |
| Breadth "at Sat's close" | `lib/morning.ts` fills `copy.macro.breadthClose` with a weekday from `market_context.runDate` | formatter correct; date poisoned |
| Strip "Data through Sat Jul 11 close · pipeline ran 15:33" | `PipelineStrip` → `freshness(pipeline_run)`; the 15:33 is the genuine `finishedAt` instant, correctly ET-converted | honest clock, poisoned session |
| News press-time "Assembled Saturday…" | `/news` header → `news_cluster.runDate` | same inheritance |

**What the N6 session already fixed (do not re-fix; verify and build on it):**
- `job_a.py` `main()` now refuses a non-session day: `is_trading_session(run_date)` gates the
  `full` mode (commit c647976), with the same guard in `job_b.py`. The cron never fired on
  weekends (`37 22 * * 1-5`), but it DID fire on ~9 market holidays a year — the gate closes
  both the holiday path and the manual-dispatch path.
- `macro` and `news` modes already derive `previous_session(now)`, and `compute` derives its
  date FROM THE DATA (`bars["date"].max()`) — its docstring says "THE RUN DATE COMES FROM THE
  DATA, NOT THE CLOCK." Those were always correct.
- The control-room panel now grades "can this run now?" against the READER's clock, not a
  cached server clock (commit 0f2e6a0 — a different bug, fixed, noted here so nobody
  re-diagnoses it).

**What remains open — this plan's work (Part 3):**
1. **Q-N6-2, the honest fix the builder deferred:** even gated, `full` still *stamps* the
   wall-clock date. Run it at 1:00am ET on a Tuesday and it would stamp Tuesday over Monday's
   bars — the gate passes (Tuesday is a session) and the lie returns through a side door. The
   run's date must COME FROM THE SESSION THE DATA DESCRIBES, the way `compute` already does.
2. **The poisoned rows** are still in production (Part 0.1's decision).
3. **A publish-boundary invariant** so no future writer — any mode, any refactor — can ever
   commit a non-session `run_date` (defense in depth below the mode-level gates).
4. **The formatter monoculture:** `lib/morning.ts` re-implements `formatUtcWeekday` locally
   (`weekdayName`) instead of importing it. One door for weekday words (E2).
5. **The test gap that let all of this stay green:** the app's unit suite runs in whatever
   timezone the machine happens to be in (no `TZ` pin in vitest config — verified), and NO
   test anywhere asserts "an edition's date is a trading session."

**The tests that would have caught it (and now will):**
- Pipeline: `publish()` refuses `run_date` where `is_trading_session()` is false — a unit test
  feeds it a Saturday and asserts the refusal (Part 3.2).
- Pipeline: `full`'s date derivation test — freeze the clock at Sat 19:25 UTC, assert the run
  either skips (gate) or, once Q-N6-2 lands, derives Friday (Part 3.1).
- App: the vitest suite runs twice in CI — `TZ=UTC` and `TZ=America/New_York` — so any
  formatter that silently depends on machine timezone diverges and fails (Part 3.3).
- Live: `check:live` asserts the production masthead date IS the most recent trading session
  (Part 3.6) — the instrument that turns "is prod actually right?" from a vibe into a command.

### 1.3 The macro board that was "absent"

The commission reads: *"Mortgage rate, inflation, gold, USD→NPR, and the Mood gauge are absent
from the live Desk."* The user's own 10:09am screenshot shows the board PRESENT on the phone —
gold ("4,034.22", stamped Jul 13, from the 10:06am manual run minutes earlier) and USD→NPR
("152.60 buy · 153.20 sell", NRB reference, Jul 9) under the "MONEY & MOOD — 4 FIGURES" label,
with the Mood gauge's honest empty state ("Insufficient inputs tonight — missing: breadth,
volatility, momentum") at the bottom edge of the frame. What the user experienced as "absent"
decomposes into three real things, none of which is a missing migration or a broken write:

1. **The data under the board was the poisoned Saturday edition** (1.2). A Saturday-stamped
   run finds no FRED index levels for its date → the pulse falls back to ETF closes with the
   honest per-row labels (that fallback line in the screenshot is the N1 fix WORKING, on
   garbage input). The Mood gauge found no session inputs for "its" day → honest insufficiency.
   Breadth carried Saturday's label. The board looked broken because the edition was.
2. **The calendar still shows pre-fix rows** ("Coinbase Cryptocurrencies") because
   `calendar_event` refresh replaces the FORWARD window on each run — rows written by the
   pre-N-phase ingest survive until a real run rewrites the window. Tonight's run rewrites it;
   the live check (3.6) greps the payload so a regression can never sit unnoticed again.
3. **Production schema is NOT missing migrations** — `check:migrations` ran green on 2026-07-13,
   and a Vercel deploy applies migrations. This is stated so PD1 does not waste a session
   re-proving it; the playbook still runs the command once as its first probe (evidence, not
   assumption).
   > **[Corrected 2026-07-13, GATE-EFFICIENCY-PLAN G4 — analysis §3.6.]** This item used to say
   > "**`nc-6`'s tag CI** ran `check:migrations` green." **CI has never run it and structurally
   > cannot.** The check asks "is the LIVE database running the schema in this repo?" — and CI
   > migrates a fresh throwaway container on every run, so the only thing it could ever answer is
   > "yes, the container I just built matches the repo," which is not a question worth asking. The
   > check ran **LOCALLY**, against production, on 2026-07-13. An executor who went hunting for it
   > in the `nc-6` tag-run logs would have found nothing and had no way to tell whether the check
   > was missing or the claim was false. That asymmetry is the whole point: **`check:migrations`
   > and (from PD1) `check:live` are the only instruments that can see production, and they are
   > local-only by nature.** Production silently ran without N0's migration for days precisely
   > because nothing asked.

**Expected self-heal:** tonight (Monday 2026-07-13) the cron fires at 22:37 UTC (6:37pm EDT);
job B assembles by ~8:40pm EDT. A green run replaces every stale surface: masthead Monday,
real index levels (or honestly-labeled fallback), board cells with fresh as-ofs, calendar
rewritten, Mood gauge with inputs. **PD1's job is to VERIFY this with evidence, not to assume
it** — and to leave behind the standing instrument (`check:live`) that asserts it every night
thereafter. If tonight's run is NOT green, PD1's decision tree (Part 4) walks the failure to
its stage with the run logs and fixes what it finds; the phase does not end until the board is
verified live, both widths, screenshotted into the evidence file.

### 1.4 Desktop: the hole under the Brief

**Reproduced by inspection; the mechanism is exact.** The Desk's two columns are ONE CSS grid
(`lg:grid-cols-[minmax(0,1fr)_320px]`, modules pinned by `lg:col-start-*`, `grid-flow-row-dense`,
`lg:items-start`). Auto-placement pairs the modules into shared implicit rows:

```
row 1: 01 Macro pulse (col-span-2)
row 2: 02 Daily brief   | 03 Session calendar
row 3: 04 Movers        | 05 Watchlist
row 4: 06 Setup cards   | (empty)
row 5: 07/08/scorecard  | (empty)
```

A grid row is as tall as its TALLEST cell. On a thin night the Brief renders its held/empty
state (~200px) while its row-partner — the Calendar, whose disclosure is default-OPEN on
desktop by APP-FEEL's own rule — renders a full session's rows (~600px+). `items-start` pins
the short Brief to the top of the shared track, and **the difference becomes a dead hole
directly under the Brief**, because 04 Movers is pinned to column 1 of the NEXT row and cannot
begin until the Calendar's track ends. `grid-flow-row-dense` cannot backfill intra-track
slack; it only fills empty CELLS. The 16" MacBook Pro (1512px logical → the `desk:` band)
shows this at its widest and emptiest.

**The law that was missing:** the existing desktop grid contract (news plan §4.3) placed
modules but never legislated what happens when a module is SHORT. Part 6 adds the missing law
— main column and rail flow independently — plus the empty/short-content rules, and locks the
16" width with its own VRT viewport and a deliberately thin-night seed variant, so this class
of defect becomes a pixel-diff, not a user report.

### 1.5 Phone: the spill

Two compounding defects, both verified in the tree:

1. **The change chips overflow their cards.** `StatFigure` lays value + delta chip in one
   non-wrapping flex row (`flex items-baseline gap-2`) with no `min-w-0` and no wrap; shelf
   cards are FIXED width (`w-[150px]`/`w-[170px]`, `shrink-0`); `Surface` applies no overflow
   clip. A wide mono value ("18,321.4") plus a chip ("▲ +0.31% · 1D") exceeds the ~124px
   interior, and the chip bleeds across the rounded border onto the neighboring card — the
   misalignment in the screenshot (DOW's chip crossing into SMALL CAPS, the orphaned "+0.33% ·
   1D" at the left edge is the previous card's chip reaching into the peek zone).
2. **The swipe itself reads as a spill.** The `Shelf` is deliberate (M3: the reader pushes
   it), but on a 390px phone the two macro shelves hide 40–60% of their figures off-screen,
   and combined with defect (1) the peeking fragments read as breakage, not as design.

Part 7 fixes (1) at the component level — every StatFigure consumer heals at once — and
replaces the two macro shelves with all-visible grids per 0.2.1 (the commission's own
suggestion, evaluated and adopted: the arithmetic fits without demoting any figure).

### 1.6 The thin detail pages

**Stock "view more" is a three-level ladder, and the middle rung is the "single line":**
- Level 1: the row itself (mover, scan, watchlist).
- Level 2: the **Rail** — a slide-over fed ONLY by the payload already on the page
  (symbol, name, day change, RVOL, one note line, "Open full view →"). No fetch, by design;
  it is a glance, and its speed contract is why it stays that way (Part 10.3).
- Level 3: `/ticker/[symbol]` — a real route that today renders: header, last close +
  1D change, the candle chart, and the RangeBands ladder. **And nothing else.** No 52-week
  context, no sector line, no signals history, no setup card, no news for the symbol, no
  calendar rows, no paper position — every one of which is ALREADY QUERYABLE from Prisma
  with no new provider (the census mapped each field; Part 10 specs the page against them).

**The news story page has the right skeleton and starves it.** The N5 anatomy is present
(sources with real external links, What happened, Why it matters, By the numbers, Affected
table, Academy doorway, provenance) — but `why_it_matters` is capped at 160 characters BY
DESIGN, `what happened` is the extract summary, and on thin/poisoned nights whole sections
render their absence states. A reader who taps through gets one honest sentence where the
commission demands genuine consequence and context. Part 9 grows the pipeline's computed
truth first (the stats registry), then the narration schema (structured, multi-section,
gated), then the page.

**The feed card never links out.** The publisher's name renders as PLAIN TEXT on the card;
the only tappable source URL in the news UI is on the story page. 6.1's "one tap, always
available" fails on the feed today. Part 9.4 makes the byline a real external anchor on
every card (with the hit-target separation the card link needs).

### 1.7 The brand vacuum

Verified state of every identity surface (census 2026-07-13):

| Surface | Today |
|---|---|
| Browser tab | **No `favicon.ico` exists in the repo at all.** `public/favicon.png` (48px) is orphaned — no `metadata.icons`, no `<link rel="icon">` anywhere, so the tab shows the framework default. The `/favicon.ico` path is allowlisted in the proxy and serves nothing. |
| PWA icons | Real and wired (`manifest.ts` → `/icons/icon-192/512`, maskable-512 at 72% inset, monochrome-96) — but generated from `mark.svg`, the old gradient-tile "M", by `scripts/icons.mjs` (sharp). |
| Apple touch | `public/apple-touch-icon.png` (180px) exists — old mark. |
| Top bar | `Wordmark.tsx`: a CSS gradient tile with a TEXT "M" + the wordmark text (hidden on phone). |
| Login | `BrandPanel`: the same text-"M" tile pattern on the brand gradient. Page is `force-static` and service-worker precached — brand additions must stay CSS/static-image only. |
| Social preview | **Nothing.** No `openGraph`, no `twitter`, no OG image file, no route. |
| Manifest identity | `name: "myStockMarket"`, `short_name: "Desk"`, theme/background from the paper token. |

The good news: the generator precedent (`icons.mjs` + sharp), the public-path plumbing
(`/icons/` prefix + the exact-path allowlist), and the single-door hex discipline all exist.
Part 5 swaps the SOURCE (the real logo), completes the missing formats (ico, OG), and wires
the metadata — it is finishing work on good bones, not a new system.

---
## Part 2 — The honesty rulings, extended (E-rulings)

*The redesign's P-rules, the feel plan's M-rulings, and the news plan's C-rulings all stand
untouched. This plan's new surfaces and new voice meet the constitution here: ten E-rulings,
each ending with the guard that enforces it — a test, a grep, or a gate step, never a hope.
Drift-rule numbers below say "next free number"; the count moves while plans execute, and a
pinned number in a plan is how two rules end up with one name.*

**E1 — A date may only claim a session that happened.** An edition date, a "data through"
label, a breadth close, a press-time: each is a claim that the market traded that day. The
pipeline's mode-level gates (N6) stop the KNOWN paths; E1 adds the invariant at the one choke
point every writer passes: publish. `publish()` (and `publish_briefing`, `publish_news`)
refuses any `run_date` that is not a trading session, loudly, before writing a row. Fixtures
and seeds are held to the same law so a test can never certify what production forbids.
*Guard:* pipeline unit tests feed Saturday/holiday dates to every publish entry point and
assert refusal; a seed validator walks every seeded `runDate` through `is_trading_session`;
`check:live` asserts the production masthead date equals the latest real session.

**E2 — Weekday words come through one door.** Every weekday/day-name string in the app renders
through `lib/time.ts` helpers. The one local duplicate (`weekdayName` in `lib/morning.ts`)
is deleted in favor of the import. New code cannot mint its own `Intl.DateTimeFormat(...,
{weekday})` outside that file.
*Guard:* drift rule (next free number): `weekday:` as an Intl option outside `lib/time.ts` —
zero matches; the vitest TZ matrix (3.3) makes any tz-naive formatter fail visibly.

**E3 — Depth is computed first, narrated second.** Every new "insight" section on a story or
ticker page traces to pipeline-computed values (the stats registry) or provider-attributed
facts (extracts, calendar rows). The narrator's vocabulary GROWS only because the registry
grows (Part 9.2); the narrator still cites every number by id, and the deterministic gate
still drops what it cannot verify. The LLM narrates; it never computes; it never estimates.
*Guard:* the existing `verify.py` tolerance gate runs on every new section (not just
`why_it_matters`); a fixture night includes one insight with a fabricated number and the test
asserts that section — and only that section — is dropped and counted.

**E4 — Insight never advises, and frequency words are earned.** The prompt contract's banned
verbs (buy/sell/should/add/trim…) and no-forecast rule extend verbatim to every new section.
New teeth: **frequency adverbs (usually, often, rarely, typically, tends) are permitted only
in a sentence that cites a computed stat** — an uncited "usually" is folk probability wearing
prose. "What to watch" sections state CALENDAR FACTS (a dated event that exists in
`calendar_event`) — never thresholds-to-act, never "watch for a break above…".
*Guard:* the gate gains a lexicon check: frequency-adverb sentences without a stat citation
are flagged (and the note dropped, same as a bad number); adversarial fixtures pin one of
each banned pattern and assert the drop. The watch section's renderer accepts only calendar
row references, structurally.

**E5 — Emphasis is earned by verification.** The richness program lets a number stand out in
prose (mono, weight where a real weight is loaded) ONLY when it is one of the cluster's
gate-verified `key_numbers` or a registry stat — the N5 headline rule, extended to body copy.
Editorial emphasis on TERMS is a doorway (a glossary underline), never a highlight for its
own sake.
*Guard:* the KeyFigure renderer takes verified ids, not raw strings — misuse is a type error
first and a unit test second (render with an unverified value → throws in dev, renders plain
in prod, and the test pins both).

**E6 — Color keeps its short dictionary.** After this plan, the complete list of things color
may mean is UNCHANGED: direction (blue/orange pair, redundantly encoded), evidence tier/grade
(the tokened chip families), the two amber alert consumers plus the strip/board's sanctioned
additions, danger (PipelineStrip's dead state), interactivity (accent family). Catalyst
types, sectors, themes: words in neutral chips, no hue families. Any element that ACQUIRES a
hue in Parts 5–11 must name which existing meaning it carries.
*Guard:* the amber/danger consumer-list drift rules already enforce their reservations;
the styleguide's richness section (8.5) lists every colored element beside its meaning and
the 3.10 eyeball pass checks "nothing colored without a dictionary entry."

**E7 — Overlays never move probability or money.** An overlay that can contain a `data-p2`
subtree (ticker sheet: RangeBands, StatFigure; story sheet: verified figures) enters with
opacity only — no translate, no scale — exactly like the sanctioned route fade, and for the
same reason: every frame shows every visual complete and unmoving relative to everything
else. Drag-to-dismiss is implemented as overscroll (scroll physics on the sheet's own scroll
container), because scrolling is the one motion that has always lawfully moved P2 content.
No JS may set a transform on the sheet while it contains rendered P2 content.
*Guard:* the existing jsdom ancestor-walk test covers the mounted sheet (the sheet's files
join the P2-file grep's scan set); an e2e opens the ticker sheet with reduced-motion OFF and
asserts the RangeBands node's bounding box is identical on first paint and 400ms later.

**E8 — External links are doors, and they say so.** Every publisher link renders as a real
anchor with `target="_blank"` + `rel="noopener noreferrer"`, labeled by the outlet's name
(never "click here", never a bare icon), with a ≥44px hit target that cannot be confused
with the card's internal link. Linking out is attribution, not endorsement; the app never
wraps, proxies, or interstitials an outbound article link.
*Guard:* unit test on the card/story link components (rel + target + label); the touch-target
sweep includes the byline anchors; drift-adjacent grep: no `redirect?url=`-style wrappers.

**E9 — A sheet is a page you can keep.** Overlay presentation never forks content from the
canonical page: the intercepted route and the standalone route render THE SAME component tree
and data path; the URL in the bar is always the real, shareable, deep-linkable URL; dismissal
is history-back. If the overlay and the page ever diverge in content, the overlay is lying
about what the link holds.
*Guard:* e2e asserts overlay-vs-direct-load DOM equivalence for one story and one ticker
(same headings, same section order, same provenance line); reload-inside-overlay lands on
the full page with identical content.

**E10 — The instrument outranks the vibe.** Every "is production right?" claim this plan
makes becomes a command: `check:live` (3.6) asserts the masthead session, board presence,
calendar hygiene, and press-time truth against the deployed app. From PD1 onward it joins
the standing gate's post-deploy step; a green gate with a wrong production Desk becomes
structurally impossible to sign.
*Guard:* the script itself, in the gate; its own tests run it against recorded fixture
HTML/JSON for both the healthy and each unhealthy state (a checker that cannot fail its
fixtures is decoration — the N-build's "every sweep must assert it swept something" lesson).

---

## Part 3 — Session truth (the dating contract)

*Executes in PD0 (code) and PD1 (production). Everything here is small, sharp, and
test-first; the blast radius lives in the pipeline's core nightly, which is exactly why the
builder deferred it to a commissioned phase (Q-N6-2) instead of slipping it into N6.*

### 3.1 Where a run's date comes from (per mode, the contract)

| Mode | Today | After PD0 |
|---|---|---|
| `full` (job A) | `datetime.now(ET).date()`, gated by `is_trading_session` | **The session the data describes:** after ingest, `run_date = bars["date"].max()` (the same law `compute` already follows), asserted equal to `previous_session(now)` when the gate admitted the run on a session evening. The wall clock chooses nothing; it only schedules. |
| `news` / `macro` (job A) | `previous_session(now(ET))` | unchanged (already session-derived) |
| `compute` (job A) | `bars["date"].max()` | unchanged (the model everyone else adopts) |
| briefing (job B) | `now(ET).date()`, gated | **`previous_session`-consistent with job A's edition:** job B addresses the edition it assembles — it reads the latest `pipeline_run` and stamps THAT `runDate`, refusing (with the healthcheck still pinged success) if none exists for the expected session. A briefing can no longer be dated a day its market data does not carry. |

Two consequences the tests must pin: a `full` run manually dispatched at 1:00am ET Tuesday
now writes MONDAY's edition (bars end Monday) instead of a phantom Tuesday; and a weekend
`full` dispatch still skips at the gate before any of this runs (both layers stay — the gate
is the polite refusal, the derivation is the truth, the publish invariant is the lock).

### 3.2 The publish-boundary invariant (E1's lock)

`pipeline/publish.py` gains one check at the top of every entry point that writes a dated
row (`publish`, `publish_briefing`, `publish_news`): `run_date` must satisfy
`is_trading_session(run_date)` or the function raises `NonSessionRunDate` before touching the
database. This is deliberately BELOW the mode gates: modes are policy, publish is law. The
error message names the date, the weekday, and the calendar that judged it — a future 2am
debugger deserves the whole sentence.

**TDD list (pipeline, PD0):** `test_publish_refuses_saturday` (2026-07-11 → raises) ·
`test_publish_refuses_holiday` (2026-11-26, Thanksgiving → raises) ·
`test_publish_accepts_session` (2026-07-13 → writes) · same trio for `publish_briefing` and
`publish_news` · `test_full_run_date_comes_from_bars` (frozen clock Tue 05:00 UTC, bars end
Monday → edition stamped Monday) · `test_job_b_stamps_edition_not_clock` ·
`test_seed_dates_are_sessions` (the seed validator — every seeded `runDate`/`firedDate`/
`resolvesOn` in `prisma/seed.mjs` and pipeline fixtures passes the calendar; the validator is
a test, so a future seed edit cannot skip it).

### 3.3 App-side truth (PD0)

- **One weekday door (E2):** delete `lib/morning.ts`'s local `weekdayName`; import
  `formatUtcWeekday`. Sweep for any other local weekday formatter (the census found exactly
  one; the sweep asserts it found at least the known one — a sweep that finds nothing must
  fail, per the N-build's lesson).
- **The TZ matrix:** CI's app job runs the unit suite twice — `TZ=UTC npm test` and
  `TZ=America/New_York npm test`. Cost ≈ one extra vitest run (~tens of seconds); what it
  buys: any formatter or date math that silently depends on machine timezone now diverges in
  CI instead of in production. Local `npm test` behavior unchanged.
- **Freshness cases stand:** `lib/freshness.ts` already handles weekend/holiday session
  counting (fresh Friday-on-Saturday is NOT stale); its suite stays the reference for what
  "aging" means. No weekend masthead special-casing is needed ONCE the stamps are honest: a
  Saturday reader sees Friday's edition dated Friday, the strip says "Data through Fri Jul 10
  close · next: Mon", and `MarketStateLine` says "Markets closed" from the reader's clock —
  all three already true in the tree, all three previously sabotaged only by the poisoned
  stamp.

### 3.4 The audit's verdicts (recorded, so the sweep is repeatable)

The census walked every weekday/session/next-edition derivation in app + pipeline. Verdicts:
**correct and tz-safe** — `freshness.ts` (session math), `market-hours.ts` (state, trading-day
walks, holiday list through 2028), `pipeline-control.ts` (why-full-cannot-run strings),
`MarketStateLine`/`MarketState` (reader-clock anchored), strip `next:` (calendar walk), every
`formatUtc*`/`formatEt*` helper, news provenance instants, macro as-of labels. **Suspect only
through inheritance** (fixed by 3.1/3.2): masthead, breadth close, strip session, news
press-time. **Root cause:** `job_a` full-mode dating (3.1). PD0 re-runs this sweep against
the tree at build time (greps: `weekday`, `getDay(`, `toLocaleDateString`, `strftime %a/%A`,
`isoweekday`), records the table with verdicts in `docs/pd-evidence/pd0-dates.md`, and the
sweep must find ≥ the census's known sites or fail itself.

### 3.5 Production repair (PD1, ordered)

1. Confirm tonight's scheduled run (Mon 2026-07-13 22:37 UTC) went green end to end
   (`gh run list`/`watch`); if the session runs before the cron, dispatch modes that are
   lawful now (`macro`/`news`/`compute`) and wait for the close for `full` — the control
   panel's own honesty copy explains why full won't run mid-session.
2. Verify the Monday edition end to end with `check:live` (3.6) + screenshots both widths
   into `docs/pd-evidence/pd1-production.md`.
3. Execute Part 0.1's default (delete the three Saturday rows) ONLY after step 2 passes,
   recording row counts before/after; skip and log if the user vetoed.
4. Re-run `check:live`; attach the output to the evidence file.

### 3.6 `check:live` — the standing instrument (E10)

`app/scripts/check-live.mjs`, run as `npm run check:live` (and from the standing gate's
post-deploy step). Authenticates exactly like `check-nav.mjs` (mints the session cookie from
env). Asserts against the deployed origin:

1. **Masthead session truth:** the Desk's rendered edition date == the latest completed
   trading session per the same calendar the app ships (no Saturday can ever sit there
   silently again).
2. **Board presence:** all five macro stats render a value OR their designed degraded state
   (each cell's as-of within its cadence window); the Mood gauge renders a value or its
   honest insufficiency line — ABSENCE of the module is the failure.
3. **Index-level honesty:** real levels present, or the fallback labels present — a bare
   number with neither is the failure.
4. **Calendar hygiene:** the session-calendar payload contains no retired-provider strings
   (the "Coinbase Cryptocurrencies" regression grep, kept forever) and every visible row is
   dated ≥ today's session window.
5. **Press-time truth:** `/news`'s assembled-date equals a real session; every feed card
   byline carries a resolvable external `url` (HEAD-checked, sampled 3).
6. **Strip future-truth:** the "next:" promise names a FUTURE trading day.

Output: a printed table (surface · expected · found · verdict), non-zero exit on any failure.
Its own unit tests run the checker against recorded healthy and poisoned HTML fixtures — the
poisoned fixture is literally the Saturday Desk, so the instrument provably catches the exact
outage that commissioned it.

### 3.7 Gate additions (PD0/PD1)

PD0: the 3.2 TDD list green · TZ matrix wired into ci.yml and green both legs · E2 drift rule
landed (next free number) · dates evidence file written. PD1: `check:live` green against
production · Monday edition screenshots archived · 0.1 executed-or-vetoed and logged ·
`check:live` joins the standing gate text for every later phase.

---

## Part 4 — Production made current (the PD1 playbook)

*Short by design: 1.3 already did the diagnosis. This is the decision tree the phase follows
so "verify in production" is a procedure, not a mood.*

**Probe order (each records its output in the evidence file):**
1. `npm run check:migrations` — expect clean (1.3 #3); if drift → `gh workflow run migrate.yml`,
   re-check, and record WHICH migration was missing and when it landed.
2. `gh run list --workflow=nightly-a --limit 5` (and `-b`) — expect tonight's scheduled `full`
   green; if red → open the run log, identify the stage from `stageStatus`, fix, re-dispatch.
3. `check:live` — the six assertions of 3.6 against production.
4. Visual: screenshot the Desk (phone width + 1512 desktop) and `/news`; archive.
5. If — and only if — a data defect survives a green run (e.g. a stat absent with a healthy
   provider), THEN inspect the DB read-only via the psql snippets in the evidence file
   template; write-side fixes go through the pipeline, never through hand-edited rows (the
   sole sanctioned hand edit is Part 0.1's deletion).

**Exit:** every 3.6 assertion green against the deployed app on real Monday data; the
evidence file shows the before (Saturday masthead, ETF fallback, Coinbase row) and the after,
side by side; the poisoned rows deleted or the veto logged (0.1); `check:live` wired into the
standing gate. This is the phase that answers the commission's "Do not assume; confirm with
evidence."

---
## Part 5 — Brand: the identity kit (PD2)

*The logo exists (a circular mark: white "M" with a candlestick ascent and an open book, on a
deep indigo field with a violet ring). The app has good plumbing and no identity in it. This
part is a complete manufacturing spec: one source file, one generator script, every artifact
with its size, geometry, budget, and consumer — so the phase produces a finished identity,
not "a PNG dropped in and hoped."*

### 5.1 Sources and sanctioned hex locations

- **Master:** `assets/brand/logo-source.png` (Part 0.3 PP-1; ~1024×1024, circular mark on
  transparency). Never served; never imported by app code; consumed only by the generator.
- **Field color:** the mark's own navy field, sampled ONCE by the generator from the source's
  center-left pixel region and written as a named constant `BRAND_FIELD` in the script with
  the sampled hex committed beside it in a comment (deterministic: the script asserts the
  sample still matches the constant, so a swapped source file announces itself instead of
  silently re-tinting every icon).
- **Hex discipline:** brand hexes may appear in exactly: `app/globals.css`, `lib/tokens.ts`,
  the two mark SVGs, and `app/scripts/brand-assets.mjs` (the generator — `scripts/` sits
  outside the drift scan today; the generator STILL follows the one-door rule by declaring
  its constants at the top with provenance comments).
- `public/mark.svg` (the old gradient tile) retires from every consumer but ONE:
  `mark-glyph.svg` stays as the monochrome-icon source (0.2.6). The generator deletes nothing
  blindly: it rewrites consumers first, and the old tile file is removed only when a grep
  proves it consumer-free.

### 5.2 The artifact table (the phase's checklist and the gate's evidence)

| # | File (under `app/public/` unless noted) | Size / format | Geometry | Consumer |
|---|---|---|---|---|
| 1 | `favicon.ico` | 16+32+48 multi-size ICO | full-bleed circle on transparency (the mark IS circular; at 16px the ring must survive — see 5.3 legibility gate) | browsers by convention; path already proxy-allowlisted |
| 2 | `icons/icon-192.png` | 192² PNG | full-bleed circle on transparency | manifest (purpose `any`) |
| 3 | `icons/icon-512.png` | 512² PNG | full-bleed circle on transparency | manifest (purpose `any`) |
| 4 | `icons/icon-maskable-512.png` | 512² PNG, OPAQUE | **the mark's circle at 77% of canvas (394px), centered, on a solid `BRAND_FIELD` square** — the maskable safe zone is a centered circle of radius 40% (204.8px); a 394px mark keeps its ring inside 197px radius with ~4% breathing room, so every OS mask shape (circle, squircle, rounded square) crops field, never mark | manifest (purpose `maskable`) |
| 5 | `icons/icon-maskable-192.png` | 192² PNG, same geometry scaled | same | manifest (purpose `maskable`) |
| 6 | `icons/icon-monochrome-96.png` | 96² PNG, white on transparent | from `mark-glyph.svg` (0.2.6) | manifest (purpose `monochrome`) |
| 7 | `apple-touch-icon.png` | 180² PNG, **OPAQUE** | mark circle at ~88% on `BRAND_FIELD` (iOS applies its own corner mask to an opaque square; transparency renders as black) | iOS home screen; path allowlisted |
| 8 | `icons/brandmark-64.webp` + `-64.png` fallback | 64² (≤4KB) | full-bleed circle, transparent | the in-app `BrandMark` (top bar, 28px display) |
| 9 | `icons/brandmark-192.webp` + `-192.png` | 192² (≤12KB) | same | login panel (~96px display), settings about |
| 10 | `icons/og-card.png` | **1200×630 PNG ≤ 300KB** | see 5.6 | `metadata.openGraph.images` + `twitter` (`summary_large_image`) |
| 11 | *(kept)* `mark-glyph.svg` | — | — | monochrome source only |

Every row is a gate item: PD2's exit lists each file with its byte size printed. Budgets:
rows 1–9 sum ≤ 120KB; row 10 ≤ 300KB. No JS bundle change (images are not code);
`check:bundles` proves it by not moving.

### 5.3 The generator: `app/scripts/brand-assets.mjs` (`npm run brand`)

Extends the `icons.mjs` precedent (sharp, committed script, deterministic output — same
input bytes → same output bytes, so CI can prove nobody hand-edited an icon):

1. Load `assets/brand/logo-source.png`; assert square, ≥1024, has transparency; assert the
   `BRAND_FIELD` sample matches the committed constant.
2. Trim the transparent margin to the circle's true bounding box (sharp `trim` against
   alpha), THEN compose per-geometry — trimming first is what makes "77% of canvas" mean the
   mark, not the mark-plus-invisible-padding.
3. Emit rows 1–10 (row 1 via `png-to-ico` from the 16/32/48 renders; 0.2.10). Lanczos3
   downscaling (sharp's default) — no sharpening pass at ≤32px, which halos the ring.
4. Print a table of emitted files + bytes; exit non-zero if any budget in 5.2 is exceeded.
5. `npm run icons` becomes an alias of `npm run brand` (one generator; the old script's
   mark.svg path retires with it).

**The 16px legibility gate (eyeball, honest):** at 16px the candlesticks and book will read
as texture — that is acceptable; what must survive is the identity silhouette: violet ring +
white M. PD2 renders `favicon.ico`'s 16px member at actual size in the evidence file beside
the tab screenshot. If the M is not recognizably an M at 16px, the sanctioned fallback (a
logged decision, not a redesign): the 16px member alone renders the mark at 115% (letting
the OS-clipped edge trade ring for glyph). No new artwork; no invented favicon.

### 5.4 Metadata & manifest wiring

- `app/app/layout.tsx` `metadata` gains: `icons` (icon → `/favicon.ico` + `/icons/icon-192.png`,
  `apple` → `/apple-touch-icon.png`), `openGraph` (title, description, `images:
  ["/icons/og-card.png"]`, `siteName: "myStockMarket"`), `twitter` (`card:
  "summary_large_image"`, same image). `metadataBase` set from `APP_BASE_URL` so the OG URL
  is absolute (unfurlers require it).
- `manifest.ts`: icons list updated to rows 2–6 (adding maskable-192); `name` stays
  `myStockMarket`, `short_name` stays `Desk` (0.2.4); theme/background colors stay
  token-driven (the logo's field is close to Midnight paper; DO NOT hardcode a new hex here).
- **Proxy check (the trap the census flagged):** every path above already passes the wall
  (`/icons/` prefix, `/favicon.ico`, `/apple-touch-icon.png`, `/manifest.webmanifest` exact).
  PD2 adds an e2e that fetches each brand path UNAUTHENTICATED and asserts 200 + correct
  content-type — the test that catches the day someone renames a path out of the allowlist.
- Serwist: the login page is precached; its brand image (row 9) joins
  `additionalPrecacheEntries` (content-hash revisioned) so the offline login keeps its mark.

### 5.5 In-app lockups (`BrandMark`, one component — and drift rule 20's second door)

Drift rule 20 makes `NewsImage` the single door for imagery (`<img>`/`next/image` banned
elsewhere). The brand mark is the argued second door: **`components/BrandMark.tsx`** — a
plain `<img>` (static asset, fixed intrinsic size, no optimizer, no CLS) with `size` prop
(28 top bar / 96 login / 20 inline), explicit width/height, `alt="myStockMarket"` (or `""`
where adjacent text names the app), `draggable={false}`. Rule 20's allowlist gains
`BrandMark.tsx`, and the amendment is logged (Part 0 authority note).

- **Top bar (`Wordmark.tsx`):** the gradient text-"M" tile is replaced by `BrandMark`
  size 28; the wordmark TEXT stays exactly as it is (mono, uppercase, tracking, accent-deep,
  hidden below `sm`). The tile's `--gradient-brand` consumer count drops to one (login panel
  + primary buttons per its token contract — re-count and log).
- **Login (`BrandPanel`):** `BrandMark` size 96 above the headline; the wordmark line stays
  text (it is part of the headline's typography, not an image); everything else in 5.7's OG
  card echoes this composition so the login and the link preview read as one identity. The
  page stays `force-static` — `BrandMark` is a static `<img>`, which is static-safe.
- **Settings about line:** `BrandMark` size 20 beside the version/edition line (the one
  place the mark appears inside a room, quietly).
- The Desk masthead does NOT gain the logo. The masthead is the DATE (the product's hero);
  the mark lives in the chrome above it. Restraint is the brand here.

### 5.6 The OG card (row 10)

Composition (rendered once by the generator from a small HTML template via sharp-composited
layers — no headless browser dependency in the app): `BRAND_FIELD` background; the mark at
420px centered-left at x≈120px; wordmark "myStockMarket" in JetBrains Mono uppercase
(tracking 0.08em) + one line in Inter — `US equities, after the close.` — set right of the
mark; a 2px violet ring accent along the bottom edge. No data, no numbers, no fake UI
screenshot (a screenshot in an OG card goes stale the day the UI moves — and every page is
login-walled anyway; 0.2.5). Both fonts subset from the app's own woff2s at build time —
if that turns fragile, the sanctioned fallback is system-ui for the tagline and the mark
alone carries the identity (logged).

### 5.7 Tests & gate (PD2)

Unit: generator geometry (maskable inset math, trim behavior, budget enforcement — run
against a fixture PNG, not the real logo, so the test is hermetic) · `BrandMark` renders
with explicit dimensions (CLS 0) and the alt contract. E2e: unauthenticated 200s for every
5.2 path · login shows the mark (both themes) · tab-icon request resolves (the favicon.ico
200 + `image/x-icon`). VRT: login both themes re-baselined; top bar re-baselined (every
page shot moves — this is the expected diff the commit body names); a styleguide "identity"
section (mark at 16/28/64/96 + the OG card at 50%) becomes the permanent visual spec.
MANUAL (photographed into evidence): iOS add-to-home-screen shows the maskable mark on the
brand field (not a white-boxed transparency); the installed app's splash/label read "Desk";
a Slack/iMessage paste of the app URL unfurls the OG card. Lighthouse: LCP on `/login`
unchanged ±10% (the mark is ≤12KB — if LCP moves more, the image joined the critical path
wrongly; fix, don't accept).

---

## Part 6 — The desktop grid contract v2 (PD3)

*The news plan's §4.3 placed every room's modules; what it never legislated is what happens
when a module is SHORT — and the Desk's two columns share row tracks, so one short module
digs a hole (1.4). This part keeps everything §4.3 got right and adds the missing laws. The
16" MacBook Pro (1512px logical) becomes a first-class, pixel-locked viewport.*

### 6.1 What stands (re-affirmed, not re-opened)

Breakpoints `lg` 1024 / `desk` 1366 / `wide` 1536; container `max-w-[1360px]` →
`wide:max-w-[1500px]`; gutters `px-4` → `desk:px-8`; rail 320 → 340 (desk) → 360 (wide);
module gap 24px; **no third reading column at any width**; shelves never render ≥md; the
per-room composition table of §4.3 (scans 2-up/3-up, paper 5/7, track 5-up + 7/5, ticker
8/12+4/12, news 8/12+4/12, academy 2-up/3-up, settings 2-up). The phone ritual order is
untouched everywhere in this plan.

### 6.2 The two new laws

**LAW 1 — Independent column flow (the hole-killer).** At ≥lg the Desk's main column and
rail are two independently-flowing stacks, not one shared 2-D grid: a short main module is
followed IMMEDIATELY by the next main module; the rail packs its own reference matter beside
them; the columns never trade track heights. Chosen implementation (decided; the gates below
define done, and the tree wins on detail if a cleaner equivalent passes them all): the page
keeps ONE source order — the phone ritual — and at ≥lg composes via a two-column grid whose
children are two wrapper stacks (`main` / `rail`), with the phone layout restored by
`display: contents` on the wrappers plus explicit `order` utilities on the modules below
`lg`. Reading/tab order ≥lg becomes main-then-rail per 0.2.2 (amendment, logged); BELOW `lg`
the DOM's visual order must equal the ritual exactly, and the updated ritual e2e asserts the
VISUAL sequence per viewport (bounding-box Y order), not just DOM order — the assertion that
actually matches what a reader experiences.

**LAW 2 — Short and empty modules take only the height they earn.**
- A module with content renders at its natural height; NOTHING reserves height (`min-h`,
  aspect boxes, fixed heights stay banned on module Surfaces — today true; now a stated law
  with a grep).
- An EMPTY module renders its Placeholder as a slim information band: masthead + one line +
  timestamp, ≤ ~112px. The Placeholder graduates from a page-local helper to
  `components/EmptyModule.tsx` (it is about to have consumers on several rooms), keeping its
  copy-deck voice ("information, not an apology").
- The Brief's HELD state (verification gate held the prose) keeps its four faint slot rules —
  that render IS information (what would have been here and why it is not) — but caps at its
  natural height; no stretching to fill a partner's track (Law 1 makes partners irrelevant).
- **No module may be conditionally UNRENDERED to save space** — absence is a state to show,
  never a layout convenience (M2's instinct, made a layout law).

### 6.3 The 16-inch lock (and the thin-night shot)

- New VRT project **`mbp16`: 1512×982**, scoped like `wide` to `vrt|hardening` specs, light
  theme. The Desk, `/news`, `/scans`, `/paper`, `/track-record`, `/ticker/[symbol]` each get
  one `mbp16` row.
- **The Desk additionally gets a THIN-NIGHT variant shot** at `mbp16`: the seed grows a
  deliberately sparse edition (briefing HELD, three movers, no setup cards) so the exact
  failure mode the user photographed — short Brief beside open Calendar — is pinned as
  pixels. This is the shot that would have caught 1.4 before a human did.
- The `hardening` no-horizontal-scroll sweep runs at `mbp16` too (three widths: 390, 1512,
  1536).

### 6.4 Per-room verification pass

PD3 walks every room at 1366 / 1512 / 1536 against §4.3's map and this part's laws, and
records a table (room · width · verdict · fix if any) in `docs/pd-evidence/pd3-grid.md`.
Known work beyond the Desk (from the census): the room-level containers repeat one literal
class string in three files — extract `components/PageContainer.tsx` (one door for the
container, so `wide:` changes stop being a three-file sweep); `/news`'s rail (the context
rail from §7.7) gets the same Law-1 treatment if its columns share tracks; every other room
verified-then-recorded (most are single-column or already independently gridded — the pass
PROVES it rather than assuming).

### 6.5 Tests & gate (PD3)

Unit: EmptyModule contract (height class, copy, timestamp) · Law-2 grep (no `min-h-` on
module Surfaces) wired as a drift rule (next free number). E2e: ritual visual-order per
viewport (phone = full ritual; ≥lg = main-then-rail) · no-horizontal-scroll at 390/1512/1536
· thin-night Desk has NO dead vertical gap > 48px between consecutive main modules (a
bounding-box walk — the direct, mechanical encoding of the user's complaint). VRT: the
`mbp16` rows land (baselines born in CI per the skill); Desk thin-night variant; every room
re-shot where its container changed. Evidence: before/after screenshots at 1512 from the
same seed.

---
## Part 7 — The phone composition (PD4)

*Two fixes: the component-level overflow (heals every consumer at once), and the macro
shelves becoming grids (0.2.1). Then the sweep that proves the whole phone never scrolls
sideways again.*

### 7.1 The macro grids (replacing the two swipe shelves)

**Markets (module 01, phone):** the S&P hero keeps its full-width slot and its one 48px
numeral (P14 untouched). Below it, in place of the 5-figure shelf:

```
row A (2-up, roomier):   VIX          | 10-year
row B (3-up, denser):    Nasdaq       | Dow          | Small caps
```

The hierarchy is reasoned, not decorative: row A carries the two figures with INDEPENDENT
information (the risk gauges — the same argument APP-FEEL used to put them first on the
shelf, now expressed as room instead of position); row B carries the equity-tape echoes the
hero already summarizes, at a deliberately denser scale. Cells are `Surface` cards in a CSS
grid (`grid-cols-2` / `grid-cols-3`, `gap-2`), value at `--text-num` (row A) and one step
down (row B), each keeping its delta chip and proxy chip exactly as today. At 390px a row-B
cell measures ≈ 112px interior — the chip-below-value stack (7.2) fits with room to spare;
at 360px (the audit's second width) it still fits because the stack WRAPS by contract rather
than by luck. Breadth strip: unchanged, full-width below the grid (its "summary anchor" duty
survives verbatim). Count lines: the shelves' M8 "swipe" strings retire; the figures are all
visible, so the count line's honest job is done by the layout itself — `copy.pulse.marketsShelf`
and `copy.pulse.moneyShelf` are deleted with their consumers (Appendix A).

**Money & mood (module 01's board row, phone):** the 4-figure shelf becomes a 2×2 grid
(mortgage | inflation / gold | USD→NPR), same cell anatomy as row A. The Mood gauge stays
full-width below (unchanged — it is position-not-angle and P13-audited).

**≥md:** nothing changes — the shelves never rendered there; the existing md/desk grids
stand.

**What happens to `Shelf`:** it remains the house rail for filter-chip rows (`/news`) and any
future GLANCE rail; nothing else uses it on the Desk after this phase. Its `countLine`
contract and physics are untouched. The amendment is logged (0.2.1) with the visibility
argument in the DECISIONS line.

### 7.2 The `StatFigure` overflow contract (the component-level heal)

The value+chip row inside `StatFigure` becomes wrap-tolerant and shrink-safe:

- container: `flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0`
- the chip: `max-w-full` and it WRAPS BELOW the value when the two cannot share a line —
  **numbers never truncate, never ellipsize, never clip** (truncating a figure is lying about
  it; wrapping is just typography). The window token (`· 1D`) stays inside the chip.
- `Surface` gains no global overflow clip (clipping is the dishonest fix); the contract is
  "fit by wrapping", verified by pixels.

Every consumer heals at once: shelf cells (until they retire), the new grid cells, the ticker
header figure, track-record summary, scan tables' phone card-rows. A component unit test pins
the class contract; the PIXEL truth is owned by VRT (jsdom has no layout) — the phone Desk
baseline set and the 360px sweep below.

### 7.3 The phone-wide overflow sweep

The `hardening` no-horizontal-scroll assertion (today: wide viewports) extends to the phone
project AND to a 360×780 context (the smallest width the product honors, per the redesign's
breakpoints): every routed room, `document.documentElement.scrollWidth ===
document.documentElement.clientWidth`. The sweep asserts it visited ≥ the route-map's room
count (a sweep must prove it swept). Chip rows that legitimately scroll (`/news` filters, a
`Shelf`) are inner containers with `overscroll-behavior-x: contain` — the PAGE never scrolls
sideways; the sweep tests the page.

### 7.4 Alignment rhythm

Within each macro grid row, cells share equal heights (grid's natural behavior once heights
aren't content-coupled across a scroller): label / value / chip / as-of sit on consistent
baselines across siblings (`Surface` interior uses the same stack order everywhere —
StatFigure already guarantees this; the grid makes it visible). The VRT phone shots are the
lock; the eyeball item is "the board reads as a set table, not a spill."

### 7.5 Tests & gate (PD4)

Unit: StatFigure wrap contract · copy-deck deletions compile (no orphaned keys — the deck's
type makes a missing key a build error). E2e: overflow sweep at Pixel-7 width and 360 ·
board grid cell count (5 markets + 4 money + gauge present). VRT: phone Desk re-baselined
(markets grid, money grid — named expected diffs); 360 is sweep-only (no new baseline set —
one width of pixel truth is enough when the other is behaviorally asserted). Evidence:
before/after phone screenshots into `docs/pd-evidence/pd4-phone.md`, including the exact
DOW-chip-overflow frame reproduced-then-healed.

---

## Part 8 — Editorial richness: the visual language (PD5 system + Desk/News; PD6 remaining rooms)

*The commission: make it feel alive and authentic — accent chips, semantic color that
carries meaning, weight and emphasis on terms that matter, treatments that let symbols,
tickers, and figures stand out — WITHOUT touching one stone of the honesty ledger. The
answer is an editorial system, not decoration: every treatment below names the information
it carries. Two hard boundaries first, because they bound everything: richness adds ZERO new
color meanings (0.2.9, E6), and NOTHING moves (P2 verbatim; the only new "life" is texture,
weight, and hierarchy at rest). One more, from the type system itself: the app loads Inter
400/600, Mono 400/500/600, Playfair 700 + italic, Newsreader roman+italic — and NO OTHER
WEIGHT EXISTS. Prose emphasis therefore never uses bold inside Newsreader (the browser would
synthesize it — fake bold is banned by the type system's own reasoning); prose emphasis is
italic, mono figures, or a doorway underline.*

### 8.1 The reading model (what the eye lands on, room by room)

The hierarchy contract each surface is styled — and then VERIFIED — against. One hero per
view (P14); the table is the eyeball-pass script:

| Room | First read (the hero) | Second read | Reference (quiet) |
|---|---|---|---|
| Desk | the edition date (masthead) | S&P hero figure → brief headline | strip, provenance, footers |
| /news | lead story headline | catalyst/sector tags → why-it-matters | press-time, filters, corroboration whispers |
| /news/[cluster] | the headline | What happened → the insight sections | sources, provenance |
| /scans | preset title + tier | match counts | criteria lines |
| /scans/[preset] | the match table's symbol column | metric columns | provenance footer |
| /paper | the ticket's cost mirror | ledger rows | bucket labels |
| /track-record | the summary stat row | resolved-log rows (hits AND misses, equal weight) | filters |
| /ticker/[symbol] | the Range Ladder | 52-week strip + last close | identity line, calendar, provenance |
| Academy | lesson/section serif titles | prose | kickers, read-ticks |
| Login | the headline (Playfair italic) | the mark | licensing line |

### 8.2 The treatment kit (built once in PD5, consumed everywhere)

Each treatment: what it is → the information it carries → its guard.

1. **`TickerChip`** (new, `components/TickerChip.tsx`): every ticker symbol that navigates
   becomes one consistent chip — mono 500, `--radius-chip`, hairline border, ink text;
   hover/focus: accent-deep text + accent-soft wash (color = interactivity, its existing
   meaning); optional trailing move (`+2.1% · 1D`) keeps the pair colors it already has.
   Carries: "this symbol is a door (to `/ticker/…`)." Consumers: movers rows, news cards,
   affected tables, watchlist, scan tables. *Guard:* drift rule (next free number): an
   internal `href` matching `/ticker/` renders only through `TickerChip` — one door, greppable.

   > **[Pre-decided 2026-07-13, GATE-EFFICIENCY-PLAN G4 — MARKED ASSUMPTION, logged in
   > QUESTIONS-FOR-BISHANT.md (Q-G4-1) for veto. Analysis §3.7 / R14.]** The optional trailing
   > **move chip is a money/probability figure**, and TickerChip is the first component in this
   > build where a *hoverable, interactive* element and a *P2 figure* are the same piece of UI.
   > That collision has been deferred twice; PD5 forces it. **The ruling, unless Bishan vetoes:**
   > 1. **The delta chip carries `data-p2`.** It is a market figure — it is exactly the class of
   >    thing P2 exists to hold still.
   > 2. **Any hover TickerChip keeps must be NON-ANIMATING on the figure: opacity and underline
   >    only — no transform, no scale, no translate, no color transition on the number itself.**
   >    The accent wash on hover is fine (it is chrome, and it signals a door). The number does not
   >    move, and nothing containing the number moves.
   >
   > **Why this way.** The alternative — drop `data-p2` so the chip can animate freely — trades a
   > permanent honesty guarantee for a hover effect, and P2 is not a style rule: a number that
   > reacts to the cursor is a number that looks like it is doing something, and this app's whole
   > thesis is that it isn't. If the two genuinely cannot be reconciled on some surface, **the
   > figure wins and the interactivity goes** — but they reconcile fine here, because a wash is not
   > a transform.
2. **`Term`** (new, `components/Term.tsx`): a glossary doorway — dotted underline
   (`text-decoration: underline dotted` + `underline-offset`), ink text (NOT accent — it is
   a definition, not a call to act), opening the existing `GlossaryPopover`. Budget: ≤2 per
   paragraph, first occurrence only (an underline forest is noise). Carries: "this word has
   a definition one tap away." Consumers: brief prose, news insight sections, scan criteria,
   Academy cross-refs. *Guard:* unit test pins the budget (a paragraph fixture with 3 terms
   renders 2); the popover consumer list stays the blur-budget's five.
3. **`KeyFigure`** (new, inline): a verified number inside prose set in JetBrains Mono 500,
   same size as the surrounding text, ink (light) / brightened ink (dark) —
   weight-where-loaded, no color. Carries: "this figure passed the verification gate" (E5 — emphasis is
   earned). Consumers: news headlines (exists since N5 — that renderer merges into this
   component), why-it-matters/insight prose, brief numbers. *Guard:* E5's typed-ids contract
   + unit test.
4. **Editorial italics** (existing convention, now stated): Newsreader italic for setup
   pattern names, folklore labels, the "so what" line. Carries: editorial register (the
   paper's voice commenting, not reporting). No guard beyond the styleguide entry — it is
   typography, not a claim.
5. **Tag families** (existing `Tag`, re-affirmed): catalyst/sector/theme tags stay
   NEUTRAL-CHROME words. Evidence grades and tiers keep their tokened colors. NOTHING new
   is colored (E6). The one richness change: tags gain consistent mono-2xs uppercase
   treatment everywhere (today a few surfaces hand-roll label styles — sweep them into `Tag`).
   *Guard:* existing amber/danger consumer rules; the 8.5 dictionary.
6. **Hairline hierarchy** (existing, extended): inside cards, `--color-hairline` rules
   between logical zones; between cards, space only. The richness is CONSISTENCY — the sweep
   normalizes ad-hoc `border-b` usages onto the token. *Guard:* grep for raw border-color
   utilities on module internals (advisory list in the evidence file, normalized where found).
7. **The provenance reveal** (existing signature, extended to new surfaces): every NEW
   masthead (story sections, ticker sections) wires the same hover/tap provenance chain.
   Carries: the app's thesis. *Guard:* new-surface skill checklist already demands it; the
   PD5/PD6 exit re-runs the skill's checklist per touched surface.
8. **Numeric texture** (existing law, enforced wider): every numeral everywhere is mono
   (`--font-mono`) — the sweep catches strays (drift rule 12 covers `.toFixed`; this pass
   eyeballs rendered font per room via the styleguide's specimen row).

**Explicitly rejected treatments (so nobody re-litigates):** icon decoration (functional
icons only — §3.7 stands); colored catalyst/sector chips (E6); bold-in-prose (no loaded
weight; synthesis banned); animated attention of any kind (P2/P6); drop caps (a broadsheet
affectation the mechanical voice contradicts); score-like "heat" tints on movers (P6's
anti-gamification — magnitude already speaks through the figures themselves).

### 8.3 Where the system lands (PD5: Desk + News; PD6: the rest)

- **Desk:** movers rows adopt TickerChip + KeyFigure on verified catalyst numbers; brief
  prose adopts Term (≤2/¶) + KeyFigure; module internals normalized to hairline tokens;
  breadth strip unchanged (it is already exactly its information). The masthead does NOT
  gain accent (new-surface skill: mastheads stay muted mono — the "alive" comes from content
  treatments, not chrome).
- **News:** feed cards adopt TickerChip (symbol+move chips exist — they become THE chip),
  KeyFigure in headlines (merge), byline anchor (Part 9.4); story page adopts the full kit.
- **PD6 rooms:** scans (preset criteria get Term; symbols get TickerChip), paper (figures
  audit — mono/typography only; NO new emphasis near money inputs beyond what exists),
  track-record (hit/miss equal-weight re-verified after chip normalization), ticker page
  (lands with Part 10's rebuild — PD6 touches only what PD8 will not), Academy (serif
  kickers/prose already rich; PD6 adds Term backlinks in lesson prose where the manifest
  names a glossary entry — reading-room restraint otherwise), settings/login (login gets
  the brand lockup in PD2; PD6 verifies type rhythm only).
- **Styleguide:** a "voice & emphasis" section renders the whole kit with its rules inline
  (the permanent spec the eyeball pass reads against).

### 8.4 What must never appear (the negative checklist, run at PD5 and PD6 exits)

No motion on any data at rest · no new hue meanings (walk every colored element against the
8.5 dictionary) · no bold inside Newsreader prose · no icon-as-decoration · no color-only
signal anywhere (P7) · no emphasis on an unverified number (E5) · no underline that is not a
doorway · masthead chrome stays muted · amber/danger consumer lists unchanged (or amended
with an argued entry + rule update in the same commit).

### 8.5 The color dictionary (one table, in the styleguide, forever)

PD5 writes the complete "what color means here" table into the styleguide page (computed
from the same tokens the app reads, listed beside live swatches): direction pair · tier
family · grade family · alert (its consumers enumerated) · danger (its one consumer) ·
accent (interactivity) · band (uncertainty fills) · Academy category bars (decorative-only,
labeled as such). The 3.10 eyeball pass gains one line: "every colored element on this
surface appears in the dictionary."

### 8.6 Tests & gate (PD5, PD6)

Unit: TickerChip/Term/KeyFigure contracts (budgets, typed ids, rel/label rules) · Tag sweep
compiles. Drift: TickerChip single-door rule; the E2/E5 rules landed. E2e: glossary popover
opens from a Term on the brief (phone + desktop); ticker navigation from a TickerChip
preserves scroll on back (bfcache sanity ahead of Part 11). VRT: Desk + news re-baselined at
all viewports (the expected-diff list in the commit body is the phase's honesty); PD6
re-baselines each remaining room it touched. Eyeball: 8.1's table walked against fresh
screenshots, both themes; 8.4's negative list initialed in the evidence file
(`docs/pd-evidence/pd5-voice.md`, `pd6-rooms.md`).

---
## Part 9 — News depth (PD7 pipeline, PD8 surface)

*The commission's heart: "when I open a news detail, I want to read something substantive —
what happened, why it matters, what it could affect, and investor-relevant context and
guidance that a plain news article would NOT give me." The honest way to deliver that is the
one the pipeline already embodies: the LLM narrates only what the pipeline computed. So depth
arrives in two moves — first the pipeline computes MORE (a wider stats registry, per-cluster),
then the narrator is allowed to weave MORE (a structured insight, per section, through the
same deterministic gate). "Guided insight" means context and consequence; it never becomes a
call to act (E4).*

### 9.1 The reader's contract (what a story page answers)

1. **What happened** — the neutral factual summary (exists: extract).
2. **Why it matters** — the mechanism, one breath (exists: ≤160 chars, kept as the feed line).
3. **The context** — what kind of event this is and how this name/segment sits tonight:
   the NEW `context` section, narrated from computed stats only.
4. **Who is exposed** — the deterministic exposure list (exists: catalyst_link + sectors) plus
   the narrated `affected_note` (exists).
5. **What the record says** — where OUR ledger holds relevant evidence (a base-rate stat, an
   active/resolved signal on an affected name), it renders through `BaseRate`/the existing
   components; where it holds nothing, the section renders nothing (never a filler line).
6. **What is on the calendar** — the NEW `watch` section: dated, existing `calendar_event`
   rows for affected names/macro codes within the next 10 sessions. Facts with dates — never
   thresholds, never "levels to watch" (E4).
7. **The sources** — every corroborating article, publisher-named, externally linked (exists).
8. **The provenance** — models, verification counts, press time (exists; gains model_meta
   truth, 9.5).

### 9.2 The stats registry grows (deterministic, pipeline-side — the depth engine)

`briefing/stats.py`'s registry is the sole quotable vocabulary. PD7 adds, per affected
ticker (computed from the lake in job A's news stage, served-set agnostic — the pipeline
sees ALL bars):

| Stat id shape | Value | Computed from |
|---|---|---|
| `tkr:{sym}:move1d` / `rvol20` | (exists) | movers path |
| `tkr:{sym}:pos52w` | position in the 52-week range, as "X% of the way between the 52-week low L and high H" (three numbers, one id) | lake bars |
| `tkr:{sym}:move_atr` | tonight's move in units of the name's own ATR14 (exists inside rank.py — PROMOTED to a registry stat so prose may cite what ranking already computes) | rank inputs |
| `tkr:{sym}:streak` | consecutive up/down sessions through tonight | lake bars |
| `tkr:{sym}:from50d` | distance from the 50-day average, % | lake bars |
| `cls:{id}:corroboration` | outlet count (exists on the row; becomes citable) | cluster |
| `cls:{id}:history7d` | Nth cluster on this name in 7 sessions | news_cluster query |
| `cal:{sym}:next` | next calendar event (kind + date), if any | calendar_event |
| `sector:{key}:breadth1d` | advancers/decliners within the sector's scan universe tonight | lake bars + instrument sector |

Each lands with tolerances in the SAME verify tables the gate already reads (percent ±0.05pp
/ ±0.5% rel; counts and dates exact). TDD first: every stat gets a fixture-computed test
(known bars → known value), and one property test pins "no stat is emitted for a symbol the
lake lacks" (absence over invention — a registry stat that guesses is the gate's blind spot).
Where an input is unavailable on a given night, the stat is simply absent and the narrator
has less vocabulary — honest degradation, zero new failure modes.

### 9.3 The insight schema (Stage B grows sections, not license)

`ClusterNote` v2 (Appendix C carries the verbatim prompt + schema):

```
cluster_id
why_it_matters   string|null  ≤160   (unchanged — the feed line)
affected_note    string|null  ≤120   (unchanged)
context          string|null  ≤420   NEW — 2–3 mechanical sentences: what kind of event
                                     this is, scale vs the name's own volatility, where the
                                     name sits (52w position / streak / from50d), sector
                                     breadth tonight. Numbers ONLY from cited stat ids.
watch            list ≤2 of calendar refs  NEW — each a {cal_stat_id} the renderer resolves
                                     to "CPI print · Jul 15" style rows. The LLM PICKS which
                                     calendar facts are relevant; it cannot author one.
citations        [doc_or_stat_id]   (unchanged; now covers every section)
```

Rules added to the system prompt verbatim (E3/E4): every number appears verbatim in the
inputs and is cited · no advice verbs · no directional forecasts · frequency adverbs only in
sentences citing a stat · if the inputs give you nothing beyond the headline, return null —
an honest null beats padding. **Depth budget (0.2.3):** the top 8 clusters by significance
get the full v2 treatment; the rest keep v1 fields (why/affected only). One Sonnet call
still narrates the whole page (inputs grow by the new stats; output cap rises to fit 8×
context sections); if the response schema fails twice, all notes null — facts publish
without prose, the page never blocks.

**The gate extends, not relaxes:** `verify.py` checks `context` with the same tolerance
machinery (any flag → that cluster's context drops to null, counted); `watch` is
structurally verified (every ref must resolve to a real calendar row for an affected
symbol/macro code — a dangling ref drops the entry); the E4 lexicon check runs on all prose
sections. The verification JSON records per-section outcomes (`narrated / dropped / silent`
per field) so the story page can say WHY a section is absent — the reader-facing absence
line distinguishes "the gate held it" from "the narrator had nothing" (the N5 distinction,
per section).

### 9.4 Source links, one tap (feed + story)

- **Feed card:** the byline's outlet name becomes a real external anchor to
  `articles[0].url` (E8 contract: rel, target, ≥44px hit area, visually separated from the
  card's internal tap surface — the anchor sits in the card FOOTER row with its own padding
  box; the card's main surface remains one internal link to the story). The card gains
  nothing else — one door out, one door in.
- **Story page:** the sources list stands (already correct); the header's first-source
  shortcut is NOT added (two adjacent doors to the same URL is clutter — the sources block
  is three lines down). Attribution lines on images stand.
- Old clusters whose `articles` snapshot is empty (pre-N5 rows) keep the honest "sources not
  kept for this story" line — never a dead anchor.

### 9.5 `model_meta` for news + the cost instrument (closing the accounting gap)

`news_cluster` gains `modelMeta Json?` (Appendix B DDL): `{model_extract, model_synth,
extract_count, note_version, usage: {in_tokens, out_tokens} per stage}` written by the
narration stage from the API's own usage fields. The nightly log prints the night's news-LLM
token totals and dollar estimate (config carries the per-MTok prices as constants with a
provenance comment); PD7's gate records a REAL night's number in the evidence file against
0.2.3's estimate. The story page's provenance footer stops hardcoding "Claude Haiku" and
prints from model_meta (with the honest "no extract" fallback unchanged).

### 9.6 The story page v2 (PD8 — consumes everything above)

Anatomy, top to bottom (each block names its absence state; nothing renders a placeholder):

1. Return rail (standalone-PWA safe, exists).
2. Header: catalyst/sector/theme Tags · serif headline (KeyFigure treatment for verified
   numbers, exists) · press-time line.
3. **What happened** — extract summary (absence: the "no extract" line, exists).
4. **Why it matters** — the ≤160 line (absence: per-section honesty line from 9.3's verdict).
5. **Context tonight** — the v2 `context` prose, its numbers KeyFigure-set, its terms
   Term-linked (≤2); absence: nothing (silent) or the gate line (dropped) per verdict.
6. **Exposure** — the AffectedTable (exists) + `affected_note`; symbols are TickerChips.
7. **The record** — for each affected name with an ACTIVE signal or a base-rate stat behind
   its setup card: the existing `BaseRate` render inside a tinted panel, N-gated as always;
   plus resolved-signal counts where the ledger has them. Absent when the ledger is silent —
   this block is REUSE of the honesty components, zero new probability UI.
8. **On the calendar** — the `watch` rows as dated facts (`CPI print · Wed Jul 15 ·
   market-wide`), each linking to the calendar module's day anchor; absent when empty.
9. **Sources** — the corroborating list (exists, E8-audited).
10. Academy doorway (exists, manifest-gated) · provenance footer (9.5).

Blocks 5/7/8 are the "so what an article would not give you" — mechanism, our own ledger's
evidence, and the dated road ahead — each computed, gated, and absent-not-padded. The page
renders through the same `revalidate = 600` + `generateStaticParams(): []` contract (the
census's load-bearing note), revalidated by the same nightly call; **before any route work,
re-read `app/AGENTS.md`** (the tree runs a customized Next 16 — its docs live in
node_modules, and the plan binds Opus to read them rather than trust memory).

### 9.7 The feed card, finished

Byline anchor (9.4) · TickerChip adoption (8.2) · why-it-matters stays the single italic
line (the feed is a front page, not the story) · corroboration whisper stays. No card grows
taller than today by more than the anchor's footer row; the feed's bundle budget
(`/news` 195.1KB baseline, 200KB ceiling — the tightest in the app) is watched at the gate:
the kit components are shared chunks, and if the route crosses its baseline+10KB slack, the
overage is diagnosed (not waved through) before tagging.

### 9.8 Tests & gate (PD7, PD8)

PD7 (pipeline): 9.2's stat TDD list · schema v2 round-trip (`api_schema()` strips what the
API forbids; the response parses back) · gate extension tests (fabricated number in context
→ dropped+counted; dangling watch ref → entry dropped; uncited "usually" → dropped) · the
fixture night regenerated to include: one cluster with full v2 insight, one gate-dropped
context, one silent, one pre-N5-shaped row (regression) · model_meta written · cost printed.
PD8 (app): story page renders every block from the fixture night (unit: per-block absence
states; e2e: full anatomy on the seeded story) · feed byline anchors (E8 unit + touch-target
sweep) · VRT: story full-anatomy + gate-dropped variant, both themes, three viewports ·
`/news` + `/news/[cluster]` bundle budgets hold · axe pass on both routes.

---

## Part 10 — Ticker depth (PD7 data touches, PD8 surface)

*The route exists; the Range Ladder is already its hero. PD8 finishes the room with what the
schema ALREADY serves — no new providers, no invented fields. The census's inventory is the
menu; this part is the plating order.*

### 10.1 The page v2 (top to bottom)

1. **Header** (exists): symbol · name · last close StatFigure + 1D delta + as-of.
   Adds one identity line from `instrument`: `NYSE · Health care · Biotechnology` (fields
   that exist; each absent field simply omitted — no "N/A" chain). Market cap does NOT
   appear anywhere (the schema has no size data; the page does not fake it — logged as the
   known bound of "identity" until a provider phase ever adds it).
2. **52-week strip** (new, served symbols): low · current · high on a horizontal position
   bar (position-not-angle, P13; a record of history, not a claim — renders complete, marked
   `data-p2` because it carries price). Computed from `price_bar` (min/max close over the
   trailing 252 sessions, window printed: "52-week range · 252 sessions through {date}").
   Absent (with the existing outside-served-set line) for names without bars.
3. **Chart** (exists, unchanged) · **Range Ladder** (exists, unchanged, still the hero —
   nothing above it may exceed its visual weight; the 52w strip is deliberately one thin
   band).
4. **Tonight's mention** (new): if the symbol appears in tonight's movers or a news cluster:
   the mover's catalyst line and/or the cluster headline as a link (via catalyst_link —
   snapshot numbers, so the page and the feed can never disagree). Absent silently.
5. **The record here** (new): active signals on this name (fired, unresolved — patternKey,
   fired date, resolves-on) and the latest setup card if tonight has one, rendered with the
   EXISTING SetupCard/BaseRate components (N-gates and CI displays intact). Below, resolved
   history counts for this name (hits and misses, equal weight, insert-only truth). Absent
   when the ledger is silent.
6. **On the calendar** (new): `calendar_event` rows for this symbol in the next 30 days
   (earnings with bmo/amc timing, consensus/prior where present — fields exist). Absent
   silently.
7. **Paper position** (new): open `paper_trade` rows for the symbol (side, bucket, quantity,
   fill, unrealized vs last close via lib/format) + a line for realized history. This is
   user state, already app-owned; numbers via `format`, never toFixed (rule 12).
8. **Provenance footer** (exists pattern): bars through {date} · signals from the append-only
   ledger · as-ofs per block.

Blocks 4–7 are one Prisma round each (the census verified every field); the page loader
grows from two parallel queries to six — still one request, still ISR-cached 600s, still
revalidated nightly by the existing call. Non-served symbols render blocks 1, 4, 5, 6, 7
(identity, mentions, record, calendar, paper) and honestly omit price-derived blocks — the
page is WORTH OPENING for every symbol the app can name, which is the commission's bar.

### 10.2 The Rail stays a glance (logged non-change)

The Level-2 Rail keeps its no-fetch speed contract (open-in-a-frame, data already on the
page). Its one addition, free at its payload: the "Open full view →" label becomes
"Full view: {SYM} →" (clearer door). Deepening the rail into a mini-page would rebuild the
sheet (Part 11) badly; the ladder is glance → sheet/page. Logged in DECISIONS so nobody
"finishes" the rail later.

### 10.3 Tests & gate (PD8 ticker half)

Unit: 52w computation (fixture bars → known low/high/position; window label; absent-bars
absence) · loader assembles all blocks with each absent state exercised. E2e: seeded ticker
shows every block; non-served symbol shows the honest subset; TickerChip navigation from
movers lands here with scroll restored on back. VRT: ticker v2 at three viewports + phone,
both themes; the thin (non-served) variant once. Axe pass. Bundle: `/ticker/[symbol]`
(148.5KB baseline — the roomiest) holds under baseline+10KB.

---

## Part 11 — Sheets: the detail overlay (PD9)

*The commission: on mobile, a story or ticker opens over the app and dismisses back to
exactly where the reader was. Implementation is Next.js intercepting routes over the
existing overlay material — the canonical URL always in the bar (E9), the full page always
the deep-link truth, and P2's stillness rules honored to the letter (E7 / 0.2.7 / 0.2.8).*

### 11.1 Architecture

- The `(desk)` layout gains an `@modal` parallel slot (default: null). Two intercepting
  routes: `(.)news/[cluster]` and `(.)ticker/[symbol]` render `<DetailOverlay>` wrapping THE
  SAME server components the standalone pages render (one component tree, two presentations
  — E9's structural guarantee).
- In-app navigation from a list → overlay opens over the live room; the room stays mounted
  (scroll, filters, disclosure state all survive by never unmounting — restoration is free,
  not reconstructed). Hard load / refresh / shared link → the standalone page. Back button /
  Esc / scrim / ✕ / overscroll-past-top → `router.back()` → the room exactly as left.
- **Presentation:** `<md` a bottom sheet (92dvh, grabber, `--radius-card` top corners,
  `.surface-overlay` L4 recipe + scrim); `≥md` a centered overlay (max-w 720px, 85vh,
  same L4 material) — the house already speaks this material (0.2.7).
- Before building: re-read `app/AGENTS.md` + the local Next docs on parallel/intercepting
  routes in THIS Next version (the census's standing warning), and the new-surface skill
  (the overlay is a new surface; it runs the checklist).

### 11.2 Motion & dismissal (E7, exactly)

Entrance: 200ms opacity fade, `--ease-quiet`, no translate/scale anywhere above the content
(the sheet and scrim fade as one settled layer; reduced-motion ⇒ instant). Dismissal:
- overscroll-past-top: the sheet's scroll container, at scrollTop 0, pulling further engages
  the DISMISS affordance (scroll physics — the one lawful motion over P2 content); release
  past the threshold closes (an opacity-out), release before it settles back (the rubber
  band is the container's own overscroll, not a JS transform).
- scrim tap · Esc · the ✕ (≥44px, top-right, first focusable) · hardware/gesture back.
Focus: trapped inside (Radix Dialog under the hood — the house pattern); on close, focus
returns to the opening element (the TickerChip/card that launched it). Body scroll locked
while open; `inert` on the room behind.

### 11.3 State restoration (the acceptance tests ARE the spec)

E2e, phone project: scroll the feed to card N → open story → scroll INSIDE the sheet →
dismiss (each of the five ways, parameterized) → assert `window.scrollY` unchanged, active
filters unchanged, focus returned. Same for a ticker sheet from the movers list. Reload
while the sheet is open → standalone page renders, content-identical (E9's DOM-equivalence
assertion). VoiceOver (MANUAL, Part 13): the sheet announces as a dialog titled by the
story/symbol; the room behind is not readable while open.

### 11.4 Budgets & tests (PD9)

The `@modal` slot + overlay chrome add client JS to the `(desk)` shared chunk — budgeted:
`/news` and `/` must hold baseline+10KB; if the slot costs more, the overlay chrome
code-splits behind the first open (`next/dynamic`) and the gate proves the split.

> **[Amended 2026-07-13, GATE-EFFICIENCY-PLAN G4 — analysis §3.3. THE SENTENCE ABOVE POINTS AT THE
> WRONG CONSTRAINT, AND ON `/news` IT IS ARITHMETICALLY IMPOSSIBLE.]**
> `baseline+10KB` is **not** the binding constraint on `/news`. The binding constraint is the
> **200 KB hard ceiling** (`check-bundles.mjs:52`, `CEILING_KB`), which is explicitly **not
> re-baselinable** — the script's own words are "Ship less JavaScript." Do the sum: `/news` has a
> baseline of **195.1 KB**, so "baseline+10" is **205.1 KB — over the ceiling.** A PD9 that spends
> its full slack passes the slack check and **fails the build.** Real headroom on `/news` is
> **≈4.9 KB**, and PD5's shared kit (TickerChip / Term / KeyFigure) spends from the *same* pot,
> because these are shared-chunk bytes.
>
> **So the code-split is PRE-AUTHORIZED, not a fallback.** Assume from the start that the overlay
> chrome loads behind the first open (`next/dynamic`), and let the gate prove the split. Do not
> spend a phase discovering this at an exit — which is exactly what would have happened, at PD5 or
> PD9, and it is why this block is written now.
>
> **The ceiling does not move.** It is doing its stated job right now, and "raise the ceiling" is
> the one response that is off the table (analysis §6). Budgets that re-baseline under pressure are
> not budgets.

Unit:
overlay renders the same tree as the page (snapshot the section-order contract) · dismissal
handlers. E2e: 11.3's suite · jsdom P2-ancestor walk passes with the sheet mounted (E7's
guard, extended scan set). VRT: sheet open on phone (story + ticker), overlay open at
desktop, both themes — masked over the live figures the seed pins anyway.

> **[Pre-authorized 2026-07-13, GATE-EFFICIENCY-PLAN G4 — analysis §3.7 / R14. The sheet's
> transition is a SANCTIONED P2-WALK EXEMPTION, decided now so PD9 does not discover it at a
> gate.]** The sheet opens over rooms that contain probability and money figures, so a `[data-p2]`
> node will have an animating ancestor — and `app/components/p2-motion.test.tsx` walks up from
> every `[data-p2]` node and fails on exactly that. Today it exempts **one** class **by name**:
> `.route-fade`. The sheet joins it, **on identical terms and for the identical reason**:
> **opacity ONLY — no transform, no translation, no scale.** Every frame must show the figure
> complete and unmoving *relative to everything else on the page*. That is the whole content of
> P2: a probability may fade in with the page around it, but it may never itself move, resize, or
> ticker, because motion on a number is a claim about the number.
> - **A slide-up sheet is therefore NOT permitted** — `translateY` on an ancestor of a `[data-p2]`
>   node moves the figure, and no amount of "it's just the container" changes what the reader sees.
>   If PD9 wants the sheet to feel like it arrives, it arrives by opacity.
> - **The exemption is BY NAME, and the test is extended when PD9 builds it** — one named class
>   added to the allowlist in `p2-motion.test.tsx`, with the reason in the comment beside it, the
>   way the route fade is. **A blanket exemption, a wildcard, or a widened selector is a veto:** the
>   list is short and closed on purpose, and the moment it accepts a pattern instead of a name, the
>   guard has stopped being able to fail.

---
## Part 12 — Phases PD0–PD10 (playbooks + gates)

*Same contract as the R-, F-, and N-phases: TDD for logic, VRT for pixels, the standing gate
at every exit, tag `pd-N`, ONE PHASE PER SESSION (CLAUDE.md's standing rhythm — finish,
checkpoint, stop; the next session rolls on). Sequencing logic: the correctness bugs before
anything cosmetic (PD0/PD1 — a right paper before a pretty one); identity before the big VRT
re-baselines it would otherwise invalidate twice (PD2); geometry before voice (PD3/PD4 give
richness a stable stage); the voice system before the deep pages that speak it (PD5/PD6 →
PD8); pipeline depth before the surfaces that render it (PD7 → PD8); the overlay last of the
features (PD9 wraps the finished pages); hardening to close (PD10).*

**The standing gate (every phase, in order — the N-plan's gate plus this plan's additions).**
**[REWRITTEN 2026-07-13 by GATE-EFFICIENCY-PLAN G4 into the reformed order — see the amendment
note below. The old order tagged FIRST and let the tag run be the first real test; that is what
made 52% of tag runs fail. PD inherits the reformed exit from PD0.]**
```
1  npm run typecheck && npm run lint && npm test        # app unit — CI additionally runs the TZ matrix (PD0+)
2  uv run pytest                                        # pipeline
3  npm run build && npm run check:routes && npm run check:bundles && npm run check:fonts
4  npm run e2e:local                                    # local e2e (--ignore-snapshots; CI is the pixel oracle)
5  npm run check:drift                                  # incl. this plan's new rules as they land
5.5  npm run check:migrations                           # ONCE per phase, LOCAL — CI structurally cannot answer it
6  push to main → confirm the branch run green
7  REHEARSE: gh workflow run ci.yml -f job=e2e          # THE FULL BROWSER ORACLE, BEFORE THE TAG EXISTS
   — the same job the tag runs, on any ref, no tag involved. Sharded into 3 legs, ~8 min.
   IN PARALLEL (they overlap by design — push and rehearsal share a ref and must):
     wait for the Vercel deploy → npm run check:nav -- --report
     → npm run check:live                              # PD1 onward — production truth, not vibes
     → npm run check:lighthouse                        # budgets on / (and /news, /ticker/[symbol] from PD8)
8  Rehearsal RED on pixels? The run mints its own candidate baselines
   (vrt-baselines-candidate-<leg>). Download, OPEN EVERY IMAGE, commit only an explained diff.
   Read .claude/skills/vrt-update/SKILL.md first. An unexplained diff is a BUG, not a re-bake.
9  Rehearsal GREEN → git tag pd-N <THE REHEARSED SHA>  # BY SHA, never HEAD — main moves under you
   → push --tags → confirm the tag run green (same SHA, same suite: first-try green is the
   expectation, not the hope)
10 THE TAG STAYS PUT. Suspected flake → gh run rerun <id> --failed. NEVER a re-point.
   (But read the failure first: G2's "flake" was a real race that had failed its retry too.)
11 ONE docs commit, AFTER the tag: PROGRESS + DECISIONS/LESSONS/PATTERNS/QUESTIONS + the evidence
   file + NEXT-SESSION-PROMPT.md, together. It is FREE — paths-ignore means prose starts no CI run.
   No post-tag "CI confirmed green" commit: the tag run's green IS the record, cited by run-id.
12 Report to Bishan in plain English. STOP. (One phase per session.)
```
> **[Amendment note, 2026-07-13, G4 — what changed and why, so nobody "restores" the old order.]**
> The reform is step 7: **the oracle now runs BEFORE the tag.** It used to run only *after* — the
> tag push was the first time the browser suite had ever executed against the work — so every
> browser-layer defect was discovered after "done" was declared, in ~16-minute quanta, on a tag
> that had to be deleted and re-pushed per attempt. Measured across the previous build: **52% of
> tag runs failed**, and `nc-final` took **six** pushes of one tag. The rehearsal is *the same job*
> the tag runs, so a green rehearsal is not evidence *about* the tag run — it is the same evidence,
> collected earlier. Nothing was weakened to buy this: **every verification that existed still
> happens, on the exact tagged SHA.** Also new here: `check:fonts` and `check:migrations` were in
> CLAUDE.md's command list but in **no** standing gate (step 3 / 5.5); the gate-size line closes
> every evidence file; and the docs land in ONE commit after the tag.
>
> Every mechanism above is LIVE and PROVEN — see `docs/gate-evidence/g0`–`g4`. Read
> GATE-EFFICIENCY-PLAN.md Part 3 and CLAUDE.md's "The Endgame" block before your first exit.

**PD0's ci.yml wiring — VERIFY, DO NOT REDO.** [DONE 2026-07-13 by GATE-EFFICIENCY-PLAN G0 — `pd-*`
is already in `on.push.tags` AND in the e2e job's `if:`, and `pipeline/tests/test_ci_tag_families.py`
now FAILS THE BUILD if the two ever drift apart, so this can no longer be forgotten. Note the detail
the original sentence got wrong: there is exactly **ONE** tag-gated job (e2e, the browser oracle),
not two — `vrt-baselines` is gated on `workflow_dispatch`, never on a tag. An unwired tag pattern
makes every later gate claim ornamental — the F0 lesson — which is why it was pre-wired.]

### PD0 · Session truth — the dating contract [0.5–1 day]
FIRST: session ritual; confirm `nc-final` tagged + CI green (if not, finish the news plan
first — its contract, not this one). Amend `ci.yml`: add `pd-*` to the tag triggers AND both
tag-gated job `if:` conditions; add the TZ-matrix leg to the app job.
**[Amended 2026-07-13, GATE-EFFICIENCY-PLAN G0: the `pd-*` wiring is DONE — trigger and the e2e
job's `if:` both carry it, guarded by `pipeline/tests/test_ci_tag_families.py`. Verify it, do not
redo it. The TZ-matrix leg is still PD0's to build. Read GATE-EFFICIENCY-PLAN.md Part 3 before
this phase's exit: the gate ritual changed — you REHEARSE the browser oracle before tagging, the
tag stays put once green, and the intelligence files land as ONE commit after the tag.]** Re-audit the tree
against Part 1's claims (they were written against a moving target; N7's docs sync may have
moved details) — record deltas in `docs/pd-evidence/pd0-dates.md`. Then Part 3 in full:
run-date derivation (3.1, per-mode), the publish invariant (3.2 + its TDD list), the app-side
truth (3.3 — weekday door, TZ matrix, the E2 drift rule), the audit sweep re-run and recorded
(3.4), the seed validator. Build `check:live` (3.6) with its fixture tests now (it needs no
production run to be BUILT — PD1 wields it).
**Exit gate additions:** the `pd-0` tag actually triggers CI (proof of wiring); 3.2's suites
green; TZ matrix green both legs; the dates evidence file exists with the sweep table;
`check:live` passes its own fixture tests (healthy + poisoned-Saturday).

### PD1 · Production made current [0.5–1 day, calendar-gated by one nightly]
Part 4's playbook in order: migrations probe → tonight's run verified green (or diagnosed,
fixed, re-dispatched — this gate is about the LIVE state) → `check:live` against production →
screenshots both widths → Part 0.1 executed on its default (or the veto honored and logged)
→ `check:live` re-run → evidence file `pd1-production.md` with before/after. Wire `check:live`
into the standing gate text (step 6.5) and into the post-publish path (job B's revalidate
caller already proves the deploy is reachable; the smoke runs from the gate, not the
pipeline — the pipeline must never depend on the app). If the phase starts mid-market-day:
dispatch `macro`/`news`/`compute` immediately for partial verification, and complete the
`full`-dependent assertions after the close (the autonomy contract's time-gated-item rule).
**Exit gate additions:** every 3.6 assertion green against production on real Monday-or-later
data; 0.1 resolved; the evidence file's before/after pair.

### PD2 · Brand — the identity kit [1–1.5 days]
Part 5 in full: PP-1 checked (fallback copy from Desktop if needed), `brand-assets.mjs` +
`png-to-ico` devDep, the 5.2 artifact table emitted within budgets, metadata/manifest wiring,
`BrandMark` + rule-20 second door (logged), Wordmark/login/settings lockups, Serwist precache
entry, the OG card, the unauthenticated-200 e2e, styleguide identity section.
**Exit gate additions:** 5.7's suites; every 5.2 row present with printed byte sizes; VRT
re-baselines named in the commit body; the MANUAL device checklist photographed into
`pd2-brand.md` (add-to-home-screen, tab icon, OG unfurl).

### PD3 · The desktop grid contract v2 [1–1.5 days]
Part 6 in full: Law 1 on the Desk (wrapper composition + per-viewport visual-order e2e),
Law 2 (EmptyModule extraction, the min-h grep rule), PageContainer extraction, the per-room
verification pass recorded, the `mbp16` VRT project + thin-night seed variant, the
no-dead-gap e2e.
**Exit gate additions:** 6.5's suites; `pd3-grid.md` with the room × width table and the
1512 before/after; zero horizontal scroll at 390/1512/1536; the thin-night shot baselined.

### PD4 · The phone composition [0.5–1 day]
Part 7 in full: StatFigure wrap contract, the two macro grids (+ copy-deck deletions), the
phone-wide overflow sweep (Pixel-7 + 360), alignment pass, phone VRT re-baselines.
**Exit gate additions:** 7.5's suites; `pd4-phone.md` with the healed-overflow frame; the
sweep proves it swept every room.

### PD5 · The voice — richness system + Desk + News [1–1.5 days]
Part 8: the kit (TickerChip, Term, KeyFigure, Tag sweep), the color dictionary in the
styleguide, the new drift rules, application to Desk + News feed, the 8.4 negative checklist
run.
**Exit gate additions:** 8.6's suites; `pd5-voice.md` (eyeball table + negative checklist,
initialed with screenshots); VRT re-baselines named.

### PD6 · The voice — remaining rooms [1 day]
Part 8.3's second half: scans, paper, track-record, Academy, settings; the 3.10 v2 checklist
run on EVERY room (both themes); excludes the story/ticker pages (PD8 rebuilds them).
**Exit gate additions:** `pd6-rooms.md`; VRT re-baselines named; 8.4 re-initialed.

### PD7 · News & ticker depth — the pipeline [1.5–2 days]
Part 9.2 (the registry growth, TDD-first), 9.3 (schema v2 + prompt + gate extensions + the
E4 lexicon), 9.5 (model_meta + the cost print), the fixture night regenerated (four pinned
shapes), Appendix B's migration. One real `news`-mode dispatch after landing; the night's
measured cost recorded against 0.2.3's estimate.
**Exit gate additions:** 9.8's pipeline suites; the real-dispatch evidence (clusters carry
v2 fields in production, or the honest skip is logged with stage status); `pd7-insight.md`
with the measured token/cost table.

### PD8 · News & ticker depth — the surfaces [1.5–2 days]
Part 9.6/9.7 (story page v2, feed byline anchors) + Part 10 (ticker page v2, the Rail
non-change logged). Both pages run the new-surface skill checklist; both re-read
`app/AGENTS.md` before route work.
**Exit gate additions:** 9.8's app suites + 10.3's; VRT story/ticker sets (three viewports,
both themes, absence variants); bundle budgets hold on /news, /news/[cluster],
/ticker/[symbol]; axe both routes; `pd8-depth.md` with before/after of the exact "single
line" complaint (the old rail line beside the new page).

### PD9 · Sheets — the detail overlay [1–1.5 days]
Part 11 in full: @modal slot, two intercepting routes, DetailOverlay (new-surface checklist),
E7 motion contract, the 11.3 restoration suite, budgets/code-split proof, VRT sheet shots.
**Exit gate additions:** 11.4's suites; the P2 ancestor walk green with the sheet mounted;
`pd9-sheets.md` incl. the five-dismissals e2e matrix output.

### PD10 · Hardening, evidence, docs [1 day]
Touch-target sweep re-run WITH the new anchors/overlays in its route list; axe full pass;
full VRT table green; the iOS MANUAL checklist (Part 13) on the real device, photographed;
drift rules landed and numbered against the tree; `check:live` in the gate text confirmed;
docs sync — CLAUDE.md Commands block gains `check:live` + `brand` (the ONE shared-file edit
this plan makes, at the end, after the parallel-build risk is gone), DEVELOPMENT-PLAN route
map notes the overlay presentations, the new-surface skill gains the overlay row, QUESTIONS
closeout (every [VETO?] carries its assumption marker), PROGRESS closing entry.
**Gate:** the full standing gate + every evidence file present + `pd-final` tagged green.

**Sequencing rules:** PD0 blocks all (the tag wiring and the truth). PD1 needs a market
night after PD0 (calendar-gated; PD2 may start the same session's remainder if PD1 is
waiting on the close — the one sanctioned overlap, because PD2 touches no dated surface).
PD3 blocks PD5 (stable geometry before voice). PD4 blocks nothing after it. PD7 blocks PD8;
PD8 blocks PD9. A veto of 0.1 changes only PD1's step 3. A veto of any 0.2 row changes only
its named sections.

**Estimated total: 10–13 days at N-phase pace, one phase per session.**

---

## Part 13 — Mobile & iOS specifics (cross-cutting)

*The redesign Part 7, feel-plan Part 7, and news-plan Part 10 contracts all stand (safe
areas, 44px targets, 16px inputs, keyboard tab-bar behavior, no page horizontal scroll,
shelf physics where shelves remain). This part adds only what the NEW work needs. Items
marked MANUAL run at PD10 on the real device, twice: mobile Safari and the installed
standalone app, photographed into `docs/pd-evidence/`.*

1. **The sheet on iOS.** 92dvh (not vh — the URL bar), `env(safe-area-inset-bottom)` padding
   on the sheet's footer zone, the grabber ≥44px hit target, overscroll dismissal must not
   fight Safari's own edge-swipe-back (the sheet's scroll container sets
   `overscroll-behavior-y: contain`; the LEFT edge stays Safari's). MANUAL: open story sheet
   → scroll → overscroll-dismiss → land exactly where you left; repeat installed-standalone
   (no browser chrome, gesture back must also dismiss).
2. **Keyboard never meets a sheet** (read-only content today) — asserted, so a future form
   inside a sheet knows it owes the keyboard contract.
3. **The macro grids at 360px.** MANUAL: the smallest-width check — no wrap-induced
   misalignment reads as breakage; chips wrap BELOW values cleanly (7.2).
4. **Brand on device.** MANUAL (PD2, re-verified PD10): add-to-home-screen icon is the mark
   on its field (not a letterboxed transparency); the splash label reads "Desk"; the tab
   icon renders in Safari.
5. **External links from a sheet** open in the in-app Safari view controller and return
   without losing the sheet's underlying room state. MANUAL: round-trip from a story sheet's
   source link.
6. **Performance texture:** no new `backdrop-blur` consumers (the sheet reuses L4's existing
   budget slot — the overlay is one of the five, already sanctioned); the fling test on the
   richened feed (KeyFigure/TickerChip are static text — zero animation frames expected;
   Safari's compositor stays idle).

---

## Part 14 — The adversarial pass (attacks run, fixes landed)

*Seven lenses, per the commission. Each attack stated the way a hostile reviewer would state
it, with where the plan now answers it. Attacks that found real holes changed the text above
before delivery; this part is the record.*

### 14.1 "Your 'richness' will break the honesty rules somewhere subtle."
- **Attack: emphasis becomes advice — a bolded figure reads as 'act on this'.** Answer:
  emphasis is EARNED BY VERIFICATION only (E5's typed ids); no emphasis exists near money
  inputs on /paper beyond today's; the negative checklist (8.4) is a per-phase exit item,
  not a hope. And there is no bold in prose at all — the loaded weights make it structurally
  impossible (Part 8's preamble).
- **Attack: TickerChips with hover color are urgency theater.** Answer: the hover is the
  accent's ONE existing meaning (interactivity), identical to every link in the app; chips
  never pulse, never animate, never sort by heat (P6 untouched; M-rulings untouched).
- **Attack: the color dictionary will drift the day someone ships a "just this once" hue.**
  Answer: the dictionary lives IN the styleguide beside live tokens; the amber/danger
  consumer rules are mechanical; the 3.10 eyeball line ("nothing colored without a
  dictionary entry") runs at every later phase exit because it joins the checklist itself.

### 14.2 "The insight sections are an opinion column wearing a lab coat."
- **Attack: 'context' will editorialize direction the moment the prompt drifts.** Answer:
  the banned-verb + no-forecast contract is IN the system prompt verbatim AND in the gate
  (drop, count, record per section); the E4 lexicon makes uncited frequency words a
  mechanical drop; adversarial fixtures pin one of each violation and the tests assert the
  drop — the prompt can drift and the gate still holds the line.
- **Attack: 'watch' becomes trading levels.** Answer: watch entries are structurally
  calendar-row REFERENCES — the renderer cannot print a threshold because the schema cannot
  carry one; a dangling or invented ref drops at verification.
- **Attack: depth = more tokens = the cost quietly triples.** Answer: 0.2.3's cap (top-8),
  ONE synthesis call still, measured usage printed at the gate and recorded in evidence
  against the estimate; the per-MTok constants carry provenance comments.
- **Attack: the ledger sections will tempt fabricated base rates where the ledger is thin.**
  Answer: block 7/5 render EXISTING BaseRate/SetupCard components from EXISTING rows only;
  absence renders nothing; no new probability UI exists anywhere in this plan.

### 14.3 "The desktop fix is a stretch job, not a design."
- **Attack: you'll widen cards and call it composed.** Answer: the fix is a LAW (independent
  column flow) plus the empty/short rules plus a 1512 pixel lock ON A THIN NIGHT — the
  degenerate case is the baseline, so "composed when full, broken when sparse" can never
  pass again.
- **Attack: the reading-order amendment guts the ritual.** Answer: the phone ritual — the
  actual nightly read — is byte-identical; desktop reading order main-then-rail is how a
  broadsheet is read; the e2e asserts VISUAL order per viewport, which is stricter than the
  old DOM assertion, not looser. Veto hook stands (0.2.2).
- **Attack: you fixed the Desk and left the other rooms to rot.** Answer: PD3's per-room
  pass writes a verdict TABLE for every room at three widths into evidence; the container
  extraction makes the next wide-work a one-file change.

### 14.4 "Mobile will regress somewhere you didn't look."
- **Attack: killing the shelves breaks the M8 count-line contract somewhere else.** Answer:
  the Shelf and its contract survive for every other consumer; only the two macro shelves
  retire, their count lines with them (all figures visible = the count line's job done);
  the copy deck's type system makes an orphaned key a build error.
- **Attack: the wrap contract will look ragged on some width you didn't test.** Answer: the
  sweep runs at Pixel-7 AND 360; VRT pins 390; the wrap is deterministic typography, not
  media-query luck — and clipping/truncation is banned outright, so the failure mode is
  "wraps early," never "lies."
- **Attack: the sheet will fight iOS gestures.** Answer: Part 13.1's containment rules +
  MANUAL device items photographed; dismissal has FIVE redundant paths, so a broken gesture
  never strands the reader.

### 14.5 "Brand assets will ship half-done."
- **Attack: you'll drop one PNG in and hope.** Answer: 5.2 is a per-file manifest with
  geometry and byte budgets, emitted by a deterministic committed generator whose output is
  gate-listed; the maskable safe-zone math is in the table; the 16px legibility check has a
  sanctioned fallback path.
- **Attack: the OG card 404s behind the login wall.** Answer: it lives under the
  already-public `/icons/` prefix; the unauthenticated-200 e2e covers every brand path
  FOREVER; `metadataBase` makes the URL absolute.
- **Attack: iOS shows a black-squared transparency.** Answer: apple-touch is opaque by spec
  in 5.2; the MANUAL add-to-home-screen photo is a gate item.

### 14.6 "Opus will stall somewhere you didn't look."
- **Attack: the logo file won't be there.** Answer: PP-1's fallback copy command; if both
  paths are absent, PD2 alone parks and PD3 proceeds (phases decoupled by design).
- **Attack: PD1 needs a market night that might be days away or red.** Answer: the phase is
  explicitly calendar-gated with a decision tree for red runs; the PD2-overlap rule spends
  the wait productively; nothing downstream reads PD1's evidence.
- **Attack: the customized Next will surprise the intercepting routes.** Answer: the plan
  BINDS the executor to `app/AGENTS.md` + the vendored docs before route work (twice: 9.6,
  11.1); the overlay reuses the standalone pages' components, so the risky surface is the
  slot wiring alone, and E9's equivalence e2e catches divergence.
- **Attack: a veto arrives mid-build.** Answer: every 0.2 row names its blast-radius
  sections; the sequencing rules map veto → affected phase; the DECISIONS diff is step one
  of every session ritual.
- **Attack: two sessions will trample the tree again.** Answer: this plan STARTS only after
  `nc-final`; the one shared-file edit (CLAUDE.md) happens in PD10, last, per the N7
  precedent.

### 14.7 "Claims without measurement."
- **Attack: 'production is fixed' will be a vibe again by August.** Answer: `check:live` in
  the standing gate is the structural answer — the claim becomes a command with fixtures
  proving it can fail.
- **Attack: 'the cost is small' / 'the page got shorter' / 'the bundle held'.** Answer:
  each is a printed number in an evidence file at its phase's gate (9.5's cost table, PD4's
  screenshots, the bundle tables); the plan's own estimates are labeled estimates and the
  gates record the measurements beside them.

---
## Appendix A — `copy.ts` additions & retirements (mechanical voice; exact strings)

*Every string below lands in `lib/copy.ts` (the single door). Retirements are deletions —
the deck's type makes any orphaned consumer a build error, which is the test.*

```ts
// —— retired with the macro shelves (PD4) ——
// pulse.marketsShelf   ("Markets — {n} figures, swipe")   DELETE
// pulse.moneyShelf     ("Money & mood — {n} figures, swipe")   DELETE

// —— brand (PD2) ——
brand: {
  alt: "myStockMarket",
  ogTagline: "US equities, after the close.",
},

// —— story page v2 (PD8) ——
story: {
  contextHead: "Context tonight",
  contextHeld: "Context was written but did not pass verification — held, not shown.",
  recordHead: "What our record says",
  watchHead: "On the calendar",
  sourcesNone: "Sources were not kept for this story.",   // exists — re-affirmed
},

// —— ticker page v2 (PD8) ——
ticker: {
  rangeHead: "52-week range",
  rangeWindow: "252 sessions through {date}",
  mentionHead: "In tonight's edition",
  recordHead: "The record here",
  recordNone: "No signals on the ledger for this name.",
  calendarHead: "Scheduled",
  paperHead: "Paper position",
  railOpen: "Full view: {sym} →",
  // outsideServed: the tree's existing string stands verbatim — listed here only so this
  // appendix is the complete inventory; do not restate it, two spellings drift.
},

// —— overlay (PD9) ——
sheet: {
  close: "Close",
  dismissHint: "Pull down to close",   // rendered as the grabber's aria-label, not visible text
},

// —— live check (PD0/PD1; server-side script copy, kept here for the one-voice rule ——
live: {
  ok: "production agrees with the calendar",
  fail: "production disagrees: {surface} expected {expected}, found {found}",
},
```

Notes: the ticker block reuses the existing outside-served-set line verbatim (the appendix
marks it rather than restating it, so two spellings can never drift apart). No string above
apologizes, urges, or promises — absence lines state what is and why.

## Appendix B — Schema DDL (Prisma, verbatim additions; migration `pd_news_depth`)

```prisma
// news_cluster — PD7 (Part 9.3, 9.5)
model NewsCluster {
  // …existing fields unchanged…
  context     String?   // v2 insight prose, ≤420 chars, gate-verified or null
  watch       Json      @default("[]") // list of {calStatId} calendar refs, structurally verified
  modelMeta   Json?     // {model_extract, model_synth, extract_count, note_version, usage:{…}}
}
```

One ALTER, three columns, all nullable/defaulted — no backfill (old rows render their
absence states, which PD8's fixtures pin). `signal_log`/`signal_resolution` untouched (the
plan adds NO new writer to either — Part 10 only reads). No other schema change exists in
this plan; if PD7 discovers it needs one more column, it lands with its own migration and a
DECISIONS line, never by widening this one silently.

## Appendix C — LLM prompt & schema v2 (newsdesk Stage B; extends the N-plan's Appendix D)

```
# Stage B v2 — the front-page narrator (one sync call, MODEL_SYNTH, structured output)
system: You write context notes for a beginner's market front page, in mechanical third
  person. Inputs: per-catalyst structured extracts (with doc_ids), a computed-stats table
  (with stat_ids), and for the TOP clusters a wider per-ticker stat set (52-week position,
  ATR-relative move, streak, distance from the 50-day average, sector breadth, cluster
  recurrence) plus dated calendar rows (cal_ids). Per cluster return:
  - why_it_matters (≤160): the MECHANISM this kind of event moves — never a restatement,
    never a prediction, never advice.
  - affected_note (≤120): sector-wide spillover, mechanically, when the inputs support it.
  - context (≤420, TOP clusters only): 2–3 sentences placing tonight's move — scale versus
    the name's own volatility, where the name sits in its range, what the sector did, how
    often this story has recurred this week. EVERY number appears VERBATIM in the inputs
    and is cited by id.
  - watch (≤2, TOP clusters only): the cal_ids of already-scheduled events a reader should
    know are dated — you may only SELECT ids from the provided calendar rows; you cannot
    write one.
  RULES: no advice verbs (buy, sell, should, add, trim, take profits); no directional
  forecasts; frequency words (usually, often, rarely, typically, tends) ONLY in a sentence
  that cites a stat id; if you cannot add context beyond the headline, return null — an
  honest null beats padding.
schema: { notes: [ { cluster_id, why_it_matters: string|null, affected_note: string|null,
  context: string|null, watch: [cal_stat_id] (≤2), citations: [doc_or_stat_id] } ] }
failure: schema violation ⇒ one retry with the error appended; second failure ⇒ all notes
  null (facts publish without prose). The deterministic gate then verifies EVERY section
  independently (tolerances verbatim from DEVELOPMENT-PLAN Appendix E; the E4 lexicon check;
  structural resolution of every watch ref); a flagged section drops to null/empty, the
  sibling sections stand, and the per-section verdict is recorded in
  news_cluster.verification.
```

## Appendix D — VRT delta table (added or re-shot; both themes unless noted)

| Shot | Viewports | Phase |
|---|---|---|
| every existing page shot (top bar mark) — expected-diff re-baseline | all current | PD2 |
| login (brand lockup) + styleguide identity section | 1366 · 390 | PD2 |
| Desk `mbp16` (seeded full night) + Desk `mbp16` THIN night | 1512×982, light | PD3 |
| news / scans / paper / track-record / ticker at `mbp16` | 1512×982, light | PD3 |
| Desk phone (markets grid + money grid, chips wrapped) | 390 | PD4 |
| Desk + news feed (voice kit: TickerChip, KeyFigure, byline anchor) | 1366 · 390 · 1512 | PD5 |
| each remaining room after its voice pass | 1366 · 390 | PD6 |
| story page v2: full anatomy · gate-dropped-context · pre-N5 sparse row | 1366 · 390 | PD8 |
| ticker page v2: served full · non-served honest subset | 1366 · 390 | PD8 |
| story sheet open (phone) · ticker sheet open (phone) · overlay open (desktop) | 390 · 1366 | PD9 |
| styleguide voice & color-dictionary sections | 1366, light | PD5 |

Baselines are BORN IN CI (`gh workflow run ci.yml -f job=vrt-baselines`, the vrt-update
skill flow), downloaded and committed with the reason in the commit body — never shot on
macOS. Every re-baseline names its expected diffs; an unexplained diff is a build failure.

## Appendix E — Logged decisions this plan seeds into DECISIONS.md

Each lands as a `[claude]`-marked line when its phase executes (0.1's answer lands
user-authored if given): 0.1's outcome · 0.2.1–0.2.10 verbatim · the ritual-order
≥lg amendment (structural) · drift-rule additions with their final numbers (weekday door ·
ticker-chip door · min-h ban · brand-mark second door for rule 20) · `check:live` joins the
standing gate (structural: gate contract) · the TZ matrix (structural: CI contract) · the
stats-registry growth list (structural: narrator vocabulary) · the insight cap constant ·
model_meta + cost print · `png-to-ico` devDep · PageContainer/EmptyModule extractions
(local) · the Rail non-change (local, deliberate) · Shelf's surviving consumers (local).

## Appendix F — The kickoff prompt (paste-ready, for the first PD session)

```
You are Claude Opus 4.8, sole builder of myStockMarket. Execute POLISH-AND-DEPTH-PLAN.md
(phases PD0–PD10) under its Autonomy Contract and CLAUDE.md's session rhythm: ONE PHASE PER
SESSION — work the next undone phase, finish it properly (tests green, standing gate passed,
tagged, pushed), bring every intelligence file current, rewrite NEXT-SESSION-PROMPT.md, report
in plain English, and STOP.

START, IN THIS ORDER:
1. The CLAUDE.md session ritual: git pull → CLAUDE.md + PROGRESS.md + LESSONS.md → diff
   DECISIONS.md for any non-[claude] line (a user veto outranks this plan — honor it FIRST)
   → run both test suites → announce your checkpoint.
2. Confirm `nc-final` is tagged with green CI. If the news plan is unfinished, finish it
   under ITS plan first — the two are sequential, never interleaved.
3. Read POLISH-AND-DEPTH-PLAN.md Part 0 (one decision, its default, the decided table) and
   Part 1 (the diagnosis — the evidence your phase builds on). Check QUESTIONS-FOR-BISHANT.md
   Q-N6-1 for the user's answer to Part 0.1; the stated default governs if silent.
4. Execute the next PD phase per Part 12's playbook. PD0 wires the pd-* tags into ci.yml
   FIRST — an unwired tag makes every later gate ornamental.
5. Checkpoint per the rhythm, and stop.

Two standing hazards, inherited and still true: OPEN THE PNG AND LOOK AT IT (eight real bugs
were found only that way); and CI's database can tell you nothing about production's —
npm run check:migrations and (from PD1) npm run check:live are the instruments that can.
```

---

*End of plan. The commission's closing instruction was zero decisions left mid-build: Part 0
holds the one that is yours — it deletes production rows, and deleting history is a hand
only you should wave — with a default so nothing stalls. Everything else is decided, logged,
guarded, and phased. Right first, then rich: the paper corrects its record, prints its name
on the masthead, sets its columns straight, finds its voice, and finally gives every story
and every ticker a page worth opening.*
