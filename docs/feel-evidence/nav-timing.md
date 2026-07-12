# B3 — soft-navigation timing (tab tap → destination visible)

Instrument: `e2e/nav-timing.spec.ts` (APP-FEEL-PLAN §5.4 budgets B3 + B5), phone project.
The BEFORE rows below were captured at F0, in report mode, against the un-cured app — a local
production build on the dev laptop, so the server latency is if anything WORSE than production.

Soft-nav CLS reads 0.000 throughout the BEFORE table, and that is not good news: with no loading
boundary anywhere, nothing renders until the whole page is ready, so there is nothing to shift. A
frozen page has perfect layout stability. The number becomes meaningful only once F1 gives the
reader something to look at while they wait.

| When (UTC) | Navigation | Median | Min | Max | All samples (ms) | Soft-nav CLS |
|---|---|---|---|---|---|---|
| 2026-07-12 11:17 | Desk → Scans | **1342ms** | 1336ms | 1347ms | 1347, 1347, 1342, 1342, 1340, 1346, 1336 | 0.000 |
| 2026-07-12 11:17 | Desk → Paper | **824ms** | 819ms | 1340ms | 1340, 832, 824, 819, 824, 829, 824 | 0.000 |
| 2026-07-12 11:18 | Desk → Track | **825ms** | 821ms | 1337ms | 821, 823, 825, 830, 830, 821, 1337 | 0.000 |
| 2026-07-12 11:18 | Desk → Academy | **827ms** | 818ms | 833ms | 826, 818, 833, 827, 832, 827, 831 | 0.000 |
| 2026-07-12 11:54 | Desk → Scans | **48ms** | 47ms | 814ms | 47, 814, 47, 813, 50, 48, 48 | 0.000 |
| 2026-07-12 11:54 | Desk → Paper | **43ms** | 40ms | 807ms | 43, 43, 42, 807, 40, 43, 43 | 0.000 |
| 2026-07-12 11:54 | Desk → Track | **45ms** | 30ms | 49ms | 49, 30, 46, 45, 49, 43, 42 | 0.000 |
| 2026-07-12 11:54 | Desk → Academy | **45ms** | 40ms | 49ms | 46, 45, 45, 40, 49, 42, 45 | 0.000 |
| 2026-07-12 11:58 | Desk → Scans | **51ms** | 33ms | 814ms | 58, 814, 41, 33, 53, 51, 48 | 0.000 |
| 2026-07-12 11:58 | Desk → Paper | **803ms** | 23ms | 823ms | 823, 806, 55, 803, 813, 23, 47 | 0.000 |
| 2026-07-12 11:59 | Desk → Scans | **55ms** | 30ms | 808ms | 55, 30, 72, 808, 65, 43, 30 | 0.000 |
| 2026-07-12 12:00 | Desk → Paper | **49ms** | 38ms | 811ms | 49, 51, 46, 48, 811, 38, 50 | 0.000 |
| 2026-07-12 12:00 | Desk → Track | **45ms** | 39ms | 48ms | 39, 39, 45, 41, 45, 48, 45 | 0.000 |
| 2026-07-12 12:00 | Desk → Academy | **45ms** | 38ms | 49ms | 46, 49, 45, 40, 49, 38, 41 | 0.000 |
| 2026-07-12 12:01 | Desk → Scans | **810ms** | 32ms | 819ms | 810, 44, 818, 32, 41, 819, 815 | 0.000 |
