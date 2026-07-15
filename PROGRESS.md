# PROGRESS.md — resumable state

# CC4 IS DONE — tagged `cc-4` (2026-07-15). Next phase: CC5.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`, COMPLETE). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

**Checkpoint: CC4 ("One hierarchy grammar") is DONE and tagged `cc-4` by SHA on `16422d0`.
Nothing is blocked. Nothing is in flight. The next phase is CC5** (CLARITY-AND-CADENCE-PLAN.md —
"News, text-first"), and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What CC4 did, in one paragraph

CC4 applied ONE header/meta grammar to every market room (D4) — serif room titles (Playfair 700
display), mono-600-ink-2 section headers, Newsreader deks, and a meta/as-of treatment — across the
Desk, Paper, Track, Scans and Settings; the Academy kept its own reading-room grammar and took only
the lesson-measure centering its entry named. It rode the dead-space fixes: the Sectors & Scans module
(Desk 07) became a real per-preset module (one row each, RSI extreme reads "0 matches"), Paper's
columns rebalanced (ledger main-left, ticket+mirror right), Track's empty state learned to teach with
real numbers. And it landed D10's phone cuts: the tape reads as one grammar, the movers noise line is
said once per card, the "This week" chip stays on one line, the filter-chip scroll track is hidden and
faded, the watchlist reason clamps with a `title`. No migration, no pipeline change.

## The as-of matches/differs treatment (the one plan/guard collision)

The plan (4.3) said a module's as-of stamp renders `text-faint` when it equals the edition's stamp.
`text-faint` is a 2.2:1 grey drift rule 18 AND axe both forbid on a timestamp — so a MATCH recedes to
`text-muted`, a DIFFER comes forward to `ink-2` (the hierarchy kept, the a11y floor kept). `editionAsOf`
is threaded through every Desk module; SectionMasthead compares the rendered minute. Today all match
(one run → muted); CC9's morning edition makes some differ (ink-2). **Proven by the SectionMasthead
unit test — the VRT harness masks every `time` element and the seed is single-edition, so no
screenshot/e2e can see the colour.** Do NOT "fix" it back to faint.

## The gate at `cc-4` (all green on `16422d0`)

- **App unit 778 (was 768; +5 masthead, +3 buildScanBreakdown, +2 movers). Pipeline 579 passed / 35
  skipped — UNCHANGED (CC4 touches no pipeline code).** typecheck · lint · build · check:routes (14/15
  cached) · check:bundles (worst 198.8 KB < 200) · check:fonts (243 KB, 317 KB headroom) · **check:drift
  29/29 (no new rule — the chip-scroll fade is a CSS class, not a guard)** · check:migrations (no
  migration; the live DB matches the repo).
- **e2e:local (--ignore-snapshots):** desktop 222 · phone 251 · mbp16 24 (grid + thin-night UNAFFECTED)
  · wide 26. The one red is the DOCUMENTED settings-watchlist ISR flake (green in isolation — verified
  on both desktop and phone; NOT my change).

## VRT at `cc-4` — 42 of 97 re-shot, every diff explained

