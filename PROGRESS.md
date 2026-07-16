# PROGRESS.md — resumable state

# CC7 IS DONE — tagged `cc-7` (2026-07-15). Next phase: CC8.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`, COMPLETE). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 ✓ → CC7 ✓ → CC8 → CC9 → CC10**

**Checkpoint: CC7 ("The control room") is DONE and tagged `cc-7` by SHA on `1c84bb5`.
Nothing is blocked. The next phase is CC8** (CLARITY-AND-CADENCE-PLAN.md — "The dawn run becomes the
Morning Edition's engine"), and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What CC7 did, in one paragraph

CC7 turned Settings' flat pipeline panel (N6) into the app's one table (DataTable) of the Desk's three
schedules — **Nightly full (Job A)** · **Dawn refresh** · **Evening briefing (Job B)** — plus a
DetailOverlay sheet per row. The five manual modes are now ACTIONS inside the sheet of the pipeline they
belong to (macro under the dawn refresh — the dawn cron IS macro mode; full/news/compute under the
nightly; briefing under Job B), not flat rows. Columns: Pipeline (name + one plain line) · Cadence
(DST-honest ET, both seasons: "Mon–Fri · ~6:37 PM EDT / 5:37 PM EST") · Last run (OK/DEGRADED/FAILED/HELD
chip + stamp) · Next run (computed in the browser) · Duration · → (opens the sheet). The table renders
from `pipeline_run` + `briefing` ALONE, so it is never blank, token or not; the run-now controls and the
missing P-2 token live in the sheets.

## The judgment calls worth knowing (all in DECISIONS)

1. **Action→sheet grouping by meaning** (Q-CC7-2): macro→dawn, full/news/compute→nightly, briefing→Job B.
   Each of the five in exactly one sheet (a unit test proves it). The plan left the grouping open.
2. **Dawn's Last run reads "—"** (Q-CC7-1): the dawn cron shares the nightly's `pipeline_run`, so no
   per-dawn record exists until CC8's `publish_dawn`. The N0 honest-degrade pattern; the sheet says so.
3. **DetailOverlay gained a controlled mode** (onClose): the control-room sheet reads the table's live
   polled state, which a routing @modal sheet would read stale. Story/ticker sheets stay routing
   (byte-unchanged; overlay.spec 10/10 proves it).
4. **Cadence server-computed (pure); Next run browser-computed** against the reader's clock — matches the
   control room's existing client-state architecture, so the table and nav never disagree and the
   pinned-clock VRT baseline stays deterministic (the old panel's "markets open" rot lesson).

## The gate at `cc-7` (all green on `1c84bb5`)

- **App unit 820** (was 788: +15 cron, +16 pipelines, +1 DetailOverlay controlled, +4 PipelinesTable,
  −4 PipelinePanel deleted). **Pipeline 584 passed / 35 skipped (unchanged — CC7 touched no pipeline
  code).** typecheck · lint · build · check:routes 14/15 · check:bundles (/settings **158.4 KB** ≤ bound,
  worst 198.8 < 200) · check:fonts (243 KB, 317 KB headroom) · **check:drift 29/29 (NO new rule)** ·
  check:migrations (production DB matches — CC7 adds no migration).
- **e2e:local (--ignore-snapshots):** control-room desktop 6 + phone 6 (table renders all 3 rows, sheet
  opens, banner once, sheet depth, degraded source named); a11y desktop 27 (/settings axe clean);
  hardening phone 30 (/settings on-axis at 412 AND 360); overlay phone 10 (routing sheets unbroken);
  settings desktop 2 (watchlist — the documented Desk-disclosure flake cleared on re-seed). The
  dispatch-loop tests skip without a token (P-2 unprovisioned): page.route cannot mock the server-side
  GitHub fetch, so they are structurally skip-only, as they always were.

## VRT at `cc-7` — 5 of 97 re-shot (the settings card→table), every diff explained

Rehearsal #1 (`74ea87a`) redded on VRT (settings changed). Per the PD5 law, EVERY candidate was diffed
against its committed baseline (pngjs counter — vrt-diff.mjs still broken, Q-LC1-1). The moved set EQUALS
the settings set: 5 baselines across 3 legs — settings-light/dark-desktop, settings-light/dark-phone,
settings-light-wide. All RESIZED SHORTER (the compact 3-row table replaces the taller panel: desktop
1693→1341, phone 2291→2036). mbp16 has no settings shot and passed. login moved 129px — AA jitter under
the 200px floor, the pre-existing camera-noise shot, LEFT at its committed baseline (PD5 camera law).
Every settings candidate was opened by eye: the diff is the Pipeline table and the rest of the page
(Add/Theme/Watchlist) is untouched. Rehearsal #2 (`1c84bb5`, with the 5 baselines) went GREEN. 5 re-shot,
0 added, **97 total** (unchanged count).

## CI evidence (full in docs/clarity-evidence/cc7.md)

- **Push CI (74ea87a = code): `29467357378` green.** Rehearsal #1 (74ea87a): `29467363726` RED on VRT
  (expected), minted candidates.
- **Push CI (1c84bb5 = 5 baselines): `29467901371`.** Rehearsal #2 (1c84bb5): `29467901014` GREEN.
- **Tag run (cc-7 on 1c84bb5): `29468244086` — green after a /scans NoFallbackError flake rerun.** The
  first attempt's desktop leg failed one /scans e2e (a transient Next server render error on a page CC7
  never touched; the same SHA passed rehearsal `29467901014` clean, 7m58s). Read first, then `gh run rerun
  --failed` per the Endgame — the tag STAYED on 1c84bb5, never re-pointed.
- **Post-deploy: check:live 7/7** (masthead 2026-07-15, calendar clean, next-edition Thu — the CC5
  transient did NOT recur). check:nav worst 461ms (settings writer room, +4ms vs CC6 — noise).
  check:lighthouse gates green (CLS 0.000–0.002, first-load JS ≤200, a11y 100); advisory perf 74–83
  (synthetic-4G, RE-SAMPLED — the Desk is untouched by CC7, so pure variance).
- **Step 5 (the pipeline-verification READ):** opened production /settings — the table renders all three
  rows from the live DB, cadences read DST-honestly, the buttons are dark with the banner. PASS.

## Open / carried forward (none blocking)

1. **Q-CC7-1 (new, [FYI marked]):** the dawn refresh's Last run is "—" — it shares the nightly's record
   until CC8's publish_dawn. The N0 pattern. CC8 closes it.
2. **Q-CC7-2 (new, [VETO?]):** the action→sheet grouping (macro→dawn etc.). A one-line swap if Bishan
   wants a different map.
3. **Q-CC6-2 STILL open (carried, NOT CC7's domain):** the event classifier mislabels headlines, so the
   production front page can lead by a weak guess. Wants a dedicated classifier pass or a folded phase.
4. **Q-LC1-1 STILL open:** vrt-diff.mjs broken (`pixelmatch` absent). Worked around with the pngjs
   counter again. Fix is `npm i -D pixelmatch` or a pngjs rewrite — Bishan's call.
5. **Q-CC5-2:** the check:live strip transient — did NOT recur at CC7 (7/7). Still owed to CC8/CC9.
6. **P-1 (news media bucket) + P-2 (control-room PAT) still unprovisioned** — CC7's control room is
   display-only without P-2 (the plan's default). Nothing blocked.
7. **`dummy/` + the UI-LIBRARY-EVALUATION trio** — untracked audit/deliverable evidence, LEFT in place.

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1   # RE-SEED before any run
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots   # one project at a time
```
Guard scripts need **Node 24** — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
`check:live/nav/lighthouse` need `set -a; source .env; set +a`; Lighthouse needs
`CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`. check:migrations + check:live
are LOCAL-ONLY (CI builds a fresh DB every run); run them in a fresh env with the root .env sourced.

## The committed dev tools (LC1–LC3 + the VRT diff)

- `pipeline/scripts/comment_stats.py` · `pipeline/scripts/comment_prover.py`
- `app/scripts/vrt-diff.mjs` — **STILL BROKEN (pixelmatch absent); see Q-LC1-1.** The pngjs-only
  workaround pattern is in PATTERNS.md ("Count VRT candidate pixels without pixelmatch").
