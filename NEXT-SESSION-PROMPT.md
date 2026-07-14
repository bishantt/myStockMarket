# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

Continue the gate-efficiency build. **G3 is done and tagged `gate-3` (CI green on the tag, first
try). Your session is G4, and G4 only. G4 is the LAST phase of this plan.**

Read `GATE-EFFICIENCY-PLAN.md` at the repo root IN FULL before touching anything — it is the plan you
are executing, and **your phase is the one with an exact checklist: Appendix A, 22 rows.** Its evidence
base is `GATE-EFFICIENCY-ANALYSIS.md` (also repo root); read at least Parts 0–2, §3 and §6 — **§3 is
the list of text defects you are repairing**, so it is not optional background this time, it is the
work order. Do **not** start `POLISH-AND-DEPTH-PLAN.md`; it waits until `gate-final` is green and
Bishan says go. Do not run PD1's Saturday-row SQL — it is theirs.

**Part 1.3 of the plan lists the untouchables.** If any instruction ever seems to conflict with one,
the untouchable wins and the conflict goes to `QUESTIONS-FOR-BISHANT.md`. G2 and G3 both had to invoke
that rule; see the questions at the bottom.

## State of the tree

- `main` is clean, `gate-3` is tagged and green, everything is pushed.
- App unit tests: **586 passing** (was 577 — G3 added 3 manifest + 6 clock tests).
- Pipeline: **464 passing** locally / **490 in CI** (the extra 26 are Postgres-backed and skip on this Mac).
- Anti-drift: **21 rules** (was 20 — G3 added rule 21).
- Nothing is blocked. Nothing is in flight.

## What G0–G3 already built (so you do not redo or distrust it)

**From G0:**
- **A tag runs exactly ONE job — the browser oracle.** `app` and `pipeline` sit out tag runs and
  dispatch runs. Verified on `gate-0` … `gate-3`: they show as `skipped`.
- **`check:drift` runs in CI** (the `app` job). It ran in no CI workflow at all before G0.
- **`gate-*` and `pd-*` are wired** into `on.push.tags` AND the e2e job's `if:`, and
  `pipeline/tests/test_ci_tag_families.py` fails the build if those two ever drift apart.

**From G1** (evidence: `docs/gate-evidence/g1-oracle.md`):
- **THE REHEARSAL IS LIVE: `gh workflow run ci.yml -f job=e2e`.** The full browser oracle on any ref,
  no tag involved (`--ref <branch>` for a scratch branch). It is **the same job** the tags run — one
  `if:`, two doors — so a green rehearsal is not evidence *about* the tag run, it is the same evidence.
  **This is the machinery you use at your own exit.**
- **The oracle is SHARDED** into three legs (`desktop`, `phone`, `wide`), one Postgres each. ~8 m.
- **A run that reds on PIXELS mints its own candidate baselines** (`vrt-baselines-candidate-<leg>`).
  **Never auto-committed.** Read `.claude/skills/vrt-update/SKILL.md` before you touch a baseline.
- **`ci.yml`'s concurrency group is `ci-<ref>-<event_name>`.** The `event_name` is load-bearing: push
  and rehearsal share a ref and must be able to overlap. (They do — G3 ran both at once, deliberately.)

**From G2** (evidence: `docs/gate-evidence/g2-docs-cost.md`):
- **DOCUMENTATION IS FREE.** `on.push` carries `paths-ignore: ['**/*.md', 'docs/**', '.claude/**']`.
  A prose-only commit starts **no CI run at all**. **A mixed commit (docs + code) still runs in full.**
- **PROVEN LIVE: GitHub does NOT apply path filters to TAG pushes.** Phase tags here deliberately land
  on docs-only commits, and the oracle still runs on them. `workflow_dispatch` ignores them too, so the
  rehearsal survives on exactly those commits.
- **Your closing docs commit is therefore free.** No reason to squeeze the intelligence files in before
  the tag, and **no reason ever to re-point a green tag onto trailing prose.**
- **THE TRAP THIS SETS FOR YOU, AND IT IS AIMED AT G4 SPECIFICALLY:** nothing in the gate currently
  *reads* those ignored paths, which is the only reason the filter is safe. **G4 edits documents for a
  living.** If you write a guard that reads a document — and the `grep -rn "roll straight"` proof in
  your own exit criteria is exactly that shape — **put its path back in the trigger FIRST**, or the
  guard breaks silently.

**From G3** (evidence: `docs/gate-evidence/g3-manifest.md`):
- **THERE IS ONE LIST OF ROOMS: `app/lib/routes-manifest.json`.** 14 rooms, each with `path`, `family`,
  `seeded`, `sweeps`, `navBudget`, `vrtRoom` and a `note` that defends it. All five formerly hand-kept
  lists derive from it (`a11y`, `hardening`, `vrt`, `check-nav`, `check-bundles`). `app/lib/routes.ts`
  is the typed door for TypeScript.
