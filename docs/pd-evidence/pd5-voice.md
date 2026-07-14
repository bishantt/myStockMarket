# PD5 — The voice: the richness system, the Desk, the News feed

**Tag:** `pd-5` · **Phase:** PD5 (POLISH-AND-DEPTH-PLAN Part 8) · **Date:** 2026-07-14

The commission: make it feel alive and authentic — accent chips, semantic colour that carries
meaning, weight and emphasis on terms that matter — **without touching one stone of the honesty
ledger**. The answer is an editorial system, not decoration: every treatment below names the
information it carries.

Richness adds **zero new colour meanings** (E6) and **nothing moves** (P2). The only new "life" is
texture, weight and hierarchy **at rest**.

---

## 1. What was built

### The kit (Part 8.2)

| Component | What it is | The information it carries | Its guard |
|---|---|---|---|
| `components/TickerChip.tsx` | Every ticker symbol, one treatment. **Door** where a door is legal; **label** where an ancestor is already interactive. | "This symbol is a thing with an identity — and, where it is a door, a way in." | Drift rule 26 (one door for the `/ticker/` route) |
| `components/DeltaChip.tsx` | The app's **one** delta chip. Two atoms, `data-p2`. | "This is money, and it moved by this much, over this window." | Drift rule 6 (no motion in a P2 file) + the P2 ancestor walk |
| `components/Term.tsx` | The glossary doorway. Dotted underline, **ink**. Adds `TermProse` for narrated prose. | "This word has a definition one tap away." | Unit test pins the ≤2/paragraph budget; `e2e/voice.spec.ts` pins first-occurrence-per-view |
| `components/KeyFigure.tsx` + `lib/verified.ts` | A verified number in prose. Mono 500, ink, no colour. | "This figure passed the deterministic gate." | E5: type error first, dev-time throw second |

`components/GlossaryTerm.tsx` is **deleted** — `Term` supersedes it. Two components dotting the same
word with the same underline would be two doors to one room.

### Where it landed (Part 8.3)

- **Desk** — Movers and Watchlist adopt `TickerChip` (label mode) + `DeltaChip`; the brief adopts
  `TermProse`; `StatFigure` consumes the shared `DeltaChip`.
- **News** — feed cards adopt `TickerChip` (with the move) and `VerifiedProse` in the headline *and*
  the why-it-matters line; the story page's affected table adopts `TickerChip` (door mode).
- **Styleguide** — a "Voice & emphasis" section: the kit with its rules inline, the complete colour
  dictionary (§8.5), and the negative checklist (§8.4). Permanent, and photographed by the oracle.

---

## 2. The three things this phase found by LOOKING

PD4's parting lesson was *"when your VRT goes green, that is not the same as your surfaces being
right — look at the pictures."* Every finding below was invisible to a green test suite.

### 2.1 The brief's glossary doorway decorated NOTHING

`TermProse` landed on the brief, every unit test passed, and the rendered Desk carried **zero**
doorways in the brief. The glossary holds the display title **"RVOL"**. The pipeline's narrator
writes **"relative volume"**, because that is what a person would say. The matcher, knowing only the
title, walked straight past it.

> **A matcher over NARRATED prose has to match the words the narrator actually uses, or it is
> decoration pretending to be a feature.**

Glossary entries gained `aliases` (16 entries: expansions, plurals, and the hyphen/en-dash variants
a keyboard actually produces). The brief's doorway now lands on "relative volume".

This also made §8.6's required e2e *possible*: without it, "the glossary popover opens from a Term on
the brief" could not have been written against the seeded world, because there was nothing to open.

### 2.2 MacroPulse spends the brief's terms before the brief renders — and that is CORRECT

Measured on the seeded Desk:

| Doorway | Where |
|---|---|
| Breadth | Macro pulse |
| advancing | Macro pulse |
| 50-day average | Macro pulse |
| **relative volume** | **Daily brief** |

