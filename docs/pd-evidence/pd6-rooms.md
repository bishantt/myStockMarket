# PD6 — the voice, the remaining rooms

**Phase:** POLISH-AND-DEPTH-PLAN Part 8.3 (second half) · **Tag:** `pd-6` (`026c9cf`) · **Date:** 2026-07-14
**Tag run:** [29367676440](https://github.com/bishantt/myStockMarket/actions/runs/29367676440) — green, four legs (desktop on rerun; see §9).

PD5 built the richness kit and landed it on the Desk and the news feed. PD6 was supposed to carry it
into the five rooms PD5 did not reach. It did — and on the way it found that the kit had **six** delta
chips, not four; that the app's one table had been showing a delta with no window on every phone since
the table was written; and that a 21px touch target had been live on the news story page since PD5,
passing the sweep every night because the sweep never rendered one.

Every one of those was invisible to a fully green test suite.

---

## 1. What PD6 actually found

### 1.1 There were SIX delta chips. PD5 hunted them and found four.

PD5's own law, written into `CLAUDE.md`: *a duplicated component is not a bug, it is a bug's HABITAT.*
It found four copies (StatFigure, Movers, Watchlist, NewsCard), collapsed them into
`components/DeltaChip.tsx`, and closed the file.

Two survived, and both of them were rendering on front-facing rooms every night:

| # | Where | Why the grep missed it |
|---|---|---|
| 5 | `components/DataTable.tsx:85` | a **private `function DeltaChip`** — it *shadowed the kit component's own name*, so a grep for "DeltaChip" found it and read it as the kit |
| 6 | `app/(desk)/scans/page.tsx:163` | an inline `<span>` with a template-literal className — no component name to grep for at all |

Neither carried PD4's wrap contract. Neither carried a window. Neither would ever have failed anything.

**A hand grep is not a guard.** Drift rule 28 is (§4).

### 1.2 The table showed a naked delta on every phone — and one of them actively misleads

This is the real bug of the phase.

`DataTable` answered *"over what period?"* in the **column header**. On a desktop that is honest: a
`<th>` sits above its cells and labels every one of them. **On a phone there is no `<th>`.** DataTable
draws a card list, and `line1` (priority-1 columns) is rendered with **no header beside it** — only
`line2` prints `{c.header}` next to its value.

Every signed-percent column in the app is priority 1 or 2:

| Column | Header (desktop only) | What a phone showed | What it actually means |
|---|---|---|---|
| `dist_52w_high` | "From 52w high" | `▼ −12.4%` | **12.4% below the 52-week high** |
| `gap_pct` | "Gap · open vs prior close" | `▲ +3.2%` | the overnight gap |
| `ret_1` | "1-day move" | `▲ +8.2%` | today's move |

The `dist_52w_high` row is the one that matters. A bare red `−12.4%` beside a symbol reads as *"down
12.4% today."* It is not. It is a name sitting near its highs. **The desktop told the truth, the phone
did not, and the committed baseline had photographed both and was defending them.** Same shape as PD5's
news-feed P7 violation, one phase later.

It reached the **news story page** too: `AffectedTable`'s `ret1` column is priority 1 and routed
through the table's private chip. **PD5 fixed the delta chip on the news feed and left the identical
bug on the news story page, one component over.**

**The fix is a TYPE, not a convention.** `lib/table.ts` makes `Column<Row>` a discriminated union:
`kind: "signedPercent"` does not compile without a `window`. It cannot be forgotten and cannot be
pointed at the wrong file. Written, it immediately named the three remaining call sites.

A second honesty fix rode along: the private chip tested `value >= 0`, so a `+0.00000%` change was
painted a green ▲. The kit routes through `directionOf`, which has a flat band. **A triangle on an
unchanged price is a direction the market did not have.**

### 1.3 The outcome chip: one promise, made three times, kept once

Three more copies — `TrackRecordTable` (hit/miss), `PaperLedger` (gain/loss), `PipelinePanel`
(succeeded/failed) — each carrying its own comment promising *"the WORD is the primary channel and the
colour is the redundant one; a hit and a miss render at the same size and the same weight."*

`PipelinePanel`'s went furthest: **"see the OutcomeChip on the track record, same rule."** The
duplication was *named in a comment* instead of removed.

**They had already drifted.** Two painted a neutral outcome with `bg-band-outer`; the third used
`bg-band` — a *solid* mid-purple — under `text-ink-2`, which is nearly black. It was the one chip in
the app whose text did not clear its own background. Nothing failed.

`components/OutcomeChip.tsx` is the one chip now, and **the equal-weight promise is a test**: it strips
every colour class off a hit and a miss and asserts the remainder is byte-identical. This product
publishes its misses. That claim survives exactly as long as a miss is as loud as a hit — and now it
survives *by construction*, not by three people remembering.

`neutral` is the honest third state: **an "unresolvable" signal is one the market never answered, not
one we got wrong.** Colouring it red would book an unanswered question as a wrong one.

### 1.4 The 21px door — and the sweep that was being kept by the shape of a fixture

A `door` is a **control**. Every control in this app is ≥44px on touch (constitution; the phone sweep
enforces it). `TickerChip` shipped at **34×21px**.

PD6 put doors on the paper ledger, the track record and the watchlist. **The sweep failed all three
instantly** — the guard doing exactly its job:

```
Error: controls below 44px tall on /track-record
+   "a.inline-flex — 34×21 — \"SPY\"",
+   "a.inline-flex — 34×21 — \"QQQ\"",
+   "a.inline-flex — 40×21 — \"SMCI\"",
```

**But the same 21px door had been live on the news story page since PD5, and the sweep passed it every
single night.**

The touch sweep visits **one** story — `nc-fed-hold`. Measured against the seeded database:

```sql
SELECT cluster_id, count(*) FROM catalyst_link WHERE cluster_id='nc-fed-hold';
-- (0 rows)
```

**Zero catalyst links.** So `AffectedTable` renders no rows on the only story page the sweep visits, so
there were no doors to measure, so the room reported clean. **The rule was being kept by the shape of a
fixture.** A guard only guards what it is pointed at — the fourth time this build has met that sentence.

**The fix is in the component, so it lands everywhere at once.** The `<Link>` is now an invisible
44px-tall hit area; the visual chip stays 21px inside it. The contract is pinned in
`TickerChip.test.tsx` — next to the component, not in a browser sweep that needs a fixture's
cooperation to see it.

### 1.5 …and the fix was half right, and only a SCREENSHOT said so

`min-h-11` gave the door a true 44px hit area. It then **added** to the `<td>`'s 12px of vertical
padding, and **every row in every table in the app went from 45px to 69px** — half again as tall, to
make room for a target that is invisible.

**Every guard passed.** Unit tests, the touch sweep (44px is all it asks for, and it got 44px),
bundles, drift, axe. It was caught by putting the candidate baseline next to the committed one and
looking at them:

| | committed | candidate (the bug) | after `-my-3` |
|---|---|---|---|
| track-record row pitch | 45px | **69px** | 46.3px |
| the door's hit box | 21px ❌ | 44px ✅ | 44px ✅ |

`-my-3` pulls the anchor's 44px border box back **into** the padding the cell had already reserved,
rather than stacking on top of it. Nothing is faked: `boundingBox()` — which is what the sweep *and*
the browser's own hit-testing read — still returns a true 44px. The target really is 44px; it simply
occupies space that was already there.

> This is the third phase running that the pictures found a bug the whole test suite could not.
> **It is the first time they have found one of mine.**

### 1.6 A chip is wider than the word it replaces — and fixing THAT broke the phone

The pictures found a second one, and then the fix for the second one found a third.

**The wrap.** The settings watchlist puts its symbol in a `w-24` (96px) column. That column was sized
for a *word*: "AAPL" as bare text is ~34px. As a bordered chip it is ~48px, and beside its `FOCUS` tag
that came to ~101px in a 96px column — so **the tag wrapped onto a line of its own** and pushed the
company name down. Nothing failed. No guard in this repo has an opinion about it. It just looked wrong,
because it *was* wrong. **PD4's law, in a new room: making a chip FIT is the LAYOUT's job, not the
chip's.** `w-32`.

**And `w-32` broke the phone.** Adding 32px to a row that was already tight made **`/settings` scroll
sideways by 16px at 360px** — the exact bug PD4 spent a whole phase killing. Three oracle legs went
green; the **phone** leg caught it, at 360, which is precisely the width PD4 widened the sweep to cover
because 412 was hiding things.

**My process error, and it is the lesson.** After the `w-32` change I verified *the specific thing I
had fixed* — the chip and the tag are on one line, measured, 0.0px apart — and did **not** re-run the
sweep for the room I had just changed. **A layout change is not verified by measuring the thing you
meant to change. Touch a room, re-run its sweeps. All of them.**

The fix is `flex-wrap` with `gap-y-2`: a fixed-width column plus two buttons cannot always fit a 328px
interior, and the honest answer to *"it does not fit"* is to **wrap**, never to overflow. At 412 there
is room and nothing wraps, so the baselines shot at that width are untouched; at 360 the controls drop
to a second line. Vertical space on a phone is cheap. Horizontal space is the one thing you cannot
borrow.

There is a bonus in it. Widening the column also stopped the *company names* wrapping — "NVIDIA
Corporation" had been breaking across two lines in the 96px column all along — which is why the
settings baseline came back **35px SHORTER** than the one it replaced.

The scans index's three-row **teaser** keeps a *label*, deliberately: those rows are 37px, and fifteen
of them would each have had to grow to hold a target — turning a glanceable recipe card into a list of
buttons. The file already declines a header row and a sort affordance for the same reason. *A preview
is a teaser, not a comparison instrument.*

---

## 2. The 8.1 eyeball table — walked, both themes

Screenshots: the `pd-6` CI baselines (`app/e2e/vrt.spec.ts-snapshots/`), desktop · phone · wide · mbp16.

| Room | First read (the hero) | Second read | Reference (quiet) | ✅ |
|---|---|---|---|---|
| /scans | preset title + tier | match counts | criteria lines | ✅ criteria now carry doorways; the title's `Term` still opens first, so the eye lands on the title |
| /scans/[preset] | the match table's symbol column | metric columns | provenance footer | ✅ symbol is a `TickerChip` label — the rail is the row's door, and the chip no longer competes with it |
| /paper | the ticket's cost mirror | ledger rows | bucket labels | ✅ **unchanged, and that is the finding** — see §3 |
| /track-record | the summary stat row | resolved-log rows (hits AND misses, equal weight) | filters | ✅ equal weight now *structural*, not promised |
| Academy | lesson/section serif titles | prose | kickers, read-ticks | ✅ doorways are ink + dotted, never accent — they do not compete with the serif titles |
| Login | the headline (Playfair italic) | the mark | licensing line | ✅ untouched (type rhythm verified; nothing for the kit here) |
| /settings | the section mastheads | the watchlist rows | pipeline explanations | ✅ the symbol is mono at last |

---

## 3. The 8.4 negative checklist — initialed

Run against every room PD6 touched, both themes.

| # | Rule | Verdict |
|---|---|---|
| 1 | No motion on any data at rest | ✅ `p2-motion.test.tsx` walks every `[data-p2]` to the document root. `OutcomeChip` carries `data-p2` **only when it holds a figure** — a bare verdict word is not a P2 figure, and marking it would point the walk at the pipeline panel's buttons, which it has no business freezing. |
| 2 | No new hue meanings (walk every coloured element against the 8.5 dictionary) | ✅ **Zero new hues.** `OutcomeChip` reuses the *existing* direction pair. The dictionary's Direction row is amended to name its second door and to widen its meaning honestly: *"a price moved up or down — **or a thing turned out well or badly**."* That is not a new meaning; it is the meaning that was already being used by three hand-rolled chips without being written down. |
| 3 | No bold inside Newsreader prose | ✅ drift rule 27. The Academy's `<strong>` maps to Inter (`font-semibold text-ink`), a weight that is loaded. |
| 4 | No icon-as-decoration | ✅ none added. |
| 5 | **No colour-only signal anywhere (P7)** | ✅ and this is the rule PD6 spent itself on. Every delta now carries glyph + sign + window. Every outcome carries **the word**. The `ok`/`degraded` source chips carry the word. |
| 6 | No emphasis on an unverified number (E5) | ✅ **`KeyFigure` was not used once in PD6.** No room PD6 touched has a pipeline-cleared allow-list, so no figure in them can be *proven* verified — and a figure that cannot be proven verified reads as plain prose, which claims nothing. The restraint is the rule, not a gap. (Q-PD5-1, PD7.) |
| 7 | No underline that is not a doorway | ✅ every dotted underline in the tree is a `Term`. |
| 8 | Masthead chrome stays muted | ✅ untouched. |
| 9 | Amber/danger consumer lists unchanged | ✅ unchanged. The one token *fix*: `ForecastResolver` used the chart's raw `text-down` for an error string at `text-2xs`; every other error in the app uses the darkened `-text` variant, which exists precisely for type at that size. |

### The restraint that /paper demanded, and what it cost to keep

The plan says /paper gets a **figures audit — typography only; NO new emphasis near money inputs.**
That was the hardest line to hold, because /paper has the app's most tempting surface: a cost mirror
with a big red number on it.

**What /paper got:** glossary doorways in the *standing prose that introduces the room* — where "the
spread" and "slippage" are being explained to a beginner — and the `TickerChip` treatment on its ledger
symbols.

**What /paper did NOT get, on purpose:** nothing near the ticket. The cost mirror's `−X% / yr drag` is
still a plain mono figure. It was *not* wrapped in `DeltaChip` — it is a **cost**, not a market move,
and it has no window; forcing it into a delta chip would have been the component lying about what kind
of fact it holds. It was not emphasized, not chipped, not decorated.

> A cost mirror is the one place in this app where a reader is about to spend money. **A ticket
> decorated with underlines and emphasized numerals is a ticket that is selling something.** The mirror
> already says the true and unwelcome thing in plain type, and plain type is exactly how it should say
> it.

---

## 4. The new guard: drift rule 28

**The direction wash has exactly two doors — `DeltaChip` and `OutcomeChip`.**

```js
match: (line, file) => /\bbg-(up|down)-wash\b/.test(code)
skip:  ["components/DeltaChip.tsx", "components/OutcomeChip.tsx"]
```

It matches the **wash**, not the text, and that is deliberate: `text-down-text` is legitimately used by
every error message in the app (a failed login, a rejected watchlist symbol). Those are not chips.

A direction-coloured **fill** has exactly one meaning in this product: *"this is a signed market fact."*
Any seventh hand-rolled chip must paint one in order to exist — and now fails the build the moment it
does, naming the door to use instead.

**Proven to fail before it was trusted** (LESSONS: *a guard that cannot fail is not a guard*): a
`bg-up-wash` planted in `Tag.tsx` redded rule 28; removing it returned the tree to 28/28 green.

---

## 5. Bundles — two baselines rebooked, and one of them was a hole in the gate

Measured A/B against a **rebuild of the tagged `pd-5` tree** (port 3210 cleared first — CLAUDE.md's own
warning):

| Route | `pd-5` | `pd-6` | Δ |
|---|---|---|---|
| /news | 196.9 | 197.3 | +0.4 |
| /scans | 186.6 | 187.0 | +0.4 |
| /settings | 153.5 | 154.7 | +1.2 |
| **/track-record** | 185.5 | **192.7** | **+7.2** |

**/track-record +7.2 KB is real and fully explained.** `TrackRecordTable` is a client component, so
giving its symbol column a `TickerChip` pulled the chip — and `DeltaChip` behind it — across the client
boundary for the first time; `TermProse` on the room's prose pulled in the glossary popover island.
Afterwards **/track-record and /paper request an identical chunk set apart from their own page chunk**:
it gained three shared chunks the neighbouring rooms were already carrying. Rebaselined 185.1 → 192.7
rather than left to ride the slack — at 2.4 KB of remaining headroom it would have redded the next
phase's build for an innocent edit, and *a slack allowance is for absorbing noise, not for hiding a
change somebody chose to make.*

**/settings' baseline was a 28 KB hole in the drift guard.** It reported 154.7 against a baseline of
181.7, which looked like a 27 KB saving. It was not: a rebuild of `pd-5` measures /settings at **153.5
KB**. The route has been ~28 KB lighter than its baseline for some time and nobody noticed, **because a
guard that only fires on GROWTH is silent about a number that is too generous.** /settings could have
grown 28 KB — the whole richness kit, twice — and the check would have printed a cheerful ✓.
Rebaselined 181.7 → 154.7. The drift half of that gate is working again.

Hard gates unaffected: **worst route 197.3 KB against the 200 KB ceiling.**

---

## 6. What was verified, and how

| Claim | Instrument |
|---|---|
| the window survives on the phone, where the header does not | `DataTable.test.tsx` — asserts `· 1D` appears **twice per row** (both layouts are in the DOM; CSS hides one, and either may be the one on screen) |
| a hit and a miss are identical but for hue | `OutcomeChip.test.tsx` — strips colour classes off both, compares the remainder |
| a lesson never opens a doorway onto itself | `prose.test.ts` (pure) **+** `e2e/voice.spec.ts` (real server render) |
| a term opens ONCE across a whole lesson | **e2e only** — `React.cache` memoises only inside a server render, so a unit test here would assert something about React's request scoping rather than about our rule |
| a `Term` never lands inside the author's own link | `Term.test.tsx` — a doorway is a **button**, and a button inside an anchor is invalid HTML the browser repairs by killing the link. The walk is one level deep, so the bug is *unreachable* rather than guarded. |
| the door is 44px | `TickerChip.test.tsx` — **deliberately not** left to the phone sweep, which demonstrably could not see it |
| the phone's touch rule holds on all five rooms | `hardening.spec.ts`, seeded Postgres, phone project — 30/30 |

**Local e2e run against a seeded Postgres** (docker; this Mac has neither by default): phone **222
passed**, desktop **207 passed / 2 failed**. Both failures investigated, neither is PD6's:

- `scans.spec.ts:44` — **passes in isolation.** The thin-night specs mutate the shared local database;
  CI gives every leg its own.
- `settings.spec.ts:29` — **fails on the tagged, green `pd-5` tree too**, on the same database, in the
  same environment, and fails *earlier* (a different assertion). Stashed, rebuilt, re-ran to confirm.
  The known local ISR-revalidation flake. Not a regression.

---

## 7. VRT re-baselines — named

**34 of 83 baselines re-shot** across four legs, in `36ea3f7`. Every one is named in that commit's
body. **`login-desktop` changed by 2,416px WITHOUT failing, and is deliberately NOT re-baked** — see
below.

| Shot family | Why it moved |
|---|---|
| `scans` (6) | criteria lines gain dotted doorways; symbols become chips; the sixth hand-rolled delta chip becomes the kit chip and gains its window. **+3px desktop / +7px phone** |
| `scans-preset` (8) | symbols become chips; **every delta gains its window** — `▼ -4.70%` is now `▼ -4.70% · 1D`, the C2 fix this phase exists for. AND the committed baseline was a **hover state** (below). **~128,000px desktop** |
| `paper` (6) | ledger symbols become chips (doors, 44px hit area). **No row grew** — the close form's 44px button already made those rows tall. **No resize** |
| `track-record` (6) | symbols become doors; hit/miss/na move onto the ONE `OutcomeChip` (`rounded-pill` → `rounded-chip`); the `na` chip's solid `bg-band` becomes `bg-band-outer` — the one chip in the app whose dark text did not clear its own background. **No resize** |
| `settings` (5) | the watchlist symbol goes from **UI-sans bold** to a mono chip; the column goes `w-24` → `w-32` to hold it; source/state/run chips move onto the kit shell. **−35px desktop / −37px phone — the page got SHORTER**, because at 96px the company NAMES had been wrapping too |
| `styleguide` (4) | the `OutcomeChip` specimen row is new; the colour dictionary's Direction row names its second door. **+158px desktop / +275px phone** |

**`login-desktop` — CHANGED (2,416px) BUT NOT RE-BAKED.** PD6 never touched `/login`, and this is not
PD6's. It is the brand gradient's **dither**: 2,199 of the 2,416 pixels sit in the 10–19 per-channel
band, and the rest are the antialiased edges of the "Sign in" glyphs. Cropped and compared side by
side, the two buttons are identical. The oracle passes it. Re-baselining from a candidate that only
re-rolls the dither would trade one unexplained picture for another. **It is also the live evidence for
Q-PD6-1** (below).

**Q-PD5-2 — the oracle's hover state — is CLOSED here.** The committed `scans-preset` baselines dated
from **PD2** (`5e6dc77`), *before* PD4 parked the mouse at (0,0) in `shoot()`. They were photographs of
a row highlighted as though the cursor were resting on it.

**And the mechanism is worth writing down, because it is not what PD5 assumed.** It was not that the
oracle *tolerated* the diff — `maxDiffPixels: 600` would never absorb ~56,000 pixels. Playwright's
`toHaveScreenshot` also takes a per-pixel **`threshold`** (default 0.2, YIQ colour distance), and it is
unset in `playwright.config.ts`. **A hover wash is a large-area, LOW-CONTRAST change: every one of
those pixels falls under the per-pixel threshold, so none of them count as "differing" and the pixel
budget is never even consulted.** The oracle was not tolerating the hover. **It was blind to it.**

PD6 touches the scans room, so the baseline is re-shot here and the stale camera state goes with it.
The blindness itself is booked as **Q-PD6-1** — a hue-shifted region of any size is currently invisible
to the oracle, and that is a property of the whole suite, not of one shot.

---

## 8. Questions raised

- **Q-PD6-1 [OPEN]** — the pixel oracle is **blind to a large-area, low-contrast change** (see §7).
  Lowering `threshold` would arm it, at the risk of turning font-antialiasing noise into failures that
  `maxDiffPixels: 600` then has to absorb. Not attempted in PD6: it is a change to the *instrument*
  every other baseline is measured by, and it belongs in a phase that can re-photograph all 83 shots
  and look at them. **PD10 (hardening) is the right home.**
- **Q-PD6-2 [OPEN, FYI]** — `e2e/hardening.spec.ts` sweeps exactly **one** news story, and the seeded
  fixture gives that story **zero** affected tickers. Every control inside `AffectedTable` is therefore
  unswept, and was — for a whole phase. PD6 fixed the bug *at the component* so this no longer hides a
  live defect, but the blind spot remains: **the sweep should visit a story that has an affected
  table.** PD8 rebuilds the story page and should point the sweep at a populated one.
- **Q-PD5-1 [PD7, unchanged]** — the briefing's gate stores its FLAGS, not its CLEARED list, so no
  figure on the Desk's brief can be *proven* verified. `KeyFigure` is therefore unused in PD6's rooms
  as well, for the same reason.

---

## 9. The endgame itself — four rehearsals, a standing rule, and a billing wall

**PD6's exit ran FOUR serial rehearsals of the full four-leg oracle where one or two would have done.**
It is worth recording honestly, because the reason is both the phase's best feature and its worst
habit.

Every red rehearsal, I diffed all 83 candidates against their committed baselines and **looked at the
pictures**. Every time, I found a real bug:

| # | What the pictures / the sweep showed | Fix |
|---|---|---|
| 1 | table rows had drifted **45px → 69px** | `-my-3` — the hit area overlaps the cell's padding |
| 2 | the watchlist tag **wrapped** to its own line | `w-24` → `w-32` |
| 3 | *(that fix)* `/settings` **scrolls sideways 16px at 360** | `flex-wrap` |
| 4 | *(that fix)* the row **wraps on the desktop** at 1366 | `w-24 md:w-32` — a responsive column |
| 5 | green, four legs | — |

**The looking was right and is not in question — not one of those had failed a single test.** The
**serializing** was the waste: roughly 50 minutes of round-trip waiting.

Two of them are the *same* mistake, and it is worth naming: **a fix verified at one width is not
verified.** #3 was verified at 360 (where it was broken) and not at 1366. #4 finally stated its
prediction *before* the run — *"exactly two shots move: settings-light-phone and settings-dark-phone;
desktop and wide must NOT move"* — and the rehearsal confirmed it exactly. **A prediction you can
falsify is worth more than a fix you can only hope about.**

> **STANDING RULE (user directive, 2026-07-14, permanent):** after a red rehearsal, download the
> failure artifacts **and** the candidates for **every** red leg, open every image, list **every**
> diff, fix them **all**, and dispatch **once**. Never one dispatch per fix.
> Written into `CLAUDE.md`'s VRT block and `LESSONS.md`.

### The tag run went red on a known flake, and the tag stayed put

`scans.spec.ts:44` failed on the desktop leg — `element(s) not found` for the count-bearing string
*"First 3 of 32 by scan order"*, alongside a `[WebServer] Error: Internal: NoFallbackError`. The
**identical SHA had gone green on all four legs twenty minutes earlier**, and this test is already
documented as a flake (it fails under contention and passes in isolation; the thin-night specs mutate
the edition and the /scans page is ISR-cached).

Per the Endgame: **the tag stays put; a suspected flake gets `gh run rerun --failed`, never a
re-point — but you read the failure first.** Read, reran, green.

### And then GitHub stopped starting jobs

Two commits from the tag, every job began "failing" in 2–3 seconds with **zero steps executed** and
empty logs. Not a flake, not the code. The repo was **private**, and on a private repo every Actions
minute is metered against a 2,000-minute monthly allowance. **The reason was not in the logs — it was
in the run's check-run annotation:**

> *"The job was not started because recent account payments have failed or your spending limit needs to
> be increased."*

**The diagnostic lesson is the reusable one: a job with ZERO STEPS did not run. Do not read its logs —
it has none. Read `gh api repos/<repo>/check-runs/<job-id>/annotations`.**

**Bishan made the repository PUBLIC** the same hour (Actions is unmetered on public repos), after a
clean scan of the full git history — only `.env.example` was ever committed, the vendored fonts are OFL
with their licenses beside them, and no workflow triggers on `pull_request`. Nothing needed scrubbing;
no secret needed rotating. **The login wall and every secrets-in-env rule are UNCHANGED: the wall
guards the app and its data, not the code.** Secret scanning and push protection were enabled the same
hour. Two other cost reforms discussed under the wall (leg-scoped rehearsals; tag-verifies-instead-of-
reruns) are **withdrawn** — at $0 they buy nothing and cost gate doctrine. All three are in
`DECISIONS.md`.

**The measured spend that caused it** (July 1–14, ~400 runs): ~300 **branch-push** runs, ~1,135
wall-minutes — **roughly two-thirds of the entire bill**, and nobody had ever looked at that number. 65
oracle dispatches, 456 wall-minutes. A green rehearsal bills ~25 min; a pixel-red one ~30–35, because
the auto-mint re-photographs all 83 shots. Estimated total **~2,900–3,200 billable minutes against a
2,000-minute allowance.** The wall was not one greedy phase — it was two weeks of a gate nobody had
costed, and **the expensive thing was the boring thing (every push), not the dramatic thing (the
oracle).**

---

## 10. Gate size at `pd-6`

**28 drift rules** (+1: the direction wash) · **83 VRT baselines** (34 re-shot, 0 added) · **25 e2e
specs** · **710 unit tests** (+18) · **16 bundle baselines** (2 rebooked) · **14 manifest rooms** ·
**4 oracle legs**.

The gate grew by **one drift rule and eighteen unit tests**, and every one of them exists because
something in this phase was found **by looking**, rather than by failing.
