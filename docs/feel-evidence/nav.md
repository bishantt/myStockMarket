# B2 — authenticated TTFB per product route

Probed against the production deployment with a minted session cookie.
Instrument: `scripts/check-nav.mjs` (APP-FEEL-PLAN §5.4 budget B2).

Warm median = samples 2–5. Sample 1 (cold) carries cold-function start plus a fresh cache MISS by
design; it is reported, never gated. The first table below is the BEFORE state, captured at F0 —
it reproduces the plan Part 1.4 diagnosis with the checked-in instrument.

`/scans/unusual-volume` answers 404 in the BEFORE table: the route does not exist until F3. It is
listed from the start so the family is never quietly missing from the probe set.

### 2026-07-12 11:00 UTC — authenticated TTFB (5 samples, https://mystockmarket-eight.vercel.app)

| Route | HTTP | Warm median (2–5) | Cold (sample 1) | All samples | x-vercel-cache | Region |
|---|---|---|---|---|---|---|
| `/` | 200 | **55ms** | 229ms | 229, 51, 58, 50, 74 | HIT, HIT, HIT, HIT, HIT | iad1 |
| `/scans` | 200 | **849ms** | 1010ms | 1010, 891, 887, 810, 722 | MISS, MISS, MISS, MISS, MISS | iad1 |
| `/scans/unusual-volume` | 404 ⚠︎ | **49ms** | 92ms | 92, 96, 51, 46, 44 | HIT, HIT, HIT, HIT, HIT | iad1 |
| `/paper` | 200 | **725ms** | 701ms | 701, 798, 698, 702, 747 | MISS, MISS, MISS, MISS, MISS | iad1 |
| `/track-record` | 200 | **717ms** | 926ms | 926, 717, 717, 720, 679 | MISS, MISS, MISS, MISS, MISS | iad1 |
| `/ticker/SPY` | 200 | **1097ms** | 1090ms | 1090, 1045, 1084, 1109, 1132 | MISS, MISS, MISS, MISS, MISS | iad1 |
| `/settings` | 200 | **564ms** | 511ms | 511, 530, 602, 548, 580 | MISS, MISS, MISS, MISS, MISS | iad1 |
| `/academy` | 200 | **406ms** | 1135ms | 1135, 383, 425, 387, 434 | MISS, MISS, MISS, MISS, MISS | iad1 |
| `/academy/review` | 200 | **410ms** | 407ms | 407, 409, 410, 411, 377 | MISS, MISS, MISS, MISS, MISS | iad1 |
| `/academy/reading-a-base-rate-sentence` | 200 | **461ms** | 444ms | 444, 412, 507, 420, 502 | MISS, MISS, MISS, MISS, MISS | iad1 |
| `/login` _(control)_ | 200 | 59ms | 177ms | 177, 65, 53, 44, 85 | HIT, HIT, HIT, HIT, HIT | iad1 |
| `/academy/glossary` _(control)_ | 200 | 54ms | 66ms | 66, 51, 73, 53, 55 | HIT, HIT, HIT, HIT, HIT | iad1 |

_A non-200 row is not a fast route — it is a route that served nothing. The gate treats it as a miss._

