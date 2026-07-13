# Questions & heads-ups for Bishan

Things I decided myself and kept going on are in DECISIONS.md. This file holds items I want
your eyes on: genuine questions, and judgment calls where you might want to veto. Nothing here
is blocking my work right now.

Format: newest first. I mark each as [FYI], [VETO?], or [NEED] so you can scan.

---

## 2026-07-13 — N3 (the macro board)

**[NEED, cheap and it unblocks a whole cell] The gold price needs a free API key, and until it
lands that cell says "not yet reported".** Sign up at goldapi.io (free tier, no card — they advertise
~500 requests/month and we would use about 30), then add it to this repo's GitHub secrets as
`GOLDAPI_KEY`. That is the entire job. I verified the endpoint is real and reachable — it answers an
unkeyed caller with a plain "No API Key provided" — so the moment the secret exists the cell fills in
on the next nightly run with no code change at all. **Nothing is blocked**: the board ships with gold
rendering its honest empty state, which is the truth about what we currently know.

I want to be straight about one consequence. Because I have no key, I could not record a real
successful response from that provider — so the gold parser is currently tested against GoldAPI's own
published documentation rather than against GoldAPI. The fixture is named `xau_usd_UNVERIFIED.json` so
that nobody, including me in six weeks, can mistake it for evidence. When the key arrives that becomes
a real recording and the UNVERIFIED file is deleted.

**[FYI] I found three fake test fixtures in your repo, and they had been passing for three phases.**
The R0 phase needed FRED's index-level responses and, instead of recording them, wrote them by hand in
the shape of a real response with plausible-looking numbers. The giveaway was that the fake claimed the
S&P series has 8,000 observations (it has 2,610) and put the index at 6,812 (it was 7,575). Nothing
broke — the parser works on real data too — but for three phases those tests were proving that the code
agreed with my own imagination rather than with FRED. All three are real recordings now. The rule I have
adopted: **a fixture that was not recorded must say so in its own filename.**

**[FYI] Your Desk grew on the phone, and I want you to know the number.** The macro board adds five
new figures, so the phone Desk is taller than it was. My first attempt was much worse than it needed to
be: I put the Mood gauge on the same horizontal shelf as the four stats, and because a shelf stretches
every card to the height of its tallest, the four short cards got padded out with about 200 pixels of
white space each. Every test passed. I only caught it by looking at the screenshot. The gauge sits
below the shelf now, full width, where it reads as what it is.

**[FYI] A falling mortgage rate was showing up in red.** Every delta in this app is coloured by
direction — up is green, down is red — which is exactly right for a stock and exactly wrong for the
price of housing money, where falling is the best news on the board. The household-cost deltas render in
plain ink now. Gold keeps its colour, because gold really is a market price.

**[FYI] The Mood gauge is ours, it says so, and it is not a signal.** There is no legitimate
fear-and-greed index anyone can license — CNN publishes no API and the endpoint everyone scrapes is an
internal, bot-blocked feed. So the gauge is computed here, from five inputs the pipeline already holds,
and the number never appears without the full breakdown that produced it. It carries the line "Context,
not a signal — no tendency evidence attaches to this number", because nothing in this app has ever
measured what a reading of 42 is followed by, so nothing in this app claims it.

---

## 2026-07-13 — N2 (windows, density, the grid)

**[FYI] Your production database was missing a migration, and nothing could tell you.**
N0 wrote a migration (five new tables and one column), committed it, and every CI run since has
been green. **Production never received it.** The reason is worth knowing, because it is not a
mistake anyone made twice: CI spins up a *brand new, empty* Postgres on every run and migrates it
from zero — so a green pipeline proves the migration *works*, never that it was applied to the
database your app actually reads. Vercel's build ran no migration step at all.