Module 01 dots "Breadth" at the top of the page; the brief, 200px lower, says "Breadth was
positive…" **in plain text**. That is not a bug — it is first-occurrence-per-view working. The reader
has already been offered the definition; underlining it twice on one page is the noise the rule
exists to prevent. The per-paragraph **budget** and the per-view **registry** are different rules
doing different jobs, and they compose: a paragraph can honestly render *fewer* than two doorways.

`e2e/voice.spec.ts` pins both halves — that a doorway opens, and that **no term is dotted twice on
the page**.

### 2.3 The oracle's selector resolved to a chip that could never be clicked

`a[href^="/ticker/"]` found the chip. The click then waited thirty seconds for it to become visible,
and died pointing at a chip that was on screen in front of me.

**DataTable renders BOTH layouts into the DOM** — the desktop table and the phone's card list — and
hides one with CSS. `.first()` picked whichever copy comes first in the document, which on a desktop
is the **hidden** one. **It passed on the phone**, where the visible copy happens to be first — which
is the most misleading possible outcome: a green tick on one leg and a thirty-second death on the
other, from one selector.

`:visible` is load-bearing. Recorded because the next person to select a DataTable cell will hit it.

---

## 3. Q-G4-1, ruled — and what the ruling cost

**The delta chip carries `data-p2`.** It is a market figure; it is exactly the class of thing P2
exists to hold still.

The moment `DeltaChip` was marked, **the build failed on the Desk's two busiest money surfaces.**

Movers and Watchlist had carried `transition-colors duration-(--duration-quick)` on their row hover
since the redesign. They got away with it for six phases for exactly one reason: **their delta chips
were unmarked**, so the P2 ancestor walk never looked at them. The rule was being kept by luck.

Marking them turned an innocent hover into a build failure — **drift rule 6 and the ancestor walk,
both firing on the same line.** That is the guard doing its job, not an obstacle to route around.

The rows still answer the cursor; the background simply changes **instantly**, exactly as NewsCard's
always did, and for the reason NewsCard already wrote down: *a price that eases into place is a price
that looks like it is happening right now.*

`p2-motion.test.tsx` now renders the real Movers and Watchlist rows and walks up from every
`[data-p2]` node — plus a negative control that reproduces the exact hover class string they used to
carry, so the guard can still be shown to bite.

---

## 4. The brief gets Terms and NOT KeyFigures — and the omission is the point

E5 requires an **allow-list**: a figure may be emphasized only if the deterministic gate cleared it.

- A **news cluster has one** — `key_numbers`, the figures the gate cleared. `KeyFigure` emphasizes
  exactly those.
