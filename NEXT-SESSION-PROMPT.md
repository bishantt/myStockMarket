# Your session: LC3 — the hot-file comment compression. LC3 ONLY. It is the LAST LEAN phase.

The two-plan commission (2026-07-15) is under way. **CC1, LC1 and LC2 are DONE and tagged (`cc-1`,
`lc-1`, `lc-2`).** Two plans sit at the repo root: **CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…
`cc-10`) and **LEAN-CODEBASE-PLAN.md** (Plan B, `lc-1`…`lc-3`). The decided execution order, fixed
across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 → CC2 → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

You run **LC3 of LEAN-CODEBASE-PLAN.md and nothing else** — one phase per session is standing law
(CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked. **LC3 is the last LEAN phase; after it, the order returns to Plan A at
CC2.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, the phase evidence file `docs/lean-evidence/lc3.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, that is **CC2** of CLARITY-AND-CADENCE-PLAN.md) —
   carrying this handoff rule forward verbatim in spirit, the phase-order line, the phase's build list
   distilled from its plan, its gate, and anything in flight the next session must know. Assume the
   next session has NO memory of yours. (Read CLARITY-AND-CADENCE-PLAN.md's CC2 section to distill it.)
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into CC2.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to **Q-LC1-1**
   (should vrt-diff.mjs declare pngjs+pixelmatch as explicit devDependencies instead of using
   Playwright's copy? — still open at LC2; if Bishan now says yes, fold that two-line change into LC3;
   if silent, leave it).
2. Read LEAN-CODEBASE-PLAN.md in full before touching anything — especially **Part 1** (the comment
   standard, now law), **Part 2** (the measurements + the top-25 worklist), **Part 3** (THE SACRED
   LIST and the risk register — never strip, never reword these), and **Part 6 LC3** (the build + the
   prover + the gate). Part 7 (adversarial pass) items 1, 2, 6 are LC3's risks.
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 753 · pipeline 579 passed / 35 skipped**.

## LC3's build list (the plan's Part 6 LC3 is authoritative; this is the distillation)

LC3 compresses comments in the ~25 hottest files (a fifth of all comment lines, the files every
session reads). Every WHY survives at ≤2 lines; essays become sentences; restatement dies. This is
NOT a total repo strip (Part 0.5 was rejected in LC1) — only the top-25, and the long tail converges
via the boy-scout rule. **Comments do not render, so nothing about the product changes** — the whole
risk is drift/pragma breakage, which the prover and the sacred list guard against.

- **Commit the prover FIRST: `pipeline/scripts/comment_prover.py`** (Part 6 LC3). Per batch it proves
  the edits were comment-only:
  - **TS/TSX/MJS:** tokenize old and new with the TypeScript scanner; the NON-comment token streams
    must be identical. Any difference = the batch is rejected, not explained.
  - **Python:** `ast.dump` equality after normalizing docstrings out of both trees, PLUS an assertion
    that the only changed string constants ARE docstrings (docstring compression legitimately edits
    the AST; nothing else may).
  - **prisma / css / yaml (no tokenizer):** whole-line-deletion-only — every diff hunk must be removed
    full-line comments or shortened comment lines; anything else is rejected.
  - Part 7.1's guard: the prover ALSO greps the Part 3.1 sacred patterns (pragmas) old-vs-new and
    requires identical counts per file.
- **Refresh the top-25 worklist** by running `uv run python -m scripts.comment_stats` (from
  `pipeline/`) at execution time — LC2 shrank desk.spec.ts and vrt.spec.ts (removed the inlined
  logins/signIn), so the list has shifted. At LC1 the top was: job_a.py 397 · copy.ts 353 · morning.ts
  345 · check-drift.mjs 331 · narrate.py 327 · vrt.spec.ts 318 · nightly.py 288 · schema.prisma 286 ·
  fixtures/news.mjs 275 · desk.spec.ts 253 · publish.py 235 — plus the next ~14 to reach 25.
- **Work in FOUR batches**, and after each batch run the prover PLUS that tree's tests before moving
  on: (1) app/lib + app/app · (2) app/components · (3) app/e2e + app/scripts · (4) pipeline + prisma.
- **THE SACRED LIST (Part 3) is never stripped or reworded**, in any batch: machine-read pragmas
  (`// @vitest-environment node`, `eslint-disable`, `@ts-expect-error`, `# noqa`); the 28 clock-rule
  derived-date comments; file-header laws other guards cite (verified.ts, copy.ts, fixtures/paper.mjs,
  brand-assets.mjs's BRAND_FIELD, check-drift.mjs's argued skip-lists, the `run-name:` block in
  nightly-a/b.yml); and the 11 comment-sensitive drift rules (3,4,5,9,10,11,13,14,18,19,20 — no
  comment exemption; 6/24 exempt whole-line comments only). **Rule of thumb: deleting a comment LINE
  is always drift-safe; rewording one is not** — prefer deletion, and run check:drift on any reworded
  line in app/**.

Scope discipline: LC3 is comments only. Do not change code, tests, or behavior. Log anything else you
notice; don't fix it.

## LC3's gate (the Endgame, CLAUDE.md) — a FULL REHEARSAL is required at the END

Comments don't render, but the suite proving that is the point.
1. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift`). Run the **prover after every
   batch**, and that tree's tests. The guard scripts need Node 24 — prepend
   `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (name the version; the glob `v24*` matches TWO
   dirs and breaks). `check:migrations` is once-per-phase; LC3 adds no migration.
2. Push to main → confirm the branch CI green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag (the full four-leg
   oracle). VRT: no pixels should move — comments don't render — **if any leg reds, that is a finding,
   not a baseline to refresh** (use `app/scripts/vrt-diff.mjs <candidate-dir>` from `app/` to inspect).
4. Rehearsal green → tag `lc-3` **by SHA** (never HEAD — the nightly heartbeat can move main) → push →
   confirm the tag run.
5. ONE docs commit after (evidence file **`docs/lean-evidence/lc3.md`** with the before/after
   comment_stats.py table, the prover output per batch, the rehearsal run id; intelligence files; this
   file rewritten for CC2). Every evidence file ends with the gate-size line. Then report and STOP.

## Carry-forward notes (do not lose these)

- **`lc-2` state:** app **753** unit · pipeline **579** passed / 35 skipped · **97 VRT baselines**
  (0 changed at lc-2 — LC2 renders no different pixel) · **26 e2e specs** · **28 drift rules** · 14
  rooms · 4 oracle legs · **16 bundle baselines**. Tag `lc-2` on `e3832bb`, branch run `29423103573`
  green, tag run `29423758776` green (7 m 48 s).
- **The comment standard is law (LC1), and LC3 executes it retroactively on the top-25.** CLAUDE.md
  Readability point 3: "comments are one line of why" — comment only where a reader would be lost, ≤1
  line (2 when truly necessary), never restate the code, the why always earns its place, and the
  boy-scout rule brings a file to standard when you edit it. LC2 already applied it to the specs and
  guards it touched (e.g. the moved `waitForLayout` comment was tightened).
- **The two committed tools you need** (from LC1): `pipeline/scripts/comment_stats.py` (the worklist +
  before/after instrument) and `app/scripts/vrt-diff.mjs` (candidate-diff, if a rehearsal leg reds).
  You must ALSO commit `pipeline/scripts/comment_prover.py` (Part 6 LC3) as your first act.
- **What LC2 left in the tree** (so you know the current shape of the files you'll compress):
  `app/e2e/session.ts` + `app/e2e/layout.ts` are the shared e2e helpers (all 24 login specs import
  them); `app/scripts/lib/session-cookie.mjs` + `manifest.mjs` are the shared guard libs. These are
  NEW, lean files — not top-25 worklist targets, but if a batch touches them, the standard applies.
- **The guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit
  version. `check:live`/`check:nav`/`check:lighthouse` need `set -a; source .env; set +a`; Lighthouse
  needs `CHROME_PATH`.
- **The local e2e harness (docker `msm-e2e`) works** — DB URL
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, ONE project at a time with `--workers=1 --ignore-snapshots`. Full recipe in
  PROGRESS.md. Local e2e runs no longer dirty docs/feel-evidence/nav-timing.md (LC1 gated the append
  on CI).
- **Open questions (QUESTIONS-FOR-BISHANT.md, none blocking):** Q-LC1-1 (the vrt-diff devDependency
  choice — flip it into LC3 only if Bishan now vetoes), plus the carried CC1 items: Q-CC1-1 (ticker-
  slug rendered proof handed to CC4), Q-PD6-3 (watchlist reason truncation, now CC4's), the PD10 iOS
  on-glass photos (Bishan's device), and CLARITY Part 0 (P-1/P-2/dawn-cron/retention — defaults
  proceed at CC5/CC7/CC8/CC10).
- **`dummy/`** (Plan A's screenshot evidence) stays untracked/kept until CC5. Do not commit or delete
  it in LC3. The **UI-LIBRARY-EVALUATION trio** (`.md` + PDF + HTML, untracked) is a finished
  deliverable — leave it. Stage by explicit path, never `git add -A`.
