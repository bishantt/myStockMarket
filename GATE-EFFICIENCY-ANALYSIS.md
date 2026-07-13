# GATE-EFFICIENCY-ANALYSIS.md — why phase exits grind, with evidence

**Commissioned:** 2026-07-13, diagnostic only. Nothing in the repo was changed except this file.
**Snapshot:** everything below was measured at `nc-final` (2026-07-13 ~17:30 ET), while the N7
session was finishing its endgame. Line numbers cite that state; the intelligence files grow, so
treat line cites as "the entry dated X," not eternal coordinates.
**Method:** read-only. Full reads of ci.yml, all gate scripts, the Playwright/Vitest configs, the
skills, the five plans' gate sections, and the constitution; systematic mining of LESSONS.md,
DECISIONS.md, PATTERNS.md, PROGRESS.md, QUESTIONS-FOR-BISHANT.md; machine classification of all
249 commits; and statistics over all 344 GitHub Actions runs via the API. No tests were run, no
workflows triggered, no git state touched. Where a number is an estimate rather than a
measurement, it says so.

---

## 0. The verdict in one page

**The grind is real, and it is now measured.** Across the 14 most recent phases (feel-2 →
nc-final), **62% of all commits are gate/endgame work, not feature work** (71 of 114; ~68% under
a stricter reading). The terminal gate-to-tag stretch alone ran 66–91 minutes in the four worst
phases — roughly half to three-quarters of a phase's *active* wall-clock. The N7 closing task was
observed live at **1h 43m and 188.8k tokens** for "run the standing gate and tag." In CI terms:
**19.7 hours of Actions time in 3.1 days, 45% of it on tag runs, and 52% of all tag runs failed.**

**Your hypothesis — VRT baseline churn as the main sink — is partially right, and the history
corrects it.** VRT is the largest single *mechanical* consumer tied to visuals: 36 manual
baseline mints (14% of all CI minutes), baselines re-minted in 14 of the last 17 phases, 283
snapshot files rewritten, and every mint is a dispatch → ~6 min wait → download → commit → re-tag
round trip. But it is **not** the dominant loop driver. The nc-2 exit failed with 11 test
failures and **zero** were pixels (LESSONS.md:149). The four causes that actually rank above it:

1. **The real oracle runs only at the exit.** e2e + VRT + PWA + axe are tag-gated in CI, and 16
   of 22 e2e specs plus all pixels are *unknowable on this Mac* (no local Postgres, no
   `MSM_SEEDED`, macOS≠Linux rasterization). So every phase's browser-layer failures — whatever
   their kind — are discovered *after* "done" is declared, in 15.8-minute quanta, on a tag that
   must be deleted and re-pushed per attempt. A 52% tag failure rate is not a quality problem;
   it is the designed placement of the first real test run.
2. **The gate is the most defect-dense component in the repo.** Its own harness files are the
   two most-churned files in the codebase (13 commits each). Four of the eight worst fix-chains
   were fights with the gate, not the app. One commit is literally titled "the fourth time a red
   gate turned out to be the gate's fault" (`0628828`).
3. **The gate only ever grows, and every exit re-runs all of it.** 6 steps → 9 steps; 15 → 20
   drift rules in two days; 40 → 76 baselines in two days; `check:migrations` joined 07-13; the
   Polish plan adds `check:live` and a TZ matrix. UI-REDESIGN §9.3 mandates re-running "the whole
   accumulated table" every phase. Fixed cost per exit rises monotonically while phases stay
   small — the gate's share of each phase grows by arithmetic, not by accident.
4. **The instruction stack contradicts itself at exactly the exit moment, and the executor adds
   ritual the texts don't ask for.** Five live clauses still command "roll straight into the next
   phase" against the one-phase-per-session standing rule; CLAUDE.md's exit pointer aims at the
   *oldest* gate definition, whose commands literally cannot pass on this Mac; and the executor
   re-pointed a *green* `nc-final` twice onto trailing docs commits — ~16 CI minutes each — which
   no text requires (the current ritual explicitly puts docs *after* the tag).

**Phases are not too large.** They are small (1–2.5 h active). Smaller phases would make this
*worse*: the gate is a large fixed cost per exit, so more exits = more grinding. The fix is not
the boundary; it is (a) letting the oracle run *before* "done" is declared, (b) repairing the
gate's own defect classes, (c) deleting pure waste from CI, and (d) fixing the contradictory
texts. Estimated effect of the recommendations in §5: an endgame of 60–90 minutes becomes
~20–30, and total CI minutes drop roughly 40–50%, with **zero** guards weakened. §6 lists what
must not be touched, and why, catch by catch.

---

## 1. What the exit gate actually is

