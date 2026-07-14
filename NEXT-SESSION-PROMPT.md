# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

# Your session: PD1 — Production made current. PD1 ONLY.

**PD0 is done and tagged `pd-0` (CI green).** The polish & depth build is underway and is **no longer
gated on Bishan's word** — he said go, and the plan runs PD0 → PD10, one phase per session.

Read `POLISH-AND-DEPTH-PLAN.md` **Part 4** (the PD1 playbook) and **Part 12's PD1 entry**. Part 1.3 is
the diagnosis PD1 verifies. Your phase is **PD1 and PD1 only**.

**PD1 is the phase that repairs production.** It is short by design — PD0 built the instrument that
does most of the work, and it has already told you what is wrong.

---

## State of the tree

- `main` is clean, `pd-0` is tagged and green, everything is pushed.
- App unit tests: **617**. Pipeline: **504 local / 533 in CI** (the extra 29 are Postgres-backed and
  skip on this Mac). Anti-drift: **22 rules**.
- **Bundle worst case: `/news` at 196.3 KB against a 200 KB HARD ceiling.** Real headroom is **≈3.7
  KB** — PD0 spent 1.2 KB of it (the NYSE calendar now ships as JSON; see PROGRESS.md). **The plan's
  "≈4.9 KB" is out of date. PD5's kit and PD9's overlay both spend from this pot.**
- Fonts: 243 KB of 560. `check:migrations` was clean.
- Nothing is blocked. Nothing is in flight.

---

## What PD0 left you — this is most of your phase

### `npm run check:live` — the instrument that can see production

```bash
set -a; source .env; set +a          # it needs AUTH_COOKIE_SECRET
cd app && npm run check:live
```

Six checks against the deployed origin. It mints a session cookie exactly as `check-nav.mjs` does, so
it does **not** need the app's password. It is **local-only by nature** — CI structurally cannot
answer any of this, because CI builds a fresh database and a fresh deployment on every run. (Same
reason `check:migrations` is local-only.)

**Its verdict as of 2026-07-13 23:24 ET:**

```
✓ masthead · session truth      2026-07-13   (Monday — correct)
✓ macro board · presence        mortgage · CPI · gold · rupee · mood   (ALL FIVE, populated)
✓ macro pulse · index honesty   real FRED levels (S&P 7,575.39), not ETF prices under index names
✗ session calendar · hygiene    still showing "Coinbase Cryptocurrencies"
✓ news · press-time truth       2026-07-13
… news · byline links           PENDING → PD8 (plan 9.4) — publisher names are plain text today
✓ strip · next-edition promise  Tue
```

**Production has self-healed.** The macro board the user reported as "absent" was never broken — it
was starving on a poisoned edition. Plan 1.3's diagnosis is confirmed. **Verify it formally; do not
re-diagnose it.**

### The ONE live defect — and the plan is WRONG about it

The stale `Coinbase Cryptocurrencies` calendar rows **did not self-heal**, and plan 1.3 #2 predicted
they would. **The reason is exact:** the calendar refresh replaces the **forward window**, and those
rows have fallen **behind** it. A row behind the window is not in the window, so nothing ever touches
it. **Fixing a write path does not clean a table.** Two of them are dated **Jul 11 and Jul 12** — a
Saturday and a Sunday.

This is yours. The write path is already correct (the allowlist landed a month ago), so it is a **data
repair** — and the fence belongs where a row is written or read, so it cannot come back.

---

## Your phase, in order (plan Part 4)

1. **`npm run check:migrations`** — expect clean. Record it.
2. **Confirm the nightly ran green** (`gh run list --workflow=nightly-a --limit 5`). Record the run id.
3. **`npm run check:live`** — the six assertions, table into `docs/pd-evidence/pd1-production.md`.
4. **Screenshots** of the Desk (phone width + 1512 desktop) and `/news`, archived into the evidence
   file. **You CAN take these now** — the login wall opens to a minted cookie (that is how `check:live`
   and `check:nav` get in). An older note in QUESTIONS says production screenshots are impossible; it
   predates the cookie-minting instruments and is **wrong**.
5. **Execute Part 0.1 — THE DELETION BISHAN ALREADY AUTHORISED.** This is **his answer, not your
   assumption** (recorded in the plan at commissioning, and in Q-N6-1):
   ```sql
   DELETE FROM market_context WHERE run_date = '2026-07-11';
   DELETE FROM scan_result    WHERE run_date = '2026-07-11';
   DELETE FROM pipeline_run   WHERE run_date = '2026-07-11';
   ```
   Run it **only after step 3 passes.** Record row counts **before and after**. **`signal_log` is
   untouchable by design** — trigger-guarded, insert-only, deliberately not in that list: signals that
   fired are a historical fact about what the app told the reader, and the ledger is the one thing in
   this product that may never be rewritten.
   Log it in DECISIONS.md as **user-authored**, and close Q-N6-1 in QUESTIONS with a pointer.
