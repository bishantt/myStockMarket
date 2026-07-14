# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

# Your session: PD6 — The voice, the remaining rooms. PD6 ONLY.

**PD5 is done and tagged `pd-5` (`4fadf4c`, CI green — eleven tags, eleven first-try greens).**
**The richness kit exists. The news feed had been encoding direction by colour alone since N5, and the
pixel oracle had been defending it.**
The polish & depth build runs PD0 → PD10, one phase per session, and it is not gated on Bishan's word
— he said go.

Read `POLISH-AND-DEPTH-PLAN.md` **Part 8.3's PD6 list** and **Part 12's PD6 entry**.
Your phase is **PD6 and PD6 only**.

PD6 is: **the kit, applied to the rooms PD5 did not touch** — scans (preset criteria get `Term`;
symbols get `TickerChip`), paper (figures audit — typography only; NO new emphasis near money inputs),
track-record (hit/miss equal weight re-verified after chip normalization), Academy (`Term` backlinks in
lesson prose where the manifest names a glossary entry — reading-room restraint otherwise),
settings/login (type rhythm only). The **ticker page is PD8's** — PD6 touches only what PD8 will not.

**Exit gate additions:** 8.6's suites · `docs/pd-evidence/pd6-rooms.md` (the 8.1 eyeball table +
the 8.4 negative checklist, initialed with screenshots) · VRT re-baselines **named**.

---

## State of the tree

- `main` is clean, `pd-5` is tagged and green, everything is pushed.
- App unit tests: **692**. Pipeline: **535** (504 + 31 skipped locally without Postgres; CI runs all).
  Anti-drift: **27 rules**. VRT baselines: **83**. e2e specs: **25**. Rooms: **14**. Oracle legs: **4**.
- **Bundle worst case: `/news` at 196.9 KB against a 200 KB HARD ceiling — ≈3.1 KB of real headroom.**
  PD5's kit spent **1.8 KB** of it (the chip, the delta and the emphasis renderer cross into the client
  bundle because `NewsFeed` is a client component). **PD9's overlay still has to fit in what is left.**
  `Term`/`TermProse` cost **nothing** on the client — they are server-only (React `cache`). Keep it
  that way.
- Fonts: 243 KB of 560. `check:migrations` clean. `check:live` **all six green** (1 PENDING, owed to
  PD8). Lighthouse: **CLS 0.000, first-load 178 KB** — both hard gates.
- Nothing is blocked. Nothing is in flight.

---

## What PD5 left you — read these FIVE before you write code

### 1. **THE KIT IS BUILT. USE IT. DO NOT HAND-ROLL A FIFTH ANYTHING.**

`components/TickerChip.tsx` · `components/DeltaChip.tsx` · `components/Term.tsx` (`Term` + `TermProse`)
· `components/KeyFigure.tsx` (`KeyFigure` + `VerifiedProse`). `components/GlossaryTerm.tsx` is
**deleted** — `Term` supersedes it.

**TickerChip is a DOOR or a LABEL, and HTML decides which**, not taste: `door` renders a `<Link>`;
without it, a `<span>`. A news card is one big `<Link>`; a movers row is a `<button>`. An anchor inside
either is invalid HTML and the browser's repair silently kills the outer control. **Drift rule 26**
fails the build on a raw `/ticker/` href.

> **A DUPLICATED COMPONENT IS NOT A BUG. IT IS A BUG'S HABITAT.** PD5 found FOUR delta chips, and
> PD4's wrap fix had landed in exactly ONE of them. The other three still carried the shape of the bug
> PD4 had spent a whole phase killing — and nothing failed, and nothing ever would have.

### 2. **EMPHASIS IS EARNED, AND THE ALLOW-LIST IS THE WHOLE RULE (E5).**

`VerifiedFigure` has **one mint**: `splitVerified(text, allowList)`. The allow-list comes from the
**pipeline's gate** — a cluster's `key_numbers`, the figures it CLEARED.

**A deny-list is the trap.** It would make the *app* decide what counts as a number, and
`briefing/verify.py` already answers that; its own header says what a second answer costs.

