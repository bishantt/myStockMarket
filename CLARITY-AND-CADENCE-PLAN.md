# CLARITY & CADENCE PLAN

**The paper learns to be read — and learns what time it is.**
Plan A of two (its sibling is LEAN-CODEBASE-PLAN.md). Ten phases, `cc-1` … `cc-10`.
Written 2026-07-15 from a full-screen audit (51 screenshots in `dummy/`, desktop and phone, both
themes), a production-database diagnosis, a pipeline-capability audit, and a lifecycle inventory.
Executor: Claude Opus 4.8, one phase per session, under the standing rules of CLAUDE.md.

**Authority.** This plan sits below RR Part 8/9, the Blueprint, and CLAUDE.md's non-negotiables. On
looks it defers to UI-REDESIGN-PLAN.md **except** where a section below explicitly amends it — each
amendment is named, dated, and must be written back into the amended document as a correction block
when the phase lands (house rule: one source of truth, corrections in place). Evidence chapters win
on evidence. Intent binds; line numbers cited here are the state of 2026-07-15 and may drift — read
the file, find the intent.

**Sequencing note.** CC1 runs FIRST, before LEAN-CODEBASE-PLAN.md, because it repairs two live
product defects (the fonts, the brief). After CC1, run LEAN-CODEBASE, then return here for CC2–CC10.
The rationale is in both plans' cover notes and in the report that commissioned them.

**Who this document speaks to.** It is executed by Claude Opus 4.8, and its imperatives ("build",
"wire", "fix") address that executor. The exceptions are Part 0 and any sentence offering a choice,
a veto, or a provisioning action — those address **Bishan**, the commissioning user. The executor
never answers a Part 0 row and never waits on one: silence means the stated default, and anything
that would need Bishan goes to QUESTIONS-FOR-BISHANT.md per the contract below.

**THE AUTONOMY CONTRACT (binding; restates the standing directive of 2026-07-11 so this plan is
self-contained).** The user is not watching and will not answer mid-build. One phase per session
(the standing rhythm); within a phase: never ask, never check in, never wait. Anything that would
have been a question goes to QUESTIONS-FOR-BISHANT.md ([NEED]/[VETO?]/[FYI]) with the most
reasonable assumption made and marked in code, DECISIONS.md and PROGRESS.md — then keep going. The
Part 0 defaults proceed unanswered. The only stop is a genuine, unworkaroundable blocker; a failing
gate is not a stop (diagnose, fix, re-run), a time-gated item is not a stop (dispatch, poll, do
parallel work). Every session ends with the CLAUDE.md session ritual: intelligence files current,
NEXT-SESSION-PROMPT.md rewritten, everything pushed.

---

## Part 0 — Decisions I need from Bishan

**None of these block the plan.** Every one has a default the executor proceeds with; veto or
provision at any time and the plan absorbs it.

| # | Decision | Default the plan proceeds with | What changes if you act |
|---|----------|-------------------------------|------------------------|
| 0.1 | **P-1, the media bucket** (news images). One R2 bucket + one env secret makes NewsImage's L1 rung light up (real publisher photos). | **Text-first news, no bucket.** CC5 designs the news surfaces to be excellent with no image anywhere; the giant L4 placeholder frame is retired regardless. | Provision it and lead stories gain real photographs (the code path already exists); nothing in CC5's layout has to change — a photo enhances the lead card, never structures it. |
| 0.2 | **P-2, the GitHub PAT** (`workflow` scope) for the control room. | **Display-only control room.** CC7's pipelines table is fully informative from the database alone (last run, next run, sources, cadence); the run-now buttons stay dark with the existing banner. | Mint the PAT and the buttons light up, plus live GitHub run status per row. It is a secret and nothing else — the whole dispatch path is proven (N6 evidence §6). |
| 0.3 | **Dawn cron time.** | **10:30 UTC, Mon–Fri** (6:30 AM EDT / 5:30 AM EST — pre-open year-round; the current dawn cron is 10:00 UTC Tue–Sat and misses Monday). Promise language: "refreshed before 7:00 AM ET." | Name a different hour; everything derives from the cron line. |
| 0.4 | **Retention windows** (CC10). | News items/clusters **45 days** · scan_result/setup_card/vol_band rows **30 sessions** · R2 weekly DB dumps **keep 8** · price_bar trailing **400 sessions per served symbol** · briefings, signal_log, signal_resolution, journal, paper_trades **forever** (the record). | Change any number in the janitor manifest (Appendix D); the manifest is the one place they live. |

---

## Part 1 — What this plan is

Bishan's brief, in his words, was twelve observations: dates that read like fine print; a jumbled
masthead; weak visual hierarchy; a font that renders wrong on some refreshes; a pipeline he cannot
see or steer; news cards dominated by an empty grey box; news and movers full of instruments nobody
would ever watch; a Daily Brief that renders empty; a theme toggle buried in Settings; a founding
MORNING vision the app never honors; and data that arrives forever and never leaves.

The audit confirmed all twelve, found root causes for the three defects, and found that the morning
vision is closer than it looks: **a pre-open dawn run already exists** (nightly-a's second cron, in
`macro` mode), the news stage is safe at any hour by design, and the schema has carried a dormant
two-edition slot (`amJson`/`pmJson`) since P3. The plan therefore has two arcs:

- **Clarity (CC1–CC7):** fix the defects, make time a first-class element, give the masthead one
  truth per line, install one hierarchy grammar, make news text-first, make relevance honest, and
  give the pipeline a real control room.
- **Cadence (CC8–CC10):** make the dawn run a true Morning Edition, teach the Desk to greet the
  right time of day, and give every table a lifecycle so the paper is always fresh and never a pile.

---

## Part 2 — The diagnosis (measured, cited)

Each finding is numbered; phases cite them. Screenshots referenced are in `dummy/` (kept until CC5
lands, then LEAN-CODEBASE may retire them).

**D1 — The font bug is `display: "optional"`.** `app/lib/fonts.ts` loads Playfair with
`display: "swap"` but Inter, JetBrains Mono and Newsreader with `display: "optional"` (fonts.ts:66,
81, 97). `optional` gives a font ~100 ms; if it misses (cold cache, slow link, post-deploy hash
change), the browser uses the fallback **for the entire page lifetime** — while the download
completes in the background, which is why the *next* refresh is correct. That is Bishan's exact
symptom. The broken state is the screenshot where the masthead wordmark, section labels
("01 — MACRO PULSE"), and the pipeline strip render in a sans fallback: JetBrains Mono — the app's
terminal voice and the face of every number — missed its window. The comment in fonts.ts even names
this failure for Playfair ("one slow first load ships Georgia headlines for the whole session") and
chose swap there; the same reasoning was never applied to the mono that carries the identity.

