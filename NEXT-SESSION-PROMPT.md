# Your session: LC1 — the standard, the deletions, the tool. LC1 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1 is DONE and tagged `cc-1`.** Two plans sit at
the repo root: **CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and **LEAN-CODEBASE-PLAN.md**
(Plan B, `lc-1`…`lc-3`). The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 → LC2 → LC3 → CC2 → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

You run **LC1 of LEAN-CODEBASE-PLAN.md and nothing else** — one phase per session is standing law
(CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked.

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, the phase evidence file).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, that is **LC2** of LEAN-CODEBASE-PLAN.md) —
   carrying this handoff rule forward verbatim in spirit, the phase-order line, the phase's build list
   distilled from its plan, its gate, and anything in flight the next session must know. Assume the
   next session has NO memory of yours.
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into LC2.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for answers to LEAN-CODEBASE Part 0
   (0.1 deletion list, 0.2 dummy/, 0.3 README, 0.4 nav-timing append, 0.5 comment verdict) — the
   defaults proceed if silent.
2. Read LEAN-CODEBASE-PLAN.md in full before touching anything — especially Part 0, Part 1 (the
   comment standard + the CLAUDE.md amendment text, verbatim), Part 3 (the sacred list — never strip),
   Part 4 (the deletion table), Part 5.4 (the VRT diff tool), Part 6 LC1, Part 7.
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 753 · pipeline 579 passed / 35 skipped**.

## LC1's build list (the plan's Part 6 LC1 is authoritative; this is the distillation)