- **`app/lib/routes-manifest.test.ts` makes rot-by-omission mechanically impossible.** It walks
  `app/app/**/page.tsx` and reds if the filesystem and the manifest disagree in **either** direction.
  **A new `page.tsx` with no manifest entry is a red `npm test`.** If you add a room, add it there.
- **DRIFT RULE 21 — THE FUSE-FINDER.** No absolute date literal in `prisma/seed.mjs`,
  `prisma/fixtures/*.mjs` or `e2e/**/*.ts` outside **two anchors**: `app/prisma/fixtures/clock.mjs`
  (the seeded world) and `app/e2e/seeded-clock.ts` (the browser suite). There were 30; there are 2.
  **This will bite you if you write a date into a spec.** Derive from the anchor.
- **It found a real hole:** `/scans/[preset]` — the app's one `DataTable` — shipped in F3 and had
  **never had a bundle baseline**, because `BASELINE_KB[route]` was `undefined` and the verdict column
  printed an empty string. Not a failure — **a silence**. Baselined at 153.6 KB.

## Five traps G0–G3 paid for — do not re-learn them

1. **`workflow_dispatch` inputs are validated against the workflow file ON THE TARGET REF.** A new
   input value must be pushed to the ref *before* you can dispatch it, or you get a 422.
2. **`main` moves under you.** `nightly-a.yml` pushes an empty `chore: heartbeat` commit after each
   full nightly. It no longer triggers CI, but that was never the hazard. **Tag the SHA you rehearsed,
   BY SHA — never `HEAD`.**
3. **`--update-snapshots=all` hands back EVERY shot, not the shots that moved.** The triptych
   (`playwright-failures-<leg>`) is the list of what moved; the candidate is only where you fetch the
   files from. Read `.claude/skills/vrt-update/SKILL.md`.
