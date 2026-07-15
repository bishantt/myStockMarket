# PD8 — News & ticker depth: the surfaces

**Tag:** `pd-8` · **Phase:** POLISH-AND-DEPTH-PLAN Part 9.6/9.7 + Part 10
**Date:** 2026-07-14 · **This is the second move of "depth in two moves": PD7 computed it, PD8 speaks it.**

Part 9's thesis is that depth arrives in two moves and the pipeline goes first: *the LLM narrates only
what the pipeline computed.* PD7 computed more (a wider stats registry, a gated context section, a
snapshotted watch list, per-section verdicts, model provenance). PD8 is the surfaces that say it — the
story page v2, the finished feed card, and the ticker page v2.

---

## 1. THE ONE LESSON PD7 HANDED FORWARD: READ THE PROSE

PD7 published a sha1 hash into a sentence a human was meant to read, and every guard in the repo
passed it. So before this phase tagged, I opened the seeded surfaces and READ what they render:

- **Story context (nc-fda-nonopioid):** *"The move is 2.3x MRNA's normal daily range (ATR14), and the
  name sits 71.4% of the way up its 52-week range (low 82.10, high 154.90). This is the 2nd story on
  this name in the last 7 sessions."* — English. No stat_id, no cluster id, no hash. The verified
  figures (2.3x, 71.4%, 82.10, 154.90) are set in mono; the glossary terms open a doorway.
- **Provenance footer:** *"…extracted by Claude Haiku 4.5, narrated by Claude Sonnet 5…"* — printed
  from `model_meta`, not hardcoded. `formatModel` is structural (no per-model table to rot).
- **Ticker strip (AAPL, 22 seeded bars):** *"Trading range · 22 sessions · through Jul 9"* — the
  honest degradation. It does NOT claim "52-week" over a month of history.
- **SMCI record (a non-served name):** the N-gate suppressed correctly — *"Insufficient history
  (N = 18) — treat as anecdote"* — beside *"Resolved here · 1 miss"*.

This is also pinned as a browser assertion: `news.spec.ts` reads the context and fails if it ever
contains `tkr:` / `cls:` / `cal:`. A schema that validates is not a schema that says something true.

---

## 2. THE STORY PAGE v2 (9.6) — every block names its absence

Ten blocks, top to bottom, each answering for itself when it has nothing (P9). The new ones:

- **Context tonight** — the v2 `context` prose, its numbers KeyFigure-set (E5), its terms Term-linked
  (≤2), through a composed renderer (`StoryContext`) that spends ONE glossary budget across the whole
  paragraph while `splitVerified` cuts it at the cleared figures first. Absent = SILENT / out-of-budget
  (nothing) or the gate line (DROPPED). Which one is read from `verification.sections.context.status`,
  never guessed.
- **What our record says** — for each affected name the ledger holds evidence on: the setup card's base
  rate (N-gated, through `BaseRate`) and the resolved hits and misses (through `OutcomeChip`, equal
  weight). REUSE, zero new probability UI.
- **On the calendar** — the snapshotted `watch` rows as dated facts, each a door to the Desk calendar's
  day (`/#cal-{iso}`). A hash link never 404s — a watch date past the Desk's forward window lands on
  the module without scrolling, which is the honest soft failure.
- **Provenance footer** — prints the models `model_meta` actually recorded.

### `verification.dropped` is retired — into ONE reader

PD7 shipped the `sections` map ALONGSIDE the old `dropped` boolean, because a pre-PD7 production row
carries `dropped` and no sections map. PD8 retired the standalone `noteDropped` field into a single
version-dispatching reader (`lib/news.ts:readSectionStatus`): it prefers the per-section verdict, and
falls back to the v1 `dropped` flag ONLY for `why_it_matters`, the one field the v1 shape knew about.
So `verification.dropped` is read in exactly one place, as a documented fallback — not two live readers
competing. The seeded JPMorgan row (v1 gate-drop) still resolves to a "dropped" verdict; the fixture
test proves it.

