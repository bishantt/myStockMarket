# PROGRESS.md — resumable state

# CC8 IS DONE — tagged `cc-8` (2026-07-16). Next phase: CC9.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`, COMPLETE). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 ✓ → CC7 ✓ → CC8 ✓ → CC9 → CC10**

**Checkpoint: CC8 ("The dawn run becomes the Morning Edition's engine") is DONE and tagged `cc-8` by
SHA on `7cc77ee`. Nothing is blocked. The next phase is CC9** (CLARITY-AND-CADENCE-PLAN.md —
"The Desk greets the morning"), and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What CC8 did, in one paragraph

CC8 turned the pre-open dawn cron from a three-number macro fix into the Morning Edition's engine. New
`dawn` mode (`pipeline/jobs/job_a.py`, MODE_STAGES) = **macro + news + catalysts + publish + revalidate**:
it re-reads the index closes FRED posts overnight, rebuilds the front page FACTS-ONLY (no Anthropic spend —
risk 10), and refreshes the forward calendar WITH its event times. It ingests no bar and opens no new
edition (E1: the session stays the last close). The cron moved to `30 10 * * 1-5` (6:30 AM ET, Mon–Fri) —
**Monday gains a dawn run**, the pointless Saturday run is gone. Earnings gain Finnhub's `hour` (bmo/amc/dmh)
in the existing `calendar_event.timing` column (no migration); the 7 allowlisted macro releases carry their
canonical ET times (8:30 AM / 2:00 PM). `publish_dawn` stamps a `dawn` entry BESIDE the night's
`source_status` (JSONB merge, never overwrites). The control-room dawn row now reads that entry
(`lastRunForDawn`) for a real Last run — **closing Q-CC7-1**.

## The judgment calls worth knowing (all in DECISIONS)

1. **The dawn's news is FACTS-ONLY** (risk 10): `_build_front_page(narrate=False)` — a news sweep with no
   LLM. Consequence: the morning front page carries overnight stories without the evening's prose (P9); the
   morning PRESENTATION is CC9's.
2. **publish_dawn is the mirror of publish_compute** — merges a `dawn` entry into `source_status` (`||`),
   never overwrites the night's, never moves its `finished_at`. The app's `statusFromRun` ignores the
   nested entry so a dawn never flips the nightly's verdict.
3. **No dawn entry seeded** (Q-CC8-1 context): the seeded dawn row stays "—" (the seed has no dawn run —
   honest); the wiring is unit-tested + production-verified. The dawn sheet's description/stages still
   describe the macro-only dawn — deferred to CC9's presentation (Q-CC8-1).
4. **Event times from Finnhub** (earnings) and the allowlist (macro) — FMP's endpoint has no time-of-day,
   which is exactly why the plan named Finnhub.

## The gate at `cc-8` (all green on `7cc77ee`)

- **App unit 825** (was 820: +4 pipelines.test [statusFromRun robustness + 3 lastRunForDawn], +1 cron.test
  [dawn weekday range]). **Pipeline 595 passed / 40 skipped** (was 584/35: +11 non-DB tests; the 5 new
  publish_dawn/publish_calendar DB tests skip without a Postgres) — **634 passed / 1 skipped with a DB**.
- typecheck · lint · build · check:routes 14/15 · check:bundles (/settings **158.4 KB**, unchanged) ·
  check:fonts (243 KB, 317 KB headroom) · **check:drift 29/29 (NO new rule)** · check:migrations (production
  DB matches — CC8 adds NO migration; `timing` already existed).
- **e2e:local (--ignore-snapshots):** control-room desktop 6 + phone 6.
- **VRT: 5 of 97 re-shot** (settings-light/dark-desktop, -phone, settings-light-wide — the dawn cadence +
  next-run text). Diffed every candidate across 3 legs (pngjs counter, Q-LC1-1): exactly 5 of 90 moved,
  each opened by eye; the change is confined to the Dawn refresh row, no resize, the other two rows
  byte-identical, the dawn Last run stays "—". **97 total (unchanged count).**