Nothing crashed, which is why it went unnoticed: the app catches a database error and degrades to
its honest empty state (by design — that is what lets CI build with no database at all). So the
Macro Pulse just quietly fell back, night after night, which is the exact disease this plan was
commissioned to end. **I applied the migration** (additive only — five CREATE TABLEs and some new
columns, nothing dropped) and verified it against the live database. Two guards now: your deploy
runs the migration before it builds, and `npm run check:migrations` fails before a push if the
database is behind. Nothing needed from you.

**[FYI] The Desk got 208px shorter on your phone, and nothing was removed.** 3,212px → 3,004px,
measured the same way against the same database, minutes apart. Module 00's card is gone; the strip
that replaces it says *more* than the card did (which session you are reading, when the pipeline
wrote it, when the next edition lands) in one line instead of a card. Evidence:
`docs/nc-evidence/n2-footprint.md`.

**[FYI] Your app now has one red thing in it, and only one.** A dead pipeline — two or more
sessions with no run — puts a red banner across the top of the Desk that you cannot dismiss, saying
what every number on the page actually is. That is the only red in the application, enforced by a
build rule, because the value of that banner is entirely in its scarcity. A stale-but-not-dead
pipeline gets amber. A healthy one gets one quiet grey line.

**[VETO?] `/settings` now lays its three cards out two-up on a wide screen** (add-a-name and theme
side by side, watchlist spanning below). The DOM order changed from add → curate → look to add →
look → curate so that the tab order still matches the reading order. If you preferred the old
single column, it is a one-line revert.

**[FYI] First-load JavaScript grew ~5.4KB on every room.** The freshness strip has to run in your
browser (if it ran on the server it would be graded with the *cache's* clock, and a pipeline that
died overnight would still show as "fresh" on your first load next morning — the one thing it
exists to prevent). That is the cost. Every room is still under the 200KB budget; the worst is
/paper at 194.7KB. I also *armed* that 200KB ceiling, which had never actually been enforced — only
"don't grow more than 10KB since last time" was, and that kind of budget dies by a thousand honest
increments.

---

## 2026-07-12 — the news & control build (N0–N7)

### The one decision that is actually yours

