# PROGRESS.md — resumable state

**P3 CODE-COMPLETE (2026-07-11) — the briefing. Pending the live observation week, not yet tagged.**
The editorial heart ships: extract → synthesize → verify across the two jobs, rendered as the
BriefArticle, degradable and offline-cached (the brief is part of the cached Desk document the SW
already caches). What was built:
- **Pipeline (`briefing/`):** `schema.py` (Appendix G pydantic, strict, round-trip tested);
  `extract.py` (Stage A — one Haiku call per article over the Message Batches API, batch-cutoff
  collect with an injected clock: ended→all, past-cutoff→cancel + sync the remainder, malformed
  result dropped not fatal); `synthesize.py` (Stage B — one sync Sonnet call, structured output,
  one-retry-on-schema-violation → None held); `verify.py` (the deterministic gate — Appendix E
  tolerances for percent/money/number/date/ticker, held on a focus flag or >2 flags, verification
  JSON records every decision); `stats.py` (the computed-stats table — movers as unsigned magnitudes
  so an honest "fell 2.3%" is not flagged); `evening.py` (Job B orchestration, dependency-injected).
- **Wiring:** Job A submits the extraction batch (deterministic sha1(provider|url) news ids so the
  batch custom_id, the news_item row, and the citation URL all line up) and records batch_id on
  pipeline_run. Job B: holiday preflight (non-session night → ping success, no row), collect →
  synthesize → verify → publish_briefing (atomic; held nights recorded; PM edition preserved on an
  AM rerun), weekly backup, revalidate, dead-man ping. Comes up key-free during buildout.
- **Prisma v3:** `briefing` (am/pm JSON, verification_json, model_meta, status) + `journal_entry`;
  migration `20260711195243_p3_briefing_and_journal` applied to Supabase.
- **App (step 4):** `lib/briefing.ts` (zod parse — malformed → held — + pure view-model builder,
  numbering only news-backed citations); `BriefArticle` (module 02 — display-italic Today's-focus
  headline, labeled item slots, per-claim source superscripts linking to news_item URLs, one Academy
  doorway gated on the empty-until-P5 manifest, neutral "briefing unavailable" on a held gate); the
  `ScorecardPM` shell ("grading begins in P4") over the PM journal write (`journal_entry` server
  action); wired into the morning loader and the Desk page; the seed writes a published briefing.
- **Tests:** pipeline 162 passing + 13 CI-only DB-integration skips locally (45 new briefing tests:
  schema 8, verify 13, extract 8, synthesize 4, evening 7, stats 5; plus 3 briefing-publish + 1
  batch_id integration tests that run in CI); app 105 unit (briefing 11 incl. the mandatory
  "zod rejects malformed briefing JSON" suite, journal 4) + a new MSM_SEEDED e2e briefing journey.
  typecheck, lint, and the webpack build all green.
- **Deferred within P3 (logged in DECISIONS):** the live late-news delta sweep (Job B runs with
  late_news=None) — the batch already captures the day's news; the batch-cutoff fallback is built.
- **STILL TO DO for the P3 exit gate (Blueprint P3):** five consecutive nights of real briefings in
  which every number/ticker/date passes the gate (observe the week; workflow_dispatch reruns if a
  night is missed); the batch-cutoff fallback drill exercised once for real; publish confirmed atomic
  under a mid-publish request; the brief read on the phone ritual column and offline. Requires the
  ANTHROPIC_API_KEY to be live and the jobs to run in the cloud.

**P2 COMPLETE — tagged `phase-2` (2026-07-11).** The Desk explains itself. CI-green on the tag
(app + pipeline + e2e incl. journey 4). Delivered: the five adapters (Finnhub/Marketaux/FMP/EDGAR/
FRED-calendar, real fixtures); Prisma v2 (news_item, calendar_event); the catalyst matcher
(classify + ticker/time-window join); publish persistence; the nightly catalyst ingest with
PER-SOURCE degradation (one provider down ⇒ its section degrades, run succeeds); and the Desk
modules — Movers (04) with catalyst chip + reason + source link or the honest noise line,
CalendarTimeline (03) with consensus, and the SourceStatusFooter (degraded lines + FRED
attribution). Universe narrowed to common stocks + ETFs. Deferred: EDGAR filings in the ingest
(need symbol→CIK). Next: **P3 — the briefing** (extract → synthesize → verify, the BriefArticle).

