# CC4 — One hierarchy grammar (evidence)

**Phase:** CC4 of CLARITY-AND-CADENCE-PLAN.md (Plan A). Tag `cc-4` on `16422d0`.
**Date:** 2026-07-15. Executor: Claude Opus 4.8.

## What CC4 did, in one paragraph

CC4 is the widest visual phase: ONE header/meta grammar applied to every market room (D4), the
concrete dead-space fixes, and D10's phone paper-cuts. The grammar — serif room titles (Playfair 700,
Title case, display), mono-600-ink-2 section headers, Newsreader deks, the meta/as-of treatment —
went into the Desk, Paper, Track, Scans and Settings; the Academy keeps its own reading-room grammar
and took only the lesson-measure centering its entry names. The Sectors & Scans module (Desk 07)
became a real per-preset module, Paper's columns rebalanced (ledger main-left), Track's empty state
learned to teach with real numbers. D10's phone cuts unified the tape, said the movers noise line once
per card, kept the "This week" chip on one line, hid the filter-chip scroll track, and clamped the
watchlist reason with a `title`. 26 code files + 1 new test file, then 42 re-shot VRT baselines, then
a test-harness fix (a flaky settings e2e was poisoning the oracle — the CI section below). No
migration, no pipeline change.

## The grammar (a system, not a page patch — D4)

| Element | Face / case / size | Where it landed |
|---|---|---|
| Room title | Playfair 700, Title case, `text-display` | Paper ("Paper desk") + Settings ("Settings") join the serif rooms; they were all-caps sans / a mislabelled section |
| Section header | JetBrains Mono 600, UPPER, `text-xs`, `ink-2` (up from medium/muted) | Desk mastheads (keep `01 —`), Paper (New paper trade/Cost mirror/Ledger), Track (Your forecasts), Settings (Add a name/Theme/Watchlist), the control room (h2) |
| Room dek | Newsreader, sentence, `text-base`, `ink-2` | Settings normalized to the shape Scans/Track already carry |
| Meta / as-of | JetBrains Mono `text-2xs`; the as-of RECEDES (muted) when it matches the edition, COMES FORWARD (ink-2) when it differs | SectionMasthead + ScorecardPM; threaded via `editionAsOf` |

**The as-of treatment, and a plan/guard collision resolved on the guard's side.** 4.3 says the as-of
renders `text-faint` on a match. `text-faint` is a 2.2:1 grey that drift rule 18 AND the axe sweep both
forbid on a timestamp (the F7 lesson, 58 axe failures). So a MATCH recedes to `text-muted` and a
DIFFER comes forward to `ink-2` — the hierarchy the plan wants, kept; the a11y floor, kept. `editionAsOf`
(= the masthead's `updatedAt`) is threaded through every Desk module → SectionMasthead, which compares
the RENDERED minute (`formatEtClock`). Today every module matches the one run (muted); CC9's morning
edition refreshes some at dawn and THOSE differ (ink-2), with no further wiring. Absent baseline → muted
(the safe failure mode). **It is proven by the SectionMasthead unit test, not an e2e**: the VRT harness
masks every `time` element, so a screenshot cannot see the colour, and the single-edition seed cannot
produce a differing stamp — so the unit test (both renderings + never-faint) is the complete guard.

## The concrete room fixes

- **Sectors & Scans (Desk 07)** — was ~470px on one count; now one hairline row per preset (name
  Newsreader-italic, evidence grade Tag, tonight's count mono, the whole 44px row the door to that
  preset). Fixed SCAN_PRESETS order, NEVER by count (M1). RSI extreme reads "0 matches" (the seeded
  empty). A new pure `buildScanBreakdown` (unit-tested) feeds it off `loadScanCount`'s groupBy.
- **Paper's rebalance** — the ledger takes the main column (a list wants width), the ticket (~420px
  card, with its sizing helper) and cost mirror stack right. DOM order is ticket → mirror → ledger (the
  phone reading order), so the `lg` two-column map is done with explicit `col-start` placement, NOT
  `order` — no tab-vs-visual (WCAG 2.4.3) divergence.
- **Track's teaching empty state** — when nothing has resolved, "{N} signals logged · first resolutions
  due {date}" from real signal_log rows (`getPendingSignals`: `count()` + min `resolvesOn`). Production's
  early state; the seed has 3 resolutions, so the seed renders the table and the numbers are read-proven.
