# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

# Your session: PD4 — The phone composition. PD4 ONLY.

**PD3 is done and tagged `pd-3` (CI green, first try — nine tags, nine first-try greens).**
**The Desk's dead gap is gone, and the pixel oracle was caught defending a live bug.**
The polish & depth build runs PD0 → PD10, one phase per session, and it is not gated on Bishan's word
— he said go.

Read `POLISH-AND-DEPTH-PLAN.md` **Part 7** (the PD4 spec) and **Part 12's PD4 entry**.
Your phase is **PD4 and PD4 only**.

PD4 is: the `StatFigure` wrap contract, the two macro shelves becoming grids (0.2.1) plus the copy-deck
deletions, the phone-wide overflow sweep (Pixel-7 + 360), an alignment pass, and phone VRT re-baselines.
**Exit gate additions:** 7.5's suites · `docs/pd-evidence/pd4-phone.md` with the healed-overflow frame ·
the sweep proves it swept every room.

---

## State of the tree

- `main` is clean, `pd-3` is tagged and green, everything is pushed.
- App unit tests: **642**. Pipeline: **535** (504 + 31 skipped locally without Postgres; CI runs all).
  Anti-drift: **25 rules**. VRT baselines: **83**. e2e specs: **24**. Rooms: **14**. Oracle legs: **4**.
- **Bundle worst case: `/news` at 196.3 KB against a 200 KB HARD ceiling — ≈3.7 KB of real headroom.**
  PD3 did not move it at all (structure is not JS). **PD5's kit and PD9's overlay both spend from this
  same pot.** PD4 is composition, not JS, so it should barely move — but `check:bundles` is in the gate.
- Fonts: 243 KB of 560. `check:migrations` clean. `check:live` **all six green** (1 PENDING, owed to PD8).
- Nothing is blocked. Nothing is in flight.

---

## What PD3 left you — read these FOUR before you write code

### 1. **THE ORACLE CAN ENSHRINE A BUG. THIS IS THE MOST IMPORTANT THING PD3 FOUND.**

`/ticker` on a phone has been rendering the **Range Ladder** — a P2 probability visual — with its
sentences **one word per line**, in production, for months. `ticker-*-phone-linux.png` were **committed
photographs of that**, green on every run.

> **A VRT baseline proves a page has not CHANGED. It does not prove the page was ever RIGHT.**
> If the first picture was already wrong, the oracle locks the bug in and *defends* it. Nothing ever
> fails. PD2 taught us "a TOLERATED baseline is still WRONG." **PD3's is harder: an EXACT baseline can
> still be wrong.**

**PD4 RE-BASELINES THE PHONE. That is exactly the surface this bit.** So:
- **Any brand-new baseline gets EYES before it is committed.** It is the only moment anyone will ever
  look at it with fresh judgement.
- **A RESIZE is louder than a diff.** A shot whose HEIGHT changed changed its LAYOUT. Check the height
  moved in the direction your change implies — **wider ⇒ shorter. A page that gets wider is not supposed
  to get taller.** That one sentence is what caught the ladder.
- The cause was `flex-1` = `flex: 1 1 0%` — **a flex-basis of ZERO can never make its line wrap; it can
  only be crushed.** **In a `flex-wrap` row, anything that must stay legible needs a `min-w-*`.** PD4 is
  a phone-composition phase: you will be reading a lot of flex rows. Look for this shape.

### 2. Diff EVERY candidate; do not read the failure list

`maxDiffPixels: 600`, so a shot can CHANGE and still PASS. Decode both images and count differing
pixels. PD3's re-baselining: **only 3 shots FAILED, 13 moved.**

### 3. **`e2e:local` needs ONE PROJECT AT A TIME now**

`e2e/thin-night.ts` mutates the database and restores it. **CI is safe** (each matrix leg is its own
runner with its own Postgres). **Your Mac is not** — `e2e:local` runs all four projects against one
database in parallel workers, they fight, and the symptom is a **duplicate-primary-key error inside the
RESTORE that reads exactly like a broken layout.** Run `npx playwright test --project=phone` etc.

Also: **running the browser suite locally dirties `docs/feel-evidence/nav-timing.md`** (nav-timing.spec
appends its samples). `git checkout --` it before committing.

### 4. THE EDITION RULE — PD1's law, still standing

> **IF A SURFACE IS DERIVED FROM THE EDITION, IT IS MEASURED AGAINST THE EDITION — never the wall clock.**

---

## Two things in PD4's path that PD3 deliberately left for you

- **[VETO?] The phone login has no mark.** The login's brand panel is `hidden lg:flex` by existing
  design, so the 96px lockup is desktop-only and **a phone sees no mark at all on the first page anyone
  ever opens**. **PD4 owns the phone composition — this is the phase to decide it.** It is a two-line
  change. See QUESTIONS-FOR-BISHANT.md.
