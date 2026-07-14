# NEXT-SESSION-PROMPT.md — paste this into a fresh session

---

# Your session: PD7 — News & ticker depth: the PIPELINE. PD7 ONLY.

**PD6 is done and tagged `pd-6` (`026c9cf`).**
**PD5 hunted the delta chip's siblings and found four. There were six — and one of them had been
showing a delta with no window, on every phone, since the app's one table was written.**

The polish & depth build runs PD0 → PD10, one phase per session, and it is not gated on Bishan's
word — he said go.

Read `POLISH-AND-DEPTH-PLAN.md` **Part 9.2, 9.3, 9.5** and **Part 12's PD7 entry**, plus
**Appendix B** (the migration).
Your phase is **PD7 and PD7 only**.

**PD7 is a PIPELINE phase — the first since N5.** Nothing you build this session renders. Part 9's
whole thesis is that depth arrives in two moves and the pipeline goes first: *the LLM narrates only
what the pipeline computed*, so the pipeline must compute MORE before any surface can show more.

PD7 is: **9.2** the stats registry grows (deterministic, per-cluster, TDD-first) · **9.3** the insight
schema v2 (Stage B grows *sections*, not license — plus the gate extensions and the E4 lexicon) ·
**9.5** `model_meta` for news + the cost instrument · the fixture night regenerated (four pinned
shapes) · **Appendix B**'s migration. **One real `news`-mode dispatch after it lands**, with the
night's measured cost recorded against 0.2.3's estimate.

**Exit gate additions:** 9.8's pipeline suites · the real-dispatch evidence (clusters carry v2 fields
in production, or the honest skip is logged with its stage status) · `docs/pd-evidence/pd7-insight.md`
with the measured token/cost table.

**PD8 is the surfaces.** Do not build them. PD7 blocks PD8; PD8 blocks PD9.

---

## Q-PD5-1 IS YOURS, AND IT IS THE HEART OF THIS PHASE

**The briefing's gate stores its FLAGS, not its CLEARED list — and that is why the Desk's brief
carries glossary doorways but NOT ONE emphasized figure.**

Ruling E5: a number is set in mono — the "this was checked" typeface — **only if the deterministic
gate cleared it**. That needs an **allow-list**. A news cluster has one (`key_numbers` = the figures
the gate CLEARED). **The briefing does not.** It records what FAILED, and a published brief may still
carry up to two flags. So nothing in it can be *proven* verified, and `VerifiedProse` correctly
emphasizes nothing.

**A deny-list is the trap** — it would make the *app* decide what counts as a number, with its own
regex, and `briefing/verify.py` already answers that question. Its own header names the cost:

> "Two definitions of that would be one too many: the day they drifted apart, one of the two surfaces
> would start publishing numbers the other would have refused, and nobody would find out from a test."

**Fix it at the source: have the gate publish what it CLEARED, not only what it flagged.** That is a
pipeline change, it is 9.3's territory, and it unlocks E5 on the Desk for PD8.

---

## State of the tree

- `main` is clean, `pd-6` is tagged and green, everything is pushed.
- App unit tests: **710**. Pipeline: **535** (504 + 31 skipped locally without Postgres; CI runs all).
  Anti-drift: **28 rules**. VRT baselines: **83**. e2e specs: **25**. Rooms: **14**. Oracle legs: **4**.
- **Bundle worst case: `/news` at 197.3 KB against a 200 KB HARD ceiling — ≈2.7 KB of real headroom.**
  **PD9's overlay still has to fit in what is left.** PD7 is a pipeline phase, so it should spend
  none of it — but PD8 and PD9 both will, and the ceiling does not move.
- Fonts 243/560 KB. `check:migrations` clean. `check:live` **green** (2 pending: news bylines owed to
  PD8; the masthead owed to whichever nightly has not run yet — that one is the clock, not a fault).
- **THE REPO IS PUBLIC NOW** (Bishan, 2026-07-14). GitHub Actions minutes are **unmetered** — there is
  no CI budget to husband. Secret scanning and push protection are on. The login wall and every
  secrets-in-env rule are **unchanged**: the wall guards the app and its data, not the code.
  Lighthouse: **CLS 0.000, first-load 181 KB** — both hard gates.
- Nothing is blocked. Nothing is in flight.

---

## What PD6 left you — read these FIVE before you write code

### 1. **A HAND GREP IS NOT A GUARD.**

PD5 wrote the law — *a duplicated component is not a bug, it is a bug's HABITAT* — went looking for
the delta chip's siblings, found **four**, fixed them, and closed the file.

**There were six.** `DataTable.tsx` held a private `function DeltaChip` that **shadowed the kit
component's own name** (so a grep found it and read it as the kit), and `scans/page.tsx` held a sixth
inline, with no component name to grep for at all. Both rendered every night on front-facing rooms.