- **Academy lesson measure** — the reading column centers on wide screens (`mx-auto max-w-[72ch]`) — D4's
  right void. The Academy keeps its serif-kicker reading grammar; only the measure moved.

## D10's phone cuts

- **The tape reads as ONE grammar** — StatFigure's `row` layout no longer wraps the whole figure below
  the label on the widest echo (Nasdaq). The safety net moved into the value block (the chip wraps under
  the value if truly tight, consistent per row). A PD4 test assertion was updated to match.
- **The movers noise line is said ONCE per card** when nothing has a catalyst (`copy.mover.allNoise`);
  per-row lines return in the mixed case (unit-tested). On the seeded Desk, SMCI + GME carry catalysts,
  so the card correctly shows per-row lines.
- **"This week"** stays on one line (`whitespace-nowrap` in RangeControl).
- **The filter chip row** hides its scroll track (`no-scrollbar` — reclaims ~3px, the phone news resize)
  and fades its right edge below md (`.chip-scroll-frame` mask on a non-scrolling wrapper — the .shelf-frame
  lesson). Chrome, not the news card content (CC5 owns that).
- **The watchlist reason** clamps with the full text in `title` (Q-PD6-3, closed the way 4.3 chose).

## TDD

- `SectionMasthead.test.tsx` (NEW): the section-header grammar (600/ink-2) + the as-of match/differ
  treatment (muted/ink-2/never-faint) written RED (4 failed) → SectionMasthead implemented → GREEN (5).
- `morning.test.ts`: `buildScanBreakdown` (fixed order / zeros / metadata) — 3 cases.
- `DeskModules.test.tsx`: the movers all-noise (one card line, no per-row) vs mixed (per-row) — 2 cases.
- `StatFigure.test.tsx`: the row-layout assertion updated — the row no longer wraps; the value block is
  the safety net.
- Suite 768 → 778 (+5 masthead, +3 breakdown, +2 movers). Pipeline 579/35 unchanged (no pipeline code).

## The gate at `cc-4`

- **App unit 778 · Pipeline 579 passed / 35 skipped (unchanged).** typecheck · lint · build ·
  check:routes (B1 14/15 cached) · check:bundles (B4 worst 198.8 KB < 200, small grammar-driven growth
  within slack) · check:fonts (243 KB, 317 KB headroom) · check:drift (29/29, no new rule — the
  chip-scroll fade is a CSS class, not a guard) · check:migrations (no migration; the live DB matches).
- **e2e:local (--ignore-snapshots):** desktop 222 passed, phone 251 passed, mbp16 24 passed (grid +
  thin-night UNAFFECTED), wide 26 passed. The one red is the DOCUMENTED settings-watchlist ISR flake
  (reds under full-suite cache warming, green in isolation — verified on both desktop and phone).

## CI (three pushes, one tag; the code, the baselines, then a flake fix)

- **Branch CI (push, `bf0455b` = code): run 29450324191** — app + pipeline, green.
- **Rehearsal #1 (four-leg oracle, `bf0455b`): run 29450328160** — RED on pixels (the widest-phase
  budget expected it), minted candidates for all four legs.
- **Branch CI (push, `4449ced` = 42 re-shot baselines): run 29451623277** — app + pipeline, green.
- **Rehearsal #2 (four-leg oracle, `4449ced`): run 29451622940 — GREEN, all four legs.**
- **Tag run on `4449ced` (run 29452129715): FAILED, and its rerun FAILED — and it was NOT a product
  defect.** The settings-watchlist e2e adds a row and cleans up through a FLAKY UI remove; when it
  flaked, the row persisted in the leg's shared database, and the settings + desk VRT shots (both render
  the watchlist) photographed a fourth row → a resize red (1366×1693 → 1366×1762). The desktop/phone
  legs run settings.spec before vrt.spec against one DB (`workers:1`); wide/mbp16 were immune (their
  testMatch is vrt/hardening/grid only). Rehearsal #2 had passed only because that run did not flake.
- **Fix (push, `16422d0` = a guaranteed afterEach DB cleanup + a documented 20s reflection timeout):
  branch CI 29453659833 green; rehearsal 29453658993 — GREEN, all four legs.** The 42 baselines are
  byte-identical across `4449ced`→`16422d0` (the fix touched only settings.spec.ts), so the product the
  tag marks is unchanged; only the test harness got reliable.
