# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

# Your session: PD5 — The voice: the richness system + Desk + News. PD5 ONLY.

**PD4 is done and tagged `pd-4` (CI green, first try — ten tags, ten first-try greens).**
**The phone had been scrolling sideways in production, and the pixel oracle had been photographing a
hover state.**
The polish & depth build runs PD0 → PD10, one phase per session, and it is not gated on Bishan's word
— he said go.

Read `POLISH-AND-DEPTH-PLAN.md` **Part 8** (the PD5 spec) and **Part 12's PD5 entry**.
Your phase is **PD5 and PD5 only**.

PD5 is: the richness **kit** (TickerChip, Term, KeyFigure, the Tag sweep), the **colour dictionary** in
the styleguide, the **new drift rules**, application to the **Desk + News feed**, and the **8.4 negative
checklist** run.
**Exit gate additions:** 8.6's suites · `docs/pd-evidence/pd5-voice.md` (eyeball table + the negative
checklist, initialed with screenshots) · VRT re-baselines **named**.

---

## State of the tree

- `main` is clean, `pd-4` is tagged and green, everything is pushed.
- App unit tests: **649**. Pipeline: **535** (504 + 31 skipped locally without Postgres; CI runs all).
  Anti-drift: **25 rules**. VRT baselines: **83**. e2e specs: **24**. Rooms: **14**. Oracle legs: **4**.
- **Bundle worst case: `/news` at 196.3 KB against a 200 KB HARD ceiling — ≈3.7 KB of real headroom.**
  PD4 did not move it (composition is not JS). **PD5's kit is the FIRST thing in this build that will
  actually spend from that pot, and PD9's overlay spends from it too.** `check:bundles` is in the gate.
  If the kit needs client JS, budget it deliberately — do not discover it at the gate.
- Fonts: 243 KB of 560. `check:migrations` clean. `check:live` **all six green** (1 PENDING, owed to PD8).
- Nothing is blocked. Nothing is in flight.

---

## What PD4 left you — read these FOUR before you write code

### 1. **THE GUARD YOU TRUST MAY BE AIMED ONE LEVEL TOO HIGH.** PD4's sharpest finding.

The sideways-scroll sweep asks the **document**: `scrollWidth === clientWidth`. A cell that spills into
the cell **next door** lands its spill *inside* the page — never past its edge. So the document reports
**zero overflow, honestly**, while a figure sits under the border of the card beside it.

PD4's first tape row did exactly that: index levels overflowing **8px** into their neighbours, delta
chips shattered into **three lines**, and **every guard green** — unit tests, class contract, and the
brand-new 360px sweep I had *just written*. **Only the screenshot showed it.**

> **The box you measure must be the box the bug is in.** A guard aimed one level too high is not a weak
> guard — it is a guard that will never fire, and it will make you confident while it does not.

**PD5 restyles surfaces across the Desk and News.** When your VRT goes green, that is not the same as
your surfaces being right. **Look at the pictures.**

### 2. **THE ORACLE CAN PHOTOGRAPH THE CAMERA INSTEAD OF THE APP.**

`signIn()` **clicks** the Sign-in button; Chromium leaves the pointer resting there and Playwright never
moves it. On `/ticker` the candle chart sat under that cursor, lightweight-charts thought it was hovered,
and drew a **crosshair** into the baseline. So the ticker's picture encoded **where the login button was**
— and when PD4 moved that button, the price pill slid from 214.54 to 213.02 on a page PD4 never touched.
Byte-identical on a re-run, so never flake.

`shoot()` now parks the mouse at (0,0). **Ask of any diff on a page you did not touch: is this the APP,
or is this the CAMERA?**

### 3. **THE WRAP CONTRACT — the unit of wrapping is the ATOM.** You will be adding chips.

PD3's rule ("numbers never truncate, never ellipsize, never clip; wrapping is just typography") is true,
and PD4 **over-applied it and reproduced the very bug it was written to prevent**: told to wrap rather
than clip, a delta chip wrapped into `▲` / `+0.29%` / `· 1D` — three lines, one token each.

> "Wrapping is honest, truncating is not" is a claim about a **sentence**. A phrase broken one word per
> line has not been wrapped — it has been **shattered**.

