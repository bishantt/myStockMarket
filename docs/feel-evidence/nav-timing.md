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