**D2 — The brief is generated nightly and HELD nightly, by design colliding with a label bug.**
Production `briefing` table (read-only check, 2026-07-15): two rows, both `held`, reason "flagged
entity in today's focus." The 2026-07-14 draft is a full 6,444-character, 5-item brief. The verify
gate (pipeline/briefing/verify.py) flags any bare numeral in `today_focus.*` that it cannot match to
a licensed source number. The narrator must describe `breadth-pct50` — and the only honest words are
"above its **50**-day average" — but the window words live in the Stat **label**, and "the gate
ignores it" (verify.py's own Stat docstring). So every honest brief is held, structurally, every
night. PD7 stated the rule that fixes this *in the same file* (stats.py:73–85: "each value STATES
ITS WINDOW, in the words the narrator will use") and applied it only to the news-depth stats, never
to the briefing's `_macro_stats`/`_mover_stats` 100 lines below. **Riding along, a real unit bug the
hold was masking:** `pct_above_50dma` is stored as a 0–1 fraction (nightly.py:692, baserates.py:45)
but stats.py:189 formats it with a bare `%` — the brief narrates "0.60% of the universe above its
50-day average" where the Desk says 60%. The unit-test fixture feeds `60.75`, modelling the wrong
unit, which is why the suite is green while production is held. (The app side is NOT the bug: page →
`loadBrief` → `buildBrief` → held view is all working as designed.) Two eras of "empty" are both
explained: before 2026-07-13 no briefing rows existed (the Anthropic key was unwired until N1); since
then, held every night. CI: all nightly runs green — nothing ever *failed*.

**D3 — Time is told three ways, none of them a reader's way.** The masthead stacks two meta lines —
"Markets closed · data as of Jul 14 · updated as of 19:36 ET" (copy.ts:211) and "Data through Tue
Jul 14 close · pipeline ran 19:36 ET · next: Wed 18:37 ET" (the PipelineStrip) — while a MARKET
CLOSED pill sits top-right: the market's closedness is stated three times in ~90 vertical pixels,
and "data as of Jul 14" vs "Data through Tue Jul 14 close" are the same fact in two dialects.
Settings mixes a raw ISO date into prose: "Data through **2026-07-14** · last run finished Jul 14
19:36." Every clock in the app is 24-hour (`hourCycle: "h23"`, time.ts:30) — deliberate, for mono
column alignment, but the reader lives in AM/PM. Weekdays exist in some formats (the story sheet's
calendar rows say "Tue Jul 14"; the pipeline strip says "Wed 18:37 ET") and are absent from the ones
read most (news card footers, as-of lines, settings).

**D4 — There is one design system but three header grammars.** Rooms title themselves three ways:
serif display ("Scans", "Track record", "Front page"), all-caps sans ("PAPER DESK"), and sans-bold
caps sections ("WATCHLIST", "YOUR FORECASTS") beside the Desk's numbered mono caps
("01 — MACRO PULSE"). Every module's "as of 19:36 ET" is identical, so a line that exists to make
staleness self-identifying reads as wallpaper. All meta sits at the same 11 px muted grey, so
nothing meta ever outranks anything else — the type scale (globals.css has eleven steps) is rich but
the middle of it is barely used. Dead space: the Sectors & Scans card spends ~470 px on one number;
Paper's right column is empty below the ledger; Track record is a page of two em-dash lines; the
Academy lesson column is left-anchored with a vast right void on wide screens.

**D5 — The news placeholder is a designed rung rendering as a hole.** NewsImage's ladder
(L1 photo → L2 og:image → L3 outlet card → L4 catalyst card) is thoughtful code, but P-1 was never
provisioned, so **every card, every night, is L4**: a 1.91:1 grey frame containing the catalyst word
— on the phone news hero it is a full-width slab taller than the headline; on the story sheet it
sits between headline and body. The card also prints "No direct listing in our universe." verbatim
on every macro story (eight times on one screen), and "1 SOURCE" on every card when one source is
the overwhelming case — both true, both noise at list scale. The mono verified-figure treatment
inside serif headlines ("Gold gains over `2%` after…") is working as designed (E5) and stays.

**D6 — Movers is a junk parade with one suspicious number.** The Desk's movers are "the top eight
of the `unusual-volume` scan" (morning.ts loadMovers) over the whole ~5–6k universe — so the module
surfaces "EA Series Trust Honeytree U.S. Equity ETF," "Structured Products CorTS PECO Energy Cap
Trust III, 8% Cert.," and an ARCA-listed ADR-hedged wrapper, each with the honest noise line, none
of them anything Bishan would open Yahoo Finance to see. All eight rows print RelVol "20.0×"
exactly — either a cap or a data artifact; either way a number that reads canned. The ticker sheet
leaks a raw preset key ("gap-3plus") where a scan title belongs. Note what is NOT broken: scans
SHOULD run universe-wide (that is their job, and base rates need the breadth); the defect is that
the Desk's front-of-paper module inherits the raw universe unfiltered.

**D7 — The calendar tells yesterday first, twice.** The session-calendar rail lists today's
already-reported earnings (JPM/BAC/GS/C/WFC, "JUL 14") above tomorrow's JNJ; CPI appears twice on
the same date (no dedupe anywhere in the path — `_replace_calendar` inserts what it is given);
every row says the date twice ("JUL 14" ×6) and the earnings rows say the symbol twice
("JPM · JPM earnings"). The `timing` column (bmo/amc/time) exists in the schema and is never filled
— FMP's endpoint doesn't carry it — but **Finnhub's free earnings calendar does** (its `hour` field:
bmo/amc/dmh), and the seven allowlisted macro releases have fixed conventional ET times (CPI/JOBS/
PPI/GDP/PCE/RETAIL 8:30 AM; FOMC statement 2:00 PM) that can be encoded statically and labeled as
convention.