- **[NEED — proceeding on the plan's default, marked and cheap to flip] Where does the News room
  live?** This is Part 0.1 of the plan, and it is the only choice that amends a standing decision of
  yours (D2: a five-room tab bar — Desk, Scans, Paper, Track, Academy).

  **I am building option A: a sixth tab.** The bar becomes Desk · News · Scans · Paper · Track ·
  Academy. At 390px each tab is ~65px wide, above the 44px minimum, and the 10px labels stay
  legible. Reasons: you commissioned News as a *first-class* section; both reference apps you sent
  put News in the bottom bar; and the Desk's bounded "Front page" preview module ships either way.

  **The cost, honestly:** iOS convention tops out at five tabs, so this spends the comfortable
  maximum plus one. If you'd rather keep five, say so and News goes behind a Desk doorway instead —
  **it is a one-file change (`TabBar.tsx`) and nothing else in the plan moves.** The wiring lands in
  N5, so there is time.

### A production bug the audit found — you should know about this one

- **[FYI] Your evening briefing has been running without its AI extraction since P3, silently.**
  `ANTHROPIC_API_KEY` is set correctly in GitHub — you provisioned it on 2026-07-10. But neither
  nightly workflow ever *passes* it to the job, and the pipeline is written to degrade quietly when
  the key is absent: it prints "skipping the extraction batch" and carries on. So the key has been
  sitting there, correct and unused, and the brief has been assembling without the stage that reads
  the articles.

  It is a two-line fix (one `env:` line per workflow) and it lands in N1. Nothing was lost — the
  facts always published; only the LLM narration was missing. But it is worth knowing that a
  "degrade gracefully" path degraded for four days without anyone being told, which is precisely the
  disease this plan's Part 1 is about.

### What I still need you to provision (nothing is blocked)

Every one of these has a fixture-backed path, so the build runs to completion without them. Each
feature flips live the moment its secret lands, and I log the flip.

| # | What | For | Until it lands |
|---|---|---|---|
| P-1 | **A public R2 bucket for article images** (suggest `msm-media`) + a public base URL, on the Cloudflare account you already have. GH secrets `R2_MEDIA_BUCKET`, `R2_MEDIA_PUBLIC_BASE`; Vercel env `NEXT_PUBLIC_MEDIA_BASE`. Your existing R2 token works if it is account-scoped. | N4 — cached article photos | The image pipeline runs on fixtures and cards render the designed fallbacks (which are first-class by design, not failure states). The feed ships and looks right. |
| P-2 | **A fine-grained GitHub PAT**, `actions: read+write`, this repo only. Vercel env `GH_DISPATCH_TOKEN`, `GH_REPO`. | N6 — the control room's run buttons | The panel renders in its "not configured" state, which says plainly that the token is absent. Every other state is tested against a mocked GitHub API. |
| P-5 | **A GoldAPI key** (goldapi.io — free tier, no card). GH secret `GOLDAPI_KEY`. | N3 — the gold cell | The gold cell renders "not yet reported", honestly. (The seed already carries gold as a stale cell, so you will see what that looks like.) |

`ANTHROPIC_API_KEY` (P-3) is **already provisioned** — see the bug above; it just needed wiring.

### Heads-ups, no action needed

- **[FYI] I cannot take production screenshots.** The plan's N0 asks for them. The app is
  login-walled (by design — licensing), and the app's own username/password live only in Vercel's
  environment, not in the local `.env`. So I have no way to sign in. I did better instead: I read
  the production database directly (read-only) and put the actual rows in
  `docs/nc-evidence/n0-audit.md` — which is what the screenshot would have been evidence *for*. If
  you want screenshots to be possible later, drop the app credentials into the root `.env`.

- **[FYI] The Macro Pulse bug you screenshotted is confirmed, and it is not what it looks like.**
  Your production database holds exactly one `market_context` row, and its three index levels are
  NULL while VIX and the 10-year (also FRED) came through fine — and the run still recorded
  `fred: ok`. The R0 fix that fetches true index levels is correct and is in the tree; it landed at
  02:20 on 2026-07-12, about seven hours *after* the last pipeline run. So the code is right and the
  data simply predates it. **But the deeper bug is real and is what N1 fixes:** even after it heals,
  the next FRED index outage will be just as silent, because the run has no way to say "the index
  levels are missing tonight". Fixing the data does not fix the instrument.

---

## 2026-07-12 — the app-feel build (F0–F7)

### RESOLVED — you approved this, and it turned out I had the diagnosis half wrong

- **[DONE, was NEED] Grey text on glass.** You approved darkening `--color-muted`. Doing it properly
  meant measuring it properly, and the measurement changed the story — so here is what was actually
  true, because part of what I told you was not.

  **What I told you:** 58 nodes failing, every glass card, both themes, a broken palette.

  **What was true:** the 58 was an artifact of my own test. Every page in this app fades in, and axe
  composites a text colour through any ancestor's transparency — so it was measuring the page *while
  it was still fading in* and reporting the colours of a half-transparent screen. Those are not
  colours anybody ever reads. Wait for the fade to finish and the 58 collapse to **one** real
  finding.

  **The one real finding is exactly the one you approved, and it was a genuine bug:** `--color-muted`
  was verified at 4.83:1 against the PAPER — but muted text almost never sits on the paper, it sits
  on a translucent card, which composites to `#f0effe`. Against what you actually look at, it
  measured **4.48:1**. It missed the readability floor by two hundredths, on the only background that
  counts. It is **`#676577`** now — **4.99:1** on the glass. A shade darker, nothing else moved.

  **Midnight needed it too — and I told you it didn't.** I first reported that Midnight already
  cleared the floor and left it alone. That was measured against the standard card (5.00:1, true) by a
  survey I had run **on the desktop project only** — and the phone Desk's shelf cards are *raised*,
  where the same grey measures **4.44:1**. I measured half the app and called all of it clean. CI
  caught it. Midnight's grey is `#9c99b1` now: **5.10:1** on the lightest card it ever sits on. Both
  themes clear the floor against their worst background, which is the only version of the question
  worth asking.

  **The gate holds the full line now.** Colour contrast is back in, nothing is excluded, and the sweep
  runs in **both themes and both device sizes** (42 checks, green) — which is what would have caught
  my own mistake. Numbers and the full story: `docs/feel-evidence/accessibility.md`.

- **[FYI] One thing fell out of fixing that: the settings room is no longer cached, on purpose.** The
  contrast work made a latent bug reproducible — add a name to your watchlist, click Focus, and the
  row could *vanish*, because the page you got back was the cached copy from before your click. The
  rule that came out of it: **a page may be cached, or it may be written to and read back in the same
  click — not both.** Settings is the only room in the app that is a writer rather than a reader, so
  it renders on request now. It is the one entry in the routes allowlist, with its reason written
  down, and the guard still fails the build for any other route that tries the same flag. B1 reads
  "10 of 11 cached" instead of "all of them", and that is the honest number.

### Still yours to close

- **[PENDING YOUR VERIFICATION] The iOS device checklist — you said you would run this one.** The plan's F7 calls for a manual pass on a real
  iPhone — shelf momentum, the combobox under the keyboard, double-tap on a sort header, the rail
  sheet's home-indicator band — in both mobile Safari and the installed app. I have no device. Every
  item is covered by the automated matrix as far as Chromium/Pixel-7 can cover it, and the specific
  iOS hazards are handled in code with the reasons written down (the mask lives on the shelf's
  non-scrolling wrapper; the combobox dismisses on `pointerdown` because iOS sends no click; the
  listbox caps at five rows because the keyboard leaves ~330px; `touch-action: manipulation` on every
  double-tappable control; the rail sheet has its safe-area inset). **This gate stays open, pending
  your verification — not mine.** I am not closing it on your behalf and I have not marked it passed.


Nothing here blocks me. I have made the most reasonable call on each item, marked in the code and
in DECISIONS.md what was built on that assumption, and kept going — per your standing directive.
A veto of any one of these changes only its own sections; none of them ripple.

### The three judgment calls I would most like you to check

- **[VETO?] Horizontal swipe is not "motion" (plan Part 0.4, ruling M3).** The constitution says
  probability and money figures never move. I have read that as a rule about the UI moving things
  by itself, not about the reader moving the paper: the page already scrolls vertically past every
  money figure and nobody has ever read that as the number moving. So a *shelf* — a swipeable rail
  of figures, used once, for the macro pulse on phones — is allowed to hold money figures. It may
  never autoplay, auto-advance, or animate itself; those are all banned by grep. **If you disagree,
  say so and the pulse figures go back to their grid at every width — it is one table row in §4.1
  and nothing else in the plan moves.**

- **[VETO?] The paper ticket pre-selects NO side (Part 0.5, ruling M9).** Buy/Sell becomes a
  two-button control with neither pressed. Every other field keeps a sensible default, because
  every other field is a parameter — side is the *decision*, and the old form quietly defaulted it
  to "buy" on the one surface whose entire design (cooling-off, cost mirror) exists to slow that
  decision down. **This changes current behaviour**, so it gets a veto line. Cost if you disagree:
  one tap per trade, and restoring it is one line.

- **[VETO?] A "Practice on paper →" link on expanded setup cards (Part 0.7, ruling M10).** This is
  the biggest philosophy call of the three, so here is the honest case both ways. Against: it is the
  app's first one-tap path from an evidence surface (which has just shown you a base rate) to an
  order ticket, and it sits at the moment of maximum conviction. For: the cooling-off interstitial —
  built, tested, and protective — currently has NO producer at all. Nothing in the product
  constructs the URL that fires it; only the e2e test does. Today's organic path (setup card → tab →
  ticket) reaches the same ticket with no cooling-off whatsoever. The link carries the
  `signalViewedAt` timestamp, so it is the one path that actually *arms* the protection. It is
  strictly more protective than the walk it replaces. Four conditions bind it (M10): paper room only,
  timestamp always carried, no side default at the destination, and a plain mechanical label — never
  a button. And its boundary bites: mover rows and scan-table rows get no such link, ever, because
  they are filter hits with no base rate and no weakener list. **Veto and the link disappears; M10
  stays on the books as the rule that would govern any future attempt.**

