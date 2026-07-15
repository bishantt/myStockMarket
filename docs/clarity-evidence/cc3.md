# CC3 — The masthead, the strip, and the theme toggle (evidence)

**Phase:** CC3 of CLARITY-AND-CADENCE-PLAN.md (Plan A). Tag `cc-3` on `299ab90`.
**Date:** 2026-07-15. Executor: Claude Opus 4.8.

## What CC3 did, in one paragraph

CC3 gave the Desk one truth per line (ruling R3) and gave every room a one-tap theme toggle. The
masthead's line 3 is now reader voice, weekday first — "Tuesday's close · updated 7:36 PM ET" — and
the market's open/closed state left it for the pill in the top bar, which is now the single
market-state truth (and shows on the phone too, D10). The pipeline strip's fresh line dropped the
data vintage and the ran-time (both live in line 3 now) and speaks in provenance voice only —
"14 sources · 2 degraded · next edition Wed ~6:37 PM ET". A new one-tap toggle sits left of the gear
in every top bar, both zones, flipping Light ↔ Dark; Settings keeps the canonical three-way control
unchanged. 18 files changed + 1 deleted + 2 new, then 87 re-shot VRT baselines, then one guard fix.

## R3 — one truth per line (the guard is a count)

Before CC3 the market state appeared TWICE on the Desk: the masthead status line ("Markets closed ·
data as of Tue, Jul 14 …") AND the top-bar pill. And the data vintage appeared twice: that same
status line ("data as of …") AND the strip ("Data through Tue Jul 14 close"). CC3 collapses each:

| fact | before (two dialects) | after (one place) |
|---|---|---|
| market state | masthead status line + pill | the pill only |
| data vintage | masthead status line + strip | masthead line 3 only ("{weekday}'s close") |
| pipeline provenance | strip ("ran / next") | strip ("{n} sources · {degraded} degraded · next edition …") |

The guard (`e2e/masthead.spec.ts`) counts, within the header region (top bar + masthead + strip),
the market-state word `/\b(open|closed)\b/` (must be 1) and the vintage `/\bclose\b/` (must be 1). A
word boundary keeps "closed" (state) out of the "close" (vintage) count. Runs on desktop AND phone
(the pill's word differs by viewport — "Market closed" vs "closed" — and the count holds on both).

## The masthead line 3 became a STATIC server render again

Once the market state left line 3, the line depends only on the run's own fixed dates (`runDate`,
`updatedAt`) — no reader-clock "now" — so `MarketStateLine` (a client component that existed ONLY to
grade market-open against the browser clock) is DELETED, and `DeskHeader` renders line 3 directly.
The `{weekday}` goes through `formatWeekdayLong` (lib/time.ts, the one weekday door — drift rules 22
and 29 hold, no new Intl formatter); the `{stamp}` is CC2's 12-hour `formatEtClock` + " ET".

## The theme toggle — one tap, both zones

- **`components/ThemeToggleButton.tsx`** (new, client): reads `<html data-theme>` and the OS
  colour-scheme via `useSyncExternalStore` (server snapshot null/false → no hydration mismatch, the
  same pattern the Settings control uses). 44px, icon-only, `aria-label` from copy.ts naming the
  DESTINATION so the label and icon agree (Moon = "Switch to dark", Sun = "Switch to light").
- **It writes the cookie CLIENT-SIDE**, not through the Settings server action — the theme is a pure
  client preference (only the pre-paint reads the cookie), so writing it in the browser means a reader
  offline in the installed PWA can still change theme. Same cookie name + lifetime (`THEME_COOKIE` +
  new shared `THEME_COOKIE_MAX_AGE`). Settings keeps its server action, unchanged.
- **`nextTheme(current, prefersDark)`** (pure, unit-tested): resolves "system" against the OS first,
  then flips the resolved appearance, so a reader on system-follows-a-dark-OS taps once and gets
  explicit light, never dark again. Never returns "system" (System stays in Settings).
- **Both zones:** the Desk top bar (left of the gear, order pill → toggle → gear) and the Academy top
  bar (which had NO settings affordance — it gains the toggle+gear pair; no pill, a reading room is
  timeless).

## The pill on the phone (D10)

`MarketState` dropped `hidden md:flex` — it shows on the phone now (the phone stated market state
nowhere before). "Market " collapses below `sm` so the phone reads "CLOSED"; the same-line trailing
space keeps "Market closed" on desktop. The e2e 360px sideways-scroll sweep proves the pill + two icon
buttons fit at 360 without wrapping (measured, not eyeballed).

## TDD

- copy.test.ts got three assertions (masthead status, slim strip, toggle aria) FIRST → RED (3 failed)
  → copy.ts implemented → GREEN (37).
- lib/theme.test.ts got `nextTheme` (6 cases) + `THEME_COOKIE_MAX_AGE` FIRST → RED → implemented → GREEN.
- The R3 masthead guard came first (per the plan), then the toggle journey (tap → data-theme flips +
  cookie → reload persists → tap flips back; present in both zones).
- market-hours.test.ts's masthead test was REWRITTEN: it pinned the now-deleted MarketStateLine
  delegation; it now pins the CC3 architecture (the header does not print the state; the pill, a
  client component, reads `marketState(new Date())`).
- PipelineStrip.test.tsx fresh assertions moved to the new provenance copy (+ 2 count props). Suite
  grew 761 → 768 (+3 copy, +4 theme).

## The strip copy rippled into check:live (caught before it deployed)

`checkNextEdition` — the production-truth guard for the strip's future promise — grepped the old
`next: {day}` phrase. CC3's strip says `next edition {day}`, so the guard would have redded check:live
the moment CC3 deployed. Its regex, the fixture's strip phrase, and the test's replace strings were
updated to `next edition {day}`; the guard's logic (measure the promise against the EDITION, never the
wall clock) is unchanged. Confirmed against real production below (found "Wed").

