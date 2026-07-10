<!-- GENERATED from docs/src/dp-*.html — edit those and re-run docs/src/build-plan-md.py.
     The visually polished version of this document is docs/Development-Plan.pdf. -->

myStockMarket — Development Plan myStockMarket · Development Plan Development Plan · 3 of 3

# The Execution Contract

*A self-driving build plan for Claude Opus 4.8: front end and back end of myStockMarket, end to end, phase by phase, with zero human input beyond the one scheduled Session-0 checklist. Implements the Research Report and Build Blueprint faithfully — same stack, same P0–P6 phasing, same guardrails, same data model — translated into ordered, testable steps.*

> “The evidence chapters win. When a tempting feature, a prettier component, or a faster shortcut conflicts with the Research Report’s honesty rules or this plan’s design system, the feature loses — every time, without asking.” — The one rule that outranks every other rule in this document

Executor Claude Opus 4.8 Date July 2026 Companions Research-Report.pdf · Build-Blueprint.pdf Before anything else

## Decisions I need from you

*The commissioning instruction: every decision that would cascade through the build must surface here for an answer before the plan is final. Verdict below.*

> **None:** There are no global decisions awaiting your answer. Every choice that could cascade through cost, data, guardrails, or architecture was either already fixed by the two source documents (which outrank this plan — §1.2) or resolvable within them. The plan proceeds; the build can start at Session-0 whenever you are ready.

What remains are **judgment calls I made and logged** — each local in scope, reversible, and recorded so you can veto asynchronously. The headline ones, so you never have to hunt for them:

| Call | One-line rationale (full text at the cited section) |
| --- | --- |
| Cookie-session login replaces Basic Auth | Basic-Auth 401s break installed PWAs; the Blueprint itself names this step-up. Declared deviation #1, §4.4. |
| “Broadsheet Terminal” design direction | The bold-but-honest aesthetic committed token-for-token so the executor cannot drift generic. Part 3 — my professional design judgment, owned. |
| Serwist for the service worker | Maintained Workbox successor with first-class Next.js wiring. Declared deviation #2, §5. |
| No push notifications, no offline write queue in v1 | Calm-tech review required before push; write-queues risk silent divergence. Both on the logged backlog, Part 8. |
| Academy lessons as MDX files in git, not DB rows | Content belongs in version control. Declared deviation #4, Appendix B. |
| Refresh fades 160–200ms (RR says “~500ms”) | Same calm intent, no shimmer. Declared deviation #3, §3.5. |

Veto mechanics: edit `DECISIONS.md` in the repo (any line without a `[claude]` marker is treated as your instruction, rank 2.5 — the session ritual reads the diff first, §9.2), or simply tell the executor. Nothing above is load-bearing enough to block on.

---

Part 1

## The contract

*Read this part at the start of every session. It defines what outranks what, how to decide without asking, and the only moment a human is ever required.*

### 1.1 What you are building, in one sentence

A single-user, US-equities (NYSE/Nasdaq) market command center and learning hub — a calm, editorial web app and installable mobile PWA whose after-close cloud pipeline has already ingested, scanned, computed, and written a verified briefing by about 8:40pm Eastern the same evening — the user lives on market time (Long Island, NY) — and which never, under any circumstance, predicts direction.

### 1.2 Authority hierarchy

When sources disagree, the higher item wins. Never resolve a conflict by asking the user — resolve it by rank, then log it in `DECISIONS.md`.

| Rank | Authority |
| --- | --- |
| 1 | **Research Report Part 8 + Part 9** (honesty guardrails, product commitments, uncertainty display rules, Desk/Academy separation, anti-patterns). These are inviolable. *docs/Research-Report.pdf*, source HTML in *docs/src/rr-03.html, rr-04.html*. |
| 2 | **Build Blueprint** (architecture, stack, data plan, data model, pipeline design, P0–P6 scope and acceptance criteria, risks). *docs/Build-Blueprint.pdf*, source in *docs/src/bp-0*.html*. |
| 3 | **This plan** (build order, design system, PWA spec, conventions, appendix contracts). Where this plan deliberately deviates from the ranks above it says so explicitly and gives the rationale. There are exactly **four declared deviations**: (1) cookie login replacing Basic Auth (§4.4); (2) Serwist added for the service worker (§5); (3) data-refresh fades at 160–200ms vs the Research Report’s “~500ms” (§3.5 — the calm intent, one quiet fade with no color flash, is preserved; ~500ms reads as shimmer); (4) Academy lessons as filesystem MDX rather than the Blueprint’s Postgres `lesson` table (§Appendix B — content belongs in git; the Blueprint’s own Lesson row already gestures at this). Anything else that diverges from ranks 1–2 is a bug in this plan — fix toward the higher rank and log it. |
| 4 | **DECISIONS.md precedent** — your own prior recorded choices. Do not silently reverse one; if a reversal is needed, log the supersession with rationale. |
| 5 | **Your judgment**, biased toward: reversible over irreversible, honest over impressive, boring over clever, shipped over perfect. |

### 1.3 Your decision protocol (you will hit choice points — here is the algorithm)

1. **Is it answered by rank 1–3?** Grep the source HTML files (they are the searchable form of the PDFs) before deciding anything. Most questions are already answered.

2. **Local decision** (does not ripple — a library minor-version, a file name, a CSS detail, an internal function shape): decide, apply, and append one line to `DECISIONS.md`: date · decision · one-line rationale.

3. **Structural decision** (would change the data model, a guardrail’s behavior, the design system’s tokens, the phase plan, or cost): do NOT invent. Choose the option that keeps rank 1–2 intact; if both options do, choose the more reversible one; log it prominently in `DECISIONS.md` under a “structural” heading. **By definition structural:** any change to Appendix E tolerances, Appendix F constants, or Appendix J strings — never “local” — and a change that *loosens* a tolerance additionally requires the §10.5 justification that the encoded rule itself was wrong. The user reads DECISIONS.md asynchronously — that is their veto channel; you never wait on them.

4. **External reality broke the plan** (API changed, package deprecated, provider rejected signup): execute the documented fallback (the Blueprint’s upgrade ladder and alternatives are pre-researched for exactly this), log it in `LESSONS.md` + `DECISIONS.md`, and keep moving. Never stall on a missing external.

5. **Truly blocked after two distinct attempts:** implement the smallest honest placeholder behind a clearly named flag (e.g. `DEGRADED_NO_MARKETAUX`), record it in the “Blocked” section of `PROGRESS.md` with what unblocking requires, and continue with the next task in the phase. An idle session is the only unacceptable state.

### 1.4 Session-0 human checklist — the only human touchpoint

Everything below is **collected** once, at kickoff. Verification happens **progressively during P0**, at the build step that creates each probe’s tooling — and “all Session-0 probes green” is a named P0 exit criterion. Appendix D is the single authority for where every secret lives; the user supplies raw values, you distribute them. Three values you generate yourself (never user-supplied): `CRON_SECRET` and `AUTH_COOKIE_SECRET` (`openssl rand -hex 32`) and `R2_BUCKET=msm-history`. The user also supplies a name + email for `EDGAR_USER_AGENT` (SEC requires a real contact) and their chosen app login (username + password — you hash it at P0 step 5 with the hash script, place only the hash, and discard the plaintext).

| Item | Where it goes | Verification probe |
| --- | --- | --- |
| GitHub private repo (`myStockMarket`) + Actions enabled | Remote for this working directory (`git init` first — the folder is not yet a repo). Try `gh repo create --private` yourself; only if `gh` is unauthenticated does the user click. | `git push` succeeds; Actions tab reachable. |
| Vercel project linked to `app/`, Hobby plan | `vercel link` (root directory `app/`); env vars via `vercel env add` | `vercel whoami`; preview deploy of the P0 shell; **preview Deployment Protection (Vercel Authentication) confirmed ON** — the licensing wall covers previews. |
| Supabase free project | Three connection strings (transaction pooler, direct, session pooler) → Vercel env + GH secrets + local `.env` | `prisma migrate dev` against direct URL; `psql` ping via session pooler. |
| Cloudflare R2 bucket `msm-history` (or Backblaze B2 fallback) | `R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET` → GH secrets | boto3 put/get/delete of a test object. |
| Provider keys (standard US signup): Alpaca, Finnhub, FMP, Marketaux, FRED — plus name+email for `EDGAR_USER_AGENT` | GH secrets only (per Appendix D) | One authenticated smoke call per provider via `pipeline/scripts/probe_providers.py` (built at P0 step 8). Any probe failure falls back per the Blueprint §4.2 ladder — log and proceed. |
| Anthropic API key + monthly spend cap (~$15) set in console | GH secrets only | One 10-token Haiku call (same probe script). |
| healthchecks.io check on cron `25 0 * * 2-6`, 45-min grace + **read-only API key** | `HEALTHCHECKS_PING_URL`, `HEALTHCHECKS_API_KEY` → GH secrets | Autonomous: `GET /api/v3/checks/` shows the check; a scripted ping flips it up, a scripted missed-window shows down. (The API key exists so you can verify alerts without access to the user’s inbox.) |
| App login username + password (user-chosen, handed over once) | `AUTH_USER` + `AUTH_PASS_HASH` → Vercel env (hash generated at P0 step 5; plaintext discarded) | Login succeeds on the deployed P0 shell (verified at P0 step 9). |

> **After Session 0:** From this point the contract is: **you do not ask the user anything.** Choices are made by the protocol in §1.3; progress is legible in `PROGRESS.md`; vetoes arrive, if ever, as user edits to `DECISIONS.md` — treat any user-authored line in that file as a rank-2.5 authority.

### 1.5 The non-negotiables (the constitution)

These go verbatim into `CLAUDE.md` at P0 (template in Appendix K) and are re-read every session. Each traces to Research Report Part 8/9 or the Blueprint’s non-negotiables box.

1. **No directional forecasts, anywhere, ever.** The only forward-looking numbers are volatility bands ≤ 20 trading days, drawn as ranges with frequency labels *and the regime-break caveat attached* (“ranges assume the recent regime holds — sudden stress can exceed them”). No projected price lines, no up/down predictions, no composite buy/sell scores.

2. **Every base rate renders as a natural frequency with its reference class, N, and a Wilson 95% interval.** Display precision is N-gated: N ≥ 100 → percentage + CI; 30–99 → “roughly X in 10” + wide-interval note; N < 30 → “Insufficient history — treat as anecdote,” percentage suppressed. Enforced in one shared renderer, unit-tested.

3. **A confidence interval that includes the ~53–55% always-up baseline caps the tier at “weak.”** Every setup card shows the unconditional baseline line.

4. **Decay stamps:** any pattern derived from a published anomaly renders its publication year, evidence grade, and expected post-publication haircut.

5. **Folklore is labeled folklore** — in scan presets, setup cards, and Academy lessons alike, using the Research Report Part 4 ledger verdicts.

6. **New patterns clear a statistical bar before they ship.** Any detector without a Research Report Part 4 ledger grade requires t > 3.0 on its base-rate sample (the RR 8.2 multiple-testing hurdle) before it may render as anything other than “insufficient evidence”; below that it does not ship. The six v1 detectors carry ledger grades and are exempt.

7. **The app grades itself in public:** `signal_log` is insert-only from Phase 1; outcomes land in insert-only `signal_resolution`; the track record shows every miss. Setup cards never ship before the resolver exists.

8. **No trending/most-bought surfaces. No gamification** (streaks, XP, confetti). High-skew low-price tickers get lottery-risk flags instead.

9. **Movers never render without a catalyst check** — a chip with a source link, or the honest “No news found — likely noise.”

10. **The LLM narrates; it never computes, never states probabilities, never publishes an unverified number.** The deterministic verification gate (Appendix E tolerances) blocks or flags; “briefing unavailable” beats a fabricated sentence.

11. **Desk and Academy stay separated:** doorways only (chips, glossary popovers, one worked-example drawer, one learning link per brief, “see this live”), each with a state-preserving return rail. No live prices in the Academy; no lesson bodies on the Desk.

12. **Calm technology:** no blinking, no tickers, no toasts, no badges, no motion on probability or money visuals, no count-up animations. Data refreshes fade ≤ 200ms. v1 data is as-of the last US close and every module shows its timestamp.

13. **Mechanical voice:** “The pattern has historically been followed by…” — never “I think.” Disclaimers at the decision point. Copy deck (Appendix J) is canonical.