### Heads-ups, no action needed

- **[FYI] A near-miss worth knowing about, because it explains why the gates exist.** F3 shipped the
  scans table with `dynamicParams = false` — the obvious way to say "there are exactly five scans".
  It turns out that any `revalidatePath(path, "layout")` call wipes that route's list of valid
  parameters, and every URL in the family then returns 404 **permanently, until the next deploy**.
  Two things in the app called it: the theme control (since P6) and the watchlist (since F1). So the
  first time you changed your theme, every scan table in the app would have vanished, and nothing
  would have brought them back except a redeploy. CI caught it — a visual-regression baseline came
  back as a photograph of the 404 page — and I reproduced it locally in two commands. There are now
  no layout-scoped revalidations anywhere in the app, and a drift rule fails the build if one comes
  back.

- **[FYI] Unknown tickers return HTTP 200 instead of 404.** A side effect of the speed layer: an
  ISR-cached `notFound()` serves the "this page could not be found" page with an OK status. You still
  SEE the right page — it is a wrong status code, not a wrong screen — so I have not spent a phase on
  it. `/scans/garbage` returns a real 404 because that route declares its closed set. Noted here so
  it is on the record rather than a surprise.


- **[FYI] The Lighthouse performance score on the Desk went from 93 to 87, on purpose, and I want
  you to know before you see it.** It is the ADVISORY score (the one you already ruled a synthetic
  artifact on 2026-07-11, because it models a cold load on throttled 4G). Both HARD budgets still
  pass: layout shift is 0.000 and first-load JavaScript is 157KB against a 200KB budget. I measured
  the cause rather than guessing at it (docs/feel-evidence/lighthouse-tradeoff.md): the Desk's own
  JavaScript did not grow at all (179.6 → 179.7 KB), the server answers in 12ms, and the page blocks
  the main thread for 20ms. The score drops because the app now **prefetches the five rooms in the
  tab bar while the browser is idle** — and that prefetch is exactly what took a tab tap from
  824–1342ms down to 45–55ms. The lab test measures the one cold load and counts the bandwidth spent
  on your NEXT screen against your current one. My call: six advisory points is worth every tap in
  the app feeling instant. **If you disagree, say so — turning prefetch back off is one line, and
  the cost is that navigation goes back to being slow.**


