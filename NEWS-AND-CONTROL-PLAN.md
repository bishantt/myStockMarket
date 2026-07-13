<!-- NEWS-AND-CONTROL-PLAN.md — authored 2026-07-12. Companion to DEVELOPMENT-PLAN.md,
     UI-REDESIGN-PLAN.md, and APP-FEEL-PLAN.md. Typeset copy: docs/News-And-Control-Plan.pdf.
     Written by a planning session while the app-feel build (F6–F7) was still running in a
     parallel session — so this plan cites INTENT and ACCEPTANCE CRITERIA, never line numbers.
     Where it names a file, re-verify against the working tree at build time. -->

# NEWS & CONTROL PLAN — "A Front Page, Not a Feed"

*Three commissions in one contract: a News/Discover section that explains the day's real
catalysts, the Macro Pulse finished and expanded into an honest household macro board, and a
control room that lets the user run the pipeline themselves — plus two cross-cutting repairs:
every number gets its time window, and every surface earns its footprint. The organizing idea
is the same one the app was founded on: this product is a newspaper, not a feed. A newspaper
has an editor, a front page, provenance under every figure, and a press schedule the reader
can see. A feed has an algorithm, a leaderboard, and a scroll that never ends. We are building
the first thing.*

**Executor:** Claude Opus 4.8, unattended, same working rules as DEVELOPMENT-PLAN.md (TDD per
its §6.2, plain-English code and docs, session ritual, DECISIONS/LESSONS logging, phase gates).

**THE AUTONOMY CONTRACT (binding; restates the user's standing directive of 2026-07-11 so this
plan is self-contained).** The user is not watching and will not answer mid-build. Run N0 → N7
to completion, in order, without a single pause for permission:

- **Never ask. Never check in. Never wait.** Do not present options, do not end a reply with
  "shall I continue?", "let me know", or an offer of next steps — after a completed step, the
  next action IS the next step. A phase gate passing is not a checkpoint to report and wait
  at; tag it and roll straight into the next phase.
- **Anything that would have been a question goes to QUESTIONS-FOR-BISHANT.md** — marked
  [NEED], [VETO?], or [FYI] as the existing file does — then make the most reasonable
  assumption, mark whatever is built on it (code comment + DECISIONS.md + PROGRESS.md), and
  keep going. The one pre-logged decision in Part 0 proceeds on its stated default if the
  user has not answered it by build start.
- **The only stop is a genuine, unworkaroundable blocker** (e.g. a required secret that is
  absent and cannot be faked). Part 0.3 lists exactly which steps need which secret, and every
  one of them has a fixture-backed path so the build continues while the secret is missing. A
  failing gate is not a stop — diagnose, fix, re-run. A flaky test is not a stop — deflake it
  or quarantine it with a logged reason. A time- or CI-gated item is not a stop — dispatch it,
  poll it (`gh run watch`), and do parallelizable work while it runs.
- **Sessions are resumable, not restartable.** Every session: the CLAUDE.md ritual first
  (pull → constitution → PROGRESS → LESSONS → DECISIONS diff for user vetoes → tests), resume
  from the position PROGRESS.md records, and before context runs out mid-phase, write the
  exact resumable state to PROGRESS.md and push.
- **Done means done:** `nc-final` tagged with its CI green, every evidence table printed into
  `docs/nc-evidence/`, the Part 9 docs sync executed, and a closing PROGRESS.md entry written
  for the user to read — not a message asking them to look.

**When this plan starts.** This plan was authored while the app-feel build (APP-FEEL-PLAN.md,
phases F0–F7) was still executing in a parallel session. **N0 begins only after `feel-final`
is tagged with green CI.** If the session ritual finds the feel build unfinished, finishing it
under its own plan comes first — the two plans are sequential, never interleaved. Because the
tree was a moving target while this was written, every phase here opens by re-verifying the
piece of the tree it is about to change; where this plan and the working tree disagree on a
detail (a file name, a prop, a copy key), the tree wins on the detail and this plan wins on
the intent.

**Authority order for this work:** honesty rules (UI-REDESIGN-PLAN.md Part 2, plus
APP-FEEL-PLAN.md Part 2's M-rulings, plus this plan's Part 2 C-rulings) > this plan on **news,
macro stats, time windows, density, and manual runs** > APP-FEEL-PLAN.md on **containers,
navigation, and performance patterns** > UI-REDESIGN-PLAN.md on **look** (tokens, type, color,
material, motion) > DEVELOPMENT-PLAN.md > judgment. One deliberate override, ordered by the
user in this plan's commission (2026-07-12): APP-FEEL §4.1 called module 00 "already minimal"
— the user has ruled it is not, and Part 4 here supersedes that one call. Where anything in
this plan seems to collide with an honesty rule, the honesty rule wins and the collision gets
logged.

**Evidence.** The diagnosis in Part 1 is built from: the user's production screenshot of
2026-07-12 6:20pm ET (committed at the repo root), a code-and-schema census of the working
tree taken 2026-07-12 evening (post-`feel-5`), the production `market_context` failure mode it
implies, and live verification of every external data source named in Part 6 (endpoints
fetched, licensing pages read — each row of Appendix A carries its citation). Where a fact
could not be verified, the row says so and the build re-verifies before relying on it.

**Adversarial pass:** Part 11. This plan was attacked along the six lenses the commission
named (trending-drift, honesty leaks, false provenance, cost blowouts, iOS traps, executor
stalls) before delivery; fixes are integrated inline and Part 11 records the attacks and where
each fix landed.

---

## Part 0 — Decisions I need from you: ONE (plus a provisioning list)

*The commissioning instruction: decide local choices, collect global ones here, and pause.
After working the plan to the bottom, exactly one choice ripples beyond its own sections —
because it amends a standing user decision (D2, the five-room tab bar). It gets a stated
default so the build never stalls on it. Everything else that came close is in the 0.2 table:
decided, logged, vetoable.*

### 0.1 THE decision: where the News room lives (amends D2)

The News/Discover section is commissioned as a first-class section. The app's navigation is a
standing user decision (D2, 2026-07-12): a bottom tab bar with five rooms — Desk, Scans,
Paper, Track, Academy — and Settings behind the gear. A sixth room has to go somewhere, and
that is your call, not mine. The options, honestly costed:

| Option | What it looks like | Cost |
|---|---|---|
| **A — six tabs (RECOMMENDED, and the default if unanswered)** | The tab bar becomes Desk · News · Scans · Paper · Track · Academy. At 390px each tab is ~65px wide — above the 44px minimum, labels stay legible at 10px. Desktop RoomNav gains the same sixth pill. | The bar gets denser; iOS convention tops out at five tabs, so this spends the comfortable maximum plus one. |
| B — News behind a Desk doorway | The Desk gains a bounded "Front page" module (top 3 catalysts + count line) linking to the full `/news` room; the phone tab bar stays five rooms; desktop RoomNav still gains the News pill (it has space). | On the phone, News is two taps instead of one. A "first-class section" that is one level down on the device the user actually reads. |
| C — News replaces Track in the bar | Track record moves behind the gear with Settings. | Rejected out of hand unless you order it: the track record is the app's public honesty surface — demoting it to reach a news feed reads exactly backwards. Listed only so the rejection is on the record. |

**Default: A.** Rationale: the commission says first-class; the Desk module (a bounded top-3
"Front page" preview) ships in BOTH options anyway (Part 7.6), so option B's only difference
is removing the tab — a one-file change (`TabBar.tsx`) that stays cheap to flip at any time.
Veto hook: a user line in DECISIONS.md or an answer here; N5 reads it before wiring the bar.

### 0.2 The calls that came closest to needing you — decided, logged, vetoable

