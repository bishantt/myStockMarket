# LC3 — the hot-file comment compression (evidence)

**Phase:** LC3 of LEAN-CODEBASE-PLAN.md (Plan B, the last LEAN phase). Tag `lc-3`.
**Date:** 2026-07-15. Executor: Claude Opus 4.8.

## What LC3 did, in one paragraph

LC3 compressed the comments in the 25 hottest files — a fifth of all comment lines, the files every
session reads — to the "one line of why" standard (CLAUDE.md Readability point 3, made law in LC1).
Every WHY survives at ≤2 lines; essays became sentences; restatement died. **Comments do not render,
so nothing about the product changes** — the whole risk is drift/pragma breakage, and it was held off
by two things: the new prover proved each batch comment-only mechanically, and the sacred list (Part 3)
was never stripped or reworded. This is NOT the total repo strip (Part 0.5, rejected in LC1) — only
the top-25; the long tail converges via the boy-scout rule.

## The prover — committed FIRST (`pipeline/scripts/comment_prover.py`)

Per Part 6 LC3, the prover proves per batch that an edit changed only comments, by three methods keyed
to the file kind, plus a sacred-pattern count guard:

- **TS/TSX/JS/MJS:** parse with the real TypeScript compiler and compare the LEAF-TOKEN streams
  (kind + text). The parser, not the raw scanner, is used deliberately — only the parser resolves
  regex-vs-divide and template `${}` continuations without swallowing comments (the raw scanner's first
  cut swallowed a comment into a mis-scanned template token in morning.ts and a regex in check-drift).
  JSDoc `/** */` nodes are skipped, because the compiler parses those into the AST unlike `//` / `/* */`
  trivia. A block comment that separates two tokens (`a/**/b` → `ab`) is correctly REJECTED.
- **Python:** `ast.dump` equality after zeroing every docstring, plus a check that no non-docstring
  string constant changed. `#` comments never touch the AST, so they compress freely.
- **prisma / css / scss / yaml / sql:** whole-line-deletion-only — every line a diff hunk removes or
  adds must be a comment line in its own file (a per-line CSS scanner tracks strings so a `/*` inside a
  string is not read as a comment).
- **Part 7.1 guard (all kinds):** the sacred pragma patterns must have identical per-file counts old vs
  new (`@vitest-environment`, `eslint-disable`, `@ts-expect-error`, `# noqa`, `# type: ignore`,
  `prettier-ignore`), and in the clock-sensitive trees (prisma/fixtures, prisma/seed, e2e) the derived-
  date comments must too.

Self-tested on 30 positive/negative cases (comment removed → pass; code/string change, `a/**/b` merge,
deleted pragma, deleted clock date → reject). Committed as the first act, then used after every batch.

## The four batches — prover output per batch (all `PROVED — comment-only`)

**Batch 1 — app/lib + app/app (8 files):** copy.ts · morning.ts · news.ts · macro-board.ts ·
pipeline-control.ts · (desk)/page.tsx · globals.css · styleguide/page.tsx. Prover: 8 ok, `sacred: none
present`. Then typecheck · lint · `npm test` 753 · `check:drift` 28/28.

**Batch 2 — app/components (1 file):** PipelinePanel.tsx. Prover: `token streams identical (2110
tokens); sacred: eslint-disable×1` (the pragma survived). Then `npm test` 753.

**Batch 3 — app/e2e + app/scripts (8 files):** vrt.spec.ts · desk.spec.ts · hardening.spec.ts ·
a11y.spec.ts · check-drift.mjs · check-bundles.mjs · live-truth.mjs · brand-assets.mjs. Prover: 8 ok
(a11y `@vitest`-free but in the clock tree — its `2026-07-12` prose date is not a `//`-prefixed clock
date, count 0). Then typecheck · lint · `npm test` 753 · `check:drift` 28/28. check-drift.mjs still runs
and prints all 28 rules pass; its ARGUED skip-lists (P11 "argued in place"), brand-assets.mjs's
BRAND_FIELD provenance, and rule 21's derived-date exemption were left verbatim.

**Batch 4 — pipeline + prisma (8 files):** job_a.py · narrate.py · nightly.py · publish.py ·
test_narrate.py · schema.prisma · fixtures/news.mjs · fixtures/fixtures.test.ts. Prover: 8 ok, sacred
counts preserved — `noqa×9` (job_a), `noqa×2` (narrate), `noqa×4` (nightly, test_narrate), `clock-date×2`
(news.mjs — the two `sessionAt`/`sessionPlus` derived-date comments), `@vitest-environment×1`
(fixtures.test.ts). Then `env -u DATABASE_URL uv run pytest` 579 passed / 35 skipped · `npm test` 753.
(The four pipeline Python files were compressed by parallel subagents under precise instructions and
re-proved here; the prisma schema and both fixtures — the sacred-sensitive files — were done by hand.)

## Before/after (comment_stats.py, the LC1 instrument)