**D8 — The morning is nearer than it looks, and the honest version was never built.** History that
binds: the Figma's "PRE-MARKET" masthead and "AM Plan / PM Scorecard tabs" were **rejected** because
they would have relabeled an evening product as a morning one — a lie (UI-REDESIGN-PLAN.md:126,
DeskHeader.tsx's own comment). The rejection was of the false label, not of a morning product. What
exists today: a second cron on nightly-a (`0 10 * * 2-6`, 6:00 AM EDT) running `macro` mode against
the previous session; a `news` mode documented as safe at any hour; a `compute` mode safe at any
hour; `briefing.amJson`/`pmJson` dormant two-edition slots; and a hardcoded masthead
(`copy.desk.edition = "The Desk — Evening Edition"`). What is missing: dawn news, a Monday dawn run
(the cron skips it), event times (D7), and any presentation that greets a pre-open reader with
"today" rather than "last night." Laws that bind the design: E1 (no edition may claim a session that
did not happen — publish.py raises), the no-countdown rule (DeskHeader), no directional forecasts,
and check:live's edition-vs-clock discipline.

**D9 — Nothing ever leaves.** There is no retention, cleanup, or janitor code anywhere (grep-proven).
news_item (~260–300 rows/night), news_cluster (~130/night), catalyst_link, scan_result/setup_card/
vol_band (one run's rows per night, kept forever), price_bar (upserts a trailing 260-bar window but
never trims, so it grows ~1 row/symbol/night), macro_stat, pipeline_run, market_context, briefing —
all grow unbounded. R2 holds three things: the parquet lake (rewritten in place — fine), news images
(dormant), and **weekly pg_dump backups that accumulate forever**. Two tables are append-only BY
DESIGN with DB triggers (signal_log, signal_resolution) — the janitor must be physically unable to
touch them. One coupling to respect: the brief's source footnotes resolve through news_item rows, so
purging news must not orphan published briefs' citations. And there is no "new" marking of any kind,
no last-visit tracking; NewsCard refuses relative timestamps by law (its ISR-cache scar is real and
stays respected).

**D10 — Phone-specific paper cuts.** The phone masthead drops the market state entirely (logo +
gear only); the two meta lines wrap to four lines of fine print; the movers card repeats the
identical italic noise line three times in one viewport and then explains RelVol again in the card
footnote; the filter chip rows show a raw scroll track; the "This week" window chip wraps to two
lines; watchlist reasons truncate mid-word ("Want to know how it pe..."); the tape's first row
(Nasdaq) wraps its figure to a second line while Dow/Small caps sit inline — one row grammar, two
renderings.

---

## Part 3 — Rulings (each ends with the guard that enforces it)

**R1 — TIME IS WRITTEN FOR A READER: 12-hour, AM/PM, weekday named.** Every clock the reader sees
is "7:36 PM ET" — never "19:36 ET". Every date the reader sees carries its weekday — "Tue, Jul 14"
short or "Tuesday, July 14, 2026" long. Column contexts may zero-pad the hour ("07:36 PM") to keep
mono alignment; prose contexts do not. ET always; the EDT/EST distinction stays internal (existing
rule). All of it flows through lib/time.ts — no other file may construct an Intl.DateTimeFormat.
*Guard:* time.test.ts pins every public formatter's exact shape, and a new check-drift rule fails
any `Intl.DateTimeFormat(` outside lib/time.ts (app side; the pipeline's Python formatting is out of
scope — it writes UTC instants, never reader-facing strings).

**R2 — A FONT EITHER ARRIVES OR SWAPS IN; IT NEVER SILENTLY LOSES THE SESSION.** All four families
load `display: "swap"`. next/font's metric-adjusted fallbacks make the swap frame near-invisible;
a whole session in the wrong voice is the worse trade, and D1 is the proof.
*Guard:* a unit test reads lib/fonts.ts source and asserts four `display: "swap"` declarations (the
same source-pinning pattern design-system tests already use), and the CC1 gate re-runs
check:lighthouse to prove CLS did not regress.

**R3 — ONE TRUTH PER LINE IN THE MASTHEAD.** The market's state appears exactly once (the pill).
The edition's data vintage appears exactly once. The pipeline's provenance (ran / next / sources)
appears exactly once, in the strip, in pipeline voice. No fact appears in two dialects.
*Guard:* the masthead e2e spec counts occurrences of the market-state word and the close-date within
the header region and fails on more than one of each.

**R4 — NO RESERVED GEOMETRY WITHOUT A PICTURE.** A news surface renders an image frame only when a
real stored image exists (L1/L2). The L4 catalyst frame is retired everywhere; the catalyst already
speaks through its Tag. (Amends UI-REDESIGN-PLAN §7.7/7.9's "every card ships a visual" — the
amendment is the finding: after weeks of L4-only nights, the visual that ships is an eye-magnet that
says nothing. L3/L4 code is deleted, not latched — LEAN-CODEBASE would otherwise flag it as dead.)
*Guard:* news e2e asserts `data-testid="news-image-generated"` appears nowhere, and asserts the lead
card's headline is the tallest element of the card when no image exists.

**R5 — RELEVANCE IS SIGNIFICANCE, NEVER ENGAGEMENT (plan §1.5 restated for new surfaces).** The
Desk's movers and the front page rank by deterministic, inspectable significance — catalyst class,
corroboration, breadth, liquidity floor — never by clicks, trends, or "most active" imports. Ties
break newest-first (fresher is more useful; the old oldest-first tie-break inverted that). Every
floor and weight is a named constant with a test.
*Guard:* pipeline unit tests pin the scoring table and the movers' liquidity floor; the Desk movers
e2e asserts every rendered symbol carries the liquid-floor marker the loader now exposes.

**R6 — THE MASTHEAD MAY SAY "MORNING" ONLY WHEN THE MORNING IS REAL.** The Desk greets as Morning
Edition only when the dawn run for the reader's wall-clock trading day has succeeded (fresh news +
macro). Otherwise it stays Evening Edition of the last closed session — exactly what the 2026-07-11
rejection of "PRE-MARKET" was protecting. No countdowns, no forecasts, no "futures" we do not carry.
*Guard:* a new check:live assertion (morning window, ~7–9 AM ET local runs) that the masthead's
edition claim matches the dawn run's presence; plus unit tests on the edition-state machine.

**R7 — EVERY TABLE HAS A NAMED LIFECYCLE, AND THE JANITOR CAN ONLY TOUCH ITS ALLOW-LIST.** A single
janitor manifest names every Prisma model with a policy: `forever` (the record), `replace`
(calendar), `trailing(N)` (news, scans, bars, backups). Adding a model without a policy fails the
unit suite (the routes-manifest pattern, applied to data). The janitor's DELETE targets are derived
from the manifest's `trailing` entries only; signal_log/signal_resolution keep their DB triggers as
the second, physical lock.
*Guard:* janitor-manifest unit test (model list ⇔ policy list, both directions) + a pipeline test
that the janitor refuses a table not in its allow-list + the existing insert-only triggers.

