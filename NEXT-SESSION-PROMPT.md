# Your session: PD8 — News & ticker depth: the SURFACES. PD8 ONLY.

**PD7 is done and tagged `pd-7` (`306e1c8`).**
**PD7's real dispatch published a sha1 hash to production, in a sentence a human was meant to read,
and every guard in the repo passed it. The only thing that caught it was reading the output.**

The polish & depth build runs PD0 → PD10, one phase per session, and it is not gated on Bishan's
word — he said go.

Read `POLISH-AND-DEPTH-PLAN.md` **Part 9.6, 9.7, 9.4** (the story page v2, the finished feed card,
the byline anchors) and **Part 10** (the ticker page v2), plus **Part 12's PD8 entry** and
**Appendix D** (the VRT delta table).
Your phase is **PD8 and PD8 only.**

**PD8 is an APP phase — it renders everything PD7 just computed.** Part 9's whole thesis is that
depth arrives in two moves and the pipeline went first. The columns are in the database now
(`context`, `watch`, `model_meta`, and the gate's `cleared` allow-list inside `verification`). PD8
is the second move: the surfaces that speak them.

**Before any route work, re-read `app/AGENTS.md`** — the tree runs a customized Next 16 and its docs
live in `node_modules`; the plan binds you to read them rather than trust memory. **Any new card,
panel or module: read `.claude/skills/new-surface` FIRST.**

**PD8 blocks PD9. Do not build the overlay (that is PD9).**

---

## WHAT PD7 BUILT THAT YOU NOW RENDER — the data is real, in production, tested

- **`news_cluster.context`** — the v2 insight's 2–3 mechanical sentences (≤420 chars), narrated only
  from cited registry stats. **Null is the common case** and has THREE distinct causes; see below.
- **`news_cluster.watch`** — a JSON array of SNAPSHOTTED calendar rows: `[{stat_id, key, code, kind,
  title, date}]`. Render them directly — they can never disagree with the feed, and each resolves to
  a real `calendar_event` (PD7 verified this against the seeded world). Link each to the calendar
  module's day anchor. Empty array = no dated events; render nothing.
- **`news_cluster.model_meta`** — `{model_extract, model_synth, extract_count, note_version, usage}`.
  The provenance footer stops hardcoding "Claude Haiku" and prints from this. **Null on pre-PD7 rows**
  (the honest "no extract" fallback stays).
- **`verification.cleared`** — Q-PD5-1's allow-list: the figures the gate CLEARED, brief-wide AND
  per-section (`verification.sections.context.cleared`). **This unblocks ruling E5 on the Desk.** The
  KeyFigure treatment sets a number in mono ONLY if it is in this list. `lib/verified.ts` +
  `splitVerified(text, allowList)` already exist (PD5) — feed them `cleared`, not a deny-list.
- **`verification.sections`** — a per-field verdict map: `{why_it_matters, affected_note, context,
  watch}`, each `{status: "narrated"|"dropped"|"silent"|"out_of_budget"}`. **This is how the story
  page says WHY a section is absent** instead of guessing (the N5 distinction, per section).

---

## THE FIVE THINGS PD7 LEARNED THAT YOU MUST NOT RE-LEARN

### 1. **READ THE PROSE YOUR SURFACES RENDER. A schema that validates is not a schema that says something true.**

PD7 published, to the production database, having passed the schema, the tolerance gate, the E4
lexicon, and its own health log:

> "This story is carried by 1 outlet tonight (cls:798fa63d458eaeca83850221b351fe71ed9cddae:corroboration)."

A sha1 hash in a newspaper. No test in the repo could have caught it. PD8's surfaces render this
prose — so before you tag, **open the seeded story page in a browser (or the seeded e2e), and READ
what it renders.** Print the `context` values. A green axe pass and a passing VRT tell you the pixels
are stable; they do not tell you the sentence is English.

### 2. **`verification.dropped` STILL EXISTS, AND IT IS YOURS TO RETIRE — CAREFULLY.**

`lib/news.ts:342` reads `verification.dropped === true` to set `noteDropped`. PD7 kept it ALONGSIDE
the new `sections` map, because PD7 shipped before you. **You may now migrate the story page to read
`verification.sections.<field>.status` and then retire `dropped`** — but do it as one deliberate
change with the reason logged, and check nothing else reads the old key first (`grep -rn "\.dropped"
app components lib`). Do not leave both readers live forever.

### 3. **EVERY BLOCK NAMES ITS ABSENCE STATE, AND NOTHING RENDERS A PLACEHOLDER (P9).**

9.6's anatomy is ten blocks and each one names what it shows when it has nothing. The `sections` map
is what lets block 5 (Context tonight) distinguish "the gate held it" (say so) from "the narrator had
nothing" (silent) from "out of budget" (silent). **A pre-PD7 row has NONE of the new fields** — the
fixture's fourth pinned shape (`nc-uber-expansion` and the tail) exists exactly so you render that
row without them and every absence answers for itself.

### 4. **Q-PD6-2 IS HALF-SOLVED, AND PD7 HANDED YOU THE STORY TO FINISH IT.**

The touch sweep visits `nc-fed-hold`, which has ZERO catalyst links, so its affected table renders no
rows and no controls get measured — a 21px target lived there for a whole phase. **`nc-fda-nonopioid`
now has three links (MRNA/LLY/PFE) AND the full v2 insight** — it is the story with an affected table
that actually has rows. Point the touch sweep there.

### 5. **THE `/news` BUNDLE IS THE TIGHTEST IN THE APP, AND PD7 SPENT NONE OF IT.**

Worst case `/news` ~195.8 KB against a 200 KB HARD ceiling. The kit components (KeyFigure, TickerChip,
Term) are shared chunks — adopting them on the story/ticker pages is cheap, but WATCH the budget:
`/news/[cluster]` and `/ticker/[symbol]` both have their own baselines (148.5 KB for ticker, the
roomiest). If a route crosses baseline+10 KB, diagnose the overage before tagging — do not wave it
through. **PD9's overlay still has to fit in what's left.**

---

## Part 10 — the ticker page, in one breath

The route exists; the Range Ladder is already its hero. Part 10 finishes it with what the schema
ALREADY serves — no new providers, no invented fields. New blocks: a 52-week strip (from `price_bar`,
marked `data-p2`), tonight's mention (via `catalyst_link` snapshot numbers), the record here (EXISTING
SetupCard/BaseRate — zero new probability UI), the calendar, the paper position. **Market cap does NOT
appear anywhere** — the schema has no size data and the page does not fake it. Non-served symbols
render the honest subset. The loader grows from two queries to six, still one request, still ISR 600s.

