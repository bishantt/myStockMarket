# PROGRESS.md — resumable state

**Current phase:** Session-0 not started (P0 is next)
**Last green gate (§6.4):** none — no code exists yet
**Checkpoint:** repo scaffolded (intelligence files + planning docs); git NOT yet initialized
(that is P0 step 1)

## Next 3 tasks
1. P0 step 1 — `git init`; verify the scaffold against DEVELOPMENT-PLAN.md; first conventional
   commit (docs + intelligence files).
2. Session-0 (plan §1.4) — collect every secret/account value from the user in ONE message;
   place per Appendix D. Probes verify progressively during P0 (steps 5, 8, 9).
3. P0 step 3 — scaffold `app/` via create-next-app (the directory is intentionally empty now).

## Blocked
- Session-0 values (provider keys, EDGAR name+email, healthchecks ping URL + read-only API key,
  Anthropic key + spend cap, app username+password, Supabase/Vercel/R2/GitHub confirmations) —
  unblocks at kickoff when the user answers the Session-0 checklist. Fallback: none needed;
  everything before Session-0 (reading, git init, scaffold verification) can proceed.

## Scaffold provenance (2026-07-09, planning session — before any build session)
Created: CLAUDE.md · DECISIONS.md (11 seed entries) · PATTERNS.md · LESSONS.md · this file ·
.claude/skills/ (README + 2 seed procedure skills) · .env.example · .gitignore · README.md ·
.github/workflows/ (empty, .gitkeep) · app/ and pipeline/ (deliberately EMPTY — see DECISIONS.md).
No application code exists anywhere. Everything in plan P0–P6 is unbuilt and must be built
test-first per §6.2.
