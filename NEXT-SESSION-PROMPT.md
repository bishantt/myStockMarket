# Your session: LC2 — one e2e helper, importable waitForLayout, guard-plumbing dedupe. LC2 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1 and LC1 are DONE and tagged (`cc-1`, `lc-1`).**
Two plans sit at the repo root: **CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and
**LEAN-CODEBASE-PLAN.md** (Plan B, `lc-1`…`lc-3`). The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 → LC3 → CC2 → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

You run **LC2 of LEAN-CODEBASE-PLAN.md and nothing else** — one phase per session is standing law
(CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked.

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, the phase evidence file `docs/lean-evidence/lc2.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, that is **LC3** of LEAN-CODEBASE-PLAN.md) —
   carrying this handoff rule forward verbatim in spirit, the phase-order line, the phase's build list
   distilled from its plan, its gate, and anything in flight the next session must know. Assume the
   next session has NO memory of yours.
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into LC3.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to **Q-LC1-1**
   (should vrt-diff.mjs declare pngjs+pixelmatch as explicit devDependencies instead of using
   Playwright's copy? — if Bishan says yes, fold that two-line change into LC2; if silent, leave it).
2. Read LEAN-CODEBASE-PLAN.md in full before touching anything — especially Part 3 (the sacred list —
   never strip), **Part 5.1, 5.2, 5.3, 5.6** (LC2's items), and Part 6 LC2 (the gate). NOTE: Part 5.7
   (the nav-timing CI-gate, = Part 0.4) was **already completed in LC1**, so LC2 does NOT touch it.
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 753 · pipeline 579 passed / 35 skipped**.

## LC2's build list (the plan's Part 6 LC2 is authoritative; this is the distillation)

All four items are behavior-preserving; no guard is weakened. LC2 does NOT do LC3's hot-file comment
compression, nor re-touch nav-timing (done in LC1).

- **(5.1) One e2e session helper.** `signIn(page)` is byte-identical in 15 spec files and inlined 5
  more times inside desk.spec.ts, and every spec repeats the `USER`/`PASSWORD` header. Create
  `app/e2e/session.ts` exporting `USER`, `PASSWORD`, `signIn`, and rewrite all 24 specs to import it.
  Pure extraction — the byte count changes, the login does not. Leave vrt's own `shoot()`
  mouse-parking exactly where it is.
- **(5.2) `waitForLayout` becomes importable.** CLAUDE.md commands every box-measuring spec to call
  it, but it is a PRIVATE function inside grid.spec.ts — the law currently requires copy-paste. Move
  it into the shared helper (`app/e2e/session.ts` or a sibling), exported. This STRENGTHENS a
  standing rule; grid.spec.ts and any other caller now import it.
- **(5.3) Guard-script plumbing dedupes.** The session-cookie mint exists three times (check-nav,
  check-live, lighthouse-check) and manifest parsing twice each (routes manifest: check-nav +
  check-bundles; build manifest: check-routes + check-bundles). Extract
  `app/scripts/lib/session-cookie.mjs` and `app/scripts/lib/manifest.mjs`. **Every assertion,
  threshold and rule stays inside its guard file.** PROOF OF PRESERVATION (do this and put it in the
  evidence file): capture each guard's FULL stdout on the same built app BEFORE and AFTER the
  extraction; the diff must be empty.
- **(5.6) record-fixtures.yml drift.** The `new-provider-adapter` skill says every recorder joins
  that workflow's steps; only 3 of 10 are steps. Reconcile — EITHER add the seven missing recorders
  as steps, OR amend the skill to say recorders run locally. Executor judgment; log the choice in
  one DECISIONS.md line either way.

Scope discipline: LC3 items (the top-25 hot-file comment compression, the comment_prover.py) are NOT
LC2's. Log anything else you notice; don't fix it.

## LC2's gate (the Endgame, CLAUDE.md) — a FULL REHEARSAL is required

LC2 rewrites all 24 e2e specs, so even though it is a pure extraction, **it IS the browser suite** and
the gate includes a full rehearsal (unlike LC1, which changed no e2e behavior and skipped it).

1. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift`). The guard scripts need Node 24 —
   prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (the glob `v24*` matches TWO installed
   dirs and breaks; name the version). `check:migrations` is once-per-phase; LC2 adds no migration, so
   it is a formality but run it.
