# Your session: CC9 — The Desk greets the morning. CC9 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1–CC8 and LC1–LC3 are DONE and tagged (`cc-1`…
`cc-8`, `lc-1`…`lc-3`). LEAN-CODEBASE (Plan B) is COMPLETE.** Two plans sit at the repo root:
**CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and **LEAN-CODEBASE-PLAN.md** (Plan B, done).
The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 ✓ → CC7 ✓ → CC8 ✓ → CC9 → CC10**

You run **CC9 of CLARITY-AND-CADENCE-PLAN.md and nothing else** — one phase per session is standing
law (CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked. **After CC9 the order continues at CC10.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, and the phase evidence file — CC evidence goes under
   `docs/clarity-evidence/cc9.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, **CC10** of CLARITY-AND-CADENCE-PLAN.md) — carrying
   this handoff rule forward, the phase-order line, the phase's build list distilled from its plan (§4.8
   the janitor + the Part 5 CC10 line + Appendix D + Appendix B #2), its gate, and anything in flight.
   Assume the next session has NO memory of yours.
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into CC10.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to the OPEN
   questions (QUESTIONS-FOR-BISHANT.md): **Q-CC8-1** (the dawn sheet still describes the macro-only dawn —
   **CC9 may enrich it** as part of the Morning-Edition presentation: the sheet's description + stages +
   providers now genuinely run macro+news+calendar; a one-line description + two array edits, VRT-neutral
   for the sheet). **The "no Anthropic at dawn / facts-only front page" note** (the morning front page
   carries no prose until CC9 — CC9 decides the morning presentation of module 01 and the Morning Plan).
   **Q-CC6-2** (the pre-existing `classify_event` keyword classifier mislabels headlines — NOT CC9's domain,
   but if Bishan wants a classifier pass it reorders the plan). **Q-LC1-1** (vrt-diff.mjs BROKEN —
   pixelmatch absent; CC9 is a FULL VRT re-shoot phase, so this bites hard — fix is `npm i -D pixelmatch`
   or a pngjs rewrite; the pngjs counter is in PATTERNS.md). **Q-CC5-2** (the check:live strip/next-edition
   transient — **CC9 owns the edition-state machine that ultimately fixes it**, and adds the
   `--window=morning` assertions).
2. Read CLARITY-AND-CADENCE-PLAN.md before touching anything — especially **Part 4.7-presentation** (the
   CC9 spec: the edition-state machine, the 4 states + masthead table, THE MORNING PLAN module, the
   calendar today-first flip, check:live `--window=morning`), **the Part 5 CC9 line**, **Appendix A** (the
   morning copy, verbatim, into lib/copy.ts), and **Appendix C** (CC9 VRT = full re-shoot, all four legs:
   masthead everywhere + module 02 morning state). Read `.claude/skills/new-surface` FIRST (the Morning
   Plan is a new module) and `.claude/skills/vrt-update` (a full re-shoot).
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 825 · pipeline 595 passed / 40 skipped** (unchanged since cc-8; 634/1 with a DB).

## CC9's build list (Part 4.7-presentation + the Part 5 CC9 line are authoritative; this is the distillation)

**CC9 is a PRESENTATION phase (app, `app/`); it builds on the data CC8's dawn run now writes.**

- **The edition-state machine (`app/lib/edition-state.ts`)** — client-computed where "now" matters
  (MarketStateLine's law: the market state rides the reader's clock, not the server's, or a tab left open
  goes stale). Four states (Part 4.7 table): **Evening** (evening run is the newest fact, publish→midnight
  ET) · **Morning** (a dawn run succeeded for today's wall-clock session, before the open) · **Session**
  (open ≤ now < evening publish — Morning masthead + the pill says OPEN, content unchanged) · **Overnight
  gap** (after midnight, dawn not yet run → Evening masthead; NEVER claim a morning that has not happened —
  R6). **How the app knows a dawn ran:** CC8's `publish_dawn` stamps a `dawn` entry into the latest
  `pipeline_run.source_status` (shape: `{ranAt, sources, stages}`); `app/lib/pipelines.ts` already reads it
  (`lastRunForDawn` / `readDawnEntry`). The state machine reads the same `dawn.ranAt` to know a dawn
  happened for today's session. Unit-test it on the seeded clock (`e2e/seeded-clock.ts`).
- **The masthead states** — the Evening masthead is as today; the Morning masthead is
  `"THE DESK — MORNING EDITION · {weekday, date} · before the open · market data through {weekday}'s close ·
  news & macro refreshed {time}"` (Appendix A, verbatim into copy.ts). R3's one-truth-per-line + its e2e
  occurrence-count guard still hold (risk 9 — a second market-state mention reds at build).
- **Module 02 becomes THE MORNING PLAN in morning state** (a new surface — read new-surface FIRST):
  (a) *Overnight* — top 3 clusters by significance ingested since the evening press time, same card grammar;
  (b) *Today's calendar* — today's events with their NEW times ("JNJ earnings · before the open" [bmo→"before
  the open"], "CPI · 8:30 AM ET"), bmo-first; (c) *Where things closed* — one line reusing the evening's
  verified numbers. The evening brief, when published, sits beneath as "Last evening's brief →" (collapsed
  link, same page). In evening state, module 02 is the brief exactly as today. **amJson/pmJson stay untouched
  dormant slots** — the Morning Plan is assembled from LIVE TABLES, not a second LLM artifact (cheaper, and
  nothing to verify at dawn — this is why CC8's dawn spends no Anthropic).
- **The calendar rail flips today-first in morning state** (D7's ordering serves each state).
- **check:live learns the states** (`app/scripts/live-truth.mjs`): a new `--window=morning` flag asserts the
  Morning truths (edition claim matches dawn-run presence; refreshed stamp < 9:30 AM ET). The evening
  assertions NEVER relax (the existing six stand). This is the piece that ultimately fixes Q-CC5-2.
- **copy.ts strings** — Appendix A's morning kicker/status/plan-headers/last-brief-link, verbatim, mechanical
  voice reviews every line.
- **The rendering of `timing`:** CC8 stores earnings timing as the raw `bmo`/`amc`/`dmh` code and macro as a
  clock string ("8:30 AM ET"). The Morning Plan (and the ticker page, which already renders `row.timing`
  raw) should map bmo→"before the open", amc→"after the close", dmh→"during the day" for earnings; macro
  renders as-is. Decide where that mapping lives (a lib/format helper is the natural home).

## CC9's gate (the Endgame, CLAUDE.md)

1. TDD per §6.2: **edition-state machine** (each of the 4 states from a seeded clock + a seeded run shape),
   **masthead occurrence-count** (R3's guard survives the morning kicker), **Morning Plan assembly** (the
   three sections from live tables), **the timing→prose mapping** (bmo→"before the open" etc.). Then build.
2. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` + `check:bundles` +
   `check:fonts` · `e2e:local` · `check:drift` — 29 rules at cc-8). Guard scripts need Node 24 — prepend
   `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. **check:migrations is once-per-phase; CC9 adds NO
   migration (it is presentation).**
3. **VRT is a FULL RE-SHOOT, all four legs** (Appendix C: masthead everywhere + module 02 morning state).
   **DECIDE WITH EYES whether the seeded e2e legs render Morning or Evening state.** The seeded world is a
   fixed morning; today (cc-8) it has NO dawn entry, so it renders EVENING state. To exercise MORNING state
   you must add a dawn-stamped `pipeline_run` to the seed (a `source_status.dawn = {ranAt, sources, stages}`
   entry on the latest run) — **the plan wants the default seed to exercise BOTH: one spec pins each state
   via the two seeded run shapes.** This is a real seed change → a wide VRT re-shoot; budget it. **First-
   baseline eyes on the Morning Plan** (the PD3 law — a brand-new surface's first baseline gets human
   judgement). Diff EVERY candidate (pngjs counter, Q-LC1-1), open every image.
4. Push to main → confirm branch CI green.
5. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag. In parallel: wait for
   the Vercel deploy, then `check:live`, `check:nav`, `check:lighthouse`. **check:live watch:** CC9 changes
   the masthead + adds `--window=morning`; grep `app/scripts/live-truth.mjs` before the deploy (the CC3
   lesson — a masthead/strip copy change can red check:live). Read any red before believing it (the
   edition-state window is exactly the Q-CC5-2 transient's territory).
6. Rehearsal green → tag `cc-9` **by SHA** → push → confirm the tag run.
7. ONE docs commit after (evidence `docs/clarity-evidence/cc9.md`; intelligence files; this file rewritten
   for CC10). Every evidence file ends with the gate-size line. Then report and STOP.

## Scope discipline

CC9 is the edition-state machine + masthead states + the Morning Plan module + the calendar today-first flip
+ check:live `--window=morning` + the Appendix A copy ONLY. Do NOT build the janitor (CC10 — retention,
lifecycle, "new" tags). Do NOT touch the pipeline (CC8's `dawn` mode is done and production-verified). If a
morning-state change tempts a retention or "new"-tag fix, LOG it — CC10 owns those.

## Carry-forward notes (do not lose these)

- **`cc-8` state:** app **825** unit · pipeline **595** passed / 40 skipped (**634/1 with a DB**) · **97 VRT
  baselines** (5 re-shot in CC8 for the dawn cadence, 0 added) · **29 drift rules** (no new rule) · **27 e2e
  specs** · **14 manifest rooms** · 4 oracle legs · **16 bundle baselines**. Tag `cc-8` on `7cc77ee`. (All
  run ids in docs/clarity-evidence/cc8.md.)
- **CC8 is shipped and PRODUCTION-VERIFIED:** the `dawn` mode runs macro+news+catalysts+publish_dawn+
  revalidate; the cron is `30 10 * * 1-5` (Mon–Fri 6:30 AM ET); earnings carry Finnhub's bmo/amc/dmh and
  macro releases their canonical ET times in `calendar_event.timing`; `publish_dawn` stamps a `dawn` entry
  BESIDE the night's `source_status`. A real dawn dispatch confirmed all of it in production (the Jul 15 run
  gained the dawn entry, none of the night's keys erased; calendar timed 24 of 31 events).
- **THE DAWN ENTRY IS CC9'S INPUT.** `pipeline_run.source_status.dawn = {ranAt, sources, stages}`. The app
  reads it in `app/lib/pipelines.ts` (`readDawnEntry`, `lastRunForDawn`). The edition-state machine reads
  the same entry to know a dawn ran for today's session. `statusFromRun` already ignores the nested entry.
- **THE SEED HAS NO DAWN ENTRY (CC8 decision).** So the seeded Desk renders EVENING state today. To render
  MORNING state (for the masthead + Morning Plan VRT), CC9 must seed a dawn-stamped `pipeline_run`. The plan
  wants BOTH states seeded (two run shapes, one spec each).
- **The dawn is FACTS-ONLY (no Anthropic).** The morning front page carries overnight stories without the
  evening's why-it-matters prose. The Morning Plan uses the clusters' FACTS (headline, significance,
  tickers) in "same card grammar" — no prose needed. This is by design (risk 10).
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
  Pipeline DB tests: `TEST_DATABASE_URL=postgresql://postgres:test@localhost:55434/msmtest env -u
  DATABASE_URL uv run pytest` from `pipeline/`. **The `db` fixture truncates AFTER each test, so run pytest
  BEFORE re-seeding for e2e** (else the first DB test reads seed rows — a harness artifact, not a bug;
  LESSONS 2026-07-16).
- **To read production directly** (the step-5 check, per the pipeline-verification memory): `set -a; source
  .env; set +a`, then in `pipeline/`: `from config import load_settings; import psycopg;
  psycopg.connect(load_settings().database_url_psycopg)` (the raw DATABASE_URL carries a `pgbouncer` param
  psycopg rejects; `database_url_psycopg` strips it).
- **Stage by explicit path, never `git add -A`** (the 2026-07-12 scar). The **UI-LIBRARY-EVALUATION trio**
  (`.md` + PDF + HTML, untracked) and **`dummy/`** are audit/deliverable evidence — leave them.
- **The pipeline-verification memory is load-bearing:** the test suite goes green while production can
  publish garbage. CC8 honoured it (the real dawn dispatch + reading the sourceStatus/calendar). CC9's
  check:live `--window=morning` is its equivalent real check — run it against a production dawn window.
  Memory: `pipeline-phase-verification`.