**P2 (2026-07-11) — catalyst & context layer.** Detail:
- **Housekeeping:** universe narrowed to common stocks + ETFs (drops warrants/units/rights/
  preferreds/baby-bonds by asset name; no-OTC kept; flows through to movers/scans/served — test-first);
  QUESTIONS closed (Supabase password rotation DECLINED, healthchecks check deleted, Vercel git
  auto-deploy connected).
- **Step 1 — adapters (DONE):** finnhub (company news + metrics), marketaux (market-wide tagged
  news), fmp (earnings calendar — /stable/ has date+consensus, no bmo/amc, logged), edgar (per-CIK
  filings, User-Agent asserted), fred extended (release calendar). All test-first vs REAL recorded
  fixtures (recorded via a temp workflow, since deleted; fixtures trimmed). Credentials constructor-
  injected. 12 new tests.
- **Step 2 — schema + matcher + persistence (DONE):** Prisma v2 news_item (dedup provider+url,
  tickers[], event_type, extract Json) + calendar_event (kind/symbol?/timing?/consensus/prior),
  migrated. catalysts.py — classify(headline)→type + match_catalysts() (ticker + time-window join,
  most-recent-wins, provider-agnostic NewsRecord), 5 tests. publish() writes news_item (upsert) +
  calendar_event (replace forward window; None leaves it untouched), 2 DB tests.
- **STILL TO DO for P2:** (a) wire the nightly catalyst ingest — fetch news for the movers
  (finnhub+marketaux) + the calendar (fmp+fred), match/classify, publish, with PER-SOURCE status
  into pipeline_run.sourceStatus (one provider down ⇒ its section degrades, run succeeds); (b) Desk
  step 3 — 03 CalendarTimeline, 04 Movers upgraded (catalyst Tag + reason + source link, or the
  noise line), SourceStatusFooter with FRED attribution; (c) step 4 copy-deck degraded/empty states;
  (d) e2e journey 4 (partial). Acceptance: every >3% mover shows a catalyst chip or the noise tag;
  killing one provider key degrades one section, not the run.
- Pipeline 116 tests (incl. new DB tests run in CI). app 82 unit + 48 e2e green. main is CI-green.


