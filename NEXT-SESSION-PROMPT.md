# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

# Your session: PD3 — The desktop grid contract v2. PD3 ONLY.

**PD2 is done and tagged `pd-2` (CI green, first try — eight tags, eight first-try greens).**
**The app has a face now.** The polish & depth build runs PD0 → PD10, one phase per session, and it is
not gated on Bishan's word — he said go.

Read `POLISH-AND-DEPTH-PLAN.md` **Part 6** (the PD3 spec) and **Part 12's PD3 entry**.
Your phase is **PD3 and PD3 only**.

PD3 is: Law 1 on the Desk (wrapper composition + a per-viewport visual-order e2e), Law 2 (extract
`EmptyModule`, add the `min-h` grep rule), extract `PageContainer`, record the per-room verification
pass, add the `mbp16` VRT project + a thin-night seed variant, and the no-dead-gap e2e.
**Exit gate additions:** 6.5's suites · `docs/pd-evidence/pd3-grid.md` with the room × width table and
the 1512 before/after · zero horizontal scroll at 390/1512/1536 · the thin-night shot baselined.

---

## State of the tree

- `main` is clean, `pd-2` is tagged and green, everything is pushed.
- App unit tests: **638**. Pipeline: **535** (504 + 31 skipped locally without Postgres; CI runs all).
  Anti-drift: **23 rules**. VRT baselines: **76**. e2e specs: **23**. Rooms: **14**.
- **Bundle worst case: `/news` at 196.3 KB against a 200 KB HARD ceiling — ≈3.7 KB of real headroom.**
  PD2 did not move it at all (images are not code). **PD5's kit and PD9's overlay both spend from this
  same pot.** PD3 is structure, not JS, so it should barely move — but `check:bundles` is in the gate.
- Fonts: 243 KB of 560. `check:migrations` clean. `check:live` **all six green** (1 PENDING, owed to PD8).
- Nothing is blocked. Nothing is in flight.

---

## What PD2 left you — read these THREE before you write code

### 1. `npm run check:live` is IN THE STANDING GATE

```bash
set -a; source .env; set +a          # it needs AUTH_COOKIE_SECRET
cd app && npm run check:live
```

Six assertions against the deployed origin. **It must be GREEN at your post-deploy step.** A PENDING
assertion owed to a later phase (today: news bylines, owed to PD8) is fine; a FAIL is not.
**IF IT REDS, READ THE FAILURE BEFORE YOU BELIEVE IT** — two of PD1's three reds were the *checker*
being wrong, not the Desk.

### 2. THE EDITION RULE — PD1's law

> **IF A SURFACE IS DERIVED FROM THE EDITION, IT IS MEASURED AGAINST THE EDITION — never the wall
> clock.**

PD2 touched no clock and PD3 probably will not either. But every phase that filters, labels or checks
anything dated must obey this, and the failure mode is invisible at the hour you usually work
(between midnight ET and the ~6:40pm publish).

### 3. **"WHAT MOVED" AND "WHAT FAILED" ARE NOT THE SAME LIST — PD2's law, and PD3 WILL HIT IT**

**PD3 changes layout containers across every room. Your VRT diff will be large. This is the trap.**

`playwright.config.ts` sets **`maxDiffPixels: 600`**. A shot can therefore CHANGE and still PASS.
PD2's 28px top-bar mark moved **59** baselines and redded only **14** — the other 45 sat under the
tolerance and would have gone on passing *while showing a top bar the app no longer had*.

**So do NOT trust the failure list. Diff every candidate against its committed baseline yourself**
(decode both, count differing pixels), and re-baseline everything that **moved**. That same diff is
what surfaced a **387-pixel bug the tolerance had been hiding for months** — the Desk's baseline said
"none saved tonight" while every real run produced "1 saved tonight", because `briefing.spec` writes a
journal entry, runs first (workers: 1, alphabetical) and never cleans up.

**A baseline that is TOLERATED is still a baseline that is WRONG.**

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD3, tag `pd-3`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD4**, **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `env -u DATABASE_URL uv run pytest` from
`pipeline/` → announce the checkpoint), then begin PD3.

---

## The exit ritual — unchanged, and it works (eight tags, eight first-try greens)

Read **CLAUDE.md's "The Endgame"** block before you exit.

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift`. Once per phase: `check:migrations`.
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` — the **same job the tag runs**, on the
   exact SHA you will tag, before the tag exists. ~8 min, three shards. In parallel: wait for the
   Vercel deploy, then **`check:live`**, `check:nav`, `check:lighthouse`.
4. **Rehearsal red on pixels? PD3 WILL DO THIS.** The run mints its own candidates
   (`vrt-baselines-candidate-<leg>`). Download, **OPEN EVERY IMAGE**, and **see §3 above** — diff every
   candidate, not just the failures. Read `.claude/skills/vrt-update/SKILL.md` FIRST. An unexplained
   diff is a **bug**, not a re-bake.