- **[FYI] Pages will be served from a cache, up to 10 minutes stale.** Every read route moves to
  ISR (revalidate 600s) — that is what takes the app from ~400–1340ms per tap to ~50ms. The honesty
  contract (ruling M5) is that every module already prints its own as-of timestamp, the data only
  changes once a night, and the nightly publish actively busts every cached page. **The one regime
  worth knowing about:** right after the ~8:40pm publish, your first tap into each room pays one
  regeneration (roughly 400–900ms, with a skeleton rather than a frozen screen). Every tap after
  that is instant. I measure that first-tap case explicitly and record it, rather than quoting you
  the flattering steady-state number alone.

- **[FYI] A new route exists: `/scans/[preset]`.** The "+123 more" on the scans page was never
  clickable, and 1,825 matches were unreachable on the night the pipeline first ran. Each preset now
  gets its own page with the full match set as a sortable, paginated table — every match reachable
  up to a stated 500-row cap (above it, the cut is named and sorting is disabled, because sorting a
  silent subset is an unlabelled ranking). Logged as a route-map amendment.

- **[FYI] The seeded test data grew a lot.** 52 scan matches across the presets (one preset seeded
  deliberately EMPTY, so the "0 matches today — that is information" state is actually tested), and
  six paper trades. This is test/dev data only — the seed still refuses to run against Supabase.
  Your Desk will show eight movers instead of three in the seeded screenshots; production is
  unaffected, since it reads the real pipeline.