- **cc-4 MOVED from `4449ced` to `16422d0`** — the tag never earned a green run (a confirmed recurring
  gate defect, not a transient a rerun clears), so it belongs on the fixed SHA (DECISIONS).
- **Tag run (`cc-4` on `16422d0`): run 29454167957 — four-leg oracle, green (8 m 14 s).**

## The VRT re-shoot — 42 baselines, every diff explained

Rehearsal #1 redded desk/paper/settings/track/news on the failed list. But per the PD2 law ("what moved
≠ what failed") every candidate was diffed against its committed twin (the pngjs counter — vrt-diff.mjs
still broken, Q-LC1-1) and every actual/diff opened. What moved:

| surface | what moved | note |
|---|---|---|
| desk (all legs) + desk-thin-night | module 07 → 5 preset rows (height EARNED); mastheads → 600/ink-2 | RESIZE +36px desktop / +238px phone |
| paper (all legs) | column rebalance + serif title + section grammar | RESIZE +366px — seed's short ledger; production fills the main column |
| track-record (all legs) | "Your forecasts" header + ~2px reflow of the text below it | no resize; the resolved table (a separate column) untouched |
| settings (all legs) | "Settings" serif title + WATCHLIST/THEME/PIPELINE/ADD A NAME sections | RESIZE |
| news + 4 news states (phone loud, desktop subtle) | D10 chip cut: hidden scroll track (−3px) + right fade | phone FAILED; desktop moved sub-tolerance |
| styleguide (desktop/phone) | the SectionMasthead + StatFigure specimens carry the grammar | ~5600px, UNDER the 600 tolerance — did NOT fail (the PD5 law) |
| sheet-story-phone | the changed /news filter chips show through the sheet's glass backdrop | ~500px, under tolerance; the sheet CONTENT is unchanged |

First-baseline eyes (the PD3 law) on the two NEW compositions — the Sectors & Scans rows and the Track
empty numbers (the latter renders only when nothing has resolved; the seed has resolutions, so the
populated table shows and the numbers are read-proven). **`login` left untouched** (129px AA jitter, not
a CC4 surface — re-baselining camera noise trades one unexplained picture for another). **42 re-shot,
0 added. 97 baselines total.**

## Post-deploy (production, PD1)

- **Vercel: `16422d0` live Production (CC4 UI).**
- **check:live: all 6 assertions pass** (1 pending a later phase, not a fail) — session calendar,
  press-time, byline links (20 outbound), next-edition promise (Wed). CC4 changes no copy check:live reads.
- **check:nav (report mode): no regression** — warm medians 44–95ms across product routes; /settings
  411ms (the uncached writer room, documented since N7 — 455ms/481ms in prior phases).
- **check:lighthouse: the gate metrics pass, the advisory ones are noise.** CLS 0.000 then 0.002 (no
  layout shift); first-load JS 152 KB ≤ 200 (the first sample's 183 KB was a noisy read — re-sample gave
  152, unchanged from cc-3); Accessibility 100. Performance 77/82 and LCP 4.4–4.7s are advisory
  synthetic-4G, RE-SAMPLED per the ±10 law — within cc-3's documented 77–86 range, variance not regression.

## Carried-forward / open

- Q-LC1-1 still open (vrt-diff.mjs broken; pngjs-only counter used again; triptychs + actuals are the proof).
- The as-of treatment: proven by unit test (VRT masks timestamps; the seed is single-edition) — an e2e
  belongs at CC9 when a real differing stamp first exists.
- Q-CC1-1: the Sectors & Scans module renders scan LABELS in production (a related surface), but the
  exact ticker-record leak is on active scan-fired signals the seed does not model — still unit-proven.
- Q-PD6-3 CLOSED at CC4 (clamp + `title`). CLARITY Part 0: P-1 is CC5's decision (default text-first);
  P-2/dawn-cron/retention land at CC7/CC8/CC10.

## Gate-size line

29 drift rules · 97 VRT baselines · 27 e2e specs · 778 unit tests · 16 bundle baselines · 14 manifest
rooms · tag run 8 m 14 s. (Unit tests 768 → 778: +5 masthead, +3 breakdown, +2 movers. Drift
unchanged at 29 — the chip-scroll fade is CSS, not a guard. VRT: 42 of 97 re-shot; 0 added. No migration.)
