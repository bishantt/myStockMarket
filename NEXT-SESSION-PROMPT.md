# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

# Your session: PD2 — Brand: the identity kit. PD2 ONLY.

**PD1 is done and tagged `pd-1` (CI green, first try — seven tags, seven first-try greens).**
**Production is repaired, verified, and now WATCHED by the standing gate.** The polish & depth build
runs PD0 → PD10, one phase per session, and it is not gated on Bishan's word — he said go.

Read `POLISH-AND-DEPTH-PLAN.md` **Part 5** (the PD2 manufacturing spec) and **Part 12's PD2 entry**.
Your phase is **PD2 and PD2 only**.

PD2 is unusually well specified: Part 5 is a complete manufacturing spec — one source file, one
generator script, and an artifact table (5.2) where **every row names its size, geometry, budget and
consumer**. Follow it. It produces a finished identity, not "a PNG dropped in and hoped".

---

## State of the tree

- `main` is clean, `pd-1` is tagged and green, everything is pushed.
- App unit tests: **625**. Pipeline: **535** (534 + 1 skipped locally with Postgres up; CI runs them
  all). Anti-drift: **22 rules**. VRT baselines: **76**. e2e specs: **22**. Rooms: **14**.
- **Bundle worst case: `/news` at 196.3 KB against a 200 KB HARD ceiling. Real headroom is ≈3.7 KB.**
  The plan's "≈4.9 KB" is out of date. PD5's kit and PD9's overlay both spend from this pot.
  **PD2 should not move it at all** — images are not code, and `check:bundles` proves it by not moving.
- Fonts: 243 KB of 560. `check:migrations` clean. `check:live` **all six green**.
- Nothing is blocked. Nothing is in flight.

---

## PD2's one prerequisite — CHECKED, and it is present

Plan **PP-1** wants the logo master at **`assets/brand/logo-source.png`** (repo root `assets/`,
deliberately OUTSIDE `app/public/` so the 1.2 MB master never ships to a browser).

- **`assets/brand/` does not exist yet.** That is expected — PD2 creates it.
- **The source file IS on this machine: `~/Desktop/myLogo11.png` (1,202,569 bytes, verified
  2026-07-14).** The plan authorises PD2 to copy it into place itself and log the copy. Do that first.
- There are also `~/Desktop/myLogo.png` and `myLogo1.png`. **The plan names `myLogo11.png`. Use that
  one.** If it does not look like the described mark (a circular white "M" with a candlestick ascent
  and an open book, on a deep indigo field with a violet ring), stop and check the others before
  generating twenty artifacts from the wrong master.

**Nothing else depends on these pixels.** If the master turns out to be unusable, PD2 alone parks with
a `[NEED]` in QUESTIONS and the build continues at PD3.

---

## What PD1 left you — read these two before you write code

### 1. `npm run check:live` is now IN THE STANDING GATE

```bash
set -a; source .env; set +a          # it needs AUTH_COOKIE_SECRET
cd app && npm run check:live
```

Six assertions against the deployed origin. **It must be GREEN at your post-deploy step.** A PENDING
assertion owed to a later phase (today: news bylines, owed to PD8) is fine; a FAIL is not. It is
**local-only by nature** — CI builds a fresh database and deployment every run, so it structurally
cannot answer this (same reason as `check:migrations`).

**IF IT REDS, READ THE FAILURE BEFORE YOU BELIEVE IT.** Two of PD1's three reds were the *checker*
being wrong, not the Desk.

### 2. THE EDITION RULE — PD1's law, and it will bite you again

> **IF A SURFACE IS DERIVED FROM THE EDITION, IT IS MEASURED AGAINST THE EDITION — never the wall
> clock.**

This app serves a dated **edition**, like a newspaper. Monday's paper is still Monday's paper at 1am on
Tuesday. Three surfaces broke this rule and all three were found within one hour of each other; **two
of them were in the instrument, and they would have failed a perfectly healthy Desk every night**
between midnight ET and the ~6:40pm publish. It is in CLAUDE.md's `live:` block and in PATTERNS.md.

**PD2 is a visual phase and probably will not touch a clock — but every later phase that filters,
labels or checks anything dated must obey this, and the failure mode is invisible at the hour you
usually work.**

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD2, tag `pd-2`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD3**, **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `uv run pytest` from `pipeline/` → announce
the checkpoint), then begin PD2.

---

## The exit ritual — unchanged, and it works (seven tags, seven first-try greens)

Read **CLAUDE.md's "The Endgame"** block before you exit.

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift`. Once per phase: `check:migrations`.
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` — the **same job the tag runs**, on the
   exact SHA you will tag, before the tag exists. ~8 min, three shards. In parallel: wait for the
   Vercel deploy, then **`check:live`**, `check:nav`, `check:lighthouse`.