**P1 COMPLETE — tagged `phase-1` (2026-07-11).** The full P1 exit gate is green on the tag CI:
app (typecheck/lint/80 unit/webpack build), pipeline (96 pytest incl. DB + backup-restore round
trip), and the browser suite (48 Playwright: auth, PWA, seeded Desk data, watchlist CRUD, drill &
return, offline + expired-cookie drills). Steps 1–9 done: schema v1 + market_context, adapters
(Alpaca/FRED), indicators, scans + Parquet/DuckDB, publish, the real Desk (macro/movers/watchlist +
all 8 mastheads), the ticker drill (RailSheet level 2 + /ticker Lightweight Charts level 3), the SW
morning cache + OfflineRibbon, and the weekly pg_dump backup + restore test. signal_log emits with an
exact 10-trading-day resolves_on (NYSE calendar). Job A's nightly flow ran real data end to end
(12,933 instruments, 98.4% coverage, 1,825 scans). **Exit-gate budgets:** first-load JS 133KB ✓,
CLS 0.000 ✓, a11y 100 ✓; **LCP accepted as a synthetic-4G artifact** (user decision 2026-07-11 —
real TTFB is ~100ms via ISR + edge cache; Lighthouse's simulated cold-4G LCP is a lab number). Two
P1 follow-ups logged: capture visual-regression baselines on a CI Linux runner, and narrow the
12,933 universe to common-stock + ETF asset classes (currently includes warrants/units/preferreds).

**REAL DATA IS LIVE (2026-07-11).** Job A ran the full nightly flow in the cloud end to end and
published real market data to Supabase: universe 12,933 instruments, coverage 98.4% (over the 95%
floor), 1,825 scan matches, 15 served symbols (indices + sector ETFs; watchlist empty), breadth
5,091 advancing / 3,987 declining / 60.75% above the 50-day, VIX + 10-year from FRED. The deployed
Desk's Macro pulse and Movers now render live data; the watchlist shows its empty state until names
are added. Two fixes got the first run green: Alpaca IEX feed (free plan 403'd on SIP), and NaN
scan metrics coerced to JSON null (Postgres jsonb rejects NaN). Both committed + tested.
- **Universe note (P2 refinement):** 12,933 is broader than the plan's "common stocks + ETFs" — it
  currently includes warrants (…WW), units (…U), preferreds (…P), rights. The no-OTC rule holds;
  narrowing to common stock + ETF asset classes is a P2 universe-quality item, not a blocker.


**Current phase:** P0 COMPLETE — tagged `phase-0` (2026-07-10). P1 (data spine) is next.
**Last green gate (§6.4), 2026-07-10:** typecheck, lint, 45 app unit, 13 pytest, webpack build,
font budget (237/320KB), 28 Playwright (auth + PWA, both viewports), anti-drift §3.10 greps —
all green. **Lighthouse** (deployed /, mobile 4G, authenticated via a minted cookie —
scripts/lighthouse-check.mjs): performance 90–95 ✓, a11y 100 ✓, CLS 0.000 ✓, first-load JS
131KB ✓; LCP 2.8–3.4s accepted as a synthetic cold-4G artifact on a contentless page (DECISIONS
2026-07-10, QUESTIONS-FOR-BISHANT.md — a [VETO?] item). **Healthchecks down-drill: PASSED** —
/start with no success → STATUS=down after the 45-min grace → recovery → STATUS=up, all via the
read-only API.
**Checkpoint:** P0 steps 1, 3, 4, 5, 6, 7, 8 done and committed; step 9 is done except the
Vercel deploy. **The P0 loop is proven end to end:** the cloud wrote a pipeline_run row and the
app renders it. Only the Vercel deploy and the remaining Session-0 secrets stand between here
and the P0 exit gate.

**THE LOOP IS CLOSED (2026-07-10).** Dispatched nightly-a → Job A ran green in GitHub Actions
and wrote pipeline_run(run_date=2026-07-10, stage={hello: ok}) to Supabase, cloud-only. The
Desk reads it and shows "as of 14:43 ET · Written by the nightly pipeline in the cloud". CI is
green on every push (app + pipeline jobs; e2e runs on phase-* tags).

**SESSION-0 ALL BUT DONE (2026-07-10).** All 9 provider probes green with real keys
(Alpaca, Finnhub, FMP, Marketaux, FRED, EDGAR, Anthropic, R2 put/get/delete, healthchecks) —
a named P0 exit criterion. 19 GitHub secrets set. App login (bishantt) in local .env, hash
verified through Next's loader + bcrypt. nightly-b dispatched → the healthchecks dead-man check
is **up**, confirmed via the read-only API. The only Session-0 item left is Vercel.
- FMP needed the /stable/ API (v3 retired 2025-08-31) — probe fixed, P2 adapter noted.
- `.env.session0` collection file deleted after distribution; `.vercel-auth-hash.tmp` (raw hash
  for Vercel, git-ignored) is kept for the deploy.

**GitHub is live (2026-07-10).** github.com/bishantt/myStockMarket — private, Actions enabled,
all commits pushed. Token has repo + workflow scope. First push needed http.postBuffer raised
(the PDFs exceeded Git's 1MB default) and HTTP/1.1; those are set in the local git config.

**PWA seed done (step 6).** Manifest, six icons from public/mark.svg, Serwist service worker,
/offline. 14 e2e tests green. The production build uses `next build --webpack` (Serwist needs
webpack; Next 16 defaults to Turbopack) — dev stays on Turbopack.

**Supabase is live (2026-07-10).** All three connection strings verified; `pipeline_run`
migrated onto the real database; a Prisma write/read/delete round-trip through the pooler
succeeds. `DIRECT_URL` points at the IPv4 session pooler because the free-tier direct host is
IPv6-only on this network (logged). The DB password was visible in chat when pasted — a
rotation at the end of Session-0 is recommended, after which the strings get re-pasted and
re-tested once.

## Where the build actually is

Eleven commits on `main`, all pushed to github.com/bishantt/myStockMarket (private, CI green):

- repo init + scaffold verified against §2.2; DEVELOPMENT-PLAN.md regenerates byte-identical.
- Next 16.2.10 + React 19 + Tailwind v4; the full §3.2–3.4 token set; fonts 237KB / 320KB.
- `lib/time.ts` (DST-tested), `lib/copy.ts` (Appendix J, pinned), `SectionMasthead` / `Tag` /
  `StatFigure`, the Desk shell, `/styleguide`.
- The login wall: `lib/auth.ts`, `lib/password.ts`, `proxy.ts`, `/login`, hash script.
- Prisma 6.19 schema v0 (`pipeline_run`), migrated onto Supabase, `lib/db.ts`.
- PWA seed: manifest, six icons from `public/mark.svg`, Serwist SW (`app/sw.ts`), `/offline`.
- Pipeline skeleton: `config.py`, `monitoring.py`, `jobs/job_a.py`, `jobs/job_b.py`,
  `scripts/probe_providers.py`; four workflow YAMLs (nightly-a/b, ci, migrate).
- The Desk reads `pipeline_run` and shows the cloud run's timestamp — the loop, closed.

Tests: 45 app unit + 14 Playwright (auth + PWA) + 13 pipeline pytest, all green. CI runs the
app and pipeline jobs on every push; e2e + Lighthouse on `phase-*` tags.

## P0 is DONE (tagged phase-0, CI green). Now in P1 — the data spine (plan §7 P1).

**P1 build order (plan §7):** 1) Prisma schema v1 + seed · 2) adapters/base.py + alpaca.py
(mint new-provider-adapter) · 3) indicators.py toy-series-tested (mint new-indicator) ·
4) Parquet/DuckDB store + scans.py (5 presets) · 5) publish.py wired into job_a · 6) Desk
modules 01 macro / 04 movers / 05 watchlist, all 8 mastheads · 7) RailSheet + /ticker/[symbol]
with Lightweight Charts · 8) SW morning-payload cache + OfflineRibbon · 9) weekly pg_dump.
**Tests-first (§6.2):** every indicator (toy series), adapter fixtures + rate-limit, universe
hard-fail (<95%), publish transaction isolation, stage-skip rerun, signal_log idempotency,
watchlist server actions, e2e journeys 1/2/5, visual baselines.

