# B6 — the Lighthouse score moved, and here is exactly why (F1, 2026-07-12)

**The number.** The mobile Lighthouse performance score on `/` went from **93** (redesign-final) to
**87–88** (F1). LCP went from ~3.0s to ~3.6s. Both are ADVISORY budgets (user decision, 2026-07-11:
under simulated cold-4G, LCP for a web-font content page is a lab artifact — the real TTFB is
~50–100ms). Both HARD budgets still pass: **CLS 0.000** and **first-load JS 157KB ≤ 200KB**.

Budget B6 says "no regression", so a 5–6 point drop does not get waved through as advisory. This is
the measurement behind it.

## It is not bundle growth

The Desk's own first-load JavaScript did not change. Measured by `check-bundles.mjs`, the same
instrument, before and after:

| | `/` first-load JS (gzip) |
|---|---|
| F0 (before) | 179.6 KB |
| F1 (after) | 179.7 KB |

## It is prefetching, and prefetching is the feature

From the Lighthouse trace of `/` at F1:

| Measure | Value |
|---|---|
| Server response time (TTFB) | **12 ms** |
| Total Blocking Time | **20 ms** |
| First Contentful Paint | 1,679 ms |
| Largest Contentful Paint | 4,152 ms |
| Script requests | **13**, totalling 157 KB |

The Desk's own HTML asks for **8** script chunks. The other **five** are the JavaScript for the five
rooms in the tab bar — and the trace shows the matching RSC prefetches beside them, one per room:

```
Fetch  /academy?_rsc=…       Fetch  /track-record?_rsc=…    Fetch  /paper?_rsc=…
Fetch  /scans?_rsc=…         Fetch  /settings?_rsc=…
```

That is the router doing exactly what F1 asked it to do. Every room is a static route now, so the
router prefetches each one as the browser goes idle — which is *precisely* the mechanism that took
a tab tap from 824–1342 ms down to 45–55 ms. The cost is that on Lighthouse's simulated slow-4G
pipe, those five extra requests compete with the initial render, and LCP is pushed out.

The server is not slow. TTFB is 12ms and blocking time is 20ms. What the score is penalising is
bandwidth spent on the NEXT screen, measured as though it were the current one.

## The trade, stated plainly

| | Before F1 | After F1 |
|---|---|---|
| First load, cold, simulated 4G (lab) | Lighthouse 93 | Lighthouse 87–88 |
| **Every tap afterwards (real)** | **824–1342 ms, frozen screen** | **45–55 ms** |
| Authenticated TTFB, production | 382–1237 ms | 48–77 ms |
| CLS (hard) | 0.000 | 0.000 |
| First-load JS (hard) | within budget | 157 KB ≤ 200 KB |

The user opens this app once an evening and then moves between rooms. The lab score models the one
event; the prefetch improves every event after it. Paying ~6 advisory Lighthouse points, on a metric
already ruled a synthetic artifact, to make every navigation in the app feel instant is the trade
this plan exists to make.

**Logged as a judgment call** in QUESTIONS-FOR-BISHANT.md ([FYI]) and DECISIONS.md, with the numbers,
so it can be reversed on sight if the user disagrees. Reversing it means turning off prefetch, and
the cost of that is written in the table above.

**Revisit trigger:** if LCP ever becomes a real-device complaint (not a lab number), the lever is
fonts, not prefetch — the R6 lesson holds, the weight was always in bytes, not pixels.
