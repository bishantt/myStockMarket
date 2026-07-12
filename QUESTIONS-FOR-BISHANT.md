# Questions & heads-ups for Bishan

Things I decided myself and kept going on are in DECISIONS.md. This file holds items I want
your eyes on: genuine questions, and judgment calls where you might want to veto. Nothing here
is blocking my work right now.

Format: newest first. I mark each as [FYI], [VETO?], or [NEED] so you can scan.

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