### 1.1 The written requirement

The gate is **cumulative by declaration**. Each plan's gate header names its parent:
DEVELOPMENT-PLAN.md:486 (§6.4, 6 steps) → UI-REDESIGN-PLAN.md:1102 → APP-FEEL-PLAN.md:1172 (the
9-step rewrite that is the shape run today) → NEWS-AND-CONTROL-PLAN.md:1199 ("the F-plan's gate
with this plan's additions") → POLISH-AND-DEPTH-PLAN.md:1344 (adds step 6.5 `check:live`, a TZ
matrix leg — not yet built). Nothing has ever been removed.

The current ritual, in order (APP-FEEL-PLAN.md:1172–1187, carried forward):

1. `typecheck && lint && test` (app unit)
2. `uv run pytest` (pipeline)
3. `npm run build && check:routes && check:bundles && check:fonts`
4. `npm run e2e:local` (`--ignore-snapshots`; 16 of 22 specs skip — seeded-only)
5. `npm run check:drift` (20 rules; **runs in no CI workflow — local discipline only**)
6. push → wait for the Vercel deploy → `check:nav` (12 routes × 5 samples, warm median ≤ 150 ms)
7. `lighthouse-check.mjs` against the deployment (one page: `/`; CLS + first-load JS are hard,
   perf/LCP advisory)
8. `git tag <phase>` + `push --tags` → **the CI tag run is the pixel oracle**
9. update PROGRESS/DECISIONS/LESSONS/PATTERNS/QUESTIONS, write NEXT-SESSION-PROMPT.md,
   **confirm the tag CI green**

Two things the ritual does *not* require, verified against all three living gate texts: it does
not require the intelligence-file commits to sit under the tag (step 9 deliberately trails step
8), and `check:migrations` is in **no** standing gate block — only CLAUDE.md's command list and
PD1's playbook (it soft-skips, exit 0, when the DB is unreachable).

### 1.2 The executable reality, with measured timings

| Piece | Where it runs | Measured cost | Source |
|---|---|---|---|
| app job: typecheck 10s · lint 9s · vitest ~55–60s · build 38–40s · routes/bundles/fonts seconds · `npm ci` ~26s | CI, every push | **~151–161 s** total | runs #296/#299 job data |
| pipeline job: uv sync 3s · apt pg-client ~10s · pytest ~12s · containers ~14s | CI, every push | **~46–55 s** (parallel with app) | same |
| **e2e + VRT + PWA + axe job** | **CI, tag pushes only** | **~940–950 s**, of which the single `npm run e2e` step (webServer build + 22 specs × desktop+phone + wide×2, 76 screenshots, 24 axe scans, **1 worker, serial**) is 852–868 s | runs #299 (green), #295 (red) |
| VRT baseline mint (manual dispatch) | CI only | **~6 m** run (+ download + commit + re-verify); *also needlessly runs app+pipeline jobs* | run #297 = 372 s; 36 mints median 3.8 m |
| Branch push, all-in (app ∥ pipeline) | CI | **median 2.1 m** code / 2.0 m docs — docs pay full price, no path filters | 344-run statistics |
| Tag push, all-in | CI | **median 8.2 m across all 62** (early suites were smaller); **15.8 m today** | statistics + #295/#299 |
| Local full pass (steps 1–5) | Mac | not measured (nothing was run); structurally **two production builds** — one for the budget checks, a second inside Playwright's webServer | playwright.config.ts:121 |
| check:nav / lighthouse (steps 6–7) | Mac against live Vercel | not measured; serialized behind "push → wait for deploy"; 60 authed fetches + one Lighthouse page | script reads |

**Where the wall-clock goes at an exit:** the critical path is `npm run e2e` in the tag run —
90% of the 15.8 minutes — and the number of times it must be paid. Everything else is noise by
comparison.

### 1.3 What can only be known in CI (the oracle gap)

Unknowable on this Mac, by construction: VRT pixels (baselines are Linux-born; a local
`playwright test` would red ~46 shots on rasterization alone), all 16 seeded e2e specs (no local
Postgres, no `MSM_SEEDED`), PWA/axe on Linux, ~26 Postgres-backed pytest tests. Mirror-image:
`check:migrations` is knowable **only** locally/production — CI structurally cannot answer it
(fresh container per run). Consequence: a phase that touches visuals has a hard minimum of **two
CI round trips** (mint + tag), and *any* browser-layer mistake adds ~16 minutes per discovery.
That minimum is fine. The observed reality — nc-final took **six** pushes of the same tag — is
what §2 and §3 explain.

### 1.4 One gate exists only as a comment

