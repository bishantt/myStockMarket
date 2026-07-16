# Your session: CC8 — The dawn run becomes the Morning Edition's engine. CC8 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1–CC7 and LC1–LC3 are DONE and tagged (`cc-1`…
`cc-7`, `lc-1`…`lc-3`). LEAN-CODEBASE (Plan B) is COMPLETE.** Two plans sit at the repo root:
**CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and **LEAN-CODEBASE-PLAN.md** (Plan B, done).
The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 ✓ → CC7 ✓ → CC8 → CC9 → CC10**

You run **CC8 of CLARITY-AND-CADENCE-PLAN.md and nothing else** — one phase per session is standing
law (CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked. **After CC8 the order continues at CC9.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, and the phase evidence file — CC evidence goes under
   `docs/clarity-evidence/cc8.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, **CC9** of CLARITY-AND-CADENCE-PLAN.md) — carrying
   this handoff rule forward, the phase-order line, the phase's build list distilled from its plan, its
   gate, and anything in flight. Assume the next session has NO memory of yours. (Read
   CLARITY-AND-CADENCE-PLAN.md's CC9 section — Part 4.7-presentation + the Part 5 CC9 line + Appendix A/C.)
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into CC9.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to the OPEN
   questions (QUESTIONS-FOR-BISHANT.md): **Q-CC7-1** (dawn's Last run "—" — **CC8 CLOSES THIS**: once
   publish_dawn stamps a distinct dawn entry, the control-room dawn row gets a real Last run; wire it).
   **Q-CC7-2** (the action→sheet grouping — macro under dawn; if unanswered, leave it — CC8 doesn't
   touch /settings except the dawn cron string). **Q-CC6-2** (the BIG one — the pre-existing
   `classify_event` keyword classifier mislabels real headlines, so the front page leads by a weak guess;
   NOT CC8's domain, but if Bishan wants a classifier pass it reorders the plan). **Q-LC1-1** (vrt-diff.mjs
   BROKEN — pixelmatch absent; CC8 is pipeline-first, but a small /settings dawn-cadence diff may need it;
   fix is `npm i -D pixelmatch` or a pngjs rewrite — the pngjs counter is in PATTERNS.md). **Q-CC5-2** (the
   check:live "strip · next-edition" transient — if red at your post-deploy, read it: is a nightly delayed
   past its cron? then it is the PD1 wall-clock window, not your defect. **CC8/CC9 own the edition-state
   machine that ultimately fixes it.**)
2. Read CLARITY-AND-CADENCE-PLAN.md before touching anything — especially **Part 4.7-pipeline** (the CC8
   spec: the `dawn` mode, the cron move, event times, publish_dawn), **the Part 5 CC8 line**, **Part 0.3**
   (the dawn-cron default — 10:30 UTC Mon–Fri), **Appendix B #4** (calendar_event.timing already exists —
   CC8 starts writing it, NO migration), and **Appendix C** (CC8 = "— | none (pipeline only)"). Read
   `.claude/skills/new-provider-adapter` if you touch a provider adapter.
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 820 · pipeline 584 passed / 35 skipped** (unchanged since cc-7).

## CC8's build list (Part 4.7-pipeline + the Part 5 CC8 line are authoritative; this is the distillation)

**CC8 is a PIPELINE phase (Python, `pipeline/`); the only app touch is the control-room dawn-row update.**

- **New mode `dawn` in `MODE_STAGES`** (`pipeline/jobs/job_a.py`): `("macro", "news", "catalysts",
  "publish", "revalidate")` — all any-hour-safe or dawn-safe by their own docs. `catalysts` joins so the
  day's calendar (and its new timing data) is fresh at breakfast. main() REFUSES an unknown mode (the
  guard stands). If `catalysts` proves close-coupled anywhere, split the calendar refresh out rather than
  force it (intent binds).
- **Cron moves to `30 10 * * 1-5`** in nightly-a.yml (Part 0.3: 6:30 AM EDT / 5:30 AM EST, pre-open
  year-round): Monday GAINS its dawn run (weekend news + Friday close macro), Saturday's pointless dawn
  run STOPS. The current dawn cron is `0 10 * * 2-6` (Tue–Sat, macro mode). job_a already skips non-sessions.
- **Event times (the `catalysts` stage):** enrich earnings events with Finnhub's `hour` (bmo/amc/dmh →
  the EXISTING `calendar_event.timing` column, Appendix B #4 — NO migration). The seven allowlisted macro
  releases carry canonical ET times from a static table in `catalyst_allowlist.py`
  (CPI/JOBS/PPI/GDP/PCE/RETAIL → "8:30 AM ET", FOMC → "2:00 PM ET"), labeled in UI as scheduled
  convention, not a feed. Untimed stays untimed — a null renders nothing (P9).
- **`publish_dawn`** follows `publish_compute`'s NON-OVERWRITE pattern: it stamps `pipeline_run.sourceStatus`
  as today's dawn entry WITHOUT claiming a new edition (E1: `runDate` stays the last closed session;
  dawnness is carried by the run's stages/timestamps). It NEVER overwrites the night's `source_status` —
  it adds BESIDE it (the same reason compute-mode has its own publish: an ordinary publish would blank the
  night's degraded-source map).
- **The workflow input `choice` gains `dawn`** (nightly-a.yml's `workflow_dispatch` inputs). **THE 422
  TRAP:** GitHub validates dispatch inputs against the workflow file ON THE TARGET REF, so the new `dawn`
  value must land on `main` FIRST before you can dispatch it. Push, then dispatch.
- **The control-room dawn row (CC7's `app/lib/pipelines.ts`):** update the dawn def's cron string from
  `0 10 * * 2-6` to `30 10 * * 1-5` so the cadence reads "Mon–Fri · ~6:30 AM EDT / 5:30 AM EST", and give
  the dawn row a REAL Last run now that publish_dawn stamps a distinct dawn entry (closes Q-CC7-1). The
  cron→ET computation is `lib/cron.ts` (CC7, pure + tested) — feed it the new line; add/adjust a cron test.

## CC8's gate (the Endgame, CLAUDE.md)

1. TDD as the plan's §6.2 list dictates. Tests: **mode-stage pinning** (dawn's stage tuple is in
   MODE_STAGES and main() dispatches it; unknown-mode refusal stands), **dawn-on-Monday** (the new cron
   fires Monday, not Saturday), **non-session skip**, **timing enrichment fixtures** (Finnhub hour →
   timing; the 7 macro canonical times), **publish non-overwrite** (dawn adds beside the night's
   source_status, never blanks it). Then build.
2. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift` — 29 rules at cc-7). Guard scripts need
   Node 24 — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. **check:migrations is
   once-per-phase; CC8 adds NO migration (timing exists), so it just confirms the live DB still matches.**
   The pipelines-table dawn-cron-string change is the only /settings touch, so **expect a SMALL VRT diff on
   the settings shots** (the dawn cadence text "Tue–Sat · ~6:00 AM…" → "Mon–Fri · ~6:30 AM…"). If the
   rehearsal reds on the 5 settings shots, re-shoot them, diff EVERY candidate (pngjs counter, Q-LC1-1),
   eyes on each. (Appendix C says CC8 VRT = none because the plan wrote it before CC7 put the cadence on
   screen; the honest diff is the one-line dawn-cadence text.)