`StatFigure`'s chip has **two atoms**, each `whitespace-nowrap` — the signed delta and its window — and
the chip breaks **between** them, never **within** one. **PD5's kit adds TickerChip and Tag variants.
Every one of them is a phrase. Give each its atoms.** And remember `min-w-*` on anything that must stay
legible in a `flex-wrap` row (PD3's `flex-basis: 0` lesson).

### 4. Harness traps that will cost you an hour each if you re-learn them

- **`e2e:local` needs one project at a time AND `--workers=1`.** Inside a project the local worker
  default is still parallel, which is enough to make `ticker-range` fail on the shared database.
- **Do NOT hand-start the server and let Playwright reuse it.** Without `CRON_SECRET`, thin-night's ISR
  cache-bust silently no-ops and its Law-2 test photographs a **stale full-night render** (318px where
  it wants ≤120). It reads exactly like a layout regression and is not. Let Playwright start its own.
- **`git checkout -- docs/feel-evidence/nav-timing.md`** before committing — the browser suite appends
  to it.

---

## One thing in PD5's path

- **Q-G4-1 [VETO?]: PD5's movers delta chip carries `data-p2`.** Still open, still yours to decide.
  A probability/money visual may not sit under an animating or transforming ancestor — the P2 ancestor
  walk enforces it. If the kit's new chips carry semantic colour on a money figure, they are P2 too.

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD5, tag `pd-5`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD6**, **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `env -u DATABASE_URL uv run pytest` from
`pipeline/` → announce the checkpoint), then begin PD5.

---

## The exit ritual — unchanged, and it works (ten tags, ten first-try greens)

Read **CLAUDE.md's "The Endgame"** block before you exit.

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` (**one project at a time, `--workers=1`**) ·
   `check:drift`. Once per phase: `check:migrations`.
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` — the **same job the tag runs**, on the
   exact SHA you will tag, before the tag exists. ~9 min, four legs. In parallel: wait for the Vercel
   deploy, then **`check:live`**, `check:nav`, `check:lighthouse`.
4. **Rehearsal red on pixels? PD5 WILL DO THIS** (it restyles the Desk and News). Download
   `vrt-baselines-candidate-<leg>`, **diff EVERY candidate against its committed baseline** (a shot can
   change and still PASS — `maxDiffPixels: 600`), **check every RESIZE against the direction your change
   implies**, and **look at the pictures**. Read `.claude/skills/vrt-update/SKILL.md` FIRST. An
   unexplained diff is a **bug**, not a re-bake.
5. **Green → `git tag pd-5 <the rehearsed SHA>` — BY SHA, never `HEAD`.** Push it, confirm it green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — but **read the failure
   first**. PD4's "flake" was a real race (a layout test measuring an unstyled page), and it had failed
   its retry too.
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd5-voice.md` + this
   prompt rewritten, together. **It is free:** `paths-ignore` means a prose-only commit starts no CI run.
8. **The evidence file ends with the gate-size line.** At `pd-4`: **25 drift rules · 83 VRT baselines ·
   24 e2e specs · 649 unit tests · 16 bundle baselines · 14 manifest rooms · 4 oracle legs · tag run
   8 m 48 s.** Growth is a booked decision with a reason, never an accident. **PD5 adds drift rules by
   design — book them.**

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
  `npx prisma migrate deploy && npm run db:seed`, and `MSM_SEEDED=1`. **One project at a time,
  `--workers=1`, and let Playwright start the server** (§4 above).
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. **Advisory perf varies ±10 — RE-SAMPLE before you explain a move.** The
  two HARD gates are CLS 0.000 and first-load JS ≤ 200 KB. At `pd-4`: CLS 0.000, first-load 178 KB.
- **`/settings` answers in ~436 ms, every sample a cache MISS.** Correct — the app's one *writer* room,
  `force-dynamic` by design, with an argued exemption. Every cached room answers in 44–62 ms.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The whole path is proven working. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. **Not yours; leave them.**

---

## Questions waiting for Bishan — none of them blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).** There is one **user-authored** line (PD1's deletion) and one
**[user-approved]** line (the muted-token contrast floor). Both are already honored.

- **[FYI, PD4] The Desk was scrolling sideways in production at 360px** and three guards were green.
  Fixed. Worth his eyes; no action.
- **[VETO?, PD4] The tape row is a LIST, not the 3-up grid Part 7.1 specified.** The arithmetic does not
  close (74px of cell against an 81px number). **Plan amended in place.** Reversible in one component.
- **[VETO?, PD4] The phone login now carries the mark.** Decided, as PD3 asked. Reversible in two lines.
- **Q-G4-1 [VETO?]** PD5's movers delta chip carries `data-p2`. **This is your phase — decide it.**
- **Q-PD3-1 · Q-PD3-2 [WORTH HIS EYES]** the oracle defending a live bug; the Desk's phone tab order vs
  visual order (forced by CSS, pinned by e2e — **do not reorder the Desk's DOM to "fix" it**).
- **[FYI, PD2] `e2e/briefing.spec.ts` never cleans up its journal entry.** The camera looks away. The
  root fix needs a journal delete path — a feature, not a test fix.
- Q-N6-1 · Q-PD0-1 · Q-G3-2 — **CLOSED.** Q-PD0-2 · Q-G2-1 · Q-G4-2 · Q-G3-1 · Q-G3-3 · Q-G3-4 ·
  Q-G2-2 — all decided, no action needed.