> **If a rule matters, point a RULE at it.** Drift rule 28 is now pointed at the one thing all six
> copies had in common and could not have avoided — a direction-coloured **background**.

### 2. **A GUARD ONLY GUARDS WHAT IT IS POINTED AT — AND THAT INCLUDES THE DATA IT IS POINTED AT.**

A 21px touch target had been live on the news story page since PD5, and the phone sweep passed it
every single night. The sweep visits **one** story, `nc-fed-hold`, and that cluster has **zero**
catalyst links in the seeded world — so the affected table rendered no rows, so there were no controls
to measure, so the room reported clean.

**The rule was being kept by the shape of a fixture.** This one is directly relevant to you: **PD7
regenerates the fixture night.** A fixture is not just test data — it is the thing that decides what
every sweep, every baseline and every seeded e2e can *see*. When you regenerate it, ask what each
pinned shape makes visible, and what it makes invisible. (Q-PD6-2 asks PD8 to point the sweep at a
story that actually has an affected table. If PD7's fixture gives every story one, that is half done.)

### 3. **LOOK AT THE PICTURES. THEY CAUGHT THREE OF PD6'S OWN BUGS, AND EVERY GUARD PASSED THEM ALL.**

- The 44px touch fix **made every table row 69px** (it stacked on top of the cell's padding instead of
  overlapping it). The touch sweep asks "is it 44px?" — it got 44px, and passed.
- The settings watchlist's symbol column was 96px, sized for the *word* "AAPL". As a *chip* that is
  ~48px, so its FOCUS tag wrapped to a second line. Nothing failed. It just looked wrong.
- **And fixing THAT made `/settings` scroll sideways at 360px** — PD4's bug, reintroduced by a fix for
  something else. Then the fix for *that* broke the desktop. It took three swings.

> **A FIX VERIFIED AT ONE WIDTH IS NOT VERIFIED. Touch a room, re-run its sweeps — all of them.**
> And **state your prediction before the run**: the third attempt named the exact two baselines it
> expected to move, and the rehearsal confirmed it. A prediction you can falsify beats a hope.

**STANDING RULE (Bishan, 2026-07-14): BATCH VISUAL FIXES INTO A SINGLE RE-SHOOT.** After a red
rehearsal, pull the artifacts for EVERY red leg, open every image, list every diff, fix them ALL, then
dispatch ONCE. Never one dispatch per fix. PD6 burned ~50 minutes of round-trip waiting learning this.

You are a pipeline phase, so your "pictures" are the **fixture night's four pinned shapes** and the
**real dispatch's output**. Print them. Read them. A schema that validates is not a schema that says
something true.

### 4. **THE PIXEL ORACLE IS BLIND TO A LARGE, LOW-CONTRAST CHANGE (Q-PD6-1, booked for PD10).**

Not the tolerance — the **instrument**. `playwright.config.ts` sets `maxDiffPixels: 600` and leaves
`threshold` at its default (0.2, a per-pixel colour distance). A hover wash is a big region of a
*slightly* different colour: every one of those pixels falls under the cutoff, so **none of them
counts as differing at all** and the 600-pixel budget is never even consulted.

PD5 saw `scans-preset` change by ~56,000px without failing and assumed the tolerance had absorbed it.
It had not. **Not yours** — but do not trust the oracle to catch a token quietly changing value.

### 5. Harness traps that will cost you an hour each

- **`uv run pytest` fails `test_missing_database_url_fails_loudly` if you sourced the root `.env`.**
  Run it clean: `env -u DATABASE_URL uv run pytest`.
- **The 31 Postgres-backed pipeline tests skip on this Mac — but they do NOT have to**, and PD7 is
  exactly the phase that needs them:
  ```bash
  docker run -d --name msm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=msm_test -p 55433:5432 postgres:16
  TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55433/msm_test" uv run pytest
  ```
- **`job_a` runs in FOUR modes** (`MODE_STAGES` in `pipeline/jobs/job_a.py`) and `main()` REFUSES any
  mode it has no handler for. Your real dispatch is **`news` mode**. `compute` recomputes from STORED
  bars and takes its run date from the DATA, not the clock.
- **The dispatch API returns 204 with an EMPTY BODY** — no run id. The app recovers it from the
  `run-name:` line in the workflow, which is **load-bearing**: delete it and the control room goes
  permanently blind while every test but one passes.
- **GitHub validates `workflow_dispatch` inputs against the workflow file ON THE TARGET REF.** A new
  input must land on `main` **before** you can dispatch it. Push first, then dispatch.
- **`git checkout -- docs/feel-evidence/nav-timing.md`** before you commit, if you ran the browser
  suite locally.

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD7, tag `pd-7`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD8**, **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `env -u DATABASE_URL uv run pytest` from
`pipeline/` → announce the checkpoint), then begin PD7.