**R8 — "NEW" IS INFORMATION, NEVER URGENCY.** New-since-last-edition marking is a quiet mono tag,
identical weight to other meta, no counts, no badges, no red, nothing that moves. It is
edition-relative (safe on a cached page), not visit-relative — no tracking is introduced.
*Guard:* copy.ts owns the tag string; VRT locks its look; the P2 ancestor walk already forbids
animating it if it ever sits near money.

---

## Part 4 — Feature specifications

### 4.1 Time (CC2)

New/changed formatters in lib/time.ts (names final, shapes pinned by tests):

| Formatter | Output | Used by |
|---|---|---|
| `formatEtClock(instant)` | `7:36 PM` (12-hour, no pad) | as-of lines, status lines, news footers |
| `formatEtClockPadded(instant)` | `07:36 PM` | mono columns only (control room table) |
| `formatAsOf(instant)` | `as of 7:36 PM ET` | every SectionMasthead |
| `formatEtDate(instant)` | `Tue, Jul 14` (gains weekday) | news card footers, run stamps |
| `formatUtcDate(bareDate)` | `Tue, Jul 14` (gains weekday) | settings, strips, calendar rows |
| `formatUtcDateLong(bareDate)` | `Tuesday, July 14, 2026` (unchanged) | the masthead |
| `formatEtStamp(instant)` | `Tue, Jul 14 · 7:36 PM ET` | one-line provenance (footers, sheets) |

Rules: the bare-date vs instant distinction (UTC-components vs ET) is load-bearing and unchanged —
only the *shapes* change. Kill the ISO leak: the settings pipeline card renders dates through
`formatUtcDate`, never raw `runDate` strings. The pipeline strip keeps its weekday voice ("Data
through Tue's close · ran 7:36 PM ET · next: Wed ~6:37 PM ET"). copy.ts templates that embed times
update in the same commit (Appendix A). Every changed string appears in the VRT delta (Appendix C).

### 4.2 The masthead and the toggle (CC3)

Desktop masthead (Desk):

```
THE DESK — EVENING EDITION                                  [◐] [⚙] [● MARKET CLOSED]
Tuesday, July 14, 2026
Tuesday's close · updated 7:36 PM ET
─ pipeline strip (provenance voice): 14 sources · 2 degraded · next edition Wed ~6:37 PM ET ─
```

- Line 3 replaces BOTH current meta lines: one sentence, reader voice, weekday first. "Markets
  closed" leaves this line — the pill top-right is the single market-state truth (R3).
- The strip keeps pipeline provenance ONLY (sources, degraded, next run). "Data through Tue Jul 14
  close" dies as a phrase; "Tuesday's close" in line 3 carries it.
- **The theme toggle** is a sun/moon icon button (◐) in the top bar, left of the gear, all rooms,
  both zones (the Academy top bar gets the same pair). One tap cycles Light ↔ Dark (long-press or
  Settings for System — Settings keeps the three-way control as the canonical surface). It writes
  the same cookie the pre-paint script reads (lib/theme.ts) so there is no flash and SSR stays
  honest; 44 px touch target; `aria-label` from copy.ts; icon-only, no text.
- Phone masthead gains the market-state pill (dot + "CLOSED") between logo and the two icon buttons
  — the phone currently states the market's state nowhere (D10).

### 4.3 Hierarchy grammar (CC4)

One grammar, applied to every room (this is a *system*, not a page patch — D4):

| Element | Face | Case | Size/notes |
|---|---|---|---|
| Room title | Playfair 700 | Title case | text-display; every room, including Paper ("Paper desk") and Settings ("Settings") |
| Room dek (the one-paragraph explainer) | Newsreader | Sentence | text-prose, ink-2; already right in Scans/Track — adopt everywhere |
| Section header (within a room) | JetBrains Mono 600 | UPPER, tracked | text-xs (up from 2xs), ink-2 (up from muted); Desk keeps its `01 —` numbering; Settings/Paper/Track adopt the same face WITHOUT numbers |
| Card title | Playfair 700 | Title case | text-title (19px floor) |
| The one hero figure per card | JetBrains Mono | — | text-num-lg; unchanged (law) |
| Meta / as-of / provenance | JetBrains Mono 400 | UPPER | text-2xs muted — BUT the as-of moves into the section-header row's right slot and renders `text-faint` when it equals the masthead's updated stamp, `text-alert` never, `ink-2` when it DIFFERS (that is the one moment it is information — and the morning edition will make differing stamps real) |
| Empty states | the em-dash line | Sentence | unchanged (EmptyModule; no skeletons — see CC1) |

Concrete room fixes riding this phase: Paper title to serif; "YOUR FORECASTS"/"WATCHLIST"/"THEME"/
"PIPELINE" adopt section grammar; Sectors & Scans card becomes a real module — one hairline row per
preset (name serif-italic, grade chip, match count mono, → link) so its height is earned (D4's dead
space); Paper's two columns rebalance (Cost Mirror + Sizing Helper stack right, ledger main-left,
form becomes a compact ticket card ~420px max-width); Track record's empty page gains its two
informative lines ("576 signals logged · first resolutions due Mon, Jul 28" — real numbers from
signal_log) — an empty state that teaches the mechanism (existing voice, more information); Academy
lesson column centers (`mx-auto` measure) on wide screens. Phone paper cuts from D10: tape row
grammar unified (all three rows label-left figure-right), noise line printed ONCE per movers card
("No news found on any of these — most moves this size are noise." when all rows lack catalysts;
per-row lines return only for the mixed case), "This week" chip `whitespace-nowrap`, chip-row scroll
tracks styled away (`scrollbar-width: none` + fade mask), watchlist reason clamps at one line with
title attribute.

### 4.4 News, text-first (CC5)

Anatomy (no image case — the default and the design target):

```
lead:  [CATALYST TAG] [SECTOR TAG]                       row:  [CATALYST] [SECTOR]
       Headline, serif, up to 3 lines (was clamp-2)            Headline, serif, 2 lines
       Why-it-matters, serif italic (when present)             chips / market-wide word
       [NVDA +4.08% · 1D] [AAPL −0.80% · 1D]                   Reuters · Tue, Jul 14 · 9:01 PM ET
       ───────────────────────────────
       Reuters · Tue, Jul 14 · 9:01 PM ET · 3 sources
```