ci.yml's header (lines 4–7) says Lighthouse runs "on the phase-exit tags." **No Lighthouse job
has ever existed in any workflow** — verified across the full git history of ci.yml. Lighthouse
runs only when the agent runs `check:lighthouse` locally (step 7). The header is a false
statement inside the gate's own definition file — exactly the "gate that silently never runs"
class its own line 10 warns about.

---

## 2. Where the time actually went — the loops, categorized and ranked

### 2.1 The endgame, reconstructed from commits (feel-2 → nc-final)

| Phase | Commits (feat / gate) | Endgame wall-clock | Gate share of commits |
|---|---|---|---|
| feel-3 | 9 (2/7) | **66 m** | 78% |
| feel-final | 13 (2/11) | **~91 m** | 85% |
| nc-1 | 6 (1/5) | 37 m | 83% |
| nc-2 | 12 (4/8) | 47 m | 67% |
| nc-5 | 13 (9/4†) | **73 m** | 31% († 85% counting the terminal bug-storm) |
| nc-final | 12 (1/11) | **90 m** | 92% |
| *aggregate, 14 phases* | *114 (43/71)* | — | **62%** |

Recurring signature: a "complete / tagging" docs commit followed by *more* code before the tag
actually lands (phase-0, phase-4, phase-5, nc-2) — the tag is a moving target even before CI
gets involved.

### 2.2 The endgame, as CI saw it (the worst case, nc-final, all times UTC 07-13)

| time | result | duration | commit under the tag |
|---|---|---|---|
| 20:19 | cancelled | 229 s | docs(n7) |
| 20:22 | cancelled | **785 s** | docs(n7) — no concurrency group; a re-pushed tag does not auto-cancel the previous run |
| 20:35 | **failure** | 950 s | perf(n7) — red costs the same 15.8 m as green; the suite fails at the end |
| 21:02 | mint | 372 s | VRT baselines for the story-page tap targets |
| 21:10 | **success** | 947 s | test(n7) — the actual green gate |
| 21:27 | cancelled | 120 s | docs(n7) — tag re-pointed **after** green |
| 21:29 | running | — | docs(n7) — re-pointed again |

Six pushes of one tag; 51 minutes of tag CI, of which 15 were the green gate. The two post-green
re-points were the executor's own stricter ritual ("run the gate once, on exactly what ships") —
the written ritual puts docs commits *after* the tag and asks for no such thing. Re-pointed exit
tags are the norm, not the exception: `nc-final` ×6, `feel-final` ×5, `feel-5` ×5,
`redesign-final` ×4.

### 2.3 Failure modes at the gate, ranked by evidenced cost

Ranked by (recurrence × cost per occurrence), from the intelligence files, the commit record,
and the CI statistics together:

**#1 — Browser-layer failures discovered only at the tag (the placement, not any one failure).**
32 of 62 tag runs failed; 293 of 531 tag-run minutes ended red; every discovery costs a full
15.8-minute cycle plus tag delete/re-push mechanics. The failures themselves are heterogeneous —
pixels, e2e assertions, seeded-data drift, flakes — but they share one property: nothing could
have caught them earlier, because nothing runs the suite earlier. This placement is the single
largest time sink in the build. Evidence: 344-run statistics; nc-0/1/2/3/final all tagged red at
least once (LESSONS.md:125,149,157; commit record).

**#2 — The gate's own defects ("a red gate that is the gate's fault").** Four of the eight worst
fix-chains were repairs *to the gate*: the pixel oracle photographing loading states (feel-3,
66 m), the 1%-ratio tolerance that made VRT unable to fail and the baselines "born in a different
world" (nc-1, 37 m), baseline calendar-rot and CI-vs-local world mismatch (nc-2, 47 m), sweeps
that passed on a nonexistent page plus two guards "rotting on a timer" (nc-final, 90 m). The
recurring mechanisms, each now named in LESSONS: **guard-that-cannot-fail** (~15 instances — "the
pattern, now seen six times," LESSONS.md:141), **absolute fixture under a relative rule** (the
/paper baseline "expired 28 minutes after the run that last certified it," LESSONS.md:203),
**time-of-day assertions** (the control-room test that passed only while the market was open),
**route lists that rot by omission** (/news shipped in N5; no sweep measured it until N7).
`check-drift.mjs` and `vrt.spec.ts` are the two most-modified files in the repo (13 commits
each) — the gate is being renegotiated commit-by-commit at exit time.

