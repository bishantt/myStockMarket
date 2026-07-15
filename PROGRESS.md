# PROGRESS.md — resumable state

# LC3 IS DONE — tagged `lc-3` (2026-07-15). LEAN-CODEBASE is COMPLETE. Next phase: CC2.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

**Checkpoint: LC3 (hot-file comment compression) is DONE and tagged `lc-3` by SHA on `16f83cd`.
LEAN-CODEBASE (all three phases) is finished. Nothing is blocked. Nothing is in flight. The next
phase is CC2** (CLARITY-AND-CADENCE-PLAN.md — "Time, told properly"), and NEXT-SESSION-PROMPT.md is
the paste-ready prompt for it.

## What LC3 did, in one paragraph

LC3 compressed the comments in the 25 hottest files (a fifth of all comment lines, the files every
session reads) to the "one line of why" standard. Every WHY survives at ≤2 lines; essays became
sentences; restatement died. **It changed no line of code and no rendered pixel** — comments do not
render, and the whole thing was proved comment-only per batch by a new tool. First act:
`pipeline/scripts/comment_prover.py`, which proves an edit is comment-only three ways (TS/JS/MJS: the
TypeScript **parser**'s leaf-token streams identical — the parser not the raw scanner, which swallows
comments into mis-scanned regex/template tokens; Python: `ast.dump` identical after zeroing docstrings
+ a non-docstring-string check; prisma/css: whole-line-deletion-only) plus a sacred-pattern count
guard. The sacred list (Part 3) was left verbatim throughout: `# noqa`/`@vitest-environment`/
`eslint-disable` pragmas, the clock derived-date comments, check-drift.mjs's argued skip-lists, and
brand-assets.mjs's BRAND_FIELD provenance. **Result: 5800 → 4034 comment lines (−1766, 30%.)** The
plan predicted "half"; the honest 30% is the sacred list doing its job (see QUESTIONS + evidence).

## The gate at `lc-3` (all green on `16f83cd`)

- **App unit: 753 passed. Pipeline: 579 passed, 35 skipped (614).** Unchanged — LC3 adds no test.
  **typecheck · lint · build · check:routes** (B1 14/15 cached) **· check:bundles** (B4 worst /paper
  198.2 KB < 200) **· check:fonts** (243 KB, 317 KB headroom) **· check:drift** (28/28) **·
  check:migrations** (live DB matches the repo schema — no migration in LC3).
- **e2e:** deferred to the CI rehearsal (comments-only, prover-proven byte-identical; the Mac reds
  ~46 Linux-born snapshots). The four-leg oracle is the authoritative proof — see below.
- **Branch CI (push, `16f83cd`): run `29432105571` green** (app + pipeline). **Rehearsal (four-leg
  oracle): run `29432136961`.** **Tag run (`lc-3`): run `29432745654` — four-leg oracle, green.**
  Full evidence: `docs/lean-evidence/lc3.md`.

## VRT at `lc-3`

Zero baselines changed. Comments do not render, so no pixel moved (no `vrt-baselines-candidate-*`
artifact minted by the rehearsal). **97 VRT baselines total (0 updated, 0 added).**

## The prover — the one new tool LC3 leaves behind

`pipeline/scripts/comment_prover.py` (committed FIRST, `064688e`). Run it before/after any comment
edit: `cd pipeline && uv run python -m scripts.comment_prover <path>...` — must print `PROVED —
comment-only`. It is a dev instrument (like comment_stats.py and vrt-diff.mjs from LC1), self-tested
on 30 adversarial cases, not in the gate suite. A REJECT is a real finding, not a baseline to wave
through. See PATTERNS.md ("Prove a comment-only edit").

## What outlives LC3 (all in QUESTIONS-FOR-BISHANT.md; none is a phase, none blocking)

1. **Q-LC1-1 — vrt-diff.mjs reuses Playwright's pngjs/pixelmatch, not its own devDependencies.** Still
   open (no veto in DECISIONS.md through LC1/LC2/LC3, so left as-is per the handoff). LEAN is done, so
   it now travels with the CC phases or waits for Bishan. A two-line change if he wants the explicit form.
2. **Carried from CC1 (still open, none a phase):** Q-CC1-1 (the ticker-slug fix, its rendered picture
   handed to CC4), Q-PD6-3 (watchlist reason truncation on a phone, now CC4's), the PD10 iOS on-glass
   photo checklist (owed to Bishan's iPhone), and CLARITY Part 0 (P-1/P-2/dawn-cron/retention — every
   default proceeds when its phase arrives: CC5/CC7/CC8/CC10).

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots   # one project at a time
```
The guard scripts (`check:fonts`, `check:routes`, `check:bundles`, `check:migrations`, `check:live`)
need **Node 24** — Claude Code runs Node 20, which shadows nvm, so prepend it:
`PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" npm run check:fonts`. **The glob trap:**
`~/.nvm/versions/node/v24*` matches TWO installed dirs and breaks the PATH — name the version
(`v24.18.0`) explicitly. `check:live`/`check:nav`/`check:lighthouse` need `set -a; source .env; set +a`
first (AUTH_COOKIE_SECRET is in the repo-root .env), and Lighthouse needs `CHROME_PATH`.

## The three committed LEAN tools (LC1–LC3 left them; every future session may use them)

- `pipeline/scripts/comment_stats.py` — `uv run python -m scripts.comment_stats` (from `pipeline/`):
  comment density per directory + the top-25 worklist + the before/after instrument.
- `pipeline/scripts/comment_prover.py` — the LC3 prover (above).
- `app/scripts/vrt-diff.mjs` — `node scripts/vrt-diff.mjs <candidate-dir>` (from `app/`): decodes every
  VRT candidate against its committed twin and prints differing-pixel counts, if a rehearsal leg reds.
