<!-- APP-FEEL-PLAN.md — authored 2026-07-12. Companion to DEVELOPMENT-PLAN.md and
     UI-REDESIGN-PLAN.md. Typeset copy: docs/App-Feel-Plan.pdf. -->

# APP FEEL PLAN — "A Broadsheet, Not a Receipt"

*The structural re-founding of myStockMarket. The redesign (UI-REDESIGN-PLAN.md, tagged
`redesign-final`) gave the app the right look; this plan gives it the right FEEL: modular
rooms instead of receipt-paper scrolls, a real data table where the scans page prints chip
walls, a modern form where the paper desk demands typing, and navigation that is measured in
milliseconds instead of felt in seconds. It is written to be executed unattended, end to end,
with zero decisions left open.*

**Executor:** Claude Opus 4.8, unattended, same working rules as DEVELOPMENT-PLAN.md (TDD per
its §6.2, plain-English code and docs, session ritual, DECISIONS/LESSONS logging, phase gates).
**Authority order for this work:** honesty rules (Part 2 here; unchanged from
UI-REDESIGN-PLAN.md Part 2) > this plan on **structure, layout containers, navigation, and
performance** > UI-REDESIGN-PLAN.md on **look** (tokens, type, color, material, motion
vocabulary) > DEVELOPMENT-PLAN.md > judgment. Where this plan moves a module into a different
container, the container's paint still comes from the redesign plan's tokens. Where anything
here seems to collide with an honesty rule, the honesty rule wins and the collision gets
logged.
**Evidence:** every performance claim in this plan is measured, not guessed. The numbers come
from authenticated probes of the production deployment, the production build's route table,
and a file-level census of the working tree — all captured 2026-07-12 and reproduced in
Part 5. The diagnosis quotes the pinned framework's own bundled documentation
(`app/node_modules/next/dist/docs/`), not memory.
**Adversarial pass:** this plan was revised after a five-lens adversarial review —
executor-stall (12 findings, every working-tree cite verified, three of them blockers:
the empty-`generateStaticParams` requirement for runtime ISR, the ci.yml tag wiring, the
DB-less CI build), honesty-leakage in the new interaction patterns (10, one blocker: the
skeleton spec shimmering over money slots), mobile/iOS-WebKit (12, one blocker: the shelf
mask geometry), evidence-vs-assertion on performance (12, incl. a build artifact the first
draft's instrument named that does not exist), and traced-vs-designed layout reasoning (11,
the sharpest: the movers shelf contradicting the plan's own logged rejection). Fixes are
integrated inline, not appended; where a finding reversed an earlier call, the section says
so in place.

---

## Part 0 — Decisions I need from you: NONE

*The commissioning instruction was to collect any global, rippling choices here and pause.
After working the plan to the bottom, none rose to that bar: the four problems have
determinate answers once the honesty rules, the standing user decisions (D1–D4 of the
redesign), and the measurements are taken seriously. The build can start at F0 with no
further input. What follows is the honest version of "none": the seven calls that came
CLOSEST to needing you, each decided, logged, and vetoable at its named line. A veto of any
one of them changes only its own sections.*

| # | The call | What I chose | Why it did not need you | Veto hook |
|---|---|---|---|---|
| 0.1 | **Speed architecture** | Extend the Desk's proven ISR + on-demand revalidation to every read route, plus `loading.tsx` skeletons and streaming islands — NOT the Next 16 `cacheComponents` (PPR) migration | `cacheComponents` is an app-wide, all-at-once semantic migration (it removes the `revalidate`/`force-static` segment configs the Desk, login, and offline pages depend on) interacting untested with the delicate Serwist webpack build. The ISR pattern is already proven in this repo on `/` and hits the budgets (Part 5.4). Same shape as the Prisma-6-not-7 call. Backlogged with a named trigger (Appendix E-1). | DECISIONS.md 2026-07-12 (structural) |
| 0.2 | **Scans match access** | `/scans` becomes a summary index; each preset gets its own route `/scans/[preset]` carrying the full match set as a sortable, paginated data table | The commission itself ordered "pagination or virtualized scroll for the full match set (no dead '+N more')"; giving the full set its own route is the only shape that keeps the index scannable AND every match reachable. Route-map addition logged as structural. | DECISIONS.md 2026-07-12 (structural); QUESTIONS [FYI] |
| 0.3 | **Table engine** | Hand-rolled `lib/table.ts` (sort + paginate, ~120 lines, unit-tested) + a house `DataTable` component — no TanStack Table, no AG-Grid | The repo's grain: Recharts was rejected for hand-rolled SVG, a formatting lib for `lib/format`. Client-side sort of ≤500 bounded rows is trivial code; a dependency would buy ergonomics we then re-style away. AG-Grid-CLASS ergonomics, not AG-Grid. | DECISIONS.md 2026-07-12 (local) |
| 0.4 | **Horizontal swipe and the stillness rule** | User-driven scrolling is NOT "motion" under P2. Shelves (swipeable rails) are allowed to contain money figures; they may never autoplay, auto-advance, or animate. The jsdom ancestor guard still bans animated/transformed ancestors — a scroll container has neither. | This is an interpretation of the constitution, not a change to it: the page already scrolls vertically past every money figure, and nobody ever read that as the number moving. Logged as a structural interpretation with a [VETO?] flag. | QUESTIONS-FOR-BISHANT.md [VETO?] 2026-07-12 |
| 0.5 | **The Buy/Sell default** | The redesigned paper ticket pre-selects NO side. Side becomes a two-button segmented control with neither pressed; every other field keeps a sensible default. | Side is the decision; everything else is a parameter. A pre-selected "buy" is a quiet nudge on the one surface whose whole design language (cooling-off, cost mirror) exists to slow that decision down. Cost: one tap. This CHANGES current behavior (the old `<select>` defaulted to buy), so it carries its own [VETO?]. | QUESTIONS-FOR-BISHANT.md [VETO?] 2026-07-12 |
| 0.6 | **Database region** | Supabase stays in us-west-2. No migration. | The measured cross-region tax (~180–250ms per sequential query from iad1) is real but almost entirely amortized once routes are cached: the queries move to revalidation time, off the navigation path. Moving a live database is user-visible disruption for a residual win the budgets don't need. Revisit trigger logged (Appendix E-11). | DECISIONS.md 2026-07-12 (local) |
| 0.7 | **The signal → ticket doorway** | The expanded setup card gains a quiet "Practice on paper →" link carrying `signalViewedAt`, governed by a new ruling (M10) with four hard conditions | It wires the cooling-off interstitial's only real producer (today the mechanic is plumbed but unreachable — §1.3), and it is strictly MORE protective than the organic card → tab → ticket path, which exists now with no cooling-off at all. But it is also the app's first one-tap path from an evidence surface to an order ticket, so it gets the full ruling (M10), the strictest framing, and its own veto line — a bigger philosophy call than 0.5, and flagged accordingly. | QUESTIONS-FOR-BISHANT.md [VETO?] 2026-07-12 |

**Standing decisions that still bind and are NOT reopened:** D1 one theme app-wide · D2
bottom tab bar with the five rooms, Settings behind the gear · D3 wordmark · D4 one palette ·
tab switches re-enter a room at its head (redesign §4.2, "position is trust") · the Desk's
ritual ORDER 00→07→scorecard→sources is inviolable in DOM and on phone · drill depth ≤ 3.

---

## Part 1 — The diagnosis (measured, not felt)

*Four problems were named. Here is each one located in the working tree, with numbers. The
recon behind this part: a room-by-room layout inventory, a rendering/data-flow census, and
production probes, all run against commit `cc7ecbf` (post-`redesign-final`).*

### 1.1 The receipt problem, quantified

Every route below `desk:` (1366px) is a single vertical column. The entire app contains
**zero pagination**, **one** horizontally scrollable region (the track-record table's
`overflow-x-auto`), and **three** collapsible elements (setup cards' `<details>`, the journal
"Add a forecast", and nothing else). Everything else is stacked prose and stacked cards, read
by scrolling.

| Route | The stack today | Items in a real (non-seed) morning |
|---|---|---|
| `/` Desk | DeskHeader + **10 Surface cards** in ritual order (mastheads 00–07 + the un-numbered Evening scorecard + SourceStatus footer) | ≤5 brief items × 4 slots each · ≤15 calendar rows · ≤8 movers each with catalyst zone · watchlist **uncapped** · setup cards uncapped · journal form. On a phone: roughly 8–10 screens of scroll. |
| `/scans` | h1 + 5 preset cards | per card: criteria + count + up to **24** ticker chips + a dead "+N more" (`lib/scan-view.ts:10`) |
| `/paper` | header + M3 aside + form section + cost mirror + ledger | ledger uncapped, both lists |
| `/track-record` | header + 5-stat `<dl>` + full ledger table + forecasts | resolved log uncapped — the table just grows |
| `/academy` | header + **7 module cards** in one flat list + quote | 25 lesson rows |
| `/ticker/[symbol]` | back link + header + chart card + range ladder | fine as-is — already modular |

The Desk's two-column "broadsheet spread" exists but only engages at **1366px**
(`app/(desk)/page.tsx:111`); a 1024–1365px window — most laptop windows sharing a screen —
gets the same single phone column with more margin. Only the Desk has any desktop IA at all;
`/scans`, `/paper`, `/track-record`, `/academy`, `/settings` are one column at every width.

This is not a styling failure — R0–R6 made each card beautiful. It is an **information
architecture** failure: the app has exactly one layout primitive (the vertical stack of
Surfaces), so every room is forced to be a receipt regardless of what its content wants.

### 1.2 The scans dead-end

`/scans` renders each match as a bare mono chip (symbol only) and caps the wall at 24 chips
with "+ N more" — which is a **plain `<li>`, not a link, not a button**
(`app/(desk)/scans/page.tsx:130-134`). On the first live pipeline night there were **1,825
matches** across the five presets; almost all of them are unreachable from the page that
exists to show them.

The waste is the sharper finding: the page's query selects **only `presetKey` and `symbol`**
(`scans/page.tsx:34-39`) while every match row in the database already carries a
**34-key metrics JSON** — `rvol20`, `ret_1`, `gap_pct`, `dist_52w_high`, `rsi14`, `close`,
`dollar_volume`, `lottery_flag`, the full indicator snapshot (census in Appendix F; written by
`pipeline/publish.py:326`, identical key set for every preset). The "why did this match"
column data the commission asks for **needs no pipeline change at all** — only a fatter
`select` and a name join (`Instrument.name` exists, non-null; the join helper pattern already
exists at `lib/morning.ts:714-720`). `rank` is also already there: a per-preset ordinal of the
preset's own salience metric, 1 = strongest (`pipeline/scans.py:156-167`) — an honest,
pipeline-authored default order.

### 1.3 The paper form

Five fields, every one typed by hand (`components/desk/PaperEntryForm.tsx:57-102`): a free-text
symbol with no autocomplete (the `Instrument` table with names sits unused), two native
`<select>`s, a plain number field for quantity, and a required `referenceOpen` price the user
must find elsewhere and type. Layout is a `flex flex-wrap` row — fields drift out of alignment
at intermediate widths. The ledger is two `<ul>`s, not a table. Two deeper findings:

- **The whole paper surface bypasses `lib/format`** — page, form, and ledger call
  `.toFixed()` directly (e.g. `paper/page.tsx:112-125`, `PaperLedger.tsx:28,50-56`), against
  the "numbers render only via BaseRate and lib/format" convention. Signs are hand-built
  hyphens, not the true minus.
- **The cooling-off interstitial has no real producer.** It fires off a `?signalViewedAt=`
  URL param (`PaperEntryForm.tsx:36`, `lib/ledger.ts:43-47`) — and the only thing in the
  product that ever constructs that URL is the e2e test (`e2e/paper.spec.ts:31`). The
  protective mechanic is fully plumbed and effectively unreachable. F4 wires its intended
  producer (§4.3.6).

### 1.4 The sluggishness, measured

Production probes, 2026-07-12, authenticated with a minted session cookie (the
`lighthouse-check.mjs` method), 5 samples per route, medians, Vercel region `iad1`:

| Route | Build mode | `x-vercel-cache` | TTFB median (min–max) |
|---|---|---|---|
| `/` | ○ ISR, revalidate 600 | STALE (served instantly, revalidated behind) | **67ms** (50–236) |
| `/academy/glossary` | ○ static | HIT | **51ms** |
| `/login` | ○ static | HIT | **52ms** |
| `/scans` | ƒ force-dynamic | MISS ×5 | **895ms** (777–1490) |
| `/paper` | ƒ force-dynamic | MISS ×5 | **781ms** |
| `/track-record` | ƒ force-dynamic | MISS ×5 | **742ms** |
| `/ticker/SPY` | ƒ force-dynamic | MISS ×5 | **1237ms** (1117–1302) |
| `/settings` | ƒ force-dynamic | MISS ×5 | **611ms** |
| `/academy` | ƒ force-dynamic | MISS ×5 | **397ms** |
| `/academy/review` | ƒ force-dynamic | MISS ×5 | **407ms** |
| `/academy/reading-a-base-rate-sentence` | ƒ force-dynamic (+ request-time MDX compile) | MISS ×5 | **382ms** (first sample 1006ms — the cold-function tax made visible) |

Three structural facts multiply into that felt lag:

1. **Eight of the ten product routes are `force-dynamic`** (grep census: `scans/page.tsx:29`,
   `paper/page.tsx:21`, `settings/page.tsx:20`, `ticker/[symbol]/page.tsx:28`,
   `track-record/page.tsx:18`, `academy/page.tsx:28`, `academy/[slug]/page.tsx:20`,
   `academy/review/page.tsx:17`) — every tap re-renders on the server, and every server
   render pays cross-region query tax: Vercel runs in iad1 (probe header), Supabase lives in
   us-west-2 (DECISIONS 2026-07-10). The tax compounds **sequentially**: `/ticker/[symbol]`
   awaits **four Prisma queries one after another** (`instrument.findUnique` →
   `priceBar.findMany` → `volBand.findFirst` → `volBand.findMany`; `lib/ticker.ts:65,71` +
   `ticker/[symbol]/page.tsx:38-39`) — and lands at 1237ms. `/scans` and `/paper` chain two
   queries each. This is the same disease the Desk had before 2026-07-11, when its
   force-dynamic render cost 1.1s TTFB and ISR fixed it (DECISIONS, that date). The cure was
   proven and then never applied to the other eight rooms.
2. **There is not a single `loading.tsx` in the tree, and only one `<Suspense>` boundary**
   (the login form). The pinned framework's own docs state the consequence twice over. The
   prefetch table (`node_modules/next/dist/docs/01-app/02-guides/prefetching.md:24-31`):
   a dynamic page without `loading.js` is prefetched **"No"** — on tap there is nothing
   local to show, and "Server roundtrip on click: Yes." And the instant-navigation guide
   (`…/instant-navigation.md`): *"The page fetches uncached data with no local boundary, so
   the old page stays visible until the server finishes rendering, making the navigation
   feel unresponsive."* That sentence is this app's navigation, verbatim: tap a tab, the old
   room sits frozen for 400–1240ms, then the new room appears all at once.
3. **Two internal links are raw `<a>` tags** — the Desk's module 07 "sectors & scans" link
   (`app/(desk)/page.tsx:234`) and the scorecard's track-record link
   (`ScorecardPM.tsx:40`) — full document reloads: SW navigation, fonts, hydration, the
   works. Additionally `lightweight-charts` is statically imported into the `/ticker` client
   bundle (`components/ticker/CandleChart.tsx:4-10`) rather than dynamically loaded, and
   `/academy/[slug]` compiles its MDX at request time on every visit
   (`academy/[slug]/page.tsx:63`) despite all 25 slugs being known at build.

For contrast, the three cached routes measure 51–67ms — **a 6×–24× gap between the app's own
fast path and its slow path**. Nothing here needs new infrastructure; the fast path exists
and is simply unused.

### 1.5 Why it is this way (no villain)

The contract said so: DEVELOPMENT-PLAN.md §4.5 pinned "dynamic RSC everywhere (single user;
DB reads are cheap); **no ISR complexity in v1**" — written before there was measured
evidence, and already superseded for `/` on 2026-07-11 when the evidence arrived. And the
receipt IA is what a walking skeleton grows when every phase adds its module to the bottom of
a column. Both were right for buildout. Feel was never a phase. This plan is that phase, and
it formally amends §4.5 (Part 9).