**#3 — VRT baseline churn (your hypothesis).** Real and expensive: 36 mint dispatches = 165 CI
minutes (14% of everything), re-mints in 14 of the last 17 phases, 283 snapshot files rewritten,
6 mints inside nc-5's endgame alone, and each mint drags the app+pipeline jobs along for nothing.
Two of the four biggest re-bakes were whole-world re-photographs (44 and 58 files). **But** the
history caps its rank: pixel failures were *absent* from several of the worst exits (nc-2: 11
failures, 0 pixels; nc-3: 3 reds, 0 pixels), and much of the VRT-adjacent time was actually #2
(fixing the oracle's own determinism), not re-baselining per se. Churn is also the running cost
of the build's most effective detector — the pixel oracle caught the deleted scans room, the
macro-row rewrite, the "markets open out of a cache" lie, and the control panel's wrong clock.

**#4 — Docs/intelligence overhead on the tag boundary.** 58 of 249 commits (23%) are docs-only;
~16 sit directly on tag boundaries; **9 post-tag commits exist only to write down "CI confirmed
green"** — each firing another full CI cycle (no path filters: a docs commit costs the same 2.1
minutes as code, and when the executor re-points the tag onto one, 15.8 minutes). Six tags point
at docs-only commits. The evidence chapters are substantial documents (n5: 24 KB; n6: 20 KB; n7:
17 KB) written inside the endgame.

**#5 — Pure CI waste.** 43% of all CI wall-clock (512 min) re-verified SHAs already green on
main (the tag run re-runs app+pipeline identically — ~208 billed minutes of literal duplication);
Playwright browsers re-downloaded every e2e/vrt run; apt pg-client reinstalled on all ~300
pipeline runs; uv uncached; no concurrency groups (a superseded tag run once burned 13 minutes
before being hand-cancelled); the app is production-built twice per tag run and twice per local
gate pass.

**#6 — Genuine flakes (small but corrosive).** One unexplained e2e flake is on record (the /news
empty-`<main>` + NoFallbackError that failed, failed its retry, then vanished — QUESTIONS:50-55).
Each such event, under current mechanics, costs a tag delete/re-push and 15.8 minutes. `gh run
rerun --failed` exists and is never used — re-pushing the tag is the only re-run mechanism in
practice.

### 2.4 Lessons that did not stick (the loop *behind* the loops)

The files self-count their relapses: guard-that-cannot-fail "now seen six times"; cached-page ×
live-clock "twice-learned" then learned twice more; secret-not-passed-to-job shipped "TWICE";
`getByRole("alert")` matching Next's route announcer bit in P-phase and again three days later;
`notFound()` returning HTTP 200 bit F-phase and again at N7. LESSONS.md's own header rule — "a
lesson that repeats means the guard was inadequate — escalate it to a test or a skill" — is the
**accretion engine**: every relapse mints a new gate item, the gate grows, the grown gate has
more surface to rot, and rot is discovered at the next exit. That is the flywheel that keeps
endgames long even as the team gets smarter.

---

## 3. Contradictions and tensions between the instruction layers

Six real findings, each stated as the two clauses in conflict. (Ten further suspects were
investigated and **cleared** — including the motion-vs-P2-stillness stack, the font budget, the
one-DataTable/BaseRate/copy.ts rules against the Polish plan, and the repealed
Academy-stays-light rule, which was cleanly propagated everywhere. The honesty rules never
contradict each other. Details of the cleared items are in §3.7 so nobody re-litigates them.)

### 3.1 REAL — "stop at the phase boundary" vs five live "roll straight on" commands
- CLAUDE.md "Session rhythm" (user, 2026-07-13, permanent): "Work ONE phase, then stop."
- CLAUDE.md "Autonomy" (user, 2026-07-11, also marked permanent, never amended): "Do NOT stop at
  phase boundaries…: after tagging a phase, roll straight into the next one."
- Same command live in APP-FEEL-PLAN.md:22 and :1165, NEWS-AND-CONTROL-PLAN.md:28 and :1191,
  UI-REDESIGN-PLAN.md:1099.

