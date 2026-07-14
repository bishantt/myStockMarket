<!-- UI-REDESIGN-PLAN.md — authored 2026-07-11, decisions resolved 2026-07-12.
     Companion to DEVELOPMENT-PLAN.md. Typeset copy: docs/UI-Redesign-Plan.pdf.

     THIS MARKDOWN IS THE LIVE COPY. THE PDF IS AN ARCHIVE OF A FINISHED BUILD (R0–R6, complete
     2026-07-12) and was deliberately NOT re-rendered for the amendments dated 2026-07-13 or later
     (GATE-EFFICIENCY-PLAN G4). Those amendments — the "roll straight on" repeal in Part 8, and the
     amber-register pointers in P11 / §3.10 / Appendix A — exist HERE ONLY. Read the markdown.
     Re-rendering an archive to carry a correction about a build that is already over would
     manufacture a second source of truth for no reader; pointing at the live copy costs one line.
     (The ACTIVE plan's PDF — Polish-And-Depth-Plan.pdf — IS kept regenerated, for the opposite
     reason: it is the one people still open to decide what to build.) -->

# UI REDESIGN PLAN — "Morning Broadsheet"

*The visual re-founding of myStockMarket. This document is the design authority for everything
the reader sees; DEVELOPMENT-PLAN.md remains the authority for everything the product computes.
Where the two disagree on looks, this plan wins. Where anything disagrees on honesty, the
honesty rule wins — always.*

**Executor:** Claude Opus 4.8, unattended, same working rules as DEVELOPMENT-PLAN.md (TDD per
§6.2 there, plain-English code and docs, session ritual, DECISIONS/LESSONS logging).
**Source design:** `FigmaDesignRef/Stock Market Command Center/` — a Figma Make export (React +
Tailwind v4) whose `src/index.css` is the token source and whose twelve components are the
screen references. The screenshot in `src/imports/` is mood, not spec.
**Authority order for this work:** honesty rules (unchanged, listed in Part 2) > this plan >
the Figma export > DEVELOPMENT-PLAN.md Part 3 (now amended) > judgment.

---

## Part 0 — The four global decisions (RESOLVED by the user, 2026-07-12)

*The plan paused on four rippling choices; the user answered all four. The answers below are
binding; every section of this plan has been reconciled to them. Nothing here is open — the
build starts at R0.*

**D1 — Theme: ONE theme, app-wide. (User decision — supersedes both offered options.)**
A single setting governs the entire app: dark means everything is dark — Desk, Academy, Track
Record, Scans, Paper, Settings, login; light means everything is light. **The "Academy stays
light" / "dark is Desk-only" rule is repealed** and the constitution amended accordingly
(Part 2 A11) — this deliberately supersedes RR §9.7's long-form-reading (positive-polarity)
rationale, by user directive. Dark mode itself survives, re-derived from the new palette
("Midnight", §3.3), and the two rooms still feel distinct — through typography, spacing,
density, and pace (§5.6), never through different palettes or themes. Mechanically: the
`data-theme` attribute moves from the Desk shell to `<html>`, stamped by a **tiny inline
pre-paint script in the root layout** that reads the existing theme cookie — NOT by a server
cookie read, which would force every route dynamic and break the `force-static` login/offline
pages the service worker precaches (§7.3). One token sheet themes every route, no flash.

**D2 — Mobile navigation: bottom tab bar. (As recommended.)**
Desktop keeps the restrained top bar. Phones move the five rooms into a fixed glass bottom tab
bar (Desk · Scans · Paper · Track · Academy), Settings behind a gear in the top bar. Full spec
including the iOS keyboard rule and the z-ladder: §4.2. Plan B (the improved top strip) stays
in the document only as the record of the alternative.

**D3 — Wordmark: keep "myStockMarket", adopt the gradient mark. (As recommended.)**
28px `--gradient-brand` "M" tile + "myStockMarket" in tracked mono caps; PWA icons regenerate
from the mark (§7.3). No rename anywhere.

**D4 — One material world: unified lavender. (User decision.)**
Both rooms live on the same wash, the same tokens, the same light. There is no warm-cream
Academy palette and no room-scoped token remapping. The Academy's identity is **structural,
not chromatic** (§5.6): solid paper cards instead of glass, serif kickers instead of terminal
mastheads, reading typography, more whitespace. "Warmer and calmer" is achieved by type,
spacing, and hierarchy inside whichever theme is active.

> **Interlock note:** D1+D4 together simplify the system — one token sheet, two theme columns
> (light "Morning" / dark "Midnight"), zero room palettes. The Desk/Academy *separation*
> (distinct shells, doorways, return rails) is a preserved honesty-adjacent product rule and
> is untouched (Part 2 P10); only the palette split is gone.

---
## Part 1 — The design vision

*What the Figma teaches, what survives from Broadsheet Terminal, and where I overruled the
Figma as designer. Read this part first; every later spec is this part made mechanical.*

### 1.1 What the Figma actually is

The export is not a generic dashboard theme. Read closely, it is **our product redrawn in a
warmer material** — it keeps mono uppercase mastheads ("MARKET PULSE — PRE-MARKET"), hairline
dividers inside cards, tabular numerals, dot arrays with visible misses, base rates written as
"61 of 108 — 56.5% (47–65% CI)", a "Typical Range (Not a Target)" panel, a "What Would Weaken
This" list, and a disclaimer that is almost word-for-word our scope line. The honesty furniture
survived the restyle. What changed is the **material and the light**:

- **Light.** A fixed lavender gradient wash (`#f9f8ff → #eef2ff → #f0f4ff → #faf8ff`, 145°)
  with two soft radial "orbs" glowing from the corners. The page feels like morning light on
  paper instead of flat bone.
- **Material.** Cards are translucent white glass (`rgba(255,255,255,0.72)` + 16px blur, 16px
  radius, violet-tinted hairline border). Raised surfaces get more opacity, more blur, and a
  soft violet shadow. Depth exists, but it is atmospheric, not skeuomorphic.
- **Type voice.** Three families: Playfair Display (an editorial serif for titles — the
  "broadsheet" made literal), Inter for UI, JetBrains Mono for every numeral. Serif titles
  over mono data is the signature pairing.
