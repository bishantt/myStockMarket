# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

Continue the gate-efficiency build. **G2 is done and tagged `gate-2` (CI green on the tag, first
try). Your session is G3, and G3 only.**

Read `GATE-EFFICIENCY-PLAN.md` at the repo root IN FULL before touching anything — it is the plan you
are executing. Its evidence base is `GATE-EFFICIENCY-ANALYSIS.md` (also repo root); read at least
Parts 0–2 and §6. Do **not** start `POLISH-AND-DEPTH-PLAN.md`; it waits until this plan's
`gate-final` tag is green and Bishan says go. Do not run PD1's Saturday-row SQL — it is theirs.

**Part 1.3 of the plan lists the untouchables.** If any instruction ever seems to conflict with one,
the untouchable wins and the conflict goes to `QUESTIONS-FOR-BISHANT.md`. G2 had to invoke that rule
once — see Q-G2-1 below.

## State of the tree

- `main` is clean, `gate-2` is tagged and green, everything is pushed.
- App unit tests: **577 passing**. Pipeline: **464 passing** locally / **490 in CI** (the extra 26
  are Postgres-backed and skip on this Mac).
- Nothing is blocked. Nothing is in flight.

## What G0, G1 and G2 already built (so you do not redo or distrust it)

**From G0:**
- **A tag runs exactly ONE job — the browser oracle.** `app` and `pipeline` sit out tag runs and
  dispatch runs. Verified on the `gate-0`, `gate-1` and `gate-2` tag runs: they show as `skipped`.
- **`check:drift` runs in CI** (the `app` job). It had run in no CI workflow at all before G0.
- **`gate-*` and `pd-*` are wired** into `on.push.tags` AND the e2e job's `if:`, and
  `pipeline/tests/test_ci_tag_families.py` fails the build if those two ever drift apart.

**From G1** (evidence: `docs/gate-evidence/g1-oracle.md`):
- **THE REHEARSAL IS LIVE: `gh workflow run ci.yml -f job=e2e`.** It runs the full browser oracle on
  any ref, with no tag involved (`--ref <branch>` for a scratch branch). It is **the same job** the
  tags run — one `if:`, two doors — so a green rehearsal is not evidence *about* the tag run, it is
  the same evidence. **This is the machinery you use at your own exit.**
- **The oracle is SHARDED** into three legs (`desktop`, `phone`, `wide`), one Postgres each.
  **15 m 26 s → ~8 m.** `playwright.config.ts` was NOT edited and `workers: 1` is intact.
- **A run that reds on PIXELS mints its own candidate baselines** (`vrt-baselines-candidate-<leg>`),
  guarded so a red *assertion* does not spend four minutes photographing. **Never auto-committed.**
- **`ci.yml`'s concurrency group is `ci-<ref>-<event_name>`.** The `event_name` is load-bearing: a
  rehearsal on main shares main's ref, and push and rehearsal must be able to overlap.

**From G2** (full evidence, with every run id: `docs/gate-evidence/g2-docs-cost.md`):
- **DOCUMENTATION IS FREE.** `on.push` carries `paths-ignore: ['**/*.md', 'docs/**', '.claude/**']`.
  A prose-only commit starts **no CI run at all**. **A mixed commit (docs + code) still runs in full.**
- **PROVEN LIVE: GitHub does NOT apply path filters to TAG pushes.** This was the phase's whole
  danger — phase tags here deliberately land on docs-only commits. `gate-2` sits on `8034a7a`, whose
  only file is one markdown document, and its push ran the **full three-leg oracle green in 7 m 59 s**
  (run 29297042789). **The `[skip ci]` fallback was not needed and is not adopted.**
- **`workflow_dispatch` ignores path filters too** — so the rehearsal still runs on exactly the
  docs-only commits a tag lands on. Had that not held, G2 would have silently disarmed G1.
- **The nightly heartbeat (an EMPTY commit) no longer fires CI** — and still works, because what keeps
  the cron alive is a *push*, not a run.
- **Your closing docs commit is therefore free.** No reason to squeeze the intelligence files in
  before the tag, and **no reason ever to re-point a green tag onto trailing prose.**
- **The safety check that is not in the diff:** nothing in the gate *reads* those paths. The workflow
  files are deliberately NOT ignored, because that is what the two CI-guard pytest tests read. **If you
  ever write a guard that reads a document, put its path back in the trigger first — otherwise it
  breaks silently.**

