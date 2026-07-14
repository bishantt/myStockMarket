# PROGRESS.md — resumable state

# PD5 IS **COMPLETE** — tagged `pd-5` (`4fadf4c`), CI green **first try**. **Eleven tags, eleven first-try greens.**

**Checkpoint: POLISH-AND-DEPTH-PLAN.md, PD5 (Part 8 — the voice: the richness system) is DONE.
Nothing is blocked. Nothing is in flight.**

**NEXT: PD6 — the voice, remaining rooms** (plan Part 8.3's PD6 list + Part 12's PD6 entry).

## What PD5 did, in one paragraph

Built the richness kit — **TickerChip** (one symbol, one treatment), **DeltaChip** (the app's ONE
delta chip), **Term/TermProse** (the glossary doorway, superseding GlossaryTerm) and
**KeyFigure/VerifiedProse** (E5 as a *type*: emphasis you cannot fake) — and landed it on the Desk and
the news room. Wrote the complete **colour dictionary** into the styleguide. Added **drift rules 26
and 27**. And then found three bugs *by looking at the screen*, every one of which was invisible to a
fully green test suite: the brief's glossary doorway decorated **nothing** (the glossary knows "RVOL";
the narrator writes "relative volume"); the news feed's ticker chips had been encoding direction by
**colour alone** since N5 — a P7 violation sitting in a committed baseline; and the pixel oracle's
scans-preset baseline turns out to be **a photograph of a hover state**.

## The five things that are now true (a fresh session must know these)

1. **A DUPLICATED COMPONENT IS NOT A BUG. IT IS A BUG'S HABITAT.** PD4 found the delta chip's wrap
   contract the hard way and fixed it — **in StatFigure**. There were FOUR copies of that chip
   (StatFigure, Movers, Watchlist, NewsCard). The other three still carried the exact shape of the bug
   PD4 had just spent a phase killing, and nothing failed, and nothing would have. There is **one**
   chip now: `components/DeltaChip.tsx`. **When you fix a bug, grep for the component's siblings
   before you close it.**

2. **Q-G4-1 IS CLOSED: the delta chip carries `data-p2`** — and it cost the Desk its hover transition.
   Movers and Watchlist had carried `transition-colors` since the redesign and got away with it for
   ONE reason: their delta chips were unmarked, so the P2 ancestor walk had **never once looked at the
   two busiest money surfaces on the Desk**. The rule was being kept by luck. Marking them failed the
   build on both rows immediately. Their hover is INSTANT now. **A guard only guards what it is
   pointed at.**

3. **THE BRIEF CARRIES GLOSSARY DOORWAYS BUT NO EMPHASIZED FIGURES, AND THE OMISSION IS THE POINT.**
   E5 needs an ALLOW-list. A news cluster has one (`key_numbers` = what the gate CLEARED). The
   briefing does not — it stores the FLAGS, and a published brief may still carry up to two of them.
   Emphasizing brief numbers would mean the APP deciding what counts as a number, with its own regex,
   and `briefing/verify.py` already answers that. **Booked for PD7 as Q-PD5-1** (have the gate publish
   what it cleared, not just what it flagged).

4. **THE NEWS FEED HAD A P7 VIOLATION IN A COMMITTED BASELINE.** The old ticker chips read
   `+2.10% · 1D` in green or red — **direction by hue alone**, no glyph, on the front page, since N5.
   Every guard was green; the baseline had photographed it and was defending it. `DeltaChip` brings
   the triangle, so direction is told three ways. The news room is **+29px taller on a phone**, and
   that height is the honesty fix paying its own way.

5. **THE PIXEL ORACLE HAS A HOVER STATE IN IT, AGAIN (Q-PD5-2).** Diffing EVERY candidate against its
   committed baseline — not just the failures — found three shots that changed **without failing**, on
   pages PD5 never touched. The committed `scans-preset` baseline has **a row highlighted as if the
   mouse were resting on it**. PD4 fixed exactly this on the ticker by parking the mouse at (0,0) in
   `shoot()`; the fix did not reach everywhere. Left alone deliberately (the oracle passes it, and
   PD5 did not touch that page). **For PD6, which touches the scans room.**

