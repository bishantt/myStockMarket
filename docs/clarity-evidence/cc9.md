# CC9 — The Desk greets the morning — evidence

**Phase:** CC9 of CLARITY-AND-CADENCE-PLAN.md (Part 4.7-presentation). Tag `cc-9`.
**One line:** module 02 becomes THE MORNING PLAN and the masthead greets a Morning Edition, in the
browser, once a dawn has really run for the reader's session (R6). Presentation phase — app only.

---

## What CC9 built

### 1. The edition-state machine (`app/lib/edition-state.ts`)
Four states — **Evening / Morning / Session / Overnight gap** — computed in the BROWSER against the
reader's clock (MarketStateLine's law; the server seeds the first paint so hydration and check:live's
read of the raw HTML match production's real state). A dawn counts only when its ET date equals the
reader's ET date today; a dawn from any earlier day is a stale cache, not this morning, and the machine
refuses it (R6). `getLatestRun` exposes the dawn stamp; `readDawnEntry` moved to the base `lib/pipeline.ts`
so `pipelines.ts` and the machine read ONE definition. Unit-tested on the seeded clock (all four states +
the stale-morning refusal + the holiday/no-dawn case).

### 2. The masthead states (`components/desk/DeskHeader.tsx` → client) + `EditionState.tsx`
The Evening masthead is byte-unchanged from CC3. The Morning masthead is Appendix A, verbatim: "THE DESK —
MORNING EDITION · {today} · before the open · market data through {weekday}'s close · news & macro refreshed
{time}". A single `EditionStateProvider` computes the state once and `DeskHeader`/`EditionSwitch` consume it,
so the masthead, module 02 and the calendar never disagree about the hour. Both edition variants render
server-side (so module 02's TermProse stays a server render); the client picks one.

### 3. THE MORNING PLAN (`components/desk/MorningPlan.tsx`, new surface)
Overnight (top clusters since the evening press time, same card grammar) · Today's calendar (bmo-first, each
catalyst's timing in words) · Where things closed (the evening's verified S&P + VIX, reused). Last evening's
brief collapses beneath. Assembled from LIVE tables — no dawn Anthropic spend (risk 10).

### 4. timing→prose (`lib/format.timingLabel`) + the calendar flip
bmo→"before the open", amc→"after the close", dmh→"during the day"; a macro clock string passes through. The
ticker calendar uses it too. The calendar rail flips today-first in the morning (no retrospective "Reported
today" — pre-open, everything is ahead).

### 5. check:live learns the states (`scripts/live-truth.mjs`) — the Q-CC5-2 fix
A morning masthead is dated TODAY, ahead of the last closed session; the old checkMasthead read that as "an
edition from the FUTURE" and would red a healthy morning Desk. Now a morning masthead is judged by the
morning's rule (dated today, a real session), and the date-derived checks (next-edition, calendar) measure
against the last close. The evening six are byte-unchanged. `--window=morning` appends the Morning truths
(edition claim matches the dawn's presence — R6; refreshed before the 9:30 open).

### 6. Q-CC8-1 closed + the footer fix
The Dawn refresh control-room row now describes the full macro+news+calendar dawn (stages/providers updated);
the seed stamps a Friday 6:31 AM dawn so the row shows a real Last run. A bug this surfaced: `buildSourceStatus`
was rendering the nested `dawn` object as a degraded provider ("dawn [object Object]" in the footer, an inflated
degraded count) — live in production since CC8, caught by the morning VRT shot. Fixed to skip the dawn key.

---

## The gate (Endgame order)

### Local (all green)
- typecheck · lint · **app 852 unit** (was 825: +8 edition-state, +4 timingLabel, +4 morning-plan calendar,
  +10 check:live morning, +1 buildSourceStatus dawn-skip) · **pipeline 595 passed / 40 skipped** (untouched).
- build · check:routes 14/15 · **check:bundles** (worst /news 199.6 KB of 200; "/" 188.2, +3.1 from the client
  edition machinery) · check:fonts (243 KB, 317 KB headroom) · **check:drift 29/29** (no new rule) ·
  check:migrations (production DB matches — CC9 adds NO migration).
- **e2e:local:** the morning masthead + R3-in-morning (both legs), the Morning Plan + today-first calendar,
  the plan's phone overflow (412 + 360), and the evening specs unchanged (desk, control-room, grid, a11y,
  hardening all green with the new seed).

### CI — the rehearsal, the fix, the re-shoot
- **Push CI (ac256d6 = code): `29475650871` green.** Rehearsal #1 (ac256d6): `29475657978` RED on VRT (the
  intended changes AND the footer bug). Diffed EVERY candidate (pngjs counter, Q-LC1-1); opened every image.