| # | The call | What I chose | Why it did not need you | Veto hook |
|---|---|---|---|---|
| 0.2.1 | **Never hotlink article images** | Priority 1 in the commission reads "hotlink publishers' photos." This plan uses the publishers' photos — but always by fetching them at ingest (from the news APIs' own `image`/`image_url` fields, then og:image) and serving from our R2 cache. Hotlinking at render time is the one implementation this plan forbids. | Hotlinks rot (publishers move/expire images), many publishers block cross-site referrers (a broken-image icon — the exact failure state the commission bans), they leak the reader's IP to every publisher on the page, and they make CLS unknowable because we never learn the dimensions. Fetch-and-cache delivers the same photo with none of those failure modes, plus attribution and a link out on every card (Part 7.9). | DECISIONS.md 2026-07-12 (structural) |
| 0.2.2 | **The Fear & Greed slot is home-built and says so** | No legitimate, licensable external Fear & Greed source exists (Part 6.6 documents the search: CNN's index has no licensed API; the known JSON endpoint is unofficial; alternative.me's index is crypto-only). We compute our own **Mood gauge** from data the pipeline already holds, show its components on-surface, and label it ours. | The commission itself ordered this exact fallback ("construct our OWN transparent equivalent … never present a home-grown number as if it were CNN's"). | DECISIONS.md 2026-07-12 (structural) |
| 0.2.3 | **Manual runs go through GitHub Actions, never through Vercel** | The in-app "run" buttons dispatch the existing `workflow_dispatch` triggers on the nightly workflows (with a new `mode` input), and the app only ever WRITES a `manual_run` request row (user state). The Next.js server never fetches a provider or writes a pipeline table. | The constitution's data-flow rule: the pipeline computes and writes; the app reads and writes only user state. A Vercel route that fetched FRED and upserted macro rows would be a second, unaudited writer with its own failure modes. GitHub Actions already has the secrets, the concurrency lock, idempotent publish, and logs. | DECISIONS.md 2026-07-12 (structural) |
| 0.2.4 | **Sector/theme classification is deterministic; the LLM only picks the catalyst type** | Sector comes from instrument metadata + the provider's entity industry field + a fixed keyword table (Appendix E); themes (AI, defense) come from the same fixed table. The LLM's classification duty stays what it already is: `event_type` on the article. | "LLM narrates, never computes" extends naturally to "never invents taxonomy." A keyword table is testable, diffable, and cannot drift week to week. | DECISIONS.md 2026-07-12 (local) |
| 0.2.5 | **Significance is a fixed formula, not a model output** | The Front Page ranks by a deterministic significance score (Appendix E): breadth of impact, magnitude vs the ticker's own volatility, catalyst-class prior, source corroboration, recency. Weights are constants in the plan; changing them is structural. | A ranking the pipeline computes from stated inputs can be explained under every card ("why this is here"). A model-ranked feed cannot. This is also the anti-trending firewall (C1). | DECISIONS.md 2026-07-12 (structural) |
| 0.2.6 | **Time-range CONTROLS ship on exactly two surfaces** | The ticker chart (1M / 3M / 6M / 1Y / 5Y on daily bars) and the News room (Today / This week). Every other surface gets explicit WINDOW LABELS, not controls (Part 5.3 walks every surface and says why). | The commission's own rigor test ("only offer a range if the underlying data supports it honestly") eliminates the rest: EOD bars have no intraday, movers are 1-day by definition, scan metrics are as-of the nightly run, and evidence horizons are fixed by C3. | DECISIONS.md 2026-07-12 (local) |
| 0.2.7 | **The pipeline strip replaces module 00, and freshness escalates by state** | Module 00's card becomes a one-line status strip under the Desk header (Part 4.1): quiet when fresh, amber and expanded when stale, red and impossible to miss when dead. The same strip is the doorway to the control room. | The user ordered the shrink; the honest part is the escalation ladder — freshness stays "visible" by being LOUD exactly when it is bad news, not by being large every day. | DECISIONS.md 2026-07-12 (structural) |
| 0.2.8 | **New macro stats live in a new `macro_stat` table, not more `market_context` columns** | A keyed row per (series, as-of date) with value, prior, and a provenance JSON — because the new stats update on five different cadences and each needs its own honest as-of date. `market_context` keeps the per-run-night market snapshot it already models. | Purely internal data modeling; the honest display requirements force the shape. | DECISIONS.md 2026-07-12 (local) |

### 0.3 What you must provision (actions, not decisions — the build starts without them)

Each item names its consumer phase and its fixture-backed fallback, so nothing here blocks N0.
Add these at your convenience; the build flips each feature live when its secret lands and
logs the flip in PROGRESS.md.

