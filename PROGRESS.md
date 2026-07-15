# PROGRESS.md — resumable state

# CC1 IS DONE — tagged `cc-1` (2026-07-15). First phase of the two-plan commission.

**A new commission is active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`). Fixed execution order:**

> **CC1 → LC1 → LC2 → LC3 → CC2 → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

**Checkpoint: CC1 (the two live defects + three paper cuts) is DONE and tagged `cc-1` by SHA on
`c545612`. Nothing is blocked. Nothing is in flight. The next phase is LC1** (LEAN-CODEBASE-PLAN.md),
and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What CC1 did, in one paragraph

CC1 repaired the two defects a reader actually hit and three paper cuts. **Fonts (D1/R2):** Inter,
JetBrains Mono and Newsreader move `display:optional → swap` (the mono that carries every number and
masthead was losing whole sessions to a fallback on a missed swap); CLS stayed 0.000. **The brief
(D2):** the reason it published EMPTY every night was two collaborating bugs in `stats.py` — the
window words ("50-day", "10-year", "1-day") lived in the Stat *label* the gate ignores, so the
narrator's own "50" flagged the sentence describing it; and `pct_above_50dma` (a 0–1 fraction) rendered
with a bare `%` said "0.60%" where the Desk says 60%. Both fixed at the source; `verify.py` untouched.
**A third bug surfaced at the gate:** even fixed, the brief would not publish — sonnet-5's adaptive
thinking was eating the whole `max_tokens=4096` budget and returning a 0-char response, so the brief
held roughly every other night (PD7 had solved this exact wall in `narrate.py` and it never reached
the briefing). Fixed onto narrate.py's pattern: `max_tokens=16000` + `effort:"medium"`. **Held-state
UI:** the four-slot skeleton retired for the one calm line. **Calendar dedupe (D7):** the assembly
de-dupes on `(code,date,symbol)` — CPI showed twice on Jul 14. **Slug leak (D6):** `patternLabel` now
resolves scan-preset keys to their titles. The cc-* tag family was wired into ci.yml first.

## The production proof (the PD7 lesson — the prose, not the green suite)

A real nightly-b dispatch **published** the 2026-07-14 brief, gate `status: ok`, today_focus:
*"…4905 issues higher against 3630 lower, while 60.49% of the universe sits above its 50-day
average…"* — "60.49%", never "0.60%", and the gate cleared both "60.49%" and the window number "50".
Synthesis is reliable now (no more 0-char holds); a given night may still hold when the model
over-narrates (one later dispatch held on 7 flags, all in items 2/4, never today_focus, "60.3%"
cleared) — that is the verify gate working, the base rate the plan's §2 anticipated, not the
structural window-word hold CC1 retired.

## The gate at `cc-1` (all green on `c545612`)

- **App unit: 753 passed** (746 + fonts source-pin 2 + patternLabel 5). **Pipeline: 579 passed, 35
  skipped (614)** (+3: verify red→green, calendar dedupe, synthesis-budget band guard).
- **typecheck · lint · build · check:routes** (14/15 cached) **· check:bundles** (all within slack,
  worst /paper 198.2 KB < 200 ceiling; record-block routes grew ~2–4 KB as `patternLabel` pulls
  scan-presets into the shared chunk — within slack, no baseline moved) **· check:fonts** (243 KB,
  317 KB headroom) **· check:drift** (28/28) **· check:migrations** clean (no migration).
- **check:live all 7 pass** · **Lighthouse CLS 0.000** (R2 hard gate), a11y 100, first-load 183 KB;
  perf 86 / LCP 3.71s advisory (synthetic-4G). **check:nav** report mode (worst 461ms).
- **Rehearsal `29396039314` green on all 4 legs** at `c545612`. **Tag run `29396552183`.**
  Full evidence: `docs/cc-evidence/cc1-defects.md`.

## VRT at `cc-1`

One baseline updated: **`desk-thin-night-mbp16`** — the thin-night HELD brief lost its four-slot
skeleton, so the page is ~200 px shorter (2654 → 2451). Verified by eye against the triptych AND by
pixel-count: the other six mbp16 shots came back 0 differing pixels (and `desk-light-mbp16` at 0 px
confirms `display:swap` moved nothing). 97 VRT baselines total (1 updated, 0 added).

## What outlives CC1 (all in QUESTIONS-FOR-BISHANT.md; none is a phase)

1. **Q-CC1-1 — the ticker-slug fix ships proven by unit test, its rendered picture handed to CC4.**
   The seed never reproduced the leak (its signals are resolved and use detector keys), so Appendix
   C's ticker VRT delta did not appear; reproducing it needs an active preset-keyed seed signal that
   surfaces on the forecasts/track-record surfaces CC4 already re-shoots. Fixed at `patternLabel`,
   unit-tested; the picture is CC4's.
2. **Q-PD6-3 — the watchlist reason truncates on a phone.** Now inherited by CC4 (§4.3/D10 names it).
3. **The PD10 iOS on-glass photo checklist** — still owed to Bishan's iPhone (docs/pd-evidence/
   pd10-hardening.md §4). Not any phase's work.
4. **Part 0 of CLARITY-AND-CADENCE is unanswered** — P-1 (media bucket), P-2 (control-room PAT), dawn
   cron hour, retention windows. Every default proceeds when its phase arrives (CC5/CC7/CC8/CC10).

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=phone --workers=1 --ignore-snapshots
```
The guard scripts (`check:fonts`, `check:routes`, `check:bundles`, `check:migrations`,
`check:live`, `check:lighthouse`) need **Node 24** — Claude Code runs on Node 20, which shadows
nvm, so prepend it: `PATH="$(ls -d ~/.nvm/versions/node/v24*)/bin:$PATH" npm run check:fonts`.
`check:live`/`check:nav`/`check:lighthouse` need `set -a; source .env; set +a` first, and Lighthouse
needs `CHROME_PATH` (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).

## Reading the production brief (how the gate's real check is done)

No local psql. Query production directly with a throwaway Prisma script RUN FROM `app/` (so it
resolves `@prisma/client`), with the real `.env` sourced: read `briefing.status`,
`verification_json`, and `am_json.today_focus.body`. The suite going green is NOT the check — the
published prose is (standing memory: `pipeline-phase-verification`).