- The **briefing does not.** Its verification record stores the **flags** — the entities that
  *failed* — and a published brief may still carry **up to two of them** (the gate holds outright
  only on a Today's-focus flag, or more than two flags total).

The only way to emphasize a brief number today would be to invert the record: mono everything
number-shaped **except** the flagged ones. That requires the **app** to decide what counts as a
number — its own regex, its own opinion on whether "Q3" or "2.1x" is a figure — and
`briefing/verify.py` already answers that question. Its own header says what a second answer costs:

> *"Two definitions of that would be one too many: the day they drifted apart, one of the two
> surfaces would start publishing numbers the other would have refused, and nobody would find out
> from a test."*

So the brief's numbers read as plain prose, which claims nothing — the honest default. Publishing the
gate's **cleared** list alongside its flags is a pipeline change, and it is booked for **PD7**
(**Q-PD5-1**).

---

## 5. The 8.1 eyeball pass — walked against fresh screenshots, both themes

The hierarchy contract each surface is styled and then VERIFIED against. Walked at 412 (phone), 1366
(desktop) and 1512 (mbp16), in Morning and Midnight.

| Room | First read (the hero) | Second read | Reference (quiet) | Verdict |
|---|---|---|---|---|
| Desk | the edition date (masthead) | S&P hero figure → brief headline | strip, provenance, footers | ✅ holds. The kit added no chrome to the masthead; the "alive" is in the content. |
| /news | lead story headline | catalyst/sector tags → why-it-matters | press-time, filters, corroboration | ✅ holds. TickerChips sit *below* the headline and read as reference, not as the hero. |
| /news/[cluster] | the headline | What happened → the insight sections | sources, provenance | ✅ holds. The affected table's symbol column is now a door, and reads as one. |
| Styleguide | section mastheads | the specimens | the rules beneath each | ✅ new "Voice & emphasis" section (16) |

**Both themes checked.** The chip's hairline border and surface fill are tokens, so Midnight inherits
them; no hard-coded hex entered the tree (drift rule 1 is green).

---

## 6. The 8.4 negative checklist — INITIALED

Run against the Desk, /news, /news/[cluster] and the styleguide, at every viewport, in both themes.

| # | Must never appear | Result |
|---|---|---|
| 1 | Motion on any data at rest | ✅ **NONE.** `p2-motion.test.tsx` walks up from every `[data-p2]` node in Movers, Watchlist, StatFigure, DeltaChip, TickerChip, BaseRate, SetupCards, MoodGauge. Drift rule 6 greps the P2 files. **Two transitions were REMOVED to earn this** (§3). |
| 2 | New hue meanings | ✅ **NONE.** Every coloured element on the touched surfaces appears in the §8.5 dictionary. TickerChip's hover is the **accent** family (interactivity — an existing meaning). The delta keeps the **direction** pair. `KeyFigure` adds **no colour at all** — the typeface is the emphasis. |
| 3 | Bold inside Newsreader prose | ✅ **NONE**, and now greppable: **drift rule 27**. The tree passes on the day the rule is written. |
| 4 | Icon as decoration | ✅ **NONE.** The kit ships no icons. The delta's triangle is a *redundant channel* for direction, not decoration, and it is `aria-hidden` because the signed value already says it. |
| 5 | Colour-only signal (P7) | ✅ **NONE.** Every delta carries glyph + sign + colour. Flat gets **no triangle** — inventing a direction would be inventing a fact. |
| 6 | Emphasis on an unverified number (E5) | ✅ **NONE**, and it is now a *type error*. `VerifiedFigure` has exactly one mint. The brief carries no emphasis **because it cannot prove any** (§4). |
| 7 | An underline that is not a doorway | ✅ **NONE.** The only underline the kit adds is `Term`'s, and it opens a popover. It is **ink, not accent** — a definition is not a call to act. |
| 8 | Masthead chrome gaining accent | ✅ **NONE.** Mastheads are untouched: muted mono. |
| 9 | Amber/danger consumer lists changed | ✅ **UNCHANGED.** Drift rules 5 and 19 green; the kit uses neither. |
| 10 | Score-like "heat" tints on movers | ✅ **NONE.** Magnitude speaks through the figures. |

---

## 7. The guards this phase added (booked, with reasons)

| Guard | Why |
|---|---|
| **Drift rule 26** — one door for the `/ticker/` route | A symbol was rendered three ways before PD5. Two argued exceptions, and note what they have in common: **neither is a symbol** (the rail's exit CTA; the affected table's setup-card signpost). Same shape as rule 20's BrandMark door. |
| **Drift rule 27** — no bold inside serif prose | Newsreader ships roman + italic and **nothing else**, so `font-bold` on `font-prose` is *synthesized* bold — the browser smearing an outline sideways. The type system's answers to "this matters" are italic, mono, or a doorway underline — each carries information. Bold carries only volume. |
| **Drift rule 16 gains a comment exemption** | It failed the build on a *comment* explaining why the colour dictionary is not a `<table>`. Rules 1, 4, 21, 23 and 24 already had the exemption: **a rule must let prose name the thing it bans**, or the code cannot explain itself. |
| **P2_FILES** += DeltaChip, TickerChip, Movers, Watchlist | See §3. The two Desk rows had never been watched. |
| **`StatFigure`'s delta `window` is REQUIRED** | It was optional, so ruling C2 ("there is no such thing as a delta without a period") was a comment rather than a rule. The type enforces it now. Typecheck found **four** callers missing one — all four were specimens and tests; **zero product code**. That is a fair summary of how a rule rots: universally honoured, never enforced. |

---

## 8. Local gate

| Check | Result |
|---|---|
| `typecheck` · `lint` | ✅ clean |
| `npm test` (app unit) | ✅ **692** (was 649: +43) |
| `uv run pytest` (pipeline) | ✅ 504 passed, 31 skipped locally (CI runs all) |
| `build` | ✅ |
| `check:routes` | ✅ 12 of 13 product routes cached |
| `check:bundles` | ✅ worst `/news` **196.9 KB** of a **200 KB hard ceiling** (was 195.1) |
| `check:fonts` | ✅ 243 KB of 560 |
| `check:drift` | ✅ **27 rules** (was 25) |
| `check:migrations` | ✅ the live database runs this repo's schema |
| `e2e:local` | see below |

### The bundle, budgeted deliberately rather than discovered at the gate

The kit is the first thing in this build to spend from `/news`'s headroom, and it spent **1.8 KB**:
195.1 → **196.9 KB**, against a **200 KB hard ceiling**. `/news/[cluster]` grew 2.6 KB (161.6 →
164.2).

The cost is real because `NewsFeed` is a **client** component and renders `NewsCard`, so the chip,
the delta and the emphasis renderer cross into the client bundle. `Term`/`TermProse` do **not** —
they are server-only (React `cache`), and a client-side glossary would have spent the rest.

**The baselines were NOT moved.** The script's own header names re-baselining as the quiet failure
mode, and the growth sits inside slack. **`/news` now has ~3.1 KB of headroom before a HARD ceiling,
and PD9's overlay still has to fit in it.** That is the number PD9 must plan against.

### Local e2e — two failures, both pre-existing local hazards, neither a PD5 regression

| Spec | Local | Diagnosis |
|---|---|---|
| `settings.spec.ts:29` (watchlist add/focus/remove) | flaky | **Reproduces on `pd-4`** with a fresh build, a fresh server and a clean database (pd-4: 1 pass / 1 fail; PD5: 2 pass / 1 fail — the same rate). ISR revalidation timing under a local `next start`. CI carries `retries: 1` and `pd-4` was green there. |
| `scans.spec.ts:44` (preset counts) | flaky | **Passes in isolation.** Fails only in a full local run — the documented shared-database hazard: the thin-night specs mutate the edition, and CI gives every leg its own Postgres. |

**A trap this phase walked into, and it cost an hour.** Playwright's `reuseExistingServer` is true
locally, so a server from an earlier run **stays bound to 3210** and keeps serving whichever build it
started with — while `npm run build` rewrites `.next` underneath it. Every measurement taken against
it is a lie, including a `pd-4` comparison that "passed" and shouldn't have. **`lsof -ti:3210 | xargs
kill -9` before any local A/B against another commit**, or the answer you get is about the server, not
the code.

---

## 9. VRT re-baselines — NAMED (21 baselines)

PD5 restyles the Desk and the news room, so the pixel oracle moved. **The triptych is the list of
what moved; the candidate is only where it was fetched from.** Twenty-one shots, each a diff I can
explain.

| Baseline | Legs | Diff | Why |
|---|---|---|---|
| `desk-{light,dark}` | desktop · phone · wide · mbp16 | 17,080px (phone +2px tall) | Movers' and Watchlist's symbols are bordered `TickerChip`s; their delta chips are the shared `DeltaChip`; the brief's lede gains **one** dotted doorway ("relative volume"). |
| `desk-thin-night` | mbp16 | 10,812px | The same chips on a thinned edition. Law 2 still holds — no reserved height. |
| `news-{light,dark}` | desktop · phone · wide · mbp16 | **+12px** (desktop/wide/mbp16), **+29px** (phone) | See below — the height is the cost of an honesty fix. |
| `news-filtered` · `news-week` | desktop · phone | +4px / +14–31px | Same chips, same cause. |
| `styleguide-{light,dark}` | desktop · phone | **+1815px / +2641px tall** | The new section 16, "Voice & emphasis". |

### The news room got TALLER, and that is an honesty fix paying its own way

A page that grows is normally a page to be suspicious of. This one grew for a reason worth the pixels.

The feed's old ticker chips read `+2.10% · 1D`, coloured green or red — and **that was the only
channel**. No triangle, no shape: direction encoded by hue alone, on the front page, since N5. That is
a **P7 violation** ("no colour-only signal anywhere") that had been sitting in a committed baseline,
passing every guard, for two phases.

`DeltaChip` brings the redundant glyph with it, so direction is now told three ways — **glyph, sign,
colour**. The chip is wider, so at 412px three chips wrap one-per-line instead of two: **+29px**.
Nothing truncates, nothing shatters. A colourblind reader now loses nothing.

(Also fixed in the same stroke: a `0.00%` move rendered **green**, because the old card asked
`ret1 >= 0`. `directionOf()` calls zero **flat** — ink, no triangle. Inventing a direction is
inventing a fact.)

### THREE BASELINES CHANGED WITHOUT FAILING — and they were NOT re-baselined

PD2's law: **"what moved" and "what failed" are not the same list.** A shot can change and still pass
(`maxDiffPixels: 600`). So every candidate was decoded and diffed against its committed baseline —
not just the failures. That found three more, on pages **PD5 never touched**:

| Shot | Changed by | Failed? |
|---|---|---|
| `scans-preset-{light,dark}` | ~56,000px | **No** |
| `login` | ~2,400px | **No** |
| `settings-light` (phone) | 161px | No (inside tolerance) |

**Looking at the pictures says why.** The **committed** scans-preset baseline has a **row highlighted
as though the mouse were resting on it**; the fresh photograph does not. The app is identical. **The
camera moved.**

That is PD4's law a third time — *is this the APP, or is this the CAMERA?* — and PD4's fix (parking
the mouse at (0,0) in `shoot()`) evidently did not reach every shot.

**They were left alone.** The oracle passes them, PD5 did not touch those surfaces, and re-baselining
from a candidate whose provenance is a second, differently-stated run would trade one unexplained
picture for another. Booked as **Q-PD5-2** for PD6, which is the phase that touches the scans room.

---
## 10. Questions raised

- **Q-PD5-1 [PD7]** — the briefing's verification record stores the **flags**, not the **cleared**
  list, so the Desk's brief cannot carry a `KeyFigure` honestly. Publishing `cleared` from
  `briefing/verify.py` is a small, contained pipeline change. **Marked assumption:** the brief ships
  with glossary doorways and *no* emphasized figures. Written into `BriefArticle.tsx` at the point of
  omission, so the next reader finds the reasoning where the gap is.

**Q-G4-1 is CLOSED** (§3): the delta chip carries `data-p2`.

---

## 11. Gate size

**27 drift rules · 83 VRT baselines · 25 e2e specs · 692 unit tests · 16 bundle baselines ·
14 manifest rooms · 4 oracle legs · tag run 8 m 54 s.**

`pd-5` = `4fadf4c` · rehearsal [29352544533](https://github.com/bishantt/myStockMarket/actions/runs/29352544533) green (4/4 legs) · tag run [29353153100](https://github.com/bishantt/myStockMarket/actions/runs/29353153100) green, **first try — eleven tags, eleven first-try greens.**

Growth over `pd-4`: **+2 drift rules** (26, 27 — both booked in §7), **+1 e2e spec**
(`voice.spec.ts`), **+43 unit tests** (the kit's contracts, the wrap atoms, E5's throw-in-dev, the
term budget, the alias matcher, and the two Desk rows joining the P2 ancestor walk). Every one of
them is a decision with a reason, not an accident.