---

## 2026-07-11 — UI redesign plan ("Morning Broadsheet")

The four blocking items below were **all answered on 2026-07-12**; the plan (Part 0), the
constitution docs, and the PDFs are reconciled to the answers. Nothing here is open.

- **[RESOLVED 2026-07-12] D1 — Theme.** User chose neither offered option: **one theme
  app-wide** — dark means the ENTIRE app is dark (Academy included), light means all light,
  one setting. The "Academy stays light / dark is Desk-only" rule is repealed (docs amended
  with dated notes; supersedes the RR §9.7 positive-polarity rationale). Rooms stay distinct
  via structure/type/spacing within the active theme.
- **[RESOLVED 2026-07-12] D2 — Mobile navigation.** Bottom tab bar, as recommended.
- **[RESOLVED 2026-07-12] D3 — Wordmark.** Keep "myStockMarket" + adopt the gradient mark, as
  recommended.
- **[RESOLVED 2026-07-12] D4 — Rooms.** **Unify on lavender** — one palette everywhere; the
  Academy's identity is structural (solid cards, serif kickers, reading typography), never
  chromatic.

- **[FYI]** The aesthetic constitution was amended today per your directive: CLAUDE.md, plan §3
  (via dp-*.html + regeneration), and RR §9.7 (dated amendment callout) now all agree with
  UI-REDESIGN-PLAN.md; both PDFs re-rendered. Honesty rules untouched.
- **[VETO?]** Bug-fix directions chosen inside your either/or grant: Macro Pulse gets TRUE index
  levels from FRED (SP500/NASDAQCOM/DJIA) with the small-caps slot kept as an explicitly-labeled
  IWM ETF proxy (no free Russell 2000 series); the calendar gets a 7-release FRED allowlist
  (CPI, Jobs, PPI, GDP, PCE, Retail, FOMC) + earnings. Details: plan Part 6, Appendix C.

## 2026-07-11 — P4 (setup cards, base rates, track record)

- **[VETO?] Market regime split for base rates.** The plan says base rates are conditioned by
  "regime" but doesn't crisply define the regimes. I assumed a breadth dichotomy: **risk_on** when
  ≥ 50% of the universe is above its 50-day average on the event date, **risk_off** otherwise —
  matching the breadth-regime detector's 50% line. If you want a finer split (a neutral middle
  band, or a VIX overlay), that's a structural change I'll make on your word. Built on this
  assumption: `baserates.py` (`assign_regimes`), and every base_rate_stat row carries `regime`.

- **[VETO?] Base-rate universe scope.** For P4 the nightly computes base rates over the **served +
  watchlist** symbols' history (the ~15-20 symbols the user actually sees cards for), not the full
  ~13k universe. This is fast, and honest by construction — small N is suppressed by the N-gate and
  capped to WEAK — but the samples are thin, so most patterns will show "insufficient history"
  until the universe of interest and the Parquet lake grow. Computing base rates over the full
  universe's historical replay (larger N) is a heavier nightly step I can enable if you want the
  broader market as the reference class. Logged in DECISIONS.md.

- **[FYI] Decay-note wording is my plain-English capture, not the RR Part 4 verbatim text.** The
  `pattern_meta` decay notes and evidence grades in `baserates.py` follow Appendix F's ledger
  summary (golden-cross weak / BLL 1992·STW 1999, 52w-high mixed / George–Hwang 2004, gap
  folklore, RSI weak, volume mixed / GKM 2001, breadth context-only). When the Research Report
  Part 4 text is to hand, the exact phrasing should be transcribed over my paraphrase.