- **The L4/L3 frames are deleted** (R4). When a real image exists (L1/L2 — only if P-1 is ever
  provisioned) the lead renders it right-of-headline at 40% width, rows render a small thumb, and
  the story sheet renders it *below* the byline, never between headline and body. NewsImage shrinks
  to the L1/L2 rungs and keeps its one-door status and drift rule.
- **"No direct listing in our universe."** leaves the list cards; a macro story's ticker row prints
  the single word "Market-wide" in the same mono meta voice (copy.ts). The full sentence survives on
  the story sheet where there is room to mean it (amends C9's card-level application, keeps its
  intent).
- **Source count** moves into the byline and speaks only when it outranks the default: "Reuters ·
  Tue, Jul 14 · 9:01 PM ET" (one source — say nothing) vs "… · **3 sources**" (corroboration is the
  news). The mono caps sourcesLine as a separate row dies.
- The story sheet keeps its excellent structure (What happened / Why it matters / Context tonight /
  By the numbers / Affected tickers / On the calendar / Sources / provenance footer) — it is the
  best surface in the app; CC5 only removes the placeholder block and applies 4.1's date shapes.
- Desk front-page module and news room share one card component as today; the desk module's
  "FIRST 3 OF 190 BY SIGNIFICANCE" stays (it is the honesty label for R5's ordering).

### 4.5 Honest relevance (CC6)

Two deterministic scores, both pipeline-side, both tested, both explained in UI copy:

**Movers floor (the Desk module + "moved without a story"):** eligible = common stocks and the ~15
core sector/index ETFs; excludes trusts, ADR-hedged wrappers, structured products, and anything
below the dollar-volume floor (the base-rate engine's existing large/mid bucket boundary — reuse
`_DV_WINDOW` machinery, do not invent a second liquidity notion). The module's footnote names the
floor: "Liquid names only — the full universe stays in Scans." Instrument classification comes from
Alpaca's `list_universe` payload (already fetched nightly; persist `assetClass`/`exchange` on
`instrument` — one additive migration). Scans stay universe-wide (their job; D6). The RelVol "20.0×"
uniformity gets a named diagnosis in CC6's first hour: find the clamp or the degenerate denominator,
fix or label it — a number that cannot exceed its cap must say so ("≥20×").

**Front-page significance v2:** `score = catalyst_weight × corroboration × entity_weight ×
freshness`, where catalyst_weight ranks hard events over commentary (M&A/FDA/earnings/Fed > guidance
> analyst/opinion — analyst pieces from single-name blogs land below multi-outlet hard news, which
kills the LDOS-style seekingalpha lead), corroboration = distinct outlets on the cluster (already
computed), entity_weight uses the same dollar-volume bucket (a story on a mega-cap or an index
outranks a micro-cap PR at equal catalyst), freshness decays over the window and **ties break
newest-first** (amends the documented oldest-first tie). Weights live in one table with a worked
example (Appendix E) and a unit test per row. The Front page dek updates to name the new ordering in
one sentence (copy.ts).

**Calendar hygiene (rides CC6; the dedupe bug itself lands earlier, in CC1):** row grammar becomes
`[WEEKDAY DATE] [KIND CHIP] Title` with the symbol spoken once ("JPM earnings" — the chip already says EARNINGS, the ticker chip says JPM, the title
stops repeating both); ordering is forward-first (post-close: tomorrow's events lead, today's
reported earnings collapse into one "Reported today: JPM · BAC · GS · C · WFC" row).

### 4.6 The control room (CC7)

Settings' pipeline card becomes a **pipelines table** (through components/DataTable — the one-table
law) plus the existing action machinery:

| Column | Content |
|---|---|
| Pipeline | Name + one-line plain-English description (copy.ts) |
| Cadence | Human ET, DST-honest: "Mon–Fri · ~6:37 PM ET" (computed from the cron's UTC line, both seasonal renderings when they differ: "6:37 PM EDT / 5:37 PM EST") |
| Last run | status chip (OK / DEGRADED / FAILED / HELD) + `formatEtStamp` |
| Next run | computed from cron in ET ("Wed · ~6:37 PM ET") — "~" honors runner jitter |
| Duration | mono, from pipeline_run started/finished |
| → | opens a DetailOverlay sheet (PD9's component — new-surface skill applies) |

Rows: **Nightly full (Job A)** · **Evening briefing (Job B)** · **Dawn refresh** (macro today;
becomes the Morning Edition run in CC8) · **Janitor** (appears with CC10) · plus the four manual
modes as actions, not rows. The sheet per row: what it fetches (per-provider list with tonight's
per-source status), its stages, caps/cooldowns, the last 10 runs (manual_run + pipeline_run merged),
and the run-now button — which uses the PROVEN dispatch path (request_id → run-name recovery; the
load-bearing `run-name:` line stays guarded by test_workflow_dispatch.py). Without P-2 the button
renders dark with the existing banner (Part 0.2). Data-level truth (source_status, run rows) renders
regardless of P-2 — the table is never blank. The provider footer on the Desk stays; this is the
depth view.

### 4.7 The Morning Edition (CC8 pipeline, CC9 presentation)

**Pipeline (CC8):**
- New mode `dawn` in MODE_STAGES: `("macro", "news", "catalysts", "publish", "revalidate")` — all
  four stages are already any-hour-safe or dawn-safe by their own documentation; `catalysts` joins
  so the day's calendar (and its new timing data) is fresh at breakfast. If the catalysts stage
  proves close-coupled anywhere, split the calendar refresh out rather than force it (intent binds).
- Cron moves to `30 10 * * 1-5` (Part 0.3): Monday gains its dawn run (weekend news + Friday close
  macro — today's cron skips exactly the morning after the most news); Saturday's pointless dawn
  run stops. job_a already skips non-sessions cleanly.
- **Event times:** the catalysts stage enriches earnings events with Finnhub's `hour` (bmo/amc/dmh
  → the existing `timing` column), and the seven allowlisted macro releases carry canonical ET times
  from a static table in catalyst_allowlist.py (CPI/JOBS/PPI/GDP/PCE/RETAIL → "8:30 AM ET", FOMC →
  "2:00 PM ET"), labeled in UI as scheduled convention, not a feed. Untimed stays untimed — a null
  renders nothing (P9).
- The dawn run stamps `pipeline_run.sourceStatus` as today's dawn entry WITHOUT claiming a new
  edition (E1 stands: runDate stays the last closed session; dawnness is carried by the run's
  stages/timestamps). `publish_dawn` follows publish_compute's pattern — never overwrites the
  night's source_status, adds beside it.

**Presentation (CC9):** the Desk becomes edition-state aware. One state machine
(lib/edition-state.ts, client-computed where "now" matters — MarketStateLine's law):

| State | When | Masthead |
|---|---|---|
| **Evening** | evening run is the newest fact (publish → midnight ET) | as today: "THE DESK — EVENING EDITION · Tuesday, July 14, 2026 · Tuesday's close · updated 7:36 PM ET" |
| **Morning** | dawn run succeeded for today's wall-clock session, before the open | "THE DESK — MORNING EDITION · Wednesday, July 15, 2026 · before the open · market data through Tuesday's close · news & macro refreshed 6:31 AM ET" |
| **Session** | open ≤ now < evening publish | Morning masthead + the pill says OPEN (content unchanged — we do not pretend to be live) |
| **Overnight gap** | after midnight, dawn not yet run | Evening masthead (never claim a morning that has not happened — R6) |

Morning content (all deterministic — the LLM stays an evening writer; no dawn Anthropic spend):
- **Module 02 becomes "THE MORNING PLAN"** in morning state: (a) *Overnight* — top 3 clusters by
  significance ingested since the evening press time, same card grammar; (b) *Today's calendar* —
  today's events with their new times ("JNJ earnings · before the open", "CPI · 8:30 AM ET"),
  bmo-first; (c) *Where things closed* — one line reusing the evening's verified numbers ("S&P
  7,515.34 −0.79% Tuesday; VIX 17.16"). The evening brief, when published, sits beneath as "Last
  evening's brief" (collapsed link, same page). In evening state, module 02 is the brief exactly as
  today. amJson/pmJson stay untouched dormant slots — the Morning Plan is assembled from live
  tables, not a second LLM artifact (cheaper, and nothing to verify at dawn).
- The calendar rail flips today-first in morning state (D7's ordering serves each state).
- check:live learns the states: run in an evening window it asserts Evening truths (existing six);
  a new `--window=morning` flag asserts the Morning truths (edition claim matches dawn run
  presence; refreshed stamp < 9:30 AM ET). The evening assertions NEVER relax (the six stand).

### 4.8 Lifecycle (CC10)

The janitor is a stage appended to the nightly full run (after publish, before revalidate), driven
by ONE manifest (pipeline/janitor.py, mirrored read-only by a unit test against schema.prisma):

| Policy | Models |
|---|---|
| `forever` (the record — janitor cannot name them; DB triggers second-lock the first two) | signal_log, signal_resolution, briefing, journal_entry, paper_trade, base_rate_stat, instrument, concept_state, lesson_progress, pipeline_run, market_context, macro_stat, manual_run |
| `replace` (already self-cleaning) | calendar_event |
| `trailing(45d)` | news_item, news_cluster, catalyst_link, news_image |
| `trailing(30 sessions)` | scan_result, setup_card, vol_band |
| `trailing(400 sessions/symbol)` | price_bar (serving floor is 260 + buffer; the R2 lake keeps the 5-year history compute mode needs — the janitor NEVER touches R2 parquet) |
| `trailing(8 dumps)` | R2 `backups/` prefix (the one R2 deletion the janitor performs) |

Couplings honored: **brief citations** — from CC10 on, publish_briefing snapshots its sources
(title/outlet/url) into the briefing row (`sourcesJson`, one additive migration), so news purges
never orphan a published brief; the janitor's news deletion starts at the snapshot cutover date and
a test proves every published briefing's sources resolve without a news_item join. pipeline_run is
`forever` deliberately: ~250 rows/year of operational memory the control room reads.

The control room (4.6) gains a Janitor row whose sheet reports last night's retirements ("news: 214
rows past 45d · scans: 1 session's rows · backups: kept 8 of 9") — deletion is visible, boring, and
countable. **NEW marking (R8):** clusters and calendar rows first published in the current edition
render one quiet mono tag "new" after their title; the loader compares firstSeen to the prior
edition's press time — no user tracking, cache-safe, and the tag disappears with the next edition.

---

## Part 5 — The phases

Every phase: read CLAUDE.md + this plan's cited sections → tests first (the targeted-TDD list per
phase below) → build → THE ENDGAME (CLAUDE.md's standing gate: local gate → push → rehearse the
exact SHA → check:live green → tag `cc-N` by SHA → one docs commit after). VRT expectations per
phase are in Appendix C; any brand-new surface's first baseline gets eyes (the PD3 law). Anything
that would be a question goes to QUESTIONS-FOR-BISHANT.md with the assumption marked.

**CC1 — The two live defects (and three paper cuts). Tag `cc-1`. RUNS BEFORE LEAN-CODEBASE.**
FIRST STEP: wire the `cc-*` tag family into ci.yml's tag filter (test_ci_tag_families.py names the
expectation; push the workflow change before any dispatch — the dispatch-validates-on-target-ref
trap is documented in CLAUDE.md).
Build: (a) fonts.ts → `display: "swap"` ×3 (D1, R2) + the source-pinning unit test + Lighthouse
re-check in the gate. (b) The brief (D2): stats.py values state their windows — breadth
`f"{pct*100:.2f}% of the universe above its 50-day average"` (unit fix ×100 rides here), movers
`f"…% 1-day {direction}"`, ten-year `"…% 10-year yield"`; fix the wrong-unit test fixture to feed a
fraction; add the red→green verify test (a draft narrating windows over build_stats sources verifies
`ok` with zero flags); add the "IDs go in citations, never prose" line to the briefing synthesis
prompt (the 47a713f rule, applied to the second narrator). DO NOT touch verify.py — the gate's
strictness is the product working. (c) Held-state UI: BriefArticle's held view drops the four-slot
skeleton for the one calm line (a skeleton under "unavailable" promises content that is not coming —
the no-shimmer-on-empty law, applied). (d) Calendar dedupe on (code,date,symbol) + fixture test
(D7). (e) The ticker sheet renders scan TITLES, never preset keys ("gap-3plus" → "Gap of 3% or
more"). Gate extras: after deploy, dispatch nightly-b manually (`gh workflow run nightly-b.yml`) and
READ THE PUBLISHED BRIEF IN PRODUCTION — the suite going green is not the check (the PD7 lesson,
now a standing memory). VRT: Desk (brief now renders), ticker sheet.

**CC2 — Time, told properly. Tag `cc-2`.** Build 4.1 exactly: formatter shapes + every call site +
copy.ts templates + the ISO leak + the new drift rule (Intl only in time.ts). Tests first: rewrite
time.test.ts to the new shapes (red), then implement. VRT: full re-shoot, all four legs — every
timestamp in the product changes (this is the phase's entire VRT budget; batch nothing else into
it). Open every candidate; the diff list should read as "timestamps only."

**CC3 — The masthead and the toggle. Tag `cc-3`.** Build 4.2: one-truth masthead (R3 + its e2e
guard), strip slimming, theme toggle in every top bar (44px, cookie-write matching lib/theme.ts,
aria-label), phone masthead market pill. a11y sweep covers the new button; grid.spec unaffected
(no column changes). VRT: every room's top strip + both themes toggled via the new button in one
e2e journey (toggle → assert data-theme + cookie → reload → persists).

**CC4 — One hierarchy grammar. Tag `cc-4`.** Build 4.3's table room by room; the as-of
differs-vs-matches treatment; the dead-space fixes (Sectors & Scans module rows, Paper ticket +
column rebalance, Track record's informative empty, Academy measure centering); D10's phone cuts.
This is the widest visual phase: budget TWO rehearsal round-trips (the batch-fixes-into-one-reshoot
standing rule applies — collect every red leg's candidates, fix all, dispatch once more).

**CC5 — News, text-first. Tag `cc-5`.** Build 4.4: delete L3/L4 rungs + retire the frames,
text-first lead/row/sheet, "Market-wide" word, byline source counts, amend UI-REDESIGN-PLAN
§7.7/7.9 + C9 with dated correction blocks. R4's e2e guard. VRT: news room + desk front-page module
+ story sheets, all legs; first-baseline eyes on the new lead composition. dummy/ screenshots may
retire after this phase (hand LEAN-CODEBASE the note).

**CC6 — Honest relevance. Tag `cc-6`.** Build 4.5: instrument assetClass/exchange migration +
backfill from Alpaca payload; movers floor + footnote + RelVol diagnosis (named constant or honest
"≥" rendering); significance v2 with weight table + worked-example test; tie-break newest; calendar
row grammar + reported-today collapse. Pipeline tests first (scoring table rows, floor membership,
dedupe fixture); app tests for the module footnote and ordering. Post-deploy: dispatch a real news
mode run and read the front page (the memory's lesson — the prose is the check). VRT: desk + news.

**CC7 — The control room. Tag `cc-7`.** Build 4.6 on DataTable + DetailOverlay (read
.claude/skills/new-surface FIRST — it is the law for any new sheet). Compute next-run from cron
lines DST-honestly (the two seasonal renderings when they differ). Reuse the request_id recovery
path untouched. e2e: table renders all rows from seeded pipeline_run/manual_run; sheet opens; the
dark-button state with the P-2 banner pins. a11y + touch sweeps pick the new controls up via the
manifest (settings is already a room; no manifest change). VRT: settings, all legs.

**CC8 — The dawn run becomes the Morning Edition's engine. Tag `cc-8`.** Build 4.7-pipeline: `dawn`
mode + MODE_STAGES + main() dispatch (the unknown-mode refusal stands); cron `30 10 * * 1-5`;
publish_dawn (compute-mode's non-overwrite pattern); Finnhub `hour` enrichment + canonical macro
times + `timing` writes; workflow input choice gains `dawn` (push before dispatch — the 422 trap).
Tests: mode-stage pinning, dawn-on-Monday, non-session skip, timing enrichment fixtures, publish
non-overwrite. Gate: dispatch a REAL dawn run (any hour — it is hour-safe) and verify sourceStatus
gains the dawn entries and the calendar carries times. Control room row updates to "Dawn refresh ·
Mon–Fri ~6:30 AM ET."

**CC9 — The Desk greets the morning. Tag `cc-9`.** Build 4.7-presentation: edition-state machine
(client-side where "now" lives, unit-tested on the seeded clock), masthead states, THE MORNING PLAN
module, calendar today-first flip, check:live `--window=morning` assertions, copy.ts strings
(Appendix A). The seeded world IS a fixed morning — decide with eyes whether the seeded e2e legs
render Morning or Evening state (they will flip to Morning if the seed gains a dawn run row; the
default seed should exercise BOTH: one spec pins each state via the two seeded run shapes). VRT:
full re-shoot expected (masthead everywhere + module 02); first-baseline eyes on the Morning Plan.

**CC10 — Fresh in, stale out. Tag `cc-10`.** Build 4.8: janitor manifest + stage + R2 backup
trimming + briefing sourcesJson snapshot migration + control-room Janitor row + NEW tags (R8).
Tests first: manifest⇔schema bidirectional, allow-list refusal, retention arithmetic on fixtures
(sessions vs days), citation-resolution proof, NEW-tag edition boundary. Gate: run the real nightly
(or compute-mode dispatch) and read the janitor's report line in the control room; confirm row
counts moved in production (SELECTs, read-only). PROGRESS.md closes the plan with the storage
footprint it achieved.

---

## Part 6 — Mobile, first-class

Every phase's spec above names its phone behavior; the recurring laws: 44 px targets on every new
control (toggle, table rows, sheet close); inputs ≥16 px below md; DataTable renders the control
room as its card list on phones (the `:visible` selector law when testing); the Morning Plan module
follows the phone macro grammar (no shelves, `data-macro-group` conventions untouched); the
masthead pill + two icon buttons must fit 360 px without wrapping (measure in the phone sweep, not
by eye); news text-first cards remove the phone's tallest dead element (the hero slab) — the phone
front page's first viewport should show TWO headlines where today it shows one slab and a
truncation. The hardening sweep (page-level overflow, 412 AND 360, room-counted) and the desk
cell-level sweep both stand unchanged as gates.

---

## Part 7 — Adversarial pass (what this plan could break, and the counters built in)

1. **swap causes CLS.** next/font metric fallbacks bound it; CC1's gate re-runs check:lighthouse
   and treats a CLS regression as a red, not an explanation. (And re-sample before believing any
   single Lighthouse number — the ±10 synthetic-4G law.)
2. **The brief publishes a NEW falsehood once unheld.** The unit fix (×100) lands in the same
   commit as the unhold; the red→green test narrates the exact production sentence shape; the gate
   requires reading the real published brief. Residual: occasional legitimate holds remain
   (">2 flags" on numeral-bearing names) — they are the gate working; PROGRESS notes the base rate
   of holds for a week so a regression is visible.
3. **The Morning masthead lies on a holiday.** The state machine keys on "dawn run succeeded for
   today's wall-clock TRADING day"; job_a skips non-sessions, so holiday mornings stay Evening
   Edition of Friday — R6's guard asserts exactly this and check:live's evening six never relax.
4. **E1 violated by a "Wednesday" edition.** Never claimed: runDate stays the last closed session;
   the morning is presentation + genuinely-fresh news/macro, and the masthead words say "market
   data through Tuesday's close." The publish guard keeps raising on a fake session either way.
5. **The janitor eats the record.** Two locks (manifest allow-list + DB triggers), a refusal test,
   and `forever` as the default for any unnamed model (the bidirectional manifest test makes a new
   table without a policy a red build, not a silent accumulation).
6. **News purge orphans brief citations.** sourcesJson snapshot lands BEFORE the first purge; the
   citation-resolution test proves it; the purge start date is the snapshot cutover.
7. **Compute mode starves after bar trimming.** Compute reads the R2 lake, not price_bar (its own
   docs); the janitor never touches R2 parquet; price_bar keeps 400 sessions ≫ the 260 serving
   window; volbands' 500-session window reads the lake. A pipeline test pins "janitor manifest
   never names an R2 dataset."
8. **The seeded VRT world flips wholesale at CC9.** Planned: both edition states get seeded specs;
   the re-shoot is budgeted in CC9 alone; first-baseline eyes (the law that a baseline proves
   sameness, never rightness, so the first picture gets human judgment).
9. **Chip/tag proliferation re-jumbles the masthead.** R3's e2e occurrence-count guard fails a
   second market-state mention at build time.
10. **The dawn run doubles provider spend.** Counted: dawn adds one macro sweep (FRED/GoldAPI/NRB —
    free), one news sweep (Finnhub free; Marketaux ~60 items — its daily budget doubles: still ~120
    of 300), one Finnhub calendar call. No Anthropic spend at dawn (deterministic Morning Plan).
    The control room shows per-run source status, so a quota trip is visible the morning it happens.
11. **This plan fights the one-phase-per-session rule by being ten phases.** It doesn't — each
    phase is one session by construction, and NEXT-SESSION-PROMPT.md hands over between them (the
    standing ritual, unchanged).

---

## Appendix A — Copy (verbatim, into lib/copy.ts; the mechanical voice reviews every line)

- masthead status: `"{weekday}'s close · updated {stamp}"` → e.g. "Tuesday's close · updated 7:36 PM ET"
- strip: `"{n} sources · {degraded} degraded · next edition {day} ~{time}"` → "14 sources · 2 degraded · next edition Wed ~6:37 PM ET"
- morning kicker: `"THE DESK — MORNING EDITION"`
- morning status: `"before the open · market data through {weekday}'s close · news & macro refreshed {time}"`
- morning plan headers: `"THE MORNING PLAN"` · `"Overnight"` · `"Today's calendar"` · `"Where things closed"`
- last brief link: `"Last evening's brief →"`
- market-wide word: `"Market-wide"`
- sources when >1: `"{n} sources"`
- movers footnote: `"Liquid names only — the full universe stays in Scans."`
- relvol capped: `"≥{n}×"` (only if the diagnosis finds a cap)
- reported-today row: `"Reported today: {symbols}"`
- janitor report: `"Retired last night: {news} news items past {days}d · {scans} sessions of scan rows · backups kept {kept}"`
- new tag: `"new"` (lowercase, mono, muted — information, not a shout)
- theme toggle aria: `"Switch to {mode} theme"`
- toggle modes in settings stay: System / Light / Dark (unchanged)

## Appendix B — Schema deltas (additive only; every migration named here)

1. `instrument.assetClass String?` + `instrument.exchange String?` (CC6) — backfilled from Alpaca's
   universe payload on the next full run; null stays legal (delisted rows).
2. `briefing.sourcesJson Json?` (CC10) — the citation snapshot; written by publish_briefing from the
   run's kept articles.
3. No changes to signal_log / signal_resolution — their triggers are the point.
4. `calendar_event.timing` already exists — CC8 starts writing it; no migration.

## Appendix C — Expected VRT deltas (the re-shoot budget; diff every candidate, not just failures)

| Phase | Legs | Expected diff surface |
|---|---|---|
| CC1 | desktop+phone+wide+mbp16 | Desk module 02 (brief renders), ticker sheet (title not slug) |
| CC2 | all four | every timestamp string, nothing else — the cleanest possible diff list |
| CC3 | all four | top strip of every room; toggle journey shots |
| CC4 | all four | widest: headers/meta everywhere, Paper, Track, Scans card, Academy measure |
| CC5 | all four | news room, desk front-page module, story sheets |
| CC6 | all four | movers module, front page order, calendar rail |
| CC7 | all four | settings only |
| CC8 | — | none (pipeline only; workflow + tests) |
| CC9 | all four | masthead everywhere + module 02 morning state (seeded world may flip) |
| CC10 | all four | small: "new" tags, janitor row in settings |

## Appendix D — The janitor manifest (initial values; the file is the truth once it exists)

As specified in 4.8's table, with Part 0.4's defaults. Sessions count trading sessions (the
calendar module answers), days are calendar days, and every `trailing` entry names the DATE COLUMN
it trims by — a policy without a named column is a red test, because "old" must be defined by the
data, not the janitor's opinion.

## Appendix E — Significance v2, worked example (the test is this table)

Night of 2026-07-14, four clusters: (a) Iran/oil, 1 outlet, market-wide macro, catalyst=fed/macro;
(b) NXTC merger, 1 outlet, micro-cap, catalyst=M&A; (c) LDOS analyst piece, 1 outlet, large-cap,
catalyst=analyst; (d) hypothetical CPI print, 3 outlets, market-wide, catalyst=macro-print.
Expected order: d > a > b > c — corroborated macro print first; single-outlet macro beats micro-cap
M&A on entity weight; M&A beats an analyst note at equal corroboration because catalyst_weight says
hard events outrank opinion. The unit test builds exactly these four and pins the order; the
weights that produce it are constants beside the test.

## Appendix F — Decisions to seed into DECISIONS.md at each phase's docs commit

Each ruling R1–R8 lands as a `[claude]` decision line when its phase tags, citing this plan and the
finding it answers (D1–D10). The two UI-REDESIGN-PLAN amendments (imagery, C9) and the AM-tabs
history (rejected mock → honest morning, D8) get their own lines so the next session inherits the
"why" without re-deriving it.