**The Rail stays a glance (logged non-change, 10.2)** — its one addition is the clearer "Full view:
{SYM} →" label. Do NOT deepen the rail into a mini-page.

---

## State of the tree

- `main` is clean, `pd-7` is tagged and green, everything is pushed.
- App unit tests: **710** (unchanged — PD7 was a pipeline phase). Pipeline: **610** (was 535; +75, of
  which 31 are Postgres-backed and skip locally without Docker).
- Anti-drift: **28 rules**. VRT baselines: **83** (10 re-shot, the `/news` feed only). e2e specs: **25**.
  Rooms: **14**. Oracle legs: **4**.
- Migration **`pd_news_depth`** applied in production (`check:migrations` clean). `check:live` **green**
  (2 pending: news bylines owed to YOU — Part 9.4; masthead owed to whichever nightly has not run).
- **Bundles: worst `/news` ~195.8 KB against 200 KB.** `/news/[cluster]` and `/ticker/[symbol]` have
  their own budgets — watch them. Fonts pass with 317 KB headroom.
- Lighthouse **CLS 0.000, first-load 152–181 KB** — both hard gates; LCP/perf are advisory synthetic-4G
  numbers that swing ±10 between samples (re-sample before explaining a move).
- Nothing is blocked. Nothing is in flight.

---

## The exit ritual (unchanged — read CLAUDE.md's "The Endgame" block)

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` (**one project at a time, `--workers=1`,
   `lsof -ti:3210 | xargs kill -9` first**) · `check:drift`. `check:migrations` once — **PD8 ships no
   migration, so this one is a formality this time** (unlike PD7).
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` — the same job the tag runs, on the
   exact SHA you will tag. In parallel: wait for the Vercel deploy, then **`check:live`** (news bylines
   should now be GREEN — you built them), `check:nav`, `check:lighthouse`.
