# myStockMarket — constitution
Single-user US-equities command center + learning hub. Next.js 16 app (app/) + Python pipeline
(pipeline/) + two GitHub Actions jobs. Executor: Claude Opus 4.8. Contract: DEVELOPMENT-PLAN.md,
plus UI-REDESIGN-PLAN.md for everything visual and APP-FEEL-PLAN.md for structure, layout
containers, navigation and performance (F0–F7, complete 2026-07-12). Authority: RR Part 8/9 > Blueprint > plan >
DECISIONS.md > judgment — except on looks, where UI-REDESIGN-PLAN.md wins (deliberate user
amendment, 2026-07-11). Evidence chapters win on evidence.

## Session rhythm — ONE PHASE PER SESSION (standing rule — user, 2026-07-13, permanent)
Do NOT run multiple phases in one session. Long single-session runs bloat the context window and
degrade the quality of the later work. Work ONE phase, then stop.
At the end of the phase:
1. Finish it properly — tests green, the plan's standing gate passed, tagged, everything committed
   and pushed. Never stop mid-task or with a red build.
2. Bring EVERY intelligence file fully current: PROGRESS.md (exact checkpoint, what's done, what's
   next, anything in flight), DECISIONS.md, LESSONS.md, PATTERNS.md, QUESTIONS-FOR-BISHANT.md, plus
   any evidence table. Write them as if the next session has NO memory of this one — because it won't.
3. Write NEXT-SESSION-PROMPT.md at the repo root: the complete, paste-ready prompt for the next
   session, self-contained.
4. Report back in plain English: what was built, what passed, anything new in QUESTIONS, and confirm
   NEXT-SESSION-PROMPT.md is ready. Then STOP and wait.
**Within a phase the Autonomy Contract below still holds in full** — never ask, never wait, never end
a phase with a question. Anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the
most reasonable assumption made and marked.

## Autonomy (standing directive — user, 2026-07-11, permanent)
**[Amended 2026-07-13, G0: "roll straight into the next phase" is REPEALED by the Session-rhythm
rule above — ONE phase, then stop and check in with Bishan. Within a phase, this contract below
holds in full: never ask, never wait, never end a phase with a question.]**

Run the entire plan to completion without pausing. Do NOT stop at phase boundaries or ask
permission to continue: after tagging a phase, roll straight into the next one. Work through every
remaining phase autonomously, in order, following all the rules below (TDD, plain English, the
non-negotiables, the session ritual).
- **The only reason to stop** is something that GENUINELY blocks further progress and cannot be
  worked around (e.g. a required secret that is absent and cannot be faked).
- **For anything else that needs the user's input:** write it to QUESTIONS-FOR-BISHANT.md, make the
  most reasonable assumption, clearly mark whatever you built on that assumption (in code comments,
  DECISIONS.md, and PROGRESS.md), and keep going.
