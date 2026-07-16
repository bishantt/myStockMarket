# CC6 — Honest relevance — evidence

**Tag `cc-6` (by SHA on `2764e4f`). Plan: CLARITY-AND-CADENCE-PLAN.md §4.5 (Part 2 D6/D7, Part 3 R5,
Appendix B #1, Appendix E, Part 5 CC6).** CC6 makes the Desk's relevance deterministic, inspectable,
pipeline-side and tested (R5): the front-page significance formula, the movers liquid floor, the
RelVol saturation label, and the calendar row grammar.

## What CC6 built

### 1. Front-page significance v2 (`newsdesk/rank.py`) — a product, not a sum
The N-phase `significance` was a 5-term weighted SUM (scope, corroboration, magnitude, class_prior,
recency), built 2026-07-13, two days BEFORE the CLARITY plan and unmentioned by it. 4.5 specifies
significance **v2** as a 4-term PRODUCT: `catalyst_weight × corroboration × entity_weight × freshness`.
- `catalyst_weight` = the existing CLASS_PRIOR table (renamed CATALYST_WEIGHT — already ranks
  M&A/FDA/macro/Fed=1.0 over analyst=0.4). `corroboration`/`freshness` = the existing helpers renamed.
- `entity_weight` = the NEW dollar-volume term: market-wide (macro/Fed) → max; else the LARGEST linked
  name's bucket (large_mid → 1.0, small/unknown → 0.5). A no-listing single-name story is small, NOT
  market-wide (the recorded-night test caught the tie this fixed).
- `scope` and `magnitude` leave the FORMULA. magnitude only ever worked on served symbols; it is kept
  as diagnostic evidence on the row (computed, stored), not a ranking term.
- Ties break **newest-first** (ingest.py sort + both app orderings), amending the documented oldest-first.
- **Appendix E is the acceptance test:** the four clusters (Iran/oil, NXTC merger, LDOS analyst, CPI
  print) pin **d > a > b > c** (`test_appendix_e_orders_d_a_b_c`), and there is a unit test PER weight
  row (CATALYST_WEIGHT + ENTITY_WEIGHT).

### 2. The movers liquid floor (D6) — `loadMovers` + footnote + marker
Eligible = large/mid by dollar volume AND (a common stock OR one of the 15 core index/sector ETFs).
Trusts, ADR-hedged wrappers, structured products and every other fund fall out to the universe-wide
Scans. The loader fetches the latest run's unusual-volume matches IN FULL, floors, takes 8. A per-row
`data-liquid-floor` marker (e2e-pinned) and the footnote "Liquid names only — the full universe stays
in Scans" (copy `mover.floorNote`). `isLiquidFloorEligible` is pure + exported (DB-free unit test).
**Backfill bridge:** `instrument.dv_bucket` is stamped by the full nightly; between this migration and
the first nightly to run it, the column is null and the floor would empty the module — so loadMovers
falls back to the raw ranked top 8 (pre-CC6 behavior) until the data is ready, self-healing on the next
nightly (N0's honest-degrade shape). VRT-neutral (the seed has buckets).

### 3. RelVol "≥20×" (D6)
Not a clamp — a degenerate denominator: rvol20 = today's volume ÷ its 20-day average (which INCLUDES
today), so it is mathematically bounded by the window length (20). A value at the ceiling means a
thin/newly-listed name whose prior days had ~no volume. The display saturates to "≥20×" (copy
`mover.relvolCapped`) rather than a canned "20.0×". The floor removes most such names anyway.

### 4. The migration (Appendix B #1, extended) — `asset_class` + `dv_bucket`
`instrument.exchange` already existed, so the real migration adds `asset_class String?` +
`dv_bucket String?` (both nullable, backfilled each full nightly, COALESCE'd so a news-mode upsert
never null-outs a good value). `assetClass` is name-derived (universe.classify_asset_class — Alpaca
gives no security type); `dv_bucket` reuses scans.py's `is_large_mid` (the existing per-symbol notion
the movers carry). `check:migrations` confirmed production's DB got it on deploy.

### 5. Calendar hygiene (D7) — app-side (timing is CC8's, Appendix B #4)
An earnings row speaks its symbol ONCE: `[WEEKDAY DATE] [EARNINGS] [JPM]` via a TickerChip, dropping
the redundant "JPM earnings" title (the weekday was already in the date label since CC2). Forward-first:
tomorrow's events lead (loadCalendar reads date > edition); today's reported earnings collapse into one
"Reported today: BAC · C · GS · JPM · WFC" line (copy `calendar.reportedToday`). Seeded five sessionPlus(0)
bank earnings to exercise the collapse.

## The gate (Endgame order)

