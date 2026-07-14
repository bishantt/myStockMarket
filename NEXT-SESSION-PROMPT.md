# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

Continue the gate-efficiency build. **G1 is done and tagged `gate-1` (CI green on the tag, first
try). Your session is G2, and G2 only.**

Read `GATE-EFFICIENCY-PLAN.md` at the repo root IN FULL before touching anything — it is the plan you
are executing. Its evidence base is `GATE-EFFICIENCY-ANALYSIS.md` (also repo root); read at least
Parts 0–2 and §6. Do **not** start `POLISH-AND-DEPTH-PLAN.md`; it waits until this plan's
`gate-final` tag is green and Bishan says go. Do not run PD1's Saturday-row SQL — it is theirs.

**Part 1.3 of the plan lists the untouchables.** If any instruction ever seems to conflict with one,
the untouchable wins and the conflict goes to `QUESTIONS-FOR-BISHANT.md`.

## State of the tree

- `main` is clean, `gate-1` is tagged and green, everything is pushed.
- App unit tests: **577 passing**. Pipeline: **464 passing** locally / **490 in CI** (the extra 26
  are Postgres-backed and skip on this Mac).
- Nothing is blocked. Nothing is in flight.

## What G0 and G1 already built (so you do not redo or distrust it)

**From G0:**
- **A tag runs exactly ONE job — the browser oracle.** `app` and `pipeline` sit out tag runs and
  dispatch runs. Verified on both the `gate-0` and `gate-1` tag runs: they show as `skipped`.
- **`check:drift` runs in CI** (the `app` job). It had run in no CI workflow at all before G0.
- **`gate-*` and `pd-*` are wired** into `on.push.tags` AND the e2e job's `if:`, and
  `pipeline/tests/test_ci_tag_families.py` fails the build if those two ever drift apart.
- Playwright's Chromium and uv's wheels are cached.

**From G1** (full evidence, with every run id: `docs/gate-evidence/g1-oracle.md`):
- **THE REHEARSAL IS LIVE: `gh workflow run ci.yml -f job=e2e`.** It runs the full browser oracle on
  any ref, with no tag involved (`--ref <branch>` for a scratch branch). It is **the same job** the
  tags run — one `if:`, two doors — so a green rehearsal is not evidence *about* the tag run, it is
  the same evidence. **This is the machinery you now use at your own exit.**
- **The oracle is SHARDED** into three legs (`desktop`, `phone`, `wide`), one Postgres each.
  **15 m 26 s → 7 m 58 s.** `playwright.config.ts` was NOT edited and `workers: 1` is intact — three
  legs are three databases, so the shared-state premise for serial execution is gone, not the rule.
- **A run that reds on PIXELS mints its own candidate baselines** (`vrt-baselines-candidate-<leg>`),
  guarded so a red *assertion* does not spend four minutes photographing. **Candidates are never
  auto-committed.**
- **`ci.yml`'s concurrency group is `ci-<ref>-<event_name>`.** The `event_name` is load-bearing: a
  rehearsal on main shares main's ref, and on its first outing it *cancelled the push run it was
  rehearsing*. Push and rehearsal must overlap; they now do.

**`gate-1` went green on the first try, in 7 m 58 s, and the tag never moved.** That is the reform
working. Expect the same from your tag — and if you do not get it, that is the more interesting
result and it belongs in your evidence file.

## Three traps G1 paid for — do not re-learn them

1. **`workflow_dispatch` inputs are validated against the workflow file ON THE TARGET REF.** A new
   input value must be pushed to the ref *before* you can dispatch it, or you get a 422.
2. **`main` moves under you.** `nightly-a.yml` pushes an **empty** `chore: heartbeat` commit after
   each full nightly run (it stops GitHub disabling the cron after 60 idle days). It landed
   mid-endgame during G1 and rejected a push. **Tag the SHA you rehearsed, BY SHA — never `HEAD`.**
3. **`--update-snapshots=all` hands back EVERY shot, not the shots that moved.** Measured: a
   one-line change failed 2 shots but produced 6 byte-different files — the extras are sub-tolerance
   re-photographs. **The triptych is the list of what moved; the candidate is only where you fetch
   those files from.** Read `.claude/skills/vrt-update/SKILL.md`.

## Your phase: G2 — make documentation free → tag `gate-2`

Read the plan's G2 section in full. A small phase **by design**: its danger is one specific edge, so
the phase *is* the proof.

Add to `ci.yml`'s `on.push`:
`paths-ignore: ['**/*.md', 'docs/**', '.claude/**']`. Intent: docs / intelligence / skill commits
stop triggering app+pipeline entirely (58 of 249 commits are docs-only, each paying full CI price).