## Next 3 tasks

1. **P1 step 7 — the drill (level 2)**: RailSheet + `/ticker/[symbol]` with Lightweight Charts
   (candles + volume). Desk watchlist/movers rows open the rail (no route change); "Open full view"
   pushes the ticker route with a back rail. e2e journey 2 (drill & return).
2. **P1 steps 8-9**: SW morning-payload cache + OfflineRibbon (X-SW-Source header); weekly pg_dump
   in nightly-b + one restore test. Wire the trading calendar (exchange_calendars) and turn on
   signal_log emission (deferred — see below).
3. **Phase-1 exit**: §6.4 gate (LCP now a HARD gate — real content is measurable now), capture
   visual baselines, then tag phase-1. Also a P2 universe-quality item: narrow the 12,933 universe
   to common stock + ETF asset classes (currently includes warrants/units/preferreds).

## P1 progress
- **step 1 DONE:** Prisma schema v1 migrated (Instrument/PriceBar/ScanResult/SignalLog/
  WatchlistItem); signal_log insert-only via trigger (owner bypasses REVOKE).
- **step 2 DONE:** `adapters/base.py` (TokenBucket rate limiter, load_fixture, Adapter — 11 tests)
  and `adapters/alpaca.py` (daily_bars + list_universe — 7 tests) built test-first against REAL
  recorded fixtures. `new-provider-adapter` skill MINTED; PATTERNS.md has the adapter shape.
  Structural fix logged: exchange is a String (ETFs list on ARCA), no-OTC enforced at ingest.
  Fixtures recorded via `scripts/record_alpaca.py` + a temp Actions workflow (removed).
- **step 3 DONE:** `indicators.py` — the full Appendix F set as Polars expressions, verified
  against pandas-ta-classic on a deterministic toy series (`tests/toy_series.py`); exact for
  non-recursive, converged-tail for the smoothers; causality guard. 20 tests. `new-indicator`
  skill MINTED. Uses polars-lts-cpu (Rosetta/no-AVX2 dev machine) + pyarrow (dev).
