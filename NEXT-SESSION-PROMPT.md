# The build is complete. There is no next phase.

POLISH-AND-DEPTH-PLAN.md ran PD0 → PD10, one phase per session, and **PD10 was the last one**. It is
tagged `pd-final` (sixteenth tag), rehearsed green on all four oracle legs and confirmed green on the
tag run. The myStockMarket build the plans describe — the constitution, DEVELOPMENT-PLAN,
UI-REDESIGN-PLAN, APP-FEEL-PLAN, NEWS-AND-CONTROL-PLAN, POLISH-AND-DEPTH-PLAN — is finished.

**If you are a fresh session, you do not have a phase to execute.** Run the CLAUDE.md session ritual
to orient (git pull → constitution + PROGRESS.md + LESSONS.md → diff DECISIONS.md for user vetoes →
`npm test` from `app/`, `env -u DATABASE_URL uv run pytest` from `pipeline/` → announce checkpoint),
then STOP and ask Bishan what he wants — because the plan no longer answers that question.

## The state at `pd-final`

- **Tests:** app 746 unit · pipeline 576 (+35 skipped). Both green.
- **Gate:** 28 drift rules · 97 VRT baselines · 26 e2e specs · 14 rooms · 4 oracle legs · bundles under
  the 200 KB ceiling (`/news` 197.4) · fonts pass · check:live 7/7 · check:migrations clean.
- **Tree:** `main` clean; `pd-final` at `07b80669`. Three untracked files
  (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research deliverable, deliberately
  uncommitted — leave them.

## The only two things that outlive the build (both are Bishan's call — neither is a phase)

1. **Q-PD6-3 — the watchlist reason truncates to nothing on a 412px phone.** A real bug in the user's
   OWN authored text. PD10 deferred it on purpose: the fix is a responsive-layout change to
   `app/(desk)/settings/WatchlistManager.tsx` (drop the reason to its own line below `md`) plus a
   `/settings` VRT re-shoot — outside PD10's no-features brief, and the exact "end-of-phase swing"
   this build has regressed on three times. **If Bishan says go, it is a ~20-minute contained fix:**
   the reason to its own line on a phone, then rehearse + re-shoot the settings baselines (open every
   candidate, commit the explained diff). See QUESTIONS 2026-07-15 and DECISIONS 2026-07-15.
2. **The iOS manual checklist (Part 13) — photographs owed.** Everything is built to spec (92dvh,
   `env(safe-area-inset-bottom)`, `overscroll-y-contain`, opacity-only fade, reduced-motion — all
   confirmed in the source, `docs/pd-evidence/pd10-hardening.md` §4). What is owed is Bishan running
   it on glass — open a story sheet, scroll, overscroll-dismiss, land where you left, in mobile Safari
   and again installed-standalone — and dropping the photos into `pd10-hardening.md` §4.

## If Bishan wants something new

Treat it as a fresh piece of work, not a plan phase. There is no standing plan to execute. Follow the
constitution (honesty non-negotiables, TDD-first list, the endgame gate) for whatever it is, and open
a new plan file if the work is large enough to earn one. The FYI capabilities still on the shelf if he
asks: Q-PD8-1 (the Desk brief could emphasize its verified figures, E5) and Q-PD7-1 (the eighth depth
stat, sector breadth) — both available, neither required.
