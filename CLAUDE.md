# myStockMarket — constitution
Single-user US-equities command center + learning hub. Next.js 16 app (app/) + Python pipeline
(pipeline/) + two GitHub Actions jobs. Executor: Claude Opus 4.8. Contract: DEVELOPMENT-PLAN.md,
plus UI-REDESIGN-PLAN.md for everything visual. Authority: RR Part 8/9 > Blueprint > plan >
DECISIONS.md > judgment — except on looks, where UI-REDESIGN-PLAN.md wins (deliberate user
amendment, 2026-07-11). Evidence chapters win on evidence.

## Autonomy (standing directive — user, 2026-07-11, permanent)
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
app:      npm run dev | test | typecheck | lint | build     e2e: npx playwright test
pipeline: uv run pytest      jobs: uv run python -m jobs.job_a (fixtures: MSM_FIXTURES=1)
db:       npx prisma migrate dev · npx prisma db seed        deploy: git push (Vercel auto)

## Conventions
Conventional commits · TDD-first list in plan §6.2 · numbers render ONLY via components/BaseRate
and lib/format · all copy from lib/copy.ts · tokens from globals.css @theme (UI-REDESIGN-PLAN.md §3 +
Appendix A) — never ad-hoc hex · timestamps via lib/time.ts · adapters follow .claude/skills/new-provider-adapter ·
readable-first code and plain-English docs per the Readability section above.

## Session ritual
Start: git pull → read this + PROGRESS.md + LESSONS.md → diff DECISIONS.md (any non-[claude]
line = user veto, rank 2.5 — honor it FIRST) → run tests → announce checkpoint.
End: update PROGRESS.md → log DECISIONS/LESSONS ([claude]-marked) → push.
Phase exit: plan §6.4 gate → tag.

## Design one-liner
“Morning Broadsheet” (amended 2026-07-11; supersedes “Broadsheet Terminal”): editorial serif
over mono numerals, lavender morning-light wash, glass cards with soft depth, hairlines inside
cards, one hero figure, two rooms (cool lavender Desk / warm cream Academy). Color is scarce
and always means something. If it could be a template — austere OR glossy — it is wrong.
Spec: UI-REDESIGN-PLAN.md Part 3 · checklist: its §3.10 v2 (replaces plan §3.10 greps).

## Timing (user lives on market time)
User: Long Island, NY — America/New_York, observes DST. Crons UTC-fixed (DST-proof):
Job A 22:37 UTC = 6:37pm EDT / 5:37pm EST · Job B 00:25 UTC = 8:25pm EDT / 7:25pm EST.
Briefing ready ~8:40pm EDT / ~7:40pm EST — promise 9:00pm ET year-round. Display tz: ET only.