Rehearsal #1 redded desk/paper/settings/track/news. Per the PD2 law, EVERY candidate was diffed (pngjs
counter — vrt-diff.mjs still broken, Q-LC1-1) and every actual/diff opened. Moved: desk (module 07 +
mastheads, RESIZE), paper (rebalance, RESIZE +366px — seed's short ledger), track-record ("Your
forecasts" header + reflow), settings (restructure, RESIZE), news + 4 states (chip cut — phone loud,
desktop sub-tolerance), styleguide (~5600px UNDER tolerance — the SectionMasthead/StatFigure specimens,
the PD5 law), sheet-story-phone (~500px under tolerance — the /news chips behind the sheet's glass).
First-baseline eyes on the Sectors & Scans rows + the Track empty numbers. **login left untouched (129px
AA jitter). 42 re-shot, 0 added. 97 total.**

## CI evidence (full in docs/clarity-evidence/cc4.md) — three pushes, one tag, and a flake caught

The code, then the 42 baselines, then a test-harness fix (a flaky e2e was poisoning the oracle):
- **Branch CI (bf0455b = code): 29450324191 green. Rehearsal #1 (bf0455b): 29450328160 RED on pixels
  (expected), minted candidates.**
- **Branch CI (4449ced = 42 baselines): 29451623277 green. Rehearsal #2 (4449ced): 29451622940 GREEN,
  all four legs.**
- **Tag run on 4449ced (29452129715): FAILED, and its rerun FAILED — NOT a product defect.** The
  settings-watchlist e2e's flaky UI-remove left a row in the leg's shared DB, and the settings/desk VRT
  (which render the watchlist) photographed the 4th row → a resize red. wide/mbp16 were immune (they
  don't run settings.spec). See LESSONS + `fix(cc4)` commit `16422d0`.
- **Fix (16422d0 = guaranteed afterEach DB cleanup + a documented 20s reflection timeout): branch CI
  29453659833 green. Rehearsal (16422d0): 29453658993 GREEN, all four legs.** The 42 baselines are
  byte-identical across 4449ced→16422d0 (the fix touched only settings.spec.ts).
- **cc-4 MOVED from 4449ced to 16422d0** (the tag never earned a green run — see DECISIONS). **Tag run
  (cc-4 on 16422d0): 29454167957 — four-leg oracle, green.**
- **Post-deploy: check:live 6/6 (1 pending a later phase); check:nav no regression (settings 411ms
  writer room); check:lighthouse CLS 0.000/0.002, first-load JS 152 KB (re-sampled — a 183 KB first read
  was noise), perf 77/82 advisory synthetic-4G.**

## Open / carried forward (none blocking)

1. **Q-LC1-1 still open:** vrt-diff.mjs broken (`pixelmatch` absent). Worked around again with a
   throwaway pngjs counter; the triptychs + actuals are the real proof. Fix is `npm i -D pixelmatch` or
   a pngjs rewrite — Bishan's call. See QUESTIONS-FOR-BISHANT.md.
2. **The as-of e2e guard:** substituted a unit test (VRT masks timestamps; the seed is single-edition).
   An e2e belongs at CC9 when a real differing stamp first exists.
3. **CC5 carries:** P-1 (news media bucket) is CC5's decision — default proceeds text-first. Q-CC1-1
   (ticker-slug: a related label surface now renders in the Sectors & Scans module; the exact leak is on
   active scan-fired signals the seed does not model). Q-PD6-3 CLOSED at CC4. PD10 iOS on-glass photos
   (Bishan's device). CLARITY Part 0: P-2/dawn-cron/retention land at CC7/CC8/CC10.
4. **`dummy/`** may retire AFTER CC5 (Part 4.4 hands LEAN the note; CC5 rebuilds the news room the dummy
   screenshots depict). Decide at the CC5 docs commit.

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1   # RE-SEED before any run
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots   # one project at a time
```
Guard scripts need **Node 24** — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (name the
version — the glob `v24*` breaks). `check:live/nav/lighthouse` need `set -a; source .env; set +a`;
Lighthouse needs `CHROME_PATH` (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).
The **settings-watchlist add/focus/remove journey was a flaky poison, FIXED at cc-4 (`16422d0`)** — a
guaranteed afterEach DB cleanup + a 20s reflection timeout; it no longer reds or poisons the
settings/desk VRT. A ~1762px settings resize red means a leftover watchlist row — read it, don't rerun.

## The committed dev tools (LC1–LC3 + the VRT diff)

- `pipeline/scripts/comment_stats.py` · `pipeline/scripts/comment_prover.py`
- `app/scripts/vrt-diff.mjs` — candidate-vs-baseline pixel diff. **STILL BROKEN (pixelmatch absent); see
  Q-LC1-1.** The pngjs-only workaround pattern is in PATTERNS.md ("Count VRT candidate pixels without
  pixelmatch") — write it INSIDE app/, run under Node 24, delete after.
