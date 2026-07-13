# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

Continue the gate-efficiency build. **G0 is done and tagged `gate-0` (CI green on the tag). Your
session is G1, and G1 only.**

Read `GATE-EFFICIENCY-PLAN.md` at the repo root IN FULL before touching anything — it is the plan
you are executing. Its evidence base is `GATE-EFFICIENCY-ANALYSIS.md` (also repo root); read it too,
at least Parts 0–2 and §6. Do **not** start `POLISH-AND-DEPTH-PLAN.md`; it waits until this plan's
`gate-final` tag is green and Bishan says go. Do not run PD1's Saturday-row SQL — it is theirs.

**Part 1.3 of the plan lists the untouchables.** If any instruction ever seems to conflict with one,
the untouchable wins and the conflict goes to `QUESTIONS-FOR-BISHANT.md`.

## State of the tree

- `main` is clean, `gate-0` is tagged and green, everything is pushed.
- App unit tests: **577 passing**. Pipeline: **464 passing** locally / **490 in CI** (the extra 26
  are Postgres-backed and skip on this Mac).
- Nothing is blocked. Nothing is in flight.

## What G0 already built (so you do not redo or distrust it)

- **A tag runs exactly ONE job — the browser oracle.** `app` and `pipeline` now sit out tag runs and
  dispatch runs. Verified on the `gate-0` tag run: both show as `skipped`.
- **One live run per ref** (`concurrency` + `cancel-in-progress`). A superseded run now dies in ~40
  seconds instead of running to completion (785 s at `nc-final`).
- **`check:drift` runs in CI** (the `app` job). It had run in no CI workflow at all before G0.
- **`gate-*` and `pd-*` are wired** into `on.push.tags` AND the e2e job's `if:`, and
  `pipeline/tests/test_ci_tag_families.py` fails the build if those two ever drift apart.
- **Playwright's Chromium and uv's wheels are cached.**
- `ci.yml`'s header now describes reality (it used to claim a Lighthouse job that has never existed).
- `CLAUDE.md`: "roll straight into the next phase" is annotated as repealed by one-phase-per-session.

Evidence with the measured before/after: `docs/gate-evidence/g0-dedup.md`.

## Your phase: G1 — move the oracle before the tag → tag `gate-1`

Read the plan's G1 section in full. It is the phase that kills the tag→red→fix→re-tag loop. Land it
as **three separately proven commits**:

1. **The rehearsal switch.** Add `e2e` to `ci.yml`'s `workflow_dispatch` input options and extend the
   e2e job's `if:` with `|| (github.event_name == 'workflow_dispatch' && inputs.job == 'e2e')`.
   **THE TRAP: GitHub validates dispatch inputs against the workflow file ON THE TARGET REF.** The
   commit must be pushed to `main` BEFORE `gh workflow run ci.yml -f job=e2e` will accept the new
   value — otherwise you get a 422. Push first, then dispatch, then prove the full oracle runs green
   on main's HEAD with app/pipeline correctly sitting it out.

2. **Shard the oracle.** Convert the e2e job to a matrix
   (`strategy: { fail-fast: false, matrix: { project: [desktop, phone, wide] } }`), each leg with its
   own Postgres service, migrate+seed, and `npm run e2e -- --project=${{ matrix.project }}`. The
   `workers: 1` rule exists because seeded writes share one database; three databases dissolve that
   without touching the serial-within-a-leg guarantee. **`playwright.config.ts` is NOT edited.** Name
   failure artifacts per leg. Expect ~15.8 m → ~7–9 m. **Fallback:** if a leg flakes on seeding twice
   in a row, revert this commit, keep commit 1 (the rehearsal alone is most of the win), log it.

3. **Auto-mint on pixel failure.** After the test step, a step `if: failure()` that first checks
   whether a snapshot comparison actually failed (`test-results/**/*-actual.png` exists — that file
   is the precise witness of a pixel diff); only then re-runs
   `npx playwright test vrt.spec.ts --project=<leg> --update-snapshots=all` and uploads the leg's
   snapshots as `vrt-baselines-candidate-<leg>`. A red *assertion* must not spend four minutes
   photographing. **THE ARTIFACT IS A CANDIDATE AND IS NEVER AUTO-COMMITTED.** You download it, you
   open every image, and you commit only an explained diff with the reason in the body. An
   unexplained diff is a bug — go look at the triptych. Nine real bugs in this build were found by
   opening the picture. Update `.claude/skills/vrt-update/SKILL.md` with the new flow; verify the
   `gh run download` flags against `gh` help before writing them into the skill.
   Prove it can fail honestly: on a **scratch branch**, make a deliberate one-line visual change,
   `gh workflow run ci.yml -f job=e2e --ref <branch>`, confirm the leg reds on pixels and the
   candidate artifact shows exactly that nudge. Then delete the branch. Nothing merges.

## The exit ritual (GATE-EFFICIENCY-PLAN Part 3 — G1 is its first real outing)

Local gate: `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
`check:bundles` + `check:fonts` · `e2e:local` · `check:drift`. Then push and confirm the branch run
green. Then **REHEARSE** — `gh workflow run ci.yml -f job=e2e` — the full oracle on the candidate
SHA, which from this phase onward is the machinery you just built. In parallel: wait for the Vercel
deploy, then `check:nav` and `check:lighthouse` (needs `export CHROME_PATH="/Applications/Google
Chrome.app/Contents/MacOS/Google Chrome"` and the root `.env` sourced for `AUTH_COOKIE_SECRET`).
Once per phase: `npm run check:migrations` (local — CI structurally cannot answer it).

Rehearsal green → `git tag gate-1` → push → confirm the tag run green. **THE TAG STAYS PUT.** A
suspected flake gets `gh run rerun <id> --failed`, never a re-point. Intelligence files + evidence
(`docs/gate-evidence/g1-oracle.md`) + this prompt land as **ONE** docs commit *after* the tag.

Every evidence file ends with the **gate-size line**. At `gate-0` it was: **20 drift rules · 76 VRT
baselines · 22 e2e specs · tag run 15.9 m.** Book any growth of the gate with a reason.

Note for G1's evidence: `gate-1` is the first tag expected to go **green on the first try**, because
the rehearsal will have already run the identical suite on the identical SHA. If it does, say so. If
it does not, say why — that is the more interesting result and it belongs in the record.

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish G1, tag it, bring every intelligence file current as ONE commit,
rewrite this file for G2, **report to Bishan in plain English, and STOP.** Do not roll into G2. Do
not start "just the first commit" of it. Within the phase the Autonomy Contract holds in full: never
ask, never wait — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most
reasonable assumption made and marked.

Run the CLAUDE.md session ritual first (git pull, read the constitution + PROGRESS.md tail + LESSONS,
`npm test` from `app/` and `uv run pytest` from `pipeline/`, announce the checkpoint), then begin G1.