- **[FYI] breadth-regime evidence grade.** Appendix F calls breadth "context-only", which isn't one
  of the four ledger grades (supported/mixed/weak/folklore). I graded it **weak** with a decay
  note saying it is market context, not a tradable edge. Tell me if you'd rather it render
  differently (e.g. a distinct "context" label).

## 2026-07-10

- **[RESOLVED 2026-07-11] LCP budget miss at phase-0.** You accepted it for P0 and asked me to
  "make it a real gate at P1." Done: the LCP ≤ 2.5s budget is now a HARD gate at the P1 exit —
  `scripts/lighthouse-check.mjs` already exits non-zero on an LCP miss, and P1 will not be tagged
  until LCP passes for real (P1 adds real content, so the measurement becomes meaningful and the
  actual LCP element can be optimised). Recorded in DECISIONS.md (2026-07-11).
  <details><summary>original [VETO?] context</summary>
  Every real budget passed at phase-0 (perf 90-95, a11y 100, CLS 0, JS 131KB, 12-17ms server);
  only LCP (2.8-3.4s, run-to-run variance) missed, as a synthetic cold-4G artifact on a
  contentless page — the app was already optimally built. You accepted this for P0.</details>

- **[CLOSED 2026-07-11] Optional cleanups — all resolved:**
  - **Supabase DB password rotation — DECLINED by Bishan (2026-07-11).** Keeping the current
    password. Closed; will not raise again.
  - **"My First Check" in healthchecks.io — DONE.** Bishan deleted it (2026-07-11). Closed.
  - **Connect the GitHub repo in Vercel — DONE.** Bishan connected it (2026-07-11); `git push`
    now auto-deploys. (I no longer deploy via the CLI.)
  - If you want me to run the healthchecks drill or Lighthouse locally in future, add
    HEALTHCHECKS_PING_URL + HEALTHCHECKS_API_KEY to the repo-root `.env` (Appendix D lists the
    API key as local too). For now I run those through GitHub Actions where the secrets live.

---

## 2026-07-12 — App feel plan ("A Broadsheet, Not a Receipt")

APP-FEEL-PLAN.md is authored and its Part 0 says "Decisions I need from you: NONE" — the
build can start at F0 without you. These are the three judgment calls closest to the line,
each decided and built-on-assumption per the standing autonomy directive; veto any of them
and only its own sections change.

- **[VETO?] User scroll is not "motion" (plan 0.4, ruling M3).** The one new horizontal
  rail (the macro-pulse figures on phones) contains money figures, and the stillness rule
  says probability/money visuals never move. My ruling: a scroll container is the reader
  moving the paper — the page already scrolls vertically past every money figure — so
  user-driven scrolling and its momentum/snap settle are sanctioned, while anything
  self-moving (autoplay, smooth-scroll, animation) stays banned and grepped. If you read
  the stillness rule more strictly, say so and the pulse rail becomes a static grid at
  every width (one table row changes).
- **[VETO?] The paper ticket no longer pre-selects "Buy" (plan 0.5, ruling M9).** Side
  becomes a two-button segmented control with NEITHER pressed; every other field keeps a
  sensible default. Reasoning: side is the decision itself, and a pre-selected buy is a
  quiet nudge on the one surface built to slow that decision down. This changes current
  behavior (the old dropdown defaulted to buy). Cost: one tap per ticket.
- **[VETO?] Setup cards gain a "Practice on paper →" doorway (plan 0.7, ruling M10).** It
  carries the signal-viewed timestamp, which finally makes your cooling-off interstitial
  fire on a real path (today literally nothing in the product produces it — only the e2e
  test does). It is also the app's first one-tap path from a signal card to an order
  ticket, so it is bound by four hard conditions (paper room only, timestamp always
  carried, no side default, mechanical unstyled label) and forbidden from surfaces without
  the full evidence anatomy (mover rows, scan rows). If a signal→ticket link feels wrong
  regardless of conditions, veto it; the interstitial then stays dormant until some other
  producer exists.