---

## Part 2 — The honesty ledger under modular patterns

*The fourteen preserved rules of UI-REDESIGN-PLAN.md Part 2.2 survive verbatim — P1 through
P14 are restated in the table below only where a new pattern touches them. What is genuinely
new here is §2.2: nine rulings (M1–M9) that apply the constitution to interaction patterns it
has never met — sortable tables, disclosure, shelves, skeletons, caches, pagination. Every
ruling is enforced by a named guard, not by discipline (PATTERNS.md, "Enforce structurally").*

### 2.1 The fourteen preserved rules, where modularity touches them

| # | Rule (unchanged) | Consequence for this plan |
|---|---|---|
| P1 | No point predictions | Nothing in this plan draws a new chart. The Range Ladder and its locks are untouched. |
| P2 | No motion on probability/money visuals; no animated/transformed ancestor | Shelves and tables obey it structurally: native scrolling has no `animation`/`transform`, sort re-orders **instantly** (no FLIP, no easing — ruling M3), and the existing jsdom `data-p2` ancestor walk keeps running unmodified. |
| P4 | No bare percentages; BaseRate is the sole renderer | Scan tables show **filter metrics** (RVOL, % move, RSI), never base rates or win rates. Grep #10 already hunts stray "X of N" renders; it keeps running on every new component. |
| P5 | Misses first-class, log append-only | The track-record table gets sort/pagination, but hits and misses ride the SAME table with equal weight; no filter default hides misses (default filter = all). |
| P6 | No trending surfaces, no gamification, no urgency | Ruling M1 (tables are not leaderboards), M6 (no infinite scroll), M7 (no badges/dots/pull-to-refresh theater). |
| P8 | Movers need a catalyst or the noise line | The phone mover Shelf keeps the full catalyst zone **on every card** — the container changed, the anatomy did not (§4.1). |
| P11 | Amber reserved for two consumers | Skeletons, table chrome, pagination, shelves: none may use alert tokens. Grep #5 unchanged. |
| P12 | Mechanical voice; copy from `copy.ts`; timestamps everywhere | Every new durable string lands in Appendix B. Every module masthead keeps its as-of stamp — that stamp is what makes caching honest (ruling M5). |
| P13 | Position/length over angle/area | No progress rings, no gauges anywhere in the new kit. Pagination is words ("Page 2 of 7"), not a bar. |
| P14 | One hero figure per view | Unchanged; the new `/scans/[preset]` route's largest numeral is the match count at `--text-num-lg` max. |

### 2.2 New rulings — the constitution applied to new patterns

**M1 · A sortable scan table is not a leaderboard.** First, the sentence that separates the
two, because a future reviewer will need it: **P6 bans surfaces derived from crowd attention
and behavior flow — most-bought, most-viewed, trending — because they manufacture herding; a
scan is the reader's own standing filter over market data, with its recipe pinned, its
evidence grade tagged, no cross-preset aggregation, and no social input anywhere in it.**
That is why `/scans/unusual-volume` sorted by RVOL is legal while a "Most Active" feed is
not: the first restates a stated filter, the second imports the crowd. Within that line: the
default order of every scan table is the pipeline's own `rank` (the preset's stated salience
metric, strongest first — the order the pipeline already publishes and the current page
already uses). The UI names it **"scan order"** and never "top", "hottest", "best".
User-initiated sorting by any visible column is allowed. Forbidden, mechanically:
cross-preset ranking of any kind (the `/scans` index renders its five cards in the fixed
`SCAN_PRESETS` order and may never order them by match count); sorting by anything not shown
to the reader — on phones the sort `<select>` therefore always carries **"Scan order" as its
first and default option** (the way back to the honest default is never lost), and the rank
`#` column rides card-row line 2 so the order is visible, not implied; any copy implying
tomorrow (`copy.scans.tableNote`, Appendix B, renders as the DataTable `footnote` under
every table — its single home: "Matches are filter hits, not forecasts. Sorting re-orders
today's matches; it never ranks tomorrow."). The criteria clauses and the evidence-grade Tag
**render first on the table route and are never collapsible. They may scroll off-screen —
"visible" means present and unhidden, not fixed:** a sticky multi-line header card would
consume half a phone viewport and re-enter the iOS sticky traps this plan deliberately
avoids (Appendix E-12); the honesty message brackets the content instead — criteria at the
head, the footnote at the foot. Guard: `e2e/scans.spec.ts` asserts criteria + grade present
on the table route, the default-sort header labeled "scan order", the phone select's default
option, and the index card order.

**M2 · Disclosure must not hide what honesty needs visible.** The principle, stated so it
survives its own edge cases: **a caveat may collapse only atomically with the claim it
qualifies; a visible claim may never have a hidden caveat.** That one sentence reconciles
everything this plan does: a decay stamp collapses *with* its base rate inside a setup
card's `<details>` (claim and caveat travel together — the existing P4 pattern, unchanged),
while a source-degradation line may never collapse, because the summary "all reporting"
claim would stand on screen with its refutation hidden. Applied as a list: never collapsible
— source **degradation** lines (SourceStatus collapses only when every provider is ok; any
degraded provider forces the expanded state, and the component enforces it, not the caller),
**misses** wherever hits are shown, **gate flags**, **fired-signal markers** (a fired row
forces itself into the visible set while active), and **high-importance calendar rows**
(they are never behind the fold at all — §4.1). A Disclosure's summary row must always carry
the **count** of what it hides and the **as-of context** ("+ 12 more · through Jul 26") — a
`count` prop is required by type, so an uncounted disclosure does not compile. Reveal is
**instant** when the hidden subtree contains a `data-p2` node (the Disclosure defaults to
instant and opts INTO the fade only via an explicit `fade` prop, which the existing P2
ancestor test fails if misused).

**M3 · User scroll is not motion; nothing scrolls itself.** A Shelf (horizontal scroll-snap
rail) is a scroll container like the page itself: the reader moves the paper, the numbers
never move themselves. Allowed: `overflow-x` scrolling, `scroll-snap-type: x proximity`,
momentum — **and snap settle, which is the decaying tail of the user's own gesture.** The
line is initiation: motion with no initiating gesture — autoplay, programmatic `scrollTo`,
`scroll-behavior: smooth` — is the UI moving the paper itself, and is banned. Forbidden,
grepped (drift rule 15): `snap-mandatory` (fights iOS momentum and feels like the UI
grabbing the wheel), `scroll-behavior: smooth`, autoplay/auto-advance of any kind, and
entrance animations on shelf items. Sorting a table re-renders rows in their new order
**with no transition** — a FLIP-animated sort is a number in motion and is banned by the
existing P2 file grep plus an explicit "no transition on `<tbody>`/rows" note in
`DataTable`'s file comment. `prefers-reduced-motion` needs no new handling: shelves and
sorts never animate in the first place.

**M4 · Skeletons never impersonate numbers — and never shimmer where money will stand.**
The boundary: **a bone may stand for a CONTAINER (a masthead, a text run, a row, a card),
never for a figure or a figure-bearing visual.** Loading placeholders use the sanctioned
quiet shimmer (A8; `.shimmer` exists, `globals.css:324`) on container bones only. Any slot
that will hold a **probability or money figure renders the mono em-dash "—" as static text,
never a shimmering bar** — a bar where a number belongs reads as "a number is coming, place
your attention here," which is exactly the anticipation the stillness rule exists to kill.
And the **chart reservation is static geometry, never shimmer**: the candle chart is a money
visual by the constitution's own record (`CandleChart.tsx:27`: "the chart is a money visual,
and money visuals do not move"; redesign §3.8: "there is no draw-in in this system"), so a
1.6s loop occupying its 420px slot — in `loading.tsx` or as the code-split fallback inside a
settled page — is the violation with the largest surface in the app. `Skeleton block`
therefore renders as a still hairline box, no animation. This carries DEVELOPMENT-PLAN
§4.5's "quiet '—' placeholders" into the skeleton era. Guard: skeleton components take
`slot="figure"` explicitly; a unit test asserts `block` carries no shimmer class; the
styleguide's skeleton section shows all three kinds side by side; VRT locks them.

**M5 · A cached page is honest because it is stamped.** Serving a 10-minute-stale render is
not a lie in an app where **every module already prints its as-of timestamp** (P12) and the
data changes once a night. The full staleness stack, stated honestly: server render ≤ 600s
old, **plus the router's ~5-minute client cache on prefetched static routes, plus whatever
is already on screen** — so during the 8:25–8:41pm publish window two rooms in one session
CAN briefly disagree, and the as-of stamp on every module is the reconciliation for all
three layers. The enforcement: every cached route revalidates ≤ 600s; the nightly pipeline
busts every cached path on publish (the existing `/api/revalidate` extends its path list,
§5.3-P7); every user WRITE busts the routes it changes in the same server action. The
closure argument that keeps this true is stated so future writes inherit it: **the app's
entire mutation surface is the nightly publish plus the enumerated action files (§5.2
census), each of which busts its consumers — any new write path owes this census a
`revalidatePath` entry before it ships.** The offline ribbon precedent applies: staleness is
stated, never masked.

**M6 · Pagination states its position; nothing scrolls forever.** "Page 2 of 7 · 312
matches" in mono — position as words (P13). Infinite scroll is banned outright: it is the
engagement-feed pattern (P6), it breaks "every count is reachable" auditing, and it makes VRT
non-deterministic. The dead "+N more" is replaced by pagination precisely so that **every
match is reachable up to the stated 500-row cap; beyond it, the cut is named and sorting is
disabled** (§4.2.5 — sorting a silent subset would be an unlabeled ranking, the exact
species this part exists to kill). `e2e/scans.spec.ts` proves reachability by paging to the
last page and finding the final symbol; a 501-row fixture proves the cap line and the
sort lockout.

**M7 · Modularity earns no engagement mechanics.** No unread dots or badges on tabs or
disclosure summaries; no pull-to-refresh affordance (the data changes nightly — a refresh
spinner would be urgency theater); no "new!" markers; shelves get no peeking auto-nudge.
A count in a summary row is information; a colored dot on a tab is a Skinner box.

**M8 · A preview states its rule.** Wherever a module shows a subset (top-5 preview rows on
the scans index, next-3 calendar rows, focus watchlist), the cut is named in mechanical voice:
"First 5 of 41 by scan order", "Next 3 of 15". Never "highlights", never an unlabeled slice.
The copy keys live in Appendix B.

**M9 · Defaults never lean toward action.** In the paper ticket: quantity, bucket, and price
niceties keep helpful defaults — they are parameters. **Side has no default** (Part 0.5): the
one field that IS the decision starts unpressed, and submitting without it is a plain
validation message (`copy.paper.sideRequired`). The "use last close" chip fills the reference
price only when tapped, is labeled "reference, not a quote", and never auto-fills.

**M10 · A doorway from a signal to the ticket is legal only under four conditions — all
four.** The "Practice on paper →" link (Part 0.7, §4.3.6) sits at the moment of maximal
conviction, directly under a base rate, so it earns the strictest ruling in this part:
(1) the destination is the **paper** room only — this ruling can never be cited for a live
order surface; (2) the link **carries `signalViewedAt`** so the cooling-off interstitial can
fire — a doorway that forgot the timestamp would be strictly worse than the organic path;
(3) the destination ticket has **no side default** (M9) — a bullish card must never land on
a pre-set Buy; (4) the label is **mechanical and practice-framed, with no button styling**
("Practice on paper →", plain link, mover-footnote weight). And the boundary: doorways of
this kind are **forbidden from any surface without the full evidence anatomy** — mover rows
and scan-table rows are filter hits with no base rate, no CI, no weakener list, and get no
ticket link, ever. The defense on the merits, recorded: the organic path (card → tab →
ticket) exists today with NO cooling-off producer at all, so this parameterized doorway is
strictly more protective than the status quo it replaces; the mechanic it feeds is built,
tested, and currently unreachable (§1.3). Flagged [VETO?] in QUESTIONS (Part 0.7).

### 2.3 The line, restated

Same test as the redesign: a rule may bend if flipping it cannot mislead a beginner.
Containers, columns, page counts, and skeletons cannot lie; an unlabeled ranking, a hidden
miss, a shimmering money slot, or a self-scrolling shelf can. That is exactly where every
line above is drawn.

---

## Part 3 — The kit (new primitives; build once in F2, consume everywhere)

*Six primitives plus guards. Each spec names the file, the API, the accessibility contract,
the phone behavior, and the tests that must exist before the first consumer ships (TDD per
§6.2: the logic is test-first; the pixels are VRT-locked). All paint comes from existing
tokens — this plan mints NO new colors, radii, shadows, or durations. Two new CSS class
bodies (`.shelf-frame`/`.shelf`) land in `globals.css` because their edge-fade mask is a
gradient and gradients live only there (grep #2).*

**The composition rule (binds every primitive below):** the kit pieces are furniture, not
surfaces. Disclosure, Shelf, DataTable, and Skeleton paint **no Surface, border, or
background of their own** — they inherit the card they sit in and contribute hairlines only.
Surface nesting stays at the redesign's sanctioned depth: page → card → one tinted panel; a
DataTable never sits inside a tinted panel; a Surface never nests inside a Surface. The
styleguide §9 specimens render inside one plain Surface card to lock this, and a grep (no
`.surface` class inside the four kit files) keeps it true. Additionally every actionable kit
control — sort buttons, pagination buttons, Stepper − / +, SegmentedControl labels,
Disclosure summaries — carries `touch-action: manipulation` (one shared rule in
`globals.css` beside the kit classes): iOS keeps double-tap-to-zoom live because this app
rightly refuses `maximum-scale`, and the kit's core gestures — tapping a sort header twice,
stepping + + + — are literal double taps that would otherwise smart-zoom the page. Pinch
zoom is untouched; the accessibility stance in `app/layout.tsx:41-42` stands.

### 3.1 `components/Disclosure.tsx` — the honesty-preserving collapse

Native `<details>`/`<summary>` (zero JS, correct semantics, the setup-card precedent).

```ts
type DisclosureProps = {
  label: string;            // "All movers", "Closed trades"
  count: number;            // REQUIRED — the M2 contract; renders as "+ 12 more"
  context?: string;         // as-of / range context — "through Jul 26"
  forceOpen?: boolean;      // M2: degraded/alert content may not collapse; renders open, no summary toggle
  defaultOpen?: boolean;
  fade?: boolean;           // default false = instant reveal. NEVER set true over a data-p2 subtree
  children: React.ReactNode;
};
```

Summary row: ≥44px, full-width hit target, mono 2xs label + the count string in muted,
chevron via the existing `components/Chevron.tsx` (its rotation is sanctioned motion, lives
outside P2 files by design — LESSONS 2026-07-12). **The count grammar** (walked against every
consumer, not just lists): collapsed with `count > 0` → `+ {n} more · {context}`; collapsed
with `count === 0` → the `context` string alone ("none saved tonight" — a zero is state, not
an offer of more); open (via `defaultOpen` or the user) → the label renders as a plain
heading with `{n} · {context}` and no "more" (nothing on screen may claim to hide what it is
showing), plus the collapse affordance. The count span is one non-breaking unit
(`whitespace-nowrap` on the span alone) so at 320px it wraps below the label as a block
instead of shattering mid-phrase. Marker suppression ships BOTH ways — Tailwind `list-none`
on the summary AND one `summary::-webkit-details-marker { display: none }` rule in
`globals.css` beside the kit classes (older WebKit ignores `list-style` on summaries; the
shipped setup-card pattern is `list-none` only, `SetupCards.tsx:82` — this component closes
the gap). `fade` applies the 200ms content fade (§3.6 of the redesign) via a class the
existing `data-p2` ancestor test will flag if a P2 subtree sneaks under it. `forceOpen`
renders children directly with the label as a plain heading — used by SourceStatus when any
provider is degraded.
**Tests:** unit — all three count-grammar states render as specified; forceOpen ignores
toggling; a `data-p2` child under `fade` fails the existing ancestor test (negative control,
PATTERNS.md rule).

### 3.2 `components/Shelf.tsx` — the horizontal rail

For homogeneous, glanceable cards on phones. NOT a carousel: no dots, no arrows, no autoplay,
no looping (M3, M7).

```ts
type ShelfProps = {
  label: string;                 // aria-label for the group, e.g. "Macro figures"
  countLine: string;             // REQUIRED — the M8 line, e.g. copy.pulse.swipe. An
                                 // uncounted shelf does not compile (the M2 pattern,
                                 // applied to its sibling).
  children: React.ReactNode;     // items; each wraps in a snap-aligned li
};
```

Markup: `<div role="group" aria-label>` wrapping a **static** `<div class="shelf-frame">`
which wraps the scrolling `<ul class="shelf no-scrollbar">`. Two class bodies (new,
`globals.css`, beside `.app-wash`):
`.shelf-frame { mask-image: linear-gradient(90deg, transparent 0, black 16px, black
calc(100% - 16px), transparent 100%); }` — **the mask lives on the non-scrolling wrapper,
never on the scroller**: WebKit has a history of mis-compositing masks on scrolling boxes
(stale frames during momentum, the fade riding the content), and no `mask-image` exists
anywhere in this tree today to prove otherwise — the wrapper is pixel-identical in Chromium
and removes the iOS gamble. A comment in the sheet says why, so nobody "simplifies" it back.
`.shelf { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x proximity;
overscroll-behavior-x:contain; padding-inline:16px; scroll-padding-inline:16px; }` — the
`padding-inline` is load-bearing geometry: without it the mask veils the FIRST card's left
edge at rest and the LAST card's right edge at full scroll, permanently — on the pulse shelf
that last card is a `data-p2` money figure under a translucency ramp. With 16px padding the
resting first card and the fully-scrolled last card sit entirely inside the opaque band, and
the fade only ever covers the peeking next card, which is the affordance. Items set
`scroll-snap-align: start` ONLY (no `scroll-margin-inline` — it would double-count against
`scroll-padding` and shift the snap grid 32px after the first swipe) and a min width per
consumer. While touching `.no-scrollbar`, delete its obsolete `-webkit-overflow-scrolling:
touch` line (`globals.css:308`) — ignored on modern iOS and historically a stacking-context
bug source. Keyboard: items' focusables are reached in natural tab order; `scroll-margin` on
the focusables (not the snap items) pulls a focused item into view — no JS. Phone-only by
default: consumers render the Shelf `<md` and their existing layout ≥md (the Shelf is a
phone ergonomic, not a desktop toy).
**Tests:** unit — countLine renders (required by type); e2e (phone project) — shelf scrolls
horizontally, page does NOT (the existing no-horizontal-page-scroll assertion must keep
passing WITH the shelf present — the `.shelf` clips its own overflow); drift rule 15 greps
`snap-mandatory|scroll-behavior:\s*smooth` empty; VRT shoots the resting state and the mask
geometry is part of the locked pixels.

### 3.3 `lib/table.ts` + `components/DataTable.tsx` — the house table

DEVELOPMENT-PLAN §3.6 already names a DataTable that was never built. This builds it, to the
modern spec. Engine first, pixels second.

**`lib/table.ts` (pure, unit-tested, immutable):**

```ts
export type ColumnKind = "text" | "mono" | "price" | "signedPercent" | "percent" | "multiple" | "int" | "chip";
export type Column<Row> = {
  key: string;                  // metrics key or field name
  header: string;               // "RVOL", "From 52w high"
  kind: ColumnKind;             // routes formatting through lib/format — the only door
  align?: "left" | "right";     // numerals default right
  sortable?: boolean;           // default true
  priority: 1 | 2 | 3;          // phone card-rows: 1 = headline line, 2 = detail line, 3 = table-only
  value: (row: Row) => string | number | null;   // accessor; null renders "—"
};
export function sortRows<Row>(rows: Row[], col: Column<Row>, dir: "asc" | "desc"): Row[];  // stable, copies
export function paginate<Row>(rows: Row[], page: number, per?: number): { rows: Row[]; page: number; pages: number; total: number };  // per defaults 25, clamps page
```

Null metric values sort LAST in either direction (a null RVOL is "unknown", not "zero" — the
same honesty that made publish coerce NaN→null, DECISIONS 2026-07-11).

**`components/DataTable.tsx` (client component; rows arrive serialized from the server):**

- Semantic `<table>`; `<th scope="col">` each with a full-height sort button (≥44px,
  `touch-action: manipulation` — a second quick tap flips the direction, it must never
  smart-zoom), active column carries `aria-sort`, arrow glyph ▲/▼ in mono (visible
  affordance, no hover dependence). Default-sort header appends "· scan order" where the
  consumer says so (M1).
- Rows ≥44px; numerals right-aligned `font-mono` via `lib/format` per `ColumnKind` — the
  paper `.toFixed` disease does not enter the new kit (drift rule 12 seals it after F4).
  **Delta-chip cells carry `data-p2`** (they are money), which binds the whole file: row
  hover/active feedback is an **instant background change with NO `transition-*`/
  `duration-*` classes on any row ancestor** — the existing movers row survives the jsdom
  ancestor walk today only because its chips are unmarked; the honest kit marks them and
  therefore cannot copy the movers hover classes. This is why "no transitions anywhere in
  the file" is written, and F2's negative control proves it bites (a DataTable row given the
  movers hover classes over a `data-p2` chip must fail the walk).
- Row activation: optional `onRowPayload(row) → RailPayload` — the row becomes a
  `RailTrigger` (the existing level-2 drill, `components/rail/Rail.tsx:26-36` payload shape);
  no `onRowPayload`, no interactivity.
- Footer: `Page {p} of {t} · {n} rows` in mono + Prev/Next secondary buttons (44px). Client
  state only — never `searchParams` (URL-state pagination would fragment the route's ISR
  cache per page visited and re-introduce server latency per click; the data is already
  on the client, M6 keeps the position honest).
- **Phone (<md): card-rows, not a squeezed grid.** The same component renders a `<ul>`:
  line 1 = priority-1 columns (symbol mono + primary metric chip), line 2 = priority-2
  columns as label:value pairs in mono 2xs; priority-3 stays desktop-only. Sort control
  becomes a native `<select>` at `--text-input-touch` — the OS picker is the best touch
  ergonomic and costs zero dependencies — whose **first and default option is always "Scan
  order"** (M1: the honest default is never more than one flick away, and the current order
  is always one the reader can name). Decision logged: no pinned-column horizontal scroll on
  phone — `position: sticky` inside `overflow-x` scrollers is exactly the iOS behavior the
  redesign already had to hedge on (§4.2 sticky note), and a two-line card-row reads better
  one-handed than a 7-column grid peeked through a 390px keyhole (Appendix E-5).