- **step 4 DONE:** scans.py (5 presets, 19 tests) + parquet_store.py (year-partitioned Parquet +
  DuckDB, 5 tests).
- **step 5 DONE:** publish.py — single-transaction serving-DB refresh (upserts + insert-only
  signal_log + per-run scan replacement + atomic rollback + market_context), 7 integration tests
  against a throwaway Postgres (skip locally without Docker; CI runs them via a postgres:16 service).
- **step 5 WIRING DONE:** `nightly.py` — Job A's full flow as run_nightly(deps), dependency-injected
  and tested end to end with fakes (5 tests: universe coverage floor, full-publish, FRED-outage
  degrade, breadth, served-bar selection). `storage.py` — R2Store (boto3 S3, key-mirrors the Parquet
  tree, 4 tests with a fake client). `jobs/job_a.py` rewritten from the hello-run to build the real
  Alpaca/FRED adapters + ParquetStore + R2 + conn and call run_nightly; nightly-a.yml now passes the
  Alpaca/FRED/R2 secrets. **Deferred (logged):** signal_log emission waits for the trading calendar
  (permanent insert-only log must not bake an approximate 10-trading-day horizon). **Not yet run in
  the cloud** — dispatch nightly-a to prove it end to end and light up the deployed Desk.
- **step 6 DONE (incl. watchlist writes):** the three Desk modules render live data, and the
  watchlist is now fully CRUD. `lib/watchlist.ts` (pure rules: reason required, focus cap = 3 —
  9 tests). `/settings` route: server actions (add/remove/toggleFocus, cap enforced in the write
  path, validated at the boundary with zod) + an editorial add form and an editable list
  (`AddWatchlistForm`, `WatchlistManager`). A "Settings" nav link added. Watchlist copy is inline UI
  microcopy (Appendix J has no watchlist strings — logged). `e2e/settings.spec.ts` (MSM_SEEDED-gated,
  per-project symbol to avoid the desktop/phone DB race): add → shows on Desk → focus/unfocus →
  remove, plus a duplicate-refused check. Build green (/settings is dynamic); typecheck + lint clean.
- **step 6 (earlier) — real-data wiring:** the three Desk modules WIRED to real serving data.
  - `market_context` table added (VIX / 10-year / breadth had no home in Appendix B) + migration
    `market_context`; `publish.py` writes it in the same transaction (2 new DB tests).
  - `fred.py` minimal adapter (VIXCLS + DGS10) — 4 tests, real recorded fixtures.
  - `lib/format.ts` — the number-formatting home the conventions name (price/signedPercent/percent/
    multiple/directionOf), 8 tests; true-minus, flat band.
  - `lib/morning.ts` — the Desk loader: pure builders (buildMacro/buildMovers/buildWatchlist, 8
    tests) + `getMorning()` with per-module graceful degradation. Movers are sourced from the
    unusual-volume scan (volume-confirmed moves; catalysts in P2 — logged).
  - The Desk page renders MacroPulse/Movers/Watchlist when data exists, else the quiet placeholder;
    a live module only stamps a date when a run is recorded.
  - `prisma/seed.mjs` — deterministic synthetic morning, plain ESM (`npx prisma db seed`), with a
    guard that refuses any Supabase host (dev/test only; honesty rules forbid seeding production).
  - `e2e/desk.spec.ts` — journey 1 (P1 variant), gated by MSM_SEEDED=1; CI e2e job now stands up a
    Postgres service, runs `prisma migrate deploy` + `db:seed`, and asserts the rendered morning.
  - STILL TO DO for step 6: job_a's full ingest→compute→scan→publish flow (writes the real
    market_context + scans the loader reads). Until then the deployed Desk shows placeholders (no
    production seed by design).
- **Vercel git auto-deploy** connected; Root Directory = `app` (fixed via API). Every push deploys.
- **Tests: 71 app unit + 31 e2e (28 + 3 seeded-Desk) + 82 pipeline (CI, incl. 7 DB) green.**
- **LCP ≤ 2.5s is now a HARD P1-exit gate** (user directive 2026-07-11; scripts/lighthouse-check.mjs
  exits non-zero on a miss). Do not tag phase-1 until it passes for real.
