# GATE-EFFICIENCY-PLAN.md — make the phase exits converge fast, without weakening a single guard

**Commissioned:** 2026-07-13, by Bishan, after reading GATE-EFFICIENCY-ANALYSIS.md.
**Executor:** Claude Opus 4.8. Self-driving, same discipline as every plan in this house.
**Runs BEFORE the Polish & Depth build.** POLISH-AND-DEPTH-PLAN.md has not started; it starts
only after this plan's `gate-final` tag is green and Bishan says go.
**Evidence base:** GATE-EFFICIENCY-ANALYSIS.md at the repo root. Read it in full before G0.
Every change below traces to a numbered finding there; this plan does not re-argue the evidence.
**Authority:** the usual order (RR Part 8/9 > Blueprint > plan > DECISIONS.md > judgment) — and
where this plan and the working tree disagree on a detail, **the tree wins on the detail and
this plan wins on the intent**. Verify every file:line before editing; N7 finished minutes
before this plan was written and line numbers drift.

---

## Part 0 — Why this plan exists, in one paragraph

The analysis measured it: 62% of recent commits are gate work, endgames run 60–90 minutes,
52% of tag CI runs fail, and 43% of all CI minutes re-verify commits that were already green.
Not because the guards are wrong — because of **placement and duplication**: the browser
oracle runs only *after* the tag exists, the tag must be deleted and re-pushed per failure,
everything re-verifies everything, and a handful of contradictory or stale sentences in the
instruction stack hand the executor wrong orders at exactly the exit moment. This plan moves
the oracle earlier, deletes the duplication, repairs the texts, and mechanizes the two rot
classes that keep burning exits. **No guard gets weaker.** Every verification that exists
today still happens — earlier, faster, or exactly once instead of twice.

---

## Part 1 — Mission, non-goals, and the untouchables

### 1.1 Mission
After `gate-final`: a phase exit is **rehearse → green → tag once → tag stays put → one docs
commit → report**. Target: a typical endgame ≤ 30 minutes; a browser-suite attempt ≤ 9 minutes;
zero CI runs that re-verify an already-green SHA; zero tag re-points; the six text
contradictions from analysis §3 gone.

### 1.2 Non-goals — this plan does NOT
- Touch product code. No app features, no styling, no pipeline logic. The only code this plan
  edits: `.github/workflows/ci.yml`, `app/scripts/*.mjs`, `app/e2e/*.spec.ts` (list-wiring
  only), one new manifest + tests, and comments.
- Start any Polish & Depth work. PD1's Saturday-row SQL is **theirs — do not run it.**
- Re-point, delete, or re-tag anything that exists. `nc-final` and every prior tag are history.
- Weaken, remove, or loosen any check. See 1.3.
- Rewrite user-authored text. User directives get dated *annotations*, never edits.

### 1.3 The untouchables (analysis §6 — binding, re-read at every phase start)
These each caught something green-and-wrong. They survive this plan byte-for-byte in strictness:
`maxDiffPixels: 600` absolute · `--update-snapshots=all` · baselines born in CI on Linux ·
the full suite runs on the exact tagged SHA · "Red CI blocks a phase exit — no exceptions" ·
`check:migrations` and its live-DB-only nature · the recorded-fixture rule · the honesty stack
(BaseRate, P2 stillness, amber/danger registers, one DataTable, copy.ts voice, insert-only
ledgers) · N7's sweep-hardening (a sweep proves it measured something; the body, not the
status code, is the 404 witness) · the `run-name:` line in nightly-a/b and its guarding test ·
"an unexplained diff is a build failure; an explained one is a commit with the reason."
**Auto-anything in this plan produces artifacts for eyes, never auto-commits.** Nine real bugs
in this build were found by opening the picture and looking.

---

## Part 2 — Session rhythm: ONE PHASE, THEN CHECK IN WITH BISHAN. ALWAYS.

This is the standing rule (CLAUDE.md, user, 2026-07-13, permanent) and **Bishan's explicit
instruction for this plan**: he clears the context window between phases.

At the end of EVERY phase, in this order:
1. Finish it properly — the phase's exit gate green, tagged `gate-N`, everything committed
   and pushed. Never stop mid-task or with a red build.
