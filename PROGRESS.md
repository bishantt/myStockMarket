# PROGRESS.md — resumable state

# THE CLARITY-AND-CADENCE COMMISSION IS COMPLETE — cc-1 … cc-10 all tagged (2026-07-16).

**Two plans, one commission (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`). BOTH ARE DONE.** The full, fixed execution order ran to
completion:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 ✓ → CC7 ✓ → CC8 ✓ → CC9 ✓ → CC10 ✓**

**Checkpoint: CC10 ("Fresh in, stale out") is DONE and tagged `cc-10` by SHA on `ad26167`** (the code in
`01a4f1f`, the 30 VRT baselines in `ad26167`). Nothing is blocked. There is NO next phase in this
commission — see NEXT-SESSION-PROMPT.md, which is now the commission-complete handoff.

## What CC10 did, in one paragraph

CC10 gave the Desk a janitor. `pipeline/janitor.py` is ONE retention manifest — every Prisma model named
with a policy (`Forever` the record, `Replace` the self-cleaning calendar, `Trailing(N days|sessions)`) —
mirrored against `schema.prisma` by a bidirectional test, with the DELETE targets DERIVED from the
trailing entries and a guard that refuses any `forever` table. The stage runs in the full nightly (after
publish, before revalidate): it trims news to 45 days, scans to 30 sessions, price bars to 400 sessions
(the R2 parquet lake untouched), and the R2 `backups/` prefix to 8 dumps — in FK-safe order, its counts
stamped beside the night's `source_status` (the `publish_dawn` mirror). `publish_briefing` now snapshots
its sources into `briefing.sourcesJson` (one additive migration), so a news purge never orphans a
published brief; the janitor's news deletion starts at that snapshot cutover. The control room gained a
Janitor row whose sheet reports last night's retirements, and clusters first published in the current
edition wear a quiet "new" tag (R8) on the Desk front page and /news.

## The storage footprint the janitor achieved (the plan's closing ask)

The janitor caps the serving database at these retention windows; everything else is the record and is
kept **forever** (the janitor cannot name it — the allow-list refuses it):

| What | Cap | Column trimmed by |
|---|---|---|
| news (news_item · news_cluster · catalyst_link · news_image) | **45 calendar days** | published_at · run_date · (by parent) · fetched_at |
| scans (scan_result · setup_card · vol_band) | **30 trading sessions** | run_date |
| price_bar (served symbols only) | **400 trading sessions** | date — the R2 lake keeps the 5-year history compute mode reads |
| R2 `backups/` weekly dumps | **keep 8** | the datestamped key |
| the record — briefing, signal_log, signal_resolution, journal_entry, paper_trade, base_rate_stat, instrument, concept_state, lesson_progress, pipeline_run, market_context, macro_stat, manual_run, watchlist_item | **forever** | — |

**The real dispatch proved it in production (nightly `29534782625`):** the janitor RAN and stamped its
entry (all counts 0), and the read revealed the coupling working — **production holds 9 news_item rows
older than 45 days, and the janitor deleted 0** because the snapshot cutover is null (no briefing has
written sourcesJson yet; the first lands at tonight's Job B). Not "0 because nothing is old" — "0 because
the sourcesJson coupling correctly protected age-eligible news that has no cutover yet". scans (5
sessions < 30 floor) and price bars (264 < 400 floor) are correctly under their windows. The steady-state
footprint is the caps above; the pre-cutover news backlog (those 9, and whatever exists at the cutover) is
never purged by design (Q-CC10 FYI) — a bounded one-time cost.

## The judgment calls worth knowing (all in DECISIONS)

1. **R8 landed** — "new" is a quiet lowercase mono word, edition-relative (cache-safe, no tracking),
   information never urgency. On clusters (Desk front page + /news); NOT the Morning Plan overnight
   (self-labeling) or the story sheet.
2. **watchlist_item → forever** (Q-CC10-1) — the one model the plan's §4.8 table did not name; user data.
3. **The calendar "new" tag is DEFERRED** (Q-CC10-2) — calendar_event is replace-policy with no
   first-seen column; an honest tag needs a second migration the plan does not sanction.
4. **isNewInEdition lives in lib/news.ts, not lib/pipeline.ts** — a bundle boundary: pipeline.ts imports
   Prisma, and news.ts is in the /news client bundle; the wrong home blew the 200 KB ceiling (216 KB).
5. **The seed gained a prior (Wednesday) pipeline_run** so the edition-relative "new" tag renders in VRT.

## The gate at `cc-10`

- **App unit 860** · **Pipeline 660 passed / 1 skipped WITH a DB** (613 / 48 without).
- typecheck · lint · build · check:routes 14/15 · **check:bundles** (worst /news 199.8 KB of 200) ·
  check:fonts (243 KB) · **check:drift 29/29** (no new rule) · **check:migrations** green (production runs
  the sourcesJson schema).
- **e2e:local: 236 passed** (the 1 red is the documented settings.spec ISR flake under `next start`, not
  a CC10 regression — git diff cc-9 over the watchlist path is empty).
- **VRT: 30 baselines re-shot, 0 added** (still ~103 total): the "new" tags (Desk module 08 + /news) and
  the Janitor row (settings resize). News shots MOVED-BUT-PASSED (oracle blind to the low-contrast tag —
  Q-PD6-1); caught with the pngjs counter and re-baselined so no stale tag-less /news survives.

## CI + production evidence (full in docs/clarity-evidence/cc10.md)
- Code push CI (01a4f1f) `29532207379` green. Rehearsal #1 `29532219927` RED on VRT (intended). VRT
  re-baseline → `ad26167`; re-baseline push CI `29533520510` green; rehearsal #2 `29533515800` VRT-green,
  desktop settings.spec ISR flake reran-to-green. **Tag run (cc-10 on `ad26167`): `29534754809` GREEN,
  first try.**
- **The real dispatch:** full nightly `29534782625` green; the janitor ran and reported honestly (0
  deletions; 9 old news correctly protected by the null cutover — see above).
- check:migrations green (production runs the sourcesJson schema). check:lighthouse CLS 0.000, first-load
  183 KB, a11y 100, perf 77 (advisory). **check:live 6/7** — the strip's next-edition day is the Q-CC5-2
  transitional wart, triggered by the manual off-schedule nightly (it published Thursday early, so the
  strip points at tonight's SCHEDULED 6:37 PM nightly = "Thu" while the checker expects the next session =
  "Fri"). The edition itself is fresh (masthead 2026-07-16, press-time, macro, index, calendar, byline all
  pass); CC10 touched no strip/edition code; it self-heals at the scheduled nightly (the CC5 pattern).

## Open / carried forward (none blocking)

1. **Q-CC10-1 [FYI]:** watchlist_item → forever (marked assumption).
2. **Q-CC10-2 [VETO?]:** the calendar "new" tag is deferred (needs a 2nd migration).
3. **Q-CC10-3 [VETO?]:** most front-page stories wear "new" on a fresh evening (by design, R8); offer to scope.
4. **Q-CC9-1 [VETO?]** ("before the open" wording) and **Q-CC6-2** (the weak event classifier) — carried,
   neither CC10's domain.
5. **Q-LC1-1:** vrt-diff.mjs still broken (pixelmatch absent); worked around with the pngjs counter. Now
   travels alone (no CC phase left to fold it in).
6. **P-1 (news media bucket) + P-2 (control-room PAT) still unprovisioned** — nothing blocked.
7. **`dummy/` + the UI-LIBRARY-EVALUATION trio** — untracked audit/deliverable evidence, LEFT in place.

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1   # RE-SEED before any e2e run
npm run build                                     # REBUILD after a code change
lsof -ti:3210 | xargs kill -9                     # ALWAYS before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots
```
Guard scripts need **Node 24** — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
Pipeline DB tests need `TEST_DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"` (they
SKIP without it; CI always has a Postgres). `check:live/nav/lighthouse/migrations` need
`set -a; source .env; set +a` and are LOCAL-ONLY. To read production directly (the janitor check):
`set -a; source .env; set +a`, then in `pipeline/`: `from config import load_settings; import psycopg;
psycopg.connect(load_settings().database_url_psycopg)`.

## The committed dev tools

- `pipeline/scripts/comment_stats.py` · `pipeline/scripts/comment_prover.py`
- `app/scripts/vrt-diff.mjs` — **STILL BROKEN (pixelmatch absent, Q-LC1-1).** The pngjs-only counter is in
  PATTERNS.md ("Count VRT candidate pixels without pixelmatch").
