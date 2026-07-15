# LC1 — the standard, the deletions, the tool

**Tag `lc-1`. Phase of LEAN-CODEBASE-PLAN.md (Plan B), first of `lc-1`…`lc-3`.** Executed 2026-07-15
by Claude Opus 4.8, one phase per session. LC1 sheds weight and sets the comment standard that
governs the nine CC sessions after it. It changes no rendered pixels and no e2e behavior.

## What LC1 did

| # | Item | Proof |
|---|------|-------|
| 0 | Wire `lc-*` into ci.yml — both `on.push.tags` and the e2e oracle's `if:` | `pipeline/tests/test_ci_tag_families.py` green; the family-list comment brought current (it was missing `cc-*` too). |
| a | CLAUDE.md Readability point 3 → the new comment standard ("comments are one line of why", 2026-07-15) | Part 1's text verbatim; points 1/2/4 unchanged. Governs all comment work from LC1 on. |
| b | "three shards" → "four legs" | Corrected in CLAUDE.md (`rehearse:` line + Endgame step 3) and the vrt-update skill (status line + leg enumeration, now naming `mbp16`). Historical evidence chapters left as dated record. |
| c | `pipeline/scripts/comment_stats.py` committed | The measuring script behind Part 2; runs and reproduces Part 2's table (below). |
| d | `app/scripts/vrt-diff.mjs` committed + cited | Self-compare of the 97 baselines returns 0 differing px; RESIZED/NEW/CHANGED/unchanged branches each exercised. Cited from `.claude/skills/vrt-update/SKILL.md`. Deps reuse Playwright's pngjs+pixelmatch (run from `app/`); the orphan root `node_modules/` residue deleted. |
| e | Part 4 `delete` rows executed after a fresh per-row reference re-check | Receipts below. |
| f | README.md rewritten | The now-public repo said "build not started" (false). ~1 page, mechanical voice: product, document map, honesty principles, current status. |
| g | nav-timing.spec.ts evidence append gated on `process.env.CI` | Local run leaves `docs/feel-evidence/nav-timing.md` byte-identical; a `CI=1` run appends one row. The `git checkout --` ritual retired from CLAUDE.md. |

## Deletion receipts (fresh `grep -r` reference re-check per row, 2026-07-15)

| path | tracked | size | reference re-check | verdict |
|------|---------|------|--------------------|---------|
| `Screenshot 2026-07-12 at 6.20.46 PM.png` (repo root; U+202F in name) | yes | 1,303,313 B (1.3 MB) | only meta refs: LEAN-CODEBASE-PLAN.md:147, QUESTIONS-FOR-BISHANT.md:442, NEXT-SESSION-PROMPT.md:64 — no functional reference | **deleted** |
| `docs/KICKOFF-PROMPT.md` | yes | 11,771 B (61 lines) | only meta refs: LEAN-CODEBASE-PLAN.md:148 & :252, NEXT-SESSION-PROMPT.md:65 | **deleted** |
| `.github/workflows/.gitkeep` | yes | 0 B | directory holds 5 workflows; no reference to any `.gitkeep` | **deleted** |
| `pipeline/adapters/fixtures/.gitkeep` | yes | 0 B | directory holds 9 fixture trees; no reference | **deleted** |
| root `node_modules/` (pixelmatch + pngjs, no root package.json) | no (disk) | 1.4 MB | no repo file references the root path; the committed vrt-diff.mjs uses Playwright's copy | **deleted** |
| `.vercel-auth-hash.tmp` | no (disk) | 60 B | gitignored (.gitignore:32); ".env"-style deploy residue | **deleted** |
| `.DS_Store` (disk) | no | ~14 files | OS junk; the audit's "×11" had grown to 14 by execution; none tracked | **deleted** |

Kept per Part 0, untouched and unstaged: `dummy/` (52 PNGs, Plan A's CC1–CC5 evidence — until CC5
tags), the `UI-LIBRARY-EVALUATION` trio (a finished uncommitted deliverable), `news/` (3 reference
PNGs), `FigmaDesignRef/`, `GATE-EFFICIENCY-ANALYSIS.md`.

## comment_stats.py — Part 2's table, reproduced by the committed script

`uv run python -m scripts.comment_stats` (from `pipeline/`):

| directory | files | lines | comment+doc | % | Part 2 said |
|-----------|-------|-------|-------------|---|-------------|
| app/components | 107 | 13,993 | 4,318 | 30.9% | 4,317 / 30.6% |
| app/lib | 96 | 13,154 | 4,129 | 31.4% | 4,085 / 31.1% |
| app/app | 54 | 6,672 | 1,853 | 27.8% | 1,666 / 26.7% |
| app/scripts | 15 | 3,856 | 1,407 | 36.5% | 1,554 / 40.1% |
| app/e2e | 28 | 5,862 | 2,193 | 37.4% | 2,193 / 37.2% |
| pipeline | 131 | 22,874 | 6,737 | 29.5% | 6,596 / 29.3% |
| app/prisma | 28 | 3,739 | 1,240 | 33.2% | 1,238 / 32.9% |

A faithful reproduction: `app/e2e` matches to the line (2,193), `app/prisma` to two lines, Python
files match the audit exactly (job_a.py 397, narrate.py 327, nightly.py 288, publish.py 235). The
one real gap is check-drift.mjs (this script: 331; the audit: 478) and it is the whole `app/scripts`
difference: the audit counted C-family inline trailing comments, this script counts full-line
comments only — uniformly with its Python treatment, which is exactly what Part 2's text specifies
("full-line comments via tokenizer"). The committed script is the instrument for LC3's before/after,
so its own consistency is what matters, and it is internally consistent by construction.

The refreshed top of the LC3 worklist (this script): job_a.py 397 · copy.ts 353 · morning.ts 345 ·
check-drift.mjs 331 · narrate.py 327 · vrt.spec.ts 318 · nightly.py 288 · schema.prisma 286 ·
fixtures/news.mjs 275 · desk.spec.ts 253 · publish.py 235.

## The gate (all green on `282c2d2`)

Local gate, all green: **typecheck · lint · app unit 753 passed · pipeline 579 passed / 35 skipped
(614) · build · check:routes** (B1 every route cached) **· check:bundles** (worst /paper 198.2 KB <
200 ceiling; no baseline moved) **· check:fonts** (243 KB, 317 KB headroom) **· check:drift** (28/28)
**· check:migrations** (live DB matches the repo schema — no migration in LC1). e2e: the only touched
spec (nav-timing) verified green on the seeded phone DB, and both branches of its new `CI` guard
proven (local run does not append; `CI=1` appends one row, discarded). No rehearsal: LC1 changes no
pixels and no e2e behavior, so the branch CI (app + pipeline) is the whole check, and the `lc-1` tag
run is the full four-leg oracle.

- **Branch CI (push, `282c2d2`): run `29419300042`** — app + pipeline green (e2e/vrt correctly
  skipped for a branch push).
- **Tag run (`lc-1`): run `29419527289`** — the four-leg oracle (desktop · phone · wide · mbp16)
  green, first try; no `vrt-baselines-candidate-*` artifact minted, so no baseline moved a pixel.

## Gate size (unchanged from cc-1 — hygiene adds no gate surface)

**28 drift rules · 97 VRT baselines (0 updated) · 26 e2e specs · 753 app unit tests · 614 pipeline
tests · 16 bundle baselines · 14 manifest rooms · 4 oracle legs · tag run 7 m 46 s.**