- **The Desk's phone tab order now differs from its visual order** (Q-PD3-2). This is FORCED by CSS —
  see PROGRESS.md #2 — and it is pinned by e2e. **Do not "fix" it by reordering the DOM**: that brings
  the 334px dead gap straight back. If you touch the Desk's phone layout, `e2e/grid.spec.ts` is the
  contract that will tell you.

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD4, tag `pd-4`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD5**, **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `env -u DATABASE_URL uv run pytest` from
`pipeline/` → announce the checkpoint), then begin PD4.

---

## The exit ritual — unchanged, and it works (nine tags, nine first-try greens)

Read **CLAUDE.md's "The Endgame"** block before you exit.

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` (**one project at a time**) · `check:drift`.
   Once per phase: `check:migrations`.
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` — the **same job the tag runs**, on the
   exact SHA you will tag, before the tag exists. ~8 min, **four** legs now. In parallel: wait for the
   Vercel deploy, then **`check:live`**, `check:nav`, `check:lighthouse`.
4. **Rehearsal red on pixels? PD4 WILL DO THIS** (it re-baselines the phone). Download
   `vrt-baselines-candidate-<leg>`, **and see §1 and §2 above** — diff every candidate, check every
   RESIZE against the direction your change implies, and **look at the pictures**. Read
   `.claude/skills/vrt-update/SKILL.md` FIRST. An unexplained diff is a **bug**, not a re-bake.
5. **Green → `git tag pd-4 <the rehearsed SHA>` — BY SHA, never `HEAD`.** Push it, confirm it green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — but **read the failure
   first**. A real slowdown moves every sample; a flake is bimodal.
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd4-phone.md` + this
   prompt rewritten, together. **It is free:** `paths-ignore` means a prose-only commit starts no CI run.
8. **The evidence file ends with the gate-size line.** At `pd-3`: **25 drift rules · 83 VRT baselines ·
   24 e2e specs · 642 unit tests · 16 bundle baselines · 14 manifest rooms · 4 oracle legs · tag run
   8 m 08 s.** Growth is a booked decision with a reason, never an accident.

**THE TRAP:** nothing in the gate reads a `paths-ignore`d path (`**/*.md`, `docs/**`, `.claude/**`) —
that is the only reason the filter is safe. **If you write a guard that reads a document, put its path
back in the trigger FIRST**, or the guard breaks silently.

---

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Prepend Node 24 in every shell:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`uv run pytest` fails `test_missing_database_url_fails_loudly` if you sourced the root `.env`.**
  Run it clean: `env -u DATABASE_URL uv run pytest`.
- **The 29 Postgres-backed pipeline tests skip on this Mac — but they do NOT have to.**
  `docker run -d --name msm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=msm_test -p 55433:5432 postgres:16`,
  then `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55433/msm_test" uv run pytest`.
- **For a seeded browser suite locally:** `docker run -d --name msm-e2e -e POSTGRES_PASSWORD=test -e
  POSTGRES_DB=msmtest -p 55434:5432 postgres:16`, then `DATABASE_URL`/`DIRECT_URL` at that port,
  `npx prisma migrate deploy && npm run db:seed`, and `MSM_SEEDED=1`. **One project at a time** (§3).
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. **Advisory perf varies ±10 — RE-SAMPLE before you explain a move.** At
  `pd-3` four samples read 76 · 77 · 83 · 84 (the first post-deploy sample is always the cold outlier).
  The two HARD gates are CLS 0.000 and first-load JS ≤ 200 KB.
- **`/settings` answers in ~385 ms, every sample a cache MISS.** Correct — the app's one *writer* room,
  `force-dynamic` by design, with an argued exemption. Every cached room answers in 45–57 ms.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The whole path is proven working. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. **Not yours; leave them.**

---

## Questions waiting for Bishan — none of them blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).** There is one **user-authored** line (PD1's deletion) and one
**[user-approved]** line (the muted-token contrast floor). Both are already honored.

- **Q-PD3-1 [WORTH HIS EYES]** the pixel oracle was defending a live bug for months. No action.
- **Q-PD3-2 [WORTH HIS EYES]** the Desk's phone tab order vs visual order — forced by CSS, pinned by
  e2e. **Relevant to PD4; do not reorder the Desk's DOM to "fix" it.**
- **[VETO?] The phone login has no mark.** **PD4 owns this.** Decide it.
- **Q-G4-1 [VETO?]** PD5's movers delta chip carries `data-p2`. **PD5 has not started.**
- **Q-G3-2 — CLOSED at PD3.** The lesson page is swept, and the sweep found a real 17px defect on its
  first run.
- **[FYI, PD2] `e2e/briefing.spec.ts` never cleans up its journal entry.** The camera looks away. The
  root fix needs a journal delete path — a feature, not a test fix.
- Q-N6-1 · Q-PD0-1 — **CLOSED at PD1.** Q-PD0-2 · Q-G2-1 · Q-G4-2 · Q-G3-1 · Q-G3-3 · Q-G3-4 · Q-G2-2 —
  all decided, no action needed.