5. **Green → `git tag pd-3 <the rehearsed SHA>` — BY SHA, never `HEAD`.** The nightly pushes a heartbeat
   commit; main moves under you. Push the tag, confirm it green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — never a re-point. But
   **read the failure first.** PD2 had exactly one real flake (`nav-timing — Desk → Scans`, phone leg,
   median 451 ms vs a 400 ms ceiling) and it was only called a flake after proving the application code
   was byte-identical to a passing run and the samples were bimodal (`[451, 178, 904, 877, 164, 178,
   482]` — half of them *faster* than the passing run). **A real slowdown moves every sample.**
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd3-grid.md` + this
   prompt rewritten, together. **It is free:** `paths-ignore` means a prose-only commit starts no CI run.
8. **The evidence file ends with the gate-size line.** At `pd-2`: **23 drift rules · 76 VRT baselines ·
   23 e2e specs · 638 unit tests · 16 bundle baselines · 14 manifest rooms · tag run 8 m 17 s.**
   Growth is a booked decision with a reason, never an accident. **PD3 adds a drift rule** (Law 2's
   `min-h` grep), **a VRT project** (`mbp16`) **and new baselines** — book all three.

**THE TRAP:** nothing in the gate reads a `paths-ignore`d path (`**/*.md`, `docs/**`, `.claude/**`) —
that is the only reason the filter is safe. **If you write a guard that reads a document, put its path
back in the trigger FIRST**, or the guard breaks silently.

---

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Claude Code exports its own Node 20 into every shell; `check:fonts` then dies
  with a `globSync` export error. **Not a regression.** Prepend Node 24 in every shell:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`uv run pytest` fails `test_missing_database_url_fails_loudly` if you sourced the root `.env`.**
  Not a regression. Run it clean: `env -u DATABASE_URL uv run pytest`.
- **The 29 Postgres-backed pipeline tests skip on this Mac — but they do NOT have to.**
  `docker run -d --name msm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=msm_test -p 55433:5432 postgres:16`,
  then `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55433/msm_test" uv run pytest`.
  **A local green with a skip count is not a green.** (PD3 adds a seed variant — you may well need this.)
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. **Advisory perf is 86 and varies ±10 — RE-SAMPLE before you explain a
  move.** The two HARD gates are CLS 0.000 and first-load JS ≤ 200 KB.
- **`/settings` answers in ~385 ms, every sample a cache MISS.** Correct — the app's one *writer* room,
  `force-dynamic` by design, with an argued exemption. Every cached room answers in 42–94 ms.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The whole path is proven working. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. **Not yours; leave them.**

---

## Questions waiting for Bishan — none of them blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).** There is one **user-authored** line (PD1's deletion) and one
**[user-approved]** line (the muted-token contrast floor). Both are already honored.

- **[VETO?] The phone login has no mark.** New at PD2. The login's brand panel is `hidden lg:flex` by
  existing design, so the 96px lockup is desktop-only and a phone sees no mark at all on the first page
  anyone ever opens. **PD4 owns the phone composition** — if Bishan wants it there, it is a two-line
  change, and PD4 is the place.
- **Q-G4-1 [VETO?]** PD5's movers delta chip carries `data-p2` (hover = opacity/underline only).
  **PD5 has not started; nothing is built on it. Reversing it still costs one paragraph.**
- **Q-G3-2 [WORTH HIS EYES]** `/academy/[slug]` is neither swept nor pixel-locked. A one-line manifest
  change (`"sweeps": ["touch","scroll","axe"]`). Cheap, and **worth doing in PD3** — you are already in
  the manifest.
- **[FYI, PD2] `e2e/briefing.spec.ts` never cleans up its journal entry.** PD2 fixed the *symptom* (the
  camera now looks away, via `Disclosure`'s `maskCount`). The root fix needs a journal delete path —
  a feature, not a test fix.
- **[FYI, PD2] Bishan's logo file has painted-on transparency** and the generator keys it out itself.
  Nothing to do. A genuine RGBA re-export would let ~40 lines of pixel-keying be deleted.
- **[FYI, PD1] A tracked file went missing from the working tree and was restored.**
  `Screenshot 2026-07-12 at 6.20.46 PM.png` (repo root, committed in `cb20a9f`). **PD2 did not see it
  disappear again** — one occurrence, not yet a pattern. **If you see it deleted, say so — twice is a
  pattern.**
- Q-N6-1 · Q-PD0-1 — **CLOSED at PD1.** Q-PD0-2 · Q-G2-1 · Q-G4-2 · Q-G3-1 · Q-G3-3 · Q-G3-4 · Q-G2-2 —
  all decided, no action needed.
