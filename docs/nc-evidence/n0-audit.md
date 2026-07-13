# N0 — Ground truth: the tree as it actually is (2026-07-12)

The News & Control plan was written against a moving tree, while the app-feel build was still
running in another session. It says so itself, and it orders this audit: before touching
anything, check every claim the plan makes about the code, and write down where the plan and the
tree disagree. **Intent binds; details get re-mapped here.**

The short version: **the plan's diagnosis is correct on every point, and the audit found one
extra production defect the plan did not know about** (the Anthropic key, below). Nothing in the
plan needs re-writing. Two file references get sharpened.

---

## 1. The precondition

| Check | Result |
|---|---|
| `feel-final` tagged | ✅ `fb634f5` |
| CI green on that tag | ✅ `ci` — success |
| Working tree clean, `main` up to date | ✅ |
| App unit tests | ✅ 384 passed (43 files) |
| Pipeline tests | ✅ 214 passed, 19 skipped |
| Production deployment current | ✅ Ready, serving `fb634f5` |

N0 was clear to begin.

## 2. Part 1's claims, re-verified against the code

### 1.1 The Macro Pulse — **confirmed, all three defects**

- **The footer is a static string.** `components/desk/MacroPulse.tsx` renders
  `copy.macro.provenance` — the literal `"Index levels · FRED · prior close"` — unconditionally,
  no matter what the rows above it actually show. It is a sentence that cannot know whether it is
  true. (This is what ruling C6 exists to kill.)
- **The label says "ETF proxy" twice.** `lib/morning.ts` sets each slot's fallback label to e.g.
  `"S&P 500 · SPY (ETF proxy)"`, and then `MacroPulse.tsx` renders a *second*, freestanding
  `copy.macro.proxyChip` = `"ETF proxy"` chip underneath it. Both belts, exactly as the plan says.
- **The degradation is silent and fleet-wide.** Confirmed in production data — see §3.

### 1.2 Module 00 — **confirmed**

`app/(desk)/page.tsx` renders module 00 as a full `<Surface className="p-5 lg:col-span-2">`
carrying a `SectionMasthead`, one `StatFigure` ("Last cloud run"), and one fixed sentence
("Written by the nightly pipeline in the cloud — nothing runs on this device."). It spans the
full spread in first position. The plan's footprint complaint is accurate to the line.

### 1.3–1.5 — **confirmed**, no changes needed to the plan's reading.

## 3. Production, read-only (the probe that mattered)

`market_context` holds **exactly one row**, and it is the smoking gun:

```
run_date     sp500   sp500_prior   nasdaq   djia    vix     10yr
2026-07-11   NULL    NULL          NULL     NULL    15.84   4.54
```

`pipeline_run` for that night reports:

```
sources = {"fmp":"ok","fred":"ok","alpaca":"ok","finnhub":"ok","marketaux":"ok"}
```

**Read those two together.** Every index level is missing, VIX and the 10-year (also FRED) came
through fine, and the run still declares `fred: ok`. That is the exact failure the plan calls a
"silent fleet-wide fallback": the source footer cannot report a degradation it has no key for, so
the Desk quietly renders four ETF proxies under a footer claiming FRED index levels. The
screenshot the user sent is this row, rendered.

**Why the levels are NULL — and it is not a bug in the fix.** The R0 index-level fetch
(`_SP500_SERIES` and friends in `pipeline/jobs/job_a.py`) landed in commit `4a1c736` at
**2026-07-12 02:20**. The last pipeline run finished at **2026-07-11 19:33Z** — about seven hours
*earlier*. The code is correct; the data simply predates it, precisely as the plan reasoned. No
run has happened since, so **the heal has not yet been observed.** N1's gate is what confirms it.

The deeper point stands regardless, and is the whole reason N1 exists: *even after it heals*, the
next FRED index outage will be just as silent, because `sourceStatus` has no `fred-indexes` key
to go amber. Fixing the data does not fix the instrument.

## 4. A defect the plan did not know about (found by this audit)

