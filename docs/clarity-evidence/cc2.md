# CC2 — Time, told properly (evidence)

**Phase:** CC2 of CLARITY-AND-CADENCE-PLAN.md (Plan A). Tag `cc-2`.
**Date:** 2026-07-15. Executor: Claude Opus 4.8.

## What CC2 did, in one paragraph

CC2 rewrote every reader-facing timestamp to ruling R1's shapes and nothing else — "the cleanest
possible diff list: every timestamp string." Clocks are now 12-hour with AM/PM ("7:36 PM"), never
24-hour; every date carries its weekday ("Tue, Jul 14"). lib/time.ts is the one door, and a new
check-drift rule (29) fails the build if any other app file constructs an Intl.DateTimeFormat. The
bare-date-vs-instant distinction (a bare date renders from UTC components, an instant in ET) is
load-bearing and untouched — only the shapes changed. 16 files (15 code + 65 re-shot VRT baselines).

## The formatter shapes — before → after (lib/time.ts, pinned by time.test.ts)

| formatter | before | after | consumer |
|---|---|---|---|
| `formatEtClock` | `16:05` | `4:05 PM` | as-of lines, status lines, news footers, strip |
| `formatEtClockPadded` | — (new) | `04:05 PM` | mono columns only (the control-room table) |
| `formatAsOf` | `as of 16:05 ET` | `as of 4:05 PM ET` | every SectionMasthead |
| `formatEtDate` | `Jul 9` | `Thu, Jul 9` | news card footers, run stamps |
| `formatUtcDate` | `Jul 15` | `Wed, Jul 15` | settings, strips, calendar rows |
| `formatUtcDateLong` | `Friday, July 10, 2026` | (unchanged) | the masthead |
| `formatEtStamp` | — (new) | `Thu, Jul 9 · 4:05 PM ET` | one-line provenance (footers, sheets) |

The weekday-only formatters (formatUtcWeekday "Fri", formatEtWeekday "Thu", formatWeekdayLong
"Friday") and etAbbreviation ("EDT"/"EST", internal) are unchanged; time.test.ts now pins all eleven.

## TDD

time.test.ts was rewritten to the new shapes FIRST and run RED (13 failed / 7 passed — the two new
formatters absent, the changed shapes mismatched). lib/time.ts was then implemented to green (20
passed). The suite grew 753 → 761 (the eight added formatter assertions).

## The four things beyond the formatters

1. **The double-weekday trap.** Four sites rendered `formatUtcWeekday(d) + " " + formatUtcDate(d)` =
   "Fri Jul 10". Once formatUtcDate carries the weekday, that becomes "Fri Fri, Jul 10". Each now calls
   formatUtcDate alone → "Fri, Jul 10": PipelineStrip's sessionLabel, StoryPageBody's watch rows,
   TickerBlocks and TickerPageBody's session labels. formatUtcWeekday survives where a possessive
   weekday-only word is wanted ("at Fri's close", the aging strip). Two of the four were caught by the
   PipelineStrip unit tests that pinned "Fri Jul 10"; a grep for the adjacency caught the other two.

2. **The ISO leak (4.1).** settings/page.tsx built `session: toTradingDate(run.runDate)` = "2026-07-14",
   which the control room rendered raw ("Data through 2026-07-14"). It now passes
   `formatUtcDate(run.runDate)` = "Tue, Jul 14"; the last-run finished stamp uses formatEtClockPadded.
   The VRT settings diff shows exactly that line changing — the fix rendered.

3. **formatEtStamp consumers.** The news card footer, the story sheet's article rows, and the story
   provenance footer each built `date · clock ET` by hand; all three now call formatEtStamp.

4. **The hardcoded reader-facing clocks.** R1 governs every clock the reader sees, not only the
   formatted ones. So the literals moved to the house shape too: glossary pre-market/after-hours
   ("9:30am ET"→"9:30 AM ET", "4:00pm ET"→"4:00 PM ET"), the control room's empty-state
   ("~6:37pm ET"→"~6:37 PM ET") and market-open/weekend copy ("4:00pm ET"→"4:00 PM ET"), and
   pipeline-control's `nightly:"6:37pm"`→"6:37 PM". "midnight ET" stays a word.

## The new drift rule (29) — the gate grows 28 → 29, booked

`E1 — one door for date/time rendering: only lib/time.ts constructs an Intl.DateTimeFormat.` The
sibling of rule 22 (which keeps weekday WORDS to one door), one step up: it keeps the whole formatter
to one. Two argued doors, like rule 22: lib/time.ts RENDERS; lib/market-hours.ts DECIDES (it reads the
ET date/minute via en-CA formatToParts to answer "is the market open?", a string no reader sees).
scripts/ is out of SEARCH_DIRS and the pipeline's Python is out of R1's scope. check:drift prints
`All 29 anti-drift rules pass.`

## The VRT re-shoot — 65 of 97 baselines, timestamps only

Timestamps rendered inside `<time>` or `[data-vrt="mask"]` are MASKED by the oracle (SectionMasthead
and ScorecardPM as-of stamps, the scans preset as-of) — those changed shape but the mask covers them;
they moved pixels only where the masked box WIDENED as the date gained its weekday. The unmasked
timestamps drove the re-shoot. Rehearsal #1 (on `1b0153d`) redded all four legs on pixels and minted
the candidate baselines. I opened the triptychs (`playwright-failures-<leg>`) and confirmed
timestamp-only on six diverse room types — desk, academy-glossary, styleguide, phone-desk, track-record,
settings — and quantified the rest with a pngjs counter (vrt-diff.mjs is broken; see below):