FIRST STEP, before anything else: **wire the `lc-*` tag family into ci.yml's tag filter** — BOTH
sites (the `on.push.tags` list ~line 68, and the e2e job's `if:` ~line 275). `pipeline/tests/
test_ci_tag_families.py` proves the two agree; run it green. (This is exactly what CC1 did for `cc-*`.
The canonical workflow is `.github/workflows/ci.yml` at the REPO ROOT — there is no `app/.github/`.)

- **(a) The CLAUDE.md amendment (Part 1):** write Part 1's amended Readability point 3 VERBATIM
  ("Comments are one line of why", dated 2026-07-15, superseding the 2026-07-10 point 3; points 1, 2,
  4 stand unchanged). This governs all comment work from LC1 on.
- **(b) The "three shards" → "four legs" correction:** the oracle has had FOUR legs since PD3
  (desktop, phone, wide, mbp16 — ci.yml's own matrix). Correct any doc/skill/comment that still says
  "three shards" (grep for it; the vrt-update skill is one known site).
- **(c) Commit `pipeline/scripts/comment_stats.py`** — the measuring script (full-line comments via
  tokenizer, docstrings via ast, string literals never miscounted). It makes LC3's before/after claim
  reproducible. (Part 2 names it.)
- **(d) Commit the VRT candidate-diff tool (Part 5.4)** as a proper committed script (e.g.
  `app/scripts/vrt-diff.mjs`) so "diff every candidate" is a tool, not a hand-roll — AND delete the
  orphaned **root `node_modules/`** (pixelmatch+pngjs residue of the hand-roll; Part 4). Add the skill
  citation Part 6 names. NOTE: a working reference implementation exists from CC1 — it decodes each
  candidate PNG with pngjs + pixelmatch and prints differing-pixel counts and dimension changes; the
  app already depends on pngjs+pixelmatch via Playwright, so run it from `app/` so it resolves them
  from `app/node_modules`.
- **(e) Execute Part 4's `delete` rows — with a FRESH `grep -r` reference re-check per row first;**
  any row that has GAINED a reference since 2026-07-15 is skipped and LOGGED, not force-deleted.
  Rows: the repo-root `Screenshot 2026-07-12 at 6.20.46 PM.png` (U+202F in the name) · docs/
  KICKOFF-PROMPT.md · .github/workflows/.gitkeep · pipeline/adapters/fixtures/.gitkeep ·
  .vercel-auth-hash.tmp (disk) · root node_modules/ (disk) · .DS_Store ×11 (disk).
  **DO NOT delete `dummy/`** (row is `ask`; default KEEP until CC5 tags) and **DO NOT touch the
  UI-LIBRARY-EVALUATION trio** (keep — a finished uncommitted deliverable).
- **(f) README rewrite (Part 0.3):** it says "build not started" (affirmatively false on a public
  repo). Rewrite it ~1 page, mechanical voice: what the product is, the document map, the honesty
  principles, current status.
- **(g) Part 0.4 (default proceeds unless vetoed):** gate `nav-timing.spec.ts`'s sample-append on
  `process.env.CI` so local runs stop dirtying `docs/feel-evidence/nav-timing.md` (retires the
  `git checkout --` ritual). Touching that spec's append condition does NOT change any rendered pixel.

Scope discipline: LC2 and LC3 items are NOT LC1's. LC1 does NOT do the e2e session-helper extraction
(LC2) nor the hot-file comment compression (LC3). Log anything else you notice; don't fix it.

## LC1's gate (the Endgame, CLAUDE.md)

Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
`check:bundles` + `check:fonts` · `e2e:local` · `check:drift`; once-per-phase `check:migrations`) →
push to main → **confirm the branch CI green**. **LC1 changes no pixels and no e2e behavior, so NO
rehearsal is needed** (Part 6 LC1 says so explicitly — a docs+scripts+deletions push runs the normal
branch CI, which is the whole check). Then tag `lc-1` **by SHA** (never HEAD — the nightly heartbeat
can move main) → push → confirm the tag run → ONE docs commit after (evidence file
**`docs/lean-evidence/lc1.md`** with the deletion receipts: path, size, and the fresh ref-recheck
output per row; intelligence files; this file rewritten for LC2). Every evidence file ends with the
gate-size line. Then report to Bishan and STOP.

## Carry-forward notes (do not lose these)

- **`cc-1` state:** app **753** unit · pipeline **579** passed / 35 skipped · **97 VRT baselines**
  (1 updated at cc-1: desk-thin-night) · **26 e2e specs** · **28 drift rules** · 14 rooms · 4 oracle
  legs. Tag `cc-1` on `c545612`, rehearsal `29396039314` green, tag run `29396552183`.
- **The guard scripts need Node 24** (Claude Code runs on Node 20 and shadows nvm). Prepend it:
  `PATH="$(ls -d ~/.nvm/versions/node/v24*)/bin:$PATH" npm run check:fonts`. `check:live` /
  `check:nav` / `check:lighthouse` need `set -a; source .env; set +a`; Lighthouse needs `CHROME_PATH`.
- **A pipeline bug CC1 found and fixed, worth knowing:** the briefing synthesis (`briefing/
  synthesize.py`) was holding the brief roughly every other night because sonnet-5's adaptive thinking
  ate the whole `max_tokens=4096` budget (0-char response). Fixed onto `newsdesk/narrate.py`'s pattern
  — `max_tokens=16000` + `effort:"medium"` inside `output_config`. If you ever see a Sonnet-5
  structured-output call return 0 chars / `stop_reason=max_tokens` / a lone `thinking` block, that is
  always it. (Standing memory: `pipeline-phase-verification`.)
- **The brief may show "briefing unavailable" on the live Desk on some nights** — that is the verify
  gate holding an over-narrated draft (>2 unverifiable numbers), the base rate the plan anticipated
  (§2), NOT the structural bug CC1 fixed. It self-heals on the next clean-narration nightly run.
- **Open questions (QUESTIONS-FOR-BISHANT.md, none blocking):** Q-CC1-1 (ticker-slug rendered proof
  handed to CC4), Q-PD6-3 (watchlist reason truncation, now CC4's), the PD10 iOS on-glass photos
  (Bishan's device), and CLARITY Part 0 (P-1/P-2/dawn-cron/retention — defaults proceed).
- **`dummy/`** (Plan A's screenshot evidence) stays untracked/kept until CC5. Do not commit or delete
  it in LC1.