- **The footer bug (buildSourceStatus) fixed → `78989a5`. Push CI: `29476603404` green.** Rehearsal #2
  (78989a5): `29476613009` RED — clean candidates (no footer bug), the intended changes only.
- **Baselines committed → `e2a0162`. Push CI: `29477289384` green. Rehearsal #3 (e2a0162): `29477299890`
  GREEN — all four legs.**
- **VRT: 103 baselines (up 6 from cc-8's 97)** — 18 changed: 6 NEW (`desk-morning-{light,dark}` desktop+phone,
  `desk-morning-light` wide+mbp16 — first-baseline eyes on the Morning Plan, both themes) + 12 re-shot (evening
  desk gained the seeded Friday calendar events + the footer fix + the corrected source/degraded counts;
  settings gained the dawn row's description + a real Last run; desk-thin-night same calendar). Camera-noise
  shots (login 17520px, sheet-ticker 820px, ticker 6–11px) LEFT — visually identical, antialiasing jitter (PD5).
- **Tag run (cc-9 on `e2a0162`): `29477793717`.** Its desktop leg first flaked on `scans.spec.ts:46`
  ("First 3 of 32 by scan order") with a Next.js `Internal: NoFallbackError` — a transient ISR/revalidation
  race on `/scans` (the VRT reset busts the route cache; a request mid-revalidation gets a NoFallback), a page
  CC9 never touched, and the SAME SHA had just passed all four legs in rehearsal #3 (`29477299890`). **PROVEN
  PRE-EXISTING, not a CC9 regression:** cc-8's OWN tag run (`29471548172`) — which SUCCEEDED — carries the
  identical `NoFallbackError` in its WebServer log, as do rehearsals #1/#2/#3. It is a background ISR-
  regeneration race that logs on most runs; a test only FAILS when a navigation lands in the error window.
  cc-8 got lucky; this tag run drew badly — the desktop leg failed the first attempt and two reruns (on
  `scans:46` / `settings:64`, both hitting `/scans/[preset]`) before the fourth attempt went green. Per the
  Endgame flake rule the tag STAYED PUT on `e2a0162` (rehearsal #3's all-green is the actual proof) and the
  leg was re-run until the timing did not collide. Heads-up for CC10 (it re-shoots VRT): the desktop leg is
  the flakiest here, and CC9's 2 extra morning VRT shots each carry the `resetMutableState` `/api/revalidate`,
  which may have widened the race window — worth trimming if CC10's tag run flakes too.

### Post-deploy (production `mystockmarket-eight.vercel.app`) — the REAL check
- **check:live 7/7 (default, morning-aware) AND 8/8 (`--window=morning`).** Production was GENUINELY in the
  Morning edition at 2 AM ET — CC8's own step-5 dawn (12:23 AM ET Thursday) still sat on the latest run, so
  the reader's-clock machine greeted the morning, and the state-aware masthead check passed it (no false
  future-edition red — the Q-CC5-2 fix, proven against real data).
- **Read the prose (the memory's rule):** the production masthead read exactly Appendix A; the Morning Plan's
  Overnight was POPULATED with real stories ("Fewer vessels travel through Hormuz…"), Today's calendar showed
  real timing prose (UNH/GE "before the open", NFLX "after the close"), Where things closed reused the
  verified S&P 7,572.40 +0.38% + VIX 16.50. The seeded morning's Overnight is empty (a /news-collateral
  choice); production proves the query.
- check:nav worst warm 470ms (report mode). check:lighthouse **CLS 0.000** (the client masthead swap causes
  no layout shift — SSR and client agree), first-load JS 183 KB, a11y 100; advisory perf 76 (synthetic-4G,
  within the noted 74–86).

---

## Judgment calls (in DECISIONS, marked in QUESTIONS)
- **Q-CC9-1:** "before the open" is edition PROVENANCE, not the live market state (the pill is the one live
  truth) — so R3 holds. The morning R3 test strips the phrase before counting.
- **The seeded Overnight is empty** (the /news date-range queries would pollute /news beyond CC9's VRT
  surface); the populated state is verified in production. amJson/pmJson stay dormant.
- **Module 02 renders both variants server-side, the browser switches** (keeps TermProse a server render);
  the evening brief renders first and keeps its glossary decoration (confirmed unchanged in the re-shoot).

## Gate size
29 drift rules · 103 VRT baselines (6 morning shots added; 12 re-shot for the calendar/settings/footer) ·
27 e2e specs · app 852 / pipeline 595 unit tests (634 with a DB) · 16 bundle baselines · 14 manifest rooms ·
tag run 29477793717.