2. Bring the intelligence files current — PROGRESS.md, DECISIONS.md ([claude]-marked),
   LESSONS.md, PATTERNS.md, QUESTIONS-FOR-BISHANT.md, plus this plan's evidence file
   (`docs/gate-evidence/gN-*.md`) — written for a reader with no memory of this session,
   **as ONE commit** (that is itself one of this plan's reforms — practice it from G0).
3. Rewrite NEXT-SESSION-PROMPT.md: complete, paste-ready, self-contained — which phase is
   next, what state the tree is in, what was proven, what's pending.
4. **Report to Bishan in plain English and STOP.** What changed, what was measured before vs
   after, anything new in QUESTIONS, confirmation that NEXT-SESSION-PROMPT.md is ready.
   Do NOT roll into the next phase. Do not start "just the first commit" of it. Stop means stop.

Within a phase, the Autonomy Contract holds in full: never ask, never wait mid-phase; anything
that needs Bishan goes to QUESTIONS-FOR-BISHANT.md with the most reasonable assumption made
and marked.

**Session start ritual (every phase):** `git pull` → read CLAUDE.md, this plan's Part 0–2 +
your phase, NEXT-SESSION-PROMPT.md, PROGRESS.md tail → `npm test` (app/) and `uv run pytest`
(pipeline/) → announce the checkpoint. If red: fixing red IS the session.

---

## Part 3 — The target exit ritual (what G0–G4 build toward)

This is the ritual this plan installs (into CLAUDE.md and POLISH-AND-DEPTH-PLAN's standing
gate at G4). It is written here so every phase can dogfood the parts that already exist:

1–5. Local gate, unchanged: `typecheck && lint && test` · `uv run pytest` · `build` +
     `check:routes` + `check:bundles` + `check:fonts` · `e2e:local` · `check:drift`.
6.   Push to main. Confirm the branch CI run green (app + pipeline).
7.   **REHEARSE (new, from G1):** `gh workflow run ci.yml -f job=e2e` — the full browser
     oracle (e2e + VRT + PWA + axe, all shards) on main's HEAD, i.e. the exact candidate SHA.
     While it runs, in parallel: wait for the Vercel deploy → `check:nav -- --report` →
     `check:lighthouse`. (The rehearsal and the deploy checks overlap; neither waits for the
     other.)
8.   Rehearsal red → read the failure, fix, push, rehearse again. If the red is pixels and the
     change was intentional, the run's own `vrt-baselines-candidate-*` artifacts (from G1)
     carry the fresh baselines: download, **open and look at every image**, commit with the
     reason in the body. No separate mint dispatch needed.
9.   Rehearsal green → `git tag <family>-N` on that SHA → `push --tags` → confirm the tag run
     green (same SHA, same suite — first-try green is the expectation, not the hope).
     Suspected flake on the tag run? `gh run rerun <run-id> --failed` — **the tag never moves
     for a flake.** A real defect after tagging = the phase was not done: fix forward, and the
     *next* tag family number gets the honest story in its evidence file.
10.  THE TAG STAYS PUT. Intelligence files + evidence + NEXT-SESSION-PROMPT as **one**
     docs-only commit *after* the tag (free of CI once G2 lands). Then report and stop.
Also, once per phase, before step 9: `npm run check:migrations` (local — the one instrument
that can see production's schema; CI structurally cannot).

Evidence convention for this plan: `docs/gate-evidence/gN-<slug>.md` per phase, and every
phase's evidence file ends with the **gate-size line**: "Gate at exit: N drift rules · N VRT
baselines · N e2e specs · tag run M m S s." Growth of the gate becomes a booked number, never
an accident (analysis R12).

---

## Part 4 — The phases

Five phases, deliberately small. Each is one session. Each ends with a `gate-N` tag, evidence,
and a **stop-and-check-in**. G0 wires the `gate-*` family itself; every later phase's exit is
therefore also a live test of the phase before it.

---

### G0 — Stop paying twice (ci.yml dedup + hygiene) → tag `gate-0`

**Fixes:** analysis §2.3-#5, §3.6, §4.4, §4.8; recommendations R3, R6-lite, R7(3).

**Work, in this order (all in `.github/workflows/ci.yml` unless said otherwise):**
1. **Concurrency:** workflow-level
   `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.
   A re-pushed ref (or a superseded main push) cancels its predecessor instantly — no more
   13-minute zombie runs. Nightly workflows keep their own `msm-nightly` group; do not touch
   them.
2. **De-duplicate the tag run:** `app` and `pipeline` jobs get
   `if: github.event_name == 'push' && !startsWith(github.ref, 'refs/tags/')`.
   Tags then run **only** the browser oracle; the same SHA's app+pipeline proof already
   happened on the main push (analysis: ~43% of all CI minutes were this duplication). The
   same condition removes them from `workflow_dispatch` mints, which never needed them.
3. **Close the drift hole:** add `- run: npm run check:drift` to the `app` job (after `lint`,
   before `npm test` — it is a 1-second grep and it currently runs in **no** CI workflow;
   analysis §4.8). Local step 5 stays; CI now backstops a forgotten one.
4. **Tag families:** add `gate-*` AND `pd-*` to `on.push.tags` and to the e2e job's `if:` —
   both places, per ci.yml's own header warning ("a tag family that appears in one but not the
   other is a gate that silently never runs"). Pre-wiring `pd-*` here retires PD0's first work
   item — annotate that in POLISH-AND-DEPTH-PLAN.md's PD0 with one dated line ("done by
   GATE plan G0, 2026-07-13") so the next builder doesn't redo or distrust it.
5. **Mechanize that header warning (TDD):** new pytest
   `pipeline/tests/test_ci_tag_families.py` — parse ci.yml, assert the tag-family globs in
   `on.push.tags` exactly match the families in the e2e job's `if:`. Write it RED first
   (against the pre-edit file or a deliberate mismatch), then make it green. Same house as
   `test_workflow_dispatch.py`.
6. **Tell the truth in the header:** the comment claims Lighthouse runs "on the phase-exit
   tags" — no Lighthouse job has ever existed in any workflow (analysis §1.4). Rewrite the
   header to describe reality (Lighthouse runs locally via `check:lighthouse`, gate step 7)
   and list the current tag families.
7. **Cheap caching:** cache Playwright browsers in the e2e and vrt-baselines jobs
   (`actions/cache` on `~/.cache/ms-playwright`, keyed on the Playwright version from
   `app/package-lock.json`; still run `npx playwright install --with-deps chromium` — it
   becomes a fast no-op download when cached). Add `enable-cache: true` to `setup-uv` in the
   pipeline job. Leave the apt pg-client install alone (10 s; not worth complexity).
8. **CLAUDE.md, two one-line annotations (user-directed 2026-07-13 via this plan):**
   under the Autonomy heading, append: *"[Amended 2026-07-13: 'roll straight into the next
   phase' is repealed by the Session-rhythm rule above — ONE phase, then stop and check in.
   Within a phase, this contract holds in full.]"* And in the Commands block, add the
   rehearsal command placeholder (`gh workflow run ci.yml -f job=e2e — from G1`) so the
   constitution never lags the machinery by more than one phase.

**Prove it:**
- Push the ci.yml commit → confirm the branch run: app + pipeline run, `check:drift` step
  green, pytest suite includes the new family test.
- Push two trivial commits in quick succession once (the second within the first's run) →
  confirm the first run auto-cancels (evidence: run list showing `cancelled`).
- Exit ritual steps 1–6, then tag `gate-0` → confirm the tag run executes **only** the e2e
  job (app/pipeline absent from the run's job list) and is green. The suite is unchanged and
  the app untouched, so green is expected; a red here means the ci.yml edit broke something —
  fix forward before exiting.

**Exit:** standing gate per Part 3 (rehearsal step does not exist yet — skip 7's dispatch,
run the deploy checks as today) · tag `gate-0` green · evidence
`docs/gate-evidence/g0-dedup.md` with before/after: tag-run job list, durations, the
cancellation proof, and the gate-size line · intelligence files as ONE commit · **report to
Bishan and STOP.**

---

### G1 — Move the oracle before the tag (rehearsal + shards + auto-mint) → tag `gate-1`

**Fixes:** analysis §2.3-#1 and #3, §3.2, §4.1–4.3; recommendations R1, R2, R5.
This is the phase that kills the tag→red→fix→re-tag loop. Land it as three separately proven
commits.

**Commit 1 — the rehearsal switch (R1).**
- Add `e2e` to the `workflow_dispatch` input options; extend the e2e job's `if:` with
  `|| (github.event_name == 'workflow_dispatch' && inputs.job == 'e2e')`.
- **Sequencing trap (CLAUDE.md records it):** GitHub validates dispatch inputs against the
  workflow file **on the target ref** — the commit must be pushed to main BEFORE
  `gh workflow run ci.yml -f job=e2e` will accept the new value. Push first, then prove:
  dispatch it, confirm the full oracle runs green on main's HEAD and that app/pipeline
  correctly sit it out (G0's guard).

**Commit 2 — shard the oracle (R2).**
- Convert the e2e job to a **matrix**: `strategy: { fail-fast: false, matrix: { project:
  [desktop, phone, wide] } }`. Each matrix leg keeps its own Postgres service, migrate+seed,
  and runs `npm run e2e -- --project=${{ matrix.project }}`. Three legs, three throwaway
  databases — the reason `workers: 1` exists (seeded writes share state) does not apply
  across separate databases, so this parallelizes the suite without touching the
  serial-within-a-leg guarantee. `playwright.config.ts` is NOT edited.
- The vrt-baselines mint job stays single (it only runs vrt.spec.ts; ~6 min is fine).
- Apply the same matrix to nothing else. Failure artifacts: name them per leg
  (`playwright-failures-${{ matrix.project }}`).
- Prove: dispatch `job=e2e` again. Expect wall-clock ≈ the slowest leg (~7–9 min vs 15.8).
  Record per-leg timings. If a leg flakes on seeding twice in a row, **fallback:** revert
  commit 2 (keep commit 1 — the rehearsal alone is most of the win), log the lesson, move on.
- While in the file: `wide` runs only vrt+hardening (testMatch-scoped) — confirm its leg is
  the short one, as expected, and note the number.

**Commit 3 — auto-mint on pixel failure (R5).**
- In the e2e matrix job, after the test step:
  a step `if: failure()` that first checks whether any snapshot comparison actually failed
  (`test-results/**/*-actual.png` exists — that file pattern is the precise witness of a
  pixel diff); if yes, run
  `npx playwright test vrt.spec.ts --project=${{ matrix.project }} --update-snapshots=all`
  and upload the leg's `app/e2e/vrt.spec.ts-snapshots/` as artifact
  `vrt-baselines-candidate-${{ matrix.project }}` (retention 14d). If no pixel diff, the step
  exits without minting — a red e2e assertion must not spend 4 minutes photographing.
- **Discipline unchanged (untouchable):** the artifact is a *candidate*. The agent downloads,
  **opens every image**, and commits only an *explained* diff with the reason in the body.
  Unexplained → it is a bug; go look at the triptych. Auto-mint never auto-commits.
- Update `.claude/skills/vrt-update/SKILL.md`: the new flow (rehearsal red on pixels →
  candidate artifacts per project → download all three → look → commit), the old manual
  dispatch retained for deliberate restyles ("I know I moved pixels; mint before rehearsing"),
  artifact names, and the download one-liner
  (`gh run download <id> -p 'vrt-baselines-candidate-*' --dir app/e2e/vrt.spec.ts-snapshots`
  — verify flag behavior against `gh` help before writing it into the skill; PNG names carry
  the viewport so the three legs cannot collide).
- Prove it can fail-and-mint honestly: on a scratch branch, make a deliberate 1-line visual
  change (e.g. nudge a styleguide-only margin), dispatch `job=e2e` on that branch's HEAD?
  — dispatch runs on a chosen ref: `gh workflow run ci.yml -f job=e2e --ref <branch>`.
  Confirm: the affected leg reds on pixels, the candidate artifact appears, the images show
  exactly the nudge. Then delete the branch; nothing merges. (This is the "prove the guard
  can fail" house ritual, applied to the new machinery.)

**Exit:** full Part-3 ritual **including its first real rehearsal** (step 7 now exists) ·
tag `gate-1` green first-try (that is the point — say so in the evidence if it happens, and
say why not if it doesn't) · evidence `docs/gate-evidence/g1-oracle.md`: rehearsal timings
per leg, before/after tag-run duration (15.8 m → measured), the scratch-branch mint proof,
gate-size line · ONE docs commit · **report to Bishan and STOP.**

---

### G2 — Make documentation free (paths-ignore, with the tag-edge proof) → tag `gate-2`

**Fixes:** analysis §2.3-#4, §4.7; recommendation R4. Small phase by design — its danger is
one specific edge, so the phase IS the proof.

**Work:**
1. Add to ci.yml `on.push`:
   `paths-ignore: ['**/*.md', 'docs/**', '.claude/**']`.
   Intent: docs/intelligence/skill commits stop triggering app+pipeline entirely.
   **The dangerous edge:** if GitHub evaluated path filters for TAG pushes too, a phase tag
   landing on a docs-heavy commit would silently skip the pixel oracle — the exact
   "gate that silently never runs" disease. GitHub's documented behavior is that path filters
   are ignored for tag pushes — **but the vendor's own documentation is not a recording**
   (N6's lesson, learned against GitHub itself). So prove it live, on this repo, before
   trusting it.
2. **The proof, in order:**
   a. Push the ci.yml commit (touches a .yml — runs normally; confirm green).
   b. Push a genuinely docs-only commit (start `docs/gate-evidence/g2-docs-cost.md`).
      Assert **no** ci run was created for it (`gh run list` — absence is the pass).
   c. Exit ritual through step 8 (rehearse — G1's machinery), then tag `gate-2` **on that
      docs-only commit** and push the tag. Assert the e2e oracle **did** run on the tag and
      is green. That single run proves the edge: branch pushes filtered, tag pushes not.
   d. **If (c) fails to trigger:** the filter is unsafe for this repo's ritual. `git revert`
      the paths-ignore commit (never rewrite history), tag `gate-2` on the revert, and adopt
      the fallback instead: docs-only commits carry `[skip ci]` in the message, with a
      bright-line rule written into CLAUDE.md at G4 — **never `[skip ci]` a commit a tag will
      sit on.** Record which world we live in; both are acceptable, one is cleaner.
3. Codify the docs-batching practice you have already been running since G0 (one intelligence
   commit per phase; no post-tag "CI confirmed green" commits — the tag run's green IS the
   record, referenced by run-id in the evidence file). The text lands in CLAUDE.md at G4;
   from now on it is simply how this plan behaves.

**Exit:** tag `gate-2` green (on the docs-only commit if the proof passed — deliberately) ·
evidence: the run-list absence, the tag-run presence, or the honest fallback story ·
gate-size line · ONE docs commit (this phase it may BE the tagged commit — that is the test) ·
**report to Bishan and STOP.**

---

### G3 — One list of rooms, and defuse the clocks → tag `gate-3`

**Fixes:** analysis §2.3-#2, §4.6; recommendations R8, R9. The only phase that edits specs
and scripts. Full TDD.

**Work:**
1. **The routes manifest (R8).** New file `app/lib/routes-manifest.json` (JSON so .mjs
   scripts, TS specs, and tests all read it without ceremony): one entry per product route —
   `path`, `seeded` (needs the synthetic morning), `sweeps` (touch/scroll/axe), `wide`
   (gets the wide viewport), `navBudget` (`gated` | `pending`), `vrtRoom` (null, or the room
   slug vrt.spec.ts uses). Dynamic families appear once with their canonical seeded instance
   (`/news/nc-fed-hold`, `/scans/unusual-volume`, `/ticker/AAPL`) — same convention the specs
   use today.
2. **Wire the five consumers to it** — list-wiring only, zero behavior change:
   `a11y.spec.ts` ROUTES · `hardening.spec.ts` ROUTES/SEEDED_ROUTES · `vrt.spec.ts`
   SEEDED_ROOMS keys (per-room shot quirks stay in the spec, keyed by `vrtRoom`) ·
   `check-nav.mjs` PRODUCT_ROUTES/PENDING · `check-bundles.mjs` (baseline VALUES stay in the
   script; add a consistency assert that every baseline key is a manifest path and vice versa
   for gated routes).
3. **The completeness guard (TDD — this is the crown):** new vitest test that walks
   `app/app/**/page.tsx`, derives the route paths, and asserts every product route appears in
   the manifest (with an argued in-file exemption list: `/login`, `/styleguide`, api/, the
   404 frame — each exemption one comment line of why). **Write it RED first** by deleting
   `/news` from a scratch copy — prove the guard can fail — then green. This makes
   rot-by-omission (how /news went unmeasured for two tagged phases) mechanically impossible:
   a new `page.tsx` with no manifest entry is a red unit test at the next `npm test`, not a
   silent hole found two phases later.
4. **Drift rule 21 — the fuse-finder (R9):** in `check-drift.mjs`, following the house
   pattern (argued allowlist in-file): **no absolute date literals**
   (`/20\d\d-\d\d-\d\d/`) in `app/prisma/seed.mjs` or `app/e2e/*.spec.ts` outside the
   sanctioned constants (`SEEDED_EVENING`, the pinned clock in vrt.spec.ts, and the manifest's
   canonical instances if any encode dates — argue each). Rationale one line in the rule:
   "an absolute fixture under a relative rule has a fuse on it — /paper's baseline expired
   28 minutes after the run that certified it." Recorded fixtures are out of scope by
   construction (they are recordings; the recording rule owns them).
   Prove rule 21 RED first against a scratch absolute date, then green.
   (A rule 22 for time-of-day-dependent assertions was considered and is NOT mechanizable
   without false positives — instead add one line to the `new-lesson` skill's checklist:
   "does this assertion hold at 3am and 3pm, Saturday included?" Log the judgment in
   DECISIONS.)
5. Update `.claude/skills/new-surface/SKILL.md`: the N7-era line "did you ADD THE ROUTE TO
   THE SWEEPS (hard-coded lists)" becomes "add the route to `app/lib/routes-manifest.json` —
   the sweeps, nav budget, and completeness test all read it; the unit test will red if you
   forget," keeping N7's `SEEDED_ROUTES`-vs-`ROUTES` seeded-data warning verbatim.

**Prove it:** `npm test` (completeness + rule-21 tests green, and their RED states were
witnessed and are described in the evidence file) · full local gate · **rehearse** (`job=e2e`)
— the sweeps and VRT must behave byte-identically (same routes swept, same 76 baselines
compared, zero pixel diffs; the rehearsal IS the no-behavior-change proof).

**Exit:** rehearsal green → tag `gate-3` green · evidence `docs/gate-evidence/g3-manifest.md`
(the RED-state screenshots/quotes, sweep-route counts before/after — must be identical, gate-
size line) · ONE docs commit · **report to Bishan and STOP.**

---

### G4 — Repair the texts, install the ritual → tag `gate-final`

**Fixes:** analysis §3.1, §3.3–3.6, §2.3-#4-practice; recommendations R7, R10–R12, R14.
Mostly documentation — but it is the phase that makes the whole reform *survivable across
sessions*, so it is last, after every mechanism it describes is proven.

**Work — Appendix A is the exact checklist; the shape:**
1. **The five "roll straight on" clauses** (the four plan copies; CLAUDE.md's was annotated
   at G0): one dated annotation each — superseded 2026-07-13 by one-phase-per-session.
2. **CLAUDE.md:** point the Phase-exit ritual line at *the current plan's standing gate*
   (§6.4 is historical); add the one-sentence global-rules override ("plan §6.2 and this
   constitution supersede the ~/.claude global testing/workflow rules in this repo — no 80%
   coverage chase, no agent ceremony the plan doesn't ask for"); add the **Endgame practice**
   block (Part 3's ritual: rehearse first · the tag stays put · flake → `gh run rerun
   --failed`, never a re-point · one docs commit per phase · the gate-size line in every
   evidence file · docs commits and `[skip ci]` per G2's outcome).
3. **DEVELOPMENT-PLAN §6.4 correction block — via the generated-source pipeline ONLY:** edit
   `docs/src/dp-0N.html` (find the §6.4 part), add the dated correction block (the current
   gate lives in the active plan; `npx playwright test` locally and `lhci` are era artifacts;
   ordering is now tag-then-docs), then run `build-plan-md.py` AND `build-plan-pdf.py` and
   commit sources + both outputs together. **Never edit DEVELOPMENT-PLAN.md directly — it
   says so in its own first line, and N7 still did it once. Do not be the second.**
4. **The diverged duplicates:** amber-consumer count in UI-REDESIGN-PLAN.md (~:175 and ~:481)
   and `new-surface` SKILL.md — all three point at `check-drift.mjs`'s `ALERT_ALLOWED` as
   *the register* ("N consumers as of <date>; the script is the truth"); §3.10-v2 note
   ("mechanized as check-drift.mjs's 20+ rules; the script is the truth"); the font
   drop-order comment in `check-font-budget.mjs` (name only weights that ship — comment-only
   edit); `base-rate-display` SKILL.md "Plex Mono" → "the mono numeral stack
   (`var(--font-mono)`)".
5. **POLISH-AND-DEPTH-PLAN.md amendments (dated, [claude]-marked, logged in DECISIONS):**
   (a) correct the false fact at ~:262 (check:migrations ran **locally** at nc-6; CI cannot
   run it); (b) PD9's budget sentence: the binding constraint on `/news` is the immovable
   **200 KB ceiling** (~4–5 KB real headroom), not baseline+10 — and pre-authorize the plan's
   own escape hatch (overlay chrome code-splits behind first open; the gate proves the
   split); (c) pre-authorize the PD9 sheet's opacity transition as a named exemption in the
   P2 stillness walk, same class as the route fade, with the walk's test extended when PD9
   builds it; (d) PD5 movers-chip pre-decision, **as a marked assumption**: the delta chip
   inside TickerChip carries `data-p2` and any hover it keeps must be non-animating
   (opacity/underline only, no transform) — log in QUESTIONS-FOR-BISHANT for veto; (e) PD0
   wiring note (done at G0 — verify it is still accurate); (f) **insert the Part-3 ritual
   into PD's standing-gate block** (rehearse step, tag-stays-put, one-docs-commit) as a dated
   amendment — PD inherits the reformed exit from its first phase; (g) regenerate the PD PDF
   from `docs/src/polish-and-depth-plan.html` so the active plan's PDF cannot drift (the
   UI-REDESIGN / APP-FEEL / NC PDFs are archives of finished builds — annotate their MD
   amendments as post-PDF instead of re-rendering; one line each).
6. **DECISIONS.md:** one entry per amendment class, [claude]-marked, citing this plan and the
   analysis section. **QUESTIONS-FOR-BISHANT.md:** the movers-chip assumption; anything else
   marked along the way.

**Prove it:** `grep -rn "roll straight"` across the repo returns only annotated instances ·
`grep -rn "two consumers"` returns only register-pointers · the DEV-plan regen is clean
(`git diff` shows sources and both outputs moving together) · full local gate (the drift
rules and unit tests still pass — the manifest test now guards the docs too, in the sense
that nothing here touched routes) · **rehearse** → green.

**Exit:** tag `gate-final` green, first try · evidence `docs/gate-evidence/g4-texts.md`
including **the closing measurement table (Appendix B) filled in with real numbers** ·
intelligence files as ONE commit · NEXT-SESSION-PROMPT.md now points at
**POLISH-AND-DEPTH-PLAN.md, phase PD0**, with the reformed ritual spelled out ·
**report to Bishan — the reform is done; PD awaits his go — and STOP.**

---

## Part 5 — Risks, fallbacks, and standing cautions

- **Sharding flakes (G1):** two consecutive unexplained seed/DB failures in the matrix →
  revert the matrix commit, keep the rehearsal commit, log it. The rehearsal alone removes
  the tag-mechanics loop; sharding is speed, not correctness.
- **paths-ignore edge (G2):** the phase is built around proving it; the fallback
  (`[skip ci]` discipline) is pre-written. Never trust the docs over the live proof.
- **Dispatch 422:** any new `workflow_dispatch` input value must be ON MAIN before
  dispatching it. Push, then dispatch. (CLAUDE.md already records this; it will bite anyway
  if forgotten.)
- **Auto-mint discipline:** candidates are for eyes. If a rehearsal reds on pixels you did
  not intend, that is a BUG FOUND, not a baseline to refresh. The one rule of vrt-update
  stands over everything this plan builds.
- **The tree wins on details:** every file:line in this plan and Appendix A was read on
  2026-07-13 before PD started; verify before editing. If a cited line moved, find the
  clause, don't skip the fix.
- **Nightly-a/b, migrate.yml, record-fixtures.yml: untouched.** The `run-name:` line is
  load-bearing; you are not here.
- **No force-push, no rebase, no tag surgery, ever.** History is insert-only, like the
  ledgers.
- **If anything in this plan conflicts with an untouchable (1.3): the untouchable wins,**
  QUESTIONS gets the note, and the phase exits without that item rather than with a weakened
  guard.

---

## Appendix A — G4 text-amendment checklist (verify each line before editing)

| # | File | Location (as of 2026-07-13) | Edit |
|---|---|---|---|
| 1 | CLAUDE.md | Autonomy section | *(done at G0)* dated repeal annotation |
| 2 | CLAUDE.md | Session ritual, "Phase exit" line | point at the current plan's standing gate |
| 3 | CLAUDE.md | new Endgame-practice block | Part-3 ritual, tag-stays-put, rerun-for-flakes, one-docs-commit, gate-size line, G2's docs-CI policy |
| 4 | CLAUDE.md | near Conventions | global-rules override sentence |
| 5 | docs/src/dp-*.html → DEVELOPMENT-PLAN.md + PDF | §6.4 | dated correction block; regen via both build scripts; commit together |
| 6 | UI-REDESIGN-PLAN.md | ~:1099 | roll-on annotation |
| 7 | UI-REDESIGN-PLAN.md | ~:175, ~:481 | amber register pointer (check-drift.mjs ALERT_ALLOWED) |
| 8 | UI-REDESIGN-PLAN.md | §3.10 v2 intro | "mechanized as check-drift.mjs; the script is the truth" |
| 9 | APP-FEEL-PLAN.md | ~:22, ~:1165 | roll-on annotations |
| 10 | NEWS-AND-CONTROL-PLAN.md | ~:28, ~:1191 | roll-on annotations |
| 11 | POLISH-AND-DEPTH-PLAN.md | ~:262 | check:migrations ran locally, not in tag CI |
| 12 | POLISH-AND-DEPTH-PLAN.md | ~:1324 (PD9) | 200 KB ceiling is binding on /news; pre-authorize code-split |
| 13 | POLISH-AND-DEPTH-PLAN.md | PD9 sheet spec | P2-walk exemption pre-authorization (route-fade class) |
| 14 | POLISH-AND-DEPTH-PLAN.md | PD5 kit spec | movers-chip: data-p2 + non-animating hover (marked assumption → QUESTIONS) |
| 15 | POLISH-AND-DEPTH-PLAN.md | PD0 | verify G0's "wiring done" note |
| 16 | POLISH-AND-DEPTH-PLAN.md | standing gate ~:1344 | insert rehearse step + tag-stays-put + one-docs-commit (dated) |
| 17 | docs/src/polish-and-depth-plan.html → PDF | — | regen after 11–16 |
| 18 | .claude/skills/new-surface/SKILL.md | ~:146 + N7 sweep line | amber register pointer; manifest is the door *(manifest line done at G3)* |
| 19 | .claude/skills/base-rate-display/SKILL.md | ~:35 | mono-stack wording |
| 20 | .claude/skills/vrt-update/SKILL.md | — | *(done at G1)* consistency check only |
| 21 | app/scripts/check-font-budget.mjs | drop-order comment | name only shipping weights (comment-only) |
| 22 | .github/workflows/ci.yml | header | *(done at G0)* consistency check only |

## Appendix B — the measurement table (fill at gate-final; "before" from the analysis)

| Metric | Before (nc era) | After (gate-final) |
|---|---|---|
| Tag-run wall-clock | 15.8 m | |
| Browser-suite attempt (rehearsal leg max) | 15.8 m (tag only) | |
| Tag pushes per phase exit | up to 6 (nc-final) | target: 1 |
| Endgame wall-clock | 66–91 m worst | target: ≤ 30 m |
| CI on an already-green SHA | ~43% of all minutes | target: ~0 (tag = oracle only) |
| Docs-commit CI cost | 2.0 m each, 58 commits | target: 0 |
| Baseline mint round-trip | dispatch + 6 m + download + re-tag | candidate artifact in the failing run |
| Gate size (rules · baselines · specs) | 20 · 76 · 22 | (booked, with reasons for any growth) |

---

*Written 2026-07-13 by the diagnostic session, from GATE-EFFICIENCY-ANALYSIS.md. Five phases,
five sessions, five check-ins. The guards stay sharp; only the waiting dies.*