- No sticky `<thead>` (25-row pages fit ~1.5 viewports; iOS sticky-in-overflow is the known
  hazard); no zebra stripes (§3.6 DP); no row entrance/sort transitions (M3).

**Tests:** `lib/table.test.ts` — stable sort both dirs, null-last both dirs, paginate clamps
+ math on 0/1/exact-multiple row counts; `DataTable.test.tsx` — aria-sort moves with clicks,
"—" for null, formats route through lib/format (spy), card-row split by priority; e2e in
consumers (Part 4).

### 3.4 The form kit — `SegmentedControl`, `Stepper`, `Combobox`

**`components/form/SegmentedControl.tsx`** — a labeled `role="radiogroup"` of ≥44px pill
segments (hairline container, `--radius-control`; active = accent-soft wash + accent-deep
text — chrome semantics, not data). Props: `name`, `options: {value,label,detail?}[]`,
`defaultValue?: string` (omit for the no-default side control, M9), `required?`. Uses real
`<input type="radio">` under the hood so plain form posts keep working (the paper actions are
`useActionState` form posts — no fetch layer arrives with this plan).

**`components/form/Stepper.tsx`** — `<input type="number" inputmode="numeric">` flanked by
− / + buttons (44×44, secondary style, `touch-action: manipulation`), plus an optional row
of preset chips (e.g. 10 · 25 · 50 · 100) that SET the value (never submit). At min/max the
corresponding button renders `disabled` + `aria-disabled` (a silently no-op'ing − on touch
reads as a broken control — there is no hover state to explain it); the icon-only buttons
carry `aria-label="Decrease quantity"` / `"Increase quantity"`. The input stays the source
of truth (typing wins). 16px on touch per the standing input rule.

**`components/form/Combobox.tsx`** — the WAI-ARIA APG combobox+listbox pattern, hand-styled
(Radix ships no combobox; zero new dependencies): `role="combobox"` input with
`aria-expanded/aria-controls/aria-activedescendant`, a floating `role="listbox"` as an L4
mini-panel — with the L4 blur wrapped on an inner element per the redesign's own iOS
corner-clip rule (§3.4 there; Safari does not clip `backdrop-filter` to `border-radius`, and
this is a NEW L4 consumer that must inherit the wrapper shape). Keyboard: ArrowUp/Down +
Enter + Escape. **Dismissal is `pointerdown`-based, not click-based** — iOS Safari does not
synthesize `click` on non-interactive page regions, so a document-level click-outside
listener simply never fires there; the component listens on `pointerdown` (capture) AND
closes on input `blur`, guarded by a pointerdown-on-listbox flag so option taps register
before the blur-close. Data source: a server action `searchInstruments(q)` (new,
`lib/instruments.ts`) — `db.instrument.findMany({ where: { isActive: true, OR: [{symbol:
{startsWith: q, mode: "insensitive"}}, {name: {contains: q, mode: "insensitive"}}] },
take: 5, select: {symbol, name} })`, debounced 150ms, min 1 char — **both clauses
case-insensitive** (`autocapitalize` only defaults the shift key; a lowercased "sm" must
still find SMCI) and **capped at 5**: the listbox's max height is `min(40dvh, 5 × 44px)`
with `overflow-y: auto; overscroll-behavior: contain`, because the iOS keyboard + QuickType
leave roughly 300–360px below a focused mid-page input — an 8-row × 44px list is guaranteed
to run under the keyboard with no cue and nothing to scroll it into view. The input carries
`autocapitalize="characters" autocorrect="off" spellcheck={false}` (iOS otherwise "corrects"
tickers into words), 16px on touch. Selecting fills the input with the SYMBOL; free typing
remains legal (the zod boundary still validates — an unknown symbol is allowed on a paper
ticket, same as today).
**Tests:** unit — keyboard path (down/down/enter selects the 2nd), escape closes,
activedescendant tracks, pointerdown-outside closes, option pointerdown beats blur-close;
action — `searchInstruments` filters isActive, caps at 5, and matches a lowercase query
(mock db); e2e — type "sm", pick SMCI, field holds SMCI.

### 3.5 `components/Skeleton.tsx` + the `loading.tsx` set

`Skeleton` variants: `masthead` (index+title bone + hairline), `text` (n bars at 60–90%
widths), `block` (fixed-height reservation for a chart or figure-bearing visual — **still
geometry: a hairline box on the bone tint with NO shimmer**, per M4's container/figure
boundary), `figure` (**renders the static mono "—"**, never shimmers — M4). `masthead` and
`text` bones use existing tokens (`--color-faint` at low alpha via a `.skeleton-bone` class
added beside `.shimmer`) and MAY shimmer; `block` and `figure` never do, and a unit test
asserts it. Every skeleton composes inside real `Surface` cards so the loading page has the
same bones as the loaded page; soft-navigation layout shift is asserted by the nav-timing
spec (§5.5 — Lighthouse only ever hard-loads `/`, so it cannot see skeleton CLS; the budget
lives where the skeletons do).

One `loading.tsx` per remaining-dynamic route and per ISR route (they also serve as the
prefetched instant state during the first-ever visit and any revalidation miss). Each mirrors
its room's real structure — Appendix C lists the exact composition per route so Opus builds
them without taste calls. VRT: skeletons are locked via a dedicated styleguide section
(deterministic), not by racing real loads.

### 3.6 Styleguide + tests + drift rules v3

`/styleguide` gains section 9 "Tables & disclosure" (DataTable specimen with sorted state,
card-row phone specimen, Disclosure open/closed, Shelf with 4 specimen cards, Skeleton set,
form kit row) — the VRT anchor for the whole kit, shot in both themes both viewports.

`scripts/check-drift.mjs` grows 11 → **16 rules** (v3). Each lands in the phase that makes
its tree clean, so the gate is never red on arrival:

| # | Rule | Kind | Lands |
|---|---|---|---|
| 12 | `.toFixed(` outside `lib/format.ts` + `components/ticker/CandleChart.tsx` (chart lib's own axis needs) — everything formats through the one door | HONESTY-adjacent | F4 (after the paper sweep) |
| 13 | Route-mode gate: `scripts/check-routes.mjs` (new, §5.4-B1) — every product route static/ISR, or on the in-script allowlist with a written reason; every allowlisted dynamic route MUST have a `loading.tsx` | perf-constitution | F1 |
| 14 | No internal `<a href="/` (use `next/link`); no `prefetch={false}` | perf | F1 (with the two `<a>` fixes) |
| 15 | `snap-mandatory`, `scroll-behavior: smooth`, `autoplay` — empty everywhere | M3 | F2 |
| 16 | `<table` outside `components/DataTable.tsx` + the track-record page until F6 converts it (skip-listed, then unlisted) — one table, one set of ergonomics | consistency | F2 |

(The numbering continues the existing script's `RULES` array; rule text goes in the same
plain-English style the script already uses. The jsdom `data-p2` ancestor test and grep #10
run unchanged over all new components — they are the honesty floor for everything above.)

---

## Part 4 — Room by room: the modular IA

*For every room: what the reader needs AT A GLANCE (always visible, bounded), ON DEMAND (one
tap — disclosure, shelf position, rail, or page), and IN THE ARCHIVE (its own route). Phone
first, desktop second, honesty anchors called out. The Desk's ritual ORDER is untouchable —
modularity compresses within modules, never reorders them. File touch lists close each room.*

### 4.1 The Desk (`/`) — the ritual, chunked

The Desk is a reading ritual, not a dashboard — the fix is not to shuffle it into widgets but
to bound each station's body with its depth one tap away. **Stations are triaged BEFORE
containers are chosen, and the triage is the principle** (it is what separates a shelf from a
disclosure from hands-off): **READ nightly** — 02 Brief, 04 Movers (the reason IS the
content; DEVELOPMENT-PLAN §2.1 names the station "movers with reason"), the Scorecard line.
**WRITE** — the journal. **GLANCE** — 00 Pipeline, 01 Pulse figures, 03 Calendar (with its
warning duty), 05 Watchlist, 07, Sources. **ON-DEMAND** — 06 Setup cards (already built
that way). Shelves are for GLANCE stations only; READ stations stay vertical — swiping is
skimming, and the read stations exist to be read (the same reasoning that rejected a
setup-card shelf, Appendix E-6, applied consistently).

**Phone (<md), station by station (ritual order preserved exactly):**

| Station | Today | Becomes |
|---|---|---|
| DeskHeader | 3 lines | unchanged |
| 00 Pipeline | full card | unchanged (1 stat — already minimal) |
| 01 Macro pulse | hero + 6 stacked figure cells + breadth | hero S&P (unchanged, the one 48px numeral) + **figures Shelf** in the order **VIX · 10-yr · Nasdaq · Dow · small-caps proxy** (~150px min-width snap cards, each keeping its delta chip + proxy chip where it has one). The order is reasoned, not traced: in a shelf, position is visibility — the hero directly above already states the equity tape, so the off-screen tail holds its echoes (Dow, the proxy), and the two figures carrying INDEPENDENT information (the risk gauges) ride first. Count line (required by type): `copy.pulse.swipe` ("5 figures — swipe"). **Breadth strip stays fixed below the shelf, full-width** — it is the module's summary anchor: the one line that claims to describe the whole market must not be hideable by scroll position (the M2 instinct, applied to a scroll container). |
| 02 Daily brief | full article | **unchanged — the brief never truncates, never collapses.** It is the product's evening heart; a briefing behind a "read more" is a briefing unread. (Held-state skeleton from the redesign stays.) |
| 03 Calendar | up to 15 rows | The visible set is cut on the axis the station exists to serve — TIME, not an item count: **every row dated within the next two trading sessions (minimum 3 rows, cap 6 for routine rows) PLUS every high-importance row in the window, always** — a CPI or FOMC row is never behind a fold, period (M2: the calendar's job is warning, and a summary line that names one warning while hiding a second implies completeness it doesn't have — so no "includes…" append exists; the high rows are simply visible). The `Disclosure(label=copy.disclosure.calendar, count=rest, context="through {last date}")` hides only routine rows beyond the cut. M8 line: `copy.calendar.next`. Empty state unchanged (the signature quiet card). Guard: seed places TWO high rows beyond the nominal 3-row cut; the F5 e2e asserts both visible while collapsed. |
| 04 Movers | up to 8 tall rows | **Vertical rows at every width — a READ station never rides a shelf** (the triage above; an earlier draft put movers on a Shelf and the adversarial pass caught it contradicting Appendix E-6's own reasoning: a mover card carries a headline and a source link — reading content — and a source link on a pan axis puts a fresh touch-target fix back in harm's way). Phone: **first 3 rows by pipeline rank always visible** + `Disclosure(label=copy.disclosure.movers, count=n−3, context="by rank")`, M8 line "First 3 of 8 by rank". Full row anatomy unchanged (P8). RVOL footnote stays under the module. |
| 05 Watchlist | uncapped rows | **focus rows (≤3) always visible** + `Disclosure(label=copy.disclosure.watchlist, count=rest)` for the non-focus names. **Fired-signal rule, specced against the DATA because the marker has no producer yet** (verified: no alert-token consumer exists in `Watchlist.tsx` today — the redesign specs the marker, nothing renders it): a row whose symbol has an unresolved fired signal forces itself into the visible set and decrements the disclosure count, and the visible set MAY exceed the focus cap of 3 while markers are active — the marker exists to be seen (M2's list). F5 builds the forcing logic and the slot; it stays dormant until the marker's producer lands, and PROGRESS.md notes the dependency so it is never mistaken for dead code. |
| 06 Setup cards | `<details>` stack | unchanged — this module was born modular; it is the pattern the rest of the app is catching up to. |
| 07 Sectors & scans | paragraph + link | one-line module: match-count figure ("214 matches across 5 scans") + link to `/scans` — becomes a real glance instead of prose. (Count comes from the morning loader's existing scan read — one `count` query added to `getMorning`, amortized by ISR.) |
| Evening scorecard | card + always-open journal form | scorecard line unchanged; the **journal textarea moves behind a Disclosure** whose summary is the prompt line itself ("What did you act on…") — the tallest always-empty region on the phone Desk becomes one labeled tap. `count` = the number of entries saved tonight (0 or 1), context "saved tonight" — so the collapsed row still reports state honestly (M2). The textarea and the forecast `<details>` render on expand; friction to write is unchanged — one tap. |
| Source status | full per-provider card | one-line summary ("6 sources · all reporting · ran 6:37–8:41pm ET", `copy.sources.allOk`) + `Disclosure(label=copy.disclosure.sources, …)` for the per-provider rows (the label is "Per-provider detail" — the summary already carries the count, so the count string reads as state, not a stutter) + FRED attribution ALWAYS visible below the summary (license, never collapsible). **Any degraded provider ⇒ `forceOpen` — degradation may not collapse (M2).** |

Net effect (seeded morning, 390px): from ~8–10 screens to **~5 screens**, with nothing
removed — everything demoted is one labeled tap away, and everything honesty-critical
(timestamps, noise lines, degradations, high-importance calendar rows, the brief, the misses
link) is as visible as before or more. The F5 gate records the page-height number so the
claim is a measurement, not an adjective.

**Desktop (≥lg, 1024px):** the broadsheet spread engages earlier — `lg:` two-column
(`minmax(0,1fr) 320px`), widening to the current 340px rail at `desk:` (1366px). The fit
math, so the VRT shot VERIFIES a layout instead of discovering one: gutters stay `px-4`
(16px) until `desk:` — the 32px step-up would spend width exactly where it is scarce — so at
1024px the main column measures 1024 − 32 − 320 − 24 (gap) = **648px** (~600px card
interior). The Brief holds (65ch Newsreader ≈ 540px). **MoversRow gets a two-line variant
below `desk:`** (it was styled against the 1366px main column of ~884px interior and will
not fit one-line at 600px): line 1 = symbol · name · delta chip · RVOL; line 2 = catalyst
chip + headline + source link at full width — headlines get ~560px, no clamp. The rail's
compact calendar and watchlist rows must hold at ~272px interior; the F5 1024×768 VRT row is
the lock, and this paragraph is what it verifies. Same grid-area mapping as today (Pulse +
Pipeline span, Brief/Movers/Setups/07/Scorecard main, Calendar/Watchlist/Sources rail); DOM
order stays ritual; the `grid-flow-row-dense` note from `page.tsx:112-119` carries over.
Shelves do NOT render ≥md (pulse returns to its grid) — desktop has the width; horizontal
scroll there is a toy. Disclosures render default-OPEN ≥lg for Calendar and Watchlist (the
rail exists to keep reference matter glanceable; collapsing it on a 27-inch screen saves
nothing) and stay collapsed for closed-ledger-class content everywhere.

**The md band (768–1023px — iPad portrait is exactly 768):** the ritual column persists,
**capped at `max-w-[720px] mx-auto`** (a 990px-wide card is a stretched receipt — the
diagnosis this plan opened with, one band lower), with the ≥md station bodies (rows and
grids, no shelves) and the PHONE disclosure defaults (collapsed — with no rail column, an
open 15-row calendar inline would rebuild the receipt). Two-column genuinely cannot reach
below 1024 by arithmetic: at 768px, main = 768 − 32 − 280 (minimum useful rail) − 24 ≈
432px, under the Brief's ~540px measure floor. This paragraph exists because
DEVELOPMENT-PLAN §3.8 still says "768–1365 = two-column stack" — that clause is amended with
this plan (Part 9), so no successor reads two constitutions.

**Touch list:** `app/(desk)/page.tsx` (module bodies, grid breakpoints, the `<a>`→`Link`
fix), `MacroPulse.tsx` (shelf split + figure order), `Movers.tsx` (phone disclosure split +
the sub-`desk:` two-line row variant), `Watchlist.tsx` (focus split + fired-forcing rule),
`CalendarTimeline.tsx` (temporal cut + always-visible high rows), `ScorecardPM.tsx`/
`JournalPrompt.tsx` (disclosure), `SourceStatusFooter.tsx` (summary + forceOpen),
`lib/morning.ts` (scan count), plus Disclosure/Shelf consumers' tests and `desk.spec.ts`
updates (assert: ritual order intact, BOTH seeded high-importance calendar rows visible
while collapsed, degraded source auto-expands, journal reachable in one tap, movers
disclosure counts).

### 4.2 Scans (`/scans` + NEW `/scans/[preset]`) — the recipe index and the match table

**The index (`/scans`).** Five preset **summary cards** — 2-up grid ≥lg (the odd fifth card
keeps its column width in flow; a full-width last card would read as emphasis and
rsi-extreme has earned none), stacked on phone, **always in the fixed `SCAN_PRESETS` order —
never by match count** (M1: count-ordering the index would be the cross-preset ranking the
ruling bans). Each card: serif title + grade/FOLKLORE Tag (pinned, as today) · the criteria
clauses in the numbered recipe list — all clauses, always, and the reason is stated
honestly: **the recipes ARE the comparison content** (five fixed presets differ by recipe,
count, and grade — nothing else) and the anti-black-box recipe card is the page's identity
(redesign §5.2); no honesty RULE pins them here (M1 binds the table route), the design does
· the match count as the card's mono figure ("41 matches today" + as-of stamp) · a
**preview of the first 3 rows in the card-row grammar at every width** — no `<thead>`, no
sort affordance: a preview is a teaser, not a comparison instrument (five header-bearing
tables on one index would out-receipt the chip walls they replace), headed by the M8 line
`copy.scans.preview` ("First 3 of 41 by scan order") · footer link **"All 41 matches →"** to
the preset route. Zero matches: recipe + "0 matches today" + no preview (unchanged
information-not-apology stance). The dead "+N more" is deleted with its `SCAN_MATCH_LIMIT`
(`lib/scan-view.ts` retires; its `capMatches` tests retire with it — noted so the deletion
is deliberate, not drift).

**The match table (`/scans/[preset]`).** `generateStaticParams` returns the five preset
keys, **`export const dynamicParams = false`** (a closed set: `/scans/garbage` 404s instead
of rendering an invented empty page into the ISR cache — `e2e/scans.spec.ts` asserts the
404); ISR like everything else (§5.3). Page anatomy, top to bottom:

1. Return link "← All scans".
2. **Header card (the honesty spine, first in flow — never collapsible, never sticky, per
   M1's present-and-unhidden reading):** serif preset title + grade/FOLKLORE Tag + the full
   numbered criteria clauses + count figure + as-of stamp. (`copy.scans.tableNote` renders
   once, as the DataTable's `footnote` under the table — its single home; the honesty
   message brackets the content, head and foot.)
3. **The DataTable.** Loader: one query —
   `scanResult.findMany({ where: { runDate: latest, presetKey }, orderBy: { rank: "asc" },
   select: { symbol: true, rank: true, metrics: true } })` + the `instrumentNames` join
   (pattern at `lib/morning.ts:714-720`). A pure builder `lib/scan-table.ts` (new,
   unit-tested) maps rows → the preset's column set (Appendix F): symbol (mono, priority 1),
   name (priority 2, truncated), the 2–3 **trigger metrics that restate this preset's
   criteria** (priority 1–2), close (`price`, priority 2), and supporting context (priority
   3). `lottery_flag: true` renders a neutral `Tag` "lottery risk" on the row (§1.5-8's flag,
   finally visible). All formatting through `lib/format` by `ColumnKind`. Default sort:
   `rank asc`, header-labeled "scan order". Pagination 25/page client-side.
4. Row tap → **the rail** (level-2 drill): `RailProvider` wraps the scans routes' pages (the
   provider moves from being Desk-page-only to a shared position in each consumer page —
   NOT the layout, so the Desk keeps its current mount), payload from the row
   (`changePct: signedPercent(ret_1)`, `direction: directionOf(ret_1)`,
   `rvol: multiple(rvol20)`, `note:` the lottery line when flagged). "Open full view →"
   inside the rail goes to `/ticker/[symbol]` as everywhere else. Drill depth stays ≤3.
   **Landing here also fixes a live sheet defect this plan would otherwise multiply across
   every table row:** the shipped bottom sheet ignores the bottom safe area
   (`RailDialog.tsx:39-41` has no `env(safe-area-inset-bottom)` despite the redesign §7.2
   contract requiring it), so its bottom "Open full view →" link sits in the iPhone
   home-indicator band where taps become swipe-to-home. F3 adds
   `pb-[max(1.25rem,env(safe-area-inset-bottom))]` to the sheet content and `min-h-11` to
   the full-view link, with an e2e assertion (the tab bar's inset-padding assertion pattern,
   reused) in the new rail journey.
5. **Payload honesty & cap:** the route serializes the preset's full match set (bounded
   fields only — symbol, name, rank + the preset's ≤6 metric keys, NOT the whole 34-key
   JSON) to the client table. Hard cap **500 rows**; beyond it the page renders
   `copy.scans.cap` AND **column sorting is disabled — rank order only** (M6: sorting a
   silent 500-row slice by, say, 1-day move would present "the biggest movers among the most
   salient" as "the biggest movers", an unlabeled subset ranking; above the cap the table
   shows the stated first-500 and nothing pretends otherwise). A stated cut (M8) that is
   itself an honest editorial: post-narrowing, a preset matching >500 of ~6k names has
   stopped filtering. Payload math at the cap: ~500 × ~80 bytes ≈ 40KB serialized —
   acceptable on a route-level ISR document; typical nights are far below it. Guard: a
   501-row unit fixture asserts the cap line and the sort lockout.
6. **Phone:** card-rows per §3.3 (line 1: symbol + primary metric chip; line 2: name +
   secondary metrics), native-select sort, same pagination. No horizontal scroll.

**Seeds (F0):** the current seed gives unusual-volume 3 rows and every other preset zero —
useless for a table. New deterministic seed rows: unusual-volume **32** (pagination: 2
pages; graded rvol/ret values; 2 rows `lottery_flag: true`; two null-metric rows to lock
null-last sorting), near-52w-high 9, gap-3plus 7, golden-cross-fresh 4, rsi-extreme 0 (keeps
the empty state honest on the index and locks it in VRT). **Two pins, because the Desk eats
this table** (`lib/morning.ts:607-611` feeds Movers from unusual-volume, `take: 8`): ranks
1–3 stay **byte-identical** to today's SMCI/GME/PLTR rows — `desk.spec.ts` asserts their
exact formatted values and the seeded briefing's prose references those movers — and the
null-metric + lottery rows sit at **rank ≥ 9** so they never enter the movers module.
Growing the seed changes the seeded pixels of `/`, `/scans`, and `/paper` regardless, so F0
ends with a `vrt-baselines` CI run + commit (the vrt-update skill flow), with the expected
diffs named in the commit body: Desk (8 mover rows instead of 3), scans (new index), paper
(6 ledger rows).

**Tests:** unit — `lib/scan-table.ts` column mapping per preset, null → "—"; e2e (new
`e2e/scans.spec.ts`) — criteria+grade visible on both routes; default sort labeled scan
order; click RVOL header → aria-sort + first row changes accordingly (seeded values known);
paginate to last page → the seeded final symbol is present (**the "+N-more grave is
reachable" assertion**); row opens rail; phone project: card-rows render, sort select works,
no horizontal page scroll; lottery chip visible on its seeded row. VRT rows in Part 8.

### 4.3 Paper (`/paper`) — a ticket, not a questionnaire

The room keeps its protective order — form → cost mirror → ledger, M3 aside on top — and its
three mechanics (cost mirror, cooling-off, half-Kelly) exactly. What changes is the input
grammar and alignment.

1. **The ticket (`PaperEntryForm` rebuild).** A single `Surface` card capped at the page's
   standing `max-w-[62ch]` measure (≈540px — "full-width fields" means within that measure,
   never a 1200px combobox on a wide window), one column **at every width**, stacked mono
   2xs labels, alignment from a shared field grid (label / control / hint, `gap-1`, fields
   separated by `gap-4`; the current flex-wrap row dies). One column is reasoned, not
   defaulted — it supersedes the redesign §5.3's "2-col ≥md" (Part 9 pointer): (a) five
   fields don't amortize a grid — a 2-col split saves two rows and buys a zigzag tab order
   and pairing ambiguity; (b) inside a 540px measure, two columns yield ~250px controls —
   too narrow for the combobox and the stepper-with-presets; (c) the old form's misalignment
   complaint was CAUSED by multi-field rows reflowing at intermediate widths — a single
   column cannot misalign; (d) one decision per row is the room's pace, the same design
   language as the cooling-off. The fields:
   - **Symbol** — `Combobox` (§3.4), searches active instruments by symbol prefix or name,
     mono value, autocap/no-autocorrect. Prefill from `?symbol=` keeps working via
     `useSearchParams` (see performance note below).
   - **Side** — `SegmentedControl`, options "Buy" / "Sell (short)", **no default** (M9);
     required with plain message on miss.
   - **Bucket** — `SegmentedControl`, "Large / mid · 20bp" / "Small · 60bp", default
     large-mid (parameter, keeps default).
   - **Quantity** — `Stepper`, default 10, min 1, presets 10 · 25 · 50 · 100,
     `inputmode="numeric"`.
   - **Reference open** — `<input type="number" step="0.01" inputmode="decimal">` with the
     one new nicety: when the symbol has served bars, a chip renders beneath —
     `copy.paper.lastClose` ("Use last close ({date}) · {price} — a reference, not a
     quote") — tap to fill, never auto-filled (M9). **The date is load-bearing, not
     decoration** (P12/M5): a served bar can be days old around a holiday or a data gap, and
     "last close" without its date is an implicit freshness claim the reader cannot check —
     the disclaimer covers liveness, the date covers age; they are different lies to
     prevent. `lastServedClose(symbol)` therefore returns `{ close, date }` (null for the
     ~99% of names with no served bars; the chip simply doesn't render). The field keeps its
     role: the applied COST is the lesson, not price accuracy (DECISIONS 2026-07-11).
   - Submit: primary gradient button "Place paper trade", full-width on phone.
   - The zod action schemas are UNCHANGED except `side` losing its implicit default via the
     form (schema already required it); action files untouched apart from the F1 caching
     note. Server-enforced validation messages unchanged.
2. **Cooling-off interstitial:** same trigger, same copy key, same two-button inversion
   ("Sit with it" primary — the §4.1 exception). Presentation upgrades to the redesign's own
   §4.3 spec (solid surface, its own scrim at the overlay z-ladder, focus moved to the
   dialog on open and returned on dismiss, Escape = "Sit with it"). It remains a plain
   conditional div with `role="alertdialog"` + a small focus effect — no new dependency.
3. **Sizing helper:** same math, same manual inputs (it is a teaching device wired to the
   user's reading of a card's CI lower bound — deliberately NOT auto-wired to any base
   rate), restyled into the ticket's field grammar with `inputmode` keypads; output line
   unchanged.
4. **Cost mirror:** content and receipt treatment unchanged (it just got its R4 styling) —
   but every figure re-routes through `lib/format` in the **format sweep**: the whole paper
   surface (page, form, ledger) drops `.toFixed` for `price`/`signedPercent`/`percent`, true
   minus included; then drift rule 12 lands and seals the door.
5. **Ledger:** becomes two `DataTable`s. Open trades: Symbol · Side · Qty · Fill (`price`) ·
   Cost (bp) · opened-at + a per-row "Close…" that expands an inline row form (the existing
   `exitReferenceOpen` field + button, now aligned). Closed trades: inside a
   `Disclosure(label=copy.paper.closedTrades, count, context="all time")`, columns Symbol ·
   Side · Qty · Fill → Exit · **Realized P&L as an outcome-style chip** (up/down-text wash +
   sign + the word "gain"/"loss" — P7 redundancy), closed-at. Card-row priorities: Symbol +
   P&L chip line 1; Side/Qty/Fill→Exit line 2; dates desktop-only. Realized P&L stays ≤
   `--text-num-lg` (P&L is never a hero — §3.10-2). Pagination at 25 when it ever grows past
   it.
6. **The doorway that makes cooling-off real (governed by ruling M10, flagged [VETO?] —
   Part 0.7):** the expanded setup card (`SetupCards.tsx`) gains one quiet link in its
   footer row — `copy.paper.practiceDoorway` ("Practice on paper →") to
   `/paper?symbol={sym}&signalViewedAt={now ISO}` — the exact producer the interstitial's
   plumbing has been waiting for (§1.3). All four M10 conditions hold by construction here:
   paper room, timestamp carried, no side default at the destination, mechanical unstyled
   label beside the existing Learn doorway. And M10's boundary bites here too: mover rows
   and scan-table rows get NO such link — they are filter hits without the evidence anatomy.
   Now the protective mechanic actually fires for a reader who walks card → ticket inside
   30 minutes; the e2e stops being the only caller.

**Phone:** all controls ≥44px, inputs 16px (standing rule — the sweep list in redesign §4.1
already names this form), numeric keypads via `inputmode`, tab bar hides on focus (existing).
**Tests:** existing unit suites untouched (`paper.test.ts`, `ledger.test.ts` — the math does
not change); component tests for the new controls (§3.4); `paper.spec.ts` extends — combobox
pick → symbol filled; side unselected → submit blocked with message; stepper preset sets
quantity; cooling-off journey unchanged PLUS the new doorway journey (open seeded setup card
→ tap Practice on paper → land with symbol prefilled → immediate submit trips the
interstitial); ledger close journey unchanged against the new table.

### 4.4 Track record (`/track-record`)

Already half-modular (stat `<dl>`). Changes: the stats become the standard 2-up (phone) /
5-up (lg) stat tiles they visually already are; the resolved log becomes a `DataTable`
(columns Fired · Symbol · Pattern · Horizon · **Outcome chip** · Resolved; default sort
Resolved desc — recency of RESOLUTION is neutral bookkeeping, not a leaderboard; filter chips
all/hit/miss/tier stay, default **all** (P5); pagination 50/page — the misses stay in the
same table at the same weight, and the e2e asserts a miss is visible on page 1 of the seeded
set). **Card-row priorities, pinned because this is the accountability surface:** Symbol +
Outcome chip on line 1 — the outcome is never below the fold of its own row (P5); Pattern,
Horizon, Resolved on line 2; Fired desktop-only. Phone card-rows kill the app's last
`overflow-x-auto` table. Forecasts section: resolver buttons to ≥44px, calibration scatter
untouched (`data-p2`).
**Tests:** track-record e2e additions — filter=miss shows misses; default shows both; the
seeded miss appears without interaction. Drift rule 16 unlists the page.

### 4.5 Ticker (`/ticker/[symbol]`)

Content IA is already right (R4). This plan only makes it fast (§5.3: parallelized loader,
ISR, chart code-split) and gives it `loading.tsx` (Appendix C — reserves the 420px chart
block so CLS holds). No layout change; the Range Ladder and its locks untouched.

### 4.6 Academy (`/academy`, lesson, review, glossary)

The reading room stays a reading room — restraint here is deliberate (it is the app's calm
pole). Home: module cards go 2-up ≥lg (7 cards — the odd seventh keeps its column width in
flow, same rule as the scans index; flat list on phone as today) and each card's kicker line
gains `copy.academy.readCount` ("{read} of {n} read") in mono (position-not-progress-bar,
the review queue's own precedent). Lesson/review/glossary: no IA change (review is already
the most modular surface in the app; glossary already 2-col). All four routes join the
caching scheme (§5.3), lessons additionally via `generateStaticParams` over the 25 manifest
slugs.
**Tests:** academy e2e unchanged plus the read-count line on the seeded read lesson.

### 4.7 Settings (`/settings`)

Three sections become three explicit Surface cards (Watchlist · Add · Theme — they already
read that way); the watchlist manager rows get the ≥44px sweep. The real change is invisible:
the theme control stops reading `cookies()` on the server (the page's only dynamic forcer,
`settings/page.tsx:35`) and reads `document.documentElement.dataset.theme` client-side (the
inline pre-paint script already stamps it before hydration — same source of truth, zero
flash), which frees the route for ISR (§5.3).

### 4.8 What deliberately does not change

The bottom tab bar and its five rooms (D2 stands) · room re-entry at top (position is trust)
· the Desk ritual order · the brief, whole · every honesty component (`BaseRate`, dot arrays,
Range Ladder, calibration scatter, breadth strip) · the drill ladder (glance → rail → route)
· the login, offline, and styleguide shells · the palette, tokens, and motion vocabulary of
the redesign · the Serwist service worker (its `cacheOnNavigation` + poison guard already
cover every route; caching MORE routes server-side changes nothing in its contract).

---

## Part 5 — Performance: the diagnosed plan

*Diagnosis in Part 1.4; this part is the treatment, the budgets, and the instruments that
keep both honest. The prescription follows the repo's own hardest-won lesson (LESSONS,
R6): measure before you cut, and never trust a budget that measures the wrong thing.*

### 5.1 What the evidence says, in one paragraph

Navigation feels slow because seven routes re-render on the server per tap
(force-dynamic), each render pays 400–1240ms of sequential cross-region queries, and the
client has nothing local to paint while it waits (no `loading.tsx`, no prefetch for dynamic
routes — the framework documents both, §1.4). The app's own cached routes answer in 51–67ms.
The whole fix is to move every route onto the fast path that already exists, give the rare
justified wait a skeleton, and wire the caches to the events that actually change data (one
nightly publish + a handful of user writes, all of which already call `revalidatePath`).

### 5.2 Why caching is CORRECT here, not just fast

This is a single-user app whose data changes once a night (plus the user's own writes).
There is no second user to leak data to, no personalization to fragment the cache, and no
cookie read left in any page render (the theme moved to a pre-paint script in R2; settings
loses its last `cookies()` in F1). Nearly every write path already busts the paths it
changes (census: `paper-actions.ts:58,108` → `/paper`; `settings/actions.ts:109-110` → `/`
+ `/settings`; `journal-actions.ts:47` → `/` and `:75` → `/track-record` on RESOLUTION;
`review-actions.ts:81` → `/academy/review`; `setup-card-actions.ts:39` → `/`;
`theme-actions.ts:20` → `/` layout-wide) — the read-your-writes contract is one revalidate
call per action. The census found exactly two holes — the lesson-read beacon and forecast
CREATION (which busts `/` but not the `/track-record` page that renders open forecasts) —
and P-7 closes both WITH the conversions, not after.
The honesty contract is ruling M5: stamps everywhere, staleness ≤ 600s, busts on publish and
write. `next start` (the e2e web server) supports on-demand ISR the same way Vercel does, and
CI seeds the database BEFORE the build (`ci.yml` e2e job: migrate → seed → Playwright
webServer runs `npm run build && npm run start`, `playwright.config.ts:70-78`) — so
prerenders capture the seeded morning and the entire existing e2e/VRT machinery keeps
working without modification. Both jobs of the nightly pipeline already POST
`/api/revalidate` after publishing; extending that route's path list is the only pipeline-
facing change, and it is app-side.

### 5.3 The fix set (F1 executes all of it)

**P-1 · Route conversions.** The table is the spec; "ISR 600" means
`export const revalidate = 600` replacing `export const dynamic = "force-dynamic"`.

| Route | Becomes | What must move first | Busted by |
|---|---|---|---|
| `/scans` | ISR 600 | nothing (no cookies, no searchParams) | nightly publish |
| `/scans/[preset]` (new) | ISR 600 + `generateStaticParams` (5 keys) + `dynamicParams = false` | born cached | nightly publish |
| `/track-record` | ISR 600 | nothing | publish · journal/forecast actions (P-7 closes a gap here) |
| `/ticker/[symbol]` | ISR 600, on-demand per symbol — **with `export async function generateStaticParams() { return [] }`**: the pinned docs are explicit that without it "the route will be dynamically rendered" and that an empty array is what enables runtime ISR (`generate-static-params.md:57,302`). An earlier draft omitted this and would have shipped a route that never caches; the adversarial pass caught it against the docs. First visit renders once (`notFound()` on unknown symbols already exists), then cached. | loader parallelization (P-2) | nightly publish |
| `/academy` | ISR 600 | nothing | lesson-read beacon (NEW revalidate — see P-7) |
| `/academy/[slug]` | ISR 600 + `generateStaticParams` (25 manifest slugs — build-time MDX compile, killing the per-visit `compileMDX` cost) | nothing | lesson-read beacon |
| `/academy/review` | ISR 600 | nothing | review actions (already) |
| `/paper` | ISR 600 | `searchParams` consumption moves client-side: `PaperEntryForm` reads `?symbol`/`?signalViewedAt` via `useSearchParams()` inside a `<Suspense>` island — the exact pattern `/login` already uses (`login/page.tsx:48-50`). The cooling-off computation already runs client-side; it just changes where the strings come from. | paper actions (already) |
| `/settings` | ISR 600 | the theme control's `cookies()` read moves client-side (§4.7) | settings actions (already) |
| `/` | unchanged (ISR 600) | — | — |

**The build-time consequence, handled with the conversions:** once these routes prerender,
their loaders run at `next build` — and the ci.yml `app` job builds on every push with NO
database. The house pattern already answers this (LESSONS 2026-07-12: the one uncaught
layout query "had got away with it for six phases purely because the route happened to be
dynamic"): **every converted page's reads get the same catch-and-degrade wrapping the rest
of the tree uses.** The bare ones, named: `paper/page.tsx:33` (`paperTrade.findMany`),
`scans/page.tsx:32-39`, `academy/page.tsx:34`, `academy/review/page.tsx:24`, plus the new
scans-preset loader; each degrades to its existing honest empty state. A DB-less CI build
then produces empty-but-valid prerenders (compile check only, as today), the e2e job's
seed-before-build produces seeded ones, and Vercel's production build — which has
`DATABASE_URL` — produces real ones. F1 also rewrites the now-false ci.yml comment ("env
values are read at request time, not at build time") to say exactly this.

**P-2 · Query de-waterfalling.** `/ticker`: the volBand pair has a REAL data dependency
(`findMany` filters on `findFirst`'s latest runDate — they cannot simply share a
`Promise.all`; an earlier draft claimed "1 effective hop" and the adversarial pass ran the
arithmetic against it). The fix is one query: `volBand.findMany({ where: { symbol },
orderBy: { runDate: "desc" }, take: 12 })`, then keep the rows sharing the newest runDate in
JS (≤3 horizons per run; the pipeline replaces bands nightly, so 12 rows covers it with
slack). That plus `Promise.all(instrument, priceBars, volBands)` makes the whole loader ONE
parallel stage — 4 sequential hops → 1, ~1237ms → ~400ms class at revalidation time.
`/scans[…]`: the `findFirst(runDate)` + `findMany` chain stays sequential at revalidation
time only; leave as-is, logged (don't optimize what the cache already hides —
measure-before-cut). The `(desk)/layout.tsx` watchlist read stays: it renders into each
cached route's payload and busts with the layout-scoped revalidate (watchlist actions
upgrade to `revalidatePath("/", "layout")` so the palette index stays fresh everywhere —
one-line change, logged).

**P-3 · `loading.tsx`, gated by an F0 measurement.** The bundled docs carry a genuine
tension the plan refuses to paper over: one table says a static page prefetches "Yes, full
route" (`prefetching.md:26-31`), the other says "With loading.js → Layout to first loading
boundary, TTL off" (`:52-57`) — and which row governs a STATIC route that also has
`loading.js` decides whether adding skeletons everywhere would DOWNGRADE full prefetch to
boundary-only. So **F0 measures it** (one ISR route with `loading.tsx`, one without;
inspect the prefetch payloads in devtools/network; record the verdict in the evidence
file), and F1 follows the measured branch: **branch A** (full prefetch survives) —
`loading.tsx` on every route per Appendix C; **branch B** (prefetch downgrades) —
`loading.tsx` ONLY on the on-demand `[param]` families (`/ticker`, first-visit misses) and
any allowlisted dynamic route, where a skeleton beats a frozen page; the listed ISR routes
rely on full prefetch instead, which needs no skeleton because there is no wait. Drift rule
13's loading-required clause applies to allowlisted-dynamic routes in either branch.

**P-4 · Suspense islands.** Exactly two: the paper form's `useSearchParams` island (P-1) and
the login form (exists). No other page needs runtime data outside its cached render. (If a
future surface does, the island pattern is now demonstrated twice in-tree.)

**P-5 · Link hygiene.** The two raw `<a>`s become `next/link` (`page.tsx:234`,
`ScorecardPM.tsx:40`). No `prefetch` props anywhere: defaults are correct once routes are
static (full prefetch + 5-min client cache per the bundled table). Drift rule 14 keeps both
facts true.

**P-6 · Code splitting.** `CandleChart` (the only `lightweight-charts` importer) loads via
`next/dynamic` with `{ ssr: false }` and a `Skeleton block` fallback matching the reserved
420px — the pattern `RailDialog` already uses (`Rail.tsx:11`). `/ticker`'s client JS drops
by roughly the chart library's weight; B4 measures it rather than asserting it.

**P-7 · Revalidation wiring.** `app/api/revalidate/route.ts` extends from
`revalidatePath("/")` to the full cached surface:
`["/", "/scans", "/track-record", "/academy", "/academy/review", "/settings", "/paper"]`
via `revalidatePath(p)` each, plus `revalidatePath("/scans/[preset]", "page")` and
`revalidatePath("/ticker/[symbol]", "page")` and `revalidatePath("/academy/[slug]",
"page")` for the dynamic families (the `type: "page"` form busts every rendered instance).
Pipeline side: NO change — both jobs already POST this route (`job_a.py:221`,
`job_b.py:262`). TWO gaps closed while here, both invisible today only because the routes
re-render every request: (a) `lesson-actions.ts` (the read beacon) gains
`revalidatePath("/academy")` + `revalidatePath("/academy/[slug]", "page")` +
`revalidatePath("/paper")` (the M3 gate reads lesson progress on `/paper` and lesson pages);
(b) **`writeJournalEntry` gains `revalidatePath("/track-record")` when a forecast is
attached** — the census line "journal-actions → / + /track-record" conflated two actions:
the CREATE path (`journal-actions.ts:26-52`) busts only `/`, while `/track-record` renders
open forecasts, so post-conversion a freshly filed forecast would not appear there for up to
600s. The adversarial pass caught the census error; F1's e2e additions include
forecast-filed-then-visible-on-track-record so the gap stays closed.

**P-8 · What is deliberately NOT done.** No `staleTimes` experiment (experimental flag —
same policy that rejected the View Transitions flag, redesign E-8). No `cacheComponents`
migration (Part 0.1; the bundled migration guide stays in-tree for the day the backlog item
fires). No service-worker changes. No DB region move (Part 0.6). No new motion: the 200ms
route fade stays exactly as-is; speed comes from having something real to show, not from
choreography.

### 5.4 Budgets — testable, with today's baselines

Every budget names its instrument, its baseline (measured 2026-07-12), its target, and the
phase where it becomes a HARD gate. "Product routes" = the nine user-facing rooms (login/
offline/styleguide are already static and stay in the probe set as controls).

| # | Budget | Instrument | Baseline | Target | Hard from |
|---|---|---|---|---|---|
| B1 | Every product route builds static/ISR; any exception sits in the script's allowlist with a reason AND a `loading.tsx` | `scripts/check-routes.mjs` (new) reads the build manifests — a route passes when `routes[r].initialRevalidateSeconds ∈ (0,600]` OR `dynamicRoutes[r].fallbackRevalidate ∈ (0,600]` (the on-demand families live ONLY under `dynamicRoutes`), keyed through `app-path-routes-manifest.json` for route groups | 8 of 10 dynamic | 0 dynamic (empty allowlist) | F1 |
| B2 | Authenticated production TTFB per product route + one representative per dynamic family (`/ticker/SPY`, `/academy/<slug>`, `/scans/unusual-volume`) | `scripts/check-nav.mjs` (new; the Part 1.4 probe, productionized — prints the table + `x-vercel-cache` sequences, `--report` appends to `docs/feel-evidence/`). Gate protocol: wait for the deployment to be READY first (poll the deployment until its BUILD_ID changes — probing early measures the PREVIOUS deploy); gate on the **median of samples 2–5** (sample 1 is reported with a ≤1500ms cold ceiling, never gated — it carries cold-start + fresh MISS by design); on a miss, ONE automatic re-probe round before declaring failure, both rounds appended to evidence | 382–1237ms on the eight | **≤ 150ms** warm median per route | F1 (deployed) |
| B3 | Soft-nav: tab tap → destination content visible (seeded, local prod build, phone project) | `e2e/nav-timing.spec.ts` (new; Appendix D — N≥7 taps per destination via in-page `performance.now()` + coordinate taps, first sample discarded, `retries: 0` for the file) | old page frozen 400–1240ms | **median ≤ 400ms and no sample > 1000ms in CI** — a deliberately catastrophic-only tripwire: it can only trip on a return of the frozen-navigation disease class, never on runner noise (the repo's own lesson: a gate that fails randomly trains its executor to ignore it). The real medians (expected ≈ 30–150ms) are logged to evidence every run, so drift shows as a trend long before the ceiling | F1 |
| B4 | Per-route first-load JS | `scripts/check-bundles.mjs` (new). **`app-build-manifest.json` does not exist in this build** (verified against the actual `.next` — the adversarial pass caught the spec naming a removed artifact); the instrument instead (a) parses each prerendered route's `.next/server/app/**.html` `<script src>` set — exact first-load; (b) for on-demand-only families, unions the route's `page_client-reference-manifest.js` chunks + `build-manifest.json` `rootMainFiles`, labeled an upper bound; gzip via `zlib.gzipSync` (stated: ~15% above Vercel's brotli wire size — same-instrument comparisons only) | F0 records the real per-route table (the Lighthouse 128KB is a different unit — br transfer — and is NOT the baseline for this instrument); `/ticker`'s chunk set includes the verified 153KB-raw `lightweight-charts` carrier | targets set in F0 from the instrument's own BEFORE table: `/ticker` after P-6 ≤ its F0 value minus the chart chunk + 10KB slack; every route ≤ its F0 value + 10KB; `/` additionally keeps the existing 200KB Lighthouse budget | F1 |
| B5 | Layout shift — both regimes | hard loads: existing Lighthouse gate on `/` (unchanged). **Soft navs — where skeletons actually appear and Lighthouse cannot see** (it hard-loads one URL): `nav-timing.spec.ts` installs a `PerformanceObserver({ type: "layout-shift" })` before each tap and asserts the soft-nav cumulative shift < 0.05; Appendix C's height-mirroring is pixel-locked by the styleguide VRT rows | 0.000 (hard) | < 0.05 in both regimes | F1 |
| B6 | Perceived-instant sanity | the existing Lighthouse budgets (perf ≥ 90 hard-advisory split unchanged, LCP stays advisory per the user's standing decision) | perf 93 | no regression | every phase |

Numbers chosen from the measurement, not vibes: 150ms TTFB is the cached path's measured
67ms plus honest headroom; B3's ceiling is calibrated to the disease class (400–1240ms), not
to the healthy case, precisely so it never cries wolf. **And the two-regime truth is stated
rather than averaged away:** `revalidatePath` invalidates; regeneration happens on the NEXT
request (the bundled ISR guide is explicit) — so after the ~8:40pm publish busts every path,
the user's 9:00pm first tap into each room pays one blocking regeneration
(skeleton-then-content, ~400–900ms), and every tap after that is the ≤150ms steady state.
`check-nav --report` captures one post-publish first-tap probe per route into the evidence
file so the regime the user actually lives in at 9pm is measured, not inferred. The honest
summary the budgets enforce: **steady-state instant, first-touch-after-publish visibly
loading but never frozen.**

### 5.5 The instruments

- **`scripts/check-nav.mjs`** — the authenticated probe from Part 1.4, checked in:
  mints the session cookie exactly like `lighthouse-check.mjs`, waits for the target
  deployment to be READY, probes every product route + one representative per dynamic
  family ×5, prints the median table with `x-vercel-cache` sequences, enforces B2's
  warm-median protocol, and with `--report` appends the dated table to
  `docs/feel-evidence/nav.md`. Runs at every phase gate from F1 (against the production
  deployment, which auto-deploys on push). Stated for honesty: a dev-laptop probe is a
  server-latency regression tripwire, not a proxy for phone-radio experience — B3 owns the
  felt side.
- **`scripts/check-routes.mjs`** — B1, per the two-manifest pass condition in the table
  (`routes` OR `dynamicRoutes`). Walks `app/**/page.tsx` for the inventory, fails on any
  un-allowlisted dynamic route or any allowlisted one missing `loading.tsx`. Runs in the
  standing gate right after `npm run build`. The `dynamicRoutes` branch is first exercisable
  in F1 (today's manifest has none), so the F1 gate run prints the parsed `/ticker` entry as
  evidence that the branch works.
- **`scripts/check-bundles.mjs`** — B4, from the HTML script-tag sets + client-reference
  manifests as specified in the table; prints per-route KB so the table is evidence, not
  just a verdict (the font-budget lesson: a check that reports what it measured beats a
  bare pass).
- **`e2e/nav-timing.spec.ts`** — B3: per destination — warm the route once, resolve the
  tab's `boundingBox()`, then loop ≥7: stamp `performance.now()` in-page, tap by
  coordinates (no actionability wait in the measurement), await a content-specific locator,
  stamp again, `goBack()`; discard sample 1; assert the median against the catastrophic
  ceiling; write all samples + the layout-shift observer total (B5) to the evidence report.
  `test.describe.configure({ retries: 0 })` — a timing gate that passes on retry is a gate
  that teaches you to ignore it.
- **`docs/feel-evidence/`** — the running record: F0 captures the BEFORE table (the Part 1.4
  numbers, re-run and committed), every later phase appends AFTER tables. The plan's claims
  stay falsifiable in the repo's own history.
- **npm scripts:** `check:routes`, `check:nav`, `check:bundles` join the `Commands` block in
  CLAUDE.md (Part 9).

---

## Part 6 — Phases F0–F7 (playbooks + gates)

*Same contract as the R-phases: TDD for logic, VRT for pixels, every phase exits through the
standing gate, tag `feel-N`, roll straight on (autonomy directive). Estimates assume R-phase
pace. Sequencing logic: instruments before changes (F0) so every claim has a before/after;
speed before layout (F1) because it is global, independent, and the user feels it that
night; the kit before its consumers (F2); then rooms in priority-times-dependency order —
Scans (worst page, table-kit proving ground), Paper (form-kit proving ground), Desk (highest
stakes, consumes the by-then-hardened Disclosure/Shelf), the light sweeps, hardening.*

**The standing gate (every phase, in order):**
```
1  npm run typecheck && npm run lint && npm test            # app unit
2  uv run pytest                                            # pipeline (phases touching it: none planned — run anyway, it is cheap insurance)
3  npm run build && npm run check:routes && npm run check:bundles
4  npm run e2e:local                                        # e2e + PWA + nav-timing locally (--ignore-snapshots:
                                                            # baselines are Linux-born; a literal `playwright test`
                                                            # reds ~46 snapshots on macOS for rasterization alone)
5  npm run check:drift                                      # v3 grep set as it lands, phase by phase
6  push → wait for the deployment → npm run check:nav -- --report   # B2 (from F1)
7  npx lhci / lighthouse-check.mjs — budgets B5-hard-load/B6
8  git tag feel-N · push --tags → THE CI TAG RUN IS THE PIXEL ORACLE (e2e + VRT + PWA on
   Linux; F0 wires feel-* into ci.yml — without that amendment no feel tag triggers any
   workflow at all and every VRT/e2e gate claim in this plan is ornamental)
9  Update PROGRESS.md · append DECISIONS/LESSONS · confirm the tag CI green
```

### F0 · Instruments, baselines, seeds, CI wiring [0.5–1 day]
FIRST: amend `ci.yml` — add `feel-*` to `on.push.tags` AND to both tag-gated job `if`
conditions (without this, no feel tag triggers any workflow and the whole plan's gate story
is fiction — adversarial finding, verified against the file). Build `check-routes.mjs`,
`check-nav.mjs`, `check-bundles.mjs`, `e2e/nav-timing.spec.ts` (assert-nothing report mode
first — the budgets arm in F1); run all against the CURRENT tree and deployment; commit the
BEFORE tables to `docs/feel-evidence/` (the Part 1.4 numbers, reproduced by the checked-in
instruments, INCLUDING the dynamic-family representatives). Run the **P-3 prefetch
experiment** (one ISR route with `loading.tsx`, one without; record which prefetch behavior
the pinned version actually exhibits — F1 branches on the verdict). Grow `prisma/seed.mjs`
per §4.2 (scan rows for all five presets incl. the empty one, null-metric + lottery rows at
rank ≥ 9, ranks 1–3 byte-identical to today's movers) + 6 paper trades (3 open incl. one
short, 3 closed with mixed P&L for outcome chips) + the two high-importance calendar rows
beyond the 3-row cut (§4.1's guard) — every later phase's tests and VRT depend on this
seed, so it lands first and alone. THEN regenerate + commit the seed-affected VRT baselines
via the CI `vrt-baselines` dispatch (the vrt-update skill flow) — the standing gate's
step 4/8 must be green ON F0's own tag, not red-with-excuses.
**Exit gate additions:** the `feel-0` tag actually triggers the CI e2e job (the proof the
wiring works); instruments run green in report mode; seed is deterministic (two consecutive
seeds → identical VRT pixels); prefetch-experiment verdict recorded; evidence files
committed.

### F1 · The speed layer [1–1.5 days]
Execute §5.3 P-1 through P-7 exactly: route conversions (incl. `generateStaticParams` on
the ticker family, `dynamicParams = false` on scans presets, the settings theme
client-read, the paper `useSearchParams` island, and the catch-and-degrade sweep over the
named bare loaders + the ci.yml app-job comment rewrite), ticker single-stage loader,
`loading.tsx` per the F0 prefetch verdict's branch (Appendix C) + `Skeleton` component
(pulled forward from the kit — it has no other dependencies), the two `<a>` fixes, chart
code-split, revalidate-route extension + lesson-actions gap + the journal-forecast gap +
watchlist layout-scope upgrade. Land drift rules 13 + 14. Arm budgets B1–B5 as HARD.
**Exit gate additions:** B1 empty allowlist with the parsed `dynamicRoutes` ticker entry
printed; B2 warm-median table ≤150ms on production (into evidence, cache sequences shown);
B3 armed and green with real medians logged; B4 per-route table printed, targets set from
F0's BEFORE numbers; **no settled-page ASSERTION changes** across the existing 173 e2e
(stated precisely because two pages' bytes DO change by design: `/paper`'s static shell now
carries the Suspense island fallback, and skeletons exist on loads the old suite never
sees); `desk.spec` seeded assertions pass on the ISR builds; the forecast-visible e2e
addition green.

### F2 · The kit [1–1.5 days]
Disclosure, Shelf (+ `.shelf` class), DataTable + `lib/table.ts`, SegmentedControl, Stepper,
Combobox + `searchInstruments`/`lastServedClose` actions, styleguide section 9, drift rules
15 + 16 (16 skip-lists `/track-record` until F6). Unit suites per §3 — written FIRST per
§6.2. No consumer pages change in this phase (the styleguide is the only consumer), so VRT
adds only styleguide rows.
**Exit gate additions:** kit unit suites green (incl. every negative control); styleguide
VRT rows captured in CI both themes; the existing `data-p2` ancestor test passes over the
new kit's specimens — with the sharpened negative control: a DataTable row given the movers
hover classes (`transition-colors duration-*`) over a `data-p2` delta chip MUST fail the
walk (the guard bites the exact shortcut a hurried consumer would take), and a `fade`
Disclosure over a BaseRate specimen fails likewise.

### F3 · Scans [1.5–2 days]
§4.2 in full: index cards + preview tables; the `/scans/[preset]` route (loader,
`lib/scan-table.ts` first with its tests, rail integration + `RailProvider` mounts, cap
line, lottery chips); `e2e/scans.spec.ts` (the reachability, sort-honesty, criteria-pinned,
rail, and phone card-row assertions of §4.2); route-map + copy additions; VRT rows.
**Exit gate additions:** the last-page-reachable assertion (the "+N more" grave); M1
assertions green (incl. the phone select's "Scan order" default and the index card order);
the `/scans/garbage` 404; the rail bottom-sheet inset assertion; `scan-view.ts` deleted and
grep #9-style dead-class check confirms no orphan `capMatches` references;
`/scans/unusual-volume` added to `hardening.spec.ts` ROUTES, to its 16px input loop (the
native sort select is automatable in Chromium today), and to `nav.spec.ts`'s
horizontal-overflow list — plus `/ticker/SPY` to hardening ROUTES while there (a
pre-existing sweep gap this plan's tables would widen); index + preset routes hold budgets
B2/B3.

### F4 · Paper [1–1.5 days]
§4.3 in full: ticket rebuild on the form kit, no-default side, last-close chip, cooling-off
presentation upgrade, sizing-helper restyle, ledger DataTables + Disclosure, the format
sweep + drift rule 12, the setup-card "Practice on paper →" doorway (+ its e2e journey).
**Exit gate additions:** `paper.spec.ts` extended set green (incl. the doorway journey
proving the interstitial now fires from a real product path); rule 12 grep empty; unit money
formats unchanged in value (the sweep changes renderers, not numbers — snapshot the receipt
figures before/after in the test).

### F5 · The Desk [1.5–2 days]
§4.1 in full: pulse shelf (VIX-first order) + fixed breadth, calendar temporal-cut +
always-visible high rows, movers first-3 + disclosure + the sub-`desk:` two-line row
variant, watchlist focus split + fired-forcing logic (dormant slot), journal/sources
disclosures with the M2 forced-open logic, module 07 count line, lg: spread + md-band
measure cap, desktop-open defaults. `desk.spec.ts` additions (§4.1 touch list). VRT
re-shoots for every Desk state (Part 8).
**Exit gate additions:** ritual-order e2e assertion (the DOM-order test extends to the new
containers); degraded-source forceOpen e2e (seed variant with marketaux degraded already
exists); BOTH seeded high-importance calendar rows visible while collapsed; movers
disclosure count correct; phone scroll-length evidence shot (full-page screenshot
page-height logged before/after into evidence — the ~50% claim gets a number).

### F6 · The remaining rooms [1 day]
§4.4 track record (DataTable + filters + card-rows; rule 16 unlists it), §4.6 academy home
(2-up + read counts), §4.7 settings cards. Their e2e/VRT deltas.
**Exit gate additions:** the last `overflow-x-auto` page table is gone (grep); miss-visible
assertions green.

### F7 · Hardening, evidence, docs [1 day]
Touch-target sweep re-run (WITH the F3 route additions — the sweep is only as honest as its
route list, its own comment says so); axe pass; full VRT table re-run; iOS MANUAL checklist
(Part 7.4) run and photographed into `docs/feel-evidence/` — **every keyboard/gesture item
runs twice: mobile Safari AND the installed standalone app** (the user's primary surface;
gesture ownership and viewport behavior differ): shelf momentum + snap settle, shelf swipe
started inside the left screen-edge band (standalone), combobox vs iOS autocorrect, combobox
with the LISTBOX OPEN under the keyboard, tap-outside dismissal of the listbox, double-tap a
sort header and the stepper + (no smart-zoom), native sort select picker, keyboard-over-
ticket behavior, rail bottom-sheet from a table row (inset + link reachability), a VoiceOver
pass over the combobox (options reachable by VO swipe as real DOM nodes; tap-to-select
works); `check-nav` final table incl. one post-publish first-tap capture; docs sync per
Part 9 (DEVELOPMENT-PLAN §4.5 + §3.8 amendments + route map, CLAUDE.md commands + one-liner
touch-up, skill update); PROGRESS/DECISIONS/LESSONS closeout; tag `feel-final`.
**Gate:** the full standing gate + every budget table printed into evidence + zero
outstanding [VETO?] items unanswered in QUESTIONS (they don't block — they get a "built on
assumption" marker per the autonomy directive).

**Sequencing rules:** F0 blocks all. F1 blocks F3–F6 (they assert against cached routes) but
NOT F2. F2 blocks F3–F6. F3 → F4 → F5 → F6 → F7 in order (each hardens kit pieces the next
consumes; the Desk deliberately goes after two full rooms have exercised the kit). A veto of
0.4 (shelves) reshapes only §4.1's one shelf station (the pulse figures) into its ≥md grid at
every width — one table row, no phase graph change. A veto of 0.5 restores
`defaultValue="buy"` — one line. A veto of 0.7 deletes the doorway link and its e2e journey —
M10 stays as the ruling that would govern any future attempt.

---

## Part 7 — Mobile & iOS specifics (cross-cutting)

*The redesign's Part 7 contract stands (safe areas, 44px targets, 16px inputs, keyboard
tab-bar hide, no page horizontal scroll). This part adds only what the NEW patterns need.
The standing caveat repeats: the automated matrix is Chromium/Pixel-7; the items below
marked MANUAL are iOS-real-device checks, run at F7 and photographed.*

1. **Shelves on iOS.** `scroll-snap-type: x proximity` (never mandatory — drift rule 15)
   cooperates with momentum; `overscroll-behavior-x: contain` keeps a shelf fling from
   chaining into page navigation only WITHIN the shelf — the screen-edge 20pt band still
   belongs to Safari/the system and nothing may fight it. The mask lives on the
   NON-scrolling `.shelf-frame` wrapper (§3.2 — WebKit mask-on-scroller compositing is the
   known hazard; the wrapper is the insurance), and the `.shelf`'s own `padding-inline`
   keeps the resting first card and the fully-scrolled last card inside the mask's opaque
   band. The page-level `overflow-x: hidden` guard and its e2e assertion must stay green
   with the shelf mounted — the shelf scrolls, the page never does. MANUAL (twice: Safari +
   standalone): momentum feel, snap settle, no mask flicker during rubber-band, edge-band
   swipe behavior.
2. **The keyboard vs the ticket.** The tab bar already hides on keyboard
   (`TabBar.tsx:50-65`). The Combobox listbox renders BELOW its input (top-anchored lists
   fight the iOS keyboard) and caps at **5 rows / `min(40dvh, 220px)`** with its own
   scroll (§3.4 — the keyboard + QuickType leave ~300–360px under a mid-page input; an
   8-row list is guaranteed to run beneath them with no cue). `inputmode="decimal"` for
   prices, `"numeric"` for quantity (iOS shows the right keypad; `type=number` alone is not
   enough on all iOS versions). MANUAL (twice: Safari + standalone): focused reference-price
   field with keyboard up — field, chip, and submit reachable without dismissing; the
   combobox with its LISTBOX OPEN under the keyboard — all five rows reachable.
3. **Ticker-symbol typing.** `autocapitalize="characters" autocorrect="off"
   spellcheck={false}` on the Combobox input — otherwise iOS rewrites "SMCI" mid-word.
   (Grep-able; goes in the component, not the call sites.)
4. **Native `<select>` kept where native wins.** The phone sort control and any remaining
   pickers stay native `<select>` (restyled trigger, OS-native picker sheet) — the best
   one-handed ergonomic on iOS and zero dependency. MANUAL: picker opens with the styled
   trigger, 16px, no zoom.
5. **`<details>` marker hygiene.** The shipped setup-card pattern is Tailwind `list-none`
   only (`SetupCards.tsx:82` — an earlier draft of this plan cited a `::-webkit-details-
   marker` rule that does not exist in the tree; the adversarial pass grep'd it).
   Disclosure ships BOTH suppressions — `list-none` on the summary AND one
   `summary::-webkit-details-marker { display: none }` rule in `globals.css` (older WebKit
   ignores `list-style` on summaries) — and supplies the Chevron. Verify the summary stays
   a single ≥44px hit target with the count span wrapping as one block (`whitespace-nowrap`
   on the span), not shattering mid-phrase, at 320px.
6. **Sticky headers, deliberately absent.** No sticky `<thead>`, no pinned columns inside
   horizontal scrollers (§3.3 decision) — the two known iOS sticky/overflow traps are
   simply not entered.
7. **VRT determinism for scroll containers.** Shelf shots are taken at scroll position 0
   (fresh mount) with reduced-motion forced (existing harness rule); the mask gradient is
   part of the pixels and locks the affordance. Pagination shots always page 1; sorted
   shots use the seeded deterministic values.
8. **PWA unchanged.** Manifest, icons, SW, install flow: untouched. Faster navigations
   change nothing in the offline contract — the SW still caches navigations and the poison
   guard still filters them.

---

## Part 8 — Visual regression: the delta table

*Protocol unchanged (redesign Part 9): CI is the pixel oracle, baselines are born in CI
(`gh workflow run ci.yml -f job=vrt-baselines` per the vrt-update skill), masks on
timestamps, seeded data, reduced motion. This table lists NEW or RE-SHOT rows only; the
accumulated table keeps running whole at every gate. (~24 new/re-shot rows; the full table
lands at F7 around ~70 baselines.)*

| Page/state | Projects | Themes | Phase |
|---|---|---|---|
| /styleguide §9 kit (DataTable sorted state, card-rows, Disclosure open+closed, Shelf, Skeleton set incl. "—" figure slots, form kit row) | both | light + dark | F2 |
| /scans index (5 summary cards, incl. the 0-match preset) | both | light + dark | F3 |
| /scans/unusual-volume (table page 1, default sort) | both | light + dark | F3 |
| /scans/unusual-volume sorted by RVOL desc (header state) | desktop | light | F3 |
| /scans/unusual-volume page 2 (pagination footer state) | desktop | light | F3 |
| /scans/unusual-volume phone card-rows + sort select | phone | light + dark | F3 |
| /scans/[preset] rail open from a row (phone shot shows the bottom-sheet inset fix) | both | light | F3 |
| /paper ticket (empty form, side unpressed) | both | light + dark | F4 |
| /paper ticket filled (combobox closed, chip visible) + interstitial open (re-shoot) | both | light | F4 |
| /paper ledger tables (open + closed-disclosure expanded) | both | light + dark | F4 |
| / Desk phone (pulse shelf at rest + collapsed disclosures — the new ritual column) | phone | light + dark | F5 |
| / Desk phone, calendar + watchlist disclosures EXPANDED | phone | light | F5 |
| / Desk phone, degraded-source seed variant (forceOpen state) | phone | light | F5 |
| / Desk lg: spread at 1024×768 (the new early two-column) | desktop (1024 viewport) | light | F5 |
| / Desk desk: spread (re-shoot — module 07 count line) | desktop | light + dark | F5 |
| /track-record DataTable + filters (re-shoot) + phone card-rows | both | light + dark | F6 |
| /academy home 2-up + read counts (re-shoot) | both | light + dark | F6 |
| /settings cards (re-shoot) | both | light | F6 |

Loading skeletons are locked via the styleguide section (deterministic), never by racing a
live load. The fonts-blocked shot and every existing row keep running untouched.

---

## Part 9 — Docs, decisions, skills (executed with this plan)

*The receipt, same discipline as the redesign's Part 10: no successor session may ever read
two constitutions.*

1. **DEVELOPMENT-PLAN.md §4.5 and §3.8** — §4.5's "dynamic RSC everywhere … No ISR
   complexity in v1" clause is amended in its source (`docs/src/dp-0*.html`; locate the
   block by its heading text) with a dated note: "Amended 2026-07-12 — superseded by
   APP-FEEL-PLAN.md Part 5: every read route is ISR ≤600s with on-demand revalidation; the
   route-transition sentence ('render server-fresh without spinners') is replaced by the
   skeleton contract (M4)." §3.8's breakpoint clause ("768–1365 = two-column stack") gains
   its own dated note pointing at §4.1's md-band paragraph and the lg: spread (two-column
   begins at 1024, arithmetic in the plan). Markdown regenerated via
   `docs/src/build-plan-md.py`; PDF re-rendered. §4.2's route map gains `/scans/[preset]`.
2. **CLAUDE.md** — Commands block gains `check:routes · check:nav · check:bundles`; the
   design one-liner gains ", modular rooms — bounded cards, one tap to depth" after "glass
   cards with soft depth"; the new-surface pointer sentence gains "and any table renders
   through components/DataTable".
3. **UI-REDESIGN-PLAN.md** — one dated cross-reference note under its Part 5 header:
   "Layout containers per room are superseded by APP-FEEL-PLAN.md Part 4 (2026-07-12);
   tokens, type, color, material, and motion in this document remain authoritative." (Its
   §5.2 scans spec and §5.3 paper spec get inline pointers too — three one-line edits.)
4. **DECISIONS.md** — append the Appendix E entries, `[claude]`-marked, structural/local as
   labeled.
5. **QUESTIONS-FOR-BISHANT.md** — the three [VETO?] items (0.4 scroll-is-not-motion ruling,
   0.5 side-no-default, 0.7 the signal→ticket doorway under M10) + [FYI]s (ISR staleness
   contract incl. the post-publish first-tap regime; `/scans/[preset]` route added).
6. **Skills** — update `.claude/skills/new-surface` (the honesty checklist gains: "does it
   list rows → count + as-of in any collapsed summary (M2); is it a table → DataTable only,
   default order named, never 'top' (M1); does it load → figure slots are '—', never
   shimmer (M4)"). Mint nothing new until a second consumer proves a pattern (§9.3 rubric);
   the probe scripts are commands, not skills.
7. **This document** — `APP-FEEL-PLAN.md` at the repo root; typeset copy at
   `docs/App-Feel-Plan.pdf` from `docs/src/app-feel-plan.html` (print.css pipeline, same as
   the other four).

---

## Appendix A — `lib/table.ts` + `DataTable` API (paste-level)

The full `lib/table.ts` type block is in §3.3 and is normative. `DataTable`'s props:

```ts
type DataTableProps<Row> = {
  columns: Column<Row>[];
  rows: Row[];                       // already bounded by the route (≤500)
  defaultSort: { key: string; dir: "asc" | "desc"; label?: string };
                                     // label renders beside the header, e.g. "scan order" (M1)
  perPage?: number;                  // default 25
  rowKey: (row: Row) => string;
  onRowPayload?: (row: Row) => RailPayload;   // presence makes rows RailTriggers
  ariaLabel: string;                 // the table's accessible name
  footnote?: string;                 // e.g. copy.scans.tableNote — rendered under the table
};
```

Rendering rules bound into the component (not the callers): numerals right + mono; null →
"—"; `kind` routes through `lib/format` (`price`, `signedPercent`, `percent`, `multiple`);
`signedPercent` cells render as delta chips carrying `data-p2` (up/down-text on wash,
triangle + sign — the movers VISUAL grammar, but never its `transition-colors` hover: §3.3's
P2 note binds the file); `chip` kind renders a `Tag`; sort buttons full-cell ≥44px with
`aria-sort` and `touch-action: manipulation`; no transitions anywhere in the file (it is
P2-bearing by construction); card-row mode below `md` per §3.3; pagination footer per M6.

## Appendix B — `copy.ts` additions (mechanical voice; exact strings)

| Key | String |
|---|---|
| `scans.tableNote` | `Matches are filter hits, not forecasts. Sorting re-orders today's matches; it never ranks tomorrow.` |
| `scans.order` | `scan order` |
| `scans.preview` | `First {k} of {n} by scan order` |
| `scans.allMatches` | `All {n} matches →` |
| `scans.cap` | `Showing the first 500 of {n} by scan order — a filter matching this many names is closer to noise than a signal. Sorting is off above the cap.` |
| `scans.empty` | `0 matches today — the filter ran and found nothing. That is information.` |
| `scans.lotteryChip` | `lottery risk` |
| `table.page` | `Page {p} of {t} · {n} rows` |
| `table.sortHint` | `Sort` |
| `disclosure.more` | `+ {n} more · {context}` |
| `disclosure.calendar` | `Full calendar` |
| `disclosure.movers` | `All movers` |
| `disclosure.watchlist` | `Full watchlist` |
| `disclosure.sources` | `Per-provider detail` |
| `pulse.swipe` | `5 figures — swipe` |
| `desk.scanCount` | `{n} matches across {k} scans` |
| `calendar.next` | `Next {k} of {n} · through {date}` |
| `journal.savedNone` | `none saved tonight` |
| `journal.savedOne` | `1 saved tonight` |
| `sources.allOk` | `{n} sources · all reporting · ran {window}` |
| `paper.lastClose` | `Use last close ({date}) · {price} — a reference, not a quote` |
| `paper.sideRequired` | `Choose buy or sell.` |
| `paper.practiceDoorway` | `Practice on paper →` |
| `paper.closedTrades` | `Closed trades` |
| `academy.readCount` | `{read} of {n} read` |

Existing keys are not moved or reworded. The copy unit test pins every string above. The
`/scans` page's current inline intro paragraph survives verbatim as inline prose (precedent:
watchlist microcopy decision, 2026-07-11); only NEW durable strings enter the deck.

## Appendix C — `loading.tsx` composition per route

Every file is a `Surface`-composed skeleton mirroring its room, using `Skeleton` variants
(`masthead`, `text`, `block`, `figure` — figure ALWAYS renders "—", M4). Heights mirror the
loaded page's stable elements so CLS stays ~0.

(Applicability follows the F0 prefetch verdict — P-3: in branch B only the `[param]`
families and allowlisted-dynamic routes keep their `loading.tsx`.)

| Route | Skeleton composition |
|---|---|
| `/(desk)/loading.tsx` | DeskHeader bones (eyebrow bar + display-width bar + status bar) + the 00/01 masthead bones with `figure` "—" slots where the last-run stat and the hero S&P will stand (M4: never a shimmering bar where money renders) + 2 more masthead bones with 2 text bars each (the fold's worth — not all 10; below-fold skeletons are wasted work) |
| `/scans/loading.tsx` | h1 bone + 2 summary-card bones (masthead + 3 text bars + 5 row bars) |
| `/scans/[preset]/loading.tsx` | return-link bone + header-card bone (title bar + 2 clause bars + figure "—") + table bone (header row + 10 row bars) |
| `/paper/loading.tsx` | h1 bone + ticket bone (5 label+control bars) + receipt bone (3 line bars + figure "—") |
| `/track-record/loading.tsx` | h1 bone + 5 stat tiles with figure "—" + table bone (header + 8 rows) |
| `/ticker/[symbol]/loading.tsx` | return-link + header bone (symbol bar + name bar + figure "—") + `block` 420px (the chart reservation — STILL geometry, no shimmer, per M4's chart clause) + ladder bone (3 band bars, no shimmer — the ladder is `data-p2` furniture) |
| `/academy/loading.tsx` | h1 bone + 3 module-card bones (kicker bar + 4 row bars) |
| `/academy/[slug]/loading.tsx` | return-link + title bone + 8 prose bars at 65ch |
| `/academy/review/loading.tsx` | one centered card bone |
| `/settings/loading.tsx` | h1 bone + 3 card bones |

## Appendix D — instrument sketches

**`check-routes.mjs` (B1):** read `.next/prerender-manifest.json` — a route passes when
`routes[r].initialRevalidateSeconds ∈ (0,600]` **or**
`dynamicRoutes[r].fallbackRevalidate ∈ (0,600]` (the on-demand families appear ONLY under
`dynamicRoutes`; verified against the actual manifest writer in the pinned build) — keyed
through `.next/app-path-routes-manifest.json` (which already maps `/(desk)/scans/page` →
`/scans`); inventory = every `page.tsx` under `app/` mapped to its route; product routes =
inventory minus `/login|/offline|/styleguide|/_not-found|/api/*`; fail any product route
passing neither branch unless in `ALLOWLIST` (an in-file `{ route, reason }[]`, initially
empty) AND a sibling `loading.tsx` exists. Print the full table either way (a check reports
what it measured).

**`e2e/nav-timing.spec.ts` (B3) pattern** (revised in the adversarial pass: the first draft
had a strict-mode locator collision — "Scans" also matches the Desk's module-07 link,
"Track" the scorecard link — a single-sample assertion masquerading as a p75, a desktop
`.tap()` crash, and a `networkidle` race with idle-scheduled prefetches):

```ts
test.describe.configure({ retries: 0 });            // a timing gate that passes on retry
test.skip(({ isMobile }) => !isMobile);             // teaches you to ignore it
const DESTS = [["Scans", "Scans"], ["Paper", "Paper desk"],
               ["Track", "Track record"], ["Academy", "The Academy"]] as const;
for (const [tab, heading] of DESTS) {
  test(`tab → ${tab}`, async ({ page }) => {
    await page.goto(`/`);                           // then WARM the route once, explicitly:
    const link = page.getByTestId("tab-bar").getByRole("link", { name: tab }); // scoped —
    await link.tap();                               // no strict-mode collision with in-page links
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    const box = (await link.boundingBox())!;        // resolve once; taps below skip actionability
    const samples: number[] = [];
    for (let i = 0; i < 8; i++) {
      await page.goto(`/`);
      await installLayoutShiftObserver(page);       // B5's soft-nav CLS, same pass
      const t0 = await page.evaluate(() => performance.now());
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      const t1 = await page.evaluate(() => performance.now());
      if (i > 0) samples.push(t1 - t0);             // discard the first (compile/warm noise)
    }
    report(tab, samples);                            // all samples → docs/feel-evidence/
    expect(median(samples)).toBeLessThanOrEqual(400);    // catastrophic ceiling only —
    expect(Math.max(...samples)).toBeLessThanOrEqual(1000); // trips on the disease class,
  });                                                    // never on runner noise
}
```

**`check-nav.mjs` (B2):** the Part 1.4 probe with the B2 gate protocol (deployment-READY
wait, warm-median of samples 2–5, sample-1 cold ceiling reported not gated, one automatic
re-probe round on a miss), the region/cache columns, and `--report`. Cookie mint copied from
`lighthouse-check.mjs` (same env contract; never prints the token).

## Appendix E — logged local decisions (each also lands in DECISIONS.md)

1. **ISR everywhere over `cacheComponents`** (structural — supersedes DP §4.5, which the
   Desk's 2026-07-11 ISR decision had already breached for `/`). Backlog trigger for the
   Cache Components migration: Serwist ships Turbopack support (serwist/serwist#54) OR any
   F-budget proves unreachable on ISR. The bundled migration guide
   (`node_modules/next/dist/docs/…/migrating-to-cache-components.md`) is the recipe when it
   fires. Rejected now: an app-wide semantic migration mid-plan on a webpack/Serwist build
   the flag has never been tested against, to reach budgets the proven pattern already
   reaches.
2. **Hand-rolled table engine** (local). Rejected: TanStack Table (buys headless ergonomics
   this design language immediately re-skins; ~13KB + a dependency surface for two sort
   functions), AG-Grid (200KB-class, styling fights the token system).
3. **`/scans/[preset]` route** (structural — route-map amendment). Rejected: one giant
   `/scans` page with every table inline (five 500-row tables on one document), server-side
   pagination via searchParams (fragments the ISR cache per URL and puts a server hop back
   into every sort click).
4. **Client-side sort/paginate over a ≤500-row serialized set** (local). Rejected:
   virtualized scroll (dependency + VRT nondeterminism + iOS momentum jank for a set this
   small), infinite scroll (M6, banned).
5. **Phone tables render as card-rows; no pinned-column horizontal scroll** (local).
   Rejected: sticky first column in an `overflow-x` scroller — the exact iOS sticky trap
   the redesign already documents, plus two-axis scrolling on a 390px page is a keyhole.
6. **Pulse figures become the one phone Shelf; movers, calendar, watchlist, closed ledger,
   journal, sources become Disclosures; the brief and setup cards change containers not at
   all** (local — the per-station READ/GLANCE triage in §4.1 is the principle). An earlier
   draft also shelved the movers; the adversarial pass caught that contradicting this very
   entry's reasoning — a mover card carries a headline and a source link, which is reading
   content on a pan axis — and the movers went back to vertical rows behind a disclosure.
   Rejected: collapsing the brief (the ritual IS reading it), a Shelf of setup cards or
   movers (a horizontal rail of reading content invites carousel skimming of exactly the
   content that must be read, not glanced).
7. **Side has no default** (local, [VETO?]'d). Rejected: keeping `buy` preselected (a
   nudge on the decision the room exists to slow down).
8. **Last-close suggestion chip, tap-to-fill only** (local). Rejected: auto-filling the
   reference price (silently substitutes a quote for the user's own reference — the cost
   lesson wants the user to own that number).
9. **Setup-card "Practice on paper →" doorway carries `signalViewedAt`** (structural in
   effect — it creates the app's first signal→ticket path, so it is governed by ruling M10's
   four conditions, listed in Part 0.7, and flagged [VETO?]). It makes the built-and-tested
   cooling-off mechanic reachable (today only the e2e constructs the URL) and is strictly
   more protective than the organic card → tab → ticket walk that exists now with no
   cooling-off at all. Rejected: leaving the mechanic dormant, a DB-side "last viewed
   signal" lookup (heavier, and the URL parameter is the existing tested contract), and any
   such doorway from mover/scan rows (M10's boundary — no evidence anatomy, no ticket
   link).
10. **User-scroll-is-not-motion ruling** (structural interpretation, [VETO?]'d — Part 0.4).
11. **DB stays us-west-2** (local). Revisit trigger: any B2 budget missing after F1 with
    the miss attributed to origin latency in the evidence table.
12. **No sticky table headers; no zebra; sort re-renders instantly with no transition**
    (local — M3 + iOS). Rejected: FLIP-animated sorts (numbers in motion).
13. **Native `<select>` for the phone sort control** (local). Rejected: a custom dropdown
    (dependency-or-handroll cost for a worse one-handed ergonomic than the OS picker).
14. **Journal textarea behind a one-tap Disclosure with the prompt line as summary**
    (local). Rejected: removing the journal from the Desk (it is the evening ritual's
    closer), leaving the always-open textarea (the single tallest always-empty region on
    the phone Desk).
15. **Skeletons stop at the fold on the Desk** (local): four masthead bones, not ten — a
    loading page taller than the viewport is painting for nobody.
16. **`lesson-actions` gains revalidates; `writeJournalEntry` gains the `/track-record`
    bust on forecast creation; watchlist actions upgrade to layout scope** (local —
    freshness gaps that only become visible once routes cache; fixed WITH the conversion,
    not discovered after).
17. **Sorting disabled above the 500-row cap** (local — M6/M8: sorting a silent slice is an
    unlabeled subset ranking). Rejected: sorting the slice with an extended caveat (a
    caveat under a complete-looking sorted table reads as fine print).
18. **Converted loaders follow the house catch-and-degrade pattern** (local — the DB-less
    CI `app` job builds every push; prerender-time loaders must tolerate an absent
    database, exactly the lesson the desk layout taught on 2026-07-12). Rejected: a
    postgres service in the `app` job (heavier CI for every push when the e2e job already
    proves seeded prerenders).
19. **Pulse-shelf order is VIX · 10-yr · Nasdaq · Dow · small-caps proxy** (local — in a
    shelf, position is visibility; the hero above already states the equity tape, so the
    independent risk gauges ride first and the tape's echoes take the tail). Rejected:
    indices-first (traced convention, buries the two figures that aren't redundant with the
    hero).
20. **Combobox dismissal is pointerdown+blur; listbox caps at 5 rows** (local — iOS
    synthesizes no click on non-interactive regions, and the keyboard leaves ~300–360px
    under a mid-page input). Rejected: click-outside listeners (dead on iOS), 8 rows
    (guaranteed to run under the keyboard).
21. **B3 gates a catastrophic ceiling (median ≤400ms, max ≤1000ms), reports the real
    medians** (local — a 200ms hard assert on a shared runner flakes, and a gate that fails
    randomly trains its executor to ignore it; the ceiling can only trip on the
    frozen-navigation disease class returning). Rejected: tight per-sample asserts
    (flake-trainer), no gate at all (no tripwire).

## Appendix F — the scan-table column map (from the 34 stored metric keys)

Common to every preset: `#` (= `rank`, int, **priority 2** — on phone card-rows the scan
order must be visible, not implied, since it is the default sort (M1); header "` # `",
sortable — it IS scan order) · `Symbol` (mono, priority 1) · `Name` (text, priority 2,
truncates at 24ch) · `Close` (`price`, priority 2) · `lottery_flag → "lottery risk"` Tag
appended to the symbol cell when true (never a column of empty cells). Per preset, the
trigger columns (priority 1 unless noted):

| Preset | Trigger columns (metrics key → header, kind) | Context columns (priority 3) |
|---|---|---|
| unusual-volume | `ret_1` → "1-day move", signedPercent · `rvol20` → "RVOL", multiple | `dollar_volume` → "$ volume", mono compact |
| near-52w-high | `dist_52w_high` → "From 52w high", signedPercent · `ret_1` → "1-day move", signedPercent (priority 2) | `rvol20` → "RVOL", multiple |
| gap-3plus | `gap_pct` → "Gap", signedPercent · `ret_1` → "1-day move", signedPercent (priority 2) | `rvol20` → "RVOL", multiple |
| golden-cross-fresh | `sma50` → "50-day", price · `sma200` → "200-day", price (both stored values verbatim — the app derives nothing, per the numbers-pipeline-side rule) | `ret_20` → "20-day move", signedPercent |
| rsi-extreme | `rsi14` → "RSI", mono 1dp · `rsi14_prev` → "RSI prior", mono 1dp (priority 2) | `ret_5` → "5-day move", signedPercent |

`is_large_mid` and the remaining snapshot keys stay server-side (they are pipeline
internals, not reader information). Null metric → "—", sorts last (§3.3). Headers never
contain "top", "best", "hot" — M1's grep-able word list lives in the `e2e/scans.spec.ts`
assertion, not just this table.

---

*End of plan. The build starts at F0; no decision waits on the user; every [VETO?] proceeds
on its marked assumption per the standing autonomy directive.*