### The named source list moved down (block 9)

N5 put the sources first, when the page had little else. The page is now rich enough that the reader's
contract flows to the sources near the end (the order 9.6 sets) — and the corroboration COUNT still
sits in the header, so nothing about "openable" is lost. Logged in DECISIONS.

---

## 3. THE FEED CARD, FINISHED (9.4) — one door out

The byline outlet name is a real external anchor to the first source (E8). It cannot live inside the
card, because the card is one big `<Link>` to the story and an anchor inside an anchor is invalid HTML
(the exact TickerChip / drift-rule-26 hazard). So the card is a `<div>` now, holding two SIBLINGS: the
story link (image, headline, chips) and a footer row with the byline anchor in its own hairline-
separated box, ≥44px on touch. **Verified live: `check:live` reports "news · byline links: 20 outbound
link(s)"** — the anchors are real in production, closing one of pd-7's two pending live assertions.

---

## 4. Q-PD6-2 SOLVED — the sweep now measures real controls

PD6 found a 21px touch target that lived on the story page for a whole phase because the sweep visited
`nc-fed-hold`, which has ZERO catalyst links — so the affected table rendered no rows and the TickerChip
doors were never measured. The rule was being kept by the shape of a fixture. The manifest's story
probe is repointed to **`nc-fda-nonopioid`** — the one seeded story with THREE catalyst links AND the
full v2 insight — so the touch sweep measures the doors AND the VRT locks the full anatomy. The sweep
now passes `/news/nc-fda-nonopioid` with real controls to measure (hardening.spec, test 41).

---

## 5. THE TICKER PAGE v2 (Part 10) — worth opening for every name the app can name

Two queries became six, all from what the schema already serves. New blocks: an identity line
(exchange · sector · industry, each absent field omitted — **market cap appears nowhere**), the
52-week strip, tonight's mention (snapshot numbers via `catalyst_link`), the record here (the same
`SymbolRecord` the story page uses), the calendar (30 days, forward from the EDITION not the wall
clock), and the paper position (open rows marked live, plus realized history). A non-served name renders
the honest subset — no chart, but its identity, mention, record, calendar and paper — never a blank
chart. The Rail's exit label is the clearer "Full view: {SYM} →" (10.2, logged non-change).

### The 52-week strip states its window HONESTLY — the one judgment call this phase made

The strip is a "52-week range" claim, and a claim about a year is a lie over a month. The seed gives
every symbol 22 bars, so rather than fake a year (or bump the seed and re-baseline the Desk's watchlist
sparkline), the strip computes over the trailing up-to-252 closes and STATES the true count: it says
"52-week range · {n} sessions" only when the window really is about a year (≥240 sessions), and
"Trading range · {n} sessions" otherwise. In production (252 bars) it reads "52-week range · 252
sessions"; the seed reads "Trading range · 22 sessions". This is MORE honest than the plan's fixed
label, not less — every number states its scope (§5.2), and absence beats invention (the registry's own
rule, PD7). Booked in DECISIONS as the delivery of the plan's "52-week strip".

---

## 6. THE RECORD LAYER IS SHARED — a bug's habitat, prevented

The story page and the ticker page ask the same question of a name (does our ledger hold anything?), so
it is ONE loader (`lib/record.ts`) and ONE component (`SymbolRecord`), not two — the codebase's own
hardest lesson is that a duplicated renderer is a bug's habitat (PD5: four delta chips, and the fix had
landed in one). The setup-card view builder was extracted from `lib/morning.ts` into
`lib/setup-card-view.ts` for the same reason, and the Desk's loader now reads it too. The setup card
renders read-only off the Desk (its interactive weakener checkboxes write through a Desk-scoped server
action; rendering that off the Desk would revalidate a path this page is not — a cache hazard this
build has been bitten by more than once). The honesty requirement — N-gates and CI displays intact — is
what `BaseRate` delivers, and it does.