- **[FYI] Every read page becomes cached (ISR ≤10 min) with on-demand busting.** Your
  writes and the nightly publish refresh the right pages immediately; the honest edge case
  is stated in the plan (M5/§5.4): right after the ~8:40pm publish, the first tap into each
  room regenerates it — a skeleton, then content — and everything after is instant. The
  measured before/after: dynamic rooms today answer in 400–1240ms with a frozen screen;
  cached routes answer in ~50–70ms.
- **[FYI] `/scans` grows a sub-route per preset** (`/scans/unusual-volume` etc.) carrying
  the full match table — sortable, paginated, every match reachable; the dead "+N more" is
  gone. The route map amendment is logged and lands in the docs sync at F7.

## R0 — the two content fixes (2026-07-12)

- **[NEED — assumption made, not blocking] Every earnings row on the calendar renders as
  "medium" importance, never "high".** The redesign plan's rule (Appendix E-4) is: high if the
  reporting symbol is in the pipeline's *served core*, medium otherwise. I implemented exactly
  that — but the served core is today the four index ETFs and the eleven sector SPDRs, and an ETF
  does not report earnings. So the rule, as written, can never fire "high" for a real company:
  Apple's earnings render medium.
  **My assumption:** that is acceptable, and arguably right — it keeps the "high" marker reserved
  for the market-wide catalysts a beginner most needs to see coming (CPI, the jobs report, FOMC),
  which is the calmest reading of the design. The code says so plainly
  (`pipeline/catalyst_ingest.py`, `earnings_importance`).
  **If you want AAPL-style earnings marked high**, say so and I will pass the served symbol list
  (core + your watchlist, which the pipeline already reads for other purposes) into the catalyst
  ingest — a small, contained plumbing change, roughly an hour.

- **[FYI — no action needed] The seven FRED release names could not be verified against the live
  endpoint.** The plan asks the build to check each allowlisted release name once against FRED and
  log any mismatch here. There is no `FRED_KEY` in the repo-root `.env`, so I could not call the
  live API. What I did instead: the names come from FRED's own recorded release feed (the fixture
  in `pipeline/adapters/fixtures/fred/`), and matching is by **case-insensitive containment**, so a
  release FRED renames slightly ("Consumer Price Index" → "Consumer Price Index (CPI)") still
  lands. The FRED release *ids* recorded beside each entry are documentation only — nothing
  matches on them, so a stale id cannot silently drop a real CPI print.
  **When the FRED key lands**, I will run the one-time verification and report.

---

## After the redesign (2026-07-12) — three things for you

- **[FYI] The live calendar will still show noise until the next pipeline run.** The allowlist
  filters at the WRITE path, which is the right place — but the rows already in your database were
  written by the old ingest, so the Desk's calendar keeps showing "Coinbase Cryptocurrencies" until
  Job A next runs and replaces the forward calendar. Nothing to do; it cleans itself.

- **[FYI] Same for the Range Ladder on the ticker page.** The vol_band rows in your database predate
  the new `n` / `window_days` columns, and a band without its sample size does not render at all
  (deliberately — a range without its N is an assertion). So the ladder is currently invisible on
  /ticker/[symbol] and will appear after the next nightly run. You can see it now on /styleguide,
  which renders it on fixture data.

- **[NEED, low stakes] LCP is 3.09s against a 2.5s target, and it is the last thing not green.**
  Every other budget passes and passes well (performance 93, accessibility 100, CLS 0.000, first-load
  JS 128KB). LCP has been advisory since 2026-07-11 by your own call — it is a synthetic cold-4G lab
  artifact, and real TTFB is ~100ms. I cut two font weights at R6 and took it from 3.97s to 3.09s.
  **Getting under 2.5s from here means dropping a font family**, most plausibly Newsreader (the
  Academy's reading serif) — and I do not think that trade is worth it, because the Academy being a
  genuine reading room is a large part of what makes the two-room split work. Tell me if you disagree
  and I will do it.