- Note: the deterministic `prisma/seed.ts` synthetic morning still pending (pairs with the Desk
  modules at step 6). DB verification should use a throwaway DB, not production Supabase.

## P1 progress
- **step 1 DONE (2026-07-10):** Prisma schema v1 migrated to Supabase (Instrument, PriceBar,
  ScanResult, SignalLog, WatchlistItem, Exchange enum). signal_log insert-only enforced by a
  trigger (owner bypasses REVOKE — see DECISIONS/LESSONS), verified UPDATE+DELETE both rejected.
  The deterministic `prisma/seed.ts` synthetic morning is deferred to pair with the Desk modules
  (step 6) that consume it and the e2e journey-1 P1 variant.
- Note for DB tests: use a throwaway/test DB, not production Supabase (a verification left an
  undeletable signal_log row I had to TRUNCATE). The plan calls for dockerised Postgres for
  pipeline tests and a seeded DB for e2e.

## Deployment facts (2026-07-10)
- Production: **https://mystockmarket-eight.vercel.app** — our /login wall gates it; preview/
  deployment URLs sit behind Vercel SSO (the licensing wall for previews). Vercel project
  `bishantts-projects/mystockmarket`, linked from `app/`, build command `npm run build`.
- Vercel env (production + preview): DATABASE_URL, DIRECT_URL, AUTH_USER, AUTH_PASS_HASH (raw),
  AUTH_COOKIE_SECRET, CRON_SECRET, APP_BASE_URL — all set.
- Local auth now lives in `app/.env.development.local` (dev-only), NOT root .env — see the
  DECISIONS/LESSONS entries on the e2e hermeticity fix. `.vercel-auth-hash.tmp` (raw hash) can be
  deleted now that Vercel has the value.
- Git auto-deploy is NOT connected yet (the repo is the parent of `app/`; do it in the dashboard).

## Blocked

- **Remaining Session-0 values** (Supabase ✓ and GitHub ✓ are already in): Vercel link +
  preview-protection confirmation · Cloudflare R2 (account id + access key + secret) · provider
  keys (Alpaca, Finnhub, FMP, Marketaux, FRED) · EDGAR name+email · Anthropic key + $15 cap ·
  healthchecks check + read-only API key · the app login username+password. Drop them in the
  git-ignored root `.env` and say so; I distribute per Appendix D. **Fallback in force:** none
  needed — all key-free P0 work is done.
- **Recommended cleanup:** rotate the Supabase DB password (it was visible in chat when pasted),
  then re-paste the three strings for a single re-test.
- Already generated / set: `CRON_SECRET`, `AUTH_COOKIE_SECRET`, `R2_BUCKET` in `.env`;
  DATABASE_URL, SESSION_POOLER_URL, CRON_SECRET as GitHub secrets.

## Decisions worth knowing before you touch anything

- **One structural deviation this session**, logged in DECISIONS.md and annotated into both
  `DEVELOPMENT-PLAN.md` §3.2/§4.5 and their `docs/src/dp-*.html` sources (Part 10 rule 9):
  Newsreader's optical-size axis is dropped. It cost 153KB and broke the plan's own font budget.
  The display italic survives. `npm run check:fonts` enforces the budget from now on.
- `globals.css` uses `@theme static`. A bare `@theme` tree-shakes unused tokens, which silently
  deleted 12 of the 17 colour tokens — including the three the chart hook will read at runtime.
- `lib/tokens.ts` is the only file besides `globals.css` allowed to contain a hex colour.
- Node 24 does **not** resolve by default in this environment: Claude Code runs on Node 20 and
  its PATH leaks into every spawned shell. Prepend
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` to build and test commands.

## Scaffold provenance (2026-07-09, planning session — before any build session)

Created: CLAUDE.md · DECISIONS.md · PATTERNS.md · LESSONS.md · this file ·
.claude/skills/ (README + 2 seed procedure skills) · .env.example · .gitignore · README.md ·
.github/workflows/ (empty, .gitkeep) · app/ and pipeline/ (deliberately EMPTY).
`app/` has since been scaffolded; `pipeline/` is still empty and belongs to `uv init`.