**`ANTHROPIC_API_KEY` reaches neither nightly job.** The secret **exists** in GitHub (set
2026-07-10, alongside `MODEL_EXTRACT` and `MODEL_SYNTH`). But the `env:` blocks of
`nightly-a.yml` and `nightly-b.yml` do not pass it — and `job_a`'s `_build_submit_extraction()`
returns `None` when the key is absent, printing "skipping the extraction batch" and degrading the
briefing. So **every LLM stage has been silently skipping in production since P3**, and the
evening brief has been running without its extraction the whole time.

The plan anticipated the *wiring* (provisioning row P-3) but scheduled it for N4 and assumed the
question was whether the secret existed. It does. The fix is one line per workflow.

**Decision: this lands in N1, not N4.** N1 is the correctness phase and it already edits
`nightly-a.yml` (to add the 6:00am macro cron). A live production degradation with a two-line fix
does not wait three phases for a cosmetic reason. Logged in DECISIONS.md.

## 5. Provisioning probe (Part 0.3) — what exists tonight

| # | Provision | State | Consequence |
|---|---|---|---|
| P-1 | R2 media bucket (`R2_MEDIA_BUCKET`, `R2_MEDIA_PUBLIC_BASE`, `NEXT_PUBLIC_MEDIA_BASE`) | **absent** | N4 runs the image pipeline against local fixtures; cards render the L3/L4 designed fallbacks (first-class by design anyway). The feed ships. |
| P-2 | GitHub PAT (`GH_DISPATCH_TOKEN`, `GH_REPO`) | **absent** | N6's control room renders in its `not_configured` state, which says so plainly. Every other state is e2e-tested against a mocked GitHub API. |
| P-3 | `ANTHROPIC_API_KEY` | **PRESENT in GitHub — but not wired into the jobs** (§4) | Wiring lands in N1. |
| P-5 | `GOLDAPI_KEY` | **absent** | N3's gold cell renders its honest "not yet reported" state (C7 rung 4). |

Existing and reusable: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET`, `R2_BUCKET` (the history
lake). Whether that token is account-scoped — and so can write a second bucket — is untested; N4
finds out and falls back to fixtures if not.

**Nothing here blocks. Nothing here will block.** Every absent secret has a specced fixture path.

## 6. The instruments, as they stand (the numbers later phases need)

| Thing | Count | Note |
|---|---|---|
| Drift rules in `check-drift.mjs` | **18** (ids 1–18, no gaps) | This plan's new rules take **19, 20, 21…** |
| VRT baselines committed | **46** | Appendix F's shots add to this set |
| Desk modules | 00–07 + scorecard + sources footer | Module 00 retires in N2; module 08 (Front page) is born in N5 |

## 7. Where the plan's file references drifted

Only two, and both are trivial re-mappings — no intent changed:

| Plan says | The tree actually has |
|---|---|
| "`buildMacro` returns, alongside the slots, a provenance summary" (3.3) | `buildMacro` lives in `app/lib/morning.ts` and today returns `MacroView` with no provenance field. N1 adds it. The function is where the plan expects. |
| "`pipeline_run.sourceStatus`" (3.1) | Correct — `Json` column, per-provider map. The `fred-indexes` key slots straight in. |

`pipeline_run` has **no** `job` or `status` column (the audit probe guessed those and was
corrected by Prisma) — it is keyed by `runDate` with `stageStatus` / `sourceStatus` JSON. Any
later phase reading run state must use those.

## 8. One thing I could not do, and it is not a blocker

The plan asks for a **production screenshot** of the Desk. The app is login-walled (by design —
licensing), and the login credentials live only in Vercel's environment, not in the local `.env`.
So I cannot sign in to photograph it.

I did better instead: the SQL probe in §3 reads the *actual data* behind that screen, which is
what the screenshot was evidence *for*. The F-build's desktop spread is proven live by
`feel-final`'s green CI (VRT baselines are shot in CI, against the real build) plus a Ready
production deployment on that commit. Recorded as an [FYI] in QUESTIONS-FOR-BISHANT.md; if the
user wants app credentials in the local `.env`, screenshots become available.
