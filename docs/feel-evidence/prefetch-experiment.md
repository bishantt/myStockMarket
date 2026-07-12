# P-3 — the prefetch experiment (F0, 2026-07-12)

**Question.** Does putting a `loading.tsx` on an ISR route DOWNGRADE its prefetch from "the whole
page" to "layout up to the first loading boundary"?

This mattered enough to measure, because the answer decides how F1 is built. If adding skeletons
everywhere quietly downgraded prefetching, then the skeletons would have been buying a nicer wait
by *creating* the wait — and the plan would have had to put `loading.tsx` only where a wait is
genuinely unavoidable (branch B).

**Why it could not be answered by reading.** The pinned framework's own bundled documentation says
both things, in two different tables, and never reconciles them:

| Source (`node_modules/next/dist/docs/01-app/02-guides/prefetching.md`) | What it says |
|---|---|
| "Prefetching static vs. dynamic routes" (line 24–31) | **Static page → Prefetched: "Yes, full route"**, client cache TTL 5 min |
| "Automatic prefetch" (line 52–57) | **With `loading.js` → "Layout to first loading boundary"**, TTL off |

A route that is static AND has `loading.js` sits in both rows. The docs do not say which wins.

**The method.** Two temporary probe routes were added to the real app and built with the real
production build (`next build --webpack`):

- `/probe/with-loading` — `export const revalidate = 600`, a `loading.tsx`, and a unique marker
  string (`PROBE_DEEP_CONTENT_MARKER_A`) rendered deep inside the page body.
- `/probe/without-loading` — the same, with no `loading.tsx`.

The build confirmed both as `○ ISR 10m`. Each route was then requested with exactly the headers
`next/link` sends when it prefetches — `RSC: 1` and `Next-Router-Prefetch: 1` — and the response
body was searched for the deep marker. If the marker is present, the browser has the whole page
before the tap. If it is absent, the prefetch stopped at the loading boundary.

**The result.**

| Route | Prefetch payload | Deep page content present? | Skeleton present? |
|---|---|---|---|
| `/probe/with-loading` | 5,898 bytes | **YES — full route prefetched** | yes |
| `/probe/without-loading` | 5,684 bytes | **YES — full route prefetched** | — |

**Verdict: BRANCH A.** A `loading.tsx` does not downgrade the prefetch of an ISR route. The static
row governs. The route with the skeleton prefetched its full content *and* carried its skeleton —
the skeleton is there for the case that actually needs it (a revalidation miss, or the first visit
after the nightly publish busts the path), and it costs 214 bytes to have it.

**What F1 does with this.** `loading.tsx` lands on every converted route per Appendix C. There is no
trade-off to manage: the reader gets the prefetched page instantly in the steady state, and gets a
skeleton instead of a frozen screen on the first tap after the ~8:40pm publish.

The probe routes were deleted after the measurement; they exist only in this record.