This is why **the Desk's brief carries glossary doorways but NO emphasized figures**: the briefing
stores its **flags**, not its **cleared** list, so nothing in it can be *proven* verified. That is not
a gap, it is the rule — and it is **Q-PD5-1**, booked for **PD7** (have the gate publish what it
cleared). If PD6 touches a room with narrated prose, the same test applies: **can you prove the gate
cleared this figure? If not, it reads as plain prose, which claims nothing.**

### 3. **`/paper` IS A ROOM WHERE THE KIT MUST SHOW RESTRAINT.**

The plan says it plainly: paper gets a *figures audit* — **mono/typography only, NO new emphasis near
money inputs beyond what exists**. A cost mirror is the one place in this app where a reader is about
to spend (paper) money. Do not decorate it. `/track-record` has the sibling rule: **hits and misses
carry equal visual weight**, and PD6 must *re-verify* that after any chip normalization — the moment a
hit chip is prettier than a miss chip, the ledger is lying.

### 4. Harness traps that will cost you an hour each

- **`reuseExistingServer` WILL SERVE YOU A LIE.** It is true locally, so a server from an earlier run
  stays bound to **3210** and keeps serving whichever build it started with, while `npm run build`
  rewrites `.next` underneath it. **PD5 lost an hour** to an A/B that "proved" a regression; both sides
  had been measured against a stale server, and with the port cleared **pd-4 failed the same test at
  the same rate**. **`lsof -ti:3210 | xargs kill -9` before ANY local A/B against another commit.**
- **`:visible` is load-bearing on any DataTable cell.** DataTable renders **both** layouts into the DOM
  and hides one with CSS. `.first()` picks the **hidden** copy on desktop — the click waits 30s for a
  box that never arrives. It **passes on the phone**, where the visible copy is first. A spec that
  passes on one project and dies on another is telling you about the DOM, not the viewport.
- **`e2e:local` needs one project at a time AND `--workers=1`.**
- **Do NOT hand-start the server and let Playwright reuse it** (no `CRON_SECRET` ⇒ thin-night's ISR
  bust silently no-ops and the Law-2 test photographs a stale full-night render).
- **`git checkout -- docs/feel-evidence/nav-timing.md`** before committing.
- **Two local e2e flakes are KNOWN and are NOT yours**: `settings.spec.ts:29` (reproduces on `pd-4`;
  ISR revalidation timing) and `scans.spec.ts:44` (passes in isolation; the thin-night specs mutate the
  shared local database — CI gives every leg its own).

### 5. **LOOK AT THE PICTURES. THIS IS THE THIRD PHASE RUNNING THAT IT FOUND THE REAL BUG.**

PD5's test suite was **fully green** while: the brief's glossary doorway decorated **nothing** (the
glossary knows `"RVOL"`; the narrator writes `"relative volume"`), and the news feed had been encoding
direction by **colour alone** since N5 — a **P7 violation**, on the front page, sitting inside a
committed baseline that was *defending* it.

> **A matcher over narrated prose must match the words the narrator actually writes.**
> **A guard only guards what it is pointed at.**

---

## Two things in PD6's path

- **Q-PD5-2 [YOURS — PD6 touches the scans room]: the pixel oracle has a hover state in it.**
  Diffing **every** candidate against its committed baseline — not just the failures — found three
  shots that changed **without failing**, on pages PD5 never touched: `scans-preset` (~56,000px),
  `login` (~2,400px), `settings-light` (161px). **The committed `scans-preset` baseline has a row
  highlighted as though the mouse were resting on it.** The app is identical; the **camera** moved.
  PD4 fixed exactly this on the ticker by parking the mouse at (0,0) in `shoot()` — the fix did not
  reach everywhere. PD5 left it alone deliberately (the oracle passes it; PD5 did not touch that page).
  **PD6 touches the scans room. Fix it there, and re-baseline it with the reason in the commit body.**

- **Q-PD5-1 [PD7]** — the briefing's gate stores its flags, not its cleared list. Not yours.

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD6, tag `pd-6`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD7**, **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `env -u DATABASE_URL uv run pytest` from
`pipeline/` → announce the checkpoint), then begin PD6.