| # | Provision | Where it goes | Needed by | Until it lands |
|---|---|---|---|---|
| P-1 | **A public R2 bucket for article images** (suggested name `msm-media`), on the existing Cloudflare account, with public access via a custom domain or its `r2.dev` development URL — plus an API token that can write it (the existing R2 token works if it is account-scoped; if it was scoped to `msm-history`, mint one more). | GH secrets: `R2_MEDIA_BUCKET`, `R2_MEDIA_PUBLIC_BASE` (the public base URL); reuse `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET` if account-scoped. Vercel env: `NEXT_PUBLIC_MEDIA_BASE` (same base URL, for `next/image` remotePatterns). | N4 (image caching live) | The image pipeline runs against local fixtures; cards render the L3/L4 designed fallbacks (which must be first-class anyway, Part 7.9); the feed ships. |
| P-2 | **A fine-grained GitHub PAT** with `actions: read+write` on this one repo (nothing else), for dispatching and polling workflow runs from the app. | Vercel env: `GH_DISPATCH_TOKEN`, `GH_REPO` (e.g. `bishantt/myStockMarket`). | N6 (control room live) | The control room renders with the dispatch button in its "not configured" state, which states plainly that the token is absent — every other state is e2e-tested against a mocked GitHub API. |
| P-3 | **`ANTHROPIC_API_KEY` wired into the two nightly workflow env blocks.** The secret already exists in GitHub (Appendix D of the development plan); the workflows simply do not pass it to the jobs, so every LLM stage silently skips in production today. N4 adds the env lines; you only need to confirm the secret is present and funded (the console spend cap you set at Session-0 still governs). | `.github/workflows/nightly-a.yml` + `nightly-b.yml` env blocks (a code change, in N4). | N4 (live extraction) | Extraction tests run on scripted fakes as they do today; the recorded fixture night drives the UI. |
| P-4 | *(only if N4's measured call budget demands it)* a paid Marketaux tier. Part 7.3 budgets the nightly ingest inside the free tier first; the gate prints the real nightly call count before any upgrade is even proposed. | — | — | Free-tier budget per Part 7.3. |

---

## Part 1 — The diagnosis (evidence first)

### 1.1 The Macro Pulse is telling the truth twice and the truth zero times

The user's screenshot (2026-07-12, 6:20pm ET, production) shows module 01 in this state: every
index row is an ETF — "S&P 500 · SPY (ETF PROXY) 754.94", with a SECOND freestanding "ETF
PROXY" chip under it — and under all four proxy rows, a footer that says **"Index levels ·
FRED · prior close."** Three defects in one frame:

1. **The footer contradicts every row above it.** 754.94 is SPY's price; the S&P 500 was near
   6,800. The provenance line is a static copy string written for the happy path, rendered
   regardless of what the rows actually show. A provenance line that can disagree with its own
   surface is worse than none (this becomes ruling C6).
2. **The label says "ETF proxy" twice per row** — once in the label suffix, once in a chip.
   The R0 spec mandated both belts; on screen they read as noise, and noise is where a
   beginner stops reading.
3. **Every slot degraded at once, silently.** The R0 fix (true index levels from FRED into
   `market_context`, honest per-slot fallback) is correct code sitting on a database whose
   rows predate it: the app fell back to the ETF path for all four slots, and nothing anywhere
   said "index levels are missing tonight." Per-slot fallback is honest; FLEET-WIDE fallback
   with no degradation notice is a silent failure mode — the exact species the source-status
   footer exists to catch. (Why the rows were missing is unambiguous from the calendar: the
   fix landed on a Saturday; Job A last wrote `market_context` on Friday evening under the old
   code. It self-heals Monday night — but "the app was confusing all weekend and nobody was
   told why" is the bug, and it recurs any night the FRED index fetch fails.)

The hierarchy also predates the F5 rethink in the deployed build (VIX and the 10-year sat
below the small-cap row). F5's shelf order fixes the phone; Part 3 finishes the job across
both widths and integrates the Part 6 additions.

### 1.2 The footprint disease, named

Module 00 — PIPELINE spends a full Surface card, first position, on: a masthead, one date
("Last cloud run — Jul 11"), and a fixed sentence ("Written by the nightly pipeline in the
cloud — nothing runs on this device."). Its informational payload is one date and one status
that is almost always "fine." Honest accounting: the card's chrome-to-information ratio is the
worst in the app, and it sits in the single most valuable position the phone viewport has.
The same audit, run over every Desk module, finds smaller cases of the disease (Part 4.2's
table). The principle that fixes it without hurting honesty: **freshness must be prominent in
proportion to how BAD the news is** — a live pipeline earns one quiet line; a stale one earns
amber; a dead one earns the loudest surface on the page. The current design spends hero space
on the boring case and has no escalation for the scary one.

### 1.3 Desktop: acres bought, nothing built on them

The app's rooms outside the Desk are one column at every width, inside a `max-w-[1360px]`
shell — on a 1440px+ display that is a phone layout with margins. The F-plan's spread fixed
the Desk at `lg:`; the remaining rooms and the new surfaces need the same deliberateness, and
the Desk itself still leaves its widest band (≥1536px) unspent. Part 4.3 defines the full
grid: breakpoints, containers, per-room column maps, and the VRT rows that lock them.

### 1.4 Numbers without windows

The census found the pattern everywhere (Part 5.1 reproduces the full audit table): movers'
delta chips don't say 1-day; RVOL columns don't say 20-day (the definition lives in a footnote
on one surface and nowhere on others); the watchlist's price/delta/RVOL/sparkline carry no
window at all; the ticker's "Last close" delta is unlabeled; breadth's "63% above the 50-day
average" names its indicator window but not its as-of. The Range Ladder is the exception that
proves it can be done: every row carries `n=`, its window, and its axis anchor. Part 5 brings
every other number up to that standard.

### 1.5 The reader has no hands

On a Saturday, the Desk says "last run Jul 11" and offers nothing: no way to refresh what CAN
refresh (news, macro stats), no statement of why the rest cannot ("Friday's close is the
latest data that exists"), no view of what will run next and when. The pipeline is actually
in good shape for manual runs — both nightly workflows already expose `workflow_dispatch`,
publish is idempotent, and a concurrency group already serializes runs — but none of that
reaches the reader. Part 8 builds the switchboard and its honesty rules.

---

## Part 2 — The honesty ledger, extended (C-rulings)

*Everything preserved before is preserved here: P1–P14 (redesign Part 2.2) and M1–M10
(app-feel Part 2.2) bind every surface this plan adds. The rulings below are new, numbered
C1–C10, each with a named guard. The C is for CONTEXT — the family theme is that a number, a
headline, or a button without its context is the lie this plan exists to prevent.*

**C1 · The Front Page is edited by evidence, never by attention.** The News section ranks by
the deterministic significance score (Appendix E) and groups by sector and catalyst type —
never by price move alone, never by volume of coverage alone, and never by ANY behavioral
signal (clicks, views, "most-watched", social mentions — none of which the pipeline even
ingests, which is the deepest guard). Forbidden, mechanically: any sort or section named by
superlative ("top", "hottest", "biggest", "most"), any gainers/losers rail, any ordering the
reader cannot see stated. The feed's order is explained under its own header in mechanical
voice: "Ordered by catalyst significance — scope, corroboration, and size of the move it
explains." A mover with no catalyst appears ONLY in its honest form (C9), never as a ranked
"mover" in this room. Guards: the copy deck contains no superlative section names (unit test
on the deck); `e2e/news.spec.ts` asserts the feed order equals the seeded significance order
and that no gainers/losers grouping exists; drift rule 19 greps app source for
`gainers|losers|trending|most active|hot right now` outside copy.ts tests.

**C2 · Every number states its window, inline.** Every metric, column header, delta chip, and
stat rendered anywhere states the period it covers, in the same visual unit as the number —
not in a footnote, not only in a module footer. The vocabulary is fixed and lives in one place
(`copy.window.*`, Appendix B): `1D`, `5D`, `1M`, `3M`, `6M`, `1Y`, `5Y`, `20d avg`, `50d avg`,
`wk of {date}`, `{mon} {yyyy}`, `as of {date}`. A number whose window is genuinely the whole
surface's as-of (a price at last close) carries the shared as-of stamp — which every module
masthead already prints — plus the word that names it ("last close"), and nothing else needs
repeating. Guards: the Part 5.1 table is executable — each row lands as an e2e assertion on
its surface; the column-map unit tests assert every metric column's header contains a
`copy.window.*` token; the `new-surface` skill gains the checklist line "does every number on
this surface state its window?" in the N7 docs sync.

**C3 · Evidence horizons are properties, not preferences.** A base rate's horizon ("higher 10
trading days later"), a vol band's horizon, a signal's resolves-on date, and the Brier
resolution window are fixed, evidence-bound properties of their pattern. No time-range
control may ever apply to them, and no UI state may vary them. The RangeControl component
(Part 5.4) is physically unable to mount on those surfaces: it renders nothing unless its
`surface` prop is in the fixed allowlist (`ticker-chart`, `news-feed`), and a unit test
asserts the allowlist is exactly that. This is the p-hacking firewall the commission ordered:
a reader must never be able to fish across horizons until a pattern flatters them.

**C4 · Images inform; they never urge.** Article imagery is editorial illustration, not
salience juice. Concretely: images never animate, autoplay, zoom on hover, or carry motion of
any kind (they sit inside `data-p2`-free static frames, but the no-animation rule is absolute
anyway); no red badges, counters, or "LIVE" chips ride on them; image size is uniform within
a card tier — a bigger move never buys a bigger picture (size is set by layout slot, not by
content); the L4 generated fallback (sector/catalyst-keyed designed treatment) is visually
co-equal with photos so a card without a photo never reads as broken or lesser. Guards: VRT
locks card geometry per tier; drift rule 18 (all article imagery renders through the single
`NewsImage` component); the significance→layout mapping is size-blind by construction (the
feed template assigns slots by position, not score).

**C5 · A control that cannot act says why, before it is pressed.** Every action in the
control room renders in one of its named states (Part 8.5), and the not-applicable states
carry the explanation as their primary text — "Markets are closed. Friday's close is the
latest data that exists; the next close lands Monday 4:00pm ET." — never a bare disabled
button. The explanation always names the NEXT time the action becomes meaningful. Guard: the
state machine is a pure function (`lib/pipeline-control.ts`) with a unit test per state, and
the e2e suite drives each state via injected clock/fixtures.

**C6 · Provenance lines are computed from what is rendered.** No surface may carry a static
provenance string describing data it might not be showing. The Macro Pulse footer (and every
new provenance line in this plan) is assembled from the sources of the rows actually
rendered, and a unit test feeds it a degraded mix and asserts the line changes with it. The
copy deck supplies fragments; the composition is code.

**C7 · Staleness is data, not absence.** When a macro stat's source fails, the board renders
the last stored value WITH its age ("4.54% · as of Jul 9 — source unreachable tonight",
amber only at the module level per P11's reservation rules — the alert color budget for this
is defined in Part 6.8), never a blank, never a silently frozen number pretending to be
fresh. A stat with NO stored history yet renders the em-dash and the sentence that says the
source has not reported. Guard: unit tests per degradation rung; the seeded VRT set includes
a degraded board.

**C8 · A home-built gauge shows its work on the same surface.** The Mood gauge renders its
number ONLY alongside its component list (each input's value, window, and direction of
contribution) and the sentence naming it ours: "Computed by this app from breadth, volatility,
momentum, and range position — not CNN's index." The number without the breakdown may not
render anywhere (the component API makes the breakdown a required prop, same enforcement
shape as BaseRate). Guard: unit test — rendering without components throws; e2e asserts the
methodology line.

**C9 · No-catalyst honesty extends to the Front Page.** Where the pipeline finds a large move
with no identifiable catalyst, the News room says exactly that in its own quiet slot ("Moved
without a story" — listed after the catalyst cards, never ranked among them, capped at 3,
each row carrying the existing noise line). A catalyst card with zero affected tickers in our
universe says "No direct listing in our universe" rather than inventing exposure. Guards: e2e
on the seeded no-catalyst mover; the cluster builder's unit tests pin both cases.

**C10 · The Front Page never pushes.** No push notifications, no unread badges, no "N new
stories" pills, no auto-refresh while the reader is on the page (nightly data; the page
states its press time). The room re-renders on navigation like every other ISR room and its
masthead carries the same as-of stamp. This inherits M7 and P6 and exists so nobody
re-litigates them for news specifically. Guard: drift rule 15's self-moving greps already
cover auto-advance; the e2e asserts no badge/count on the News tab item.

---

## Part 3 — The Macro Pulse, finished (commission Part A)

*Scope: module 01 and its pipeline feeds. Everything here lands in N1 — it is the correctness
phase, first after the instruments, exactly as R0 was for the redesign.*

### 3.1 Root cause, fixed at the pipeline (TDD first)

1. **Index-level degradation becomes loud.** `_read_macro` (Job A) already fetches SP500 /
   NASDAQCOM / DJIA levels+priors; tonight its failure mode is `None` → silent fleet-wide
   proxy fallback. Add a named source-status key: when any of the three index series returns
   no usable pair on a session night, `pipeline_run.sourceStatus` gains
   `"fred-indexes": "degraded"` (the existing per-source degradation machinery then does what
   it already does: the run succeeds, the Desk's source footer reports it, forced-open per
   M2). Unit tests: all-three-missing, one-missing, weekend-no-op.
2. **A macro write never regresses to null on a flaky night.** `_upsert_market_context`
   currently overwrites with whatever the night fetched. Amend: index level columns update
   only when the fetch produced a value; a `None` leaves the prior stored value in place, and
   the row gains `index_levels_as_of` (date) so the app can render age honestly (C7). The
   Desk then shows a stale-but-dated level with its age instead of collapsing to the ETF —
   the proxy path remains only for slots that have NEVER had an index level (small caps) or
   whose staleness exceeds 5 sessions (at which point a dated level is worse than an honest
   proxy; constant in `pipeline/config.py`, tested at both boundaries).
3. **Verification of the heal.** N1's gate includes a production check (read-only SQL via the
   session pooler or the app's own rendered page) confirming `market_context` carries index
   levels after the first post-N1 nightly run, and the screenshot state of 1.1 cannot recur:
   the seeded e2e includes the "levels missing entirely" variant asserting the degradation
   notice renders.

### 3.2 One label per row (the grammar)

Each slot renders exactly ONE name and ONE provenance mark:

- **Index slot, index data (the normal case):** label "S&P 500" · the index level as the
  figure · delta chip "▲ +0.45% · 1D" (the window token joins the chip — C2). No suffix, no
  proxy chip, nothing else.
- **Index slot, stale index data (≤5 sessions):** same, plus the age note in the slot footer:
  "as of Jul 9" in muted mono. (The masthead's as-of covers the fresh case; only staleness
  earns a per-slot date — quiet exactly when normal, per Part 1.2's principle.)
- **Proxy slot (small caps by design; any index slot after 5 stale sessions):** label
  "Small caps" (or the index name for a degraded index slot) · the ETF price as the figure ·
  ONE chip: "IWM · ETF price". The chip is the single proxy mark; the label suffix
  "(ETF PROXY)" is deleted. The existing label-source coupling test (an index NAME may only
  sit on index-sourced data) survives with the new grammar — a degraded index slot's label
  gains "· via SPY" inside the chip, never an unqualified index claim over an ETF price.
  `copy.macro.proxyNote` stays as the chip's title text.
- **Nasdaq naming:** the index slot is "Nasdaq Composite" (that is what NASDAQCOM is); its
  proxy chip, when shown, reads "QQQ · Nasdaq-100 ETF price" — the mismatch is stated, not
  blurred (R0's own rule, kept).

### 3.3 The provenance footer is computed (C6)

`buildMacro` returns, alongside the slots, a provenance summary the component renders
verbatim; the builder composes it from the slots' actual sources. The three canonical
outputs (unit-tested):

- All index slots live: `Indexes: FRED, prior close · Small caps: IWM ETF close · VIX: Cboe
  via FRED · 10-yr: US Treasury via FRED`
- Mixed: `S&P 500, Dow: FRED, prior close · Nasdaq: QQQ ETF close (index level unavailable)
  · …`
- Fleet-degraded: `Index levels unavailable tonight — showing ETF closes, labeled per row ·
  …` (and the source footer independently reports `fred-indexes` degraded).

### 3.4 The hierarchy, reasoned for a beginner (both widths)

The beginner's questions, in order: (1) What did the market do? (2) Should I be worried?
(3) What does money cost right now? (4) What about the rest of the market? The module answers
in that order at every width, integrated with the Part 6 additions:

- **Hero (unchanged position):** S&P 500 index level — the one hero figure, delta chip with
  window.
- **Row 1 — the risk pair (phone shelf order 1–2, desktop first row):** VIX (labeled "VIX ·
  fear gauge" via its existing glossary term, value + 1D delta + its percentile note per
  Part 6.5) and the 10-year yield (value + 1D delta). These carry information the hero does
  not.
- **Row 2 — the tape echoes:** Nasdaq Composite, Dow, Small caps (IWM chip grammar). On the
  phone shelf these ride after the risk pair (F5's order, kept and now reasoned in the same
  breath as the additions).
- **Row 3 — the household board (new, Part 6):** 30-yr mortgage · CPI YoY · Gold · USD→NPR ·
  Mood gauge. On phone this is the second shelf row of the same module (one module, two
  labeled shelves — "Markets" and "Money & mood"); on desktop it is the module's second grid
  row. Each cell carries its own as-of because their cadences differ (C2/C7).
- **Breadth strip:** stays fixed below (F5's rule — the summary line must not be hideable),
  gaining its as-of word: "63% above the 50-day average · at Fri's close".

Order is enforced the same way the ritual order is: a DOM-order e2e assertion.

### 3.5 Tests & gate additions (N1)

Pipeline: sourceStatus key (3 cases) · upsert no-regress (value, None, boundary 5 sessions) ·
`index_levels_as_of` written. App unit: label grammar per slot state (6 cases incl. the
coupling regression lock) · computed footer (3 canonical + degraded-mix property) · delta
window token present. E2E (`desk.spec.ts`): seeded normal state (one label per row, no
freestanding proxy chip on index rows, footer matches slots), seeded degraded variant (notice
renders, footer switches, source footer forced open). VRT: macro module both themes both
widths, plus the degraded variant. Gate: all above green on the `nc-1` tag; production heal
verified after the first nightly.

---

## Part 4 — Footprint & the desktop broadsheet (commission Part A2)

### 4.1 Module 00 becomes the status strip

**What it is now:** a full Surface card holding one date and one fixed sentence (1.2).
**What it becomes:** a one-line strip mounted INSIDE the Desk header block (below the date
line, above the grid — it is page chrome, not a ritual station), rendered by a new
`PipelineStrip` component:

- **Fresh (ran last session night):** one quiet line, muted mono, ~28px tall:
  `Data through Fri Jul 11 close · pipeline ran 22:41 UTC · next: Mon ~6:37pm ET` — with the
  whole strip acting as the doorway link to the control room (Part 8). No card, no masthead,
  no icon. The "next:" time comes from the trading calendar (next session + the cron hour).
- **Aging (no successful run for exactly one expected session):** the strip gains the amber
  word `stale` and the missed night: `No run for Mon's session · showing Fri's data ·
  check the pipeline →`. Amber here is a sanctioned third consumer of the alert token — this
  is a genuine alert, exactly what P11 reserves the color for; the drift rule's consumer list
  gains `PipelineStrip` and the plan records the amendment (Part 9 docs sync).
- **Dead (≥2 expected sessions missed):** the strip becomes a full-width red-bordered banner
  — the ONE surface in the app allowed to be loud, because a silently dead pipeline serving
  stale data is the catastrophic failure mode. It states the last good night, what every
  number on the page is therefore showing, and links to the control room. This banner may
  never be dismissed; it clears only when a run succeeds.
- The strip's logic is a pure function of (`pipeline_run` rows, trading calendar, now) —
  `lib/freshness.ts`, unit-tested across: fresh Friday-on-Saturday (weekend is NOT stale),
  holiday gaps, one-missed, two-missed, never-ran.

Module 00 as a ritual station is retired; the ritual order test updates to 01→07 + scorecard
+ sources (a deliberate, logged amendment to the "00→07 inviolable" clause — the ORDER of
what remains stays inviolable; the strip is not a station and never carries station data).
The masthead numbering across the app does not renumber (01 stays 01 — mastheads are names,
not an index that must start at zero; renumbering every module, test, and VRT baseline to
close a cosmetic gap is churn with regression risk and no reader value; logged).

### 4.2 The footprint audit (every module, same test)

The audit rule, applied at N2 and written into the styleguide as a standing principle: **a
module's chrome (masthead + padding + footers) may not exceed ~35% of its rendered height in
the seeded state, and no module may render a full card when its payload is a single line.**
Verdicts from the census:

| Module | Verdict | Change (N2) |
|---|---|---|
| 00 Pipeline | replace | → the strip (4.1) |
| 01 Macro pulse | keep | payload grows in Part 6; chrome already amortized |
| 02 Brief | keep | the brief never truncates (standing rule) — its height IS payload |
| 03 Calendar | keep | F5's temporal cut already right-sized it |
| 04 Movers | keep | F5's first-3 + disclosure already right-sized it |
| 05 Watchlist | keep | F5 split already right-sized it |
| 06 Setup cards | keep | born modular |
| 07 Sectors & scans | shrink | the one-line count + doorway keeps its own full card today; it becomes a half-width card sharing a desktop row (4.3), full-width one-liner on phone |
| Scorecard/journal | keep | F5 disclosure already right-sized it |
| Sources footer | shrink | the all-ok summary line loses its card chrome and renders as a plain footer line under the grid (degraded state unchanged: forced-open card, M2) |

### 4.3 The desktop grid, defined once

**Breakpoints (existing tokens, one addition):** `md` 768 · `lg` 1024 · `desk` 1366 · **new
`wide` 1536** (`--breakpoint-wide`). Container: `max-w-[1360px]` to `desk:`, `max-w-[1500px]`
at `wide:` (gutters 32px). The 4px grid, card padding, and 24px module gap are unchanged.

**The Desk:**
- `lg:` (1024–1365): as F5 built it — main `minmax(0,1fr)` + rail 320px. Unchanged.
- `desk:` (1366–1535): main + rail 340px (F5), with the Part 6-grown pulse rendering its two
  labeled rows as 6-up/5-up grids, and module 07 sharing a row with the Mood gauge detail
  card if Part 6.7 places one (else 07 stays half-width beside the scorecard).
- `wide:` (≥1536): the rail widens to 360px and the main column's GLANCE stations pack
  two-up where their content is card-shaped: setup cards render 2-up (they are independent
  cards, not prose), movers stay one-up (READ station — full-width rows), the brief stays
  one-up at its 65ch measure centered in the main column. No third column: the Desk is a
  reading ritual, and a second reading column would split the ritual's order into two
  ambiguous streams (the same reasoning that keeps READ stations off shelves). What ≥1536
  buys is internal density, not more columns.
- DOM order stays the ritual order at every width (existing e2e lock).

**Every other room gets an explicit map (all at `lg:` unless noted; one column below it):**

| Room | ≥lg composition |
|---|---|
| `/scans` | preset cards 2-up (exists); at `wide:` 3-up. |
| `/scans/[preset]` | header card full-width; table full-width (tables want width); the criteria card and count figure share one row at `desk:` (7/5 split). |
| `/paper` | ticket column 5/12 + (cost mirror above ledger) 7/12; ledger tables full-width of their column. The M3 aside spans. |
| `/track-record` | stat summary as a 5-up StatFigure row; forecasts card 5/12 beside the resolved-log table 7/12 at `desk:`; table full-width at `lg:`. |
| `/ticker/[symbol]` | chart 8/12 + (stats stack: last close, RangeControl, provenance) 4/12; Range Ladder full-width below. |
| `/academy` | module cards 2-up ≥lg (exists per F6), 3-up at `wide:`. |
| `/news` (new) | Part 7.7's own map (feed 8/12 + filter/context rail 4/12 at `desk:`). |
| `/settings` | cards 2-up ≥lg. |

Implementation is per-room Tailwind grid classes (the app deliberately has no layout
framework); what this table adds is the CONTRACT — each row lands as a VRT shot at 1366×768
and 1536×960 (new viewport in the VRT matrix for `desk`/`wide` splits, Part 9.5) and an e2e
no-horizontal-scroll assertion. Rationale note for the reviewer: this table places DENSITY
where content is enumerable (cards, tables, stat rows) and preserves single-column reading
where content is prose — that is the difference between a designed broadsheet and a dashboard
that tiles everything.

### 4.4 Tests & gate additions (N2, shared with Part 5's phase)

`lib/freshness.ts` unit suite (the five calendar cases) · strip states e2e (fresh via seed;
aging/dead via injected clock route param in the seeded build — the e2e drives the pure
function through a test-only search param the page reads ONLY under `MSM_SEEDED`, mirroring
the existing seeded-flag pattern) · footprint: the Desk phone page-height evidence shot
re-measured and recorded (expected: hero-position content rises by roughly the old module
00's height; the number gets recorded, not promised) · VRT: new `wide` viewport rows for
Desk + each room; strip states ×2 themes · e2e: every room at 1536 has no horizontal
scroll; ritual order intact with the strip outside the grid.

---

## Part 5 — Every number carries its window (commission Part A3)

### 5.1 The audit table is the spec

Each row below is an acceptance criterion: the SURFACE must render the TARGET label, and the
e2e/unit noted must pin it. (Census source: the working tree of 2026-07-12; re-verify labels
against the tree at N2 start — targets bind, current-state notes do not.)

| Surface | Number | Today | Target (exact string per Appendix B) |
|---|---|---|---|
| Macro pulse | index/ETF delta chip | `+0.45%` | `+0.45% · 1D` |
| Macro pulse | VIX / 10-yr values | unlabeled | value + `· 1D` delta chip + as-of via masthead; VIX adds the percentile note (6.5) |
| Macro pulse | breadth | `63% above the 50-day average` | `63% above the 50-day average · at Fri's close` |
| Movers | delta chip | `+8.2%` | `+8.2% · 1D` |
| Movers | RVOL cell | `3.1×` | `3.1× · 20d avg` (footnote definition stays; the cell no longer depends on it) |
| Watchlist rows | price/delta/RVOL/spark | unlabeled | delta `· 1D`; RVOL `· 20d avg`; the sparkline gets a caption row under the list: `Sparklines: 30 sessions, close only` (one caption for the module — per-row would stutter; the honest window stated once where all rows share it) |
| Scans tables | metric columns | mixed | every column header carries its window token: `1-day move`, `RVOL · 20d`, `Gap · open vs prior close`, `From 52w high`, `20-day move`, `5-day move`, `RSI · 14d` etc. — full column map in Appendix B |
| Scans header | count | `41 matches today` | unchanged (already windowed) + as-of stamp (exists) |
| Ticker | last close delta | unlabeled | `· 1D vs prior close` |
| Ticker chart | axis/coverage | none | the RangeControl states the active window; the chart caption states `Daily bars · adjusted · through Fri Jul 11` |
| Range Ladder | rows | already exemplary | unchanged (the model everything else is being raised to) |
| Setup cards / base rates | horizon | stated in sentence | unchanged text; C3 forbids controls here — N2 adds the negative test (no RangeControl inside `SetupCards`/`BaseRate` render trees) |
| Track record | summary + columns | prose states 10 trading days | column header `Horizon` → `Horizon (trading days)`; summary line keeps its sentence |
| Paper | cost mirror | windows present | unchanged; ledger delta chips gain `· at close` where they are marks-to-last-close |
| News (new) | mover context on cards | — | `+8.2% · 1D · RVOL 3.1× (20d avg)` from birth (Part 7) |
| Macro board (new) | each stat | — | per-stat as-of grammar from birth (Part 6) |

### 5.2 Enforcement that survives the plan

Three mechanisms, so the rule outlives this document: (1) the window vocabulary is a closed
set — `copy.window.*` — and metric-label copy keys compose from it; a deck unit test fails on
any metric key whose string lacks a window token (keys are grouped so the test knows which
are metric labels); (2) every DataTable column map ships with a unit test asserting header
tokens; (3) the `new-surface` skill checklist gains the window line (N7). A pure grep can't
see a missing window on an arbitrary JSX number — the deck test + column tests + the Part 5.1
e2e rows are the practical envelope, and the skill line covers the future.

### 5.3 Where range CONTROLS live, and where they deliberately do not

The rigor test from the commission, applied surface by surface (this table is the record of
the decision, so nobody re-litigates it by adding a toggle in a quiet PR):

| Surface | Control? | Why |
|---|---|---|
| Ticker chart | **YES** — `1M / 3M / 6M / 1Y / 5Y`, default `6M` | Daily bars, ~5y of served history. No `1D/5D`: intraday does not exist in an EOD product, and five daily points is a shrug pretending to be a chart. `5Y` renders only when the symbol carries ≥ 4y of bars (option hidden below that, with the chart caption stating actual coverage: `Showing full history: 2.1y`). Default 6M: long enough to show regime, short enough that the last month is readable — and it matches the vol-band framing the ticker page already teaches. |
| News room | **YES** — `Today / This week`, default `Today` | The nightly ingest accumulates news_items; "this week" = the last 5 sessions' clusters. Nothing finer exists (no intraday), nothing longer is honest yet (retention grows; the control adds `This month` only when 30 days of clusters exist — the builder checks). |
| Macro board sparkline (if 6.7 renders one) | no | Fixed 1Y window, labeled — one honest window beats a fishing UI on a stat whose point is its current level. |
| Movers / scans / watchlist | no | Metrics are as-of the nightly run with fixed lookbacks — a range control would change the DEFINITION, not the view. Labels per 5.1. |
| Base rates / vol bands / track record / Brier | no | C3. Fixed horizons are the evidence contract. |

### 5.4 The RangeControl component (built once, N2)

`components/RangeControl.tsx` — a segmented control in the house form-kit grammar (same
anatomy as `SegmentedControl`, radio semantics, 44px targets, 16px labels below `md`):

- Props: `surface: "ticker-chart" | "news-feed"` (closed union — C3's guard), `options`
  (label + value + `available: boolean`), `value`, `onChange`. Unavailable options render
  disabled with a `title` explaining why ("Less than 4 years of history for this symbol") —
  omission vs explanation follows the commission: options that can NEVER exist for the
  surface are omitted; options that exist but not for this item are shown disabled with the
  reason.
- Selection persists per-surface per-session (`sessionStorage["msm-range:" + surface]`) —
  a return visit within the session keeps the reader's frame; a fresh session returns to the
  default (deliberate: defaults are part of the editorial statement, and stale-persisted
  ranges quietly become the new default).
- **No loading state exists by design.** Both consumers receive their FULL data range in the
  initial ISR payload and slice client-side: the ticker page already serves ~5y of bars to
  the chart; the news feed serves the week's clusters (bounded, Part 7.7). Switching is a
  synchronous re-render — no fetch, no skeleton, no ISR interplay, nothing to keep fast
  because nothing got slow. (Payload check in the gate: the /news document stays under the
  route-size budget with a full seeded week.)
- Stillness: changing range re-renders the chart complete in its new window — no animated
  transition between ranges (the chart is a money visual; P2 and the existing CandleChart
  no-motion rule already bind it, and the RangeControl adds a negative test).

### 5.5 Tests & gate additions (N2)

Unit: RangeControl (closed surface union; availability rendering; persistence; default) ·
freshness of 5.1's column maps · deck window-token test. E2E: ticker range switch changes
the rendered domain with zero network requests (route interception asserts none) and the
caption updates; a sub-4y seeded symbol hides `5Y` and states coverage; news Today/Week
switch (lands with N5); every 5.1 row's assertion on its surface. VRT: ticker at each range
(masked timestamps), RangeControl states in the styleguide.

---

## Part 6 — The macro board (commission Part B)

*Five additions to module 01, each with a verified source, an honest cadence, and a
degradation ladder. The full source table with citations is Appendix A; this part is the
product spec. Phase: N3.*

### 6.1 The data home: `macro_stat`

New Prisma model (verbatim DDL in Appendix C): one row per (seriesKey, asOfDate) with
`value`, `prior` (the previous observation, for an honest period-over-period delta),
`asOfLabel` (the human window: "wk of Jul 9", "Jun 2026"), `fetchedAt`, `sourceKey`, and
`meta Json` (per-series extras: the Mood gauge's component breakdown lives here). Insert-or-
update by key; history accumulates (the 1Y context sparklines and the gauge's percentiles
read it). The pipeline is the only writer (0.2.3). `market_context` is unchanged — it stays
the per-session market snapshot.

### 6.2 The five stats (cadence-honest fetching)

Each stat is fetched by Job A on its own cadence — a source that updates weekly is CHECKED
nightly (one cheap call) but only writes a new row when the observation date advances, so
"as of" always reflects the SOURCE's date, never our fetch time (the difference between
freshness and thrash). Per-stat spec:

1. **US 30-year fixed mortgage rate** — FRED `MORTGAGE30US` (Freddie Mac PMMS), weekly,
   published Thursdays. Display: `6.72% · wk of Jul 9` with delta vs prior week. Beginner
   note (title text): "The average rate lenders quote on a 30-year fixed mortgage —
   the price of housing money."
2. **US inflation, CPI year-over-year** — FRED `CPIAUCNS` with `units=pc1` (percent change
   from a year ago, computed BY FRED — the pipeline stores what the source publishes and
   computes nothing; the not-seasonally-adjusted series is the one headline YoY figures
   quote). Monthly, released mid-month for the prior month. Display: `2.7% · Jun 2026` with
   delta vs prior month's YoY in the title, not a chip (a delta-of-a-rate chip invites
   misreading; the label IS the number's context here).
3. **Gold, per troy ounce (USD)** — source per Appendix A's verification (FRED's LBMA series
   are discontinued; the honest free path is the one Appendix A row records, labeled
   exactly as what it is — a reference price, its venue named, never "spot" if the source
   is a futures settle). Daily. Display: `$X,XXX · {venue} reference · 1D delta`.
4. **USD → Nepalese rupee** — Nepal Rastra Bank's published reference rate (the official
   source; endpoint and shape per Appendix A), daily. Display: `रु 1 USD = NPR 139.42 ·
   NRB reference` with the mandatory qualifier as the second line: `Remittance apps may
   differ.` We do NOT quote any remittance app: no legitimate rate API for TapTap/Remitly
   exists (Appendix A records the check), and a fabricated app rate is exactly the lie the
   commission forbids. Fallback source: the open mid-market rate feed named in Appendix A,
   labeled `mid-market reference` when in use (C6 — the label follows the actual source).
5. **The Mood gauge (ours)** — Part 6.5.

### 6.3 Cadence, caching, and the app side

The app reads `macro_stat` through the same ISR-600 morning loader path as everything else —
no new caching machinery, no client fetches. The board's cells each carry their own as-of
label (C2) because the masthead's as-of describes the RUN, not the observation. Manual
refresh of this board is Part 8's `macro` mode (fetch + publish + revalidate, minutes, cheap).

### 6.4 Degradation ladder (C7, uniform across stats)

1. Source ok, new observation → fresh row, normal render.
2. Source ok, no new observation (weekly/monthly series mid-cycle) → normal render; the
   as-of label IS the honesty (nothing is stale about a Thursday rate on a Tuesday).
3. Source unreachable tonight → render last stored row + age note `source unreachable
   tonight` + `sourceStatus["macro-{key}"] = "degraded"` (footer reports it).
4. No stored history (first nights, or a source that has never answered) → em-dash + `not
   yet reported` — information, not apology.
5. Stored value older than its cadence × 3 → the cell itself goes amber-worded (`stale —
   last {asOfLabel}`); this is the same alert-consumer amendment as the strip (Part 4.1),
   bounded to the module level.

### 6.5 The Mood gauge — our transparent fear/greed equivalent

**Why home-built:** Appendix A documents the licensing dead-end for CNN's index and the
crypto-only scope of alternative.me's. The commission pre-authorized the fallback (0.2.2).

**Definition (deterministic, computed by Job A, all inputs already in the pipeline's
possession; constants in `pipeline/config.py`, changing them is structural):**

- Components, each scored as a percentile of its own trailing 252-session history (the
  gauge's own stored history once it accumulates; the Parquet lake + `market_context`
  history bootstrap the first year):
  1. **Breadth** — % of universe above its 50-day average (higher → greedier).
  2. **Volatility** — VIX level, inverted (higher VIX → more fearful).
  3. **Momentum** — S&P 500 level vs its own 125-session mean (from the FRED SP500 series
     history), signed distance (higher → greedier).
  4. **Range position** — share of universe within 5% of its 252-day high minus share
     within 5% of its 252-day low (higher → greedier).
- Score = the unweighted mean of available component percentiles, 0–100, rendered with its
  word band: 0–24 `fearful` · 25–44 `leaning fearful` · 45–55 `mixed` · 56–75 `leaning
  greedy` · 76–100 `greedy`. The words are deliberately flat (mechanical voice — no
  "extreme", no exclamation, no color coding beyond ink).
- Fewer than 3 components available → the gauge does not render a score (suppression per
  the N-gate instinct); it renders `insufficient inputs tonight` + which are missing.
- **Display contract (C8):** the number NEVER renders without its component table (each
  component: name, tonight's raw value with window, its percentile, arrow of contribution)
  and the ownership line. Phone: the gauge cell opens a Disclosure with the components;
  desktop: the components render in the cell's expanded card. The gauge is a **position
  display, not a dial** (P13 — no gauges/angles; it renders as a labeled 0–100 position
  strip with a mono numeral).
- **Not a signal:** the gauge carries the standing line `Context, not a signal — no
  tendency evidence attaches to this number.` It writes no signal_log rows, feeds no setup
  cards, and appears nowhere but the macro board and its own Academy lesson doorway.

### 6.6 Fear & Greed licensing note (the record)

Appendix A row F&G records the verification: CNN publishes no licensed API; the widely
scraped `production.dataviz.cnn.io` endpoint is unofficial and its use would be a terms
violation wearing a convenience; RapidAPI resellers of it inherit the same problem;
alternative.me's index is crypto-only by its own documentation. Conclusion recorded so
nobody re-litigates it: there is no legitimate external source; ours exists because of that
fact, and the UI never borrows CNN's name.

### 6.7 Board layout

Phone: the module's second labeled shelf (`Money & mood — swipe`), cells in the order
mortgage · CPI · gold · USD→NPR · Mood (household costs first — the reader's own life, then
the market's temperature). Desktop: a 5-up row under the market rows; at `wide:` the Mood
cell expands to show its component table inline. Every cell: label, mono figure, as-of, and
the per-stat note as title text. No sparklines in v1 (the board's job is current level +
honest date; trend claims want more design care than a 40px canvas — logged as a deliberate
omission, revisit trigger: user asks for trend context).

### 6.8 Tests & gate additions (N3)

Pipeline: per-series adapter tests on recorded fixtures (new fixtures via the
record-fixtures flow) · cadence logic (no-new-observation writes nothing; observation-date
advance writes) · degradation rungs 3–5 · gauge: component percentiles against a toy
history, suppression <3 components, band words at boundaries, determinism (same inputs →
same score). App: cell render per rung · gauge breakdown-required guard (render without
components throws) · board order e2e · VRT board normal + degraded, both themes, phone +
desktop. Gate: `nc-3` tag green; one real dispatched `macro` run writes real rows (or the
absence is logged with its reason if sources are down that night).

---

## Part 7 — The Front Page (commission Part C)

*The News/Discover section: route `/news`, fed nightly, image-led, filterable, ranked by
catalyst significance. Phases: N4 (data), N5 (UI).*

### 7.1 Why this section serves the mission (the required argument)

The app's mission is a calm command center and learning hub that teaches WHY markets move.
The Daily Brief answers "what should I take away from today?" — synthesized, five items,
one reading. It deliberately does not answer the question a curious reader asks next:
"what actually happened out there, in full — and what kind of thing was it?" Today that
curiosity has exactly one place to go: the open web, where the answer is a trending feed
built to convert curiosity into orders. The Front Page exists to answer it here instead,
inside the honesty rules: every story is framed as a CATALYST with a TYPE (an earnings
beat, an FDA approval, a Fed statement) — which is literally the Academy's taxonomy of why
prices move, applied to today's tape. Every card teaches the connection ("here is the
cause, here is what it plausibly affects, here is the size of the reaction"); every detail
page offers the lesson that explains the mechanism and the setup card where evidence
exists. A mover with no cause says so, which teaches the hardest lesson in the room: most
moves are noise. The section's failure mode — the thing it must never become — is the
thing it replaces: a salience feed. That is what C1, C4, C9, C10 and the significance
formula are for. If those rules ever feel like they are fighting the section, the section
is drifting, and the rules win.

### 7.2 Information architecture

- **`/news`** — the room: press-time header, filter rows, the ranked feed, the
  "Moved without a story" quiet slot, provenance footer. ISR-600 like every room.
- **`/news/[cluster]`** — the story page (drill level 2): the full honest anatomy of one
  catalyst. Ticker links go to `/ticker/[symbol]` (level 3). Depth ≤ 3 holds.
- **Desk module "08 — Front page"** — a bounded preview: the top 3 clusters as compact
  rows (headline + catalyst Tag + tickers, no images at this size), the M8 count line
  ("First 3 of 14 by significance"), doorway "The full front page →". Rides MAIN, pairing
  with 07 on one desktop row (both are count-plus-doorway glances). Ships in both Part 0
  options.
- **Navigation:** per Part 0.1's answer (default: sixth tab "News", newspaper icon, between
  Desk and Scans; desktop RoomNav pill; ⌘K entry either way).

### 7.3 Ingest expansion (pipeline, N4)

Today news is fetched only for unusual-volume movers. The Front Page needs the day's
market-wide catalysts. Nightly budget (constants in `pipeline/config.py`; each call through
the existing adapter/rate-limit machinery; all counts verified against provider limits in
Appendix A):

| Call | Provider | Budget | Yield |
|---|---|---|---|
| Market news, `category=general` | Finnhub (free tier: 60 calls/min, no daily cap documented) | 2 calls (second with `minId` pagination) | ~100–200 items, with `image` + `source` fields |
| Market news, `category=merger` | Finnhub | 1 call | M&A coverage |
| Company news for movers | Finnhub | ≤15 calls (existing) | mover catalysts, unchanged |
| Tagged market news | Marketaux `news/all`, `countries=us`, `filter_entities=true`, `must_have_entities=true`, `sort=published_on` | ≤20 calls (free tier: 100 req/day, **3 articles per request**) | ~60 entity-tagged items with `image_url`, `source`, `entities[].industry`, `entities[].match_score` |

Adapters gain the fields they already receive and drop: Finnhub `image`, `source`,
`category`; Marketaux `image_url`, `source`, `description`, per-entity `industry` +
`match_score`, and the `similar` uuid list (a free clustering hint). All additions are
recorded-fixture-first per the new-provider-adapter skill (the fixtures already contain
these fields — the recorder does not even need re-running for Finnhub/Marketaux; extend the
parse + tests).

`news_item` gains columns (Appendix C): `source`, `imageUrl` (the provider/og candidate as
received — the R2 copy lives in `news_image`), `category`, `industries String[]`,
`clusterId?`, plus the write-back of the Stage-A extract into the existing `extract Json`
column (7.5). Backfill: none — old rows simply lack images/sources and never enter new
clusters (clusters are per-night forward).

### 7.4 Clustering (deterministic, no LLM)

One story arrives as N articles. `pipeline/newsdesk/cluster.py` (new, pure, TDD):

- Normalize each headline: lowercase, strip punctuation/tickers/source suffixes, tokenize,
  drop stopwords.
- Two items cluster when ANY of: same canonical URL (post-tracking-param strip) · Marketaux
  `similar` links them · token Jaccard ≥ 0.55 AND overlapping ticker sets AND published
  within 36h of each other. Union-find over the night's items + yesterday's clusters
  (stories span evenings; a cluster keeps its id and accumulates).
- Each cluster's representative headline = the earliest item from the highest-corroboration
  source; `sources = distinct source count`; `tickers = union`, ranked by Marketaux
  match_score where present, else mover membership, else mention count.
- Unit tests: the fixture night must produce known clusters; near-miss pairs (same tickers,
  different stories) stay apart; the 36h boundary; URL-param canonicalization.

### 7.5 Extraction and the narrative line (the existing AI pipeline, extended)

- **Stage A (Haiku, Message Batches — the existing `briefing/extract.py` machinery):** the
  nightly batch grows from "movers' articles" to "one representative article per cluster,
  top ~60 clusters by pre-LLM salience (corroboration count, then ticker-move magnitude)".
  The `ExtractResult` schema gains one enum value — `event_type` adds `filing` — and is
  otherwise unchanged. The parsed extract is **written back to `news_item.extract`** (the
  column reserved for exactly this since P2) and, at cluster level, to the new
  `news_cluster.extract`. Items past the cap are ingested (headline/source/image) but not
  extracted — the feed can render them in the "more items" tail of their sector filter
  without narrative lines; the cap and its reason are logged per night (`stageStatus`).
- **Stage B-mini (Sonnet, ONE sync call for the whole page):** a single structured call
  takes the top ~20 clusters' extracts + the computed stats for their tickers (the existing
  `stats.py` table, extended with per-ticker move/RVOL stat ids) and returns, per cluster:
  `why_it_matters` (≤160 chars, mechanical voice, no advice verbs, no predictions — "the so
  what", e.g. "A approval this size usually re-prices the whole treatment segment, not one
  ticker.") and `affected_note` where the effect is sector-wide. Same citation discipline as
  the brief: every sentence's numbers must trace to stat/extract ids. Schema in Appendix D.
- **The gate (the existing `verify.py`, reused):** every cluster's narrative fields pass
  the Appendix-E tolerance check against that cluster's extracts + stats. A failing
  cluster publishes WITHOUT its narrative line (facts stand, prose is dropped, decision
  recorded in the night's verification JSON) — the feed never blocks on one bad sentence,
  and an unverified number never renders (P9 verbatim).
- **Ranking (deterministic, after extraction):** the significance formula of Appendix E —
  scope (index/sector-wide beats single-name), corroboration, magnitude (affected tickers'
  |1D move| in units of their own ATR14), catalyst-class prior, recency decay. Computed by
  `newsdesk/rank.py`, stored on the cluster row, EXPLAINED in the room's header line. The
  LLM never sees or sets a rank.

### 7.6 Publish & schema

New tables (verbatim in Appendix C): `news_cluster` (runDate idx, representative headline,
eventType, sectors[], themes[], tickers[], significance, sources, whyItMatters?,
verification Json, extract Json, imageId?), `catalyst_link` (clusterId → symbol with the
snapshot: ret1, rvol20, hasSetupCard — snapshotted at publish so the card's numbers and the
feed's numbers can never drift apart), `news_image` (Part 7.9). Movers cross-link: a mover
row whose symbol appears in a cluster gets its existing catalyst chip pointed at
`/news/[cluster]` (one story, one page — the mover module stops linking out to a raw
article when we host the fuller, verified version; external source links remain on the
story page). All inserts land in the same Job-A publish transaction.

### 7.7 The room (`/news`), spec

- **Header:** serif room title ("Front page"), press-time line (`Assembled {date} {time} ET
  · from {n} articles, {m} catalysts`), the ordering sentence (C1), and the RangeControl
  (`Today / This week`, default Today).
- **Filter rows (client-side over the served payload):** catalyst-type chips (All ·
  Earnings · Guidance · M&A · FDA · Fed/Macro · Analyst · Filings · Legal · Product) and
  sector/theme chips (11 sectors + AI · Defense · Broad market). Horizontal scroll rows on
  phone (44px chips, snap proximity, edge fade); wrapped rows on desktop. Active filters
  restate themselves in the count line: "6 catalysts · Pharma · FDA". Zero-result state:
  "No FDA catalysts today — that is information, not an error." Filters are AND across the
  two rows, OR within a row (multi-select), reset chip appears when any active.
- **The feed:** phone — one lead card (full-bleed image, 1.91:1) for the top-ranked
  cluster, then uniform rows (thumbnail left 112×84, content right); the lead slot is a
  POSITION, not a reward for size of move (C4). Desktop `lg:` — feed 8/12 (2-up card grid,
  lead spanning both columns) + context rail 4/12 (the "Moved without a story" card, the
  press-time/provenance card, the filter state). Pagination by "Page N of M" (M6) at 20
  clusters/page; Today rarely exceeds one page.
- **Card anatomy (every card, both tiers):** image (7.9) · catalyst-type Tag + sector Tag ·
  headline (serif, 2-line clamp with title attr for overflow) · source + `{h}h ago` time
  (absolute date past 24h — and the timestamp is the ARTICLE's, the card's as-of is the
  room's press time) · ticker chips (≤3, then "+N", each chip carrying its `+8.2% · 1D`
  move) · the why-it-matters line in italic prose (or nothing, if the gate dropped it —
  never a placeholder) · corroboration whisper (`3 sources`) in the footer.
- **"Moved without a story" (C9):** after the feed (rail card on desktop): up to 3 movers
  with no cluster, each as symbol + move + the standing noise line. Never images, never
  ranked among catalysts.
- **Press cadence honesty (C10):** the room's footer states the schedule: "Assembled
  nightly after the US close. This page does not update during the day."

### 7.8 The story page (`/news/[cluster]`), spec

Top to bottom: catalyst Tag + sector Tags · serif headline · source list line (every
corroborating article: source name → external link, published time) · the image (larger
variant, attribution line `Photo via {source}` linking the article) · **What happened** (the
extract summary, mechanical) · **Why it matters** (the verified line, plus `affected_note`
when present) · **By the numbers** (the cluster's key_numbers, each with its source id
superscript — same grammar as the brief's citations) · **Affected tickers** — a DataTable:
symbol · name · `1D move` · `RVOL · 20d` · a `Setup card` link where `hasSetupCard` (the
doorway to evidence, only where evidence exists) · **Learn the mechanism** — the Academy
doorway mapped from catalyst type (Appendix E's map; renders only for authored lessons via
the existing manifest gate) · provenance footer (`Ingested {t} · extracted by {model} ·
every number machine-verified against its sources`). Return rail back to /news preserves
scroll + filters (client state survives bfcache/back).

### 7.9 The image pipeline (the non-negotiable, engineered)

**Sourcing ladder (fetch at ingest, in the pipeline; NEVER at render):**
- **L1 — the provider's own image field** (Finnhub `image`, Marketaux `image_url`) — this IS
  the publisher's photo, delivered through the news API we already license. Present on most
  items; often an empty string on some Finnhub sources (verified), hence:
- **L2 — og:image / twitter:image** from the article page: `newsdesk/ogimage.py` — httpx
  GET with a descriptive UA (`msm-newsdesk/1 (+contact URL)`), robots.txt honored, 5s
  timeout, 512KB read cap (the tags live in `<head>`), selectolax parse of
  `og:image[:secure_url]` → `twitter:image` → `link[rel=image_src]`. One attempt per URL
  per night; failures are data, not errors.
- **L3 — publisher identity card:** no image found → the card renders the DESIGNED
  source-identity treatment: the publisher's favicon (fetched once per domain into R2, same
  etiquette) composed by the UI onto a generated background in our palette (the component
  does the composing — no server image generation needed).
- **L4 — catalyst identity card:** no favicon either → the sector/catalyst-keyed generated
  treatment: a deterministic SVG component (`NewsImage` fallback mode) built from our
  tokens — sector-tinted wash, the catalyst-type word set large in the display serif, the
  ticker set in mono. Deterministic from (sector, eventType, tickers) so VRT can lock it.
  **L3/L4 are designed as first-class outcomes: same geometry, same frame, same visual
  weight as photos — a text-treatment card next to a photo card must read as an editorial
  choice, not a failure.** The styleguide renders all four rungs side by side; VRT locks
  them.
- **If a faster path appears** (a provider adding a guaranteed image field), the ladder
  absorbs it at L1; the outcome contract (every card ships a visual, zero failure states)
  is what is fixed.

**Processing & storage (pipeline, Pillow — new dep):** fetch L1/L2 candidate → validate
(actual image bytes, ≥200px wide, not an SVG/tracking pixel) → recompress to JPEG quality
80, strip EXIF → three variants: 1200w (story page), 640w (lead card), 240w (thumbnail),
each capped 1.91:1 center-crop only when within 15% of it (else letterbox to the frame in
CSS — never a face-chopping crop; `object-fit: cover` on uniform frames does the visual
cropping client-side) → compute width/height + an 8px-wide base64 JPEG blur placeholder
(~300 bytes, stored in the row — the SSR-friendly placeholder; hash formats need client
JS) → PUT to the media bucket keyed `news/{yyyy-mm}/{sha1(url)}-{w}.jpg` via the existing
boto3/R2 pattern → row in `news_image` (clusterId, sourceKind L1|L2|L3-favicon, urls per
variant, width, height, blurDataUrl, attribution source+url, dominantColor). Budget: ~60
images/night × ~3 variants ≈ well inside R2's free tier forever (Appendix A math).

**Serving (app):** ONE component, `components/news/NewsImage.tsx` (drift rule 18: no other
`<img>`/`next/image` may reference the media bucket): `next/image` with
`remotePatterns` for the media base URL, explicit `width`/`height` from the row (CLS = 0 by
construction; the layout-shift budget for /news is the existing hard CLS 0.000 gate),
`placeholder="blur"` with the stored `blurDataURL`, `loading="lazy"` for everything except
the lead card (`loading="eager"` — v16 deprecates `priority` in favor of preload/eager;
only the lead is above the fold by definition), `sizes` matched to the three slots. Vercel
image optimization stays within the Hobby transformation budget because variants are
pre-sized in the pipeline and `minimumCacheTTL` is raised to 31 days (immutable objects,
hashed keys — Appendix A math: ~1.8k new images/mo × ~2 rendered sizes ≈ 3.6k of the 5k
monthly transformations; if the plan's own probe shows the budget breached, the fallback is
serving the pre-sized variants as plain `<img>` with manual `srcset` — pre-sizing is what
makes both paths cheap).

**Public access:** custom domain on the Cloudflare zone if one exists (P-1 asks), else the
bucket's `r2.dev` URL — dev-labeled and rate-limited, but every hot read is served out of
Vercel's image cache (the optimizer is the only client that ever fetches the origin), and
the single-user readership makes cold-read volume trivial. The provisioning row records
whichever base was configured; `NEXT_PUBLIC_MEDIA_BASE` is the single source for
remotePatterns and the pipeline's URL construction.

**Dark theme:** photos render true (no filter — a dimmed photo is a designed lie about the
photo); the FRAME adapts (hairline + surface tokens), and L3/L4 generated cards are built
from tokens so they theme natively.

### 7.10 Seeds, fixtures, VRT determinism

The seeded night gains: 14 clusters across ≥6 catalyst types and ≥5 sectors (incl. one
FDA, one M&A, one Fed/macro with zero tickers — the C9 "no direct listing" case), 2
no-catalyst movers, one cluster with a gate-dropped narrative (facts only), and one L3 +
one L4 image case. Seed images: 3 tiny CC0 JPEGs committed under `app/prisma/fixtures/img/`
(each <30KB), served in e2e via the seed's local paths (the NewsImage component takes a
base URL — the seed points it at `/fixtures/`); L4 needs no assets (deterministic SVG).
VRT: feed both themes both viewports, filtered state, story page, all four image rungs in
the styleguide, Desk module 08.

### 7.11 Tests & gate additions (N4 + N5)

N4 (data): cluster.py suite (7.4's cases) · rank.py (formula on fixture clusters; ordering
pinned; weights from constants) · extract write-back + cap logging · Stage B-mini schema +
one-retry + verify-gate drop path · image pipeline (validate/variant/blur on a checked-in
JPEG; ladder fall-through L1→L4 on fixture cases; R2 keys; budget counter) · publish
transaction writes clusters/links/images atomically · full fixture-night integration test
(N articles in → K clusters, ranks, images out — the numbers pinned). Gate: `nc-4` CI
green; one real dispatched news-mode run against live providers (or its absence logged with
reason).
N5 (UI): e2e — feed order equals seeded significance; filters (type, sector, combined,
zero-state, reset); Today/Week; lead card is position-not-size (seed places the biggest
mover at rank 3 and asserts it does NOT get the lead slot); story page anatomy (sources,
numbers superscripts, tickers table, doorway gating); C9 slots; C10 no-badge; module 08
count line + doorway; drill depth; keyboard/focus order through cards. Unit: card
view-model builders. VRT per 7.10. Gate: `nc-5` tag green incl. axe on /news + story page;
route budgets hold (B2/B3 on /news).

---

## Part 8 — The control room (commission Part D)

*Manual runs, honestly scoped. Phase: N6. The honest evaluation first, because the
commission asked for it.*

### 8.1 Is user-triggered running a good idea here? (the evaluation)

Mostly yes, narrowly. This is an end-of-day product: on a normal weeknight the pipeline has
already run and a manual re-run would recompute identical data — the honest control for
that case is the EXPLANATION, not the button. But four real cases earn real buttons: (a) a
failed or missed nightly run (the recovery case — today it requires the GitHub UI); (b)
news re-fetch: catalysts accumulate during the day and the reader may want the evening's
news before the scheduled run — cheap, safe, rate-limited; (c) macro stats: FX/gold/rates
move on their own cadences and a mid-day refresh is legitimate and nearly free; (d)
compute-only re-runs after a code fix (recompute scans/indicators over stored bars without
re-ingesting). What stays impossible by design: ingesting TODAY's EOD bars before the
close (the data does not exist — the UI says so with the next-close time), and anything
that would collide with the nightly (the concurrency group already serializes; the UI
states the queue position instead of pretending parallelism).

### 8.2 Mechanism (0.2.3): GitHub Actions, dispatched from the app

- `nightly-a.yml` gains inputs: `mode: full | news | macro | compute` (default `full`) and
  `request_id` (echoed into `run-name: nightly-a · {mode} · {request_id}` for the Actions
  tab). `jobs.job_a` branches its stage list on mode: `news` = catalyst ingest + cluster/
  extract/publish news + revalidate; `macro` = FRED/NRB/gold reads + macro publish +
  revalidate; `compute` = snapshot/scans/analytics from the stored lake + publish (skips
  Alpaca ingest and its coverage gate — the gate binds only stages that ingest); `full` =
  today's behavior. Each mode's stage list is a constant with a unit test (a mode may
  never silently grow a stage).
- `nightly-b.yml` needs no mode (its whole job is the evening assembly); the panel exposes
  it as "Re-run the evening briefing".
- The app dispatches via `POST .../workflows/{file}/dispatches` with
  `return_run_details: true` (verified current API — the response carries
  `workflow_run_id`), stores the id on the request row, and polls
  `GET /actions/runs/{id}` for `status`/`conclusion` while the panel is open. Fallback
  if the field is ever absent: match `display_title` on the `request_id` via the runs list
  (the run-name already carries it).
- Auth: the routes live under the session wall (`/api/pipeline/*` NOT in PUBLIC_PATHS —
  the proxy 401s JSON unauthenticated); the server action holds `GH_DISPATCH_TOKEN`
  (fine-grained PAT, Actions read+write, this repo only). The token never reaches the
  client; the panel is unreachable logged-out like everything else.

### 8.3 The request ledger: `manual_run` (✎ app-writable — it IS user state)

Appendix C DDL: id, requestedAt, workflow, mode, ghRunId?, status (`requested | queued |
running | succeeded | failed | not_applicable | not_configured`), reason? (the
not-applicable explanation shown), finishedAt?. It is the cooldown source (8.4), the audit
trail ("what did I run and when"), and the panel's history list (last 10). The pipeline
never reads it — dispatch inputs carry everything the job needs.

### 8.4 Guardrails (constants in `lib/constants.ts`, mirrored where the workflow enforces)

- **Concurrency:** the existing `msm-nightly` group serializes everything
  (cancel-in-progress false → a manual run queued behind the nightly WAITS, and the panel
  says "queued behind tonight's scheduled run"). Only the latest queued run survives by
  GitHub's semantics — the panel therefore refuses a second dispatch while one is pending
  (state, not error).
- **Cooldowns/caps (per mode, enforced app-side from `manual_run`, stated in the UI):**
  `macro` 30-min cooldown, 6/day · `news` 2/day (provider budget: each news run spends
  ~20 Marketaux requests of the 100/day — two manual + one nightly = 60, safe) · `compute`
  2/day · `full` 1/day · `briefing` 2/day. The cap line renders under each button
  ("2 of 2 left today").
- **Cost ceilings, stated where they bind:** a `news` run spends ~$0.10–0.20 of LLM budget
  (batch Haiku + one Sonnet call — Appendix A pricing math); the panel prints it
  (`~$0.15 of API budget`) so the cost is a stated fact, not a hidden one. GitHub minutes:
  bounded by the caps at ≈ 60–90 min/day worst case, inside the private-repo free tier
  with the nightly load included (Appendix A math).
- **Session-night guard:** `full` is not-applicable while the market is open (bars are
  incomplete) and on already-successful nights (nothing new exists); both render C5
  explanations with the next meaningful time.

### 8.5 The panel (in `/settings`, section "Pipeline"; the Desk strip links here)

Layout: the freshness strip's data expanded (last run, stages, per-source status verbatim
from `pipeline_run`), then one row per action — Run tonight's full pipeline · Refresh the
news · Refresh macro stats · Recompute scans · Re-run the evening briefing — each rendered
in exactly one state:

| State | Render |
|---|---|
| available | button + what it does in one sentence + cost/cap line |
| cooldown | disabled + "available again at {t}" |
| capped | disabled + "daily limit reached — resets midnight ET" |
| not_applicable | no button; the explanation IS the row (C5): e.g. "Markets are open — today's closing data doesn't exist until 4:00pm ET. The nightly run lands ~6:37pm ET." / "It's the weekend — Friday's close is the latest data that exists; nothing new lands before Monday 4:00pm ET." / "Tonight's run already succeeded at 22:41 UTC — there is nothing newer to fetch." |
| requested/queued | live row: "queued behind the scheduled run" |
| running | live row with elapsed time + link to the GitHub run |
| succeeded | quiet line in history + the page data refreshes itself (the run's own revalidate busts the caches; the panel re-reads on poll) |
| failed | the row says so plainly + links the run log + offers the retry (within caps) |
| not_configured | "Manual runs need a GitHub token — see QUESTIONS-FOR-BISHANT (P-2)." |

State logic is a pure function `lib/pipeline-control.ts` (inputs: manual_run rows,
pipeline_run, trading calendar via a serialized next-sessions payload, clock) — unit-tested
per state including the calendar cases (weekend, holiday, pre-close, post-success). The
running-state poll is a session-gated route (`GET /api/pipeline/status`) the client hits
every 15s ONLY while the panel is open and a run is live.

### 8.6 Freshness, honestly surfaced (closing the loop with Part 4.1)

The strip (Desk) and the panel (settings) read the same `lib/freshness.ts`. After any
successful manual run, the strip reflects it on next render ("Data through … · refreshed
manually 2:14pm ET") — manual runs join the provenance story rather than hiding under it.

### 8.7 Tests & gate additions (N6)

Unit: `pipeline-control.ts` full state matrix (every state reachable, calendar cases,
cooldown boundaries) · freshness integration of manual runs. Pipeline: mode stage-list
constants + per-mode behavior (fixture-driven: news mode touches no bars; compute mode
calls no Alpaca; macro mode skips the coverage gate) · dispatch input parsing. E2E (GitHub
API mocked at the route boundary; the seeded build injects clock/fixtures): dispatch flow
happy path (request row → queued → running → succeeded, panel updates), not-applicable
copy renders per case, caps decrement and pin, failed run links the log, strip →
panel doorway, unauthenticated API 401s. One REAL end-to-end drill in the gate: dispatch a
real `macro` run from the deployed app, watch it publish and revalidate (this is also
P-2's verification). VRT: panel states (masked timestamps). Gate: `nc-6` tag green + the
real-drill evidence in `docs/nc-evidence/`.

<!-- CONTINUES: Part 9 (phases), Part 10 (iOS), Part 11 (adversarial), Appendices -->