4. **`locator.all()` does NOT auto-wait.** It was the only one in the suite; do not add the second.
5. **A silence in a gate is indistinguishable from a pass** (G3's finding). A lookup that returns
   `undefined` and prints an empty verdict column is not "no opinion" — it is a room nobody is judging.

## Your phase: G4 — repair the texts, install the ritual → tag `gate-final`

Read the plan's G4 section AND Appendix A in full. **Appendix A is a 22-row table and it is the work
order.** Mostly documentation — but it is the phase that makes the whole reform *survivable across
sessions*, which is why it runs last, after every mechanism it describes has been proven.

**The tree wins on the detail: verify every file:line in Appendix A before editing.** Those lines were
read on 2026-07-13 before this plan started, and G0–G3 have moved things since. If a cited line moved,
**find the clause — do not skip the fix.**

1. **The five "roll straight on" clauses** (the four plan copies; CLAUDE.md's was annotated at G0):
   one dated annotation each — superseded 2026-07-13 by one-phase-per-session.
2. **CLAUDE.md:** point the Phase-exit line at *the current plan's standing gate* (§6.4 is historical);
   add the one-sentence global-rules override; add the **Endgame practice** block (Part 3's ritual:
   rehearse first · the tag stays put · flake → `gh run rerun --failed`, never a re-point · one docs
   commit per phase · the gate-size line in every evidence file · G2's docs-CI policy).
3. **DEVELOPMENT-PLAN §6.4 correction block — VIA THE GENERATED-SOURCE PIPELINE ONLY.** Edit
   `docs/src/dp-0N.html`, then run `build-plan-md.py` AND `build-plan-pdf.py`, and commit sources +
   both outputs together. **Never edit `DEVELOPMENT-PLAN.md` directly — it says so in its own first
   line, and N7 still did it once. Do not be the second.**
4. **The diverged duplicates:** the amber-consumer count in UI-REDESIGN-PLAN (×2) and
   `new-surface`/SKILL.md — all three point at `check-drift.mjs`'s `ALERT_ALLOWED` as *the register*;
   the §3.10-v2 note ("mechanized as check-drift.mjs's **21** rules; the script is the truth" — note
   the count changed at G3); the font drop-order comment in `check-font-budget.mjs`;
   `base-rate-display`'s "Plex Mono" → the mono numeral stack.
5. **POLISH-AND-DEPTH-PLAN amendments (a)–(g)**, dated and `[claude]`-marked, including **(f) insert
   the Part-3 ritual into PD's standing-gate block** so PD inherits the reformed exit from its first
   phase, and **(g) regenerate the PD PDF** from `docs/src/polish-and-depth-plan.html`.
6. **DECISIONS.md** — one entry per amendment class. **QUESTIONS-FOR-BISHANT.md** — the PD5 movers-chip
   assumption, and anything else marked along the way.

**Prove it:** `grep -rn "roll straight"` returns only annotated instances · `grep -rn "two consumers"`
returns only register-pointers · the DEV-plan regen is clean (`git diff` shows sources and both outputs
moving together) · full local gate · **rehearse** → green.

## The exit ritual (GATE-EFFICIENCY-PLAN Part 3 — every piece of it now exists and is proven)

Local gate: `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` + `check:bundles`
+ `check:fonts` · `e2e:local` · `check:drift`. Then push and confirm the branch run green. Then
**REHEARSE** — `gh workflow run ci.yml -f job=e2e` — the full oracle on the candidate SHA. **Push and
rehearsal can overlap; G3 ran them together on purpose and it works.** In parallel: wait for the Vercel
deploy, then `check:nav` and `check:lighthouse` (needs
`export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and the root `.env`
sourced for `AUTH_COOKIE_SECRET`). Once per phase: `npm run check:migrations` (local — CI structurally
cannot answer it).

Rehearsal green → **`git tag gate-final <the rehearsed SHA>`** → push → confirm the tag run green.
**THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed`, never a re-point — **but
read the failure first: G2's "flake" was a real race that had failed its retry too.**
Intelligence files + evidence (`docs/gate-evidence/g4-texts.md`) + this prompt land as **ONE** docs
commit *after* the tag. That commit is free — it starts no CI run.

**Your evidence file must fill in Appendix B — the closing measurement table — with REAL numbers.**
That is the whole plan's report card, and it is your phase's job. The "before" column is in the
analysis; the "after" column comes from the run ids in `docs/gate-evidence/g0`–`g3`.

Every evidence file ends with the **gate-size line**. At `gate-3` it was: **21 drift rules · 76 VRT
baselines · 22 e2e specs · 586 unit tests · 16 bundle baselines · 14 manifest rooms · tag run
8 m 43 s.** If G4 grows it, **book the growth with its reason** (G4 is a docs phase, so it probably
should not grow at all).

## Known-and-fine, so you do not chase them

- **A Node-version trap on this Mac.** Claude Code runs on **Node 20** and exports its own bin
  directory into every shell it spawns, shadowing the repo's Node 24. `check:fonts` then dies with
  `SyntaxError: ... does not provide an export named 'globSync'` — **not** a regression. Prepend Node 24
  in every shell: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`check:nav` reports `/settings` at ~430–510 ms, every sample a cache `MISS`.** Correct, not a
  regression: it is the app's one *writer* room and is `force-dynamic` by design, with an argued
  exemption in `check-routes.mjs`. B2 is in report mode for exactly this reason. Every cached room
  answers in 47–141 ms.
- **Lighthouse: performance 85, LCP 4.15 s.** Advisory only, synthetic-4G, logged in DECISIONS. The two
  **hard** gates pass: CLS 0.000 and first-load JS 177 KB (≤ 200 KB). Accessibility 100.

## Six questions are waiting for Bishan — none of them blocks you

- **Q-G2-1 [VETO?]** G2 edited `news.spec.ts` (a scope deviation) because the rehearsal went red and
  "Red CI blocks a phase exit" is an untouchable.
- **Q-G2-2 [FYI]** the nightly heartbeat no longer fires CI.
- **Q-G3-1 [FYI]** the manifest has **no per-route `wide` flag**, though the plan asked for one —
  nothing in the codebase scopes the wide viewport by route, so the field would have had no consumer.
- **Q-G3-2 [WORTH HIS EYES]** an Academy lesson (`/academy/[slug]`) is **neither swept nor
  pixel-locked**. The manifest made the gap visible; closing it in G3 would have destroyed G3's own
  no-behavior-change proof. **It is a one-line change now** (`"sweeps": ["touch","scroll","axe"]` on
  that entry). If Bishan says yes, this is a good, cheap thing for G4 or early PD to do.
- **Q-G3-3 [FYI]** the "3am and 3pm" checklist line went into `new-surface`, not `new-lesson` — the
  plan pointed at the wrong skill (`new-lesson` authors Academy MDX).
- **Q-G3-4 [FYI]** the stale `PENDING` marker on `/scans/unusual-volume` is gone; the route is now
  gated. A guard got *stricter*.

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish G4, tag `gate-final`, bring every intelligence file current as ONE
commit, rewrite this file to point at **POLISH-AND-DEPTH-PLAN.md phase PD0** (with the reformed ritual
spelled out), **report to Bishan in plain English — the reform is done, PD awaits his go — and STOP.**
Within the phase the Autonomy Contract holds in full: never ask, never wait — anything that needs
Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable assumption made and marked.

Run the CLAUDE.md session ritual first (git pull, read the constitution + PROGRESS.md tail + LESSONS,
`npm test` from `app/` and `uv run pytest` from `pipeline/`, announce the checkpoint), then begin G4.
