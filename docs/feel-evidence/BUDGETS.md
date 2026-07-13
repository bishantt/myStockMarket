# The budgets, at `feel-final` (2026-07-12)

Every budget the plan named (B1–B6), with the instrument that measured it, the number before the
work started, and the number now. Each row links to the running record beside it; nothing here is an
adjective.

| # | Budget | Instrument | Before (F0) | After (feel-final) | Verdict |
|---|---|---|---|---|---|
| **B1** | Every product route served from a cache | `check-routes.mjs` (reads the build's own prerender manifest) | **2 of 10** cached | **10 of 10**, allowlist empty | ✅ |
| **B2** | Authenticated production TTFB, warm median | `check-nav.mjs` (5 samples/route against the live deployment) | 382–1237 ms | **48–133 ms** (budget 150) | ✅ |
| **B3** | Soft-nav: tab tap → destination visible | `e2e/nav-timing.spec.ts` (phone, seeded, 8 samples/destination) | Scans **1342 ms**, Paper 824, Track 825, Academy 827 | Scans **280 ms**, Paper 202, Track ~130, Academy ~140 | ✅ |
| **B4** | Per-route first-load JS | `check-bundles.mjs` | `/ticker` **193 KB** | `/ticker` **145 KB** (the chart, code-split) | ✅ |
| **B5** | Layout shift, both regimes | Lighthouse (hard load) + a PerformanceObserver in `nav-timing` (soft nav) | 0.000 / not measurable | **0.000** hard, **0.000** soft | ✅ |
| **B6** | Perceived-instant sanity | Lighthouse, mobile, authenticated | perf 93 · a11y 93 | perf **86** · a11y **100** · CLS 0.000 · JS 165 KB | ⚠️ see below |

## The one that is not a clean tick, stated plainly

**B6's advisory performance score fell from 93 to 86, and that is a trade this plan made on purpose.**

The Desk's own JavaScript did not grow. Its server answers in 12 ms and it blocks the main thread for
20 ms. The score moves because the app now **prefetches the five tab rooms while the browser is
idle** — which is precisely the mechanism that took a tab tap from 824–1342 ms down to 45–55 ms. The
lab test measures one cold load and counts the bandwidth spent on your NEXT screen against your
current one.

Both HARD budgets still pass: **layout shift 0.000** and **first-load JS 165 KB** against a 200 KB
budget. LCP was already ruled a synthetic-4G artifact by the user (DECISIONS, 2026-07-11).

Full numbers and the reversal cost: `lighthouse-tradeoff.md`. Flagged [FYI] in
QUESTIONS-FOR-BISHANT.md — it is one line to reverse, and the cost of reversing it is written there.

## The one that got better without being asked

**Accessibility: 93 → 100.** The axe sweep at F7 found a link nested inside a button (unreachable by
keyboard), a scroll region with no keyboard access, and 58 nodes of information rendered in a colour
the design system reserves for placeholders. All fixed. One residual finding — `muted` on glass —
is recorded in `accessibility.md` and logged as [NEED], because the palette is not this plan's to
change.

## Where each record lives

| File | What it holds |
|---|---|
| `routes.md` | B1, every run, before and after |
| `nav.md` | B2, the full TTFB tables with cache verdicts |
| `nav-timing.md` | B3/B5, every sample of every soft navigation |
| `bundles.md` | B4, per-route first-load JS |
| `prefetch-experiment.md` | The measurement that decided F1's shape |
| `lighthouse-tradeoff.md` | Why B6 moved, with the trace |
| `accessibility.md` | The axe findings, fixed and outstanding |
| `desk-height.md` | The phone Desk: 5,041 → 4,319 px, and why not further |