## CI + production evidence (full in docs/clarity-evidence/cc8.md)

- **Push CI (4845938 = code): `29470586551` green.** Rehearsal #1 (4845938): `29470617312` RED on VRT
  (expected — the dawn cadence), minted candidates.
- **Push CI (7cc77ee = 5 baselines): `29471200024` green.** Rehearsal #2 (7cc77ee): `29471206140` GREEN,
  all four legs (7m56s).
- **Tag run (cc-8 on 7cc77ee): `29471548172` — four-leg oracle.**
- **Post-deploy: check:live 7/7 (before AND after the dawn run).** check:nav worst 442ms. check:lighthouse
  gates green (CLS 0.000, first-load JS 182 KB, a11y 100); advisory perf 77 (synthetic-4G variance).
- **Step 5 — the REAL check (dawn dispatch `29471227250`, READ production):** the Jul 15 `pipeline_run`
  gained a `dawn` entry BESIDE the night's 14 source keys (none erased; ranAt 12:23 AM ET, all stages/sources
  ok; run_date stayed Jul 15 — E1). The calendar carries times: earnings from Finnhub (JNJ/UNH bmo,
  NFLX/TSLA amc, …), macro from the allowlist (PPI "8:30 AM ET", FOMC "2:00 PM ET"); 24 of 31 timed.

## Open / carried forward (none blocking)

1. **Q-CC7-1 CLOSED** — the dawn row's Last run reads the dawn entry (production-verified).
2. **Q-CC8-1 (new, [FYI marked]):** the dawn sheet's description/stages still describe the macro-only dawn —
   deferred to CC9's Morning-Edition presentation.
3. **No Anthropic at dawn (new, [FYI marked]):** the morning front page is facts-only (no prose) until CC9
   builds the morning presentation. The designed facts-only state (P9).
4. **Q-CC6-2 STILL open (carried):** the event classifier mislabels headlines — now more visible (the dawn
   rebuilds the front page every morning too). Wants a dedicated classifier pass or a folded phase.
5. **Q-LC1-1 STILL open:** vrt-diff.mjs broken (`pixelmatch` absent). Worked around with the pngjs counter
   again. Fix is `npm i -D pixelmatch` or a pngjs rewrite.
6. **P-1 (news media bucket) + P-2 (control-room PAT) still unprovisioned** — nothing blocked.
7. **`dummy/` + the UI-LIBRARY-EVALUATION trio** — untracked audit/deliverable evidence, LEFT in place.

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1   # RE-SEED before any e2e run
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots   # one project at a time
```
Guard scripts need **Node 24** — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
`check:live/nav/lighthouse` need `set -a; source .env; set +a`; Lighthouse needs
`CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`. check:migrations + check:live
are LOCAL-ONLY. **Pipeline DB tests: `TEST_DATABASE_URL=postgresql://postgres:test@localhost:55434/msmtest
env -u DATABASE_URL uv run pytest` — but the `db` fixture truncates AFTER each test, so run pytest BEFORE
re-seeding for e2e (else the first DB test reads seed rows — LESSONS 2026-07-16).**
To read production directly: `set -a; source .env; set +a`, then `from config import load_settings;
psycopg.connect(load_settings().database_url_psycopg)` (the raw DATABASE_URL carries a `pgbouncer` param
psycopg rejects; `database_url_psycopg` strips it).

## The committed dev tools (LC1–LC3 + the VRT diff)

- `pipeline/scripts/comment_stats.py` · `pipeline/scripts/comment_prover.py`
- `app/scripts/vrt-diff.mjs` — **STILL BROKEN (pixelmatch absent); see Q-LC1-1.** The pngjs-only workaround
  pattern is in PATTERNS.md ("Count VRT candidate pixels without pixelmatch").