3. Push to main → confirm branch CI green.
4. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag. In parallel: wait for
   the Vercel deploy, then `check:live`, `check:nav`, `check:lighthouse`. **check:live watch:** CC8 changes
   the pipeline + the dawn cron; grep `app/scripts/live-truth.mjs` before the deploy (the CC3 lesson). It
   asserts the Desk (masthead/board/index/calendar/press-time/next-edition) — read any red before believing
   it (the edition-state/next-edition logic is CC8/CC9-adjacent).
5. **Post-deploy, the pipeline-verification memory (THE REAL CHECK):** dispatch a REAL `dawn` run (any
   hour — it is hour-safe) via `gh workflow run nightly-a.yml -f mode=dawn`, then verify in production:
   `pipeline_run.sourceStatus` gained the dawn entries (BESIDE, not over, the night's), and the calendar
   carries event times (earnings bmo/amc, macro "8:30 AM ET"). READ the actual data — the memory's lesson:
   the suite goes green while production can publish garbage. Read the `pipeline-phase-verification` memory.
6. Rehearsal green → tag `cc-8` **by SHA** → push → confirm the tag run.
7. ONE docs commit after (evidence `docs/clarity-evidence/cc8.md`; intelligence files; this file rewritten
   for CC9). Every evidence file ends with the gate-size line. Then report and STOP.

## Scope discipline

CC8 is the `dawn` mode + cron move + event times + publish_dawn + the control-room dawn-row update ONLY.
Do NOT build the CC9 presentation (the edition-state machine, the Morning Plan module, the masthead
states, check:live --window=morning) — that is CC9. Do NOT touch the janitor (CC10). If a dawn change
tempts an edition-state or Morning-Plan fix, LOG it — CC9 owns those.

## Carry-forward notes (do not lose these)

- **`cc-7` state:** app **820** unit · pipeline **584** passed / 35 skipped · **97 VRT baselines** (5
  re-shot in CC7 for the settings card→table, 0 added) · **29 drift rules** (no new rule) · **27 e2e
  specs** · **14 manifest rooms** · 4 oracle legs · **16 bundle baselines**. Tag `cc-7` on `1c84bb5`.
  (All run ids in docs/clarity-evidence/cc7.md.)
- **CC7 is shipped:** the control room is a table (`components/settings/PipelinesTable.tsx` via DataTable)
  + a per-row DetailOverlay sheet (`PipelineSheet.tsx`, code-split); `lib/cron.ts` (DST-honest
  cadence/next-run, pure, tested) and `lib/pipelines.ts` (defs, status mapping, run merge, `loadPipelines`);
  the N6 dispatch path is reused untouched via `PipelineActionRow.tsx`. DetailOverlay gained a controlled
  mode (onClose). None of it touched the pipeline Python — CC8's core surface is fresh ground.
- **Q-CC7-1 is CC8's to close:** the dawn row's Last run is "—" today because dawn shares the nightly's
  pipeline_run. `publish_dawn` gives it a distinct dawn entry → wire the dawn row (and maybe the seed) to
  read it.
- **The dawn cron move is a workflow-file edit + a pipelines.ts cron-string edit.** The 422 trap: the new
  `dawn` workflow input must be on `main` before you can dispatch it. Push first.
- **The pipeline-verification memory is load-bearing:** the test suite goes green while production can
  publish garbage. CC8's real check is dispatching a REAL dawn run and READING the sourceStatus + calendar
  times in production. Memory: `pipeline-phase-verification`.
- **The seed's control-room data:** `pipeline_run` + `briefing` rows exist (the table reads them). If CC8
  wants the seeded world to show a dawn Last run, the seed needs a dawn-stamped pipeline_run (decide with
  eyes — CC7's dawn row shows "—" against the current seed, which is honest).
- **Guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit version
  (`v24.18.0`; the glob `v24*` breaks). `check:live`/`check:nav`/`check:lighthouse` need
  `set -a; source .env; set +a` in a FRESH env (they + check:migrations are LOCAL-ONLY — CI builds a fresh
  DB every run). Lighthouse needs `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
  Lighthouse advisory perf swings 74–86 on synthetic-4G — RE-SAMPLE before explaining a move; the gates
  (CLS, first-load JS ≤200) are what bind.
- **The local e2e harness (docker `msm-e2e`) works** — DB URL
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, ONE project at a time with `--workers=1 --ignore-snapshots`. **RE-SEED before the run.**
  The pipeline tests: `env -u DATABASE_URL uv run pytest` from `pipeline/` (fixtures: MSM_FIXTURES=1).
- **Stage by explicit path, never `git add -A`** (the 2026-07-12 scar). The **UI-LIBRARY-EVALUATION trio**
  (`.md` + PDF + HTML, untracked) and **`dummy/`** are audit/deliverable evidence — leave them.
- **Modes recap (`pipeline/jobs/job_a.py`, MODE_STAGES):** full (the cron) · news · macro · compute. CC8
  adds `dawn`. main() refuses any mode it has no handler for — an unrecognised mode used to fall through
  to the full nightly. job_a SKIPS a non-session day and exits cleanly.