The reconciliation exists in one clause ("Within a phase the Autonomy Contract below still holds
in full") and in the Polish plan only. An executor that re-reads its plan at tag time — which the
ritual demands — receives a direct order to do the thing the standing rule forbids, from a text
the authority order ranks as "plan," with the user rule's higher rank derivable but not stated
beside it. This detonates at exactly the exit moment and fully explains exit-time dithering.

### 3.2 REAL, by design — the oracle-placement loop (the engine behind §2.3 #1)
- ci.yml:124: e2e+VRT+PWA runs `if: startsWith(github.ref, 'refs/tags/…')` — tags only.
- Gate step 4: local e2e is `--ignore-snapshots`, and 16 of 22 specs skip locally.
- Gate step 9: "confirm the tag CI green" — the tag's green run **is** a written requirement.
- UI-REDESIGN §9.3: "Phase gates re-run the whole accumulated table, not just the phase's rows."

Satisfying step 9 therefore *requires* tagging before the first real test run, and any failure
requires re-pointing the tag. The loop is not a misbehavior; it is the specified procedure. (The
docs-commit re-points after green are the one part the texts do *not* require — see §2.2.)

### 3.3 REAL, imminent — the 200 KB hard ceiling vs the Polish plan's arithmetic
- check-bundles.mjs:52: `CEILING_KB = 200`, explicitly not re-baselinable ("Ship less
  JavaScript").
- Current `/news` first-load: baseline 195.1 KB; worst measured 196.2 KB at nc-final.
- POLISH-AND-DEPTH-PLAN.md:1324–1326 (PD9): the `@modal` overlay chrome lands in the `(desk)`
  shared chunk and "must hold baseline+10KB" — which on `/news` is 205.1 KB, **over the
  immovable ceiling**. Real headroom is ~4 KB, and PD5's shared kit (TickerChip/Term/KeyFigure)
  spends from the same pot. The plan's own escape hatch (code-split the overlay behind first
  open) resolves it — but the sentence in the plan points the executor at the wrong constraint,
  so expect one full failed exit at PD5 or PD9 unless it is pre-corrected.

### 3.4 REAL, latent — the global rules vs the project, with the override written nowhere
~/.claude/rules (loaded every session, marked "OVERRIDE any default behavior") demand 80% test
coverage, unit+integration+e2e for everything, mandatory TDD via a tdd-guide agent, GitHub/npm
research before any implementation, and planner/code-reviewer agent ceremony. The project runs
plan §6.2's *targeted* TDD list (UI explicitly exempted), has **no coverage tooling at all**, and
has never invoked those agents — correctly, but nothing anywhere says the project supersedes the
globals. Every fresh session re-derives that conclusion; a session that takes the globals
literally burns a phase on coverage-chasing or research ceremony. One sentence in CLAUDE.md
closes it.

### 3.5 REAL, chronic — diverged duplicates of single rules
The repo's own recorded disease ("two sources of truth for one document is a slow-motion lie"),
live today in four places:
- **Amber consumers:** UI-REDESIGN-PLAN.md:175 and :481 and new-surface SKILL.md:146 all say
  "exactly two consumers"; the truth (check-drift.mjs:43–60) is **four** plus the styleguide, and
  desk.spec.ts:385 *asserts* a third. An executor obeying the plan/skill text would strip
  sanctioned amber at an exit.
- **The exit gate itself:** CLAUDE.md:121 ("Phase exit: plan §6.4 gate → tag") points at the
  **oldest** copy — DEVELOPMENT-PLAN.md §6.4 still orders a local full `npx playwright test`
  (reds ~46 snapshots on macOS), `npx lhci autorun` (instrument doesn't exist; the real one is
  lighthouse-check.mjs), and docs-before-tag ordering (the current ritual is tag-before-docs).
  §6.4 never received the dated correction block the plan's own conflict protocol mandates.
- **Fonts, two eras:** DEVELOPMENT-PLAN.md:385 still specifies Archivo/IBM Plex Mono and a
  320 KB budget (now four different families, 560 KB); base-rate-display SKILL.md:35 demands
  numerals "in Plex Mono" — a family drift rule 7 **bans** as a dead class; and
  check-font-budget.mjs's emergency drop-order names weights that stopped shipping at R6.
- **§3.10 v2 vs check-drift.mjs:** the plan checklist has 11 greps and names a component that
  does not exist; the script has 20 rules. The script is the truth; CLAUDE.md still cites §3.10
  as the checklist.

### 3.6 REAL, small — false facts about CI inside the gate texts
- ci.yml header: Lighthouse "runs on the phase-exit tags" — no such job has ever existed (§1.4).
- POLISH-AND-DEPTH-PLAN.md:262–263: "nc-6's tag CI ran `check:migrations` green" — CI cannot run
  it and does not contain it; the check ran locally. An executor auditing tag-CI logs for that
  run will not find it and may go hunting.

### 3.7 Cleared — so they are not re-investigated
Motion amendment vs P2 stillness vs VRT vs budgets: engineered deliberately and consistent
(screenshots disable animations; the PD9 sheet is designed inside the stillness rule — but note
two *scheduled* collisions: the sheet's opacity transition will need the P2-walk exemption list
extended the way the route fade already is, and PD5's TickerChip forces the long-deferred
mark-or-hover decision on the movers delta chip). Fonts: 317 KB of headroom, no new weights
planned. Polish plan vs the one-table/one-door/copy.ts/token rules: the plan pre-amends every
rule it touches, with logging mandated. Academy-stays-light repeal: fully propagated; the old
assertion was deleted with a note, not weakened. Session-start "run tests": deliberately only the
two unit suites, cheap. check:migrations: in no exit gate; soft-skip is argued in-file; the only
defect is the false sentence in 3.6. Tag-green requirement: written, not invented (§3.2). The
`pd-*` CI wiring gap: pre-solved by PD0's first job, with ci.yml's own header warning about
exactly this. Historical rule-vs-rule collisions (drift rule 6 vs the SetupCards chevron; rule 18
vs `has-[:disabled]`; 44px vs density): all resolved by moving code or widening the rule with
reasoning inline — the "collision is information" pattern is healthy.

---

## 4. Structural inefficiency, named

1. **The first oracle run happens after "done."** Everything browser-shaped is verified for the
   first time on the exit tag (§3.2). This is the root inefficiency; most of the others are its
   amplifiers.
2. **A red tag costs full price and full mechanics.** The suite fails at minute ~15 of 15.8; the
   only re-run mechanism used is delete-and-re-push the tag; no concurrency group cancels the
   superseded run.
3. **One serial job.** 22 specs × 2–3 projects, 76 screenshots, 24 axe scans, one worker, plus a
   full production build, every attempt. The parallelism knob (shard by Playwright project, one
   throwaway Postgres each) is unused.
4. **Everything re-verifies everything.** Tag runs re-run app+pipeline on a main-green SHA (43%
   of all CI minutes); mints run app+pipeline for no reason; docs commits pay the code price
   (no path filters); the app builds twice per tag run and twice per local pass (the CI double
   build is *deliberate* — DB-less vs seeded prerenders — the local one is not).
5. **The baseline matrix is monolithic.** 76 full-page shots; a shared-chrome or token change
   re-bakes all of them; §9.3 re-runs the whole table every exit; there is no budget or reason
   requirement on *adding* shots (40 → 76 in two days).
6. **Route lists are hand-kept in five places** (a11y ROUTES, hardening ROUTES/SEEDED_ROUTES,
   check-nav PRODUCT_ROUTES, check-bundles BASELINE_KB, vrt SEEDED_ROOMS) and rot by omission —
   that is precisely how /news went unmeasured for two tagged phases.
7. **The endgame writes a book.** Evidence chapter + five intelligence files + NEXT-SESSION-
   PROMPT + plan regeneration, as multiple commits, each triggering CI, some post-tag purely to
   record that CI was green.
8. **The gate has no owner-of-record for its own health.** Gate bugs are found the expensive way
   (at exits) because nothing exercises the gate between exits — e.g. `check:drift` runs in no CI
   workflow at all; if a session forgets step 5, nothing mechanical notices.

---

## 5. Recommendations

Ordered by leverage per unit of risk. R1–R6 are CI/config changes; R7–R9 are text repairs;
R10–R12 are practice rules for the executor; R13–R14 are strategy. None weakens a guard; §6
draws that line explicitly.

**R1 — Make the oracle dispatchable before the tag (the big one).** Add `job=e2e` to ci.yml's
`workflow_dispatch` options (same job, same seeding, same snapshots — just triggerable on main).
New ritual step between 5 and 6: *rehearse* — dispatch the full browser suite on the candidate
SHA; fix until green; only then deploy-check, tag, and confirm. The tag run stays (one ritual
confirmation on exactly the shipped SHA), but it becomes first-try green in the common case.
This converts the 52%-fail tag loop into an ordinary pre-tag fix loop with identical coverage
and no tag mechanics. Cost: none — the same minutes, spent earlier, without delete/re-push.

**R2 — Shard the e2e job by Playwright project.** Three parallel jobs (desktop / phone / wide),
each with its own throwaway Postgres and seed — the 1-worker constraint exists because seeded
writes share one database; three databases dissolve it. ~15.8 m → ~7–8 m per attempt, applied to
every rehearsal, mint, and tag run. Verify wide's two-spec scope keeps its shard tiny.

**R3 — Stop re-verifying what is already green.** On tag pushes, run only the e2e job: add
`if: github.ref_type != 'tag'` to `app` and `pipeline` (the same SHA just ran on main; ~208
billed min of pure duplication removed). Give the two jobs the same guard against
`workflow_dispatch` mints. Add a `concurrency` group per ref with cancel-in-progress so a
superseded tag run dies instantly instead of after 13 minutes.

**R4 — Path-filter the docs.** `paths-ignore` for `**/*.md`, `docs/**`, and the intelligence
files on the app+pipeline jobs (tag runs unaffected). Docs commits then cost zero CI, and the
temptation to re-point tags onto them loses its meaning.

**R5 — Collapse the mint round trip.** In the e2e job, on VRT-only failure, add a follow-up step
that reruns `vrt.spec.ts --update-snapshots=all` and uploads the fresh PNGs as an artifact of
*that same run*. The agent downloads, looks at every image (the discipline stands), commits with
the reason. Saves a dispatch + ~6 minutes + one full re-verify per re-baseline; 36 of those in
three days. The mint job stays for deliberate restyles.

**R6 — Cache the boring things.** `~/.cache/ms-playwright` keyed on the Playwright version;
`enable-cache: true` on setup-uv; drop the per-run apt install (bake pg_dump via a cached step or
container). ~2 minutes off every browser run, ~10 s off every pipeline run.

**R7 — Fix the six text defects of §3.** (1) Annotate the five "roll straight on" clauses with
the 2026-07-13 one-phase rule (one line each). (2) Point CLAUDE.md's exit line at "the current
plan's standing gate" and put the dated correction block on §6.4. (3) Delete "and Lighthouse"
from ci.yml's header or add the job it promises. (4) Correct POLISH:262 (check:migrations ran
locally, not in tag CI) and PD9's budget sentence (the binding constraint on `/news` is the
200 KB ceiling; pre-authorize the code-split escape hatch). (5) Reconcile the amber-consumer
count in UI-REDESIGN ×2 and new-surface (point them at check-drift.mjs as the register). (6) One
sentence in CLAUDE.md: "This repo's plan §6.2 supersedes the global ~/.claude testing/workflow
rules (coverage %, agent ceremony, research-first)."