## The gate at `cc-3`

- **App unit: 768 passed (was 761; +7). Pipeline: 579 passed, 35 skipped — unchanged (CC3 touches no
  pipeline code).** typecheck · lint · build · check:routes (B1 14/15 cached) · check:bundles (B4 worst
  198.8 KB < 200 — small growth from the toggle's two lucide icons in shared chrome, within slack) ·
  check:fonts (243 KB, 317 KB headroom, unchanged) · check:drift (29/29, no new rule) · check:migrations
  (no migration in CC3 — the live DB matches the repo).
- **e2e:local (--ignore-snapshots):** desktop 220 passed (2 vrt "Data through" pre-shot asserts fixed
  to the new copy; 1 settings watchlist flake — the documented local-only ISR-timing flake, green in
  isolation), phone 64 passed (incl. R3 on the responsive pill, the toggle journey, the 360 sweep,
  touch targets, a11y), mbp16 grid+hardening passed (grid UNAFFECTED, as the plan predicted), wide
  hardening passed.

## CI (three pushes, one tag; every SHA is a step)

The code, the baselines, and the guard fix are three commits because the VRT re-shoot has to land on
committed code and the check:live ripple was found while the deploy was in flight.

- **Branch CI (push, `32f367f` = code): run 29443715220** — app + pipeline, green.
- **Rehearsal #1 (four-leg oracle, `32f367f`): run 29443726467** — RED on pixels (expected), minted the
  candidate baselines for all four legs.
- **Branch CI (push, `977256e` = 87 re-shot baselines): run 29444934303** — app + pipeline, green.
- **Rehearsal #2 (`977256e`): run 29444953339** — CANCELLED, deliberately: dispatching the tag-SHA
  rehearsal on the same concurrency group superseded it (the guard fix landed a moment later).
- **Branch CI (push, `299ab90` = the check:live guard fix): run 29445336781** — app + pipeline, green.
- **Rehearsal #3 (four-leg oracle, `299ab90` = the tag SHA): run 29445357097 — GREEN, all four legs.**
  This is the same job the tag runs, collected on the exact SHA before the tag existed.
- **Tag run (`cc-3` on `299ab90`): run 29445888680 — four-leg oracle, green (7 m 22 s).**

## The VRT re-shoot — 87 of 97 baselines, the top bar everywhere

Rehearsal #1 redded ONLY styleguide + desk on each leg (4-8 shots). But the toggle changed EVERY
room's top bar, and on most rooms that change fell INSIDE the 600px tolerance and PASSED — the PD5
trap exactly (a shot that changed but did not fail locks in the old look forever). So every candidate
was diffed against its committed twin (pngjs counter — vrt-diff.mjs is still broken, Q-LC1-1) and the
top-bar crops + failure triptychs were opened. The diffs, all uniform-per-category (no outliers):

| surface | what moved | ~px |
|---|---|---|
| every desk room (desktop/wide/mbp16) | the new theme toggle icon in the top bar | ~547 (passed <600) |
| Academy rooms (all legs) | the new toggle+gear pair — the Academy bar had neither before | ~900 |
| every room (phone) | the new market pill "CLOSED" + toggle | ~218–232 (passed <600) |
| desk (all legs) | masthead line 3 rewrite + strip provenance + top-bar pill/toggle | ~3690 (FAILED) |
| desk (phone) | RESIZED 5462 → 5442px — line 3 is shorter (a page that shrinks, never grows) | (FAILED) |
| styleguide (desktop/phone) | the PipelineStrip specimens' fresh line (new provenance copy) | ~4000 (FAILED) |

`login` was left untouched: 129px of antialiasing jitter, no top-bar change, not a CC3 surface (same
call as cc-2). **87 re-shot, 6 unchanged, 4 login skipped, 0 added. 97 baselines total.**

## Post-deploy (production, PD1)

- **Vercel: `299ab90` live Production (CC3 UI; the strip serves "next edition Wed").**
- **check:live: all 7 assertions pass** (masthead session · macro board · index honesty · calendar
  hygiene · press-time · byline links · **next-edition promise — found "Wed"**, which validated the
  checkNextEdition fix against the real deployed strip).
- **check:nav (report mode): no regression** — warm medians 45–59ms across product routes; /settings
  461ms (the uncached writer room, documented since N7, matches cc-2). The toggle is client-side and
  adds no server work.
- **check:lighthouse: the gate metrics pass, the advisory ones are noise.** CLS 0.000/0.000/0.001
  across three samples (the toggle icon flip and the shorter masthead cause NO layout shift — the CC3
  concern, answered); first-load JS 152 KB ≤ 200; Accessibility 100 (the toggle is a proper named
  control). Performance 77/86/82 and LCP 3.7–4.7s are advisory synthetic-4G and RE-SAMPLED per the
  ±10 law — the spread straddles the ~86 baseline, so it is variance, not a CC3 regression.

## Carried-forward / open

- Q-LC1-1 still open (vrt-diff.mjs broken; pngjs-only counter used again; the triptychs + top-bar
  crops are the real proof).
- CLARITY Part 0 (P-1/P-2/dawn-cron/retention) defaults still stand; they land at CC5/CC7/CC8/CC10.
- Q-CC1-1 (ticker-slug rendered proof) + Q-PD6-3 (watchlist reason truncation) → CC4 (the phone-cuts
  phase — Q-PD6-3's natural home).

## Gate-size line

29 drift rules · 97 VRT baselines · 27 e2e specs · 768 unit tests · 16 bundle baselines · 14 manifest
rooms · tag run 7 m 22 s. (e2e specs 26 → 27: e2e/masthead.spec.ts added. Unit tests 761 → 768:
+3 copy, +4 theme. Drift rules unchanged at 29. VRT: 87 of 97 re-shot — the top bar on every room.)
