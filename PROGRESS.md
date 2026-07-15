# PROGRESS.md — resumable state

# CC2 IS DONE — tagged `cc-2` (2026-07-15). Next phase: CC3.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`, COMPLETE). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

**Checkpoint: CC2 ("Time, told properly") is DONE and tagged `cc-2` by SHA on `a9356a9`. Nothing is
blocked. Nothing is in flight. The next phase is CC3** (CLARITY-AND-CADENCE-PLAN.md — "The masthead
and the toggle"), and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What CC2 did, in one paragraph

CC2 rewrote every reader-facing timestamp to ruling R1's shapes — and nothing else ("the cleanest
possible diff list: every timestamp string"). Clocks are 12-hour with AM/PM ("7:36 PM"), never
24-hour; every date carries its weekday ("Tue, Jul 14"). lib/time.ts is the one door: formatEtClock
(no pad), NEW formatEtClockPadded ("07:36 PM", the control-room mono column), formatEtDate/formatUtcDate
gained a weekday, NEW formatEtStamp ("Tue, Jul 14 · 7:36 PM ET", footer/sheet provenance);
formatUtcDateLong (the masthead) unchanged. The bare-date-vs-instant split (UTC components vs ET) is
intact — only shapes changed. A NEW check-drift rule (29) fails the build if any app file besides
lib/time.ts constructs an Intl.DateTimeFormat (market-hours.ts is the argued second door — it DECIDES
on time, never renders it). Four beyond the formatters: the double-weekday trap (four sites dropped a
now-redundant formatUtcWeekday prefix), the ISO leak (settings renders runDate through formatUtcDate),
the formatEtStamp consumers (news footers/sheets), and the hardcoded reader-facing clocks (glossary,
control-room, copy.ts — normalized to the house shape).

## The gate at `cc-2` (all green on `a9356a9`)

- **App unit: 761 passed (was 753; +8 formatter assertions in the rewritten time.test.ts). Pipeline:
  579 passed, 35 skipped — UNCHANGED (CC2 touches no pipeline code).** typecheck · lint · build ·
  check:routes (B1 14/15 cached) · check:bundles (B4 worst /paper 198.3 KB < 200) · check:fonts
  (243 KB, 317 KB headroom) · **check:drift 29/29 — the new Intl rule live** · check:migrations (no
  migration in CC2 — the live DB still matches the repo schema).
- **e2e:local (--ignore-snapshots, desktop):** 219 passed. One stale-shared-DB false red (the mbp16
  thin-night test's scanResult.deleteMany had left unusual-volume thinned from a prior run; the page
  rendered "First 3 of 3" correctly — a data-state artifact CLAUDE.md documents, confirmed green on a
  fresh re-seed). Every timestamp-bearing spec passed — no text assertion broke.

## VRT at `cc-2` — 65 of 97 baselines re-shot, timestamps only

The first rehearsal (on `1b0153d`) redded all four legs on pixels, as planned (every timestamp shot
moves — the phase's entire VRT budget). I opened the triptychs and confirmed timestamps only: the
pipeline strip + Desk status line (12-hour clocks), the session calendar + track-record date columns
(dates gained their weekday, tables rebalanced), the news card footers + story stamps (formatEtStamp),
the control-room table (padded clock + the killed ISO leak), the glossary's pre-market/after-hours
clocks, the ticker session dates, and the masked as-of `<time>` boxes widening as the date grew. Copied
65 moved baselines (>200px or resized); login (129px, AA jitter, no timestamp) left unchanged. Committed
on `a9356a9` and RE-rehearsed green. **97 VRT baselines total (65 updated, 0 added).**

## CI evidence (fill from docs/clarity-evidence/cc2.md)

- **Branch CI (push, `1b0153d`): run 29438058728 — app + pipeline, green.**
- **Rehearsal #1 (four-leg oracle, `1b0153d`): run 29438058091 — RED on pixels (expected), minted the
  candidate baselines.**
- **Baselines pushed on `a9356a9`; Re-rehearsal (four-leg oracle, `a9356a9`): run 29439520970 — GREEN.**
- **Tag run (`cc-2` on `a9356a9`): run 29440186576 — four-leg oracle, green (7 m 37 s).**
- **Post-deploy: Vercel Production = a9356a9 (success); check:live 7/7 green; check:nav no regression.**
  Full evidence: `docs/clarity-evidence/cc2.md`.

## Open / carried forward (none blocking)

1. **Q-LC1-1 escalated with proof: vrt-diff.mjs is BROKEN — `pixelmatch` is absent from node_modules.**
   The LC1 decision relied on pixelmatch resolving transitively via Playwright; it no longer does (only
   pngjs remains). I worked around it with a throwaway pngjs-only comparator to count candidate pixels;
   the DIFF IMAGES (triptychs) are the real proof anyway. The tool needs `npm i -D pixelmatch` (the
   explicit form Bishan was offered at LC1) OR a rewrite onto pngjs alone. NOT fixed in CC2 (timestamps
   only; a dep churn is out of scope). See QUESTIONS-FOR-BISHANT.md.
2. **CC1 carries:** Q-CC1-1 (ticker-slug rendered proof → CC4), Q-PD6-3 (watchlist reason truncation →
   CC4), the PD10 iOS on-glass photos (Bishan's device), CLARITY Part 0 (P-1/P-2/dawn-cron/retention —
   defaults land at CC5/CC7/CC8/CC10).

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
Claude Code runs Node 20 and shadows nvm, so prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`
(name the version — the glob `v24*` matches TWO dirs and breaks). `check:live/nav/lighthouse` need
`set -a; source .env; set +a`; Lighthouse needs `CHROME_PATH`.

## The committed dev tools (LC1–LC3 + the VRT diff)

- `pipeline/scripts/comment_stats.py` — comment density per directory + top-25 worklist.
- `pipeline/scripts/comment_prover.py` — proves an edit is comment-only.
- `app/scripts/vrt-diff.mjs` — candidate-vs-baseline pixel diff. **CURRENTLY BROKEN (pixelmatch absent);
  see Q-LC1-1.** A pngjs-only workaround pattern is in PATTERNS.md.