**THE DANGEROUS EDGE.** If GitHub evaluated path filters for TAG pushes too, a phase tag landing on a
docs-heavy commit would silently skip the pixel oracle — the exact "gate that silently never runs"
disease this repo keeps catching. GitHub's documented behavior is that path filters are **ignored**
for tag pushes. **But the vendor's own documentation is not a recording** — and G1 just re-earned
that lesson the hard way, live, against GitHub itself. **Prove it on this repo before trusting it.**

**The proof, in order:**
a. Push the ci.yml commit (it touches a `.yml`, so it runs normally — confirm green).
b. Push a genuinely docs-only commit (start `docs/gate-evidence/g2-docs-cost.md`). Assert **no CI run
   was created for it** (`gh run list` — the *absence* is the pass).
c. Run the exit ritual through the rehearsal, then tag `gate-2` **on that docs-only commit** and push
   the tag. Assert the oracle **did** run on the tag and is green. That single run proves the edge:
   branch pushes filtered, tag pushes not.
d. **If (c) fails to trigger:** the filter is unsafe for this repo's ritual. `git revert` the
   paths-ignore commit (**never rewrite history**), tag `gate-2` on the revert, and adopt the
   fallback: docs-only commits carry `[skip ci]`, with the bright line — **never `[skip ci]` a commit
   a tag will sit on.** Record which world we live in. Both are acceptable; one is cleaner.

**Free evidence, sitting in the same experiment:** the heartbeat commit is **empty** — it changes no
paths at all. Whether `paths-ignore` skips it, runs it, or does something else entirely is not
documented anywhere worth trusting. Look, and write down what you see.

Also codify the docs-batching practice already running since G0: one intelligence commit per phase,
and no post-tag "CI confirmed green" commits — the tag run's green **is** the record, referenced by
run-id in the evidence file. (The text lands in CLAUDE.md at G4; from now it is simply how this plan
behaves.)

## The exit ritual (GATE-EFFICIENCY-PLAN Part 3 — you now have all of its machinery)

Local gate: `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
`check:bundles` + `check:fonts` · `e2e:local` · `check:drift`. Then push and confirm the branch run
green. Then **REHEARSE** — `gh workflow run ci.yml -f job=e2e` — the full oracle on the candidate SHA.
In parallel: wait for the Vercel deploy, then `check:nav` and `check:lighthouse` (needs
`export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and the root
`.env` sourced for `AUTH_COOKIE_SECRET`). Once per phase: `npm run check:migrations` (local — CI
structurally cannot answer it).

Rehearsal green → **`git tag gate-2 <the rehearsed SHA>`** → push → confirm the tag run green.
**THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed`, never a re-point.
Intelligence files + evidence (`docs/gate-evidence/g2-docs-cost.md`) + this prompt land as **ONE**
docs commit *after* the tag.

Note the pleasing recursion: at G2 that docs commit is *itself* the thing under test.

Every evidence file ends with the **gate-size line**. At `gate-1` it was: **20 drift rules · 76 VRT
baselines · 22 e2e specs · tag run 7 m 58 s.** Book any growth of the gate with a reason.

## Known-and-fine, so you do not chase them

- **`check:nav` reports `/settings` at ~432 ms, every sample a cache `MISS`.** Correct, not a
  regression: it is the app's one *writer* room and is `force-dynamic` by design (a page may be
  cached, or written to and read back in one click — never both). It carries an argued exemption in
  `check-routes.mjs`, and B2 is in report mode for exactly this reason. Every cached room answers in
  41–113 ms.
- **Lighthouse: performance 77, LCP 5.03 s.** Advisory only, synthetic-4G, already logged in
  DECISIONS. The two **hard** gates pass: CLS 0.000 and first-load JS 177 KB (≤ 200 KB).
- **`QUESTIONS-FOR-BISHANT.md` has one new FYI (Q-G1-1)**: sharding buys wall-clock with billed
  minutes (−46% waiting, +26% billed). No action needed; the reversal is one commit if he disagrees.

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish G2, tag it, bring every intelligence file current as ONE commit,
rewrite this file for G3, **report to Bishan in plain English, and STOP.** Do not roll into G3. Do
not start "just the first commit" of it. Within the phase the Autonomy Contract holds in full: never
ask, never wait — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most
reasonable assumption made and marked.

Run the CLAUDE.md session ritual first (git pull, read the constitution + PROGRESS.md tail + LESSONS,
`npm test` from `app/` and `uv run pytest` from `pipeline/`, announce the checkpoint), then begin G2.
