# PROGRESS.md — resumable state

# LC1 IS DONE — tagged `lc-1` (2026-07-15). Second phase of the two-plan commission.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 → LC3 → CC2 → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

**Checkpoint: LC1 (the standard, the deletions, the tool) is DONE and tagged `lc-1` by SHA on
`282c2d2`. Nothing is blocked. Nothing is in flight. The next phase is LC2** (LEAN-CODEBASE-PLAN.md),
and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What LC1 did, in one paragraph

LC1 sheds weight and sets the comment standard for the nine CC sessions after it. **The `lc-*` tag
family was wired into ci.yml first** (both `on.push.tags` and the e2e oracle's `if:`;
test_ci_tag_families.py green). **The comment standard (Part 1):** CLAUDE.md Readability point 3 is
amended to "comments are one line of why" (2026-07-15, superseding the 2026-07-10 docstring rule) —
comment only where a reader would be lost, ≤1 line, never restate the code, the why always earns its
place, and the boy-scout rule brings a file to standard when you edit it. **Two tools committed:**
`pipeline/scripts/comment_stats.py` (the measuring script behind Part 2 — full-line comments via
tokenizer, docstrings via ast, a regex-aware C-family scanner; reproduces Part 2's table faithfully)
and `app/scripts/vrt-diff.mjs` (the committed VRT candidate-diff tool the standing "decode both,
count differing pixels" law asks for, cited from the vrt-update skill). **Part 4's deletions
executed** after a fresh per-row reference re-check: the repo-root Screenshot PNG, docs/KICKOFF-PROMPT.md,
two orphan .gitkeeps (tracked); the orphaned root node_modules residue, .vercel-auth-hash.tmp, 14
.DS_Store (disk). **README rewritten** (the public repo said "build not started"). **nav-timing's
evidence append gated on CI** so local runs stop dirtying docs/feel-evidence/nav-timing.md, retiring
the `git checkout --` ritual. **"three shards" → "four legs"** corrected in CLAUDE.md and the skill.
`dummy/` and the UI-LIBRARY-EVALUATION trio kept (Part 0), untouched.

## The gate at `lc-1` (all green on `282c2d2`)

- **App unit: 753 passed. Pipeline: 579 passed, 35 skipped (614).** Unchanged — LC1 added no tests
  (comment_stats.py and vrt-diff.mjs are scripts, not gated). **typecheck · lint · build ·
  check:routes** (every route cached) **· check:bundles** (worst /paper 198.2 KB < 200 ceiling; no
  baseline moved) **· check:fonts** (243 KB, 317 KB headroom) **· check:drift** (28/28) **·
  check:migrations** (live DB matches the repo schema — no migration in LC1).
- **e2e:** the only touched spec (nav-timing) verified green on the seeded phone DB, and both
  branches of its new `process.env.CI` guard proven (a local run leaves the evidence file
  byte-identical; a `CI=1` run appends one row, discarded). **No rehearsal:** LC1 changes no pixels
  and no e2e behavior, so the branch CI is the whole check and the `lc-1` tag run is the full oracle.
- **Branch CI (push, `282c2d2`): run `29419300042` green** (app + pipeline; e2e/vrt correctly
  skipped for a branch push). **Tag run (`lc-1`): run `29419527289` green** — the four-leg oracle
  (7 m 46 s), no VRT candidate minted (0 pixels moved). Full evidence: `docs/lean-evidence/lc1.md`.

## VRT at `lc-1`

Zero baselines changed. LC1 renders no different pixel. **97 VRT baselines total (0 updated, 0
added).**

## What outlives LC1 (all in QUESTIONS-FOR-BISHANT.md; none is a phase, none blocking)

1. **Q-LC1-1 — vrt-diff.mjs uses Playwright's pngjs/pixelmatch, not its own devDependencies.** The
   plan's Part 5.4 said "deps in app devDependencies"; both already resolve from app/node_modules via
   Playwright, and adding them in a leanness phase would churn the lockfile. Reversible in two lines
   if Bishan prefers the explicit form (LC2 would add them). Recorded in DECISIONS.md.
2. **Carried from CC1 (still open, none a phase):** Q-CC1-1 (the ticker-slug fix, its rendered
   picture handed to CC4), Q-PD6-3 (watchlist reason truncation on a phone, now CC4's), the PD10 iOS
   on-glass photo checklist (owed to Bishan's iPhone), and CLARITY Part 0 (P-1/P-2/dawn-cron/retention
   — every default proceeds when its phase arrives: CC5/CC7/CC8/CC10).

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=phone --workers=1 --ignore-snapshots
```
The guard scripts (`check:fonts`, `check:routes`, `check:bundles`, `check:migrations`,
`check:live`) need **Node 24** — Claude Code runs on Node 20, which shadows nvm, so prepend it:
`PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" npm run check:fonts`. **Note the glob trap:**
`~/.nvm/versions/node/v24*` matches TWO installed dirs (v24.14.1 and v24.18.0) and breaks the PATH —
name the version explicitly. `check:live`/`check:nav`/`check:lighthouse` need `set -a; source .env;
set +a` first, and Lighthouse needs `CHROME_PATH`.

## Reading the production brief (how the gate's real check is done — from CC1, still true)

No local psql. Query production directly with a throwaway Prisma script RUN FROM `app/` (so it
resolves `@prisma/client`), with the real `.env` sourced: read `briefing.status`,
`verification_json`, and `am_json.today_focus.body`. The suite going green is NOT the check — the
published prose is (standing memory: `pipeline-phase-verification`).
