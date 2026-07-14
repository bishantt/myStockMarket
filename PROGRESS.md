# PROGRESS.md — resumable state

# PD7 IS **COMPLETE** — tagged `pd-7` (`306e1c8`), rehearsal green on all four legs (one thin-night
scans flake reran to green — known, not mine). **Thirteen tags.**

**Checkpoint: POLISH-AND-DEPTH-PLAN.md, PD7 (the PIPELINE half of Part 9 — the news depth engine) is
DONE. Nothing is blocked. Nothing is in flight.**

**NEXT: PD8 — news & ticker depth, the SURFACES** (plan Part 9.6/9.7, 10.1, 9.8). PD7 unblocks it;
PD8 blocks PD9. PD8 is an APP phase — it renders everything PD7 just computed.

## What PD7 did, in one paragraph

The LLM narrates only what the pipeline computed, so the pipeline computed more. The verification gate
now publishes its CLEARED list, not only its flags (Q-PD5-1) — which unblocks ruling E5's "emphasis is
earned" on the Desk. The stats registry grew four per-ticker measures (52-week position, ATR-relative
move, streak, distance from the 50-day) plus per-cluster corroboration, recurrence and next-calendar
stats. The news insight schema grew a `context` section and a `watch` list, gated PER SECTION, with a
new deterministic lexicon (E4) that deletes advice verbs and unearned frequency adverbs. `model_meta`
and a nightly cost print close the accounting gap 0.2.3 opened. A migration (`pd_news_depth`) added
three columns. **Nothing renders — PD8 does that.**

## The six things a fresh session must know (each was found by LOOKING, not by a red test)

1. **THE REAL DISPATCH IS THE ONLY THING THAT FOUND THE BUGS, and the whole suite was green through
   two production outages.** PD7 owes a live `news`-mode dispatch, and it ran three times. Run 1
   published ZERO notes (the v2 schema outgrew `_MAX_TOKENS`; Sonnet 5 thinks by default and thinking
   shares the cap). Run 2 published SEVEN contexts that were all a sha1 HASH restated as a sentence
   ("carried by 1 outlet tonight (cls:798fa63d…:corroboration)") — the schema validated, the gate
   cleared every figure, and it was unshippable. Both are fixed and pinned. **PD8: read the prose
   your surfaces render. `docs/pd-evidence/pd7-insight.md` §5–6 is the whole story.**

2. **THE EIGHTH STAT (sector breadth) IS DELIBERATELY ABSENT — Q-PD7-1, YOURS IF YOU WANT IT.** It
   cannot be computed in the news stage: `scan_result` holds only preset MATCHES (breadth over it is
   not the sector's), `price_bar` holds 15 ETFs, and the universe's returns live only in the in-memory
   lake, which the newsdesk (a Postgres closure in BOTH modes) never sees. Fixing it means threading
   the lake into the newsdesk seam OR a second migration — a booked, deliberate act, not an
   end-of-phase slip (Appendix B's own rule).

3. **`verification.dropped` STAYS, AND IT IS LOAD-BEARING RIGHT NOW.** `lib/news.ts` reads it to tell
   the reader "the gate held this line" apart from "the narrator had nothing to say". The v2 `sections`
   map is added ALONGSIDE it, not instead — PD7 ships before PD8, so replacing the key would have
   blinded the live story page and nothing would have failed. **PD8 may migrate the story page to read
   `sections` and THEN retire `dropped`.**

4. **THE FIXTURE NIGHT CARRIES FOUR PINNED SHAPES**, and regenerating it found the fixture modelling
   prose its own producer would refuse (two uncited "usually"/"rarely" lines, deleted by E4), a
   `cleared` list claiming a "2" the gate never cleared (an ordinal), and a watch row pointing at a
   calendar event that does not exist in the seeded world. `nc-fda-nonopioid` is the FULL v2 shape and
   is **the only story with three catalyst links** — so it is the only affected table with rows.
   **Q-PD6-2 is half-solved: point the touch sweep there, not at `nc-fed-hold` (zero links).**

5. **`publish_news`'s COLUMN WRITE now has a database test** (`test_publish_news_depth.py`) — it had
   NONE before PD7, only the E1 date invariant. A phase that adds columns to a writer with no
   round-trip test is a phase betting on luck.

6. **THE COST IS MEASURED, NOT PROMISED.** $0.2253/night (run 2), under 0.2.3's ~$0.36–0.39 estimate.
   `config.py` carries Sonnet 5's LIST price while it runs an intro rate through 2026-08-31, so the
   printed figure is an UPPER BOUND — deliberately, because a cost instrument that under-reports is
   worse than none.

## The gate at `pd-7`

- App unit tests: **710** (unchanged — pipeline phase). Pipeline: **610** (was 535; +75, of which 31
  are Postgres-backed and skip locally without Docker). New files: `briefing/depth.py`,
  `briefing/lexicon.py`, and their tests, plus `test_publish_news_depth.py`.
- Anti-drift: **28 rules** (unchanged). Rooms: **14**. Oracle legs: **4**. e2e specs: **25**.
- **VRT baselines: 83** — **10 re-shot** (the `/news` feed only, both themes × 4 viewports; two card
  sentences changed under E4 and the phone page came back 20px SHORTER). 0 added. All 83 candidates
  were diffed against committed, not just the 4 failures: 16 moved, 12 were the CAMERA (login gradient
  dither, sub-tolerance jitter on untouched pages) and left alone.
- **Bundles unchanged — PD7 spent no first-load JS.** Worst still `/news` (~195.8 KB vs 200 KB ceiling).
- Migration **`pd_news_depth`** — 3 columns, all nullable/defaulted, no backfill. `check:migrations`
  clean against production (Vercel applied it on deploy). `check:live` **green — 5 pass, 2 pending**
  (news bylines owed to PD8; masthead owed to whichever nightly has not run). `check:lighthouse`
  **CLS 0.000, first-load 152–181 KB** — both hard gates; LCP/perf are the advisory synthetic-4G
  numbers that swing ±10 between samples (re-sampled: LCP 5.29 → 4.49s).

## The local harness, as actually used this phase (it all works — use it)

A seeded Postgres in Docker turns 149 skipped browser tests into 222 that actually run. PD6's whole
touch-target finding came out of it, and it would have reached CI otherwise.

```bash
docker run -d --name msm-e2e -e POSTGRES_PASSWORD=test -e POSTGRES_DB=msmtest -p 55434:5432 postgres:16
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest" DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy && npm run db:seed
export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9          # ALWAYS, before any run — reuseExistingServer will lie to you
npx playwright test --project=phone --workers=1 --ignore-snapshots
```

**The seed only deletes the three watchlist symbols it creates**, so a failed `settings.spec` leaves
`QQQ`/`DIA` behind and poisons the next run. Delete them between runs.

## Two local e2e failures that are NOT yours (both re-confirmed at PD6)

- **`scans.spec.ts:44`** — passes in isolation. The thin-night specs mutate the shared local database;
  CI gives every leg its own.
- **`settings.spec.ts:29`** — **fails on the tagged, green `pd-5` tree too.** I stashed PD6, rebuilt
  `pd-5`, ran it against the same database, and it failed *earlier*, at a different assertion. A local
  ISR-revalidation flake, and it has now been confirmed against two different tags. Do not chase it.
