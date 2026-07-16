# CC8 — The dawn run becomes the Morning Edition's engine — evidence

Tag `cc-8` on `7cc77ee` (by SHA). CLARITY-AND-CADENCE-PLAN.md Part 4.7-pipeline. One phase, per the
standing rhythm.

The pre-open dawn cron stops being a three-number macro fix and becomes the morning refresh: it re-reads
the index closes FRED posts overnight, rebuilds the front page facts-only, and refreshes the forward
calendar with its event times. It ingests no bar and opens no new edition (E1). CC8 is a PIPELINE phase;
the only app touch is the control-room dawn row.

## What CC8 built

### 1. The `dawn` mode (`pipeline/jobs/job_a.py`, MODE_STAGES)
`("macro", "news", "catalysts", "publish", "revalidate")` — a pinned constant with a test, like every
mode. `run_dawn_mode` composes it: `publish_macro` + `publish_macro_stats` (the index-close fix + the
board), `publish_calendar` (the forward calendar with its new times), the front page rebuilt FACTS-ONLY
(`_build_front_page(..., narrate=False)` → no Anthropic spend, risk 10), then `publish_dawn` + revalidate.
`main()` dispatches it; the unknown-mode refusal stands. `dawn_edition(now)` skips a market holiday (the
Mon–Fri cron fires on holidays too), mirroring `full_run_edition`; the session it refreshes is the last
close (`previous_session`), exactly as macro/news modes read it — E1: no new edition date.

### 2. The cron moves to `30 10 * * 1-5` (nightly-a.yml)
6:30 AM EDT / 5:30 AM EST, Mon–Fri, pre-open year-round. **Monday gains a dawn run** (the morning after
the most news — weekend plus Friday's close); the old Tue–Sat `0 10 * * 2-6` (which ran a pointless
Saturday and skipped Monday) is gone. The schedule→mode step maps the new cron to `dawn`; the
`workflow_dispatch` `mode` choice gains `dawn` (the 422 trap: it had to land on `main` before a dispatch).

