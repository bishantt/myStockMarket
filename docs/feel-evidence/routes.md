# B1 — route serving modes

How each product route is served, read from the build's own prerender manifest.
Instrument: `scripts/check-routes.mjs` (APP-FEEL-PLAN §5.4 budget B1).

The first table below is the BEFORE state, captured at F0 before any route was touched.

### 2026-07-12 10:58 UTC — route serving modes (2 of 10 product routes cached)

| Route | How it is served |
|---|---|
| `/` | ISR 600s (prerendered) |
| `/academy` | **dynamic — re-rendered on every request** |
| `/academy/[slug]` | **dynamic — re-rendered on every request** |
| `/academy/glossary` | static (no revalidate) |
| `/academy/review` | **dynamic — re-rendered on every request** |
| `/paper` | **dynamic — re-rendered on every request** |
| `/scans` | **dynamic — re-rendered on every request** |
| `/settings` | **dynamic — re-rendered on every request** |
| `/ticker/[symbol]` | **dynamic — re-rendered on every request** |
| `/track-record` | **dynamic — re-rendered on every request** |
