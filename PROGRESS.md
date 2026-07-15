# PROGRESS.md — resumable state

# CC3 IS DONE — tagged `cc-3` (2026-07-15). Next phase: CC4.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`, COMPLETE). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

**Checkpoint: CC3 ("The masthead and the toggle") is DONE and tagged `cc-3` by SHA on `299ab90`.
Nothing is blocked. Nothing is in flight. The next phase is CC4** (CLARITY-AND-CADENCE-PLAN.md — "One
hierarchy grammar"), and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What CC3 did, in one paragraph

CC3 gave the Desk one truth per line (ruling R3) and every room a one-tap theme toggle. The masthead's
line 3 is now reader voice, weekday first ("Tuesday's close · updated 7:36 PM ET"); the market's
open/closed state left it for the pill in the top bar, which is now the single market-state truth and
shows on the phone too (D10). The pipeline strip's fresh line dropped the vintage and the ran-time
(both live in line 3 now) and speaks in provenance voice only ("14 sources · 2 degraded · next edition
Wed ~6:37 PM ET"). A new one-tap toggle (ThemeToggleButton) sits left of the gear in every top bar,
both zones, flipping Light ↔ Dark and writing the same cookie the pre-paint reads (client-side, so it
works offline in the PWA); Settings keeps the canonical three-way control unchanged.

## The gate at `cc-3` (all green on `299ab90`)

- **App unit: 768 passed (was 761; +3 copy, +4 theme). Pipeline: 579 passed, 35 skipped — UNCHANGED
  (CC3 touches no pipeline code).** typecheck · lint · build · check:routes (14/15 cached) ·
  check:bundles (worst 198.8 KB < 200) · check:fonts (243 KB, 317 KB headroom) · **check:drift 29/29
  (no new rule)** · check:migrations (no migration in CC3 — the live DB matches the repo).
- **e2e:local (--ignore-snapshots):** desktop 220 · phone 64 (incl. R3 on the responsive pill, the
  toggle journey, the 360 sweep, touch, a11y) · mbp16 grid+hardening (grid UNAFFECTED) · wide hardening.
  One settings-watchlist false red (the documented local-only ISR-timing flake; green in isolation).

## VRT at `cc-3` — 87 of 97 re-shot (the top bar on every room)

Rehearsal #1 redded only styleguide + desk, but the toggle changed EVERY room's top bar and most fell
INSIDE the 600px tolerance (the PD5 trap). Diffed every candidate with a pngjs counter (vrt-diff.mjs
still broken) + opened top-bar crops and triptychs: desktop rooms gained the toggle icon (~547px),
Academy gained the toggle+gear pair (~900px), phone rooms gained the pill "CLOSED" + toggle (~232px),
the Desk changed line 3 + strip (~3690px; phone RESIZED −20px), styleguide changed its strip specimen
(~4000px). login left untouched (129px AA jitter). **87 re-shot, 6 unchanged, 4 login skipped, 0 added.
97 baselines total.**

## CI evidence (full in docs/clarity-evidence/cc3.md)

Three pushes, one tag — the VRT re-shoot lands on committed code and the check:live ripple surfaced
mid-deploy:
- **Branch CI (32f367f = code): 29443715220 green. Rehearsal #1 (32f367f): 29443726467 RED on pixels
  (expected), minted candidates.**
- **Branch CI (977256e = 87 baselines): 29444934303 green. Rehearsal #2 (977256e): 29444953339
  cancelled (superseded by the tag-SHA rehearsal).**
- **Branch CI (299ab90 = the check:live guard fix): 29445336781 green. Rehearsal #3 (299ab90 = tag
  SHA): 29445357097 GREEN, all four legs.**
- **Tag run (cc-3 on 299ab90): 29445888680 — four-leg oracle, green.**
- **Post-deploy: check:live 7/7 green (validated the checkNextEdition fix against production — found
  "Wed"); check:nav no regression; check:lighthouse CLS 0.000, first-load JS 152 KB, a11y 100, perf
  77–86 (advisory synthetic-4G noise, re-sampled).**

## The check:live ripple (a CC3 lesson)

CC3's strip changed "next: {day}" → "next edition {day}". `checkNextEdition` in scripts/live-truth.mjs
grepped the old phrase and would have redded check:live on deploy. Found by READING the guard source
before running it; fixed the regex + fixture + test. **Any reader-facing copy the pipeline strip or
masthead renders is also read by a check:live assertion — grep scripts/live-truth.mjs when you change
strip/masthead copy.**

## Open / carried forward (none blocking)

1. **Q-LC1-1 still open:** vrt-diff.mjs broken (`pixelmatch` absent from node_modules). Worked around
   again with a throwaway pngjs counter; the triptychs + top-bar crops are the real proof. Fix is
   `npm i -D pixelmatch` or a pngjs rewrite — Bishan's call. See QUESTIONS-FOR-BISHANT.md.
2. **CC4 carries:** Q-CC1-1 (ticker-slug rendered proof) and Q-PD6-3 (watchlist reason truncation —
   CC4 is the phone-cuts phase, its natural home). PD10 iOS on-glass photos (Bishan's device). CLARITY
   Part 0 (P-1/P-2/dawn-cron/retention — defaults land at CC5/CC7/CC8/CC10).

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots   # one project at a time
```
Guard scripts (`check:fonts/routes/bundles/migrations/live/nav/lighthouse/drift`) need **Node 24** —
prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (name the version — the glob `v24*` breaks).
`check:live/nav/lighthouse` need `set -a; source .env; set +a`; Lighthouse needs `CHROME_PATH`
(`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on this Mac — a FULL Chrome, not the
headless shell). RE-SEED before an e2e run (a prior mbp16 thin-night can leave the DB thinned).

## The committed dev tools (LC1–LC3 + the VRT diff)

- `pipeline/scripts/comment_stats.py` · `pipeline/scripts/comment_prover.py`
- `app/scripts/vrt-diff.mjs` — candidate-vs-baseline pixel diff. **STILL BROKEN (pixelmatch absent);
  see Q-LC1-1.** A pngjs-only workaround pattern is in PATTERNS.md ("Count VRT candidate pixels
  without pixelmatch").