---

## (Historic) What PD4 did, in one paragraph

The phone was quietly broken and every guard said it was fine. Measured on the **tagged, green
`pd-3` tree**, before PD4 changed a line: **the Desk overflowed sideways by 16px at 360px, in
production**; the mortgage cell's window label rendered **"· vs / prior / week", one word per line**;
and the two swipe-shelves were hiding **four of nine figures** behind a swipe. The shelves are now a
2-up card row, a full-width tape list and a 2×2 money grid — everything visible, nothing spilling.
`StatFigure` got a wrap contract. The sweep now runs at **360 as well as 412** and counts the rooms it
visited. And then PD4 **wrote its own version of the same bug**, shipped it past every green test, and
was caught by a screenshot — twice.

## The five things that are now true (a fresh session must know these)

1. **A PAGE-LEVEL OVERFLOW GUARD IS STRUCTURALLY BLIND TO A CELL-LEVEL OVERFLOW.** This is PD4's
   sharpest finding and it nearly shipped.

   The sideways-scroll sweep asks the **document**: `scrollWidth === clientWidth`. A cell that spills
   into the cell **next door** lands its spill *inside* the page, never past its edge. So the document
   reports zero overflow — **honestly** — while a figure sits under the border of its neighbour.

   PD4's first tape row did exactly this: index levels overflowing their cards by **8px**, delta chips
   shattered into **three lines**, and **every guard green** — the unit tests, the class contract, and
   the brand-new 360px sweep I had *just written*. Only the screenshot showed it.

   > **The box you measure must be the box the bug is in.** A guard aimed one level too high is not a
   > weak guard — it is a guard that will never fire, and it will make you confident while it does not.

   `e2e/desk.spec.ts` now asks the question of the **cell**, measuring to the **content** edge (a
   figure sitting in its own card's padding is already touching the wall).

2. **THE ORACLE WAS PHOTOGRAPHING A HOVER STATE — the ticker baseline encoded where the LOGIN BUTTON
   was.** `signIn()` *clicks* the Sign-in button; Chromium leaves the pointer resting there and
   Playwright never moves it. On `/ticker/AAPL` the candle chart lands under that stationary cursor,
   lightweight-charts thinks it is hovered, and draws a **crosshair** — two dashed lines and a black
   price pill — into the baseline.

   PD4 moved the Sign-in button down (the phone login gained a mark). The pointer moved with it, the
   crosshair slid down the price axis, and the pill went **214.54 → 213.02** on a page PD4 never
   touched. The candles were pixel-identical; only the crosshair moved. It reproduced **byte-for-byte
   on a re-run**, so it was never flake.

   `shoot()` now parks the mouse at (0,0). **This is PD3's law for the third time and it is always the
   same law: a baseline proves the page did not CHANGE; it never proved the page was RIGHT.**

3. **A GUARD POINTED AT THE COMFORTABLE END OF A RANGE IS NOT MEASURING THE RANGE.** The Desk scrolled
   sideways 16px at 360px **in production**, and the sweep built to catch exactly that was green —
   because it ran at each project's viewport, and the phone project is a **Pixel 7 at 412px**, the one
   phone width where the defect does not happen. The sweep was never wrong. It was **aimed at the easy
   end**. It now runs at 360 too, and it **counts the rooms it swept** and fails if it swept none.

4. **THE WRAP CONTRACT: the unit of wrapping is the ATOM.** PD3's rule — *numbers never truncate,
   never ellipsize, never clip; wrapping is just typography* — is true, and I over-applied it and
   reproduced the very bug it was written to prevent. Told to wrap rather than clip, a delta chip
   wrapped into `▲` / `+0.29%` / `· 1D`: **three lines, one token each.**

   > "Wrapping is honest, truncating is not" is a claim about a **sentence**. A phrase broken one word
   > per line has not been wrapped — it has been **shattered**, and a shattered figure is no more
   > readable than a truncated one.

   A delta chip has **two atoms**: the signed delta (`▲ +0.29%`, one fact in three redundant channels)
   and its window (`· vs prior week`, the delta's unit). Each is `whitespace-nowrap`; the chip is
   `flex-wrap`. Wrap **between** atoms, never **within** one. **This fixed a live production bug, not
   just my own** — the mortgage window had been shattering for months.

5. **THREE CARDS DO NOT FIT ACROSS A PHONE, AND THE PLAN'S ARITHMETIC WAS WRONG.** Part 7.1 specified
   a 3-up grid and estimated "≈112px interior". **Measured: 74px at 360, 91px at 412** — against an
   index level of ~81px and a delta chip of ~95px. A mono numeral has no wrap opportunity inside
   itself, so it cannot be made to fit, only to overflow. I got the type down to **within 1px** of
   breaking and stopped: **a design one pixel from failure is a coin flip, not a design.**

   The tape is a **full-width list**, which keeps 7.1's argument intact (cards for the figures the
   hero does not already state; a list for the ones it does). **The plan is amended in place** — Part
   7.1 carries a dated correction block, so the plan and the code never disagree in silence.

## The phone composition, as shipped

```
Macro Pulse (module 01), below md:
  S&P hero                      full width, 48px numeral   (unchanged)
  [data-macro-group="risk"]     VIX | 10-year              2-up cards, `body` scale
  [data-macro-group="tape"]     Nasdaq / Dow / Small caps  ONE Surface, 3 hairline rows,
                                                           `dense` scale, layout="row"
  breadth                       full width                 (unchanged)
  [data-macro-group="money"]    the 4 stats                2×2 grid, `dense` scale
  Mood gauge                    full width, BELOW the grid (never IN it — see below)
```

`StatFigure` gained two things: a **`dense` scale** (value `text-base`, chip `text-xs` — the chip
shrinks *with* the figure, or the value fits and the chip does not) and a **`row` layout** (label
left, figure right, on one baseline) which is what makes the tape list possible.

**The gauge must never enter the money grid.** A grid row is as tall as its tallest cell — the same
mechanism as the shelf that once padded four stat cards with 200px of white space each and grew the
phone Desk by 347px. The guard survived the shelf's retirement and now measures cell heights in the
browser (threshold 280px: the real cells measure 125–163px; the gauge is well past 400px).

## The gate at `pd-4`

- App unit tests: **649** (was 642 — `StatFigure` gets its own test file; the MacroPulse shelf tests
  are **inverted**, not deleted). Pipeline: **535** (504 + 31 skipped locally without Postgres).
- Anti-drift: **25 rules**, unchanged. Rooms: **14**. Oracle legs: **4**. e2e specs: **25**.
- **Bundles unmoved: worst `/news` 196.3 KB against the 200 KB hard ceiling.** Composition is not JS.
  **PD5's kit and PD9's overlay both spend from this same ≈3.7 KB of headroom.**
- Fonts 243/560 KB · `check:migrations` clean · `check:live` **all six green** (1 pending, owed to
  PD8) · `check:nav` (every cached room 44–62 ms; `/settings` 436 ms, the argued `force-dynamic`
  exemption) · `check:lighthouse` **CLS 0.000, first-load JS 178 KB** (both hard gates).
- **VRT re-minted: the phone's Desk ×2, styleguide ×2 and login ×2, plus the ticker on every leg**
  (the crosshair is gone from all of them). Every candidate was diffed against its committed baseline
  **and opened and looked at** before it was committed.

## Two local-harness traps that cost time — do not re-learn these

- **`thin-night`'s Law-2 test will fail against a hand-started server.** If your server lacks
  `CRON_SECRET`, thin-night's ISR cache-bust silently no-ops and the test photographs a **stale
  full-night render** (318px where it wants ≤120). It looks exactly like a layout regression and is
  not. **Let Playwright start its own server** — its `webServer.env` sets the secret.
- **`e2e:local` needs ONE PROJECT AT A TIME** (already in CLAUDE.md), and *within* a project the local
  worker default is **parallel**, which is enough to make `ticker-range` fail on the shared database.
  Add `--workers=1` locally.