- **A phase gate you cannot complete now is not a blocker.** If a gate needs live observation (e.g.
  P3's five-night briefing week), proceed with the next phase in parallel and tag the earlier phase
  when its gate is finally met. Note the pending gate in PROGRESS.md.
- Keep updating PROGRESS.md, DECISIONS.md, LESSONS.md, PATTERNS.md and minting skills as you go.

## Non-negotiables (full list: plan §1.5 — re-read weekly)
No directional forecasts; vol bands ≤ 20d + regime caveat · base rates = natural frequency + N +
Wilson CI, N-gated display · CI spanning always-up baseline ⇒ tier weak · new patterns need
t > 3.0 or a ledger grade · decay stamps · folklore labeled · insert-only
signal_log/resolution, misses public · no trending surfaces, no gamification · movers need a
catalyst or the noise line · LLM narrates, never computes; deterministic gate blocks unverified
numbers · Desk/Academy separated, doorways + return rails · general UI motion is allowed
(2026-07-11 amendment) but probability/money visuals NEVER move and nothing manufactures
urgency · timestamps everywhere · mechanical voice (copy.ts) · paper-first ·
login wall always (licensing) · TDD per plan §6.2.

## Readability & documentation (permanent, non-negotiable — user directive 2026-07-10)
The user leads this build. They read the code in VS Code and the terminal output as it happens.
Optimize everything for a human reader, never for machine brevity.
1. **Plain English everywhere.** This file, DECISIONS.md, PATTERNS.md, LESSONS.md, PROGRESS.md,
   and all docs are written in simple, clear English: short sentences, plain words, no jargon or
   clever shorthand. Brief is good; terse at the cost of clarity is not. (Fixed formats — the
   decision-log line, checklists — stay compact by design; all prose around them must be plain.)
2. **Code favors clarity over cleverness.** If a clever version and a clear version both work,
   ship the clear one. No dense one-liners or obscure idioms where a simpler form does the job.
3. **Function-level docs, developer-style.** Every non-trivial function or method gets a
   plain-English comment or docstring saying what it does and why — purpose and intent, not a
   line-by-line restatement. Target: a new developer could read this codebase without help.
4. **The terminal talks in plain English.** Progress reports, decisions, and summaries are
   written for a leader reading along — human terms, never walls of technical shorthand.

## Commands
app:      npm run dev | test | typecheck | lint | build
guards:   npm run check:drift (21 anti-drift rules) · check:fonts (budget) · check:lighthouse · icons
rooms:    (G3) app/lib/routes-manifest.json is THE ONE LIST OF ROOMS. The sweeps (a11y, hardening),
          the pixel oracle (vrt), the nav budget (check-nav) and the bundle budget (check-bundles) all
          read it. app/lib/routes-manifest.test.ts walks app/app/**/page.tsx and REDS THE UNIT SUITE if
          a room exists with no entry — in both directions (a room nobody measures, or an entry for a
          room that is gone, which would let the sweeps "pass" on a 404 page forever). Add a room?
          Add it there. `app/lib/routes.ts` is the typed door.
clocks:   (G3, drift rule 21) NO absolute date literal in prisma/seed.mjs, prisma/fixtures/*.mjs or
          e2e/**/*.ts outside TWO anchors: prisma/fixtures/clock.mjs (the seeded world) and
          e2e/seeded-clock.ts (the browser suite). The rule is NOT "never write a date" — the seeded
          world IS a fixed morning and must be. It is that there is ONE date per world, it has a name,
          and everything else derives from it. A second unnamed copy is how the two silently walk
          apart: /paper's baseline expired 28 minutes after the run that certified it. Comments are
          exempt, so every derived call site carries its answer (`sessionPlus(3)  // 2026-07-12`).
db-drift: npm run check:migrations — is the LIVE database running the schema in this repo? CI can
          never answer this (it migrates a fresh container every run), and production silently ran
          without N0's migration for days because nothing asked. Deploy applies migrations too.
budgets:  npm run check:routes (every room cached) · check:nav (TTFB, needs AUTH_COOKIE_SECRET) · check:bundles
e2e:      npx playwright test  ·  LOCAL: npm run e2e:local (--ignore-snapshots; CI is the pixel oracle)
          Seeded journeys need MSM_SEEDED=1 and a seeded Postgres — CI sets both; this Mac has neither.
rehearse: gh workflow run ci.yml -f job=e2e — LIVE since G1. Runs the FULL browser oracle (all three
          shards) on any ref, with no tag involved. Run it on main's HEAD — the exact SHA you are
          about to tag — and the tag run becomes a confirmation instead of a discovery. `gate-1` went
          green on the first try because of this. Add `--ref <branch>` to rehearse a scratch branch.
          THE TRAP: GitHub validates dispatch inputs against the workflow file ON THE TARGET REF, so
          a new input value must be pushed BEFORE you can dispatch it. Push first, then dispatch.
ci shape: (G0/G1/G2, 2026-07-13) branch pushes run app + pipeline; TAGS RUN ONLY THE BROWSER ORACLE —
          the tagged SHA already proved app+pipeline on main, and re-running them was 43% of the CI
          bill. The oracle is SHARDED into three legs (desktop, phone, wide), one Postgres each:
          15.9 m -> 7.9 m. `workers: 1` is untouched — three legs are three databases, so nothing is
          shared. One live run per ref AND PER EVENT: the group is `ci-<ref>-<event_name>`, and the
          event part is load-bearing — a rehearsal on main shares main's ref, and on its first outing
          it CANCELLED the push run it was rehearsing. Push and rehearsal must overlap; they now do.
docs=free: (G2) `on.push` carries `paths-ignore: ['**/*.md', 'docs/**', '.claude/**']` — a prose-only
          commit starts NO CI run. A MIXED commit (docs + code) still runs in full. PROVEN LIVE, not
          taken from the vendor's docs: GitHub does NOT apply path filters to TAG pushes (gate-2 sits
          on a docs-only commit and its push ran the full oracle green), and `workflow_dispatch`
          ignores them too, so the REHEARSAL still runs on exactly the commits a tag lands on.
          THE TRAP THIS SETS FOR YOU: nothing in the gate currently READS those paths, which is the
          only reason this is safe. If you ever write a guard that reads a document, put its path back
          in the trigger FIRST — otherwise the guard breaks silently. The workflow files are
          deliberately NOT ignored (test_ci_tag_families.py and test_workflow_dispatch.py read them).
heartbeat: nightly-a pushes an EMPTY `chore: heartbeat` commit to main after each full nightly (it
          keeps GitHub from disabling the cron after 60 idle days). Since G2 it starts no CI run —
          paths-ignore skips an empty commit — and it still works, because what keeps the cron alive
          is a PUSH, not a run. THAT CHANGES NOTHING ABOUT THE HAZARD: MAIN CAN STILL MOVE UNDER YOUR
          ENDGAME. Tag the SHA you rehearsed, by SHA — never `HEAD`.