---

## The exit ritual — unchanged, and it works (eleven tags, eleven first-try greens)

Read **CLAUDE.md's "The Endgame"** block before you exit.

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` (**one project at a time, `--workers=1`**) ·
   `check:drift`. Once per phase: `check:migrations`.
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` — the **same job the tag runs**, on the
   exact SHA you will tag. ~9 min, four legs. In parallel: wait for the Vercel deploy, then
   **`check:live`**, `check:nav`, `check:lighthouse`.
4. **Rehearsal red on pixels? PD6 WILL DO THIS** (it restyles the remaining rooms). Read
   `.claude/skills/vrt-update/SKILL.md` FIRST. Then:
   - `gh run download <id> -p 'playwright-failures-*'` and `-p 'vrt-baselines-candidate-*'`.
   - **The triptych is the list of what moved. The candidate is only where you fetch it from.**
   - **DIFF EVERY CANDIDATE against its committed baseline** (decode both, count pixels differing by
     more than ~12 per channel — a raw ±1 count is meaningless, the brand gradient dithers by tens of
     thousands of pixels between runs and it means nothing). A shot can **change and still pass**.
   - **Check every RESIZE against the direction your change implies.**
   - **LOOK AT THE PICTURES.** An unexplained diff is a **bug**, not a re-bake.
5. **Green → `git tag pd-6 <the rehearsed SHA>` — BY SHA, never `HEAD`.** Push it, confirm it green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — but **read the failure
   first**.
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd6-rooms.md` + this
   prompt rewritten, together. **It is free:** `paths-ignore` means a prose-only commit starts no CI run.
8. **The evidence file ends with the gate-size line.** At `pd-5`: **27 drift rules · 83 VRT baselines ·
   25 e2e specs · 692 unit tests · 16 bundle baselines · 14 manifest rooms · 4 oracle legs · tag run
   8 m 54 s.** Growth is a booked decision with a reason, never an accident.

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
  `npx prisma migrate deploy && npm run db:seed`, and `MSM_SEEDED=1`. **The seed only deletes the three
  watchlist symbols it creates**, so a failed `settings.spec` run leaves `QQQ`/`DIA` behind and poisons
  the next one — delete them between runs.
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. **Advisory perf varies ±10 — RE-SAMPLE before you explain a move.** The
  two HARD gates are CLS 0.000 and first-load JS ≤ 200 KB. At `pd-5`: **CLS 0.000, first-load 178 KB.**
- **`/settings` answers in ~436 ms, every sample a cache MISS.** Correct — the app's one *writer* room,
  `force-dynamic` by design, with an argued exemption.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The whole path is proven working. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. **Not yours; leave them.**

---

## Questions waiting for Bishan — none of them blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).** There is one **user-authored** line (PD1's deletion) and one
**[user-approved]** line (the muted-token contrast floor). Both are already honored.

- **Q-PD5-2 [YOURS]** the oracle's `scans-preset` baseline is a photograph of a hover state — see above.
- **Q-PD5-1 [PD7]** the briefing's gate stores its flags, not its cleared list.
- **[FYI, PD5] The news feed had a P7 violation (direction by colour alone) in a committed baseline
  since N5.** Fixed. Worth his eyes; no action.
- **[VETO?, PD4] The tape row is a LIST, not the 3-up grid Part 7.1 specified.** Plan amended in place.
- **[VETO?, PD4] The phone login now carries the mark.** Decided, as PD3 asked.
- **Q-PD3-1 · Q-PD3-2 [WORTH HIS EYES]** the oracle defending a live bug; the Desk's phone tab order vs
  visual order (forced by CSS, pinned by e2e — **do not reorder the Desk's DOM to "fix" it**).
- **[FYI, PD2] `e2e/briefing.spec.ts` never cleans up its journal entry.** The camera looks away.
- **Q-G4-1 — CLOSED at PD5** (the delta chip carries `data-p2`). Q-N6-1 · Q-PD0-1 · Q-G3-2 — CLOSED.
