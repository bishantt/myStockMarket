# Your session: CC10 — Fresh in, stale out (the janitor + "new" tags). CC10 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1–CC9 and LC1–LC3 are DONE and tagged (`cc-1`…
`cc-9`, `lc-1`…`lc-3`). LEAN-CODEBASE (Plan B) is COMPLETE.** Two plans sit at the repo root:
**CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and **LEAN-CODEBASE-PLAN.md** (Plan B, done).
The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 ✓ → CC7 ✓ → CC8 ✓ → CC9 ✓ → CC10**

You run **CC10 of CLARITY-AND-CADENCE-PLAN.md and nothing else** — one phase per session is standing law
(CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never wait;
anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable assumption made
and marked. **CC10 is the LAST phase of CLARITY-AND-CADENCE — after it the plan (and the commission) is
complete. Close it out: PROGRESS.md states the storage footprint achieved.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, and the phase evidence file — CC evidence goes under
   `docs/clarity-evidence/cc10.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md). CC10 is the last CC phase — so if nothing remains,
   write it as a plain "the commission is COMPLETE" handoff (what shipped across cc-1…cc-10, the open
   QUESTIONS Bishan still owns, and any follow-up he named). Assume the next session has NO memory of yours.
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.**

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line is a
   user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to the OPEN questions
   (QUESTIONS-FOR-BISHANT.md): **Q-CC9-1** ("before the open" ruled edition-provenance — if Bishan wants the
   morning status reworded, that is a copy change CC10 could carry). **Q-CC6-2** (the pre-existing
   `classify_event` keyword classifier mislabels headlines — NOT CC10's domain, but a decision Bishan still
   owes). **Q-LC1-1** (vrt-diff.mjs BROKEN — pixelmatch absent; CC10 re-shoots VRT for the "new" tags, so it
   bites again — fix is `npm i -D pixelmatch` or a pngjs rewrite; the pngjs counter is in PATTERNS.md).
2. Read CLARITY-AND-CADENCE-PLAN.md before touching anything — especially **§4.8 Lifecycle** (the janitor
   manifest + the retention table + the couplings), **the Part 5 CC10 line**, **Appendix D** (the janitor
   manifest initial values — sessions are trading sessions, days are calendar days, every `trailing` entry
   NAMES the date column it trims by), **Appendix B #2** (`briefing.sourcesJson Json?` — the citation
   snapshot migration), and **ruling R8** ("new" is information, never urgency). Read `.claude/skills/new-surface`
   FIRST (the "new" tag is a new visual; the Janitor is a row in the existing table) and `.claude/skills/vrt-update`
   (the "new" tags re-shoot VRT). Because CC10 touches the PIPELINE (the janitor stage), read the
   `pipeline-phase-verification` memory: the test suite goes green while production publishes garbage, so the
   REAL check is running the janitor in production and reading the row counts + the control-room report line.
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 852 · pipeline 595 passed / 40 skipped** (unchanged since cc-9; 634/1 with a DB).

## CC10's build list (§4.8 + the Part 5 CC10 line + Appendix D + Appendix B #2 are authoritative)

**CC10 is a PIPELINE + app phase, and the LAST CC phase.**

- **The janitor manifest + stage (`pipeline/janitor.py`)** — ONE manifest names every Prisma model with a
  policy: `forever` (the record — the janitor cannot name them; DB triggers second-lock signal_log/resolution),
  `replace` (calendar_event, already self-cleaning), `trailing(N)` (news 45d, scans/setup/volband 30 sessions,
  price_bar 400 sessions/symbol, R2 `backups/` 8 dumps). A unit test mirrors the manifest against schema.prisma
  BIDIRECTIONALLY — a new table without a policy is a red build. The janitor's DELETE targets derive from the
  `trailing` entries ONLY; a test proves it REFUSES a table not in its allow-list. The stage appends to the
  nightly FULL run (after publish, before revalidate). It NEVER touches R2 parquet (compute mode reads the lake);
  the one R2 deletion is the `backups/` prefix (keep 8 dumps).
- **Briefing citation snapshot (Appendix B #2, one additive migration `briefing.sourcesJson Json?`)** — from
  CC10 on, publish_briefing snapshots its sources (title/outlet/url) into the briefing row, so a news purge
  never orphans a published brief. The janitor's news deletion STARTS at the snapshot cutover date; a test
  proves every published briefing's sources resolve WITHOUT a news_item join. **This is the one migration CC10
  adds — run `npx prisma migrate dev --name briefing_sources_json`, run check:migrations, and the deploy applies it.**
- **The control-room Janitor row (app, `lib/pipelines.ts` + the sheet)** — a Janitor row whose sheet reports
  last night's retirements ("news: 214 rows past 45d · scans: 1 session's rows · backups: kept 8 of 9").
  Deletion is visible, boring, countable. (A row in the existing table — no new room.)
- **"NEW" marking (ruling R8, app)** — clusters and calendar rows first published in the CURRENT edition render
  one quiet mono tag "new" after their title; the loader compares `firstSeen` to the PRIOR edition's press time
  — no user tracking (edition-relative, cache-safe), and the tag disappears with the next edition. R8: "new" is
  information, never urgency — quiet mono, no counts, no badges, no red, nothing that moves. copy.ts owns the
  tag string; the P2 ancestor walk forbids animating it if it ever sits near money.

## CC10's gate (the Endgame, CLAUDE.md)

1. TDD per §6.2: **manifest⇔schema bidirectional**, **allow-list refusal**, **retention arithmetic on fixtures**
   (sessions vs days — the clocks trap: sessions count trading days, days are calendar days), **citation-resolution
   proof** (a purged news_item, a brief that still resolves via sourcesJson), **NEW-tag edition boundary**
   (firstSeen vs prior press time). Then build.
2. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` + `check:bundles` +
   `check:fonts` · `e2e:local` · `check:drift` — 29 rules at cc-9). Guard scripts need Node 24 — prepend
   `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. **check:migrations is once-per-phase; CC10 ADDS the
   sourcesJson migration — confirm the deploy applies it (the N0 lesson: production ran without a migration for
   days because nothing asked). BUNDLE WATCH: /news sits at 199.6 KB of the 200 KB ceiling (cc-9). The "new" tag
   adds to /news and the Desk front-page module — keep its client cost near zero, or /news blows the ceiling.**
3. **VRT re-shoot** for the "new" tags (Appendix C CC10: "small — 'new' tags, janitor row in settings"). The
   "new" tag renders on clusters/calendar rows first-seen in the current edition — the SEEDED world's clusters
   are all `firstSeen` on the run day, so decide with eyes whether any seeded row is "new" relative to the seed's
   prior edition (you may need a seeded prior-edition press time). Diff EVERY candidate (pngjs counter, Q-LC1-1),
   open every image, first-baseline eyes on the "new" tag.
4. Push to main → confirm branch CI green.
5. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag. In parallel: wait for the
   Vercel deploy, then `check:live`, `check:nav`, `check:lighthouse`. (check:live is unaffected by CC10 unless
   the "new" tag changes the masthead/strip — it does not — but grep `live-truth.mjs` before the deploy anyway.)
6. Rehearsal green → tag `cc-10` **by SHA** → push → confirm the tag run.
7. **THE REAL CHECK (pipeline-phase-verification memory):** dispatch a REAL full nightly (or a compute-mode run
   that exercises the janitor stage) in production, then READ the control-room Janitor row's report line and
   confirm row counts actually moved (SELECTs, read-only — the DB-read method is in the carry-forward). A green
   suite is NOT the check for a deletion stage; a janitor that deletes nothing while reporting success is the
   exact silent failure the memory warns about.
8. ONE docs commit after (evidence `docs/clarity-evidence/cc10.md`; intelligence files; this file rewritten as
   the commission-complete handoff). Every evidence file ends with the gate-size line. **PROGRESS.md closes the
   plan with the storage footprint the janitor achieved.** Then report and STOP.

## Scope discipline

CC10 is the janitor (manifest + stage + R2 backup trim) + the sourcesJson snapshot migration + the
control-room Janitor row + the "new" tags (R8) ONLY. Do NOT touch the edition-state machine, the Morning Plan,
or check:live's morning path (CC9 — done and production-verified). The janitor is a DELETION stage — the
allow-list + the DB triggers are the two locks; never let the janitor name a `forever` model.

## Carry-forward notes (do not lose these)

- **`cc-9` state:** app **852** unit · pipeline **595** passed / 40 skipped (**634/1 with a DB**) · **~103 VRT
  baselines** (6 morning shots ADDED, ~12 re-shot for the calendar/settings/footer change) · **29 drift rules**
  (no new rule) · **27 e2e specs** (file count unchanged; new tests added to masthead.spec + desk.spec + vrt.spec) · **14 manifest rooms**
  · 4 oracle legs · **16 bundle baselines**. Tag `cc-9` on `e2a0162`. (All run ids in docs/clarity-evidence/cc9.md.)
- **CC9 is shipped and PRODUCTION-VERIFIED:** the edition-state machine greets a Morning Edition in the browser
  (R6), module 02 is THE MORNING PLAN before the open, the calendar flips today-first, and check:live is
  state-aware (`--window=morning`). Production was genuinely in the Morning edition at 2 AM (CC8's 12:23 AM dawn
  still on the run), and check:live passed 8/8; the production masthead + Morning Plan read exactly Appendix A
  with a POPULATED Overnight. A footer bug CC9 surfaced (buildSourceStatus rendered the nested `dawn` object as
  a degraded provider — live since CC8) was fixed in `78989a5`.
- **THE EDITION STATE IS CLIENT-COMPUTED** (`app/lib/edition-state.ts`): four states from the reader's clock;
  the server seeds `serverNow`, the client corrects on mount. The masthead/module-02/calendar switch together
  (`components/desk/EditionState.tsx`, `EditionSwitch`). The Morning Plan is `components/desk/MorningPlan.tsx`,
  assembled from live tables by `loadMorningPlan` in `lib/morning.ts`.
- **The seeded world exercises BOTH edition states:** `e2e/seeded-clock.ts` has SEEDED_EVENING (Thursday 11 PM,
  Evening) and SEEDED_MORNING (Friday 7 AM, Morning). The seed stamps a Friday 6:31 AM dawn + Friday events with
  timing. The morning shots pin SEEDED_MORNING; the server (real clock) SSRs Evening and the client swaps — so a
  morning VRT/e2e must assert `MORNING EDITION` visible BEFORE shooting/asserting.
- **Guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit version
  (`v24.18.0`). `check:live`/`check:nav`/`check:lighthouse` need `set -a; source .env; set +a` in a FRESH env
  (they + check:migrations are LOCAL-ONLY — CI builds a fresh DB every run). Lighthouse needs
  `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`. Lighthouse advisory perf swings
  74–86 on synthetic-4G — RE-SAMPLE before explaining a move; the gates (CLS, first-load JS ≤200) bind.
- **The local e2e harness (docker `msm-e2e`) works** — DB URL
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, ONE project at a time with `--workers=1 --ignore-snapshots`. **RE-SEED before the run**, and
  **REBUILD (`npm run build`) after a code change** — the e2e webServer serves `.next`, not your source.
- **To read production directly** (the step-5 check): `set -a; source .env; set +a`, then in `pipeline/`:
  `from config import load_settings; import psycopg; psycopg.connect(load_settings().database_url_psycopg)`
  (the raw DATABASE_URL carries a `pgbouncer` param psycopg rejects; `database_url_psycopg` strips it). This is
  how CC9 confirmed the production dawn stamp and read the morning front page.
- **Stage by explicit path, never `git add -A`** (the 2026-07-12 scar). The **UI-LIBRARY-EVALUATION trio**
  (`.md` + PDF + HTML, untracked) and **`dummy/`** are audit/deliverable evidence — leave them.
- **VRT candidates:** `scripts/vrt-diff.mjs` is BROKEN (pixelmatch absent, Q-LC1-1). Use the pngjs-only counter
  (PATTERNS.md, "Count VRT candidate pixels without pixelmatch") — write it INSIDE `app/` so pngjs resolves,
  run under Node 24, delete after. Diff EVERY candidate (a shot can move without failing — the 600px tolerance),
  and OPEN every changed image (login/sheet-ticker/paper/track/ticker are known antialiasing camera-noise — leave
  them; the Q-PD5-2 pattern).