| file | before | after | Δ |
|---|--:|--:|--:|
| `pipeline/jobs/job_a.py` | 397 | 266 | −131 |
| `app/lib/copy.ts` | 353 | 235 | −118 |
| `app/lib/morning.ts` | 345 | 246 | −99 |
| `app/scripts/check-drift.mjs` | 331 | 276 | −55 |
| `pipeline/newsdesk/narrate.py` | 327 | 243 | −84 |
| `app/e2e/vrt.spec.ts` | 318 | 178 | −140 |
| `pipeline/nightly.py` | 288 | 250 | −38 |
| `app/prisma/schema.prisma` | 286 | 206 | −80 |
| `app/prisma/fixtures/news.mjs` | 275 | 201 | −74 |
| `app/e2e/desk.spec.ts` | 253 | 172 | −81 |
| `pipeline/publish.py` | 235 | 192 | −43 |
| `app/lib/news.ts` | 203 | 151 | −52 |
| `app/app/(desk)/page.tsx` | 199 | 100 | −99 |
| `app/components/settings/PipelinePanel.tsx` | 199 | 112 | −87 |
| `app/e2e/hardening.spec.ts` | 189 | 102 | −87 |
| `app/app/globals.css` | 187 | 146 | −41 |
| `app/scripts/check-bundles.mjs` | 185 | 100 | −85 |
| `app/lib/macro-board.ts` | 178 | 128 | −50 |
| `pipeline/tests/test_narrate.py` | 169 | 142 | −27 |
| `app/app/styleguide/page.tsx` | 164 | 107 | −57 |
| `app/lib/pipeline-control.ts` | 153 | 96 | −57 |
| `app/scripts/live-truth.mjs` | 152 | 99 | −53 |
| `app/prisma/fixtures/fixtures.test.ts` | 144 | 112 | −32 |
| `app/scripts/brand-assets.mjs` | 136 | 100 | −36 |
| `app/e2e/a11y.spec.ts` | 134 | 74 | −60 |
| **TOTAL (25 files)** | **5800** | **4034** | **−1766 (30%)** |

**Honest note on the number.** The plan predicted "roughly half the comment mass (≈4–6k lines)". The
actual is 30% (1766 lines), not 50%, and the reason is the sacred list did its job: check-drift.mjs
(only −55) is mostly argued skip-list entries that Part 3.3 forbids touching; brand-assets.mjs's
BRAND_FIELD provenance stays; news.mjs's per-cluster significance ARITHMETIC (`// scope 1.0 · corrob …
= 0.800`) is a genuine why a reader checks by hand and stays; the fixture test-name strings are code.
The prize was never the percentage — it is the recurring token cost of the hot files, and that is
paid down: copy.ts, morning.ts, the desk page, vrt.spec each shed ~100–140 lines.

## The gate at `lc-3`

- **App unit: 753 passed. Pipeline: 579 passed, 35 skipped (614).** Unchanged — LC3 adds no test
  (comment_prover.py is a dev instrument, like comment_stats.py and vrt-diff.mjs; it is self-tested but
  not in the suite). **typecheck · lint · build · check:routes** (B1: 14/15 cached) **· check:bundles**
  (B4: worst /paper 198.2 KB < 200 ceiling) **· check:fonts** (243 KB, 317 KB headroom) **· check:drift**
  (28/28) **· check:migrations** (live DB matches the repo schema — no migration in LC3).
- **e2e:** LC3 changed no line of code and no rendered pixel — the prover proves the compiled output is
  byte-identical (token streams / ASTs identical). So the authoritative e2e proof is the four-leg CI
  rehearsal, not the Mac's snapshot-red local run. Rehearsal (four-leg oracle) and tag run below.

## CI

- **Branch CI (push, `16f83cd`): run `29432105571`** — app + pipeline (a MIXED commit runs in full).
- **Rehearsal (four-leg browser oracle, workflow_dispatch on `16f83cd`): run `29432136961`** — the same
  job the tag runs, collected before the tag. No `vrt-baselines-candidate-*` artifact minted: comments
  do not render, so zero pixels moved.
- **Tag run (`lc-3`): run `29432745654` (7 m 35 s)** — the four-leg oracle, green.

## Carried-forward / open

- **Q-LC1-1 (vrt-diff.mjs devDependencies)** remained open with no veto in DECISIONS.md, so per the
  handoff it was left as-is (vrt-diff reuses Playwright's pngjs/pixelmatch). Not folded into LC3.
- **No new questions.** One process finding, logged in DECISIONS: the prover had to be a PARSER, not a
  scanner, and it caught its own weakness on the first real file — a lesson worth keeping.

## Gate-size line

28 drift rules · 97 VRT baselines · 26 e2e specs · 753 unit tests · 16 bundle baselines · 14 manifest
rooms · tag run `7 m 35 s`. (Unchanged from lc-2 — LC3 adds no gate mechanism, only the
comment_prover.py instrument.)