4. **PD8 WILL red on pixels** — it is an app phase and adds story/ticker VRT sets (Appendix D). Pull
   the candidates for EVERY red leg, **OPEN EVERY IMAGE, diff all 83+ against committed (not just the
   failures), state your prediction before the run, fix everything, dispatch ONCE** (the standing
   batch rule). **A brand-new surface's first baseline gets eyes before it is committed** — the story
   and ticker v2 anatomies are new pictures nobody has looked at.
5. **Green → `git tag pd-8 <the rehearsed SHA>` — BY SHA, never `HEAD`.** Push, confirm green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — but READ THE FAILURE
   FIRST. PD7's tag rehearsal hit `scans.spec.ts:44` (the thin-night database race) and reran clean.
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd8-depth.md` + this
   prompt rewritten, together. It is free (paths-ignore).
8. **The evidence file ends with the gate-size line.** At `pd-7`: **28 drift rules · 83 VRT baselines ·
   25 e2e specs · 710 app unit tests · 610 pipeline tests · 16 bundle baselines · 14 manifest rooms ·
   4 oracle legs.**

---

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Prepend Node 24 in every shell:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`scans.spec.ts:44`** is a thin-night database race — passes in isolation, reran clean at PD7's tag.
  **`settings.spec.ts:29`** fails on the tagged `pd-5` tree too (a local ISR flake). Neither is yours.
- **`lsof -ti:3210 | xargs kill -9` before ANY local e2e run.** `reuseExistingServer` will serve a
  stale build for an hour.
- **For a seeded browser suite locally** (turns skips into real tests):
  ```bash
  docker run -d --name msm-e2e -e POSTGRES_PASSWORD=test -e POSTGRES_DB=msmtest -p 55434:5432 postgres:16
  DB="postgresql://postgres:test@localhost:55434/msmtest"
  DATABASE_URL="$DB" DIRECT_URL="$DB" npx prisma migrate deploy && DATABASE_URL="$DB" DIRECT_URL="$DB" npm run db:seed
  export DATABASE_URL="$DB" DIRECT_URL="$DB" MSM_SEEDED=1
  ```
  The seed only deletes the three watchlist symbols it creates; delete `QQQ`/`DIA` between runs if a
  `settings.spec` fails.
- **A local Postgres for the pipeline's 31 DB tests** (PD7 used it heavily):
  ```bash
  docker run -d --name msm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=msm_test -p 55433:5432 postgres:16
  TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55433/msm_test" env -u DATABASE_URL uv run pytest
  ```
  The test DB applies migrations only when the schema is ABSENT — if you add a migration, DROP and
  recreate the database or the round-trip tests fail on the missing column (this is a feature: it
  fails loudly).
- **`git checkout -- docs/feel-evidence/nav-timing.md`** before you commit, if you ran the browser
  suite locally — it appends this-Mac-under-contention samples.
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. **Advisory perf varies ±10 — RE-SAMPLE before you explain a move.**
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable, deliberately left uncommitted. **Not yours; leave them.**
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. Not yours; PD8 renders, it does not dispatch.

---

## Questions waiting for Bishan — none of them blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).** The user-authored lines (PD1's deletion, the muted-token floor, the
public repo, the two withdrawn CI reforms, the batch-reshoot rule) are all already honored.

- **Q-PD7-1 [YOURS IF YOU WANT IT]** — the eighth depth stat (sector breadth) is absent because it
  cannot be computed in the news stage. Threading the lake into the newsdesk, or a second migration.
  Not required for PD8; the narrator simply has one less word.
- **Q-PD6-2 [YOURS]** — the touch sweep visits a story with zero affected tickers. PD7 gave every
  needed piece: point it at `nc-fda-nonopioid` (3 links, an affected table with rows).
- **Q-PD6-1 [PD10]** — the pixel oracle is blind to a large, low-contrast change (`threshold` unset).
- **Q-PD5-1 — CLOSED at PD7.** The gate publishes its cleared list; E5 is unblocked on the Desk.
- **Q-PD7-2 [FYI]** — the sha1-in-prose story, recorded for Bishan's eyes. No action.

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD8, tag `pd-8`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD9**, **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `env -u DATABASE_URL uv run pytest` from
`pipeline/` → announce the checkpoint), then begin PD8.
