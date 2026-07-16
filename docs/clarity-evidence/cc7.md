# CC7 — The control room — evidence

Tag `cc-7` on `74ea87a` (by SHA). CLARITY-AND-CADENCE-PLAN.md Part 4.6. One phase, per the standing rhythm.

Settings' flat pipeline panel (N6) became the app's one table (DataTable) of the Desk's three schedules,
plus a DetailOverlay sheet per row. The five manual modes are now actions inside the sheet of the pipeline
they belong to, not flat rows. The table is informative from the database alone; the run-now controls and
the missing GitHub token (P-2) live in the sheets.

## What CC7 built

### 1. The pipelines table (`components/settings/PipelinesTable.tsx`) — via DataTable, the one-table law
Three rows in reading order: **Nightly full (Job A)** · **Dawn refresh** · **Evening briefing (Job B)**.
Columns: Pipeline (name + one plain line) · Cadence · Last run (OK/DEGRADED/FAILED/HELD chip + stamp) ·
Next run · Duration · → (opens the sheet). `sortable={false}` — a three-row config table is not sorted;
the rows stay in reading order (a `defaultSort` key no column has leaves DataTable's order untouched). The
table renders from `pipeline_run` + `briefing` alone, so it is never blank, token or not.

### 2. `lib/cron.ts` — the DST-honest cadence and next-run (pure, 15 tests)
Reads a UTC cron line as an ET cadence and the next fire, through `lib/time.ts` (the one Intl door):
- `describeCadence` → "Mon–Fri · ~6:37 PM EDT / 5:37 PM EST" — BOTH seasonal renderings, because a
  UTC-fixed cron always reads an hour apart across DST. The weekday range is read IN ET, so nightly-b's
  00:25-UTC slot correctly reads Mon–Fri (not the UTC Tue–Sat — the midnight slot rolls the day back).
- `describeNextRun` → "Wed · ~6:37 PM ET" — the next fire, computed in the BROWSER against the reader's
  clock (as the control-room states already are), so the table and the nav never disagree and the
  pinned-clock VRT baseline stays deterministic. Cadence is clock-independent → server-computed.
- The three real crons: full `37 22 * * 1-5`, dawn `0 10 * * 2-6`, briefing `25 0 * * 2-6`.

### 3. `lib/pipelines.ts` — the definitions, the status mapping, the run merge (pure, 16 tests)
- The three row definitions. Every manual action has exactly ONE sheet (proven): macro → dawn (the dawn
  cron IS macro mode), full/news/compute → nightly, briefing → Job B.
- `statusFromRun` (a source misbehaved → DEGRADED, a stage broke → FAILED, else OK) and
  `statusFromBriefing` (published→OK, held→HELD, else FAILED — HELD lives on the briefing row).
- `formatDuration` (from pipeline_run started/finished) and `mergeRuns` (manual dispatches + the
  scheduled `pipeline_run` record, attributed only to the pipeline that writes it, newest first, cap 10).

### 4. The sheet (`components/settings/PipelineSheet.tsx`) — the plan's six sections
What it fetches (per-provider list + tonight's per-source status, when there is a run) · Stages · Daily
limits · Run by hand (the N6 action machinery, reused untouched: `PipelineActionRow` is the old panel row
lifted out; the request_id → run-name recovery path is unchanged) · Recent runs (merged). The P-2 banner
is said ONCE, above the run-now controls. The sheet chrome is code-split (`next/dynamic`), first-open only.

### 5. `DetailOverlay` gains a controlled mode
The story/ticker sheets stay ROUTING sheets (`router.back()`, unchanged). The control-room sheet is
CONTROLLED (`onClose`), because the table already holds the live polled state a routing sheet would read
stale. One component, two modes; the routing path is byte-unchanged and overlay.spec (10/10 phone) proves
it. `/settings` first-load grew only 3.7 KB (154.7 → 158.4, under the 200 KB ceiling) for a whole table.

## Judgment calls (in DECISIONS, marked in QUESTIONS)
- **Q-CC7-1** — the dawn refresh's Last run reads "—" honestly: it shares the nightly's `pipeline_run` in
  CC7, so no per-dawn record exists yet (CC8's `publish_dawn` gives it one). The sheet says so. N0 pattern.
- **Q-CC7-2** — the action→sheet grouping (macro under dawn; full/news/compute under nightly; briefing
  under Job B) is a judgment call the plan left open ("the four manual modes as actions"). Grouped by
  meaning, each action in exactly one sheet.

## The gate (Endgame order)

### Local (all green on `74ea87a`)
- `typecheck` · `lint` · **app unit 820** (was 788: +15 cron, +16 pipelines, +1 DetailOverlay controlled,
  +4 PipelinesTable, −4 PipelinePanel deleted). `uv run pytest` **584 passed / 35 skipped** (unchanged —
  CC7 touched no pipeline code).
- `build` · `check:routes` 14/15 · `check:bundles` (/settings 158.4 KB ≤ bound, worst route 198.8 <200) ·
  `check:fonts` (243 KB, 317 KB headroom) · **`check:drift` 29/29 (no new rule)**.
- `check:migrations` (once-per-phase) — production DB matches the repo (CC7 adds no migration).
- **e2e:local (--ignore-snapshots):** control-room desktop 6 + phone 6 (table renders all 3 rows, sheet
  opens, banner once, sheet depth, degraded source named); a11y desktop 27 (/settings axe clean); hardening
  phone 30 (/settings on-axis at 412 AND 360); overlay phone 10 (routing sheets unbroken); settings desktop
  2 (watchlist — the documented Desk-disclosure flake cleared on re-seed). Dispatch-loop tests skip without
  a token (P-2 unprovisioned), as designed.

### CI — two commits, two rehearsals, one tag
- **Push CI (`74ea87a` = code): `29467357378` green** (app + pipeline).
- **Rehearsal #1 (`74ea87a`): `29467363726` RED on VRT (expected — settings card→table), minted candidates.**
- **VRT re-shoot:** every candidate diffed against its committed baseline (pngjs counter, Q-LC1-1). The
  moved set EQUALS the settings set — 5 baselines across 3 legs (settings-light/dark-desktop,
  settings-light/dark-phone, settings-light-wide), all RESIZED shorter (desktop 1693→1341, phone
  2291→2036 — the compact table replaces the taller panel). mbp16 has no settings shot → green. login
  moved 129px (AA jitter under the 200px floor — the pre-existing camera-noise shot, LEFT at its committed
  baseline, PD5 law). Each settings candidate opened by eye: the diff is the Pipeline table (DST-honest
  cadences both seasons, DEGRADED/OK/— last-run states, computed next-runs, → affordances) and the rest of
  the page (Add/Theme/Watchlist) is untouched. Committed as `1c84bb5` (5 baselines).
- **Push CI (`1c84bb5` = 5 baselines): `29467901371` green.** Rehearsal #2 (`1c84bb5`): `29467901014`
  GREEN, all four legs.
- **Tag run (cc-7 on `1c84bb5`): `29468244086` — four-leg oracle, green after a desktop-leg flake rerun.**
  The first attempt's desktop leg failed a single /scans e2e (`scans.spec.ts:46`, "First 3 of 32 by scan
  order" not visible) with `[WebServer] Error: Internal: NoFallbackError` — a transient Next.js
  server-render error on `/scans`, a page CC7 NEVER TOUCHED (`git diff cc-6..cc-7` has zero /scans,
  DataTable or table-lib changes), and the EXACT SAME SHA had just passed that test green on rehearsal #2's
  desktop leg. Read first, per the Endgame (the G2 lesson): it is a flake, not a defect. `gh run rerun
  --failed` re-ran the desktop leg only; the tag STAYED on `1c84bb5` (never re-pointed). It went green.
  The rehearsal's own all-green (`29467901014`) is the primary evidence, collected before the tag existed.

### Post-deploy (production `mystockmarket-eight.vercel.app`)
- **check:live 7/7** — masthead 2026-07-15, calendar hygiene clean, index honest, press-time a real
  session, byline links 20 outbound, next-edition Thu (the CC5 transient did NOT recur). CC7 changes only
  /settings; live-truth.mjs asserts nothing CC7 touches.
- **check:nav** report-mode, worst warm median 461ms (/settings, the force-dynamic writer room — +4ms vs
  CC6's 457ms, noise). **check:lighthouse** gates green (CLS 0.000–0.002, first-load JS ≤200 KB, a11y 100);
  advisory perf 74/80/83 across three re-samples (LCP 5.48/4.38/4.29s) — synthetic-4G variance, the Desk
  is untouched by CC7, so not a regression (re-sampled per the gate rule).
- **Step 5 — the pipeline-verification READ:** opened production /settings with a minted session cookie —
  the table renders all three rows from the live DB, the cadences read DST-honestly ("Mon–Fri · ~6:37 PM
  EDT / 5:37 PM EST", "Tue–Sat · ~6:00 AM…"), the → sheet affordances are present, and the run-now buttons
  are dark with the banner (P-2 unprovisioned). The memory's lesson honoured: the picture, not the suite.

## Gate size
29 drift rules · 97 VRT baselines · 27 e2e specs · app 820 / pipeline 584 unit tests · 16 bundle
baselines · 14 manifest rooms · tag run `29468244086` (green after a /scans NoFallbackError flake rerun;
clean four-leg oracle cost is rehearsal `29467901014` — 7 m 58 s).