pipeline: uv run pytest      jobs: uv run python -m jobs.job_a (fixtures: MSM_FIXTURES=1)
modes:    job_a runs in FOUR modes, pinned in MODE_STAGES (pipeline/jobs/job_a.py), and main() REFUSES
          any mode it has no handler for — an unrecognised mode used to fall through to the full
          nightly, so "refresh the news" at noon would have re-ingested the whole market mid-session.
          full (the cron) · news · macro · compute (recomputes from STORED bars — calls no provider,
          takes its run date from the DATA not the clock, publishes via publish_compute so it never
          overwrites the night's source_status). job_a SKIPS a non-session day and exits cleanly.
db:       npx prisma migrate dev --name <name> · npx prisma db seed   deploy: git push (Vercel auto)
VRT:      baselines are BORN IN CI. Never shoot one on macOS. Since G1 a rehearsal that reds on
          PIXELS mints its own candidates: download `vrt-baselines-candidate-<leg>`, OPEN EVERY IMAGE,
          commit only an explained diff. THE CANDIDATE IS EVERY SHOT, NOT THE SHOTS THAT MOVED —
          `--update-snapshots=all` re-photographs all of them, so copying the whole directory commits
          files nobody can explain. The triptych (`playwright-failures-<leg>`) is the list of what
          actually moved; the candidate is only where you fetch those files from. Read
          .claude/skills/vrt-update FIRST. `-f job=vrt-baselines` remains for a deliberate restyle.

## The control room (/settings#pipeline — N6)
The reader can run the pipeline by hand: five actions, each in exactly one of ten states, with daily
caps and cooldowns. Server surfaces: `app/(desk)/settings/pipeline-actions.ts` (the dispatch) and
`app/api/pipeline/status/route.ts` (a 15s poll, paused when the tab is hidden).
- **THE DISPATCH API RETURNS NOTHING.** `POST .../dispatches` answers **204 with an EMPTY BODY** — no
  run id — and GitHub's own REST docs say otherwise. So the app RECOVERS the id: it stamps a
  `request_id` into each dispatch, the workflow prints it into `run-name:`, and the app matches it in
  the runs list. **That `run-name:` line in nightly-a.yml and nightly-b.yml is LOAD-BEARING** — delete
  it and nothing fails, every test but one passes, and the control room goes permanently blind.
  `pipeline/tests/test_workflow_dispatch.py` guards it.
- GitHub validates `workflow_dispatch` inputs against the workflow file **on the target ref**: a new
  input that exists only in your working tree gets a 422. The workflow must land on `main` first.
- **P-2 (a GitHub PAT with `workflow` scope) is NOT PROVISIONED**, so every button is dark in
  production. The whole path is proven working (evidence §6). It is a secret and nothing else.

## Conventions
Conventional commits · TDD-first list in plan §6.2 · numbers render ONLY via components/BaseRate
and lib/format · all copy from lib/copy.ts · tokens from globals.css @theme (UI-REDESIGN-PLAN.md §3 +
Appendix A) — never ad-hoc hex · timestamps via lib/time.ts · adapters follow .claude/skills/new-provider-adapter ·
readable-first code and plain-English docs per the Readability section above.

**Any new card, panel, module or overlay: read .claude/skills/new-surface FIRST. Any new ROOM goes in
app/lib/routes-manifest.json — the sweeps, the oracle and both budgets read it, and the unit test reds
if you forget. Any table renders through components/DataTable — there is one table in this app.** It carries the
honesty checklist you run BEFORE writing markup (does it show a base rate → it renders through
BaseRate and nothing else; a probability or money → `data-p2`, and no ancestor may animate or
transform it; an outcome → the word goes in the chip; an empty state → it is information, not an
apology). Also: every control ≥44px on touch, every input ≥16px below `md` (iOS zooms in on a
smaller focused field and does NOT zoom back out), and never the slash-opacity modifier on a token
colour (`bg-surface/50` silently no-ops in Tailwind v4).

## Session ritual
Start: git pull → read this + PROGRESS.md + LESSONS.md → diff DECISIONS.md (any non-[claude]
line = user veto, rank 2.5 — honor it FIRST) → run tests → announce checkpoint.
End: update PROGRESS.md → log DECISIONS/LESSONS ([claude]-marked) → push.
Phase exit: plan §6.4 gate → tag.

## Design one-liner
“Morning Broadsheet” (amended 2026-07-11/12; supersedes “Broadsheet Terminal”): editorial
serif over mono numerals, ONE lavender morning-light wash across the whole app, glass cards
with soft depth, modular rooms — bounded cards, one tap to depth — hairlines inside cards,
one hero figure. One theme at a time — light
“Morning” or dark “Midnight” — governs every room including the Academy (the Academy-stays-
light rule was repealed by the user, 2026-07-12); rooms differ by structure and pace, never
by palette. Color is scarce and always means something. If it could be a template — austere
OR glossy — it is wrong. Spec: UI-REDESIGN-PLAN.md Part 3 · checklist: its §3.10 v2.

## Timing (user lives on market time)
User: Long Island, NY — America/New_York, observes DST. Crons UTC-fixed (DST-proof):
Job A 22:37 UTC = 6:37pm EDT / 5:37pm EST · Job B 00:25 UTC = 8:25pm EDT / 7:25pm EST.
Briefing ready ~8:40pm EDT / ~7:40pm EST — promise 9:00pm ET year-round. Display tz: ET only.