2. Push to main → confirm the branch CI green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag (the full four-leg
   oracle). VRT: no pixels should move — **if any leg reds, that is a finding, not a baseline to
   refresh** (this phase renders nothing new; use `app/scripts/vrt-diff.mjs` to inspect any candidate).
   For 5.3, run each guard before/after and confirm the stdout diff is empty.
4. Rehearsal green → tag `lc-2` **by SHA** (never HEAD — the nightly heartbeat can move main) → push →
   confirm the tag run.
5. ONE docs commit after (evidence file **`docs/lean-evidence/lc2.md`** with the guard-output identity
   diffs from 5.3, the spec-count table showing all 24 import the helper, the rehearsal run id;
   intelligence files; this file rewritten for LC3). Every evidence file ends with the gate-size line.
   Then report to Bishan and STOP.

## Carry-forward notes (do not lose these)

- **`lc-1` state:** app **753** unit · pipeline **579** passed / 35 skipped · **97 VRT baselines**
  (0 changed at lc-1 — LC1 renders no different pixel) · **26 e2e specs** · **28 drift rules** · 14
  rooms · 4 oracle legs · **16 bundle baselines**. Tag `lc-1` on `282c2d2`, branch run `29419300042`
  green, tag run `29419527289`.
- **The comment standard is now law (LC1):** CLAUDE.md Readability point 3 is "comments are one line
  of why" — comment only where a reader would be lost, ≤1 line (2 when truly necessary), never restate
  the code, and **bring a file's comments to standard in the same commit when you edit it** (the
  boy-scout rule). LC2 rewrites 24 specs, so apply it as you touch each.
- **The guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit
  version: `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" npm run check:fonts`. `check:live` /
  `check:nav` / `check:lighthouse` need `set -a; source .env; set +a`; Lighthouse needs `CHROME_PATH`.
- **The local e2e harness (docker `msm-e2e`) works** — the DB URL is
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, and run ONE project at a time with `--workers=1 --ignore-snapshots`. Full recipe in
  PROGRESS.md. **Locally, `git checkout -- docs/feel-evidence/nav-timing.md` is NO LONGER NEEDED** —
  LC1 gated that append on `process.env.CI`, so local runs no longer dirty it.
- **Two committed tools LC1 left you:** `app/scripts/vrt-diff.mjs` (run from `app/`:
  `node scripts/vrt-diff.mjs <candidate-dir>` — decodes every candidate against its committed twin and
  prints differing-pixel counts; use it if any rehearsal leg reds on pixels) and
  `pipeline/scripts/comment_stats.py` (`uv run python -m scripts.comment_stats` — the LC3 worklist and
  before/after instrument; you will need it in LC3, not LC2).
- **Open questions (QUESTIONS-FOR-BISHANT.md, none blocking):** Q-LC1-1 (the vrt-diff devDependency
  choice — flip it into LC2 only if Bishan vetoes), plus the carried CC1 items: Q-CC1-1 (ticker-slug
  rendered proof handed to CC4), Q-PD6-3 (watchlist reason truncation, now CC4's), the PD10 iOS
  on-glass photos (Bishan's device), and CLARITY Part 0 (P-1/P-2/dawn-cron/retention — defaults
  proceed at CC5/CC7/CC8/CC10).
- **`dummy/`** (Plan A's screenshot evidence) stays untracked/kept until CC5. Do not commit or delete
  it in LC2. The **UI-LIBRARY-EVALUATION trio** (`.md` + PDF + HTML, untracked) is a finished
  deliverable — leave it.