- **Local:** app **788** unit (was 781: +1 RelVol cap, +3 isLiquidFloorEligible, +3 CalendarTimeline
  CC6) · pipeline **584** (was 579: +4 test_universe, +1 nightly-instrument-enrichment; test_rank
  rewritten for v2) · typecheck · lint · build · check:routes 14/15 · check:bundles (worst 198.9 KB <
  200) · check:fonts (243 KB, 317 KB headroom) · **check:drift 29/29 (no new rule)** · e2e:local
  (desk/news desktop+phone, incl. the movers-marker + calendar reported-today + news-ordering-dek
  assertions) green. **check:migrations applied locally (docker) AND confirmed against production.**
- **Push CI (`9fb1cfa` = code): `29463477067` green (app + pipeline).**
- **Rehearsal #1 (`9fb1cfa`): `29463479390` RED on VRT (expected, all four legs), minted candidates.**
- **VRT re-shoot:** every candidate diffed against its committed baseline (pngjs; vrt-diff.mjs still
  absent-pixelmatch — Q-LC1-1). The MOVED set equalled the FAILED set on the CC6 surfaces: **19 baseline
  files** across four legs (desk-light/dark + desk-thin-night grew ~19px — movers footnote + reported-today
  line; news-light/dark/filtered/week/zero-state moved — the v2 dek + reordered front page). Every
  candidate opened; desk-light + news-zero-state eyeballed and correct. FOUR shots moved WITHOUT failing
  on pages CC6 never touched (login ~17.5k px, sheet-ticker, ticker 6px, track-record 29px) — AA noise on
  gradients/grids (login byte-visually identical, confirmed by eye); LEFT at their committed baselines
  (PD5 camera law). 19 re-shot, 0 added, 97 total.
- **Push CI (`2764e4f` = bridge + baselines): `29464231324` green. Rehearsal #2 (`2764e4f`):
  `29464236697` GREEN, all four legs.**
- **Tag run (`cc-6` on `2764e4f`): `29464652788` — four-leg oracle, green (8 m 19 s).**
- **Post-deploy (against the `9fb1cfa` deploy, unchanged product between the two SHAs — the bridge is
  fallback code and the baselines are test artifacts): check:live **7/7** (masthead 2026-07-15, calendar
  hygiene clean, next-edition Thu correct — no transient this time). check:migrations PASS (production got
  the CC6 migration). check:nav report mode, worst 457ms (settings writer room, no regression).
  check:lighthouse gates green (CLS 0.002, first-load JS 183 KB < 200, a11y 100); advisory perf 86.**

## The pipeline-verification READ — it earned its keep (the memory's lesson)
Step 5 (the plan's, and the memory's): dispatched a real `news` run in production (`29464668482`, green)
and READ the published front page — not the green suite. It surfaced a genuine finding, and it is the
whole reason this step exists.

**The formula is correct** (the seed orders Fed/macro → FDA → SMCI earnings; Appendix E passes). **But
the production front page leads with misclassified stories:** a crypto stablecoin PR classified "macro"
(sig 0.60, leading), and two SeekingAlpha analyst opinions (PayPal, Alaska Air) classified "ma". The
fault is `rank.py`'s pre-existing `classify_event` keyword classifier mislabelling messy real headlines —
**which CC6 never touched** (the `_EVENT_KEYWORDS` and the classifier body are byte-identical cc-5→cc-6).
It is NOT a CC6 regression (v1 ranked misclassified-macro stories high too, via its `scope` term), but v2
makes catalyst_weight a FULL factor, so a misclassification swings the score 3× where v1's sum gave it
15% — the classifier's quality is now load-bearing and newly visible. The entity backfill will NOT fix it
(a macro-misclassified story is market-wide regardless of its bucket). Flagged as **Q-CC6-2** (a
classifier improvement — its own piece of work, deliberately not smuggled into CC6's end).

**Separately, the backfill:** production's `instrument.dv_bucket` is NULL for all 12,992 rows until the
next full nightly (22:37 UTC). Until then the movers floor's data is not ready, so the backfill bridge
shows the raw top 8 (the pre-CC6 junk parade, e.g. AHD/ASMH — no worse than the status quo), NOT an empty
module. The floor's full production effect and entity_weight are confirmed at the next full nightly — a
pending live-observation gate, the N0-migration pattern. The seeded world (VRT/e2e) has buckets and shows
CC6 in full: liquid movers, the corroborated Fed/macro lead, the collapsed bank earnings.

## Gate size
29 drift rules · 97 VRT baselines · 27 e2e specs · app 788 / pipeline 584 unit tests · 16 bundle
baselines · 14 manifest rooms · tag run `29464652788` 8 m 19 s.