14. **Paper-first:** no brokerage integration; paper trades are the only orders; the cost mirror, cooling-off interstitial, and frequency mirror ship with the ledger.

15. **Licensing wall:** the app stays behind login always; FRED attribution and the TradingView attribution logo render; no public previews of data pages.

16. **TDD:** the failing test comes first for everything in §6.2’s test-first list — indicators, base rates, display rules, the verification gate, the tier cap, the sizing cap.

---

Part 2

## System overview

*The Blueprint is the authority on architecture; this recap exists so the plan is navigable on its own. If anything here seems to disagree with the Blueprint, the Blueprint wins — and grep it first: `docs/src/bp-02.html` (architecture, schedule), `bp-03.html` (data plan, AI layer), `bp-04.html` (data model, ops), `bp-05.html` (roadmap, risks).*

### 2.1 Shape

- **Read-mostly app:** Next.js 16 (App Router) + TypeScript + Tailwind on Vercel Hobby. Server components read Postgres via Prisma; the app writes only user-state tables (watchlist, journal, review state, paper trades, weakener checkboxes) through server actions.

- **Two-job nightly pipeline** (Python 3.12: Polars + DuckDB + httpx + exchange_calendars) on GitHub Actions. Job A, cron `37 22 * * 1-5` UTC: preflight → full-universe EOD ingest (Alpaca) → context ingest (Finnhub, FMP, EDGAR, FRED, Marketaux) → compute (indicators, scans, base rates, vol bands) → submit LLM extraction batch → exit. Job B, cron `25 0 * * 2-6` UTC: late-news delta sweep → collect batch → one synchronous synthesis call → deterministic verification gate → single-transaction publish → revalidate → dead-man ping. Briefing ready ~8:40pm EDT / ~7:40pm EST (worst ~10 min later); promise 9:00pm ET year-round — the crons are UTC-fixed, so DST shifts the user’s wall clock, never the schedule.

- **Storage split:** full-market history (~5–6k symbols × 7y) as Parquet on R2, scanned by DuckDB inside the pipeline only; Postgres (Supabase free) holds serving tables — including `price_bar` (watchlist + indices × ~5y) so the app never touches R2.

- **AI layer:** Haiku-class per-article extraction (Batch API, −50%) → Sonnet-class synthesis (one sync call) → deterministic tolerance-gate. ~$0.33/night, $7–11/mo total. Models pinned in env: `MODEL_EXTRACT=claude-haiku-4-5`, `MODEL_SYNTH=claude-sonnet-5`; reconfirm pricing at build time.

- **Charts:** TradingView Lightweight Charts v5 (Apache-2.0; keep the attribution logo), hand-rolled React hook; Recharts for sparklines/small multiples.

- **Product:** Desk (one-screen ritual: macro pulse → daily brief → US session calendar → movers with reason → focus watchlist → setup cards → sectors/scans → paper-portfolio corner) + Academy (M0–M6 curriculum, glossary, worked examples, Leitner review queue), connected by doorways with return rails; drill depth capped at 3 (glance → rail/sheet → full page).

### 2.2 Repository layout (authoritative)

```
myStockMarket/
├─ CLAUDE.md · DECISIONS.md · PATTERNS.md · LESSONS.md · PROGRESS.md · DEVELOPMENT-PLAN.md
├─ .claude/skills/<skill-name>/SKILL.md        # minted per §9.3 rubric
├─ docs/                                        # the three PDFs + docs/src (do not edit rr-*/bp-*)
├─ app/                                         # Next.js 16 — Vercel project root
│  ├─ app/(desk)/…      # dashboard, ticker/[symbol], track-record, scans, settings
│  ├─ app/(academy)/…   # academy, academy/[module]/[lesson], glossary, review, journal
│  ├─ app/login/ · app/offline/ · app/styleguide/
│  ├─ app/api/revalidate/route.ts               # CRON_SECRET bearer
│  ├─ proxy.ts                                  # session-cookie gate (Next 16 middleware rename)
│  ├─ components/ · lib/ · content/academy/ · public/
│  ├─ prisma/schema.prisma · prisma/seed.ts
│  └─ e2e/ (Playwright) · vitest.config.ts
├─ pipeline/                                    # Python 3.12, uv-managed
│  ├─ adapters/ (+ fixtures/) · indicators.py · scans.py · baserates.py · volbands.py
│  ├─ briefing/ (extract.py · synthesize.py · verify.py) · publish.py · resolve.py
│  ├─ jobs/ (job_a.py · job_b.py) · scripts/probe_providers.py · config.py · tests/
└─ .github/workflows/ (nightly-a.yml · nightly-b.yml · ci.yml · migrate.yml)
```

### 2.3 What done looks like

P6 exit = the user opens the installed PWA from their phone’s home screen — in the evening after the close, or over coffee before the 9:30am open — and reads a briefing the cloud schedule verified and published earlier that evening (for the pre-open glance, more than twelve hours before the bell); every number on screen carries its N, interval, and provenance; the track record shows the app’s misses; the Academy explains every term on the Desk; the paper ledger computes their real cost drag; the whole thing costs ≈ $7–11/month and looks like nothing a component library ships by default.

---

Part 3

## Design system — “Broadsheet Terminal”

*The aesthetic contract. Bold through typography, scale, and space — never through chrome that lies. Implement these tokens exactly; the styleguide route renders them as a living spec and every visual-regression baseline is captured against it.*

### 3.1 The manifesto (read before styling anything)

**This app is a financial broadsheet set by a typographer, not a SaaS dashboard.** Its ancestors are the print business page and the terminal screen: ink on paper, hairline rules, columns, dense tabular numerals, restrained color used only where it means something. Boldness comes from *scale contrast* (a 64px mono numeral against 13px labels), *editorial structure* (numbered section mastheads, 2px rules, asymmetric grids, generous margins), and *two distinct room tones* (the Desk cool and dense; the Academy warm and literary) — never from gradients, glows, or decoration. The design must pass one test: **if a screenshot could be mistaken for a default admin template or an AI-generated dashboard, it is wrong.**

**Banned outright** (this list is enforceable in review): gradients and glassmorphism; drop shadows on cards (the drawer scrim is the sole shadow in the app); `rounded-2xl` softness — the app’s radius is 2px; decorative icons and emoji; colored-chip confetti; skeleton shimmer (use quiet “—” placeholders); purple anything; count-up number animations; default-shadcn visual identity (its Radix primitives may be used headless, its look may not); synthesized small-caps — Archivo ships no `smcp` feature, so uppercase with tracking is the house alternative. **Required:** hairlines instead of shadows, uppercase condensed mastheads with index numbers (“01 — MACRO PULSE”), mono numerals everywhere data appears, one hero figure per view maximum, whitespace treated as a material.

**The honesty constraint is the style.** The Research Report bans fake-confidence chrome (gauges, gauzy “AI glow”, urgency motion); this system turns that ban into identity. Color is nearly absent precisely so that the few semantic uses — a delta triangle, an amber alert, an evidence-grade dot — carry real information. Where a typical product would add a colored badge, this one sets an uppercase typographic tag inside a hairline box. Nothing on screen is allowed to be exciting unless the data itself is.

### 3.2 Type

**Families — all free-licensed, self-hosted via next/font (required for offline PWA)**

| Role | Family | Usage rules |
| --- | --- | --- |
| Structure & UI | **Archivo** (variable: wght 100–900, wdth 62–125; OFL) | Everything on the Desk that is not a number or prose: labels, table headers, buttons, nav. Mastheads use Expanded width (wdth ~120) 700–800 uppercase, tracking +6–8%; body UI at wdth 100, wght 400/500. |
| Data & numerals | **IBM Plex Mono** (400/500/600; OFL) | Every quantitative figure in the product — prices, percentages, counts, N, CIs, timestamps, axis ticks — renders in Plex Mono. This is the single strongest identity move and also the alignment guarantee (mono ⇒ tabular by construction). Never render a number in Archivo. |
| Prose (Academy + briefs) | **Newsreader** (variable, italic; OFL) | Academy lesson bodies, the AM/PM brief paragraphs, worked-example prose: 17–18px/1.65, measure 62–68ch. Display italic for the brief’s “Today’s focus” headline — the one literary flourish. |

**Correction, 2026-07-10 (P0 · structural · Part 10 rule 9).** The Newsreader row above originally read “variable incl. optical size + italic” and asked for “opsz auto” with “display italic (opsz 36+)”. The optical-size axis is dropped; the row and §4.5 now describe what is actually built. Measured on the latin subset, Newsreader costs 272KB with `ital + opsz + wght` and 119KB with `ital + wght` — that single axis costs 153KB, more than Archivo (87KB) and IBM Plex Mono (29KB) put together, and it pushed the three families to 388KB against the ≤ 320KB budget this same plan sets in §4.5. Two clauses of the plan contradicted each other and neither is protected by a rank-1 or rank-2 source, so the budget wins: it serves the Research Report’s calm, fast reading experience directly (LCP ≤ 2.5s on a Moto-G-class phone), whereas optical sizing is a refinement of letterform proportions that most readers never consciously see. The display italic — “the one literary flourish” — survives intact. The three families now total 237KB with 83KB of headroom, guarded permanently by `app/scripts/check-font-budget.mjs` in the §6.4 phase-exit gate. Logged in DECISIONS.md.

**Type scale (px) — Tailwind v4 @theme tokens; line-height beside each**

| Token | Size/leading | Use |
| --- | --- | --- |
| `--text-2xs` | 11 / 1.35 | provenance lines, axis ticks, footnotes |
| `--text-xs` | 12 / 1.4 | mastheads (uppercase), tags, table headers |
| `--text-sm` | 13.5 / 1.5 | Desk body UI, table cells |
| `--text-base` | 15 / 1.55 | drawers, settings, longer UI copy |
| `--text-prose` | 17.5 / 1.65 | Academy + brief prose (Newsreader) |
| `--text-lg` | 21 / 1.35 | card titles, lesson H2 |
| `--text-xl` | 27 / 1.25 | page titles, brief headline |
| `--text-2xl` | 34 / 1.15 | zone titles, Academy lesson H1 |
| `--text-num-lg` | 44 / 1.1 | module-level key figures (mono) |
| `--text-hero` | 64 / 1.0 (mobile 48) | THE hero numeral — exactly one per view (macro strip: SPX day change) |

### 3.3 Color tokens

Two room palettes plus one semantic set. Interactive elements are **ink + underline** (editorial), with petrol reserved for focus/active states — so no color ever competes with the semantic channel. All text pairs meet WCAG AA on their surface (spot-check with a contrast tool during P0; log results in the styleguide).

| Token | Light value | Dark-Desk (P6) | Meaning / rules |
| --- | --- | --- | --- |
| `--desk-bg` | #F4F5F3 | #131412 | Desk page plane — cool bone |
| `--surface` | #FCFCFB | #1A1B19 | module surfaces, cards |
| `--academy-bg` | #FAF6EF | — (Academy stays light) | Academy paper — warm; the zone switch must be felt |
| `--ink` | #141511 | #F1F1EA | primary text; also the 2px section rules |
| `--ink-2` | #4A4B45 | #BDBEB4 | secondary text |
| `--muted` | #6B6C64 | #8F9088 | provenance, ticks, placeholders — value chosen to clear 4.5:1 on both light surfaces (the honesty layer must never be sub-AA) |
| `--hairline` | #DDDED7 | #2B2C29 | 1px rules, borders — the only “elevation” |
| `--accent` | #0E6E64 | #2E9C90 | petrol — focus rings, active nav, selected states, links on hover. Never on data, never decorative fills. |
| `--up` / `--down` | #0072B2 / #D55E00 | #4CA5DE / #E97F33 | Wong colorblind-safe pair for chart strokes, candle bodies, triangles, and text ≥ 21px (3:1 large-text/graphics threshold). Always paired with a redundant non-color channel: ▲/▼ + sign for deltas, hollow/filled bodies for candles, direct labels for series; unchanged/doji renders ink. Banned from buttons, links, decoration. |
| `--up-text` / `--down-text` | #005A8E / #A84A00 | #6FB6E6 / #F09456 | darkened/lightened Wong variants for delta *text at ≤ 18px* (mover percentages, deltas in tables) — same hues, AA-compliant. Declared token-level decision; charts keep the originals. |
| `--alert` | #8A5200 text / #F6E3B4 wash | #E0A83E / #3A2F14 | reserved attention. **Exactly two consumers exist:** (1) the verification-gate inline flag on a briefing sentence; (2) a fired-signal marker on a focus-watchlist row. More than 3 simultaneously ⇒ collapse to one “N flagged” Tag. Amber anywhere else is a bug (§3.10). Tier tags never use it. |
| `--grade-*` | light: supported #0B7A3B · mixed #8A5200 · weak #A64A32 · folklore #A21C1C — dark: #4CBF7E · #D9A03F · #D07B5B · #E06C6C | evidence-grade dots inside Tag only — Academy ledger contexts, scan-preset labels, and setup-card decay stamps; always beside the word, never alone. Spot-check dark values ≥3:1 at P6. |  |