**R8 — One routes manifest.** A single `app/e2e/routes.ts` (route, seeded?, wide?, budget-KB,
pending?) consumed by a11y, hardening, vrt, check-nav, and check-bundles. Kills the
rot-by-omission class structurally instead of by checklist. The N7 hardening ("a sweep must
prove it swept something") stays as the backstop.

**R9 — Mechanize the fuse-finder.** The absolute-date-under-relative-rule class has now cost two
exits. Add a drift rule (or a unit test) that greps seeds, fixtures, and e2e specs for absolute
date literals outside a sanctioned list (`SEEDED_EVENING`, migration names) and demands
`DAYS_AGO()`-style relatives. Same for time-of-day-dependent assertions where feasible (a grep
for `getHours()`/market-open branches in specs).

**R10 — Endgame practice: the tag stays put.** Once the tag's run is green, it does not move.
Docs/intelligence commits after it are branch pushes by design ("what ships" = the tag plus its
trailing docs, per the ritual's own step order). Batch the step-9 files into **one** commit;
retire the separate post-tag "CI confirmed green" commit entirely (record it inside the same
step-9 commit or next session's checkpoint).

**R11 — Endgame practice: flakes get a re-run, not a re-tag.** On a suspected-flake tag failure,
`gh run rerun <id> --failed` first (re-runs the same SHA without moving anything). One
unexplained flake is already on record; this makes its price 30 seconds instead of a re-tag
cycle.

**R12 — Put a growth discipline on the gate itself.** Adding a VRT shot, a drift rule, a sweep
route, or a budget now requires the same one-line "why" the blur budget demands — and each
phase's exit table records the gate's own size (rules, shots, specs, minutes) so growth is a
decision, not an accident. The LESSONS escalation rule stays; it just books its costs.

**R13 — Do not shrink the phases.** The evidence says the gate is a fixed cost per exit and the
endgame dominates *because phases are small*. With R1–R6 the fixed cost drops ~60%; at that
point the current phase size (a room or a subsystem per phase, 1–2.5 h active) is about right.
The one-phase-per-session rule is separately justified (the 188.8k-token endgame is the proof)
and untouched by any of this.

**R14 — Sequence the known collisions before PD starts.** Three are on the calendar: the PD9
sheet needs the P2-walk exemption extended (precedent: the route fade); PD5's TickerChip forces
the movers-chip mark-or-hover decision; PD5/PD9 spend shared-chunk bytes against ~4 KB of /news
headroom (pre-commit to the code-split). Deciding these in the plan text now costs three
sentences; discovering them at an exit costs three loops.

### What this buys, concretely (estimates, stated as such)
Per phase exit: rehearsal (R1) removes the tag-mechanics loop; sharding (R2) roughly halves
every browser-suite attempt; R5 removes ~10–12 minutes per re-baseline; R10 removes 2–4 CI
cycles of docs churn. A 60–90-minute endgame with 2–4 tag round-trips becomes ~20–30 minutes
with, typically, one rehearsal loop and one green tag run. Across the build: the 512 duplicated
minutes (R3), ~116 docs minutes (R4), ~100+ uncached minutes (R6), and most of the 293 red
tag-minutes (R1) come out of the 1,183-minute base — roughly a 40–50% CI reduction — while the
*number of distinct verifications* stays exactly the same.

---

## 6. What must NOT be weakened

Every guard below is load-bearing because it caught something that was green-and-wrong. Speed
must come from placement, parallelism, deduplication, and text hygiene — never from these:

- **The absolute pixel tolerance (`maxDiffPixels: 600`) and `--update-snapshots=all`.** The 1%
  ratio was a 37,742-pixel blind spot that passed a rewritten macro row; `=changed` silently
  kept stale pictures as truth. Do not return to ratios or partial updates.
- **CI-born baselines.** macOS baselines red ~46 shots on rasterization alone; a local-mint
  shortcut would poison the oracle. R5 changes *where the artifact comes from within CI*, never
  the birthplace.
- **The full-suite-on-the-exact-shipped-SHA rule.** Rehearsal (R1) adds an earlier run; it must
  not replace the tag run. One green oracle run on the tagged commit remains non-negotiable
  ("Red CI blocks a phase exit — no exceptions").
- **`check:migrations` and its live-DB-only nature.** It exists because production silently ran
  without N0's migration for days while CI stayed green. CI structurally cannot do this job; the
  local step stays in the ritual (and the false claim that CI ran it gets corrected, §3.6).
- **The fixture-recording rule.** Hand-written fixtures inverted three tests in three phases
  ("a fake must be no kinder than the thing it stands for"). Never relax the
  recorded-fixture-first discipline or the filename convention that enforces it.
- **The honesty stack** — BaseRate as the only base-rate renderer, P2 stillness (no animated
  ancestor over probability/money), the amber/danger consumer registers, one DataTable, copy.ts
  voice, N-gated display, insert-only ledgers. The audit found **zero** internal contradictions
  here; it is the product's identity and it costs the gate almost nothing (grep-speed).
- **The N7 sweep-hardening** — a sweep must prove it measured something, and the body (not the
  status code) is the 404 witness. This closed the guard-that-cannot-fail class at its worst.
- **The `run-name:` request-id line** in nightly-a/b and its guarding test — delete it and the
  control room goes permanently blind while every test but one stays green.
- **The VRT discipline itself**: an unexplained diff is a build failure; an explained one is a
  commit with the reason in the body. R5's auto-artifact must never become auto-commit — a human
  (or the agent, deliberately) still opens the pictures and looks. Nine real bugs in this build
  were found only by looking at the picture.

Where speed is free: everything in R1–R6 and R10–R11 (placement, sharding, dedup, caching,
cancellation, batching, re-runs). Where speed would cost safety: loosening tolerances, shrinking
the shot matrix or the seeded-spec set, skipping the tag run, minting baselines locally,
auto-committing baselines, or letting budget ceilings re-baseline. The 200 KB ceiling in
particular is doing its stated job right now — the correct response to §3.3 is the plan's own
code-split hatch, not a bigger ceiling.

---

## 7. Answers to the five questions, in one breath each

1. **What runs at an exit:** §1 — nine steps; the only expensive one is the tag-triggered CI
   e2e/VRT/PWA/axe job (~15.8 m, 90% of it one serial step), plus a ~6 m mint round trip when
   pixels changed, plus a deploy-wait for check:nav/Lighthouse locally; everything else is
   seconds.
2. **The loops:** §2 — ranked: exit-only oracle placement (52% tag failure rate) > the gate's own
   defects (rot, guards-that-cannot-fail) > VRT churn (your hypothesis — real, third) > docs
   churn on the boundary > pure CI duplication > rare true flakes.
3. **Contradictions:** §3 — six real (stop-vs-roll ×5 texts; oracle-after-done by construction;
   the 200 KB ceiling vs PD9's arithmetic; unwritten global-rules override; four diverged
   duplicate rules; two false facts about CI in gate texts), ten suspects cleared.
4. **Structural inefficiency:** §4 — serial oracle, full-price red runs, everything re-verifying
   everything, monolithic baseline matrix, five hand-kept route lists, a book per endgame.
5. **Phase size:** not the problem — phases are small and the gate is a growing fixed cost;
   smaller phases would grind more. Fix the gate's placement and fixed cost (R1–R6), the texts
   (R7), and the rot classes (R8–R9); keep the boundary and the one-phase-per-session rule.

---

*Written by the diagnostic session of 2026-07-13. Sources: ci.yml and all workflow files; all
nine gate scripts and both test configs; the five plans' gate sections; CLAUDE.md; the seven
skills; LESSONS.md, DECISIONS.md, PATTERNS.md, PROGRESS.md, QUESTIONS-FOR-BISHANT.md; the full
249-commit history; and 344 GitHub Actions runs (job-level timings from runs #295, #296, #297,
#299). This file is intentionally uncommitted — the N7 session owns the tree tonight.*