4. **Rehearsal red on pixels? PD2 WILL DO THIS — you are changing the favicon and the top-bar mark,
   so VRT baselines containing the brand SHOULD move.** The run mints its own candidates
   (`vrt-baselines-candidate-<leg>`). Download, **OPEN EVERY IMAGE**, commit only an **explained**
   diff. Read `.claude/skills/vrt-update/SKILL.md` FIRST. **The candidate is EVERY shot, not the shots
   that moved** — `--update-snapshots=all` re-photographs all 76, so copying the whole directory
   commits files nobody can explain. The triptych (`playwright-failures-<leg>`) is the list of what
   *actually* moved. An unexplained diff is a **bug**, not a re-bake.
5. **Green → `git tag pd-2 <the rehearsed SHA>` — BY SHA, never `HEAD`.** The nightly pushes a
   heartbeat commit; main moves under you. Push the tag, confirm it green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — never a re-point. But
   **read the failure first**: G2's "flake" was a real race that had failed its retry too.
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd2-brand.md` + this
   prompt rewritten, together. **It is free:** `paths-ignore` means a prose-only commit starts no CI run.
8. **The evidence file ends with the gate-size line.** At `pd-1`: **22 drift rules · 76 VRT baselines ·
   22 e2e specs · 625 unit tests · 16 bundle baselines · 14 manifest rooms.** Growth of the gate is a
   booked decision with a reason, never an accident. **PD2 adds a drift rule** (the brand-hex second
   door) **and will move VRT baselines** — book both.

**THE TRAP:** nothing in the gate reads a `paths-ignore`d path (`**/*.md`, `docs/**`, `.claude/**`) —
that is the only reason the filter is safe. **If you write a guard that reads a document, put its path
back in the trigger FIRST**, or the guard breaks silently.

---

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Claude Code exports its own Node 20 into every shell it spawns; `check:fonts`
  then dies with a `globSync` export error. **Not a regression.** Prepend Node 24 in every shell:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. **PD2 uses `sharp` and `png-to-ico` —
  run the generator on Node 24 too, or the native bindings will surprise you.**
- **`uv run pytest` fails `test_missing_database_url_fails_loudly` if you have sourced the root `.env`.**
  Not a regression. Run it clean: `env -u DATABASE_URL uv run pytest`.
- **The 29 Postgres-backed pipeline tests skip on this Mac — but they do NOT have to.** PD1 ran them
  locally: `docker run -d --name msm-pd1-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=msm_test -p 55433:5432 postgres:16`,
  then `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55433/msm_test" uv run pytest`.
  **Do this whenever you touch a database write path.** PD2 almost certainly does not — but PD3+ will.
  **A local green with a skip count is not a green.**
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. **Advisory perf is 87 and it varies ±10 between samples — RE-SAMPLE
  before you explain a move.** The two HARD gates are CLS 0.000 and first-load JS ≤ 200 KB.
- **`/settings` answers in ~400 ms, every sample a cache MISS.** Correct — the app's one *writer* room,
  `force-dynamic` by design, with an argued exemption. Every cached room answers in 43–205 ms.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The whole path is proven working. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. **Not yours; leave them.**

---

## Questions waiting for Bishan — none of them blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).** There is currently one **user-authored** line (PD1's deletion) and one
**[user-approved]** line (the muted-token contrast floor). Both are already honored.

- **Q-G4-1 [VETO?]** PD5's movers delta chip carries `data-p2` (hover = opacity/underline only).
  **PD5 has not started; nothing is built on it. Reversing it still costs one paragraph.**
- **Q-G3-2 [WORTH HIS EYES]** `/academy/[slug]` is neither swept nor pixel-locked. A one-line manifest
  change (`"sweeps": ["touch","scroll","axe"]`). Cheap, and worth doing early in PD.
- **[FYI, PD1] A tracked file went missing from the working tree and I restored it.**
  `Screenshot 2026-07-12 at 6.20.46 PM.png` (repo root, committed in `cb20a9f`) showed up as deleted
  mid-session; **PD1 did not delete it and could not account for what did.** Restored byte-for-byte
  from HEAD rather than committing the deletion. **If you see it deleted again, say so — twice is a
  pattern.**
- **Q-N6-1, Q-PD0-1 — CLOSED at PD1.** The Saturday rows are deleted (his decision, carried out and
  logged as user-authored); the Coinbase calendar rows are gone and both ends are fenced.
- Q-PD0-2 · Q-G2-1 · Q-G4-2 · Q-G3-1 · Q-G3-3 · Q-G3-4 · Q-G2-2 — all decided, no action needed.