### 3.4 Space, shape, elevation

- **Spatial system:** 4px base. Component padding 12/16/20; module gap 28; section-masthead rhythm: 12 above the 2px rule, 8 below; page gutters 20 (mobile) / 32 (desktop); Desk max-width 1360, 12-col grid, 20px gutters.

- **Radii:** 2px everywhere (inputs, buttons, cards, sheets). The near-square corner is a signature — treat any rounded-looking corner as a bug.

- **Elevation:** none. Hairline borders separate; the slide-over rail/bottom sheet uses a scrim (`rgb(20 21 17 / 0.4)`) and a 1px ink edge — no drop shadow.

- **Section mastheads:** every Desk module opens with `NN — NAME` in Archivo Expanded 12px caps over a 2px ink rule, with the module’s data timestamp right-aligned in Plex Mono 11px (“as of 16:05 ET”). This one component carries half the identity — build it first, reuse everywhere.

### 3.5 Motion

- Durations: 160ms fades / 200ms sheet-and-rail slides, ease-out, translate ≤ 12px. Nothing else moves. (Declared deviation #3, §1.2: the Research Report’s §9.7 says “~500ms” for refresh fades; 160–200ms preserves the calm intent — one quiet fade, no color flash — without reading as shimmer.)

- **Never animated:** numbers (no count-up, no flash-on-change), probability visuals (icon arrays, dotplots, calibration curves, vol bands), chart data (series appear settled). Price/data refresh = a 160ms opacity fade of the module, once.

- `prefers-reduced-motion`: all transitions drop to 0ms except focus outlines.

- No page-transition animation; navigation is instant and quiet.

### 3.6 Component inventory (anatomy in one line each; build in this order within P1–P6)

| Component | Anatomy & rules |
| --- | --- |
| SectionMasthead | index number · uppercase name · right-aligned timestamp · 2px rule. Props: index, title, asOf, action?. |
| StatFigure | Plex Mono value (scale token) + Archivo label above in 11px caps + optional delta (▲/▼, sign, `--up-text/--down-text`) + optional 30d sparkline (muted, 1.5px). **Hero variant: the 64px value renders in `--ink`; direction lives in an adjacent ▲/▼ + signed % at `--text-sm` in Wong text color. Wong color never exceeds `--text-num-lg`** — the largest element on screen is never emotional color. |
| Tag | uppercase Archivo 11px wght 500 tracking +4% inside a 1px hairline box, 2px radius, ink on transparent (no synthesized small-caps). Variants: tier (gray dot — never amber), evidence-grade (dot in `--grade-*` — Academy ledger, scan presets, decay stamps), catalyst-type (plain), folklore (grade dot + word “FOLKLORE”). Tags are information, never decoration — no other colored chips exist. |
| DataTable | Archivo 12px caps headers over 1.5px ink rule; rows 40px (touch) / 32px (pointer); numerals right-aligned Plex Mono; row hover = `--desk-bg` wash; no zebra stripes. |
| MoversRow | ticker (Archivo 600) · name (muted) · % (mono, Wong-colored w/ triangle) · RVOL (mono) · catalyst Tag + one-line reason · source link (underlined). “No news found — likely noise” renders muted, de-emphasized. |
| SetupCardRow / SetupCard | Row (Desk): pattern name · ticker · tier Tag · one-line cause. Card (rail): full RR Fig 9.3 template — WHAT FIRED / BASE RATE sentence / IconArray / N + CI + ref-class + baseline line / TYPICAL RANGE / weakener checklist (persisted checkboxes) / scope line / provenance + Learn doorway. |
| IconArray | 20 squares, 10px, 2px radius. Filled: ink at 80%. Empty: 1px outline in `--muted` (≥3:1 against the card surface — the misses must be impossible to miss). Color stays out of probability visuals — a declared, logged deviation from RR Fig 9.3’s blue-filled mock. Static, never animated. |
| VolBand (fan) | Lightweight-Charts area overlays or SVG band behind price: 50%/80% bands in ink at 8%/5% opacity, labeled “8 in 10 past paths stayed inside” **plus the regime-break caveat line (copy key `volband.caveat`)**; hard stop at 20 trading days. |
| CalendarTimeline | Vertical ET timeline; event rows: time (mono) · kind Tag · title · consensus/prior (mono); expandable if/then branches with per-branch base-rate sentences (or the N<30 suppression line). |
| BriefArticle | The editorial centerpiece: Newsreader prose; “Today’s focus” headline in display italic 27px; 3–5 items each with labeled slots (WHAT HAPPENED / WHY IT MATTERS / BY THE NUMBERS / YES, BUT as 11px caps side-labels); every claim’s source ID renders as a superscript link; exactly one Academy doorway at the end. |
| ScorecardPM | Same article shell; “flagged vs happened” table with outcomes in plain language; misses styled identically to hits (no shame-red); journal prompt at the end writes to the Academy journal. |
| RailSheet | Desktop: 440px right rail (Radix Dialog, non-modal feel, Esc/outside-click closes, scroll+selection restored). Mobile: full-height bottom sheet with a visible “← Back to Desk” bar, bottom action area padded by `env(safe-area-inset-bottom)`. **Opening pushes a history entry; popstate closes the sheet** — the Android back gesture must close the sheet, never exit the app (e2e-tested). This is drill level 2; level 3 is a route. |
| ReturnRail | Persistent 40px bar on cross-zone jumps: “You came from: AAPL setup, Jul 9 → Return”. State restored exactly (scroll pos, open rail, filters) via history state. |
| GlossaryTerm | Dotted underline on first occurrence per view; hover = one-line tip; click = popover (definition + tiny static example + “Full lesson →”). Never nested. |
| SourceStatusFooter | Per-provider dots (ok/degraded/off) + “pipeline ran 6:37–8:41pm ET” + FRED attribution line + TradingView note. Quiet, always present on the Desk. |
| OfflineRibbon | Ink-on-bone band under the masthead: “Offline — showing the last synced briefing (Jul 9).” Neutral, not amber. |
| TrackRecordChart | Calibration scatter (predicted vs realized buckets, per-bucket N labels), rolling Brier as a plain mono figure with “0.25 = coin flip” caption; resolved log table beneath, filterable, misses first-class. |
| CostMirror | One mono hero-adjacent figure: projected annual drag from the user’s own paper turnover, with the arithmetic spelled out beneath in prose. |

### 3.7 Charts (Lightweight Charts theming)

- Background transparent over `--surface`; grid lines `--hairline`, horizontal only; axis text Plex Mono 11px `--muted`; crosshair 1px ink, no magnet glow.

- Candles: up = hollow body with `--up` 1.5px border; down = filled `--down`. Wicks 1px same color. (Hollow/filled is a second redundant channel beyond color.)

- Volume histogram in ink at 12% opacity, its own pane; RSI pane line 1.5px ink with 30/70 hairlines — indicator panes never colored.

- Annotation markers (explain-why): 8px ink circles with numbered labels matching the drawer steps; price lines 1px dashed ink.

- Keep the TradingView attribution logo visible (license condition).

### 3.8 Responsive & the phone ritual

- **Breakpoints:** ≥1366 = one-screen Desk grid (modules 1–8 visible, rail as overlay); 768–1365 = two-column stack, rail overlays; <768 = **the ritual column**.

- **Ritual column (phone / installed PWA):** single column in strict order 1→8; each module a full-bleed band separated by 2px rules with its masthead; sticky 48px top bar (date · US session state · sync time); tap targets ≥ 44px; watchlist/movers rows open the bottom sheet; “Open full view” pushes the route (level 3) with an always-visible back bar (installed iOS PWAs can’t rely on swipe-back). Setup cards render as rows; the sheet shows the full card. Thumb reach: primary actions bottom-aligned in sheets.

- The hero numeral drops to 48px; tables become two-line stacked rows (label over value) — never horizontal scroll except inside charts.

- One-screen claim applies at ≥1366×768 only (per RR §9.2); the order is the invariant below that.

### 3.9 Accessibility & voice

- AA contrast on all text tokens (verify in P0 styleguide); focus visible everywhere (2px `--accent` outline, 2px offset); full keyboard paths for rail, popovers, review queue; `aria-live="polite"` only for the offline ribbon and form errors — nothing else announces.

- Every data visual has a text equivalent (the base-rate sentence IS the accessible name of the icon array; tables underlie charts via a “view as table” toggle on the track record).

- Copy voice: mechanical third person, sentence case for all prose and UI copy; uppercase is reserved for the structural caps set — mastheads, table headers, StatFigure labels, Tag text, and brief slot labels. No exclamation marks, no “I”. All canonical strings in Appendix J — use them verbatim.

### 3.10 Anti-drift checklist (run at every phase exit — mechanical checks first, then eyes)

1. **Mechanical greps (must all be empty):** `shadow-`/`box-shadow` outside the scrim; `gradient`; radius utilities > 2px; hex colors outside `globals.css` tokens; font families beyond the three loaded; `small-caps`; amber tokens outside the two §3.3 consumers; animation/transition on any probability or money component.

2. **Hero discipline:** “view” = route. Only `/` renders `--text-hero` (the macro SPX figure, in ink); every other route’s largest numeral is ≤ `--text-num-lg`; `/paper` never renders P&L at ≥ `--text-num-lg` (P&L is never a hero — RR rule).

3. Is every number in Plex Mono? Every module timestamped? Every claim carrying N/CI/source?

4. **Room check via baselines:** lesson pages assert `--academy-bg` + Newsreader in the visual-regression suite; Desk asserts `--desk-bg` + Archivo. The zone switch must be visible in a side-by-side of the two baselines.

5. Could this screen be mistaken for a default template? (If unsure, it can — change it.)

6. Would the Research Report’s §9.8 anti-pattern table object to anything visible?

---

Part 4

## App architecture & conventions

*The Next.js side, pinned: routes, data flow, the auth deviation, fonts, caching, and the performance budgets the phases are tested against.*

### 4.1 Pins

Node 24 LTS · Next.js 16 (App Router; `proxy.ts`) · TypeScript strict · Tailwind v4 (tokens via `@theme` in `app/globals.css`) · Radix primitives (Dialog, Popover, Tabs, Checkbox) hand-styled — shadcn’s visual layer is not used · Prisma 6 · zod at every JSON boundary · lightweight-charts v5 (hand-rolled `useLightweightChart` hook) · Recharts 3 (sparklines/small multiples only) · Serwist (service worker) · bcryptjs + jose (auth) · Vitest + Testing Library · Playwright (+ @axe-core/playwright) · npm (app) · uv (pipeline). Versions: latest stable at install time; pin via lockfiles; record exact versions in DECISIONS.md at P0.

### 4.2 Route map (authoritative)

| Route | Renders |
| --- | --- |
| `/` (desk) | The one-screen Desk / phone ritual column: modules 1–8, rail host, source-status footer. |
| `/ticker/[symbol]` | Drill level 3: full chart (candles + volume + RSI panes, vol band), signal history, relative-strength (P6+), news timeline, breadcrumb + Back to Desk. |
| `/track-record` | Calibration chart, Brier figure, resolved log (app flags + user forecasts), banner state for underperforming families. |
| `/scans` | Preset list with fully visible criteria, each line glossary-linked; results table. |
| `/settings` | Watchlist management, install-app row, dark-mode toggle (P6), logout. (Desk route group — the group adds no URL segment.) |
| `/academy` · `/academy/[module]` · `/academy/[module]/[lesson]` | Curriculum map (M0–M6, soft-gate states) · module page · MDX lesson with glossary popovers and “See this live”. |
| `/academy/glossary` · `/academy/review` · `/academy/journal` | Term index · Leitner queue (max 5/day) · journal + forecast entries with resolution states. |
| `/paper` (P6) | Ledger, entry form (cooling-off interstitial), cost mirror, frequency mirror. |
| `/login` · `/offline` · `/styleguide` | Editorial login card · offline fallback (cached) · living design spec (every token/component; dev + CI only, excluded from prod nav but kept behind auth). |
| `/api/revalidate` | POST, `Authorization: Bearer $CRON_SECRET` → `revalidateTag('morning')`. |
| `/api/morning` | GET (cookie-authed) → the serialized `lib/morning.ts` payload; exists solely for the SW’s offline-morning cache (§5.2). Unauthed → 401 JSON, never a redirect. |

### 4.3 Data flow rules

- **Server components read; server actions write user-state only** (watchlist_item, journal_entry, concept_state, paper_trade, weakener checks). No client fetching libraries; no global state manager. Client components receive serialized props.

- **Morning payload:** (named for the session it prepares — it publishes the evening before; the `morning` identifiers below are contractual and stay) a single `lib/morning.ts` loader assembles the Desk’s data (briefing, scans, cards, calendar, movers, quotes, pipeline status) in one place, tagged `'morning'` for cache revalidation, zod-parsed (briefing JSON especially). The same loader serializes to the client for SW caching (§5.3).

- **Numbers pipeline-side only:** the app never computes a base rate, CI, or indicator — it renders stored values. The one shared renderer `components/BaseRate.tsx` implements the N-gated precision rules and the canonical sentence; nothing else may format a base rate.

- **Timestamps:** store UTC; display America/New_York everywhere — the user lives on market time (“as of 16:05 ET”). `lib/time.ts` owns all formatting, including the EDT/EST abbreviation and DST-boundary behavior; no ad-hoc date code.

### 4.4 Auth (declared deviation #1 from Blueprint §7.1)

**Decision:** replace HTTP Basic Auth with a single-user cookie session — going further than the Blueprint’s named step-up (it sanctions a single-credential login as the eventual upgrade; this plan ships it at P0, hand-rolled rather than via Auth.js, because one user + one credential does not justify a framework dependency). **Why now:** an installed standalone PWA with a service worker interacts badly with Basic-Auth 401 challenges (re-prompt loops, SW fetch failures, ugly install experience). **Spec:** `/login` posts to a server action; verify against `AUTH_USER` + `AUTH_PASS_HASH` (bcryptjs, cost 12; hash generated by `app/scripts/hash-password.mjs`); on success issue a `jose`-signed JWT in an httpOnly Secure SameSite=Lax cookie, 30-day expiry, secret `AUTH_COOKIE_SECRET`. **Sliding renewal:** `proxy.ts` re-issues the cookie whenever < 23 days of validity remain, so daily use never hits a hard expiry (an idle month still lands on `/login`, whose shell is precached — §5.2). **Exemptions** (everything else requires the cookie): `/login`, `/api/revalidate` (bearer-gated), `/manifest.webmanifest`, `/sw.js`, `/offline`, `/_next/*` static, and the icon files (`/icons/*`, `/apple-touch-icon.png`, `/favicon.ico`, `/mark.svg`). **API vs pages:** unauthenticated `/api/*` gets `401` JSON — never a 3xx — so the service worker can recognize auth failure instead of caching a redirect (§5.2); unauthenticated pages redirect to `/login`. Failed-login throttle: 1s constant-time compare+delay (primary defense) plus a best-effort 10/hour in-memory counter — best-effort because serverless instances don’t share memory; acceptable for a single-user app behind an unguessable username, logged as such. Logout clears the cookie *and* runtime caches (§5.2). The licensing wall (Blueprint Part 4) is preserved: all data routes remain behind the cookie.

### 4.5 Fonts, caching, performance budgets

- Fonts via `next/font` (self-hosted at build, same-origin, precacheable): Archivo variable (wght + wdth), Newsreader variable (wght + italic, *no* opsz axis — see the §3.2 correction of 2026-07-10), IBM Plex Mono 400/500/600 — subsets latin; total budget ≤ 320KB woff2, actual 237KB, enforced by `app/scripts/check-font-budget.mjs` at every phase exit. `display: swap`; fallback stacks defined in tokens.

- Rendering: dynamic RSC everywhere (single user; DB reads are cheap); fetches wrapped with `next: { tags: ['morning'] }` where applicable so the pipeline’s revalidate call is meaningful. No ISR complexity in v1. Two exceptions: `/offline` and `/login` export `dynamic = 'force-static'` so a concrete HTML asset exists for the SW to precache (§5.2).

- **Budgets (enforced at each phase exit):** first-load JS on `/` ≤ 200KB gz (charts and Recharts lazy-loaded per module via `next/dynamic`); LCP ≤ 2.5s on Moto-G-class 4G (Lighthouse mobile); CLS < 0.05 (reserve chart heights); route transitions render server-fresh without spinners (quiet “—” placeholders only).

- Images: none decorative; icons are inline SVG; app icons static files.

---

Part 5

## PWA specification

*First-class target, specified concretely. The goal state: installed on the user’s phone home screen, opening instantly whenever it is reached for — the evening read or the pre-open glance, online or offline — always labeled with exactly how fresh its data is.*

### 5.1 Manifest (`app/manifest.ts`)

```
name: "myStockMarket"        short_name: "Desk"         id: "/"
start_url: "/"               display: "standalone"      orientation: "portrait"
background_color: "#F4F5F3"  theme_color: "#F4F5F3"     description: "US-market command center & learning hub"
icons: 192/512 png + 512 maskable (safe zone 80%) + 96 monochrome
shortcuts: [{name:"Track record", url:"/track-record"}, {name:"Review queue", url:"/academy/review"}]
```

`start_url` is plain `/` — no `?source=pwa` tracking param (it would fork the SW’s single-entry page cache; installed-state detection uses the `display-mode: standalone` media query instead). Manifest `theme_color` is a static install-time value (light); the *live* browser/status-bar color comes from Next’s `viewport.themeColor` exported per layout — Desk `#F4F5F3`, Academy `#FAF6EF`, with dark-mode media variants at P6 (§8, P6 step 6). Icons generated at P0 by `app/scripts/icons.mjs` (sharp) from `public/mark.svg` — the three-candle tick mark from the document covers, ink on bone; maskable variant adds 20% padding. iOS: `apple-touch-icon` 180px, `apple-mobile-web-app-status-bar-style: default`, and a “viewport-fit=cover” + safe-area-inset padding on the sticky bar and bottom sheets.

### 5.2 Service worker (Serwist)

| Concern | Spec |
| --- | --- |
| Precache | Build assets (Serwist injected manifest) + fonts + the mark/icons, plus `/offline` and `/login` via `additionalPrecacheEntries` — both routes are `force-static` (§4.5) precisely so this works; `/offline` is also registered as Serwist’s document `fallbacks` entry. |
| Pages (navigations) | NetworkFirst, 3s timeout → cache → `/offline` fallback. Full-document navigations only — RSC flight requests (`?_rsc=`) pass through uncached (a client-side transition that fails offline falls back to a full navigation, which the SW does serve). Authenticated pages are runtime-cached only after first successful load (never at build). |
| Morning payload | The Desk page caches with its HTML; additionally `/api/morning` (§4.2) returns the serialized payload — StaleWhileRevalidate, single-entry cache `morning-v1`, so the ritual column can render the last synced briefing offline. |
| Static/fonts/icons | CacheFirst, 1 year, revisioned by build. |
| **Cache write rules** | A shared `cacheWillUpdate` plugin on every runtime strategy: cache a response only if `status === 200`, `response.redirected === false`, and the final URL is not `/login`. This is the guard against the expired-cookie failure mode — without it, a 30-day-old cookie turns every cached page and the morning payload into a copy of the login screen. Unit-drilled in the e2e suite (§5.5.2). |
| Never cached | `/api/revalidate`, server actions (POST), login POST, any non-GET. |
| Update flow | New SW installs in background and waits (no automatic skipWaiting interrupt); a waiting worker surfaces the footer line “Updated — refresh when convenient”. Clicking it posts `SKIP_WAITING` to the waiting worker and reloads on `controllerchange`; otherwise the new worker activates when the app fully closes (all tabs/PWA closed — *not* merely on next navigation). Calm — no toast, no modal. |
| Logout | Server action response triggers client `caches.delete('morning-v1')` + pages cache purge, then redirect to `/login`. |

### 5.3 Offline honesty (the guardrail applied to the PWA)

Offline is a first-class, honest state — not an apology. Every module already renders its “as of” timestamp (SectionMasthead), so stale data self-identifies. Additions: the OfflineRibbon (“Offline — showing the last synced briefing (Jul 9)”) mounts on either of two concrete signals: (a) `navigator.onLine === false` (plus online/offline listeners), or (b) the morning payload was served from SW cache — detected via an `X-SW-Source: cache` header the SW strategy stamps on cache-served responses, with the payload’s own `runDate` ≠ today as the belt-and-braces check. Interactive writes (watchlist, journal, checkboxes, paper trades) disable with a quiet inline note “Reconnect to save” — **no offline write queue in v1** (single user, evening-read ritual; queuing risks silent divergence — logged as backlog).

### 5.4 Install UX

No nagging banner. Capture `beforeinstallprompt`; surface an “Install app” row in `/settings` and a one-line footer link — both call `prompt()`. On iOS (no BIP event): the same row opens a small popover with the two-step Share → “Add to Home Screen” instruction. Detect installed state (`display-mode: standalone`) and hide the row.

### 5.5 PWA acceptance (tested at P1, re-tested every phase exit)

Lighthouse dropped its PWA category in v12 (2024) — installability and SW behavior are therefore asserted directly in Playwright, not scored. Lighthouse remains in the gate for performance/a11y budgets only (§6.4).

1. **Installability (Playwright):** `/manifest.webmanifest` returns 200 with required members (name, id, start_url, standalone display, 192+512 icons, maskable); icon URLs all resolve 200 *without* the auth cookie; SW registers on `/` and on `/login` (pre-auth, so update checks run even when logged out) and reaches `activated`; `/offline` and `/login` present in the precache manifest.

2. **Offline behavior (Playwright, Chromium — the one engine whose SW+offline emulation Playwright supports; note in the suite):** `context.setOffline(true)` after a logged-in Desk visit → reload → ritual column renders the last synced briefing + OfflineRibbon + timestamps; a lesson visited before offline renders from cache (full `page.goto`, not a client-side transition — §5.2 scopes offline pages to full documents); **expired-cookie drill:** clear the cookie, load twice online (redirects land on `/login`, uncached by the cacheWillUpdate guard), re-login, go offline → Desk still renders the briefing, not a cached login page.

3. Manual device matrix (once per phase, logged in PROGRESS.md): Android Chrome install + standalone auth + offline + **back-gesture closes sheets without exiting**; iOS Safari A2HS + standalone auth persistence (cookie survives) + safe-area rendering. Emulator acceptable when a device is unavailable; note which.

4. SW update drill: deploy a trivial change → footer “Updated — refresh when convenient” appears → clicking it activates the new worker (SKIP_WAITING → controllerchange reload) → new build serves.

---

Part 6

## Testing & TDD protocol

*The Blueprint commits to TDD; this part makes it mechanical: what always gets a failing test first, which layer owns which test, and the commands that gate every phase exit.*

### 6.1 Tooling by layer

| Layer | Tooling & conventions |
| --- | --- |
| Pipeline (Python) | `uv run pytest`; fixtures = recorded JSON per adapter under `pipeline/adapters/fixtures/`, injected via `httpx.MockTransport` (no live keys in tests, ever); indicator tests vs the toy series (Appendix F) + weekly CI cross-check vs pandas-ta-classic as an independent oracle; base-rate lookahead guard = a test that FAILS if the one-bar shift is removed; publish tested against dockerized Postgres (compose file in repo). |
| App unit (Vitest) | Colocated `*.test.ts(x)`. Mandatory suites: BaseRate renderer (all three N regimes, CI text, baseline cap), tier-cap logic, Wilson CI (textbook cases: 62/110 → [47%, 65%]; 60/100 → [50.2%, 69.1%]), copy-deck strings render verbatim, time formatting (ET, including cases on both sides of the March/November DST transitions), zod parsers reject malformed briefing JSON. |
| E2E (Playwright) | `app/e2e/`; runs against `next build + start` with the seeded database (`prisma/seed.ts` creates one deterministic synthetic morning — same seed drives local dev). Journeys listed in 6.3. Includes @axe-core scan of Desk, ticker, lesson, track record (no serious/critical violations). |
| Visual regression | Playwright screenshots of `/styleguide`, Desk (1366×768 + 390×844), one lesson, track record — compared with `maxDiffPixelRatio: 0.01`; update baselines only via the `visual-regression-update` skill with a logged reason. |
| CI (`ci.yml`) | On push: typecheck, lint, Vitest, pytest (fixtures), build; Playwright + Lighthouse CI on the P-exit tag. Red CI blocks phase exit — no exceptions. |

### 6.2 The always-test-first list

Write the failing test before the implementation for: every indicator; every pattern detector (including its one-bar-shift guard); Wilson CI; the N-gated display rules; the tier cap; the verification gate (seeded-fake-number test); the publish transaction (mid-publish read sees the old generation); signal_log idempotency (rerun produces zero duplicates); the resolver; the cooling-off trigger; the half-Kelly cap (property test: suggestion ≤ half-Kelly for random inputs); auth (wrong password, cookie tamper, protected-route redirect); the offline briefing render. UI layout/styling may be built visually against the styleguide — pixels are verified by the visual-regression suite instead.

### 6.3 E2E journeys (the product, as tests)

1. **The daily ritual:** login → Desk renders modules 1–8 in order → every module shows an “as of” timestamp → brief’s Today’s-focus present (“no clear edge” state also covered by seed variant). *P1 variant* asserts the seeded scans/movers/calendar modules plus placeholder mastheads (“—” bodies) for the not-yet-built ones; the full assertion set lands with the briefing at P3.

2. **Drill & return:** click watchlist ticker → rail opens (no route change) → Esc → scroll + selection restored; “Open full view” → ticker route → Back to Desk restores state; phone viewport: same via bottom sheet.

3. **Doorways:** setup card “Learn” → lesson with ReturnRail → Return restores Desk exactly; lesson “See this live” → Desk anchored.

4. **Honesty rules:** N<30 card shows suppression text and no percentage; CI-spanning-baseline card shows WEAK tier; mover without news shows the noise line; folklore preset carries its label; brief with a gate-flagged line renders the flag.

5. **Offline PWA:** per §5.5.

6. **Review queue:** never exceeds 5; answering updates box/due date; pattern lesson before M3 completion shows the soft gate.

7. **Paper desk (P6):** order within X minutes of a signal → cooling-off interstitial; cost mirror equals spread×turnover arithmetic on the seeded ledger; forecast journal entry resolves and appears on the track record.

### 6.4 Phase-exit gate (run, in order, every phase)

```
1  npm run typecheck && npm run lint && npm test          # app unit
2  uv run pytest                                          # pipeline
3  npm run build && npx playwright test                   # e2e + axe + visual + PWA (§5.5)
4  npx lhci autorun — mobile, / — perf+a11y budgets only; authenticated via a
   CI-minted session cookie passed in lhci extraHeaders (PWA asserts live in step 3)
5  Anti-drift checklist (§3.10) against fresh screenshots
6  Update PROGRESS.md · append DECISIONS/LESSONS · git tag phase-N · push
```

---

Part 7

## Phase playbooks — P0 to P3

*Each playbook: objective → ordered build steps with file paths → tests to write first → acceptance (the Blueprint’s criteria plus this plan’s design/PWA additions) → self-verification. Do not start a phase before the prior phase’s exit gate is green.*

### P0 · Walking skeleton + intelligence layer [1–2 sessions]

**Objective:** the loop exists end to end — a cron writes a row in the cloud, an authenticated, installable app shell renders it, and the project can be resumed by a fresh session using only the repo.

**Build order:**

1. `git init`; commit the docs; create `CLAUDE.md` (Appendix K template), `DECISIONS.md` (seed with this plan’s recorded decisions), `PATTERNS.md`, `LESSONS.md`, `PROGRESS.md`, `.claude/skills/README.md` (rubric from §9.3). Conventional commits from the first commit.

2. Run the **Session-0 checklist** (§1.4) with the user — *collect* every value now; probes run progressively at the P0 step that builds their tooling (steps 5, 8, 9). “All Session-0 probes green” is a named P0 exit criterion; record each in PROGRESS.md.

3. Scaffold `app/`: `npx create-next-app@latest app --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"`; prune boilerplate; Tailwind v4 `@theme` tokens from §3.2–3.4 into `globals.css`; next/font setup (Archivo, Newsreader, IBM Plex Mono).

4. Build the identity primitives: `SectionMasthead`, `Tag`, `StatFigure`, base layout shell (Desk/Academy top nav, footer) — then `/styleguide` rendering every token and primitive.

5. Auth per §4.4: `proxy.ts`, `/login`, hash script (hash the user-supplied password here; discard the plaintext), logout action.

6. PWA seed: `manifest.ts`, icons script + generated set, Serwist wiring, `/offline` route.

7. Prisma: schema v0 = `pipeline_run` only; `migrate dev`; `lib/db.ts`.

8. Pipeline skeleton: `uv init`; `config.py` (pydantic settings, env names per Appendix D); `scripts/probe_providers.py` (one authenticated smoke call per provider + Anthropic — this runs the §1.4 key probes); `jobs/job_a.py` hello-run writing a `pipeline_run` row; `jobs/job_b.py` stub that pings healthchecks success — **from P0 onward the 00:25 UTC check is fed on schedule by nightly-b**, so the dead-man never false-alarms while later phases build; `nightly-a.yml` (cron + workflow_dispatch), `nightly-b.yml` (cron + stub), `ci.yml`.

9. Desk placeholder: module 0 masthead showing last `pipeline_run` timestamp. Deploy to Vercel; run one manual `workflow_dispatch`.

**Tests first:** auth unit tests (wrong password, tampered cookie, redirect); pipeline config test (missing env fails loudly); one Playwright smoke (login → shell renders → timestamp visible); healthchecks ping mocked test.

**Acceptance (= Blueprint P0 + additions):** the deployed app shows the evening run’s timestamp, produced entirely by the cloud schedule with nothing on the user’s hardware; disabling nightly-b once makes the healthchecks check go *down* (observed autonomously via the read-only API), then recover; all Session-0 probes green — provider keys smoke-tested by `probe_providers.py`, Vercel preview protection confirmed ON; the §5.5.1 installability assertions pass (manifest, icons unauthenticated, SW activated); login works inside the installed standalone app (Android or emulator; iOS if available); `/styleguide` passes the §3.10 checklist; CI green; intelligence files exist with real content.

### P1 · Data spine + minimal Desk [1–2 weeks of sessions]

**Objective:** full-universe EOD data flows nightly into Parquet + Postgres; the Desk’s skeleton modules (macro, movers, watchlist) render real data in the real design; drill level 2 exists; the signal log starts recording.

**Build order:**

1. Prisma schema v1 (Appendix B: instrument, price_bar, scan_result, signal_log, watchlist_item + enums); migrate; `prisma/seed.ts` deterministic synthetic morning (drives dev + e2e).

2. `adapters/base.py` (repository interface + fixture loader + token-bucket rate limiter) → `adapters/alpaca.py` (multi-symbol daily bars, corporate actions, universe listing) with fixtures. *Mint the `new-provider-adapter` skill here* — the next five adapters follow it.

3. `indicators.py`: the v1 set (Appendix F list) as Polars expressions — toy-series tests first; *mint `new-indicator` skill.*

4. Parquet store module (year partitions on R2, current-year rewrite with a trailing 5-session re-pull each night to catch vendor restatements, adjustments table, corporate-action full-rewrite path); DuckDB scan queries; `scans.py` — the five v1 presets exactly as specced in Appendix F.

5. `publish.py`: single-transaction refresh (staging swap or delete-and-insert per Blueprint §7.3) for price_bar (watchlist + SPY/QQQ/DIA/IWM + sector ETFs), scan_result, pipeline_run stages; a `workflow_dispatch` rerun consults `pipeline_run` stages and skips completed ones (idempotent resume); signal_log inserts with `ON CONFLICT DO NOTHING` (rate fields null until P4); wire into job_a.

6. Desk modules in design: 01 Macro pulse (StatFigure hero = SPX day %, in ink; index row; breadth strip — advancers/decliners and %-above-50DMA computed from the ingested universe + SMA50; VIX and 10-yr cells live via a *minimal* `fred.py` series adapter pulled forward from P2 — VIXCLS + DGS10 only, ~40 lines against the existing adapter base, keeping the Blueprint’s P1 scope intact), 04 Movers (MoversRow sans catalysts — “reasons arrive in P2” note), 05 Watchlist (CRUD server actions, sparklines from price_bar). All eight Desk mastheads mount now — unbuilt modules render their masthead over a quiet “—” placeholder body, so the ritual’s shape is complete from P1.

7. RailSheet (desktop rail + mobile bottom sheet) + `/ticker/[symbol]` with the Lightweight Charts hook (candles + volume pane, themed per §3.7).

8. SW runtime caching of the morning payload (`/api/morning`); OfflineRibbon.

9. Weekly `pg_dump` step (session pooler) in nightly-b.yml; restore test once.

**Tests first:** every indicator (toy series); adapter fixture tests incl. rate-limit behavior; universe-validation hard-fail (<95% symbols → job fails — test with a truncated fixture); publish transaction isolation test (reader mid-publish sees old generation); stage-skip rerun test (a rerun after a mid-stage failure skips completed stages, produces zero duplicates); signal_log idempotency; watchlist server-action tests; e2e journeys 1 (P1 variant), 2, 5 (§6.3); visual baselines captured.

**Acceptance (= Blueprint P1 + additions):** nightly Job A ingests the defined universe in < 30 min (observed in Actions logs); indicator suite green; hard-fail proven; the five presets write signal_log rows with `resolves_on`; all eight mastheads render (placeholders honest); macro module shows breadth + VIX/10-yr live; rail opens without route change and Esc restores scroll + selection (desktop and phone viewports); candles render from price_bar with the attribution logo visible; offline reload shows the last synced briefing; backup restored once successfully; budgets met (≤200KB first-load, LCP ≤ 2.5s mobile).

### P2 · Catalyst & context layer [~1 week]

**Objective:** the Desk explains — movers get reasons or the honest noise line; the US session calendar exists; every source degrades independently and visibly.

**Build order:**

1. Adapters via the skill: `finnhub.py` (metrics + company news — never candles), `fmp.py` (earnings calendar bmo/amc), `edgar.py` (per-CIK submissions, declared User-Agent), `fred.py` extended to full (release calendar — the minimal VIXCLS/DGS10 series adapter shipped in P1), `marketaux.py` (tagged snippets — the market-wide catalyst source).

2. Prisma v2: news_item, calendar_event; catalyst matcher (ticker + time-window join, catalyst-type classification) in `scans.py`; per-source status into pipeline_run.

3. Desk: 03 CalendarTimeline (events + consensus/prior; if/then branches render event-only with “branch base rates attach in P4” state), 04 movers upgraded (catalyst Tag + reason + source link, or noise line), SourceStatusFooter with FRED attribution.

4. Copy-deck states wired (Appendix J): degraded-source lines, empty states.

**Tests first:** each adapter’s fixtures incl. error/timeout paths (one provider down ⇒ its section degrades, run succeeds — integration test); catalyst matcher (window edges, multi-ticker articles, no-match ⇒ noise line); calendar bmo/amc rendering; EDGAR User-Agent header assertion; FRED 2 req/s limiter.

**Acceptance (= Blueprint P2):** every >3% mover on the table shows a catalyst chip with source link or the noise tag (market-wide coverage partial by design and saying so); killing one provider key in a rehearsal run degrades one section, not the run; e2e journey 4 (partial) green.

### P3 · The briefing [~1 week]

**Objective:** the editorial heart ships — extract → synthesize → verify across the two jobs, rendered as the BriefArticle, degradable, and offline-cached.

**Build order:**

1. `briefing/extract.py`: per-article Haiku calls with the Appendix G schema, submitted via the Message Batches API in job_a; batch id persisted in pipeline_run.

2. `jobs/job_b.py`: preflight (XNYS holiday / no-batch-submitted night → log, exit 0, still ping success — the dead-man expects a ping every scheduled night) → ping `/start` → late-news delta sweep → collect batch — if still incomplete at 00:40 UTC, cancel it, keep the already-processed results (cancellation preserves and bills completed items), sync-extract only the remainder → `synthesize.py` (one sync Sonnet call, Appendix G prompt, structured output) → `verify.py` (deterministic gate, Appendix E tolerances) → publish (briefing table) → revalidate → ping success.

3. Prisma v3: briefing (am/pm JSON, verification_json, model_meta).

4. UI: BriefArticle (module 02) with labeled slots, Today’s-focus headline, per-claim source superscripts linking to news_item URLs; `learning_link_slug` values validated against the Academy lesson manifest — unmatched slugs render no doorway and are recorded in `verification_json` (the manifest is empty until P5, so briefs simply carry no Learn links yet — by design, not by error); ScorecardPM shell (“grading begins in P4” state); PM journal prompt → journal_entry write; “briefing unavailable” banner path; morning payload + SW cache include the brief.

**Tests first:** the verification gate — seeded fake number, fake ticker, fake date each caught (unit, with a fixture draft); tolerance table cases (8.2% matches 8.24%; $1.2B matches 1,200M; ticker case-fold); extraction schema zod/pydantic round-trip; batch-cutoff logic (clock injected); holiday/no-batch preflight (fixture night with no batch id ⇒ exit 0 + success ping); slug-validation (unknown slug ⇒ no doorway + verification_json entry); job_b end-to-end against fixtures with a mocked Anthropic transport; briefing-unavailable render test.

**Acceptance (= Blueprint P3):** five consecutive nights of real briefings in which every number/ticker/date passes the gate (observe the week; use workflow_dispatch reruns if a night is missed); the seeded-fake test is part of CI permanently; the batch-cutoff fallback drill exercised once for real; publish confirmed atomic under a mid-publish request; the brief reads correctly on the phone ritual column and offline.

---

Part 8

## Phase playbooks — P4 to P6, and the backlog

*The honesty engine, the Academy, and the paper desk. Protection ships with — or before — the features it protects; that ordering is contractual.*

### P4 · Setup cards, base rates & accountability [~2 weeks]

**Objective:** the signature unit ships honest-by-construction: pattern detectors, base rates with intervals and decay stamps, vol bands, the resolver, and a visible resolved log — in the same phase, inseparably.

**Build order:**

1. Pattern detectors v1 (Appendix F definitions, exactly six): golden cross · 52-week-high proximity · gap-with-catalyst · RSI extreme · unusual volume · breadth-regime cross — each a Polars expression writing `signal_events` Parquet; one-bar-shift guard test per detector. *Mint `new-pattern-detector` skill after the second one.*

2. `baserates.py`: DuckDB window queries → base_rate_stat rows (n, wins, Wilson CI, fwd p10/50/90) per (pattern, universe bucket, horizon 5/10/20d, regime) + pattern_meta decay fields (publication_year, evidence_grade, decay_note from the RR ledger — data table in Appendix F); unconditional always-up baselines computed per universe bucket + horizon and stored alongside. Universe bucket and regime are assigned *as of the event date* (point-in-time cap/dollar-volume, per Appendix F) — classifying historical events by today’s bucket is a lookahead bug, guarded by its own test.

3. `volbands.py`: empirical-quantile expected ranges (5/10/20d) per watchlist symbol → vol_band rows with frequency labels; nothing beyond 20 days by schema.

4. Lottery-risk flag computation (high-skew, low-price rule in Appendix F) → scan_result metric.

5. Prisma v4: base_rate_stat, setup_card, vol_band, signal_resolution; `resolve.py` nightly resolver (insert-only outcomes) wired into job_b; signal_log rate fields now stated at fire time.

6. UI: SetupCardRow (Desk module 06) + full SetupCard in the rail (IconArray, BaseRate renderer, baseline line, weakener checkboxes — per-pattern items from the Appendix F weakener table — persisted via server action, decay stamp, provenance, Learn doorway); tier logic with the Appendix F band constants and the CI-spans-baseline cap; scans page with fully visible criteria + evidence-grade Tags + folklore labels; CalendarTimeline branches attach per-branch base rates (or the N<30 suppression line); VolBand on the ticker chart *with the regime-break caveat line* (copy key `volband.caveat` — §1.5 rule 1); minimal `/track-record`: resolved-log table (calibration chart arrives P6); ScorecardPM grading goes live off signal_resolution.

**Tests first:** six detector tests + six shift-guard tests; bucket point-in-time guard (an event whose symbol later changed bucket classifies by its event-date bucket); Wilson CI textbook cases; baseline computation; tier bands (Appendix F constants) + tier cap (CI 47–65 vs baseline 55 ⇒ WEAK — the RR Fig 9.3 case as a literal fixture); N-gate all three regimes; resolver (horizon passes ⇒ one resolution row; rerun ⇒ still one); vol band never exceeds 20d (property test) + caveat string renders; lottery flag rule; e2e journey 4 complete.

**Acceptance (= Blueprint P4):** every card shows N + CI + baseline; the WEAK cap proven by test and visible in the seeded morning; suppression rendering proven; lookahead guards have failing-test proofs in git history (commit the red test first); every displayed card logged at render-eligibility time; resolved log fills within a day of horizons passing; decay stamps render on every published-anomaly pattern; anti-drift checklist passes on the card UI (this is the screen most at risk of chip-confetti — the Tag component is the only color carrier).

### P5 · The Academy [2–3 weeks, content-heavy]

**Objective:** the second room — warm, literary, price-free — with 25 real lessons, the glossary, worked-example drawers, and the review queue.

**Build order:**

1. MDX infrastructure: `@next/mdx` + frontmatter loader (`lib/academy.ts`), `content/academy/<module>/<slug>.mdx`; Academy layout (warm tokens, Newsreader, 65ch measure); curriculum map with module states + M3 soft gate.

2. Author the 25 launch lessons (Appendix H list — titles, one-line briefs, and which RR ledger rows each cites). Source material: the Research Report itself — every myth-vs-evidence lesson cites its Part 4 verdict and sources; write in the mechanical-honest voice; 3–5 minutes each; 2–3 retrieval questions in frontmatter. *Mint `new-lesson` skill after the second lesson; thereafter lessons are a production line.*

3. Glossary: seed the 40 Appendix I terms; GlossaryTerm popover wired across the Desk (first-occurrence-per-view discipline via a per-render registry).

4. Worked-example drawer: the fixed three-step template (what happened in the data → what pattern this matches and why it is believed to matter → what happened the last N times, failure count included) with numbered on-chart annotation markers synced to steps.

5. Review queue: Leitner boxes on concept_state (max 5/day, due-date scheduling, skip without guilt); seeded only from concepts the user actually encountered (Desk render logs concept exposures to concept_state).

6. Doorways completed: Learn chips, brief’s single learning link, “See this live” (find a current watchlist instance, open Desk anchored with teaching annotations), ReturnRail on every crossing; adaptive fading v1 (familiarity ≥ quizzed-correct ⇒ terse pro-mode card labels).

**Tests first:** loader (frontmatter contract, broken-MDX fails CI); soft-gate logic; queue cap + Leitner scheduling math; first-occurrence glossary discipline (unit on the registry); e2e journeys 3 and 6; visual baseline for a lesson page (the warm room must not drift cool).

**Acceptance (= Blueprint P5):** every term on the Desk has a glossary entry (CI check: scan rendered Desk seed for dotted-underline coverage against the term list); drawer → lesson → Return restores Desk state exactly; pattern lesson before M3 completion shows the gate; queue never exceeds 5; Academy breadcrumbs present; no live prices anywhere under `/academy` (e2e asserts absence of price elements).

### P6 · Paper desk, calibration & polish [~2 weeks + ongoing]

**Objective:** the protective loop closes: paper trading with friction, the full self-grading surface, the remaining should-widgets, dark Desk, and PWA/perf polish.

**Build order:**

1. Prisma v5: paper_trade (+ journal_entry forecast fields); ledger CRUD with simulated fills (next-open + half-spread + slippage per Appendix F constants); soft-gated on Academy M3.

2. Friction, wired to the ledger: cooling-off interstitial (paper order < 30 min after a signal fires on that symbol — constant in Appendix F), weekly frequency mirror, CostMirror (spread × the user’s actual turnover, arithmetic spelled out); half-Kelly-capped sizing helper (CI-lower-bound win rate + stored payoff percentiles; property-tested cap).

3. Forecast journal: probability + resolves_on on journal entries, resolved by `resolve.py`, Brier-scored.

4. Track record completed: calibration scatter with per-bucket N, rolling Brier + “0.25 = coin flip” caption, family-underperformance banner, user forecasts alongside app flags, view-as-table toggle.

5. Quantile dotplots in the rail (per-occurrence forward returns, losing tail visible); sector small multiples (module 07, identically scaled, desaturated); ⌘K palette (tickers, lessons, routes — zone-badged results).

6. Dark Desk (tokens from §3.3 dark column; Academy stays light; toggle in settings, `prefers-color-scheme` default; `viewport.themeColor` gains `prefers-color-scheme: dark` media variants so the standalone status bar follows — manifest theme_color stays light, install-time only); PWA final pass (§5.5 matrix, update-flow drill, icon QA); performance pass to budgets; accessibility sweep incl. the §3.3 dark-value contrast spot-checks.

**Tests first:** fill simulation math; cooling-off trigger (clock injected); cost-mirror arithmetic on the seeded ledger; frequency mirror; half-Kelly property test; forecast resolution + Brier; calibration bucketing; dark-mode visual baselines; e2e journey 7.

**Acceptance (= Blueprint P6):** ≥30 resolved signals visible with misses; cost mirror reproduces the arithmetic on the user’s ledger (fixture in tests); the interstitial fires in e2e; sizing never exceeds half-Kelly; user forecasts Brier-score on the track record; dark mode is Desk-only; Lighthouse ≥ 90 performance on `/` and the §5.5 PWA assertions all green; the §3.10 checklist passes on every screen; the full §6.4 gate is green.

### Post-P6 backlog (build nothing here without a logged decision)

Curated top-news module · relative-strength comparison chart · ECharts sector heatmap · push notification for “briefing ready” (calm-tech review required first) · offline write queue · live-brokerage integration (fully available to a US resident — gated on the paper track record demonstrating readiness, all friction mechanisms carried over) · Opus-class synthesis upgrade (~$1.70/mo) · paid-data ladder steps (Blueprint §4.2 triggers).

---

Part 9

## Intelligence layer & skills

*The scaffolding that makes you autonomous: five living documents, a session ritual, and a rubric for minting reusable skills instead of re-deriving procedures.*

### 9.1 The five documents

| File | Contract |
| --- | --- |
| CLAUDE.md | The constitution (Appendix K template): non-negotiables, stack pins, commands, conventions, authority hierarchy, session ritual. Changes rarely; every change is itself a logged decision. |
| DECISIONS.md | Append-only log: `YYYY-MM-DD · [claude] · [local\|structural] · decision · rationale (one line) · alternatives rejected`. Seeded at P0 with this plan’s pre-made decisions (§1.3 examples, §4.4 auth, Serwist, fonts, no-push-v1, npm/uv). Every entry you write carries the `[claude]` marker — any line without it is user-authored. User edits are vetoes at rank 2.5, detected by the session ritual’s diff (§9.2); honoring a veto becomes the session’s first task. |
| PATTERNS.md | Recurring code/design patterns worth copying: the adapter shape, the masthead composition, the server-action + zod + revalidate write pattern, chart hook lifecycle. Add when you catch yourself copying a second time; reference from code reviews. |
| LESSONS.md | Mistakes + resolutions: `symptom → root cause → fix → guard added`. Read at session start after CLAUDE.md. A lesson that repeats means the guard was inadequate — escalate to a test or a skill. |
| PROGRESS.md | Resumable state: current phase + checkpoint, last green gate (§6.4) with date, next three tasks, Blocked list (item · what unblocks · fallback in force). Update at every session end — a fresh session must be able to resume from this file alone. |

### 9.2 Session ritual

```
START: git pull → read CLAUDE.md → PROGRESS.md → LESSONS.md (skim)
       → diff DECISIONS.md since last session: any non-[claude] line or edit is a user
         veto (rank 2.5) — honoring it becomes the session's FIRST task
       → run: npm test && uv run pytest
       → confirm green (if red: fixing red IS the session) → announce the checkpoint being built
WORK:  TDD per §6.2 · commit small with conventional messages · log decisions as they happen
END:   update PROGRESS.md (checkpoint, next-3) · append DECISIONS/LESSONS/PATTERNS entries
       · push · if phase-complete: run the full §6.4 exit gate and tag
```

### 9.3 Skills — when to mint one

A skill is a self-contained procedure at `.claude/skills/<name>/SKILL.md`: name · when-to-use · exact steps · verification · one worked example. **Mint when all four hold:** (1) the procedure has ≥ 3 non-obvious steps; (2) it will plausibly recur ≥ 3 times; (3) its output is verifiable (a test, a checklist, a rendered page); (4) the procedure is stable (you’d write the same steps tomorrow). **Do not mint** for one-offs, things an npm script already encodes, or anything still churning. Update the skill when the procedure changes; a stale skill is worse than none. **Invoke the skill (follow its steps literally) whenever the task recurs — re-deriving a minted procedure is a process violation.**

**Expected skills and their minting moments (mint on evidence, not in advance)**

| Skill | Mint at | Covers |
| --- | --- | --- |
| new-provider-adapter | P1, after Alpaca | adapter interface, fixture recording, rate limiter, error isolation, tests, registration |
| new-indicator | P1, after the 2nd indicator | Polars expression shape, toy-series test, oracle cross-check entry, docs row |
| new-pattern-detector | P4, after the 2nd detector | definition → expression → shift guard → base-rate wiring → card copy → ledger grade (or, for un-graded patterns, the §1.5 t > 3.0 admission hurdle) |
| new-desk-module | P2, after the calendar | masthead + data loader + module component + seed data + e2e hook + visual baseline |
| new-lesson | P5, after the 2nd lesson | frontmatter contract, voice rules, citation to RR ledger, retrieval questions, glossary links |
| pwa-audit | P1, first full audit | the §5.5 matrix as a repeatable procedure incl. commands and device checklist |
| release-phase | P0 exit | the §6.4 gate, tagging, PROGRESS/DECISIONS updates, deploy verification |
| visual-regression-update | first intentional baseline change | when a diff is legitimate, how to review, update, and log it |

---

Part 10

## Conflict & stall protocol

*The complete algorithm for never needing the user. If you are about to type a question to a human, you are in this part — re-read it instead.*

1. **Ambiguity about product behavior** → grep rr-03/rr-04 (guardrails, product spec) then bp-0* then this plan. The answer is almost always written down. Cite the source in your commit message.

2. **Guardrail vs feature** → the guardrail wins; redesign the feature within it or move it to the backlog with a logged decision. No exceptions, no “temporary” violations.

3. **Design taste question** → §3.10 checklist + the manifesto. If two options both pass, pick the quieter one.

4. **External breakage** (API change, package gone, provider refusal, price change): apply the Blueprint’s pre-researched fallback (§4.2 ladder, §3.3 storage fallback, alternatives lists); adapt the adapter behind its interface; log LESSONS + DECISIONS; the contracts (tests) stay green. Never let a third party change what the user sees without a provenance note.

5. **A test is hard to satisfy** → the test is probably right (they encode the guardrails). Only change a §6.2-listed test with a structural DECISIONS.md entry explaining why the encoded rule itself was wrong — and never to weaken an honesty rule.

6. **Cost anomaly** (Anthropic spend pacing above ~$0.60/night for two nights) → investigate token counts in briefing.model_meta before optimizing; the spend cap is the backstop, not the alarm.

7. **Two failed attempts at anything** → smallest honest stub behind a named degradation flag, Blocked entry in PROGRESS.md (what unblocks it), move on. Return on the next phase boundary.

8. **Session context exhausted mid-task** → commit WIP behind green unit tests (or stash with a Blocked note), update PROGRESS.md checkpoint, end cleanly. The next session resumes from files, not memory.

9. **You discover this plan is wrong somewhere** (it will happen): if the fix is local, do it and log it; if structural, choose the option preserving ranks 1–2, log it as structural, and annotate DEVELOPMENT-PLAN.md with a dated correction block rather than silently diverging from the printed contract.

---

Part 11

## Appendices — the contracts

*Typable specifications. Field names and constants here are authoritative; any change to Appendix E, F, or J is a structural decision by definition (§1.3.3) — never a silent local edit.*

### A · Parquet & storage layout (R2 bucket `msm-history`)

```
prices_daily/year=YYYY/part.parquet   symbol·date·open·high·low·close·adj_close·volume  (raw + adjusted)
indicators_daily/year=YYYY/…          symbol·date·sma20/50/200·ema12/26·rsi14·macd·macd_sig·atr14·bb_up/lo·rvol20·dist_52w_high·gap_pct·ret_1/5/20
signal_events/year=YYYY/…             symbol·date·pattern_key·direction·attrs(json)
adjustments/adjustments.parquet       symbol·ex_date·factor·kind(split|div)      # audit trail
Rules: current year rewritten nightly; corporate action ⇒ affected symbol rewritten across ALL years;
bucket is a re-pullable cache — losing it costs one Alpaca re-pull. App never reads R2.
```

### B · Prisma schema draft (serving + user state; ✎ = app-writable)

```
Instrument   symbol PK · name · exchange · sector · industry · cik? · isActive · delistedAt?
PriceBar     [symbol,date] PK · o h l c adjC vol                       # watchlist+indices ×~5y
WatchlistItem✎ id · symbol → Instrument · reason · isFocus · addedAt   # focus cap enforced in UI (3)
CalendarEvent id · date idx · kind(earnings|macro|fed|div|other) · symbol? · timing(bmo|amc|time) ·
             title · consensus? · prior? · importance
NewsItem     id · publishedAt idx · provider · url · headline · snippet · tickers[] · eventType? ·
             sentiment? · extract Json?
ScanResult   id · runDate idx · presetKey · symbol · rank · metrics Json          # incl. lotteryFlag
SetupCard    id · runDate idx · symbol · patternKey · tier · state Json ·
             weakeners Json ✎(checkbox state) · baseRateId → BaseRateStat
BaseRateStat id · patternKey · universe · horizonDays · regime · n · wins · winRate · ciLow · ciHigh ·
             fwdP10 · fwdMedian · fwdP90 · baselineUpRate · publicationYear? · evidenceGrade ·
             decayNote? · computedAt      @@unique([patternKey,universe,horizonDays,regime])
VolBand      id · symbol · runDate · horizonDays(5|10|20) · lo · hi · coverage(0.5|0.8) · label
             # rendered ALWAYS with copy keys volband.label + volband.caveat (regime-break line)
SignalLog    id · firedDate · symbol · patternKey · horizonDays · statedWinRate? · statedN? ·
             resolvesOn · @@unique([firedDate,patternKey,symbol,horizonDays])   # INSERT-ONLY (grant-revoked)
SignalResolution id · signalId → SignalLog @@unique · outcome(hit|miss|na) · resolvedAt  # INSERT-ONLY
Briefing     runDate PK · amJson · pmJson? · verificationJson · modelMeta Json · status
PipelineRun  runDate PK · startedAt · finishedAt? · stageStatus Json · sourceStatus Json · batchId?
PaperTrade ✎ id · symbol · side · qty · fillPrice · spreadEst · openedAt · closedAt? · closeFill? ·
             thesis · signalId?
JournalEntry✎ id · date · prompt · body · forecast? · probability? · resolvesOn? · outcome? · brier?
Lesson       (filesystem MDX, not DB — declared deviation #4, §1.2) — frontmatter:
             module·slug·title·minutes·concepts[]·questions[]
ConceptState✎ conceptKey PK · familiarity(new|seen|reviewed|mastered) · box(1..3) · dueOn · lastSeenAt
```

### C · Workflow skeletons (.github/workflows/)

```
nightly-a.yml  on: schedule "37 22 * * 1-5" + workflow_dispatch · concurrency msm-nightly
  permissions: contents write (heartbeat commit)
  steps: checkout → uv sync → python -m jobs.job_a → heartbeat commit ("chore: heartbeat")
  Job A does NOT touch healthchecks — its failures surface as GitHub failure e-mails
  (exit nonzero); its holiday preflight logs + exits 0.
nightly-b.yml  on: schedule "25 0 * * 2-6" + workflow_dispatch · concurrency msm-nightly
  steps: checkout → uv sync → ping $HEALTHCHECKS_PING_URL/start → python -m jobs.job_b
         → weekly (Sat): pg_dump via SESSION_POOLER_URL → gzip → upload to R2 backups/
         → monthly (1st Sat): Stooq spot-check — 10 random symbols × 20 recent closes vs
           stored Parquet, >0.5% divergence ⇒ LESSONS entry + investigation task
         → ping $HEALTHCHECKS_PING_URL          # success ping — ONLY on success paths
  Job B OWNS the dead-man check (its cron matches). Holiday / no-batch preflight: log,
  exit 0, still ping success — the monitor expects a ping every scheduled night. The P0
  stub already follows this contract, so the check never false-alarms during buildout.
ci.yml         on: push — typecheck·lint·vitest·pytest·build; playwright+lighthouse on tags
               phase-*; weekly cron — indicator suite vs live pandas-ta-classic oracle
migrate.yml    workflow_dispatch only — prisma migrate deploy via SESSION_POOLER_URL
```

### D · Environment variable matrix (single placement authority — §1.4 defers here)

| Variable | Local | Vercel | GH secrets | Used by |
| --- | --- | --- | --- | --- |
| DATABASE_URL (transaction pooler) | ✓ | ✓ | ✓ | Prisma app reads/writes; pipeline publish |
| DIRECT_URL | ✓ | ✓ | — | prisma migrate dev (local only) |
| SESSION_POOLER_URL | — | — | ✓ | CI pg_dump + migrate.yml (IPv4) |
| AUTH_USER · AUTH_PASS_HASH · AUTH_COOKIE_SECRET | ✓ | ✓ | — | login + proxy.ts |
| CRON_SECRET | ✓ | ✓ | ✓ | /api/revalidate (app) · job_b caller |
| ALPACA_KEY_ID · ALPACA_SECRET · FINNHUB_KEY · FMP_KEY · MARKETAUX_KEY · FRED_KEY | — | — | ✓ | adapters (tests use fixtures, never keys) |
| EDGAR_USER_AGENT ("Name email") | — | — | ✓ | edgar.py mandatory header |
| ANTHROPIC_API_KEY · MODEL_EXTRACT · MODEL_SYNTH | — | — | ✓ | briefing/* (defaults claude-haiku-4-5 / claude-sonnet-5) |
| R2_ACCOUNT_ID · R2_ACCESS_KEY_ID · R2_SECRET · R2_BUCKET | — | — | ✓ | parquet store + backups |
| HEALTHCHECKS_PING_URL | — | — | ✓ | nightly-b (start + success pings) |
| HEALTHCHECKS_API_KEY (read-only) | ✓ | — | ✓ | P0 probe + autonomous alert verification (§1.4) |
| APP_BASE_URL | ✓ | ✓ | ✓ | job_b revalidate call |

### E · Verification-gate tolerances (briefing/verify.py)

| Entity | Match rule (draft value vs source set = extracts ∪ stats table) |
| --- | --- |
| Percentages | parse to float; match within max(±0.05pp absolute, ±0.5% relative) — “8.2%” matches 8.24%. |
| Prices / plain numbers | ±0.5% relative after thousands-separator strip. |
| Money with units | normalize $1.2B ≡ 1,200M ≡ 1.2e9, then ±1%. |
| Dates | exact after ISO normalization (“Jul 9” ⇒ runDate year assumed). |
| Tickers | exact after uppercase + $-strip; must exist in instrument. |
| Counts (N, “62 of 110”) | exact integers. |
| Verdict | each unmatched entity ⇒ inline flag on that sentence. Any flagged number in the Today’s-focus block, or >2 flags total ⇒ briefing status “held”: publish scans with the “briefing unavailable” banner. All decisions recorded in verificationJson. |

### F · Quant definitions & constants

- **Universe:** US common stocks + ETFs on NYSE/Nasdaq/AMEX, no OTC; active ≈5–6k symbols; delisted retained. **Buckets** for reference classes: “US large/mid” = top 1,000 by 63-day median dollar volume; “US small” = rest with price ≥ $5; sub-$5 excluded from cards (lottery flag territory). Bucket membership is **point-in-time**: computed from the 63-day window ending on the event date, so historical signals classify by what the symbol was *then* — never by today’s bucket (lookahead guard, P4 tests).

- **Indicators v1** (Polars expressions): SMA 20/50/200 · EMA 12/26 · RSI 14 (Wilder) · MACD 12-26-9 · ATR 14 · Bollinger 20/2 · RVOL 20 (volume ÷ 20-day mean) · 52-week-high distance · gap % (open vs prior close) · returns 1/5/20d. **Test approach:** a frozen 30-bar synthetic series checked into `pipeline/tests/toy_series.py`; expected values generated ONCE via pandas-ta-classic (the independent oracle), frozen into the test, and cross-checked weekly in CI against the oracle — regression + independence, no hand arithmetic to get wrong.

- **Detectors v1** (all evaluated on adjusted daily bars; signal shifted +1 bar before any forward-return join): golden-cross = SMA50 crosses above SMA200 (both defined ≥200 bars) · 52w-proximity = close enters within 2% of 252-day high · gap-with-catalyst = |gap| ≥ 3% AND same-day catalyst match · RSI-extreme = RSI14 crosses 30 up or 70 down · unusual-volume = RVOL ≥ 2.5 AND |ret_1| ≥ 2% · breadth-regime = %-above-50DMA (universe) crosses 50% either way (market-level card). Horizons: 5/10/20 trading days. Ledger grades + decay stamps per pattern_meta seed (golden-cross: weak, BLL 1992/STW 1999; 52w-high: mixed, George–Hwang 2004; gap: folklore-adjacent “continuation, not fill”; RSI: weak; volume: mixed, GKM 2001; breadth: context-only) — copy the wording from Research Report Part 4.

- **Scan presets v1** (P1; criteria strings render verbatim on `/scans`; all five write signal_log with horizonDays 10 — stated rates stay null until P4): `unusual-volume` RVOL20 ≥ 2.5 AND |1-day return| ≥ 2% [grade: mixed] · `near-52w-high` close within 2% of 252-day high, large/mid only [mixed] · `gap-3plus` |open gap| ≥ 3% vs prior close [folklore-adjacent — “continuation, not fill”] · `golden-cross-fresh` SMA50 crossed above SMA200 within the last 2 sessions [weak] · `rsi-extreme` RSI14 crossed 30↑ or 70↓ [weak]. Same keys and thresholds as the P4 detectors — one definition, two consumers.

- **Tier bands** (tendency tiers, from the RR Part 9 lexicon): win rate < 50% or CI spanning the baseline ⇒ **weak** · 50–58% ⇒ weak · 58–70% ⇒ moderate · > 70% ⇒ strong — and the cap rule: a CI that spans the always-up baseline caps the tier at weak regardless of the point estimate. Constants in `lib/constants.ts`, tested at P4.

- **Weakener seeds** (per-pattern checkboxes on SetupCard; 2–3 each, extend via structural decision only): golden-cross — extended > 15% above 200DMA · signal against the breadth regime; 52w-high — low RVOL on the approach · earnings inside the horizon window; gap-with-catalyst — gap already > 8% (chase risk) · catalyst is analyst-note-only; RSI-extreme — trend strongly against the reversion · earnings inside window; unusual-volume — no catalyst matched · sub-$10 price (lottery adjacency); breadth-regime — whipsaw (3rd cross in 20 sessions).

- **Lottery flag:** price < $5 OR (top-decile 60-day skewness AND price < $10) ⇒ flag on movers/scans rows.

- **Vol bands:** empirical quantiles of overlapping h-day returns over the trailing 500 sessions; bands at 50% (p25–p75) and 80% (p10–p90); label per copy deck; horizons 5/10/20 only.

- **Paper fills:** next-session open ± half of a per-bucket *at-open* spread estimate (large/mid 20bp, small 60bp — seeded from the Research Report §6’s at-the-open figures; the open is the ritual’s realistic fill window and is wider than mid-session) + 5bp slippage; constants live in `lib/constants.ts` + `pipeline/config.py`, single source each, documented in the UI’s arithmetic line; changing them is structural.

- **Cooling-off window:** paper order on a symbol < 30 minutes after viewing a fired signal on it ⇒ interstitial (educational copy, proceed/cancel). Frequency mirror: > 5 paper round-trips/week ⇒ weekly note with the cost arithmetic.

### G · LLM prompts & schemas (briefing/)

```
# Stage A — extraction (per article; model MODEL_EXTRACT; Batch API; structured output)
system: You extract facts from ONE news article for a financial briefing. Use ONLY the article
  text. No outside knowledge. No opinions, no advice, no predictions. If the article states a
  number, copy it exactly. Output must satisfy the JSON schema.
schema: { doc_id, headline_neutral (≤120 chars, declarative), summary (≤250 tokens, mechanical
  voice), tickers[], event_type (earnings|guidance|analyst|ma|fda|macro|legal|product|other),
  sentiment (-1..1 by article language, not your view), key_numbers[{value_str, what}],
  quote? (≤160 chars) } — every field grounded in the article; citations implicit via doc_id.

# Stage B — synthesis (one call; model MODEL_SYNTH; sync; structured output)
system: You write the evening briefing for ONE reader, a beginner, in mechanical third person.
  Inputs: (1) structured extracts with doc_ids; (2) a computed-stats table. RULES: every claim
  cites a doc_id or stat_id in its citations array; use provided numbers VERBATIM — never compute,
  never round differently; no directional predictions; no advice verbs (buy/sell/should);
  uncertainty language only from the provided lexicon; “no clear reason” is the required statement
  when no catalyst was matched; ≤5 items; each item fills the labeled slots.
schema: { today_focus {headline, body, citations[], no_edge_flag}, items[≤5]{what_happened,
  why_it_matters, by_the_numbers, yes_but, citations[]}, calendar_notes[], learning_link_slug }
Failure handling: schema violation ⇒ one retry with error appended; second failure ⇒ status
"held". Verified by Appendix E gate AFTER generation regardless. learning_link_slug is
validated against the Academy lesson manifest at publish — unmatched ⇒ doorway omitted +
recorded in verificationJson (manifest empty until P5, so early briefs carry no link).
```

### H · Academy launch lessons (25 — slugs are contractual)

```
M0 how-this-app-explains-itself · reading-a-base-rate-sentence · the-probability-lexicon ·
   the-track-record-page
M1 nyse-nasdaq-and-tickers · the-us-trading-day · order-types-and-the-spread · reading-the-macro-pulse
M2 what-a-round-trip-costs · slippage-taxes-and-drag · the-cost-mirror
M3 position-sizing-before-patterns · stops-and-invalidation · expectancy-and-drawdown-math ·
   why-base-rates-beat-anecdotes            # completing M3 lifts the pattern-lesson soft gate
M4 candles-honestly · support-resistance-and-round-numbers · volume-and-rvol · gaps-what-the-data-says
M5 moving-averages-and-the-golden-cross · rsi-and-oscillators · the-myth-vs-evidence-ledger ·
   how-our-base-rates-are-computed
M6 the-four-behavioral-taxes · journaling-and-the-pm-scorecard
Each lesson: 3–5 min · cites its Research Report Part 4/5/6 rows · evidence grade shown ·
2–3 retrieval questions in frontmatter · mechanical-honest voice · no live prices.
```

### I · Glossary seed terms (40)

ticker · bid–ask spread · market order · limit order · pre-market · after-hours · gap · RVOL · breadth · advance/decline · 50-day average · 200-day average · golden cross · RSI · MACD · ATR · Bollinger bands · 52-week high · base rate · reference class · confidence interval · Wilson interval · always-up baseline · tendency tiers · evidence grade · folklore · decay stamp · implied move · bmo/amc · FOMC · CPI · jobs report · VIX · drawdown · expectancy · half-Kelly · Brier score · calibration · paper trading · slippage.

### J · Copy deck (canonical strings — use verbatim; the full deck lives at `app/lib/copy.ts`)

| Key | String |
| --- | --- |
| baseRate.sentence | “In the past {years} years, this pattern appeared {n} times on {refClass}. Price was higher {h} trading days later in {wins} of {n} cases ({pct}).” |
| baseRate.insufficient | “Insufficient history (N = {n}) — treat as anecdote.” |
| baseRate.baseline | “Unconditional {h}-day up-rate ≈ {pct} — read this against that baseline.” |
| tier.actions | strong → “worth a closer look” · moderate → “note it; check the weakeners” · weak → “watch only” (bands: Appendix F) |
| volband.label | “In the past, 8 in 10 {h}-day paths from here stayed inside this range.” |
| volband.caveat | “Ranges assume the recent regime holds — sudden stress can exceed them.” |
| mover.noNews | “No news found — most moves this size have no identifiable cause; likely noise.” |
| calendar.noEdge | “No clear edge either way — that is a valid outcome.” |
| brief.unavailable | “Briefing unavailable tonight — scan results below are complete and verified.” |
| offline.ribbon | “Offline — showing the last synced briefing ({date}).” |
| scope.line | “A tendency, not a prediction.” |
| decision.disclaimer | “Historical tendency — verify before acting.” |
| coolingOff.body | “You are entering a paper trade within {min} minutes of seeing this signal. The historical base rate is {rate} with the interval shown; costs are certain. Proceed, or sit with it until tomorrow’s brief?” |
| brier.anchor | “0.25 = coin flip” |
| attribution.fred | “This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.” |
| degraded.source | “{source} unavailable tonight — this section is running without it.” |
| save.offline | “Reconnect to save.” |
| update.ready | “Updated — refresh when convenient.” |

### K · CLAUDE.md template (initialize verbatim at P0, then maintain)

```
# myStockMarket — constitution
Single-user US-equities command center + learning hub. Next.js 16 app (app/) + Python pipeline
(pipeline/) + two GitHub Actions jobs. Executor: Claude Opus 4.8. Contract: DEVELOPMENT-PLAN.md.
Authority: RR Part 8/9 > Blueprint > plan > DECISIONS.md > judgment. Evidence chapters win.

## Non-negotiables (full list: plan §1.5 — re-read weekly)
No directional forecasts; vol bands ≤ 20d + regime caveat · base rates = natural frequency + N +
Wilson CI, N-gated display · CI spanning always-up baseline ⇒ tier weak · new patterns need
t > 3.0 or a ledger grade · decay stamps · folklore labeled · insert-only
signal_log/resolution, misses public · no trending surfaces, no gamification · movers need a
catalyst or the noise line · LLM narrates, never computes; deterministic gate blocks unverified
numbers · Desk/Academy separated, doorways + return rails · calm tech: no motion on
probability/money visuals, timestamps everywhere · mechanical voice (copy.ts) · paper-first ·
login wall always (licensing) · TDD per plan §6.2.

## Commands
app:      npm run dev | test | typecheck | lint | build     e2e: npx playwright test
pipeline: uv run pytest      jobs: uv run python -m jobs.job_a (fixtures: MSM_FIXTURES=1)
db:       npx prisma migrate dev · npx prisma db seed        deploy: git push (Vercel auto)

## Conventions
Conventional commits · TDD-first list in plan §6.2 · numbers render ONLY via components/BaseRate
and lib/format · all copy from lib/copy.ts · tokens from globals.css @theme (plan §3) — never
ad-hoc hex · timestamps via lib/time.ts · adapters follow .claude/skills/new-provider-adapter.

## Session ritual
Start: git pull → read this + PROGRESS.md + LESSONS.md → diff DECISIONS.md (any non-[claude]
line = user veto, rank 2.5 — honor it FIRST) → run tests → announce checkpoint.
End: update PROGRESS.md → log DECISIONS/LESSONS ([claude]-marked) → push.
Phase exit: plan §6.4 gate → tag.

## Design one-liner
“Broadsheet Terminal”: ink, hairlines, 2px radii, mono numerals, one hero figure, two rooms
(cool Desk / warm Academy). If it could be a default template, it is wrong. Checklist: plan §3.10.
```

Development Plan compiled July 2026 for executor Claude Opus 4.8; revised after a five-lens adversarial review (stall-hunter, hidden-global-decision, PWA, design-collision, blueprint-fidelity). Companions: *Research-Report.pdf* (evidence + product) and *Build-Blueprint.pdf* (architecture + roadmap). The markdown working copy at `DEVELOPMENT-PLAN.md` is generated from these sources — regenerate with `docs/src/build-plan-md.py` after edits.

---