### 3. Event times — earnings from Finnhub, macro from the allowlist
- **Earnings:** a new `FinnhubAdapter.earnings_calendar` reads each report's `hour` (bmo/amc/dmh); the
  catalyst ingest joins it to FMP's calendar on (symbol, date) and writes it to the existing
  `calendar_event.timing` column (Appendix B #4 — **no migration**). FMP's `/stable` endpoint has no
  time-of-day; this is exactly why the plan named Finnhub. The lookup is best-effort and isolated — a
  Finnhub outage leaves earnings untimed (P9 — a null renders nothing) and never marks FMP down.
- **Macro:** the seven allowlisted releases carry canonical ET times as a scheduled convention (a static
  field on `catalyst_allowlist.Release`): CPI/JOBS/PPI/GDP/PCE/RETAIL → "8:30 AM ET", FOMC → "2:00 PM ET".

### 4. `publish_dawn` — the non-overwrite stamp (`pipeline/publish.py`)
The dawn shares the last close's `run_date` with the nightly (E1), so it cannot write its own row —
`pipeline_run` is keyed by run_date. It MERGES a single `dawn` entry into `source_status` (JSONB `||`),
carrying its own `ranAt`, per-source health and stages. The mirror of `publish_compute`: it never
overwrites the night's `source_status` and never moves the night's `finished_at` (the dawn's instant
lives inside the entry). An orphan dawn — dispatched before its night, only by hand — inserts a
dawn-only row rather than failing. `publish_calendar` refreshes just the forward calendar.

### 5. The control-room dawn row (`app/lib/pipelines.ts`) — closes Q-CC7-1
- Cadence: `30 10 * * 1-5` → "Mon–Fri · ~6:30 AM EDT / 5:30 AM EST" (the CC7 `lib/cron.ts`, fed the new
  line; a cron test adjusted).
- **Last run:** `lastRunForDawn` reads the `dawn` entry `publish_dawn` stamps into the latest run's
  `source_status` — a real status, stamp and per-source list, instead of the CC7 "—". Null until a dawn
  has actually run, so the seeded world (no dawn) still shows "—" honestly.
- `statusFromRun` now ignores the nested `dawn` object (string values only) so a dawn beside the night's
  sources can never flip the nightly's verdict; `nightSources` strips it from the nightly's provider list.
- The dawn's one hand-only button stays `macro` (the cheap number-refresh; a stage of the dawn run).

## Judgment calls (in DECISIONS, marked in QUESTIONS)
- **No Anthropic at dawn (risk 10).** The dawn's news stage rebuilds the front page facts-only
  (`narrate=False`), so the morning refresh spends no LLM. The consequence — the morning front page
  carries the overnight stories without the evening's why-it-matters prose — is the designed facts-only
  state (P9), and the morning PRESENTATION is CC9's. Logged; noted for CC9.
- **The dawn row's description/stages/providers still describe the macro-only dawn** (Q-CC8-1). CC8's
  mandated control-room touch is the cadence + Last run; the richer "Morning Edition" framing of the
  sheet belongs with CC9's masthead/Morning-Plan presentation, told as one story. The sheet under-
  describes the now-richer dawn until then; noted for CC9.

## The gate (Endgame order)

### Local (all green on `7cc77ee`)
- `typecheck` · `lint` · **app unit 825** (was 820: +4 pipelines [1 statusFromRun robustness + 3
  lastRunForDawn], +1 cron [dawn weekday range]). `uv run pytest` **595 passed / 40 skipped** (was
  584/35: +11 non-DB tests; the 5 new publish_dawn/publish_calendar DB tests skip without a Postgres) —
  **634 passed / 1 skipped with `TEST_DATABASE_URL`** (the local docker DB).
- `build` · `check:routes` 14/15 · `check:bundles` (/settings **158.4 KB**, unchanged; worst 198.9 <200) ·
  `check:fonts` (243 KB, 317 KB headroom) · **`check:drift` 29/29 (no new rule)**.
- `check:migrations` (once-per-phase) — production DB matches the repo (**CC8 adds no migration**; `timing`
  already existed).
- **e2e:local (--ignore-snapshots):** control-room desktop 6 + phone 6 (table renders all 3 rows from the
  seed, sheets open, banner once, degraded source named). Dispatch-loop tests skip without a token, as
  designed.

### CI — the rehearsal, the re-shoot, the tag
- **Push CI (`4845938` = code): `29470586551` green** (app + pipeline, CI's fresh empty DB — all 634 run).
- **Rehearsal #1 (`4845938`): `29470617312` RED on VRT (expected — the dawn cadence), minted candidates.**
  wide/desktop/phone failed on the settings shots; mbp16 (no settings shot) green.
- **VRT re-shoot:** every candidate diffed against its committed baseline across all three legs (pngjs
  counter, Q-LC1-1) — **exactly 5 of 90 shots moved** (settings-light/dark-desktop, -phone,
  settings-light-wide), nothing hid under the tolerance (the PD5 law). Each opened by eye against BOTH the
  triptych and the committed baseline: the change is confined to the Dawn refresh row's Cadence
  ("Tue–Sat · ~6:00 AM…" → "Mon–Fri · ~6:30 AM…") and Next run ("Fri · ~6:00 AM ET" → "Fri · ~6:30 AM ET");
  the Nightly full and Evening briefing rows are byte-identical, the dawn Last run stays "—" (the seed has
  no dawn run), no resize (the table height is unchanged). Committed as `7cc77ee`.
- **Push CI (`7cc77ee` = baselines): `29471200024` green.** Rehearsal #2 (`7cc77ee`): `29471206140`
  **GREEN, all four legs** (7 m 56 s).
- **Tag run (cc-8 on `7cc77ee`): `29471548172` — four-leg oracle green.**

### Post-deploy (production `mystockmarket-eight.vercel.app`)
- **check:live 7/7 — before AND after the dawn run** — masthead 2026-07-15, calendar hygiene clean, index
  honest, press-time a real session, byline links 20 outbound, next-edition Thu (the Q-CC5-2 transient did
  NOT recur). The dawn run refreshed the calendar (with times), the front page (facts-only, bylines intact)
  and the index levels without breaking a single assertion.
- **check:nav** report-mode, worst warm median 442ms (/settings). **check:lighthouse** gates green (CLS
  0.000, first-load JS 182 KB, a11y 100); advisory perf 77 (synthetic-4G variance — the Desk is untouched
  by CC8).
- **Step 5 — the pipeline-verification READ (the real check, per the memory):** dispatched a real `dawn`
  run (`29471227250`, 2 m 31 s) and READ production directly:
  - **The `dawn` entry landed BESIDE the night's, never over it.** The Jul 15 `pipeline_run` still carries
    all 14 night source keys (alpaca, fred, marketaux, macro-*, news-*), PLUS a `dawn` entry:
    `ranAt` 2026-07-16T00:23 ET, stages {macro/news/catalysts/publish all ok}, sources all ok (news-images
    `not_configured` honestly — P-1 unprovisioned). `run_date` stayed 2026-07-15 (E1 — no new edition).
  - **The calendar carries event times:** earnings from Finnhub's hour (JNJ/UNH/GE bmo, NFLX/TSLA/INTC amc,
    UAL amc, …), macro from the allowlist (PPI "8:30 AM ET", FOMC "2:00 PM ET"). 24 of 31 events timed — the
    7 untimed are earnings Finnhub did not time (P9 — untimed renders nothing).

## Gate size
29 drift rules · 97 VRT baselines (5 settings re-shot for the dawn cadence, 0 added) · 27 e2e specs ·
app 825 / pipeline 595 unit tests (634 with a DB) · 16 bundle baselines · 14 manifest rooms · tag run
`29471548172`.
