# PROGRESS.md — resumable state

# CC6 IS DONE — tagged `cc-6` (2026-07-15). Next phase: CC7.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`, COMPLETE). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 ✓ → CC7 → CC8 → CC9 → CC10**

**Checkpoint: CC6 ("Honest relevance") is DONE and tagged `cc-6` by SHA on `2764e4f`.
Nothing is blocked. The next phase is CC7** (CLARITY-AND-CADENCE-PLAN.md — "The control room"), and
NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What CC6 did, in one paragraph

CC6 made the Desk's relevance deterministic, inspectable, pipeline-side and tested (R5). Four things:
(1) **Front-page significance v2** — `newsdesk/rank.py`'s N-phase 5-term SUM is replaced by the plan's
4-term PRODUCT (`catalyst_weight × corroboration × entity_weight × freshness`); entity_weight is the new
dollar-volume term (a macro/Fed event is market-wide → max; else the largest linked name's bucket); scope
and magnitude leave the formula; ties break newest-first; Appendix E (d>a>b>c) is the acceptance test with
a unit test per weight row. (2) **The movers liquid floor** (D6) — the Desk's Movers module shows liquid
names only (large/mid by dollar volume AND a common stock or one of the 15 core ETFs); trusts, wrappers,
structured products and other funds fall to Scans; a per-row `data-liquid-floor` marker + the footnote
"Liquid names only — the full universe stays in Scans." (3) **RelVol "≥20×"** — the degenerate 20.0×
(a thin name's rvol saturating at its window length) now says so. (4) **Calendar hygiene** (D7) — an
earnings row speaks its symbol once (`[EARNINGS] [JPM]` via TickerChip, no "JPM earnings" title);
forward-first ordering; today's reported earnings collapse into one "Reported today: BAC · C · GS · JPM ·
WFC" line. One additive migration: `instrument.asset_class` + `dv_bucket`, backfilled each full nightly.

## The judgment calls worth knowing (all in DECISIONS)

1. **significance v2 REPLACES the N-phase 5-term sum** (the plan specified v2 unaware rank.py existed;
   built the product form faithfully, kept the classifier + magnitude-as-evidence). See LESSONS.
2. **The liquidity notion is scans' single-day `is_large_mid`, NOT baserates' 63-day `_DV_WINDOW`** —
   both top-1000, differ only in the window; scans' is the existing notion the movers carry + more apt for
   a "today's movers" floor. Marked as **Q-CC6-1** (a swap if Bishan wants the 63-day median).
3. **The migration adds `dv_bucket` beyond the plan's named columns** (exchange already exists;
   entity_weight needs per-symbol size the newsdesk can read). assetClass is name-derived (Alpaca gives
   no security type).
4. **The movers loader has a backfill BRIDGE** — falls back to the raw top 8 when dv_bucket is not
   backfilled (a fresh deploy / this migration), so the module never empties; self-heals on the next
   nightly (N0's honest-degrade shape). VRT-neutral (the seed has buckets).

## The gate at `cc-6` (all green on `2764e4f`)

- **App unit 788 (was 781: +1 RelVol cap, +3 isLiquidFloorEligible, +3 CalendarTimeline CC6). Pipeline
  584 passed / 35 skipped (was 579: +4 test_universe, +1 nightly-instrument-enrichment; test_rank
  rewritten for v2).** typecheck · lint · build · check:routes 14/15 · check:bundles (worst 198.9 KB <
  200) · check:fonts (243 KB, 317 KB headroom) · **check:drift 29/29 (NO new rule)** · check:migrations
  (applied locally AND confirmed against production).
- **e2e:local (--ignore-snapshots):** desk desktop 20 + phone 23 (incl. the new movers-marker,
  calendar reported-today, and news-ordering-dek assertions); news desktop 26. Eyeballed the desk-light
  and news-zero-state candidates — all CC6 changes render correctly.

## VRT at `cc-6` — 19 of 97 re-shot, every diff explained

Rehearsal #1 (`9fb1cfa`) redded on VRT. Per the PD5 law, EVERY candidate was diffed against its committed
baseline (pngjs counter — vrt-diff.mjs still broken, Q-LC1-1). The moved set EQUALLED the failed set on
the CC6 surfaces: 19 baseline FILES across four legs. desk-light/dark + desk-thin-night grew ~19px (the
movers footnote + the calendar's reported-today line); news-light/dark/filtered/week/zero-state moved (the
v2 ordering dek + the reordered front page). FOUR shots moved WITHOUT failing on pages CC6 never touched —
login (~17.5k px), sheet-ticker, ticker (6px), track-record (29px) — AA noise on gradients/grids (login
byte-visually identical, confirmed by EYE); LEFT at their committed baselines (PD5 camera law). 19 re-shot,
0 added, 97 total.

## CI evidence (full in docs/clarity-evidence/cc6.md) — two pushes, two rehearsals, one tag

- **Push CI (9fb1cfa = code): 29463477067 green. Rehearsal #1 (9fb1cfa): 29463479390 RED on VRT
  (expected), minted candidates.**
- **Push CI (2764e4f = bridge + 19 baselines): 29464231324 green. Rehearsal #2 (2764e4f): 29464236697
  GREEN, all four legs.**
- **Tag run (cc-6 on 2764e4f): `29464652788` — four-leg oracle, green (8 m 19 s).**
- **Post-deploy: check:live 7/7 (masthead 2026-07-15, calendar hygiene clean, next-edition Thu — the
  CC5 transient did NOT recur). check:migrations PASS (production got the CC6 migration). check:nav worst
  457ms (settings, no regression). check:lighthouse gates green (CLS 0.002, JS 183 KB, a11y 100); advisory
  perf 86.**
- **Step 5 (the pipeline-verification READ): dispatched a real `news` run (`29464668482`, green) and read
  the production front page — see the finding below.**

## THE FINDING FROM READING PRODUCTION (Q-CC6-2 — needs Bishant's eyes)

The formula is correct (the seed orders Fed/macro → FDA → SMCI earnings; Appendix E passes), but the REAL
production front page leads with MISCLASSIFIED stories: a crypto stablecoin PR classified "macro" (leads),
and two SeekingAlpha analyst opinions classified "ma". The fault is `rank.py`'s pre-existing
`classify_event` keyword classifier — **which CC6 never touched** (byte-identical cc-5→cc-6). NOT a CC6
regression (v1 misclassified too, via `scope`), but v2 makes catalyst_weight a full factor, so the
classifier's quality is now load-bearing and newly visible. The entity backfill will NOT fix it (a
macro-misclassified story is market-wide regardless of its bucket). **A classifier improvement is a real,
separate piece of work — Q-CC6-2 (its own small phase, or folded into a later CC phase). The green suite
and the seed both looked perfect; production did not — the pipeline-verification memory earning its keep.**

## THE PENDING LIVE-OBSERVATION GATE (not a blocker — the N0 pattern)

Production's `instrument.dv_bucket` is NULL for all 12,992 rows until the next full nightly (22:37 UTC)
runs the CC6 code. So the movers floor's data is not ready in production yet: the **backfill bridge** shows
the raw top 8 (the pre-CC6 junk parade, e.g. AHD/ASMH — no worse than the status quo), NOT an empty module.
**The floor's full production effect (junk filtered) and entity_weight are confirmed at the next full
nightly.** To see it sooner: `gh workflow run nightly-a.yml -f mode=full`, then open the Desk (the movers
should lose AHD/ASMH and gain the liquid names; the front page should lead with the corroborated macro
story). The seeded world (VRT/e2e) shows CC6 in full already. This is exactly N0's "a migration takes
effect on the next run" — the Autonomy Contract permits proceeding with the pending gate.

## Open / carried forward (none blocking)

1. **Q-CC6-1 (new, [VETO?]):** the liquidity notion — scans' single-day is_large_mid vs baserates'
   63-day `_DV_WINDOW`. Marked deviation; a swap if Bishan wants the median. See DECISIONS + QUESTIONS.
2. **Q-LC1-1 still open:** vrt-diff.mjs broken (`pixelmatch` absent). Worked around with the pngjs
   counter again. Fix is `npm i -D pixelmatch` or a pngjs rewrite — Bishan's call.
3. **Q-CC5-2:** the check:live strip transient — did NOT recur at CC6 (7/7). Still owed to CC8/CC9.
4. **P-1 (news media bucket) + P-2 (control-room PAT) still unprovisioned** — CC7's control room is
   display-only without P-2 (the plan's default). Nothing blocked.
5. **`dummy/` + the UI-LIBRARY-EVALUATION trio** — untracked audit/deliverable evidence, LEFT in place.

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1   # RE-SEED before any run
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots   # one project at a time
```
Guard scripts need **Node 24** — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
`check:live/nav/lighthouse` need `set -a; source .env; set +a`; Lighthouse needs
`CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

## The committed dev tools (LC1–LC3 + the VRT diff)

- `pipeline/scripts/comment_stats.py` · `pipeline/scripts/comment_prover.py`
- `app/scripts/vrt-diff.mjs` — **STILL BROKEN (pixelmatch absent); see Q-LC1-1.** The pngjs-only
  workaround pattern is in PATTERNS.md ("Count VRT candidate pixels without pixelmatch").
