# Your session: CC7 — The control room. CC7 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1–CC6 and LC1–LC3 are DONE and tagged (`cc-1`…
`cc-6`, `lc-1`…`lc-3`). LEAN-CODEBASE (Plan B) is COMPLETE.** Two plans sit at the repo root:
**CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and **LEAN-CODEBASE-PLAN.md** (Plan B, done).
The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 ✓ → CC7 → CC8 → CC9 → CC10**

You run **CC7 of CLARITY-AND-CADENCE-PLAN.md and nothing else** — one phase per session is standing
law (CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked. **After CC7 the order continues at CC8.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, and the phase evidence file — CC evidence goes under
   `docs/clarity-evidence/cc7.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, **CC8** of CLARITY-AND-CADENCE-PLAN.md) — carrying
   this handoff rule forward, the phase-order line, the phase's build list distilled from its plan, its
   gate, and anything in flight. Assume the next session has NO memory of yours. (Read
   CLARITY-AND-CADENCE-PLAN.md's CC8 section — Part 4.7 + the Part 5 CC8 line + Appendix B/C — to distill it.)
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into CC8.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to the OPEN
   questions (QUESTIONS-FOR-BISHANT.md): **Q-CC6-2** (the BIG one — the pre-existing `classify_event`
   keyword classifier mislabels real headlines, so the production front page leads by a weak guess; v2
   made it visible. NOT CC7's domain — CC7 is the control room — but if Bishan answered it wanting a
   classifier pass, that reorders the plan; otherwise carry it forward). **Q-CC6-1** (the movers/entity
   liquidity notion — scans' single-day is_large_mid vs baserates' 63-day `_DV_WINDOW`; if unanswered,
   CC7 does NOT touch it — settled for CC6, only a swap if Bishan asks). **Q-LC1-1** (vrt-diff.mjs BROKEN — `pixelmatch`
   absent; fix is `npm i -D pixelmatch` or a pngjs-only rewrite — if unanswered and CC7's VRT re-shoot
   needs a candidate diff, use the pngjs-only counter in PATTERNS.md). **Q-CC5-2** (the check:live "strip
   · next-edition" transient — CC8/CC9's; if red at your post-deploy, read it: is a nightly delayed past
   its cron? then it is the PD1 wall-clock window, not your defect).
2. Read CLARITY-AND-CADENCE-PLAN.md before touching anything — especially **Part 4.6** (the CC7 spec:
   the pipelines table columns/rows, the DetailOverlay sheet, the run-now button), **the Part 5 CC7
   line**, **Part 0.2** (P-2 the GitHub PAT — display-only default), and **Appendix C** (CC7 = settings,
   all legs). And read **.claude/skills/new-surface/SKILL.md FIRST — it is the law for any new sheet.**
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 788 · pipeline 584 passed / 35 skipped** (unchanged since cc-6).

## CC7's build list (Part 4.6 + the Part 5 CC7 line are authoritative; this is the distillation)

Settings' pipeline card becomes a **pipelines TABLE** via `components/DataTable` (the one-table law) +
the existing action machinery. **Read `.claude/skills/new-surface` FIRST.**

- **Columns:** Pipeline (name + 1-line plain-English description, copy.ts) · Cadence (DST-honest ET,
  computed from the cron UTC line — BOTH seasonal renderings when they differ: "6:37 PM EDT / 5:37 PM
  EST") · Last run (status chip OK/DEGRADED/FAILED/HELD + `formatEtStamp`) · Next run (computed from cron
  in ET, "~" honors runner jitter) · Duration (mono, from pipeline_run started/finished) · → (opens a
  **DetailOverlay** sheet — PD9's component; the new-surface skill applies).
- **Rows:** Nightly full (Job A) · Evening briefing (Job B) · Dawn refresh (macro today; becomes the
  Morning Edition run at CC8) · [Janitor appears at CC10] · plus the four manual modes as ACTIONS, not rows.
- **The sheet per row:** what it fetches (per-provider list + tonight's per-source status) · its stages ·
  caps/cooldowns · the last 10 runs (manual_run + pipeline_run MERGED) · the run-now button — which uses
  the PROVEN dispatch path (request_id → run-name recovery; the load-bearing `run-name:` line in
  nightly-a/b.yml stays guarded by `pipeline/tests/test_workflow_dispatch.py`). **Reuse that recovery path
  untouched.** Without P-2 the button renders DARK with the existing banner (Part 0.2). Data-level truth
  (source_status, run rows) renders regardless of P-2 — the table is NEVER blank.
- **Compute next-run from the cron lines DST-honestly** — the two seasonal renderings when they differ.
- **P-2 (the GitHub PAT, workflow scope) is NOT provisioned** → buttons dark in production (the default).
  The whole dispatch path is proven (N6 evidence §6). It is a secret and nothing else.

## CC7's gate (the Endgame, CLAUDE.md)

1. TDD as the plan's §6.2 list dictates (UI is exempt; DO test the cron→ET next-run/cadence computation
   and the row/status mapping — those are logic, not looks). App tests + pipeline (unchanged). Then build.
2. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift` — 29 rules at cc-6). Guard scripts need
   Node 24 — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. **check:migrations is
   once-per-phase; CC7 adds NO migration, so it just confirms the live DB still matches (CC6's landed).**
   Settings is ALREADY a room, so likely no `routes-manifest.json` change (but the unit test reds if a
   new room appears without an entry).
3. Push to main → confirm branch CI green.
4. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag (four-leg oracle).
   **VRT: settings, all legs (Appendix C CC7 = "settings only").** The pipelines table replaces the
   pipeline card, so settings moves — open every candidate, confirm the diff is the table + sheet and
   nothing else. Diff EVERY candidate (the pngjs counter — Q-LC1-1). Batch every red leg into ONE
   re-shoot. In parallel: wait for the Vercel deploy, then `check:live`, `check:nav`, `check:lighthouse`.
   **check:live watch:** CC7 changes only /settings; grep `app/scripts/live-truth.mjs` before the deploy
   (the CC3 lesson) — it should assert nothing CC7 touches.
5. **Post-deploy, the pipeline-verification memory:** CC7 is display + a dark button (P-2 unprovisioned),
   so the real check is OPENING /settings in production and confirming the table renders all rows from
   the live pipeline_run/manual_run data, the cadences read DST-honestly, and the button is dark with the
   banner. No dispatch needed (the buttons are dark). Read the `pipeline-phase-verification` memory.
6. Rehearsal green → tag `cc-7` **by SHA** → push → confirm the tag run.
7. ONE docs commit after (evidence `docs/clarity-evidence/cc7.md`; intelligence files; this file
   rewritten for CC8). Every evidence file ends with the gate-size line. Then report and STOP.

## Scope discipline

CC7 is the control-room table + sheet ONLY. Do NOT touch the news/movers/calendar (CC5/CC6, DONE), the
dawn cron / Morning Edition (CC8/CC9), the grid, or the significance formula. If a control-room change
tempts a dawn-cron or edition fix, LOG it — CC8/CC9 own those.

## Carry-forward notes (do not lose these)

- **`cc-6` state:** app **788** unit · pipeline **584** passed / 35 skipped · **97 VRT baselines** (19
  re-shot in CC6, 0 added) · **29 drift rules** (no new rule) · **27 e2e specs** · **14 manifest rooms** ·
  4 oracle legs · **16 bundle baselines**. Tag `cc-6` on `2764e4f`. (All run ids in
  docs/clarity-evidence/cc6.md.)
- **CC6 is shipped:** significance v2 (`newsdesk/rank.py` — a 4-term product; the N-phase 5-term sum is
  gone), the movers liquid floor (`isLiquidFloorEligible` in `app/lib/morning.ts` + the footnote + the
  `data-liquid-floor` marker), the RelVol "≥20×" label, the `instrument.asset_class`/`dv_bucket`
  migration + nightly backfill (`nightly._universe_buckets`, `universe.classify_asset_class`,
  `publish._upsert_instruments` COALESCE), and the calendar grammar + reported-today collapse
  (`CalendarTimeline.tsx`, `loadCalendar`). None overlap /settings.
- **THE BACKFILL BRIDGE IS LIVE (CC6):** `instrument.dv_bucket` is null in production until the next full
  nightly (22:37 UTC) runs the CC6 code. loadMovers falls back to the raw top 8 until then. **The movers
  floor's full production effect + entity_weight are confirmed at the next full nightly** — a pending
  live-observation gate (QUESTIONS-FOR-BISHANT.md, Q about the backfill). If you want to SEE it before
  then, dispatch `gh workflow run nightly-a.yml -f mode=full` and open the Desk. NOT CC7's job.
- **The seed's control-room data:** `pipeline_run` + `manual_run` rows already exist (N6). The CC7 table
  reads them; the DetailOverlay merges manual_run + pipeline_run for the last-10-runs list.
- **The pipeline-verification memory is load-bearing:** the test suite goes green while production can
  render garbage. CC7's real check is OPENING /settings in production. Memory: `pipeline-phase-verification`.
- **`vrt-diff.mjs` is BROKEN** (`pixelmatch` absent — Q-LC1-1, unanswered through CC6). Use the pngjs-only
  counter (PATTERNS.md, "Count VRT candidate pixels without pixelmatch"), inside app/, Node 24, delete after.
- **Guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit version
  (`v24.18.0`; the glob `v24*` breaks). `check:live`/`check:nav`/`check:lighthouse` need
  `set -a; source .env; set +a`; Lighthouse needs `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
- **The local e2e harness (docker `msm-e2e`) works** — DB URL
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, ONE project at a time with `--workers=1 --ignore-snapshots`. **RE-SEED before the run.**
- **Stage by explicit path, never `git add -A`** (the 2026-07-12 scar). The **UI-LIBRARY-EVALUATION trio**
  (`.md` + PDF + HTML, untracked) and **`dummy/`** are audit/deliverable evidence — leave them.