- **Color voice.** One indigo accent family (#6366f1 / #4f46e5, plus a #4f46e5→#7c3aed brand
  gradient used exactly twice: logomark and primary button). Gain/loss is **blue/orange**
  (#2563eb / #ea580c) — already colorblind-safe. Tier chips are quiet soft-wash pills.
- **Restraint that survived.** No neon, no pure black, color still scarce and semantic, one
  serif hero per page, whitespace still the main material.

### 1.2 What survives from Broadsheet Terminal (unchanged laws)

1. **Mono numerals everywhere data appears** — JetBrains Mono replaces IBM Plex Mono, the law
   does not change. Tabular figures, true minus U+2212, right-aligned numeric columns.
2. **Mastheads** — numbered, uppercase, tracked, with a rule and a right-aligned timestamp.
   The rule becomes a tinted hairline instead of 2px ink, the anatomy is identical.
3. **One hero figure per view** — the S&P level stays the Desk's only 64px numeral.
4. **Numbers render only through `components/BaseRate` and `lib/format`** — restyled, never
   re-implemented. `copy.ts` remains the only source of user-facing strings.
5. **The honesty furniture** — N + CI, natural frequency, always-up baseline, decay stamps,
   weakeners, misses-first, catalyst-or-noise, timestamps everywhere.
6. **Token discipline** — one token sheet in `globals.css`, no ad-hoc hex anywhere else,
   `/styleguide` as the living spec, anti-drift greps at every phase exit (grep list v2, §3.10).
7. **Calm foundations** — no urgency theater, no autoplaying motion loops, no toasts, no
   badges, `prefers-reduced-motion` zeroes everything.

### 1.3 Where I overruled the Figma (designer's calls, not tracing)

| # | Figma shows | This plan does instead | Why |
|---|---|---|---|
| 1 | Mini dot array scaled to 40 dots representing N=108 ("+68" tail) | Cards get a **proportion bar + printed counts**; the full every-dot-is-a-case array lives in the expanded detail | A scaled dot array misrepresents sample size — the whole point of dots is that you can count them. Honesty rule beats Figma. |
| 2 | `background-attachment: fixed` on the body gradient | A fixed-position wash layer (`.app-wash`) behind content | `background-attachment: fixed` is broken on iOS Safari — the PWA would repaint the gradient on every scroll frame. |
| 3 | Glass blur on every card | Blur budget: backdrop-filter only on sticky bars + overlays; cards are translucent **without** blur on phones | Stacked `backdrop-filter` is a GPU tax that shows up as scroll jank on mid-range phones. Over a static wash, translucency without blur is visually near-identical. |
| 4 | Pulsing emerald status dot with glow in the nav | Static dot + mono text label | A glowing live-status dot is urgency theater; session state is peripheral information. |
| 5 | Recharts for sparklines/scatter | Keep hand-rolled SVG + lightweight-charts | No new chart dependency; our SVG components already exist and are unit-tested. Restyle, don't replace. |
| 6 | AM Plan / PM Scorecard tabs on the brief | Our brief keeps its labeled slots; the evening scorecard stays its own module | The tabs assume a two-briefing product; ours is one evening pipeline (9:00pm ET promise). Don't redesign the product to fit a mock. |
| 7 | "Next 21 days" calendar header | "Next 14 days" (the ingest window) | Never claim a window the pipeline doesn't fetch. |
| 8 | Emerald/amber tier text at ~3.7:1 contrast | Same hues, darkened one step (AA table in §3.3) | Tier words must clear 4.5:1 — the honesty layer is never the least legible thing. |
| 9 | Options-expiry (OPEX) rows in the calendar | Omitted | Not in our product's catalyst model; adding data sources is out of scope for a redesign. |
| 10 | Track-record hit/miss in blue/orange text only | Blue/orange **chips with the word inside** | Outcome must never rely on color alone (colorblind rule) — the word is the redundant channel. |
| 11 | Login backed by `useState(false)` | Our real login wall (`proxy.ts`) unchanged | Auth is not a styling concern; only `LoginForm` and the page shell restyle. |
| 12 | Figma's `--color-warn #d97706` free-floating; tier chips in green/amber/gray | The **entire amber–orange band is reserved** for down/loss and the two alert consumers; tier-moderate and grade-mixed move to teal (§3.3) | Reservation is perceptual, not hex-deep: a Desk full of amber "moderate" chips would drown the gate flag even if no chip shared its exact value. |
| 13 | Accent-indigo on small sub-labels, **muted** gray on the big mastheads/eyebrows (see `MarketPulse.tsx:23`) | Same: module mastheads stay muted; accent appears only on interactive text and the small in-card slot labels ("WHAT FIRED", brief slots) | Eight indigo mastheads would make the accent mean "chrome" as often as "you can act here". The Figma got this right; an earlier draft of this plan inverted it and was corrected in review. |
| 14 | Orbs frozen at the mock's coordinates (480px top-right, 380px bottom-left, composed for a short single-column frame) | Orbs re-derived for a long-scroll two-column product: viewport-ambient light, resized/repositioned per breakpoint, opacity halved on phone (§3.4, Appendix A) | The wash and orbs survive translation because they are *light*, not content — viewport-anchored ambience is what morning light is. Their geometry did not survive; it was composed for a different frame. |
| 15 | Progressive left-to-right chart animation (Recharts default) | Charts appear as **completed wholes** (200ms opacity fade at most); no directional draw-in anywhere | A left-to-right sweep on a price series reads as momentum — "…and then" — priming a directional expectation right next to visuals that insist they are not forecasts. |

### 1.4 The one-liner (replaces "Broadsheet Terminal" in CLAUDE.md)

**"Morning Broadsheet":** editorial serif over mono numerals, one morning-light lavender wash
across the whole app, glass cards with soft depth, hairlines inside cards, one hero figure,
honesty furniture on every claim. One theme at a time — light "Morning" or dark "Midnight" —
governs every room; the Desk and the Academy differ in structure and pace (instrument vs
reading room), never in palette. Color is scarce and always means something. If it could be a
template — austere *or* glossy — it is wrong.

---
## Part 2 — The constitution: what is amended, what is preserved, and why

*The user is deliberately relaxing the aesthetic rules and deliberately keeping the honesty
rules. This part is the legal text: every amended clause and every preserved clause, with the
file and line it lives in, so no document contradicts another. The doc edits themselves are
executed with this plan (Part 10) — Opus never has to reconcile two constitutions.*

### 2.1 AMENDED — aesthetic rules relaxed by user directive (2026-07-11)

| # | Old rule (verbatim anchor) | Lives in | New rule |
|---|---|---|---|
| A1 | "no card shadows, no decorative borders" (RR §9.7); "drop shadows on cards (the drawer scrim is the sole shadow)" (plan §3.1 banned list) | `docs/src/rr-04.html` §9.7, `DEVELOPMENT-PLAN.md` §3.1/§3.4 | Soft elevation is allowed through **shadow tokens only** (`--shadow-soft/-lift/-overlay`, §3.4). Arbitrary shadows stay banned by grep. |
| A2 | "gradients and glassmorphism" banned (plan §3.1) | same | Gradients and glass allowed through **gradient/surface tokens only** (`--gradient-brand/-wash/-range`, glass surfaces §3.4). Raw `linear-gradient(` outside `globals.css` stays banned by grep. |
| A3 | "`rounded-2xl` softness — the app's radius is 2px" (plan §3.1, §3.4) | same | Radius scale: 16px cards, 12px panels, 10px controls, 8px chips, pill for tabs/dots (§3.5). Arbitrary `rounded-[…]` stays banned. |
| A4 | "colored-chip confetti" banned; tiers render as neutral gray chips (plan §3.1, RR §9.7) | same | Colored soft-wash chips allowed with AA text and a non-color redundant channel (the word itself). Tier chips get color (§3.3). "Confetti" (color without meaning) stays banned in the checklist. |
| A5 | "purple anything" banned (plan §3.1) | same | Indigo/violet is now the accent family. The ban is repealed outright. |
| A6 | Motion: 160/200ms fades only; "nothing else moves" (plan §3.5) | same | General UI motion allowed per the motion system (§3.6): page transitions, hover lifts, drawer slides, chart draw-in, micro-interactions. The probability/money stillness rule survives verbatim (P6 below). |
| A7 | "Data refreshes fade in over ~500ms" / calm-tech framing of §9.7 | `rr-04.html` §9.7 | Calm is preserved as **no urgency, no loops, no autoplay** — not as "no motion." Rewritten in the amendment note. |
| A8 | Skeleton shimmer banned (plan §3.1) | same | A single quiet shimmer (1.6s, low-contrast, reduced-motion-aware) is allowed on loading placeholders. Never on probability/money placeholders — those load as text. |
| A9 | "If it could be a default template, it is wrong" aimed at SaaS gloss | CLAUDE.md one-liner; plan §3.1 | Kept, but re-aimed at both failure modes: default-austere and default-glossy (§1.4). |
| A10 | Dark values #131412 family ("dark bone") | `globals.css`, plan §3.3 dark column | Re-derived as "Midnight" (deep indigo night), now app-wide per A11. |
| A11 | **"Dark mode is Desk-only; the Academy stays light — long-form reading favors positive polarity"** (RR §9.7 last clause; DECISIONS 2026-07-11 P6 entry; `theme.spec.ts`) | `rr-04.html` §9.7; DECISIONS.md; e2e | **Repealed by user directive (2026-07-12, D1/D4): one theme governs the entire app** — dark means everything is dark, Academy included. This knowingly supersedes the positive-polarity reading rationale; the user chose a single coherent theme over it. Room distinction becomes structural (type, spacing, density — §5.6), never palette. `data-theme` moves to `<html>`; `theme.spec.ts` now asserts the Academy DOES theme. |

### 2.2 PRESERVED — honesty rules that survive unchanged (non-negotiable)

| # | Rule | Lives in (unchanged) | Redesign consequence |
|---|---|---|---|
| P1 | **No point predictions.** No single projected line for where a price is headed. Forecasts are range bands with frequency labels and quantile dotplots. | RR §8.1, §9.8; plan §1.5.1 | The range-band ladder becomes the app's *visual centerpiece* (§5.5) — beautiful, layered, still honest. It has **no 50th-percentile mark of any kind** (no stroke, no tick, no label at the median); bands are labeled by coverage frequency only. And it is deliberately NOT drawn as a forward-widening cone (§3.8) — a cone silhouette reads as a projection even when labeled historical. |
| P2 | **No motion on probability visuals.** Base rates, dot arrays, CI bars, calibration charts, vol/range bands, Brier figures render complete on first paint. No draw-in, no easing, no ticking numbers — ever. **No ancestor may move them either:** no transform, reveal animation, or transition on any element containing a P2 component. The single sanctioned ancestor animation is the uniform route fade (§3.6) — opacity-only, no translation, every frame shows the visual complete and unmoving relative to everything else. | plan §3.5 (kept clause), §9.7 "probability visuals are motionless" | Every P2 component root carries a `data-p2` attribute; the motion system (§3.6) carves them out, the grep v2 checks their files, and a DOM-level test walks up from every `[data-p2]` node asserting no animated/transformed ancestor (§3.10). General UI motion never leaks in — not even from wrappers. |
| P3 | **No composite buy/sell gauges** or "Technical Rating: BUY" aggregates. | RR §9.8 | Nothing in the Figma asks for one. Stays banned; §9.8 row untouched. |
| P4 | **No bare percentages.** Every base rate ships with N and its Wilson CI; N-gate (suppress <30, no CI 30–99, full ≥100); WEAK cap when the CI spans the always-up baseline. | plan §1.5.2; `components/BaseRate.tsx`; skill `base-rate-display` | `BaseRate` remains the sole renderer, restyled only. The card-level proportion bar prints counts (§1.3 #1). |
| P5 | **Misses stay first-class; the log stays append-only.** No win-only track record. | plan §1.5.7; DB triggers | Track-record redesign shows hits and misses with equal visual weight — chips differ in hue, never in size or emphasis (§5.4). |
| P6 | **No trending/most-bought surfaces; no gamification** (streaks, XP, confetti); no urgency theater; no anthropomorphic AI voice. | RR §9.8; plan §1.5.8 | No leaderboards, no pulse animations, no celebratory states anywhere in the new system. Review queue stays timer-free and score-free. |
| P7 | **Gain/loss is colorblind-safe and redundantly encoded.** A delta never relies on color alone. | plan §3.3; RR §9.7 | New pair #2563eb/#ea580c is colorblind-safe; triangles + signs + words remain mandatory. Hollow/filled candles kept. Dot arrays: filled hit vs **hollow** miss (shape channel added, §3.8). |
| P8 | **Movers need a catalyst or the noise line.** | plan §1.5; `copy.mover.noNews` | Row anatomy keeps the catalyst zone; noise renders muted italic, never hidden. |
| P9 | **LLM narrates, never computes; the verification gate blocks unverified numbers.** | plan Appendix E | Pure pipeline concern; untouched by the redesign. Amber gate flag keeps its reserved color (P11). |
| P10 | **Desk/Academy separated, doorways + return rails; paper-first; login wall.** | plan §1.5; `proxy.ts` | Rooms keep separate shells, routes, doorways, and return rails — the separation is navigational and structural. Per D1/D4 they now share one palette and one theme; the felt switch comes from material and typography (§5.6), not color temperature. |
| P11 | **Amber is reserved.** The consumer list is short, closed, and every entry is argued in place. **The register is `app/scripts/check-drift.mjs`'s `ALERT_ALLOWED` — it is the truth; do not restate the count here.** *(Amended 2026-07-13, G4: this row used to say "exactly two consumers" and had been wrong since N2 — two logged structural amendments had added PipelineStrip's AGING state and MacroBoard's STALE cell. A count restated in four documents is a count that rots; the register is one file, and it runs.)* | plan §3.3; `ALERT_ALLOWED` | Survives the colored-chip amendment: tier-moderate and grade-mixed get their **own** amber-adjacent hexes so no chip shares the alert token. Grep stays. |
| P12 | **Mechanical voice; all copy from `copy.ts`; timestamps everywhere; numbers only via `BaseRate`/`format`.** | CLAUDE.md; plan §3.9 | New copy strings (Appendix B) follow the deck's voice. Every surface keeps its as-of stamp. |
| P13 | **Position/length over angle/area** — no gauges, donuts, speedometers. | RR §9.7 last clause | Kept verbatim; it is an honesty-of-perception rule, not an austerity rule. |
| P14 | **One hero figure per view.** | plan §3.1 required list | Kept — it is information hierarchy, and it is also what makes the new hero beautiful. |

### 2.3 Why the line sits exactly here

Every amended rule is about **how the product feels**; every preserved rule is about **whether
the product can lie**. Shadows, radii, gradients, and motion cannot make a claim; a projected
line, a bare percentage, a win-only log, an animated probability, or a color-only delta can.
The test applied to each clause was: *"could a beginner be misled if this rule flipped?"* — if
yes it stayed, if no it moved to taste and the user's taste now says warm and modern.

---
## Part 3 — The design system

*Every value the build needs, as tokens. Appendix A is the paste-ready `globals.css` v2 —
this part explains the values; the appendix is the artifact. The token discipline is
unchanged: one sheet, `@theme static`, no hex anywhere else (except `lib/tokens.ts` for the
OS-facing constants), `/styleguide` renders it all, greps enforce it.*

### 3.1 Type families (four, no more)

| Token | Family (next/font) | Weights/styles | Role |
|---|---|---|---|
| `--font-display` | **Playfair Display** | 700, italic 400 (600 dropped — R6) | Page titles, card titles, the Desk date hero, pull quotes. **Never a number, never body text.** |
| `--font-ui` | **Inter** | 400, 600 (500 dropped — R6) | Every label, control, table cell, nav item. Replaces Archivo. |
| `--font-mono` | **JetBrains Mono** | 400, 500, 600 | Every numeral in the product, plus mastheads, tags, provenance lines. Replaces IBM Plex Mono. |
| `--font-prose` | **Newsreader** | as today (roman+italic) | Academy lesson bodies, briefing paragraphs, and **small-size editorial italics** (setup pattern names) — Playfair is a display face; Newsreader is the text serif. They do different jobs. |

Rules: numerals are mono without exception (unchanged law). Mastheads move from Archivo
Expanded to JetBrains Mono uppercase with `tracking-[0.08em]` — the Figma's masthead voice.
**Serif floor:** Playfair renders only at `--text-title` (19px) and above, and never italic
below the display sizes; editorial italics at card sizes are Newsreader italic (a text serif
holds its hairlines at 15–19px; a display serif does not). `lib/fonts.ts` swaps loaders; all
four via `next/font/google` (self-hosted at build, no runtime Google requests — PWA/offline
unchanged; next/font's automatic metric-adjusted fallbacks stay on so a slow load keeps line
geometry). **Playfair loads with `display: "swap"`** — it sets headlines, and a permanently
missed `optional` swap would ship Georgia headlines for the session (§7.4). Font budget: raise
`scripts/check-font-budget.mjs` limit from 320KB to **560KB**, and R1 prints the actual
per-file woff2 sizes into the script output. If the total exceeds budget, the drop order is:
Inter 500 (600 covers emphasis), then Playfair 600 (700 covers titles) — **never Playfair
italic 400**, which the login headline and pull quotes depend on.

> **Amended 2026-07-12 (R6), by measurement.** Playfair 600 and Inter 500 are NOT shipped. The drop
> ladder above was written to fire "if the total exceeds budget"; the budget was never exceeded
> (243KB of 560KB). It fired for a different and better reason: Lighthouse on the deployed app
> returned performance 86 with an LCP of 3.8s, while Total Blocking Time was **20ms** — proof that
> the glass, the wash and the orbs cost nothing, and that §7.4's fallback ladder (strip translucency,
> then remove the orbs) would have degraded the design for no gain at all. The page was fetching
> **ten font files, 429KB**. Dropping the two weights this ladder already nominated took performance
> to **93** with the design intact. Every `font-semibold` on Playfair and `font-medium` on Inter was
> then swept to a weight we actually ship — a weight you no longer load is a weight the browser
> SYNTHESISES, and fake bold is precisely what a type-led system exists to prevent. Logged in
> DECISIONS.md.
>
> It also exposed that `check-font-budget.mjs` under-reports: it counts basic-latin faces, but Google
> splits every family into latin AND latin-ext, and a real browser takes both. The budget read 273KB
> while the browser pulled 429KB. Narrow, not wrong — but it had been flattering us by ~60%.


### 3.2 Type scale (existing scale kept, four additions)

The px scale in `globals.css` survives (11 → 64px, paired line-heights). Additions:

| Token | Value | Use |
|---|---|---|
| `--text-title: 19px` / lh 1.3 | card/module titles set in `--font-display` 600 |
| `--text-display: clamp(30px, 4vw, 46px)` / lh 1.1 | page-level serif headline (Desk date, room titles, login) |
| `--text-display-hero: clamp(38px, 5vw, 56px)` / lh 1.05 | login brand panel only |
| `--text-input-touch: 16px` | form controls below `md` — iOS zooms-on-focus any input under 16px and never zooms back; every `<input>/<textarea>/<select>` renders at ≥16px on touch, whatever the surrounding UI scale (§4.1 lists the components this hits) |

The 64px `--text-hero` numeral (48px phone) is untouched — the hero figure law holds. Body
UI stays 13.5px/15px; prose stays 17.5px Newsreader (Academy line-height rises to 1.7, §5.6).

### 3.3 Color

Full literal tables live in Appendix A (light Desk, Midnight Desk, warm Academy). The system:

**Neutrals (Desk, light).** Paper `#f9f8ff`; wash gradient stops `#f9f8ff → #eef2ff → #f0f4ff
→ #faf8ff` (145°); ink `#0f0d1a`; ink-2 `#3d3a4f`; muted `#6e6c80` (Figma's `#7c7a8e` darkened
one step — it measured ≈3.9:1 on paper; provenance text must clear 4.5:1); faint `#a9a7b8`
(placeholders/disabled, non-text ≥3:1 only); hairline `rgba(99,88,143,0.13)`, hairline-strong
`rgba(99,88,143,0.24)`.

**Accent (interactive only, never on data or status).** `--color-accent #6366f1` (washes,
icons, marks), `--color-accent-deep #4f46e5` (text/links on light — 4.9:1), `--color-accent-soft
rgba(99,102,241,0.10)` (active-pill washes), `--color-accent-muted rgba(99,102,241,0.06)`
(tinted panels). `--gradient-brand: linear-gradient(135deg,#4f46e5,#7c3aed)` — exactly two
consumers: the logomark tile and primary buttons. Petrol is retired. The market-state dot in
the nav is **not** accent (it is status, not an affordance): muted when closed, ink when open,
always beside its text label.

**Band (uncertainty fills — data, non-directional).** `--color-band: #6d648c`, used at
tokened alphas for range-band fills, and nothing else. It is deliberately grayer than the
accent so an uncertainty band never reads as clickable, and deliberately not the up/down pair
so a symmetric historical range never carries directional valence.

**Semantic pair (data only).** Up `#2563eb` / down `#ea580c` for chart strokes, candle
bodies, triangles, ≥21px figures. Text variants at ≤18px: up-text `#1d4ed8` (≈6.3:1), down-text
`#c2410c` (≈5.1:1) — Figma's `#ea580c` measured ≈3.6:1 on white, below AA. Soft washes
`rgba(37,99,235,0.08)` / `rgba(234,88,12,0.08)` for delta chips. Redundant encoding stays
mandatory (triangle + sign + word).

**The amber–orange band is reserved as a REGION, not a hex.** Its only occupants: the
semantic down/loss pair and the two alert consumers (`--color-alert #8a5200`, wash retuned
`#f7ead0`). No chip, tier, grade, importance marker, or module hue may sit anywhere in the
amber–orange range — reservation is about perceptual salience; a Desk full of amber-ish
"moderate" chips would drown the gate flag even with disjoint hexes. This is a stated rule in
the styleguide and an eyeball item in §3.10.

**Tier chips (colored, AA text on their washes, word always inside).** strong `#047857` on
`rgba(5,150,105,0.10)`; moderate **teal `#0f766e`** on `rgba(13,148,136,0.10)` (moved out of
amber per the rule above — the green→teal→gray ramp is ordinal, which suits an evidence
scale); weak `#6e6c80` on `rgba(124,122,142,0.10)`. WEAK-cap logic untouched.

**Evidence grades (inside `Tag` only, never without their word).** supported `#047857`,
mixed **`#0f766e`** (same reasoning — "middle of the evidence scale" reads consistently
across both taxonomies), weak `#a13d22`, folklore `#b91c1c`. Rust/red sit outside the
reserved amber–orange band's center and always carry their word.

**Midnight (D1 — app-wide).** One dark column themes every route, the Academy included (the
"Academy stays light" rule is repealed — Part 2 A11). Paper `#14121f`; wash `#14121f →
#191627 → #151329`; surface glass `rgba(30,27,48,0.72)`; ink `#ece9f8`; ink-2 `#c3c0d6`;
muted `#918ea6`; hairline `rgba(167,157,210,0.16)`; accent `#818cf8`, accent-deep(text)
`#a5b4fc`; band `#8f86b8`; up `#60a5fa` / up-text `#93c5fd`; down `#fb923c` / down-text
`#fdba74`; alert `#e0a83e` / wash `#3a2f14`; tier-moderate teal family; grade dots keep the
P6 dark values except mixed → teal. Orb opacity halves. Shadows deepen (`rgba(0,0,0,0.45)`)
and every glass surface gains a visible hairline (shadows barely read on dark; the border
carries the edge). **Mechanism:** `data-theme` is stamped on `<html>` by the root layout from
the theme cookie, pre-paint — the Desk-shell scoping from P6 is retired (§8 R2).

**The Academy on the shared palette (D4 — one material world).** No Academy tokens exist:
both rooms read the same sheet in both themes. The room's identity is structural (§5.6) —
its cards are **solid** (`--color-surface-solid`) instead of glass, its headers are serif
kickers instead of terminal mastheads, its type is set for reading. Module category hues
(decorative only, §5.6): foundations dusk-blue `#4a5a8c`, structure sage `#5b7a4f`, patterns
plum `#7a4a6b`, risk rose `#9c4460`; dark twins `#8ba3e8` / `#93b587` / `#b98bb0` / `#d081a0`
— none in the amber–orange band, none equal to the accent.

**Contrast contract.** Every text token/surface pair above was hand-computed to ≥4.5:1 (or
≥3:1 for ≥21px figures). R1 adds a **contrast table to `/styleguide`** (computed live from
tokens with a tiny luminance helper) and a unit test that fails if any named pair drops below
its threshold — drift-proof, not vibes-proof.

### 3.4 Surfaces and elevation

| Level | Class | Recipe | Used by |
|---|---|---|---|
| L0 wash | `.app-wash` | fixed-position layer: wash gradient + two orbs (`--orb-1/2` radial tokens). `aria-hidden`, `pointer-events:none`, `z-0`. **Never `background-attachment: fixed`** (iOS). | both room layouts |
| L1 card | `.surface` | `--color-surface`, `--radius-card`, hairline border. **No blur.** | every Desk module card |
| L2 raised | `.surface-raised` | `--color-surface-raised` + `--shadow-soft` + hairline. **Blur only ≥lg** via `lg:backdrop-blur-xl`. | stat cards, hover-emphasized cards |
| L3 sticky | `.surface-bar` | `--color-surface-bar` (paper at 85% alpha) + `backdrop-blur-lg` + hairline edge | top nav, bottom tab bar |
| L4 overlay | `.surface-overlay` | `--color-surface-overlay` (96% alpha) + blur + `--shadow-overlay` over `--scrim` (`rgba(15,13,26,0.4)` + 4px scrim blur) | rail, sheet, palette, popover |

These five class bodies (and the `@supports not (backdrop-filter: blur(1px))` solid
fallback) are **written out in Appendix A** — the executor pastes, never invents. All surface
alphas are tokens with dark twins. One Tailwind v4 caveat, stated here so nobody trips on it:
`rgb(r g b / a)` color tokens work as utilities (`bg-surface`), but the slash-opacity
modifier (`bg-surface/50`) silently no-ops on them — never use it; if a new alpha is needed,
mint a token.

Shadow tokens: `--shadow-soft: 0 4px 24px rgba(99,88,143,0.08), 0 1px 4px rgba(0,0,0,0.04)`;
`--shadow-lift: 0 6px 24px rgba(99,88,143,0.12)`; `--shadow-overlay: 0 8px 40px
rgba(99,88,143,0.15)`. Dark variants in Appendix A.

**Blur budget (hard rule, grepped):** `backdrop-blur` may appear only in the five sanctioned
components: top nav, bottom tab bar, RailDialog, CommandPalette, GlossaryPopover. Cards never
blur on phones. **iOS radius clipping:** Safari does not clip `backdrop-filter` to
`border-radius` on the same element — every rounded blurred surface wraps its blur in an
inner element with `overflow:hidden` (the `.surface-bar`/`.surface-overlay` recipes in
Appendix A encode this shape). `prefers-reduced-transparency` falls back to solid surfaces
**at every theme scope** — the override must be declared for `:root`, `[data-theme="dark"]`,
and `[data-theme="system"]` alike, because a custom property resolves at the nearest defining
ancestor and a `:root`-only override loses to the theme blocks (Appendix A encodes this too;
the Academy needs no extra scope — its surfaces are solid by design and it shares the one
sheet).

### 3.5 Shape

`--radius-card: 16px` · `--radius-panel: 12px` (nested tinted panels) · `--radius-control:
10px` (inputs, buttons) · `--radius-chip: 8px` · `--radius-pill: 999px` (nav pills, dots,
bars). `--radius-edge` (2px) is **deleted, atomically**: R1 performs a global class rename in
the same commit that lands the new sheet (§8 R1) — Tailwind emits no error for a utility
whose token vanished; it just stops styling, so orphaned classes are found by grep, not by
the compiler. Arbitrary radii stay banned.

### 3.6 Motion

Tokens: `--duration-quick: 150ms` (hover, focus, chips) · `--duration-fade: 200ms` (reveals,
page transitions, chart appearance) · `--duration-slide: 240ms` (rail/sheet) ·
`--ease-quiet: cubic-bezier(0,0,0.2,1)` (the only easing; no springs, no bounce).

**Allowed:**
- Hover/focus color shifts (150ms). Hover **lift** (translateY(-1px) + `--shadow-lift`) only
  on surfaces whose subtree contains **no** P2 component — a transform on an ancestor moves
  the probability visual inside it. P2-containing cards get border/shadow/background hover
  feedback only, no translation.
- Route transitions: a `template.tsx` in each room shell applies a **200ms opacity-only
  fade** on segment mount. No translateY, no scale — the page appears as one settled sheet;
  every frame shows every visual complete and unmoving relative to everything else. This is
  the single sanctioned animation that may contain a P2 subtree, and the reason it may is
  exactly that it contains no relative motion. Pure CSS, no experimental flags, no library.
- Rail/sheet slides (240ms), palette fade+scale (0.98→1 — contains no P2 content), popover
  fades, chevron rotations on `<details>` summaries.
- `<details>` content fade — **except** any `<details>` whose subtree contains a P2 component
  (setup cards do: BaseRate, range panel). Those reveal instantly, and a DOM-level test
  enforces it (§3.10).
- Chart appearance: charts fade in **as completed wholes** (200ms opacity, once, on initial
  mount, never on data refresh). **No progressive or directional reveal anywhere** — a
  left-to-right sweep on a price series reads as momentum. (This deletes the earlier
  `--duration-draw` concept; there is no draw-in in this system.)
- The single quiet skeleton shimmer (1.6s, low-contrast) on loading placeholders — never on
  probability/money placeholders, which load as text.
- **The signature micro-interaction — the provenance reveal.** The one interaction that could
  only be this product: every masthead's as-of stamp is interactive; hover/tap fades in
  (150ms) the full provenance chain inline — "FRED · prior close · fetched 8:41 PM ET".
  Motionless by default, P2-safe (it is chrome text, not a probability visual), and it turns
  the app's honesty obsession into its most-touched gesture. Specified once in
  `SectionMasthead` (§4.1), inherited by every module.

**Forbidden (the P2 carve-out, enforced structurally):** `BaseRate`, dot arrays,
`CalibrationScatter`, `RangeBands` (né VolBandPanel), `QuantileDotplot`, proportion/breadth
bars, Brier figures, `StatFigure` deltas — these render complete on first paint. No
`transition`/`animation` inside their files, **and no animated or transformed ancestor above
them**: every P2 component root carries a `data-p2` attribute, and a unit test (jsdom) walks
ancestors of every `[data-p2]` node asserting none carries a transition/animation/transform
(route-fade `template` exempted by its known class). Numbers never tick, count up, or roll
anywhere in the app. Nothing loops. Nothing autoplays. Nothing moves to attract attention.
`prefers-reduced-motion` still zeroes every duration globally.

*Why a candle chart may fade in while a range band may not even do that:* the candle chart is
a record; fading in a completed record is showing a photograph. The range band is a claim
about uncertainty; any entrance treatment reads as "the forecast is arriving." Records may
appear; claims are simply there.

### 3.7 Iconography

`lucide-react` (already in the Figma's vocabulary), 16px at 1.75px stroke (24px in the bottom
tab bar), color `--color-muted` default / `--color-accent-deep` active. Functional icons only:
nav tabs, close/expand, check/alert list markers, the Settings gear, the palette hint. Never
decorative rows, never emoji, never an icon where a word fits better. New dependency — add to
`app/package.json` in R1.

### 3.8 Charts (the visual highlight)

Shared grammar: hairline grid (dashed 2/4, `--color-hairline`), mono 11px axis ticks, tooltip
= L4 mini-panel (hairline border, mono values, 150ms fade), every chart carries its as-of
stamp and source line. Specifics:

- **Candle chart** (`ticker/CandleChart`): keeps lightweight-charts, hollow-up/filled-down.
  Reads the new tokens automatically (`getComputedStyle` hook unchanged). Appears as a
  completed whole (fade), never sweeps.
- **Sparklines** (`Watchlist`): 1.5px stroke in up/down by 14-day direction + a soft area
  fill via the tokened `--gradient-spark-up/down` (12% → transparent). The in-mark color is
  color-only by nature; it is legal **only because** the adjacent price + delta chip carries
  the triangle/sign/word redundancy — that dependency is stated in the component comment.
- **The Range Ladder** (`ticker/RangeBands.tsx`, NEW — replaces `VolBandPanel`'s list as the
  primary render; §5.5 owns the page spec). One row per horizon (5d / 10d / 20d, the ≤20d rule
  unchanged), each row a horizontal band on a **signed-return axis**: outer band = the 80%
  historical range (`--color-band` at 10%), inner band = the 50% range (at 22%), band edges
  1px `--color-hairline-strong` with mono 2xs percentile labels, a 1px **ink** zero line
  labeled "0% = last close" (the one strong anchor), and the row's 20-dot quantile dotplot
  rendered *inside* the outer band — the honesty furniture literally is the texture. Labels
  reuse the pinned `copy.volband.label` ("In the past, 8 in 10 {h}-day paths from here stayed
  inside this range") + mandatory `volband.caveat`; N and window printed per row. **No
  50th-percentile mark of any kind. No connecting silhouette between horizon rows** — joining
  the bands into a cone would redraw the forecast-fan the product refuses to be; the ladder of
  discrete horizons is the honest fan, sliced. Static, `data-p2`.
- **Quantile dotplot** (`QuantileDotplot`, standalone + embedded in the ladder): 20 dots = 20
  equal-probability historical outcomes, 9px; above zero = filled `--color-up`, below = hollow
  `--color-down` with **full-opacity 1.5px stroke** (the shape channel must survive at dot
  size). Caption: `copy.dotplot.caption`. Static, `data-p2`.
- **Dot array** (inside `BaseRate` detail): every dot = one case (never scaled); hits filled,
  misses hollow with the same 1.5px full-opacity stroke rule; 9px, 3px gap, wraps; legend with
  counts. Static, `data-p2`.
- **Proportion bar** — lives **inside `BaseRate` only** (it is a base-rate display, so the
  N-gate, CI, baseline, and WEAK cap must travel with it — no other component may render an
  "X of N" visual, and §3.10 greps for strays). Equal-visual-weight encoding: both segments
  at the same alpha (hits `--color-up` 35%, misses `--color-down` 35%), lengths carry the
  proportion, printed counts carry the numbers — saturation never exaggerates the majority.
- **Calibration scatter** (`CalibrationScatter`): keeps radius∝√N; hits/misses as
  filled/hollow; dashed diagonal labeled "perfect calibration" in mono 2xs. Static, `data-p2`.
- **Breadth strip** (MacroPulse): slim pill bar, advancing/declining segments at **equal
  alpha** (35%), mono adv/dec counts adjacent. Static, `data-p2`.

### 3.9 Spacing & layout

4px base grid (unchanged). Card padding 20px (24px ≥lg). Module gap 24px. Page gutters 16px
phone / 32px desktop. `max-w-[1360px]` container kept. Desk becomes **two-column at `desk:`
(1366px)** — a broadsheet spread, deliberately: the main column keeps the narrative ritual in
order (Pulse full-width, then Brief → Movers → Setups → Scorecard) and the 340px sidebar
holds the *reference* modules a reader glances at rather than reads through (Watchlist,
Calendar in its compact variant §5.1, SourceStatus). The ritual's strict 1→8 order remains
the invariant on phone and in the DOM (grid areas place the sidebar; tab order = ritual
order). This is how a front page works: sequence in the main column, standing matter in the
rail. Touch targets ≥44×44px on every interactive element.

### 3.10 Anti-drift checklist v2 (run at every phase exit, replaces plan §3.10 greps)

> **[Amended 2026-07-13, G4 — this section is MECHANIZED, and the script is the truth.]** The list
> below is the prose ancestor of `app/scripts/check-drift.mjs` (`npm run check:drift`), which today
> carries **21 rules** and runs in CI on every branch push (since G0 — before that it ran in no CI
> workflow at all). Where this text and the script disagree, **the script wins**: it is the thing
> that executes. Read this section for the *reasoning* behind a rule; read the script for what the
> rule actually is. Do not restate rule counts or consumer lists here — cite the file. (This
> section once described eleven greps and named a component that does not exist, while the script
> had grown past it. Two sources of truth for one document is a slow-motion lie.)

Mechanical greps — must all be empty outside `app/globals.css` + `lib/tokens.ts`
(items marked ⊕ are new since the adversarial review):
1. Hex colors anywhere else (excluding the two sanctioned files, SVG fixtures).
2. Raw gradients: `linear-gradient|radial-gradient` outside `globals.css`.
3. Arbitrary shadows/radii: `shadow-\[|rounded-\[`.
4. `backdrop-blur` outside the five sanctioned components (§3.4).
5. Amber tokens (`alert`) outside the sanctioned consumers — **the register is `ALERT_ALLOWED` in
   `check-drift.mjs`, not a number written here** (G4, 2026-07-13).
6. Motion on P2 **files**: `transition|animate|@keyframes` inside `BaseRate.tsx,
   CalibrationScatter.tsx, RangeBands.tsx, QuantileDotplot.tsx, StatFigure.tsx,
   SetupCards.tsx, MacroPulse.tsx` (the last two carry inline P2 marks today) — plus the
   ⊕ **jsdom ancestor test**: no animated/transformed ancestor above any `[data-p2]` node.
7. Font families beyond the four loaded; `small-caps`; ⊕ `font-stretch-\[` (dead once Archivo
   leaves); count-up/ticker libraries; confetti/particle libraries.
8. `background-attachment` anywhere.
9. ⊕ Dead legacy classes after the R1 rename: `desk-bg|academy-bg|rounded-edge|font-stretch-\[`
   (the R1 mapping table, §8) — Tailwind drops unknown utilities silently, so only this grep
   catches them.
10. ⊕ Base-rate strings outside `BaseRate`: `of \{?\d| of (n|N)\b` display patterns / "N=" +
    percentage pairs rendered anywhere except `BaseRate.tsx` (the sole renderer rule made
    mechanical).
11. ⊕ Slash-opacity on token colors (`bg-surface/`, `border-hairline/` …) — silently no-ops
    in Tailwind v4 with `rgb(/)` tokens; must be empty.

Eyeball checks against fresh screenshots (each applies only once its surface exists — R1
gates on the styleguide only; the wash item starts at R2): one hero figure per view; every
module masthead numbered + stamped; chips always carry words; misses visible wherever hits
are; the wash present but never in front of content; **nothing in the amber–orange region
except losses and the two alert consumers**; nothing moves after first paint on a settled
page except pointer feedback.

---
## Part 4 — Components

*Shared primitives first, then the shell, then overlays. Every spec names the file, what
changes, and what must not. "Restyle" always means: markup semantics, server/client split,
aria, and tests' assertions on CONTENT stay; only classes/tokens and layout change.*

### 4.1 New shared primitives (R1 builds these; later phases consume them)

**`components/Surface.tsx`** — the card, at last a component instead of repeated class
strings. Props: `level` (`card` | `raised` | `tinted`), `as` (default `section`), className
passthrough. Recipes from §3.4 (the class bodies are in Appendix A); `tinted` =
`--color-accent-muted` bg + accent-15% border + `--radius-panel` (the Figma's base-rate
panel). Migration is incremental: each phase converts the surfaces it touches; the grep for
leftover `border-hairline bg-surface` combos happens at R6, not before.

**`components/AppWash.tsx`** — the L0 wash layer: `<div aria-hidden class="app-wash">` with
two orb children. `data-theme` lives on `<html>` (D1), so the wash reads the active theme's
`--gradient-wash` from anywhere in the body; mount it once per room layout as the first
child, with all content in a sibling `relative z-10` wrapper. One wash, both rooms, both
themes — no props.

**`SectionMasthead` v2** — anatomy unchanged (index number · title · rule · timestamp).
Restyle: title stays mono uppercase **in `--color-muted`** (the Figma's eyebrow voice —
accent on eight mastheads would make indigo mean "chrome"; accent belongs to interactive text
and small in-card slot labels only); the 2px ink rule becomes 1px `--color-hairline-strong`;
the index number renders in `--color-faint`. **The timestamp is the signature interaction
(§3.6):** rendered as a faint chip; hover/tap fades in the full provenance chain inline
("FRED · prior close · fetched 8:41 PM ET") from a new `provenance` prop. One component, every
module inherits the gesture.

**`StatFigure` v2** — hero/figure/body scales unchanged, hero always ink (law). The delta
moves into a **soft chip**: mono text in up-text/down-text on the matching wash,
`--radius-chip`, triangle + sign kept. Root carries `data-p2`. Law kept and re-asserted in
the file comment: semantic color never exceeds `--text-num-lg`.

**`Tag` v2** — variants and word-always rule unchanged; visuals: `--radius-chip`, soft washes
per §3.3, 6px round dot replaces the 2px square (pill amendment). `tier` variant now colored
(strong green / moderate teal / weak gray tokens); `catalyst` stays neutral (ink on
`rgba(99,88,143,0.08)`); `folklore` uses grade-folklore on an 8% wash of itself.

**Buttons** (recipe block in `/styleguide`, still inlined per surface — a Button component is
NOT required, matching current architecture): primary = `--gradient-brand` white text,
`--radius-control`, hover brightness 1.05 + `--shadow-lift`; secondary = surface + hairline
border, hover border-strong; destructive-quiet = down-text text + hairline; all ≥44px tall on
touch, `disabled:opacity-60`. **Exception (unchanged product rule):** in the cooling-off
interstitial, "Sit with it" takes the primary style and "Proceed" the secondary — friction is
the point.

**Inputs** — surface bg at 70% alpha, hairline border, `--radius-control`, 12px/14px padding;
focus: border `--color-accent` + `0 0 0 3px rgba(99,102,241,0.12)` ring (replaces petrol
outline app-wide via the `:focus-visible` global). Labels stay mono 2xs uppercase muted.
**Touch rule (§3.2):** below `md`, every `<input>/<textarea>/<select>` gets
`--text-input-touch` (16px) — iOS zooms on any focused control under 16px and stays zoomed.
Components this hits (update each): `LoginForm`, `PaperEntryForm` (all fields + selects),
`JournalPrompt`, `AddWatchlistForm`, `ForecastResolver`, `CommandPalette` input,
`PaperLedger` close form.

**`OfflineRibbon` / `SourceStatusFooter` / `ExternalLink`** — content and behavior untouched;
ribbon becomes a neutral L1 strip (never amber — P11), footer keeps FRED attribution, links
adopt accent-deep underline-on-hover.

### 4.2 Navigation

**The z-ladder (global, load-bearing — every overlay and bar obeys it):**

| Layer | z | Notes |
|---|---|---|
| `.app-wash` | 0 | fixed, pointer-events none |
| content wrapper | 10 | `relative` |
| top bar + bottom tab bar | 30 | `.surface-bar` |
| overlay scrims (rail, palette, alertdialog) | 40 | `--scrim` + 4px blur |
| overlay content (rail/sheet/palette/popover/dialog) | 50 | `.surface-overlay` |

When any overlay is open, the tab bar sits *beneath* the scrim (30 < 40): dimmed, and
`pointer-events:none` while `[data-overlay-open]` is set on the shell (belt and braces —
Radix already inerts the background tree). The open overlay owns the bottom safe-area inset;
`main`'s tab-bar padding is irrelevant behind the scrim, so insets never double up.

**Desktop top bar (all viewports ≥md).** File: `(desk)/layout.tsx` `DeskNav` +
`components/desk/RoomNav.tsx`. Keep: single row, left cluster brand + rooms, computed active
state from `lib/nav.ts` (pure logic untouched, tests untouched), `aria-current="page"`.
**Newly sticky** (today's bar is static — this is an upgrade, not a keep): `sticky top-0` on
the `.surface-bar`; iOS Safari can break `position:sticky` under an ancestor with
`overflow-x:hidden`, so R2 verifies on device and falls back to `fixed` + content top-padding
if needed (the html-level overflow guard stays either way; log the outcome). Restyle: brand =
28px `--gradient-brand` tile with mono white letter + wordmark in mono 12px uppercase
`tracking-[0.12em]` accent-deep (D3); room links = Inter 13.5px sentence-case,
`--radius-control` pills, active = `--color-accent-soft` bg + accent-deep 600, hover = ink-2 →
accent-deep 150ms. Right cluster: market-state static dot (muted closed / ink open — status is
not an affordance, §3.3) + its text label + mono date + **⌘K hint chip** (mono 2xs "⌘K" in a
faint-bordered chip; click opens the palette) — hidden <md. The Academy top bar keeps its
separate minimal shell restyled with the same recipes over the shared wash; **on phone (<md)
it drops the "← Back to Desk" text link** (the bottom bar's Desk tab is the return path; two
doorways on a 375px row is one too many) and keeps it ≥md.

**Phone (<md), D2 recommended: bottom tab bar.** New `components/desk/TabBar.tsx`, mounted in
both room layouts (client component reading `usePathname` → `activeRoomHref`). Fixed bottom,
z-30, `.surface-bar` glass, top hairline, `padding-bottom: env(safe-area-inset-bottom)` and
`padding-left/right: env(safe-area-inset-left/right)` (landscape notches — browser tabs are
not orientation-locked even though the installed app is); five tabs — Desk (`Newspaper`),
Scans (`ScanSearch`), Paper (`NotebookPen`), Track (`LineChart`), Academy (`GraduationCap`) —
24px icons + 10px Inter labels, min 44px targets, active = accent-deep icon+label + 3px pill
indicator dot above the icon. Settings leaves the bar: a `Settings` gear icon sits right in
the phone top bar. Main content gets `pb-[calc(64px+env(safe-area-inset-bottom))]` in both
rooms. The bar never hides on scroll (calm; position is trust) — **except for the keyboard:**
iOS does not resize the layout viewport when the soft keyboard opens, so a `bottom:0` bar
floats over the content mid-screen; the TabBar listens to `visualViewport` resize and hides
itself (`hidden`, not animated) while `visualViewport.height` is materially below
`innerHeight` (~150px threshold), restoring on keyboard dismissal. Tab switches reset scroll
to top (App Router default — stated as intended: each room is re-entered at its head, the
ritual's start). `e2e/nav.spec.ts` extends: phone project asserts tab bar visible, tabs
navigate, active tab tracks route, bar hides on input focus, no horizontal page scroll (kept
assertion).

**Phone Plan B (if D2 vetoed):** RoomNav strip stays but gains: `scroll-snap-type: x
proximity`, auto-`scrollIntoView({inline:'center'})` of the active link on route change,
16px edge fade masks (`mask-image` gradient) signalling overflow, wordmark shrinks to the
mark tile only (<md), Settings pinned last with a leading hairline. Same restyle tokens.

**`CommandPalette`** — behavior and index mechanics unchanged; the results get a **typed
hierarchy** so the palette teaches the product's map: three labeled groups in fixed order —
Rooms (icon + name), Tickers (symbol mono + last price mono-muted), Lessons (title + read-tick
✓) — each group under a mono 2xs uppercase muted header, zone-chipped Desk/Academy as today.
Restyle: L4 overlay, 12px radius, `Search` icon input row, fade+scale 200ms in (contains no
P2 content), none out. Phone: opens from the top-bar search icon; panel anchors to the top
(`pt-[12vh]` as today) and caps its height to `visualViewport.height` minus the keyboard so
the active row never hides behind it; input at `--text-input-touch`.

### 4.3 Overlays

**`RailDialog`** — Radix behavior/history handling untouched. Desktop: 440px right rail as L4
(z-50 over its z-40 scrim), 240ms translateX slide-in. Phone: bottom sheet with 16px top
radii, **grab handle** (32×4px `--color-faint` pill), `padding-bottom:
env(safe-area-inset-bottom)` (it owns the inset while open — the tab bar is behind the
scrim), 240ms translateY. Blur wrapped per the iOS clipping rule (§3.4). Reduced-motion:
appears in place.

**`GlossaryPopover`** — L4 mini-panel, `--radius-panel`, 150ms fade+2px rise; dotted underline
term becomes accent-deep dotted. Review-queue seeding behavior untouched.

**Cooling-off interstitial (`PaperEntryForm`)** — `role=alertdialog` unchanged; renders on
`--color-surface-solid` (a decision moment: **no transparency, no gradient**), hairline
border, z-50 over its own z-40 scrim, the two buttons per §4.1's exception. No entrance
animation (it is friction, not delight).

**`WorkedExampleDrawer`** — the schematic stays schematic (P1; never real prices), but the
reveal becomes **staged pedagogy** rather than a dump: the drawer opens with the bare path +
the "not X's prices" caption (150ms fade — the SVG path itself never animates; it *looks*
like a price path and must not *behave* like one); each of the three steps, on hover/focus,
lights its numbered marker in accent AND sets the step's one-sentence "what to notice" line
under the chart (existing content, resequenced) — the reader walks the pattern marker by
marker instead of parsing a legend. Markers restyle to accent; keyboard path: steps are
focusable in order, `aria-describedby` ties marker to step.

---
## Part 5 — Pages, room by room

> **Amended 2026-07-12.** Layout CONTAINERS per room are superseded by APP-FEEL-PLAN.md
> Part 4: modular rooms, bounded cards, one tap to depth. Tokens, type, colour, material and
> motion in this document remain authoritative — the app-feel plan mints no new colours,
> radii, shadows or durations. Specifically: §5.2's scans spec is superseded by APP-FEEL-PLAN
> §4.2 (the index becomes a summary with a real table behind it at `/scans/[preset]`), and
> §5.3's paper spec by §4.3 (the ticket is ONE column at every width, and side has no
> default — ruling M9).


*Page order = build order within each phase. Every page keeps its data flow, server actions,
copy keys, and honesty behavior; what changes is named per page. Phone behavior is stated
inline, not deferred to a "mobile section" that Opus might read too late.*

### 5.1 The Desk (`/`)

**Header (new).** Above module 01: mono 2xs uppercase muted eyebrow "THE DESK — EVENING
EDITION" (from `copy.desk.edition`; our edition is the 9pm briefing, not the Figma's morning
fiction), serif `--text-display` date ("Friday, July 11, 2026" — the run date of the data),
and a muted status line built from existing data: market open/closed + "data as of Fri close ·
updated 8:41 PM ET" (timestamps everywhere; the line doubles as the as-of context for every
delta chip below it). No countdowns (urgency).

**Layout.** Phone/tablet: the single ritual column, order unchanged (heartbeat → 01 Pulse →
02 Brief → 03 Calendar → 04 Movers → 05 Watchlist → 06 Setups → 07/08 placeholders →
Scorecard → SourceStatus). At `desk:` 1366px: the broadsheet spread (§3.9) — CSS grid
`minmax(0,1fr) 340px`, gap 24px; Pulse spans both columns; the sidebar takes the reference
modules (Watchlist, Calendar **compact variant** below, SourceStatus); DOM order stays
ritual. Every module becomes a `Surface level=card`; placeholders keep their masthead + one
muted line + quiet shimmer.

**Module specs.**
- **01 Macro Pulse** — content per Part 6 fix (true index levels). Hero: S&P 500 level 64px
  ink + delta chip; row of body StatFigures: Nasdaq Composite, Dow, VIX, 10-yr (each with a
  delta chip where a prior level exists — the delta is prior-close-over-previous-close, the
  same as-of as the level; the header status line and the masthead stamp carry that context
  on-surface, and the chip's `aria-label` says "1-day change to Friday's close"); small-caps
  slot renders the IWM ETF proxy **with its proxy chip** (§6.1); breadth strip per §3.8.
  Provenance line under the grid: `copy.macro.provenance` + as-of stamp (and the masthead's
  provenance reveal carries the chain). Phone: hero full-width, figures wrap 2-up.
- **02 Brief** — serif `--text-title` headline (Newsreader italic stays for "Today's focus"),
  labeled slots keep their mono 2xs slot mastheads in **accent-deep** (the Figma's one
  sanctioned in-card accent use), hairlines between slots, superscript source links in
  accent-deep. **Held state (designed, not just worded):** the card renders the full slot
  skeleton — all four slot mastheads in `--color-faint` with quiet placeholder rules where
  prose would sit — and `copy.brief.unavailable` once beneath the first. The structure still
  teaches what a briefing contains even when tonight's is held. Never amber.
- **03 Calendar** — per Part 6 fix. Full-width row (main column, phone): date cell (mono, two
  lines: "TUE JUL 15" / time or "—"), the **code chip** (`Tag` catalyst variant showing the
  allowlist code: CPI, JOBS, PPI, GDP, PCE, RETAIL, FOMC, EARNINGS — one vocabulary,
  Appendix C is its single source), title (symbol bolded), consensus/prior mono cell when
  present. High importance = a 6px **ink** dot + the word "high" in mono 2xs beside the title
  (never amber, never red, never the loudest thing in the row — P6/P11). **Compact variant
  (340px sidebar):** two lines — line 1 = date + code chip + importance dot+word; line 2 =
  title truncated; consensus/prior drop to the row's rail drill. **Empty state is a
  signature, not an apology** (§6.2 makes it likely): a full-height quiet card — centered
  serif line `copy.calendar.empty` ("A quiet stretch — no scheduled catalysts in the next 14
  days."), hairline rule, mono sub-line `copy.calendar.emptySub` ("Curated from the full FRED
  release feed; the rest was noise."). The absence of noise is the product working, and the
  card says so.
- **04 Movers** — adds the last price under the symbol (mono 2xs muted); change% chip in
  up/down-text on wash; RVOL emphasized `--color-accent-deep` when ≥2×; catalyst zone
  unchanged (chip + headline + ExternalLink, or the noise line in muted *italic*). Rows stay
  RailTriggers with `hover:bg` shift to accent-muted (background only — rows contain delta
  chips, so no transform, §3.6). Empty state: `copy.mover.quiet` ("No moves cleared the
  catalyst-or-noise bar today.") in the same quiet-card voice as the calendar. The RelVol
  footnote enters `copy.ts` (Appendix B — reworded in review; no "not yet public" FOMO bait).
- **05 Watchlist** — sparkline per §3.8 (stroke + tokened soft fill, 36px tall), price +
  delta chip right-aligned, reason line muted, fired-signal marker keeps reserved amber (P11).
- **06 Setup cards** — collapsed summary row: pattern name in **Newsreader italic**
  `--text-title` (§3.1 serif floor: Playfair is display-only), symbol mono, colored tier
  chip, and **`n=108` in mono muted — nothing else numeric**. No proportion, no percentage,
  no bar on the collapsed card: a base rate may not appear without its CI, baseline, and
  WEAK-cap context, and those live in `BaseRate` (P4 — this was the honesty review's top
  finding, fixed by moving the proportion bar inside `BaseRate`). The `<details>` expansion
  is **instant** (its subtree is P2 — §3.6); only the chevron rotates. Expanded: `BaseRate`
  in a `Surface tinted` panel (its restyle adds the equal-weight proportion bar + dot array
  under the sentence, all `data-p2`); typical-range panel as a **flat neutral band**
  (`--color-band` at 14%, no gradient — a gradient across a range implies density and
  valence the interval doesn't claim) with 25th/75th mono labels and the pinned "historical
  distribution, not a price target" copy; "What fired" list with `Check` icons in accent;
  weakeners with `AlertCircle` in down-text; `WorkedExampleDrawer` (§4.3); scope line;
  doorway link.
- **Scorecard + Journal** — Surface card, serif title, hits/misses in outcome chips (§5.4),
  journal textarea per §4.1 inputs (16px on touch), Brier anchor line unchanged.

### 5.2 Scans (`/scans`) — the visible recipe, staged like one

The scan page's identity IS the product's anti-black-box stance: the recipe is public. Design
it as a recipe card, not a text dump. Each preset = `Surface card`: header row with serif
`--text-title` name (GlossaryTerm-wrapped where it is one) + grade/FOLKLORE `Tag`; then the
criteria as a **numbered clause list** — each criterion on its own hairline-separated row
with a mono index (01, 02, 03…) and the clause in UI type at 62ch — a recipe you can check
off by eye, not a paragraph you parse; then the results line: "N matches today" as a mono
figure + as-of stamp; then matched tickers as a wrapping row of neutral mono chips (≥44px
touch targets, each links to `/ticker/[symbol]`), "+ N more" in faint. No percentages on
this page — unchanged rule (a match is not a base rate), restated in the page header prose.
Empty preset state: "0 matches today" stays visible with the recipe — a scan that fires
nothing is information. Phone: cards stack; chips wrap.

### 5.3 Paper desk (`/paper`) — the receipt is a receipt

Form in a Surface card (§4.1 inputs — every control ≥16px on touch, 2-col ≥md, stacked on
phone). **Cost mirror — the app's most honest artifact gets the full treatment:** a `Surface
tinted` panel styled as a register receipt — 2px dashed hairline top and bottom edges (the
tape), each factor line right-aligned mono in `--color-muted` (round-trips/yr · avg round-trip
bps · annual drag bps), a `--color-hairline-strong` rule, then the total set at
`--text-num-lg` in `--color-down-text` with the word **"drag"** beside it (redundant
encoding): "−4.8% / yr drag". The punchline lands with the weight of a bill, because it is
one. (P&L-never-hero rule untouched: this is a cost, on `/paper`, at `num-lg` not hero.)
Frequency-mirror warning stays plain prose (not amber). Half-Kelly helper: tinted panel +
figures via StatFigure body scale. Ledger: Surface card table, realized P&L in outcome-style
chips (up/down-text + sign + word "gain"/"loss"), open positions with their close form
inline. M3 soft-gate aside: hairline card with Academy doorway (never a lock — unchanged).

### 5.4 Track record (`/track-record`)

Stats row: 4–5 `Surface raised` stat cards: mono `--text-num-lg` value + mono 2xs uppercase
label (Resolved · Hits · Misses · Unresolvable · Hit rate — hit rate keeps N and misses
adjacent; never a lone win number, P5). These cards contain `StatFigure`s → **no hover
transform** (§3.6); they are display, not controls. Table: header hairline-strong, rows
hairline, outcome column = chips: hit `up-text on up-wash`, miss `down-text on down-wash`,
word always inside, equal size/weight (misses are never smaller, P5). Filter chips above the
table (all/hit/miss/tier, client-side). "Your forecasts": Brier stat card + restyled
`CalibrationScatter` (§3.8) + `ForecastResolver` buttons per §4.1. Phone: stats 2-up grid;
table keeps `overflow-x-auto` with a right-edge fade mask signalling scroll.

### 5.5 Ticker (`/ticker/[symbol]`) — the Range Ladder ships here

This page's visual hero is **the Range Ladder** (§3.8) — not a number. The price StatFigure
renders at `--text-num-lg` (not hero-64) with symbol mono + name serif above it as an
eyebrow; the hero-figure law is satisfied (no 64px numeral on this route) and the ladder
takes the stage. Page order: header (symbol · name · price + delta chip + as-of) → candle
chart in a Surface card (tokens re-read automatically; fades in complete) → **`RangeBands`**
(replaces `VolBandPanel`'s list as the primary render; the list stays beneath as the
accessible table/text equivalent — screen readers and the no-SVG fallback read the same
numbers): one row per horizon, nested 50/80 bands in `--color-band`, embedded quantile
dotplots, ink zero line "0% = last close", per-row `volband.label` + `volband.caveat` + N +
window, no median mark, no cone silhouette (§3.8). WEAK/regime-break state renders the caveat
above the ladder, never hides it. Polish budget: perfect band-edge typography with leader
lines, its own `/styleguide` section, dedicated VRT shots both themes. The geometry is a pure
function (TDD, R4); the SVG renders the computed geometry.

### 5.6 Academy — a reading room, not a tinted dashboard (D1/D4)

One palette, one theme, two rooms — so the room switch must be felt entirely in the
furniture. The Academy shares the Desk's wash, tokens, and whichever theme is active (dark
included — the "Academy stays light" rule is repealed, Part 2 A11), and diverges structurally
in three deliberate ways: **(1) solid paper cards** — `--color-surface-solid`, hairline
border, NO glass, NO blur, NO shadow (a reading room is not a control surface; the Desk's
material says "instrument", the Academy's says "book" — in Midnight the same move reads as
matte page vs glass panel); **(2) serif kickers instead of terminal mastheads** — module and
section headers drop the numbered mono masthead for a Newsreader italic kicker over a
hairline (the index numbers stay in the curriculum map where sequence matters, as plain mono
prefixes); **(3) reading typography and pace** — prose lh rises to 1.7, measure stays 65ch,
lesson H1 in Playfair display, section spacing a step more generous than the Desk's.
Interactive accents stay indigo everywhere (links mean one thing in both rooms).

**Home:** module groups as solid cards with a 4px category bar per module — **decorative
only** (the module title beside it carries the information; the bar is never the sole
encoding), hues from the module palette (§3.3, none amber, none accent). Lesson rows with
read-tick (`Check` in accent) + mono minutes, M3 gate note unchanged. The closing pull-quote
card renders `copy.academy.quote` — one fixed quote, never rotating (rotation is a slot
machine). **Lesson:** serif display H1, prose measure 65ch Newsreader, mdxComponents restyle
only (h2 serif `--text-title`, links accent-deep), retrieval questions in a solid tinted
card, return rails top+bottom (top link hidden <md per §4.2), LessonReadBeacon untouched.
**Review queue (a calm ritual, designed as one):** one centered solid card at a readable
measure, generous whitespace above and below; the term set in Newsreader italic
`--text-lg`; "3 of 12" as a plain mono position line (position, not progress-bar
gamification); Reveal as a secondary button; after reveal, the definition in prose type +
optional "Full lesson →" doorway; "I knew this / Not yet / Skip" as three **equal-weight**
secondary buttons (no primary — the UI sells no right answer); 200ms fade between cards; no
timers, no streaks, no scores (P6). **Glossary: the term is the hero** — each entry: term in
Playfair `--text-title`, part-of-speech/context in mono 2xs muted, definition in prose type,
doorway link; two-column masonry ≥lg, hairline-topped entries; alphabet rail (mono letters,
anchor links) on desktop.

### 5.7 Login (`/login`)

Split screen ≥lg: left brand panel on `--gradient-brand` (150°) with the faint 48px grid-line
overlay (Figma), logomark + wordmark (D3), serif `--text-display-hero` headline "Your
personal *broadsheet* for the market." (Playfair italic 400 — the token the font-budget
ladder protects, §3.1), the licensing/product explanation re-set in Inter on indigo-200, and
the Templeton quote block (`copy.login.*` — mechanical voice, quote attributed). Right: the
form at `max-w-[400px]` per §4.1 inputs (16px on touch), primary gradient submit "Open my
desk →", the "personal tool, no advice" line kept. Phone: brand panel collapses to logomark +
one headline above the form. The page themes with the app like every other route (D1): the
brand gradient panel is already midnight-toned, and the form side sits on the active theme's
paper. Constraint honored: page stays `force-static` (SW precache) — all decoration is CSS,
no images; the theme lands via the root layout's inline pre-paint script (§7.3), which is
static-safe — no server cookie read touches this page. `auth.spec.ts` assertions (wall text,
error equality, cookie) unchanged.

### 5.8 Settings, Offline, Styleguide

**Settings:** Surface cards per section; watchlist rows per §4.1. The theme control is
labeled **"Theme"** — segmented pill (System / Light / Dark), active segment raised — and it
governs the entire app (D1); helper text: "Applies everywhere — Morning or Midnight, one look
at a time." Same form posts, no client JS added. **Offline:** neutral Surface card + masthead, unchanged copy. **Styleguide:**
re-organized to the new system — tokens (with the live contrast table §3.3), surfaces, type
specimens (all four families incl. the serif floor demo), chips/tags, buttons/inputs, chart
specimens (range ladder, dotplot, dot array, proportion-in-BaseRate, calibration, sparkline),
motion demos (with a "probability visuals do not move" section showing the static list and
the `data-p2` convention), the amber-region reservation swatch row, both themes side by side.
The styleguide is the VRT anchor (Part 9).

---
## Part 6 — Content fixes (Phase R0 — build FIRST, before any styling)

*Two places the product currently tells a beginner something false or noisy. They outrank
styling; they ship as their own phase with their own gate. Both fixes are specified to the
line because the recon traced them to the line — and re-verified after the adversarial pass.*

### 6.1 Macro Pulse: real index levels, honest proxies (Bug 1)

**The defect.** `app/lib/morning.ts:40–46` maps ETF tickers to index names (`SPY → "S&P
500"`) and `quoteFromCloses` (`morning.ts:72–78`) renders the ETF's close as the labeled
value — so the Desk hero says "S&P 500: 754.94" when the index is ~6,800. Same for
Nasdaq/Dow/Russell. The day-change % is roughly right (an ETF tracks its index's percentage
move); the *level* is mislabeled. A beginner must never read a false number — this is the
worst bug in the product regardless of styling.

**The fix (chosen: true levels from FRED, ETF fallback that is always labeled honestly).**
FRED is already integrated with a generic `latest_value(series_id)`
(`pipeline/adapters/fred.py:45–69`) and the macro read already pulls `VIXCLS`/`DGS10` this
exact way (`pipeline/jobs/job_a.py:47–48, 98–113`).

1. **Pipeline (TDD first):** add `latest_two(series_id)` to the fred adapter (same
   observations call; returns the last two real values) and extend `_read_macro` to fetch
   series `SP500` (S&P 500), `NASDAQCOM` (Nasdaq Composite), `DJIA` (Dow) — level AND prior
   level each. **Russell 2000 has no free FRED daily series — the small-caps slot stays an
   ETF proxy, honestly labeled** (Appendix E-1). Record fixtures `sp500.json`,
   `nasdaqcom.json`, `djia.json` via the existing `MSM_FIXTURES=1` flow. Failure mode: any
   series unavailable → `None` → downstream renders the ETF-proxy path for that slot (never
   a silent mislabel).
2. **Schema:** `market_context` gains six nullable Decimal columns — `sp500`, `sp500Prior`,
   `nasdaqComposite`, `nasdaqCompositePrior`, `djia`, `djiaPrior` (level + prior per index;
   the app can only diff what is persisted — `buildMacro` never sees pipeline observations).
   Migration: **`npx prisma migrate dev --name add_index_levels`** (the `--name` flag is
   mandatory — a bare `migrate dev` prompts interactively and stalls an unattended run).
   Extend `_upsert_market_context` (`pipeline/publish.py:408–429`) and the `read_macro`
   return type (`pipeline/nightly.py:78`).
3. **Seeds:** `prisma/seed.mjs` gains realistic index values (S&P ≈ 6,812.34 + prior,
   Nasdaq ≈ 22,3xx, Dow ≈ 44,xxx) in its `marketContext.upsert` — without this the seeded
   e2e desk falls back to the ETF proxy and the R0 gate assertion can never pass.
4. **App (TDD first, update `morning.test.ts` expectations):** `buildMacro`
   (`morning.ts:88–118`) becomes source-typed:
   `type IndexQuote = { label; value; deltaPct; direction; source: "index" | "etf-proxy";
   proxySymbol? }`. Index slots prefer the `market_context` level; delta computes from
   level vs prior level via `lib/format` (`signedPercent`/`directionOf`); if the prior is
   null, the delta renders "—" (never borrowed from the ETF). If the level is null, the slot
   falls back to its ETF close with `source: "etf-proxy"`. **The label may claim an index
   name only when `source === "index"` — a unit test asserts this coupling** (the regression
   lock for the whole bug). Fallback labels are honest per-slot: the S&P and Dow proxies are
   "S&P 500 · SPY (ETF proxy)" / "Dow · DIA (ETF proxy)"; the Nasdaq slot's proxy is **"
   Nasdaq-100 · QQQ (ETF proxy)"** — QQQ tracks the 100, not the Composite, and the label
   must not claim otherwise.
5. **UI:** `MacroPulse.tsx` renders per §5.1: index slots show level + delta chip (as-of
   coupling per §5.1); proxy slots show the proxy chip (`copy.macro.proxyChip`) and the ETF
   price; provenance line `copy.macro.provenance` + as-of stamp + masthead provenance
   reveal. If ALL index series fail, the whole strip renders proxy-labeled ETF rows —
   degraded, still honest, and `SourceStatusFooter` already reports the FRED outage.
6. **Copy (Appendix B):** `macro.provenance`, `macro.proxyChip`, `macro.proxyNote`,
   `macro.indexUnavailable`.
7. **Tests:** pipeline `test_job_a` (new series read + None-tolerance + latest_two),
   publish upsert test, `morning.test.ts` (label-source coupling, per-slot fallback labels,
   delta from level/prior, "—" on missing prior), `MacroPulse.test.tsx` (proxy chip on
   fallback; hero level formats via `price()`), e2e `desk.spec.ts` seeded assertion updates
   (SPX ≈ 6,8xx seeded level, proxy chip on small-caps row).

**Note on timing:** FRED index series update at the close with a lag; the strip is as-of prior
close — identical freshness contract to today's EOD product, now stated on-surface by the
provenance line and the Desk header's status line.

### 6.2 Session Calendar: catalysts only (Bug 2)

**The defect.** `pipeline/catalyst_ingest.py:75–82` ingests **every** FRED release in the
14-day window; `fred.release_calendar` (`adapters/fred.py:71–96`) calls `/releases/dates`
with `include_release_dates_with_no_data=true`, which returns daily-noise releases (Coinbase
Cryptocurrencies, Commercial Paper, Euro Short Term Rate, Dow Jones Averages…) and repeats
releases across dates (three "FOMC Press Release" rows in the fixture). `loadCalendar`
(`morning.ts:398–410`) then takes the 15 soonest rows unfiltered. The calendar the product
exists to curate is currently a firehose.

**The fix (filter at the write path, on the typed adapter rows — the read stays dumb).**

1. **Adapter:** set `include_release_dates_with_no_data` to `"false"` (kills the no-data
   repetition at the source). Keep limit/sort.
2. **Allowlist (new `pipeline/catalyst_allowlist.py`, TDD first):** one constant mapping FRED
   release name → `{code, display, kind, importance}` (Appendix C is the single source of
   the vocabulary — codes CPI/JOBS/PPI/GDP/PCE/RETAIL/FOMC; the list only ever grows by a
   deliberate commit). Matching by normalized name containment, with each entry's
   `release_id` recorded beside it as documentation; the build verifies each name once
   against the live endpoint and logs any mismatch to QUESTIONS as `[VETO?]`.
3. **Filtering + dedup happen on the `list[ReleaseDate]`** (the typed adapter rows, which
   carry `release_id` — the event dicts do not): drop non-allowlisted releases *before*
   mapping (the current loop appends unconditionally at `catalyst_ingest.py:77–78`; restructure
   so drops are skipped, never appended as `None`), then collapse duplicates by
   `(release_id, date)`. Remaining multi-date rows for one release (FOMC press releases
   around a meeting) are real distinct dates and stay. `_fred_event` then maps an allowlisted
   row using the table's `kind` (`fed` for FOMC, `macro` otherwise), `title` = display name,
   `importance` from the table — and a new **`code`** field.
4. **Row shape:** `CalendarRow` (app) and the event dict (pipeline) gain `code` and
   `importance`; the chip renders `code` (§5.1 — never the raw `kind`), FMP earnings rows get
   `code: "EARNINGS"`. Earnings importance: **"high" when the symbol is in the served core
   (`_CORE_SERVED`, a pipeline constant the ingest can see), else "medium"** — the
   user-watchlist half of the earlier heuristic is dropped: the watchlist is app-DB state the
   pipeline doesn't hold at ingest time (Appendix E-4 updated).
5. **Fixture upgrade:** extend `fixtures/fred/release_dates.json` with a realistic CPI +
   Employment Situation entry (dated inside the window) so the INCLUSION path is tested, not
   just exclusion — an allowlist tested only on noise proves nothing about recall.
6. **UI:** `CalendarTimeline.tsx` renders per §5.1 (code chip, ink importance dot + word,
   compact sidebar variant). **Empty state:** new keys `copy.calendar.empty` +
   `copy.calendar.emptySub` (Appendix B) rendered as the §5.1 signature quiet card. The
   existing `copy.calendar.noEdge` ("No clear edge either way — that is a valid outcome.") is
   a *different sentence for a different situation* (an event with no directional read) and
   is left untouched — the earlier draft of this plan misquoted it; the adversarial pass
   caught it.
7. **Tests:** `test_catalyst_ingest.py` (allowlist in/out on ReleaseDate rows, dedup,
   importance + code mapping, no `None` rows), `test_fred.py` (flag change), new
   `test_catalyst_allowlist.py`, `morning.test.ts` + `CalendarSourceModules.test.tsx`
   (code chip, importance render, compact variant), e2e seeded calendar assertion update.

**Order note:** R0 ships both fixes + tests + a green pipeline run on fixtures before any
token work begins. The gate (Part 8) requires the two regression locks (label-source
coupling; allowlist in/out) to exist and pass.

---
## Part 7 — Mobile & PWA (first-class, not an afterthought)

*The phone is where the current UI is weakest (jumbled Scans, off-screen nav, no safe areas).
This part is the phone contract; §4/§5 already state per-surface phone behavior — this part
adds the cross-cutting mechanics and the PWA chrome. The adversarial pass added an explicit
iOS-Safari clause to nearly every item: the automated matrix is Chromium/Pixel-7, and every
one of the worst phone bugs found in review is iOS-specific and invisible to it.*

### 7.1 Breakpoints & ergonomics

- Tailwind defaults (sm 640 / md 768 / lg 1024) + the existing `desk:` 1366px variant.
  Phone = <md throughout this plan.
- **Touch targets ≥44×44px** everywhere: nav tabs, movers/watchlist rows, chips that act
  (ticker chips on Scans), `<details>` summaries, form controls, palette rows. R6 runs an
  automated sweep (Playwright evaluates bounding boxes on the phone project for every `a`,
  `button`, `[role=button]`, `summary`).
- **Inputs ≥16px on touch** (`--text-input-touch`, §3.2/§4.1) — iOS zooms on focus below
  16px and stays zoomed; there is deliberately no `maximum-scale` lock (pinch-zoom is an
  accessibility right), so the fix is font size, not viewport clamping.
- **Hero scale** drops to `--text-hero-mobile` (48px) — existing mechanism kept.
- **No horizontal page scroll, ever** — the `html { overflow-x: hidden }` guard and the
  `nav.spec.ts` phone assertion stay; wide tables scroll inside their own container with a
  right-edge fade mask as the affordance (track record, ledger).
- **Scroll policy stated:** tab/room switches land at the top of the destination (App Router
  default, intended — each room re-enters at its head). `overscroll-behavior-y: contain` on
  the scroll root suppresses pull-to-refresh reloads in standalone Android; iOS rubber-band
  reveals `html`'s `background-color`, which tracks the resolved theme's paper token, so the
  bounce never flashes a wrong plane.
- Hover-dependent affordances must have a non-hover equivalent: every action is a visible
  control (unchanged practice, restated because the new system adds hover polish). The
  provenance reveal (§3.6) opens on tap on touch devices.

### 7.2 Safe areas & the keyboard (currently enabled but unapplied — fix in R2)

`viewportFit: "cover"` is already set; the insets are not consumed anywhere. Apply:
- Top bars (both rooms): `padding-top: env(safe-area-inset-top)`.
- Bottom tab bar: `padding-bottom: env(safe-area-inset-bottom)` **and**
  `padding-left/right: env(safe-area-inset-left/right)` — browser tabs rotate even though
  the installed app is portrait-locked, and landscape notches eat the outer tabs (D2).
- RailDialog bottom sheet / palette / alertdialog: each owns the bottom inset while open;
  the tab bar sits behind their scrim per the z-ladder (§4.2), so insets never stack.
- Main content bottom padding accounts for the tab bar height + inset (§4.2).
- **Keyboard:** the tab bar hides (not animates) while the soft keyboard is up, via a
  `visualViewport` height listener (§4.2) — iOS keeps `bottom:0` fixed elements pinned to
  the layout viewport, which the keyboard covers, so an unhidden bar floats mid-screen over
  the focused form. The palette caps its height to `visualViewport.height`.
- Verification: Playwright asserts the computed padding includes the `env()` expression and
  the bar hides on input focus (phone project); the iOS-specific behaviors (keyboard float,
  sticky-under-overflow, blur corner clipping) get a **manual iPhone checklist** run at R2
  and R6 gates, photographed into `docs/redesign-evidence/` — stated plainly: these cannot
  be automated in the current Chromium-only matrix.

### 7.3 PWA chrome

- **Manifest** (`app/manifest.ts`): `background_color`/`theme_color` → new light paper
  `#f9f8ff` (install-time frozen light value — unchanged policy; consequence stated: a
  Midnight-Desk user sees one light splash frame at cold launch. Accepted and documented —
  the alternative is per-theme install prompts we don't control).
- **The one-theme mechanism (D1) — inline pre-paint stamping.** The theme is app-wide, so
  `data-theme` moves to `<html>` — but the root layout must NOT read the cookie server-side:
  a `cookies()` call in the root layout would force every route dynamic and break the
  `force-static` login/offline pages the SW precaches. Instead the root layout injects a
  ≤10-line inline script in `<head>` (before paint) that reads the theme cookie from
  `document.cookie` and sets `document.documentElement.dataset.theme` — the classic no-flash
  snippet; static pages stay static and still theme. The Desk layout's server-side stamping
  and its per-room `viewport.themeColor` are removed in R2.
- **Status bar / theme-color — must follow the chosen theme, not the OS.** With the theme
  stamped client-side pre-paint, the `theme-color` meta follows the same way: the inline
  script also rewrites the `theme-color` meta to the active paper (`#f9f8ff` light /
  `#14121f` dark; on `system` it leaves the SSR default media pair in place). SSR default:
  the media pair, emitted once from the root layout. `lib/tokens.ts` constants: `PAPER
  "#f9f8ff"`, `PAPER_DARK "#14121f"` (the `ACADEMY_BG` constant is deleted — one palette,
  D4). e2e: with a `dark` cookie under an emulated light OS, the effective `theme-color`
  equals `PAPER_DARK`, on the Academy route too.
- **Icons:** regenerate the set (192, 512, maskable-512, monochrome-96) from a new source
  SVG: `--gradient-brand` rounded-16px tile + white mono letter (D3). Keep filenames/paths so
  the manifest and precache don't churn. Maskable: 20% safe zone.
- **Service worker:** behavior untouched (precache `/login` + `/offline`, cacheGuard, quiet
  update line). R1's gate prints a **line-item precache delta**: per-font woff2 sizes (all
  four families), app-shell delta, static routes — the "<1MB growth" claim is verified as a
  table, not asserted as a round number (`pwa.spec.ts` keeps its two-static-routes
  assertion).
- **Splash/standalone polish:** `display: standalone` + portrait kept. The wash renders
  edge-to-edge behind the safe areas (the `.app-wash` layer is `inset: 0` fixed).

### 7.4 Performance budget (the glass tax, paid deliberately)

- Blur budget per §3.4 (five components, never cards on phone; iOS corner-clip wrapper rule).
- Orbs are two fixed radial-gradient layers — cheap; they carry `transform: translateZ(0)`
  to stay on the compositor and are never repainted by scroll (fixed layer). Phone halves
  their opacity and size (Appendix A) — ambience, not wallpaper.
- Route-transition animation animates `opacity` only (compositor-safe, §3.6).
- Lighthouse CI (existing `scripts/lighthouse-check.mjs`) budgets unchanged: perf + a11y on
  `/` mobile. If the wash/glass drops perf below budget, the fallback ladder is: remove card
  translucency on phone (solid surfaces) → remove orbs on phone → never remove the wash (it
  is one gradient). Each step logged if taken.
- **Fonts:** Inter/JetBrains/Newsreader load `display: optional` (body text — a missed swap
  costs nothing structural because next/font's metric-adjusted fallbacks hold the line
  boxes). **Playfair loads `display: "swap"`** — it sets the headlines, and `optional` would
  ship Georgia headlines for a whole session on a slow first load; a metric-matched fallback
  cannot fully mask a display serif at 46–56px. The one-frame serif swap is accepted and
  noted. Headline containers reserve line-height so the pre-swap fallback cannot overflow
  the 375px login panel; one VRT shot runs **with fonts blocked** (fallback layout locked,
  §9.2) — the font-loaded-only oracle was a blind spot the adversarial pass caught.

---
## Part 8 — Phases R0–R6 (playbooks + gates)

*Same contract as DEVELOPMENT-PLAN.md §6: TDD for logic, visual work verified by the VRT +
checklist, every phase exits through the gate, tag `redesign-N`, roll straight into the next.
Estimates assume the same executor pace as P0–P6.*

> **[Amended 2026-07-13 by GATE-EFFICIENCY-PLAN G4 — "roll straight into the next" is
> SUPERSEDED.]** One phase per session (CLAUDE.md, user, 2026-07-13, permanent): tag, bring the
> intelligence files current as ONE commit, report to Bishan, STOP. The exit ritual itself also
> changed — you now REHEARSE the browser oracle (`gh workflow run ci.yml -f job=e2e`) BEFORE
> tagging, and the tag stays put once green. See CLAUDE.md's "The Endgame" block. Note also that
> "DEVELOPMENT-PLAN.md §6" above points at the ORIGINAL gate, which is history: §6.4 carries its
> own dated correction block, and the live gate is the active plan's standing-gate block.

**The standing gate (every phase, in order):**
```
1  npm run typecheck && npm run lint && npm test          # app unit
2  uv run pytest                                          # pipeline (phases that touch it)
3  npm run build && npx playwright test                   # e2e + VRT + PWA
4  npx lhci autorun — mobile, / — perf+a11y budgets (R2+)
5  Anti-drift checklist v2 (§3.10) against fresh screenshots
   (each eyeball item applies once its surface exists — R1 gates on the styleguide only)
6  Update PROGRESS.md · append DECISIONS/LESSONS · git tag redesign-N · push
```

### R0 · Content honesty fixes [0.5–1 day]
Steps: §6.1 then §6.2, tests first throughout; `prisma migrate dev --name add_index_levels`;
`prisma/seed.mjs` index values; record new FRED fixtures; extend the calendar fixture with
CPI/JOBS inclusion rows; run a full fixture pipeline (`MSM_FIXTURES=1 uv run python -m
jobs.job_a`) and eyeball the seeded Desk.
**Exit gate additions:** label-source coupling test exists and passes; allowlist
inclusion+exclusion tests pass; seeded Desk shows an S&P level ≈ the seeded index value with
the FRED provenance line; calendar shows zero noise names from the fixture; QUESTIONS entry
written if any FRED release name failed live verification.

### R1 · Foundation: tokens, fonts, styleguide, guards [1.5–2 days]
Steps: (1) `globals.css` v2 from Appendix A — including the full `[data-theme="system"]`
block, the `.surface*` class bodies, the `@supports` fallback, and the multi-scope
`prefers-reduced-transparency` override. (2) **The atomic rename sweep, same commit:**
Tailwind emits nothing for a utility whose token vanished — no build error — so the token
swap and the class rename must land together. Mapping table (grep each, replace all):
`bg-desk-bg → bg-paper` · `bg-academy-bg → bg-academy-paper` · `text-desk-bg → text-paper`
(if present) · `rounded-edge →` per element: cards `rounded-card`, panels `rounded-panel`,
controls/inputs/buttons `rounded-control`, tags/chips `rounded-chip` (the sweep is
per-occurrence judgment, ~19 files; when unsure, match the §3.4/§3.5 role of the element) ·
`font-stretch-[…] →` delete (dead once Archivo leaves). Then run §3.10 grep #9 — it must be
empty. (3) `lib/fonts.ts` four loaders (Playfair `display:"swap"`, §7.4); bump font budget
script to 560KB + per-file size printout. (4) `lib/tokens.ts` new OS constants. (5) Add
`lucide-react`. (6) Build `Surface`, `AppWash` (mounting rule §4.1), restyle
`SectionMasthead` (+ provenance reveal) / `StatFigure` / `Tag`, buttons/inputs recipes,
`data-p2` attribute on every P2 component root. (7) Rebuild `/styleguide` to the new system
incl. the contrast table + unit test and the amber-region swatch row. (8) Rewrite the
anti-drift grep script to v2 (§3.10, all 11 greps) + the jsdom `data-p2` ancestor-motion
test — the new greps and the new tokens land as one atomic change and must PASS on the R1
tree. (9) Stand up the VRT harness (Part 9) and capture first baselines (styleguide + login
only at this phase, incl. the fonts-blocked shot).
**Gate additions:** styleguide contrast unit test green; grep v2 empty (incl. #9 dead
classes); fonts load offline (build precache includes all four; line-item size table
printed); VRT baselines committed.
**Mixed-vintage note:** between R1 and R3 the app runs new tokens under old layouts. The
atomic rename keeps every existing surface *correctly colored* (both rooms included) through
that window; what it looks like is the old geometry in the new palette — acceptable, tracked,
and burned down room by room in R2–R5.

### R2 · Shell: nav, tab bar, wash, login, PWA chrome, palette [1–1.5 days]
Steps: AppWash into both room layouts + `relative z-10` wrappers; **the one-theme mechanism
(D1):** inline pre-paint theme script in the root layout, `data-theme` on `<html>`, Desk
layout's server stamping and per-room `viewport.themeColor` removed, theme-color follow +
`lib/tokens.ts` rename (§7.3); top bar restyle + newly-sticky verification (§4.2); D2 bottom
tab bar + z-ladder + keyboard hide + safe areas (top/bottom/left/right) + content padding;
route-transition `template.tsx` (opacity-only, §3.6) in both rooms; `CommandPalette` restyle
+ typed result groups + ⌘K hint chip + phone search trigger + visualViewport cap; login
split-screen (§5.7); manifest/icon set (§7.3); OfflineRibbon restyle.
**Gate additions:** `nav.spec.ts` extended (tab bar cases per D2 incl. keyboard-hide) green
on phone project; `auth.spec.ts`/`pwa.spec.ts`/`offline.spec.ts` green (login stayed static,
icons resolve, SW behavior unchanged); theme-color e2e (§7.3); safe-area checks per §7.2;
the iOS manual checklist run and photographed; VRT: login + shell chrome both themes.

### R3 · The Desk [1.5–2 days]
Steps: Desk header; broadsheet-spread grid with ritual DOM order + compact CalendarRow
variant; module-by-module restyle per §5.1 (Pulse w/ R0 content, Brief + held-state
skeleton, Calendar + quiet-card empty state, Movers + quiet line, Watchlist, SetupCards —
collapsed summary stripped to `n=` + tier per P4, proportion bar moved inside `BaseRate`,
instant `<details>` expansion — Scorecard/Journal); RailDialog + sheet + grab handle;
sparkline upgrade; placeholders + shimmer.
**Gate additions:** `desk.spec.ts`/`drill.spec.ts`/`briefing.spec.ts`/`setup-cards.spec.ts`
green with updated styling-level assertions; §3.10 grep #6 + #10 + the `data-p2` ancestor
test green (the `<details>`-instant rule is covered by the ancestor test); VRT: Desk seeded,
rail open, both themes, both viewports.

### R4 · Sub-rooms: Scans, Paper, Track record, Ticker + Range Ladder [1.5–2 days]
Steps per §5.2–§5.5. `RangeBands` geometry is TDD'd as a pure function (band + dotplot
coordinates from vol-band data); the SVG renders the computed geometry; the receipt (§5.3)
and recipe-card scans (§5.2) land here. `QuantileDotplot` ships here (the P6-deferred widget,
now in-system).
**Gate additions:** `paper.spec.ts` + track-record assertions green; Range Ladder locks: a
DOM-level unit assertion that no path/line/tick exists at the 50th percentile and no element
connects band rows (the no-median, no-cone locks); VRT: all four rooms, both
themes/viewports.

### R5 · The Academy [1–1.5 days]
Steps per §5.6 (solid cards, serif kickers, module palette, reading typography, review
ritual, glossary-as-hero, quote card; phone top-bar doorway drop per §4.2). **The Academy
themes with the app (D1): `theme.spec.ts` is REWRITTEN** — a dark cookie must theme the
Academy too; the old "Dark applies to Desk but never Academy" assertion is deleted, replaced
by "one theme everywhere" + the structural-divergence checks (solid cards, serif kickers
present in both themes).
**Gate additions:** `academy.spec.ts` green; no-price-in-Academy check unchanged; VRT:
academy home/lesson/review/glossary, phone + desktop, light + dark.

### R6 · Hardening & drift-proofing [1 day]
Steps: touch-target sweep (§7.1); axe pass on every route (existing e2e axe hooks); Lighthouse
budgets; leftover-surface grep (§4.1) + full §3.10 including dead-class re-check; iOS manual
checklist re-run; full VRT re-baseline review; kill dead tokens/classes; mint skills
(`new-surface`, `vrt-update` — Part 10); final docs sync (regenerate DEVELOPMENT-PLAN.md +
PDFs if any §3 text drifted during build); PROGRESS/DECISIONS/LESSONS closeout; tag
`redesign-final`.
**Gate:** the full standing gate + every §3.10 eyeball item photographed into
`docs/redesign-evidence/` (the same screenshot-evidence habit as P6).

**Sequencing rules:** R0 blocks everything (honesty first). R1 blocks R2–R5. R2 blocks R3
(shell before rooms). R3–R5 are order-fixed (Desk → sub-rooms → Academy) so shared primitives
harden in the highest-traffic room first. A D-decision veto changes only its named sections;
none blocks R0/R1 except D1 (dark column) and D4 (academy column) which land in R1's token
sheet — if either veto arrives after R1, it is a token-column edit, not a rework.

---
## Part 9 — Visual regression (new instrument; the styling counterpart of TDD)

*Today no VRT exists (the styleguide comments reference an aspirational suite). The redesign
is exactly when it becomes real: styling this large without pixel locks would drift within a
week.*

### 9.1 Harness

Playwright `toHaveScreenshot` inside the existing e2e setup (same prod-build webServer, same
two projects: `desktop` 1366×768 Chromium, `phone` Pixel 7). New spec file `e2e/vrt.spec.ts`
+ config additions:
- `expect.toHaveScreenshot` defaults: `maxDiffPixelRatio: 0.01`, `animations: "disabled"`,
  `caret: "hide"`, `scale: "css"`.
- Every VRT page load forces `prefers-reduced-motion: reduce` (kills route transitions and
  entrance fades → deterministic pixels) and waits for the fonts via
  `await page.evaluate(async () => { await document.fonts.ready; })` (returning the bare
  `FontFaceSet` from `evaluate` serializes to junk — the await must happen inside the page;
  Appendix D shows the exact pattern). One designated shot per §9.2 runs **with fonts
  blocked** to lock the fallback-metrics layout (§7.4).
- **Masking:** timestamps and as-of stamps get `data-vrt="mask"`; the spec collects
  `[data-vrt=mask]` into the `mask` option. Seeded fixture data (`MSM_SEEDED=1`) makes
  numbers stable; stamps are masked because they encode wall-clock time.
- Baselines live in `e2e/__screenshots__/` and are committed. CI runs Linux — pixel fonts
  differ from macOS, so baselines are generated IN CI (the standard Playwright
  `--update-snapshots` bootstrap on the first CI run of a phase) or via the docker runner;
  local macOS runs use `--ignore-snapshots` unless the developer regenerates a local set.
  Decision logged (Appendix E-7); simplest workable policy first: CI is the pixel oracle.

### 9.2 The shot list

| Page/state | Projects | Themes |
|---|---|---|
| /styleguide — per-section (`tokens`,`surfaces`,`type`,`chips`,`controls`,`charts`,`motion-static`) | both | light + dark |
| /login | both | light |
| / seeded (header + all modules) | both | light + dark |
| / rail open (watchlist drill) | both | light |
| /scans seeded | both | light + dark |
| /paper (form + receipt + interstitial open) | both | light + dark |
| /track-record seeded | both | light + dark |
| /ticker/[seed symbol] (candle + FanChart) | both | light + dark |
| /academy home · lesson · review · glossary | both | light + dark (one theme app-wide, D1) |
| bottom tab bar states (per D2) | phone | light + dark |
| rail bottom sheet open (grab handle + inset) | phone | light |
| /login with fonts BLOCKED (fallback layout lock, §7.4) | phone | light |
| / landscape (tab bar + side insets — browser tabs rotate) | phone (landscape viewport) | light |

(~50 baselines; each phase captures only its own rows — the table completes at R5.)

### 9.3 Update protocol (the drift-vs-intent discipline)

An intentional restyle updates baselines in the same PR with a one-line note in the commit
body ("VRT: N baselines updated — <reason>"). An UNEXPLAINED diff is a build failure, full
stop. Phase gates re-run the whole accumulated table, not just the phase's rows — R5 proves
the Desk still matches R3's pixels. The eyeball step in the gate (§3.10 checklist) reviews
the diff images, not just the pass/fail.

---

## Part 10 — Docs, decisions, and skills (executed alongside this plan)

*The constitution edits this plan mandates are performed in the same session that authored
it, so no successor session ever reads two constitutions. The list is the receipt. This plan
was revised after a four-lens adversarial review — executor-stall (16 findings, every claim
checked against the working tree), honesty-leakage (20), mobile/iOS (12), and
traced-vs-designed (11) — and the fixes are integrated inline rather than appended; where a
finding reversed an earlier call, the section says so.*

1. **CLAUDE.md:** design one-liner replaced with §1.4; the non-negotiables digest line
   reworded to "general UI motion allowed; probability/money visuals never move"; commands
   and rituals untouched.
2. **DEVELOPMENT-PLAN.md Part 3:** edited in its source (`docs/src/dp-0*.html`) — §3.1
   banned-list and manifesto, §3.3 palette pointer, §3.4 shape/elevation, §3.5 motion, §3.10
   greps — each amended clause gets an `Amended 2026-07-11` marginal note pointing here; the
   markdown regenerated via `docs/src/build-plan-md.py`; `docs/Development-Plan.pdf`
   re-rendered. Appendix-K CLAUDE.md template mirror updated to match (plan lines ~924–956).
3. **Research Report §9.7/§9.8** (`docs/src/rr-04.html` + the combined
   `research-report.html`): aesthetic clauses amended with a clearly-attributed dated
   amendment box (user directive 2026-07-11); honesty clauses untouched;
   `docs/Research-Report.pdf` re-rendered. The report's evidence chapters are not touched —
   only the §9.7/9.8 design-language clauses.
4. **DECISIONS.md:** structural entry superseding the line-20 "token-for-token Broadsheet
   Terminal" decision; entries for the local decisions in Appendix E.
5. **QUESTIONS-FOR-BISHANT.md:** the four D-decisions mirrored as `[NEED]` items (they are
   also the top of this plan; the file is the durable copy).
6. **This document:** `UI-REDESIGN-PLAN.md` at the repo root; typeset copy at
   `docs/UI-Redesign-Plan.pdf` from `docs/src/ui-redesign-plan.html` (print.css pipeline).
7. **Skills to mint during the build:** `vrt-update` (the §9.3 protocol as a checklist),
   `new-surface` (Surface/masthead/chip recipes for any future module). Mint at first use
   (R1/R3), per the existing skill policy.

---
## Appendix A — `globals.css` v2 (paste-ready)

*The full replacement token sheet + the surface/wash class bodies. Comments are part of the
deliverable (the sheet is read by humans first — house rule). Values match Part 3; if any
pair fails the R1 contrast test, darken the foreground token one step and log it. NOTE: this
sheet is paste-COMPLETE — the dark and system blocks are both written out in full below
(they must stay in lockstep; a stub here once shipped an empty system block in review).*

```css
/*
 * globals.css — the single source of every design token in myStockMarket.
 *
 * The design system is "Morning Broadsheet" (UI-REDESIGN-PLAN.md Part 3): editorial serif
 * over mono numerals, a lavender morning-light wash, glass cards with soft depth, hairlines
 * inside cards, one hero figure per view, color scarce and always meaningful.
 *
 * HARD RULE (plan §3.10 v2, grepped at every phase exit): no hex color, raw gradient,
 * arbitrary shadow, or arbitrary radius may appear anywhere else in the codebase
 * (lib/tokens.ts holds the three OS-facing constants). If you need a value, it is already
 * here, or it does not belong in the product.
 *
 * Tailwind v4 caveat: rgb(r g b / a) tokens work as utilities (bg-surface) but the
 * slash-opacity modifier (bg-surface/50) silently no-ops on them. Never use it; mint a token.
 */

@import "tailwindcss";

@theme static {
  /* ── Type families (§3.1) — four, no more ─────────────────────────────────────────── */
  --font-display: var(--font-playfair), ui-serif, Georgia, serif;   /* titles; never numbers,
                                                                       never body, never <19px */
  --font-ui: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, "SF Mono", Menlo, monospace;
  --font-prose: var(--font-newsreader), ui-serif, Georgia, serif;   /* prose + small italics */

  /* ── Type scale (§3.2) — existing pairs kept, four additions ──────────────────────── */
  --text-2xs: 11px;   --text-2xs--line-height: 1.35;
  --text-xs: 12px;    --text-xs--line-height: 1.4;
  --text-sm: 13.5px;  --text-sm--line-height: 1.5;
  --text-base: 15px;  --text-base--line-height: 1.55;
  --text-input-touch: 16px;                     /* every form control below md (iOS zoom) */
  --text-prose: 17.5px; --text-prose--line-height: 1.65;
  --text-title: 19px; --text-title--line-height: 1.3;        /* serif card titles (floor) */
  --text-lg: 21px;    --text-lg--line-height: 1.35;
  --text-xl: 27px;    --text-xl--line-height: 1.25;
  --text-2xl: 34px;   --text-2xl--line-height: 1.15;
  --text-display: clamp(30px, 4vw, 46px); --text-display--line-height: 1.1;
  --text-display-hero: clamp(38px, 5vw, 56px); --text-display-hero--line-height: 1.05;
  --text-num-lg: 44px; --text-num-lg--line-height: 1.1;
  --text-hero: 64px;  --text-hero--line-height: 1;
  --text-hero-mobile: 48px; --text-hero-mobile--line-height: 1;

  /* ── Color: Desk, light ("Morning") (§3.3) ────────────────────────────────────────── */
  --color-paper: #f9f8ff;                          /* page plane under the wash */
  --color-surface: rgb(255 255 255 / 0.72);        /* L1 card (no blur on phones) */
  --color-surface-raised: rgb(255 255 255 / 0.90); /* L2 */
  --color-surface-bar: rgb(249 248 255 / 0.85);    /* L3 sticky bars (with blur) */
  --color-surface-overlay: rgb(255 255 255 / 0.96);/* L4 overlays (with blur) */
  --color-surface-solid: #ffffff;                  /* fallbacks + decision moments */
  --color-ink: #0f0d1a;
  --color-ink-2: #3d3a4f;
  --color-muted: #6e6c80;            /* provenance — must clear 4.5:1 on paper */
  --color-faint: #a9a7b8;            /* placeholders/disabled; never body text */
  --color-hairline: rgb(99 88 143 / 0.13);
  --color-hairline-strong: rgb(99 88 143 / 0.24);

  /* Accent — interactive only; never on data, never on status (§3.3) */
  --color-accent: #6366f1;
  --color-accent-deep: #4f46e5;      /* link/label text on light */
  --color-accent-soft: rgb(99 102 241 / 0.10);
  --color-accent-muted: rgb(99 102 241 / 0.06);

  /* Band — non-directional uncertainty fills ONLY (range ladder). Grayer than accent
   * on purpose: an uncertainty band must never look clickable or directional. */
  --color-band: #6d648c;
  --color-band-outer: rgb(109 100 140 / 0.10);
  --color-band-inner: rgb(109 100 140 / 0.22);
  --color-band-panel: rgb(109 100 140 / 0.14);     /* the flat typical-range fill */

  /* Semantic pair — data only, always redundantly encoded (§3.3) */
  --color-up: #2563eb;      --color-up-text: #1d4ed8;   --color-up-wash: rgb(37 99 235 / 0.08);
  --color-down: #ea580c;    --color-down-text: #c2410c; --color-down-wash: rgb(234 88 12 / 0.08);
  --color-up-bar: rgb(37 99 235 / 0.35);   /* proportion/breadth segments — equal weight */
  --color-down-bar: rgb(234 88 12 / 0.35);

  /* Reserved amber — the REGION is reserved, not just the hex (§3.3): only losses and the
   * sanctioned consumers may sit in the amber–orange range. The consumer list is ALERT_ALLOWED
   * in check-drift.mjs (the register — G4, 2026-07-13), not a count written here. */
  --color-alert: #8a5200;
  --color-alert-wash: #f7ead0;

  /* Tier chips (§3.3) — word always inside the chip; moderate is TEAL, not amber */
  --color-tier-strong: #047857;   --color-tier-strong-wash: rgb(5 150 105 / 0.10);
  --color-tier-moderate: #0f766e; --color-tier-moderate-wash: rgb(13 148 136 / 0.10);
  --color-tier-weak: #6e6c80;     --color-tier-weak-wash: rgb(124 122 142 / 0.10);

  /* Evidence grades — inside Tag only, never without their word; mixed is teal */
  --color-grade-supported: #047857;
  --color-grade-mixed: #0f766e;
  --color-grade-weak: #a13d22;
  --color-grade-folklore: #b91c1c;

  /* The Academy shares this sheet in full (D4 — one material world). Its identity is
   * structural (§5.6): solid cards via --color-surface-solid, serif kickers, reading type. */

  /* Academy module hues — DECORATIVE ONLY (§5.6); none amber, none the accent */
  --color-module-foundations: #4a5a8c;
  --color-module-structure: #5b7a4f;
  --color-module-patterns: #7a4a6b;
  --color-module-risk: #9c4460;

  /* ── Gradients (§3.4) — the only four; raw gradients grepped elsewhere ────────────── */
  --gradient-brand: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  --gradient-wash: linear-gradient(145deg, #f9f8ff 0%, #eef2ff 35%, #f0f4ff 65%, #faf8ff 100%);
  --gradient-spark-up: linear-gradient(180deg, rgb(37 99 235 / 0.12) 0%, rgb(37 99 235 / 0) 100%);
  --gradient-spark-down: linear-gradient(180deg, rgb(234 88 12 / 0.12) 0%, rgb(234 88 12 / 0) 100%);

  /* Orbs (L0 wash depth) — re-derived for the real product (§1.3 #14): desktop values;
   * phone halves size+opacity via the media block below */
  --orb-1: radial-gradient(circle, rgb(139 92 246 / 0.08) 0%, transparent 70%);
  --orb-2: radial-gradient(circle, rgb(99 102 241 / 0.06) 0%, transparent 70%);

  /* ── Elevation (§3.4) ─────────────────────────────────────────────────────────────── */
  --shadow-soft: 0 4px 24px rgb(99 88 143 / 0.08), 0 1px 4px rgb(0 0 0 / 0.04);
  --shadow-lift: 0 6px 24px rgb(99 88 143 / 0.12);
  --shadow-overlay: 0 8px 40px rgb(99 88 143 / 0.15);

  /* ── Shape (§3.5) ─────────────────────────────────────────────────────────────────── */
  --radius-card: 16px;
  --radius-panel: 12px;
  --radius-control: 10px;
  --radius-chip: 8px;
  --radius-pill: 999px;

  /* ── Motion (§3.6) — probability/money visuals never consume these, nor their
   *    ancestors: every P2 component root carries data-p2 and a jsdom test walks up. ── */
  --duration-quick: 150ms;
  --duration-fade: 200ms;
  --duration-slide: 240ms;
  --ease-quiet: cubic-bezier(0, 0, 0.2, 1);

  /* ── Layout ───────────────────────────────────────────────────────────────────────── */
  --breakpoint-desk: 1366px;
}

:root {
  --scrim: rgb(15 13 26 / 0.4);
}

/* ── Midnight (D1) — APP-WIDE via [data-theme] on <html>, stamped pre-paint by the root
 * layout's inline script (§7.3; never a server cookie read — static routes must stay
 * static). The [data-theme="system"] block below MUST stay byte-identical to this one. */
[data-theme="dark"] {
  --color-paper: #14121f;
  --color-surface: rgb(30 27 48 / 0.72);
  --color-surface-raised: rgb(36 32 56 / 0.90);
  --color-surface-bar: rgb(20 18 31 / 0.85);
  --color-surface-overlay: rgb(30 27 48 / 0.96);
  --color-surface-solid: #1e1b30;
  --color-ink: #ece9f8;
  --color-ink-2: #c3c0d6;
  --color-muted: #918ea6;
  --color-faint: #6b6880;
  --color-hairline: rgb(167 157 210 / 0.16);
  --color-hairline-strong: rgb(167 157 210 / 0.28);
  --color-accent: #818cf8;
  --color-accent-deep: #a5b4fc;
  --color-accent-soft: rgb(129 140 248 / 0.14);
  --color-accent-muted: rgb(129 140 248 / 0.08);
  --color-band: #8f86b8;
  --color-band-outer: rgb(143 134 184 / 0.14);
  --color-band-inner: rgb(143 134 184 / 0.28);
  --color-band-panel: rgb(143 134 184 / 0.18);
  --color-up: #60a5fa;   --color-up-text: #93c5fd;   --color-up-wash: rgb(96 165 250 / 0.12);
  --color-down: #fb923c; --color-down-text: #fdba74; --color-down-wash: rgb(251 146 60 / 0.12);
  --color-up-bar: rgb(96 165 250 / 0.38);
  --color-down-bar: rgb(251 146 60 / 0.38);
  --color-alert: #e0a83e; --color-alert-wash: #3a2f14;
  --color-tier-strong: #4cbf7e;   --color-tier-strong-wash: rgb(76 191 126 / 0.14);
  --color-tier-moderate: #45c7b8; --color-tier-moderate-wash: rgb(69 199 184 / 0.14);
  --color-tier-weak: #918ea6;     --color-tier-weak-wash: rgb(145 142 166 / 0.14);
  --color-grade-supported: #4cbf7e;
  --color-grade-mixed: #45c7b8;
  --color-grade-weak: #d07b5b;
  --color-grade-folklore: #e06c6c;
  --color-module-foundations: #8ba3e8;
  --color-module-structure: #93b587;
  --color-module-patterns: #b98bb0;
  --color-module-risk: #d081a0;
  --gradient-wash: linear-gradient(145deg, #14121f 0%, #191627 40%, #151329 70%, #14121f 100%);
  --gradient-spark-up: linear-gradient(180deg, rgb(96 165 250 / 0.14) 0%, rgb(96 165 250 / 0) 100%);
  --gradient-spark-down: linear-gradient(180deg, rgb(251 146 60 / 0.14) 0%, rgb(251 146 60 / 0) 100%);
  --orb-1: radial-gradient(circle, rgb(139 92 246 / 0.05) 0%, transparent 70%);
  --orb-2: radial-gradient(circle, rgb(99 102 241 / 0.04) 0%, transparent 70%);
  --shadow-soft: 0 4px 24px rgb(0 0 0 / 0.45), 0 1px 4px rgb(0 0 0 / 0.3);
  --shadow-lift: 0 6px 24px rgb(0 0 0 / 0.5);
  --shadow-overlay: 0 8px 40px rgb(0 0 0 / 0.5);
}
@media (prefers-color-scheme: dark) {
  [data-theme="system"] {
    /* FULL duplicate of the [data-theme="dark"] block above — the executor writes it out
       verbatim (all ~45 lines). Keep the two in lockstep; a drift test in R1 compares them
       by parsing this file. */
  }
}

/* ── Behavior globals (kept from v1, values re-pointed) ──────────────────────────────── */
html {
  background-color: var(--color-paper);
  color: var(--color-ink);
  font-variant-numeric: tabular-nums lining-nums;
  -webkit-text-size-adjust: 100%;
  overflow-x: hidden;                 /* the page never scrolls sideways */
  overscroll-behavior-y: contain;     /* no pull-to-refresh surprise in standalone (§7.1) */
}
body { font-family: var(--font-ui); font-size: var(--text-sm); line-height: var(--text-sm--line-height); }

/* L0 wash — fixed layer, never background-attachment (iOS). MUST be mounted INSIDE the
 * data-theme / academy scope or it reads the wrong wash (§4.1). */
.app-wash { position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: var(--gradient-wash); transform: translateZ(0); }
.app-wash::before, .app-wash::after { content: ""; position: absolute; border-radius: 999px; }
.app-wash::before { top: -140px; right: -100px; width: 620px; height: 620px; background: var(--orb-1); }
.app-wash::after  { bottom: -120px; left: -80px; width: 420px; height: 420px; background: var(--orb-2); }
@media (max-width: 767px) {
  .app-wash::before { width: 340px; height: 340px; opacity: 0.6; }
  .app-wash::after  { width: 240px; height: 240px; opacity: 0.6; }
}

/* Surfaces (§3.4) — L1/L2 never blur; L3/L4 blur on an inner wrapper so iOS clips the
 * blur to the radius (Safari does not clip backdrop-filter to border-radius). */
.surface { background: var(--color-surface); border: 1px solid var(--color-hairline);
  border-radius: var(--radius-card); }
.surface-raised { background: var(--color-surface-raised); border: 1px solid var(--color-hairline);
  border-radius: var(--radius-card); box-shadow: var(--shadow-soft); }
.surface-bar { background: var(--color-surface-bar); }
.surface-bar > .bar-blur { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  overflow: hidden; }
.surface-overlay { background: var(--color-surface-overlay); border: 1px solid var(--color-hairline-strong);
  border-radius: var(--radius-panel); box-shadow: var(--shadow-overlay); overflow: hidden;
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }
@supports not (backdrop-filter: blur(1px)) {
  .surface-bar, .surface-overlay { background: var(--color-surface-solid); }
}

.no-scrollbar { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.no-scrollbar::-webkit-scrollbar { display: none; }

:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important; animation-iteration-count: 1 !important;
    transition-duration: 0ms !important; scroll-behavior: auto !important;
  }
}
/* Reduced transparency must win at EVERY theme scope — a :root-only override loses to the
 * theme blocks above (custom properties resolve at the nearest defining ancestor). */
@media (prefers-reduced-transparency: reduce) {
  :root, [data-theme="dark"], [data-theme="system"] {
    --color-surface: var(--color-surface-solid);
    --color-surface-raised: var(--color-surface-solid);
    --color-surface-bar: var(--color-surface-solid);
    --color-surface-overlay: var(--color-surface-solid);
  }
}
```

*(There is no Academy token scope (D4): both rooms read this one sheet in both themes. The
Academy's solid cards use `--color-surface-solid` directly, so the reduced-transparency
override never needs to touch it.)*

---

## Appendix B — `copy.ts` additions (mechanical voice; exact strings)

| Key | String |
|---|---|
| `macro.provenance` | `Index levels · FRED · prior close` |
| `macro.proxyChip` | `ETF proxy` |
| `macro.proxyNote` | `{symbol} is an ETF whose price tracks this group; it is not the index level.` |
| `macro.indexUnavailable` | `Index level unavailable — showing {symbol} (ETF proxy).` |
| `desk.edition` | `The Desk — Evening Edition` |
| `desk.status` | `Markets {state} · data as of {close} · updated {stamp}` |
| `calendar.importanceHigh` | `high` |
| `calendar.empty` | `A quiet stretch — no scheduled catalysts in the next 14 days.` |
| `calendar.emptySub` | `Curated from the full FRED release feed; the rest was noise.` |
| `mover.quiet` | `No moves cleared the catalyst-or-noise bar today.` |
| `mover.relvolNote` | `RelVol = volume ÷ 20-day average. "No clear catalyst" usually means noise; a cause sometimes surfaces later — absence of news is not a reason to act.` |
| `palette.hint` | `⌘K` |
| `palette.placeholder` | `Go to a room, lesson, or ticker…` |
| `login.headline` | `Your personal broadsheet for the market.` |
| `login.subline` | `Not a prediction oracle. Not a signal feed. A daily record of what happened, why it might matter, and what the base rates actually say — including the misses.` |
| `login.quote` | `"An investor who has all the answers doesn't even understand the questions."` |
| `login.quoteAttribution` | `— Sir John Templeton` |
| `academy.quote` | `"The first step to understanding markets is understanding that no one fully understands markets."` |
| `dotplot.caption` | `Each dot: 1 in 20 past outcomes.` |
| `dotarray.caption` | `Each dot is one historical case. Misses are intentionally visible.` |

The Range Ladder reuses the pinned `volband.label` + `volband.caveat` verbatim (per-horizon
frequency sentence + regime caveat) — no parallel fan-label strings exist, so the chart and
its accessible table can never drift apart. `calendar.noEdge` is untouched (it means "no
directional edge", not "no events"). Rules unchanged: components never inline strings;
`fill()` still throws on placeholder mismatch; the copy unit test pins every string above.

---

## Appendix C — FRED release allowlist (Bug 2) and index series (Bug 1)

**Series (Bug 1):** `SP500` (S&P 500, daily close, ~1-day lag), `NASDAQCOM` (Nasdaq
Composite), `DJIA` (Dow Jones Industrial Average) — level + prior via `latest_two`. Russell
2000: no free FRED series — IWM stays an honest proxy (Appendix E-1). UI labels: "S&P 500",
"Nasdaq Composite" (NOT "Nasdaq 100"), "Dow". Fallback proxy labels per slot: `SPY`, **`QQQ`
labeled "Nasdaq-100"** (it does not track the Composite), `DIA`.

**Release allowlist (Bug 2)** — the single source of the calendar vocabulary; `code` is what
the chip renders:

| FRED release name (match) | code | display | kind | importance |
|---|---|---|---|---|
| Consumer Price Index | CPI | Consumer Price Index | macro | high |
| Employment Situation | JOBS | Jobs report | macro | high |
| Producer Price Index | PPI | Producer Price Index | macro | medium |
| Gross Domestic Product | GDP | GDP | macro | medium |
| Personal Income and Outlays | PCE | PCE (inflation) | macro | medium |
| Advance Monthly Sales for Retail and Food Services | RETAIL | Retail sales | macro | medium |
| FOMC Press Release | FOMC | FOMC decision | fed | high |

FMP earnings rows: `code: EARNINGS`, importance high when the symbol is in `_CORE_SERVED`,
else medium. Explicitly excluded despite sounding relevant: "Standard & Poors" and "Dow Jones
Averages" (index-data publications, not catalysts), "H.15 Selected Interest Rates" (daily),
"CBOE Market Statistics" (daily). Everything not on the list is dropped — the list only ever
grows by a deliberate commit.

---

## Appendix D — VRT config sketch (Part 9 made concrete)

```ts
// playwright.config.ts — additions (top-level expect block; projects already match §9.1)
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.01,
    animations: "disabled",
    caret: "hide",
    scale: "css",
  },
},

// e2e/vrt.spec.ts — the pattern every shot uses
test.use({ contextOptions: { reducedMotion: "reduce" } });
async function shoot(page: Page, path: string, name: string) {
  await page.goto(path);
  await page.evaluate(async () => { await document.fonts.ready; }); // await INSIDE the page
  const masks = page.locator('[data-vrt="mask"]');
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask: [masks] });
}
// fonts-blocked shot: context.route('**/*.woff2', r => r.abort()) before goto, skip fonts.ready
```

Dark-theme shots set the theme cookie before navigation (same mechanism as `theme.spec.ts`).
Seeded shots gate on `MSM_SEEDED=1` like the existing data specs.

---

## Appendix E — Logged local decisions (the designer's log; each also lands in DECISIONS.md)

1. **Russell 2000 hybrid:** index levels for SPX/Nasdaq Composite/Dow from FRED; small-caps
   slot keeps IWM as an explicit, chip-labeled ETF proxy. Rejected: dropping small caps
   (loses breadth-of-market at a glance); a new data provider (out of scope).
2. **Fonts:** Playfair Display (display) + Inter (UI) + JetBrains Mono (numerals) + Newsreader
   (prose + small editorial italics, kept). Serif floor: Playfair ≥19px, never italic below
   display sizes. Rejected: Playfair for prose or small italics (display face, fragile
   hairlines at text sizes); dropping Newsreader (the Academy is a reading room).
3. **Gain/loss pair** moves Wong → Figma blue/orange (#2563eb/#ea580c + AA text steps). Both
   are colorblind-safe; the Figma pair sits naturally in the indigo world. Redundant encoding
   unchanged.
4. **Earnings importance heuristic:** high when the symbol is in the pipeline's served core,
   else medium. The user-watchlist half of the first draft was dropped in review — the
   watchlist is app-DB state the ingest doesn't hold. Rejected: consensus-size heuristics
   (false precision).
5. **Desk two-column at 1366px as a broadsheet spread** — narrative modules in sequence in
   the main column, reference modules (Watchlist, compact Calendar, SourceStatus) in the
   rail; DOM and phone keep the strict ritual order. Rejected: reordering DOM (breaks tab
   order and the phone ritual); single-column desktop (wastes the width the one-screen claim
   was written for).
6. **`<details>` stays** for setup cards (semantics + zero JS), with the expansion instant
   because its subtree is P2. Rejected: extending the symbol-fixed Rail (P6 decision), animated
   expansion (motion over probability content).
7. **VRT pixel oracle is CI (Linux)**; local macOS runs ignore snapshots unless regenerated.
   Rejected: per-OS baseline sets (doubles maintenance for one developer).
8. **Route transitions via CSS `template.tsx`, opacity-only** — no translateY (review: a
   translating page moves the probability visuals inside it; a uniform fade contains no
   relative motion), not the experimental View Transitions flag (unstable API — a stall risk).
9. **Theme toggle stays on /settings** — labeled **"Theme"** (amended 2026-07-12: D1 made the
   setting app-wide, so "Desk theme" would itself have become the lie the original label was
   trying to avoid). Helper text carries the scope: "Applies everywhere — Morning or Midnight,
   one look at a time." The cookie is renamed `desk-theme` → `msm-theme` for the same reason.
   Rejected: nav toggle (chrome creep), unscoped "Dark mode" label (says nothing about scope).
10. **Login brand-panel copy** enters `copy.ts` (login.* keys) — even marketing-flavored
    lines obey the one-deck rule and the mechanical voice (attributed quote allowed).
11. **Mastheads stay muted, accent only on interactive text + small in-card slot labels** —
    matching what the Figma actually does (its eyebrows are `#7c7a8e`, its accents are the
    small slot headings). The first draft accented the mastheads and was reversed in review:
    eight indigo mastheads would make the accent mean "chrome" as often as "act here".
12. **Figma's "Focus Watchlist" 14-day sparkline window** adopted — historical prices in a
    sparkline are a record, not a forecast; allowed and wanted.
13. **The amber–orange REGION is reserved, not just the alert hex** — tier-moderate and
    grade-mixed moved to teal; module hues chosen off-amber. Reservation is perceptual: a
    Desk of amber-ish chips would drown the gate flag with zero hex collisions.
14. **The Range Ladder replaces the fan-cone** — per-horizon rows on a return axis, nested
    50/80 bands, embedded quantile dotplots, no median mark, no connecting silhouette. A
    forward-widening cone is the visual grammar of a projection; the ladder is the honest
    fan, sliced. Bands paint in `--color-band` (new), never the accent (accent = interactive)
    and never up/down (a symmetric range has no direction).
15. **Atomic class rename in R1** (option b) instead of legacy token aliases — Tailwind v4
    silently drops utilities whose tokens vanish, so aliases would hide drift; the rename +
    grep #9 make the cut visible and complete in one commit. Rejected: aliases until R6
    (invisible rot).
16. **The Academy diverges structurally, never chromatically** — solid paper cards (no
    glass), serif kickers instead of terminal mastheads, reading line-height, wider spacing —
    inside the one shared palette and theme (user decisions D1/D4). The first draft's "same
    glass, warmer hexes" was rightly called a tinted dashboard in review; the user then
    resolved the palette question entirely by unifying it.
17. **Theme stamping is an inline pre-paint script on `<html>`, never a root-layout cookie
    read** — a server `cookies()` call in the root layout would force every route dynamic and
    break the `force-static` login/offline pages the service worker precaches. Rejected:
    per-room server stamping (leaves the Academy unthemed, violating D1), client-effect
    stamping (theme flash).
18. **Charts appear as completed wholes** (200ms fade max); no directional draw-in anywhere —
    a left-to-right sweep on a price series reads as momentum next to visuals that insist
    they are not forecasts.