**`gate-2` went green on the first try, in 7 m 59 s, and the tag never moved** — as `gate-1` did.
That is the reform working. Expect the same; if you do not get it, that is the more interesting result
and it belongs in your evidence file.

## Four traps G0–G2 paid for — do not re-learn them

1. **`workflow_dispatch` inputs are validated against the workflow file ON THE TARGET REF.** A new
   input value must be pushed to the ref *before* you can dispatch it, or you get a 422.
2. **`main` moves under you.** `nightly-a.yml` pushes an empty `chore: heartbeat` commit after each
   full nightly. It landed mid-endgame during G1 and rejected a push. It no longer triggers CI, but
   that was never the hazard. **Tag the SHA you rehearsed, BY SHA — never `HEAD`.**
3. **`--update-snapshots=all` hands back EVERY shot, not the shots that moved.** A one-line change
   failed 2 shots but produced 6 byte-different files. **The triptych is the list of what moved; the
   candidate is only where you fetch those files from.** Read `.claude/skills/vrt-update/SKILL.md`.
4. **`locator.all()` does NOT auto-wait** (G2 paid for this one). It returns whatever is in the DOM at
   that instant, so enumerating a streamed or client-rendered list can hand back an empty array — the
   loop then sweeps nothing and the test reports a *finding* of zero, blaming the product for the
   instrument's mistake. **This matters directly to you: G3 rewrites the specs that walk route
   lists.** Wait for the thing, then assert you have something to sweep. It was the only `.all()` in
   the suite; do not add the second one.

## Your phase: G3 — one list of rooms, and defuse the clocks → tag `gate-3`

Read the plan's G3 section in full. This is the **only phase that edits specs and scripts**, it is
**full TDD**, and it is bigger than G2. Its crown is a guard that makes rot-by-omission mechanically
impossible.

1. **The routes manifest.** New `app/lib/routes-manifest.json` — one entry per product route: `path`,
   `seeded` (needs the synthetic morning), `sweeps` (touch/scroll/axe), `wide` (gets the wide
   viewport), `navBudget` (`gated` | `pending`), `vrtRoom` (null, or the room slug vrt.spec.ts uses).
   JSON so `.mjs` scripts, TS specs and vitest all read it without ceremony. Dynamic families appear
   once with their canonical seeded instance (`/news/nc-fed-hold`, `/scans/unusual-volume`,
   `/ticker/AAPL`) — the convention the specs already use.

2. **Wire the five hand-kept consumers to it — list-wiring only, ZERO behavior change:**
   `a11y.spec.ts` ROUTES · `hardening.spec.ts` ROUTES/SEEDED_ROUTES · `vrt.spec.ts` SEEDED_ROOMS keys
   (per-room shot quirks stay in the spec, keyed by `vrtRoom`) · `check-nav.mjs` PRODUCT_ROUTES/PENDING
   · `check-bundles.mjs` (baseline VALUES stay in the script; add a consistency assert that every
   baseline key is a manifest path and vice versa for gated routes).

3. **The completeness guard (TDD — this is the crown).** A vitest test that walks `app/app/**/page.tsx`,
   derives the route paths, and asserts every product route appears in the manifest, with an argued
   in-file exemption list (`/login`, `/styleguide`, api/, the 404 frame — one comment line of why
   each). **Write it RED first** by deleting `/news` from a scratch copy — prove the guard can fail —
   then green. **This is exactly how `/news` shipped in N5 and went unmeasured for two tagged phases.**
   A new `page.tsx` with no manifest entry becomes a red unit test at the next `npm test`, not a silent
   hole found two phases later.