| room | what moved | ~px (desktop) |
|---|---|---|
| desk (all legs; phone RESIZED +83px) | strip, status line, session calendar dates, front-page card footers, masked as-of boxes | ~27k |
| news / news-story / -week / -filtered / -zero-state | card footers, press time, article stamps, provenance | ~6k |
| track-record | the fired/resolved date columns (weekday added; table rebalanced) | ~6.5k |
| academy-glossary | the pre-market and after-hours clock definitions ONLY | ~5k |
| styleguide | the time specimens (NewsCard footer shape) | ~3.5k |
| settings | the control-room "Data through …" (ISO leak fix) and "succeeded at …" lines | ~2.6k |
| ticker | the session dates | ~1.7k |
| sheet-overlay-desktop | the story sheet's stamps | ~1.2k |
| scans-preset (×4 variants) | the masked as-of `<time>` box widening (uniform) | 585 |

login moved 129px (AA jitter, no timestamp) and was NOT updated. 65 baselines copied (>200px or
resized), 32 left unchanged. Committed on `a9356a9` with the diff explained, then re-rehearsed green.
**97 VRT baselines total (65 updated, 0 added).**

## The gate at `cc-2`

- **App unit: 761 passed (was 753; +8). Pipeline: 579 passed, 35 skipped — unchanged (CC2 touches no
  pipeline code).** typecheck · lint · build · check:routes (B1 14/15 cached) · check:bundles (B4 worst
  /paper 198.3 KB < 200) · check:fonts (243 KB, 317 KB headroom) · check:drift (29/29, the new rule
  live) · check:migrations (no migration in CC2).
- **e2e:local (--ignore-snapshots, desktop):** 219 passed. One stale-shared-DB false red (the mbp16
  thin-night test's `scanResult.deleteMany` had left unusual-volume thinned from a prior run; the page
  rendered "First 3 of 3" correctly — a data-state artifact CLAUDE.md documents, confirmed green on a
  fresh re-seed). Every timestamp-bearing spec passed — no text assertion broke.

## CI

- **Branch CI (push, `1b0153d`): run 29438058728** — app + pipeline, green.
- **Rehearsal #1 (four-leg oracle, workflow_dispatch on `1b0153d`): run 29438058091** — RED on pixels
  (expected), minted the candidate baselines for all four legs.
- **Baselines pushed on `a9356a9`; branch CI run 29439502076 — app + pipeline, green.**
- **Re-rehearsal (four-leg oracle, `a9356a9`): run 29439520970 — GREEN, all four legs.** This is the
  same job the tag runs, collected on the exact SHA before the tag existed.
- **Tag run (`cc-2` on `a9356a9`): run 29440186576 — the four-leg oracle, green.**

## Post-deploy (production, PD1)

- **Vercel: `a9356a9` is the live Production deployment (deploy status success, created 18:11 UTC).**
- **check:live: all 7 assertions pass** against the deployed CC2 (masthead session · macro board ·
  index honesty · calendar hygiene · press-time · byline links · next-edition promise). live-truth.mjs
  needed no change: it matches the masthead's long date (formatUtcDateLong, unchanged) and finds
  calendar short dates via `[A-Z][a-z]{2} \d{1,2}`, which still extracts "Jul 14" from "Tue, Jul 14"
  (the weekday prefix carries a comma, so it never false-matches); it never asserts a clock shape.
- **check:nav (report mode): no regression** — warm medians 48–114ms across product routes; /settings
  461ms (the uncached writer room, documented since N7, matches lc-3's ~455–481ms).
- **check:lighthouse: advisory, NOT run** — no full Chrome in this environment (Playwright ships only
  chrome-headless-shell). CC2 is timestamps-only and carries NO perf/CLS/bundle surface — the CC1
  font-swap CLS concern does not apply, bundles are within slack, and the four-leg oracle (reduced-
  motion + VRT) is the authoritative visual proof. Proceeded per the Autonomy Contract (a manual gate
  the environment cannot run, with no CC2 surface it would measure).

## Carried-forward / open

- **Q-LC1-1 escalated with proof:** vrt-diff.mjs threw `ERR_MODULE_NOT_FOUND: pixelmatch` — the LC1
  transitive-resolution bet broke (only pngjs survived). Worked around with a pngjs-only counter; the
  triptychs are the real proof. NOT fixed in CC2 (a dep churn is out of a timestamps-only phase's
  scope; it is Bishan's Q-LC1-1 call). See QUESTIONS-FOR-BISHANT.md.
- One [FYI] added to QUESTIONS: the hardcoded-clock normalization (glossary/control-room copy).
- CLARITY Part 0 (P-1/P-2/dawn-cron/retention) defaults still stand; they land at CC5/CC7/CC8/CC10.

## Gate-size line

29 drift rules · 97 VRT baselines · 26 e2e specs · 761 unit tests · 16 bundle baselines · 14 manifest
rooms · tag run 7 m 37 s. (Drift rules 28 → 29: the Intl one-door rule, booked with its reason above.
Unit tests 753 → 761: the eight added formatter assertions. VRT: 65 of 97 re-shot, timestamps only.
All else unchanged from lc-3.)