---

## The exit ritual

Read **CLAUDE.md's "The Endgame"** block before you exit.

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` (**one project at a time, `--workers=1`**) ·
   `check:drift`. Once per phase: `check:migrations` — **and PD7 ships a MIGRATION (Appendix B), so
   this one is load-bearing rather than a formality.**
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` — the **same job the tag runs**, on
   the exact SHA you will tag. ~9 min, four legs. In parallel: wait for the Vercel deploy, then
   **`check:live`**, `check:nav`, `check:lighthouse`.
4. **PD7 should NOT red on pixels** — it is a pipeline phase and renders nothing new. **If it does,
   that is a finding, not a chore.** Read `.claude/skills/vrt-update/SKILL.md`, and **diff every
   candidate against its committed baseline, not just the failures** — a shot can change and still
   pass.
5. **Green → `git tag pd-7 <the rehearsed SHA>` — BY SHA, never `HEAD`.** Push it, confirm it green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — but **read the failure
   first**.
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd7-insight.md` + this
   prompt rewritten, together. **It is free:** `paths-ignore` means a prose-only commit starts no CI run.
8. **The evidence file ends with the gate-size line.** At `pd-6`: **28 drift rules · 83 VRT baselines ·
   25 e2e specs · 710 unit tests · 16 bundle baselines · 14 manifest rooms · 4 oracle legs.**
   Growth is a booked decision with a reason, never an accident.

---

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Prepend Node 24 in every shell:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **Two local e2e failures are NOT yours, and both were re-confirmed at PD6:**
  `scans.spec.ts:44` (passes in isolation — the thin-night specs mutate the shared local database) and
  `settings.spec.ts:29` (**fails on the tagged, green `pd-5` tree too** — I stashed PD6, rebuilt
  `pd-5`, ran it against the same database, and it failed *earlier*, at a different assertion).
- **`lsof -ti:3210 | xargs kill -9` before ANY local e2e run.** `reuseExistingServer` is true locally
  and will keep serving a stale build for an hour while you chase a regression that is not there.
- **For a seeded browser suite locally** (turns 149 skips into 222 real tests — PD6's whole
  touch-target finding came out of this):
  ```bash
  docker run -d --name msm-e2e -e POSTGRES_PASSWORD=test -e POSTGRES_DB=msmtest -p 55434:5432 postgres:16
  export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest" DIRECT_URL="$DATABASE_URL"
  npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1
  ```
  **The seed only deletes the three watchlist symbols it creates**, so a failed `settings.spec` leaves
  `QQQ`/`DIA` behind and poisons the next run. Delete them between runs.
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. **Advisory perf varies ±10 — RE-SAMPLE before you explain a move.**
- **`/settings` answers in ~436 ms, every sample a cache MISS.** Correct — the app's one *writer* room,
  `force-dynamic` by design, with an argued exemption.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. **This matters to you: PD7 owes a real `news`-mode dispatch.** Dispatch it
  with `gh workflow run` from the CLI, not from the control room.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. **Not yours; leave them.**

---

## Questions waiting for Bishan — none of them blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).** There is one **user-authored** line (PD1's deletion) and one
**[user-approved]** line (the muted-token contrast floor). Both are already honored.

- **Q-PD5-1 [YOURS]** — the briefing's gate stores its flags, not its cleared list. See the top of
  this file. It is the heart of PD7.
- **Q-PD6-1 [PD10]** — the pixel oracle is blind to a large, low-contrast change (`threshold` is
  unset). Not the tolerance: the instrument.
- **Q-PD6-2 [PD8]** — the touch sweep visits a news story with zero affected tickers, so every control
  in that table is unswept. **PD7 regenerates the fixture night — you can make this half-solved.**
- **Q-PD5-2 — CLOSED at PD6.** The `scans-preset` baseline really was a photograph of a hover state
  (from PD2, before PD4 parked the mouse). Cropped, looked at, re-shot.
- **[FYI, PD6] The pictures caught two of my own bugs**, and every guard passed both. Worth his eyes;
  no action.
- **[VETO?, PD4] The tape row is a LIST, not the 3-up grid** Part 7.1 specified. Plan amended in place.
- **[VETO?, PD4] The phone login now carries the mark.** Decided, as PD3 asked.
- **Q-PD3-1 · Q-PD3-2 [WORTH HIS EYES]** — the oracle defending a live bug; the Desk's phone tab order
  vs visual order (forced by CSS, pinned by e2e — **do not reorder the Desk's DOM to "fix" it**).
- **[FYI, PD2] `e2e/briefing.spec.ts` never cleans up its journal entry.** The camera looks away.
- **Q-G4-1 · Q-N6-1 · Q-PD0-1 · Q-G3-2 — CLOSED.**