4. **Drift rule 21 — the fuse-finder.** In `check-drift.mjs`, house pattern (argued allowlist in-file):
   **no absolute date literals** (`/20\d\d-\d\d-\d\d/`) in `app/prisma/seed.mjs` or `app/e2e/*.spec.ts`
   outside the sanctioned constants (`SEEDED_EVENING`, vrt.spec.ts's pinned clock, and any manifest
   canonical instances that encode dates — argue each). One-line rationale in the rule: *"an absolute
   fixture under a relative rule has a fuse on it — /paper's baseline expired 28 minutes after the run
   that certified it."* Recorded fixtures are out of scope by construction. **Prove rule 21 RED first**
   against a scratch absolute date, then green.
   (A rule 22 for time-of-day-dependent assertions was considered and is NOT mechanizable without
   false positives — instead add one line to the `new-lesson` skill's checklist: *"does this assertion
   hold at 3am and 3pm, Saturday included?"* Log the judgment in DECISIONS.)

5. **Update `.claude/skills/new-surface/SKILL.md`:** the N7-era line "did you ADD THE ROUTE TO THE
   SWEEPS (hard-coded lists)" becomes "add the route to `app/lib/routes-manifest.json` — the sweeps,
   nav budget and completeness test all read it; the unit test will red if you forget," keeping N7's
   `SEEDED_ROUTES`-vs-`ROUTES` seeded-data warning verbatim.

**Prove it:** `npm test` (completeness + rule-21 tests green, and **their RED states were witnessed
and are quoted in the evidence file**) · full local gate · **rehearse** (`job=e2e`) — the sweeps and
VRT must behave **byte-identically**: same routes swept, same 76 baselines compared, zero pixel diffs.
**The rehearsal IS the no-behavior-change proof.**

## The exit ritual (GATE-EFFICIENCY-PLAN Part 3 — all its machinery now exists)

Local gate: `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
`check:bundles` + `check:fonts` · `e2e:local` · `check:drift`. Then push and confirm the branch run
green. Then **REHEARSE** — `gh workflow run ci.yml -f job=e2e` — the full oracle on the candidate SHA.
In parallel: wait for the Vercel deploy, then `check:nav` and `check:lighthouse` (needs
`export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and the root
`.env` sourced for `AUTH_COOKIE_SECRET`). Once per phase: `npm run check:migrations` (local — CI
structurally cannot answer it).

Rehearsal green → **`git tag gate-3 <the rehearsed SHA>`** → push → confirm the tag run green.
**THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed`, never a re-point — **but
read the failure first: G2's "flake" was a real race that had failed its retry too.**
Intelligence files + evidence (`docs/gate-evidence/g3-manifest.md`) + this prompt land as **ONE**
docs commit *after* the tag. That commit is free now — it starts no CI run.

Every evidence file ends with the **gate-size line**. At `gate-2` it was: **20 drift rules · 76 VRT
baselines · 22 e2e specs · tag run 7 m 59 s.** **G3 will grow it** — drift rule 21 and the completeness
test are both new. That is expected and correct; **book the growth with its reason.**

## Known-and-fine, so you do not chase them

- **A Node-version trap on this Mac.** Claude Code runs on **Node 20** and exports its own bin
  directory into every shell it spawns, which shadows the repo's Node 24. `check:fonts` then dies with
  `SyntaxError: ... does not provide an export named 'globSync'` — that is **not** a regression, and
  everything else silently runs on the wrong runtime. Prepend Node 24 in every shell:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (LESSONS.md, 2026-07-10).
- **`check:nav` reports `/settings` at ~430–510 ms, every sample a cache `MISS`.** Correct, not a
  regression: it is the app's one *writer* room and is `force-dynamic` by design. It carries an argued
  exemption in `check-routes.mjs`, and B2 is in report mode for exactly this reason. Every cached room
  answers in 46–74 ms.
- **Lighthouse: performance 87, LCP 3.89 s.** Advisory only, synthetic-4G, logged in DECISIONS. The
  two **hard** gates pass: CLS 0.000 and first-load JS 177 KB (≤ 200 KB).
- **`QUESTIONS-FOR-BISHANT.md` has two new items from G2.** **Q-G2-1 [VETO?]:** G2 edited
  `news.spec.ts` — a scope deviation the plan reserved for G3 — because the rehearsal went red and
  "Red CI blocks a phase exit" is an untouchable. **Q-G2-2 [FYI]:** the nightly heartbeat no longer
  fires CI. Neither blocks you.

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish G3, tag it, bring every intelligence file current as ONE commit,
rewrite this file for G4, **report to Bishan in plain English, and STOP.** Do not roll into G4. Do
not start "just the first commit" of it. Within the phase the Autonomy Contract holds in full: never
ask, never wait — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most
reasonable assumption made and marked.

Run the CLAUDE.md session ritual first (git pull, read the constitution + PROGRESS.md tail + LESSONS,
`npm test` from `app/` and `uv run pytest` from `pipeline/`, announce the checkpoint), then begin G3.