6. **Fix the calendar rows** (the live defect above).
7. **Re-run `check:live` — it must be ALL GREEN** (bar the PD8 pending). Then **wire it into the
   standing gate's post-deploy step** (gate step 7) for every later phase, and into CLAUDE.md's
   command list.

**Exit gate:** every 3.6 assertion green against production on real Monday-or-later data · 0.1 executed
and logged · the evidence file's **before/after pair** · `check:live` in the gate text.

---

## The exit ritual — unchanged, and it works (six tags, six first-try greens)

Read **CLAUDE.md's "The Endgame"** block before you exit.

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift`. Once per phase: `check:migrations`.
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` — the **same job the tag runs**, on the
   exact SHA you will tag, before the tag exists. ~8 min, three shards. In parallel: wait for the
   Vercel deploy, then `check:nav`, `check:live`, `check:lighthouse`.
4. **Rehearsal red on pixels?** It mints its own candidates (`vrt-baselines-candidate-<leg>`).
   Download, **OPEN EVERY IMAGE**, commit only an explained diff. Read
   `.claude/skills/vrt-update/SKILL.md` FIRST. An unexplained diff is a **bug**, not a re-bake.
5. **Green → `git tag pd-1 <the rehearsed SHA>` — BY SHA, never `HEAD`.** The nightly pushes a
   heartbeat commit; main moves under you. Push the tag, confirm it green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — never a re-point. But
   **read the failure first**: G2's "flake" was a real race that had failed its retry too.
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd1-production.md` +
   this prompt rewritten, together. **It is free:** `paths-ignore` means a prose-only commit starts no
   CI run at all.
8. **The evidence file ends with the gate-size line.** At `pd-0`: **22 drift rules · 76 VRT baselines ·
   22 e2e specs · 617 unit tests · 16 bundle baselines · 14 manifest rooms.** Growth of the gate is a
   booked decision with a reason, never an accident.

**THE TRAP:** nothing in the gate reads a `paths-ignore`d path (`**/*.md`, `docs/**`, `.claude/**`) —
that is the only reason the filter is safe. **If you write a guard that reads a document, put its path
back in the trigger FIRST**, or the guard breaks silently.

---

## Two traps PD0 walked into, so you do not

- **A LOCAL GREEN WITH A SKIP COUNT IS NOT A GREEN.** Every Postgres-backed pipeline test **skips on
  this Mac** (29 of them). PD0's first push went red in CI on a test that passed locally — and the
  cause turned out to be that the `db` fixture's docstring promised to truncate "every table" while it
  truncated **9 of 23**, so rows leaked from one test into the next. Fixed. But the shape recurs:
  **when a harness can only run in one environment, its bugs live in that environment and nowhere
  else.** Distrust any local green that comes with a skip count.
- **A comment inside a bundled JSON ships to every browser.** A `_comment` key in
  `lib/market-calendar.json` cost `/news` **0.6 KB** against a 200 KB hard ceiling. JSON has no
  comments; a `_comment` key is *data*. Prose belongs in the module that imports it.

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Claude Code exports its own Node 20 into every shell it spawns; `check:fonts`
  then dies with a `globSync` export error. **Not a regression.** Prepend Node 24 in every shell:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`uv run pytest` fails `test_missing_database_url_fails_loudly` if you have sourced the root `.env`**
  — the test asserts a *missing* `DATABASE_URL` fails loudly, and sourcing `.env` sets one. **Not a
  regression.** Run it clean: `env -u DATABASE_URL uv run pytest`.
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced.
- **`/settings` answers in ~400–510 ms, every sample a cache MISS.** Correct, not a regression — it is
  the app's one *writer* room, `force-dynamic` by design, with an argued exemption in
  `check-routes.mjs`. B2 is in report mode for exactly this. Every cached room answers in 41–96 ms.
- **Lighthouse: performance 87, LCP 3.86 s.** Advisory only (synthetic 4G), logged in DECISIONS. The
  two **hard** gates pass: **CLS 0.000** and **first-load JS ≤ 200 KB**. Accessibility 100.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The whole path is proven working. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. **Not yours; leave them.**

## Questions waiting for Bishan — none of them blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).**

- **Q-PD0-1 [VETO?]** the live `Coinbase Cryptocurrencies` calendar rows — **yours to clean.**
- **Q-PD0-2 [FYI]** the 1.2 KB of bundle headroom PD0 spent, and why.
- **Q-G4-1 [VETO?]** PD5's movers delta chip carries `data-p2` (hover = opacity/underline only).
  **PD5 has not started; nothing is built on it. Reversing it still costs one paragraph.**
- **Q-G3-2 [WORTH HIS EYES]** `/academy/[slug]` is neither swept nor pixel-locked. A one-line manifest
  change (`"sweeps": ["touch","scroll","axe"]`). Cheap, and worth doing early in PD.
- Q-G2-1 · Q-G4-2 · Q-G3-1 · Q-G3-3 · Q-G3-4 · Q-G2-2 — all decided, no action needed.

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD1, tag `pd-1`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD2**, **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `uv run pytest` from `pipeline/` → announce
the checkpoint), then begin PD1.
