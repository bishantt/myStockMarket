# B4 — first-load JavaScript per route

Gzipped, measured from each prerendered route's own `<script src>` set (exact) or from its
client-reference manifest (upper bound, for the on-demand families).
Instrument: `scripts/check-bundles.mjs` (APP-FEEL-PLAN §5.4 budget B4).

These are gzip numbers. Vercel serves brotli (~15% smaller), so they are NOT comparable to the
Lighthouse first-load budget — only to themselves, across commits.

### 2026-07-12 10:58 UTC — first-load JS per route (gzip)

| Route | gzip KB | Kind | Chunks |
|---|---|---|---|
| `/` | 179.6 | exact | 8 |
| `/academy` | 144.4 | upper bound | 10 |
| `/academy/[slug]` | 144.9 | upper bound | 11 |
| `/academy/glossary` | 169 | exact | 8 |
| `/academy/review` | 145.7 | upper bound | 11 |
| `/login` | 164 | exact | 6 |
| `/offline` | 162.9 | exact | 5 |
| `/paper` | 145.6 | upper bound | 9 |
| `/scans` | 142.4 | upper bound | 9 |
| `/settings` | 143 | upper bound | 9 |
| `/styleguide` | 162.9 | exact | 5 |
| `/ticker/[symbol]` | 193 | upper bound | 10 |
| `/track-record` | 142 | upper bound | 9 |