---

## 7. The gate — everything green before the tag

- **App unit tests: 710 → 733** (+23: the v2 news readers, `formatModel`, `computeRangeStrip`,
  `hasRecord`, the calendar anchor, and the `SymbolRecord` / `RangeStrip` component tests). Pipeline:
  **576 + 35 skipped** (unchanged — PD8 is an app phase).
- **Anti-drift: 28 → 28** — no new rule; `RangeStrip.tsx` joins `P2_FILES` (it renders price).
- **Bundles:** every route within slack and under the 200 KB ceiling. `/news` 197.4 KB (baseline 195.1,
  +2.3 — the byline's client anchor), `/news/[cluster]` 165.3 KB (baseline 161.6), `/ticker/[symbol]`
  150.4 KB (baseline 148.5). Worst is `/paper` at 198.1 KB (shared-chunk drift, 1.9 KB under the
  ceiling) — within slack, so not re-baselined; the ceiling is the binding guard and it holds.
- **`check:live` — all 7 pass**, including the news bylines, GREEN in production (b4f974e).
- **`check:migrations` clean** — PD8 ships NO migration, so the deployed schema still matches pd-7's.
- **No migration.** **Fonts pass with 317 KB headroom.**

---

## 8. VRT — 21 shots re-shot, 8 born, 2 left alone because they were the camera

PD8 is an app phase, so the oracle redded on pixels — as it should. The prediction was stated
before the run: the news feed grows by its byline footer; the story page's baselines change because
the probe repointed to a different, richer story; the ticker grows by its new blocks; three new
surfaces have no baseline yet. It landed exactly there.

**Every candidate was diffed against its committed baseline (decode + pixel count), not just the
failures** — the law that has bitten this repo four times (an EXACT baseline can still be wrong; a
TOLERATED one is still wrong). The diff separated two kinds of change cleanly:

- **21 re-shot / 8 new — all TALLER at the SAME width.** No shot got wider-and-taller (PD3's law: a
  page that gets wider is not supposed to get taller). The news feed grew `+170px` desktop / `+444px`
  phone (a byline footer per card); the story grew `+518px` (the full v2 anatomy); the ticker grew
  `+516px` (strip + mention + calendar + paper). Every one was opened and read before its baseline
  was committed — the new surfaces (dropped, sparse, thin) especially, because a brand-new picture
  gets eyes the one time anyone will look at it with fresh judgement.
- **2 changed on pages PD8 never opened — the CAMERA, not the app.** `login-desktop` moved **176px**
  (the gradient's dither, which PD6 and PD7 both saw) and `track-record-dark-desktop` moved **0px
  above tolerance** (pure rasterisation jitter). Both are a single theme × single project — the
  signature of the camera, not a shared-component change (which would move every shot of the
  surface). **Left committed as-is**: re-baselining a picture you cannot vouch for trades one
  unexplained image for another.

And the prose was READ in the browser, not just the pixels: the story context reads as English with
its figures in mono, the gate-dropped story says the gate held it, the sparse row's footer says "an
earlier run", and the non-served ticker shows a record with no chart.

## Gate size at `pd-8`

**28 drift rules · 91 VRT baselines · 25 e2e specs · 733 app unit tests · 611 pipeline tests
(576 pass, 35 skip locally) · 16 bundle baselines · 14 manifest rooms · 4 oracle legs · tag run
7m 7s (`49c0c34`, run 29383475208, green on all four legs).**

The gate grew by **8 VRT baselines** (three new surfaces) and **23 app unit tests**, and no drift
rule (RangeStrip joined the existing P2_FILES list rather than adding a rule). Everything else is
unchanged: PD8 renders what PD7 computed, and rendering is the app's job, not the pipeline's.

**The instruments all agreed the night was healthy — and this time, reading the prose agreed with
them.** That is the difference PD7 bought: the guard that reads the sentence, not just the pixels,
is now in the browser suite.

