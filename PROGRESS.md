# PROGRESS.md — resumable state

# PD8 IS **COMPLETE** — tagged `pd-8`, rehearsal green on the reshoot, all baselines explained.
**Fourteen tags.**

**Checkpoint: POLISH-AND-DEPTH-PLAN.md, PD8 (the SURFACES of Part 9 + Part 10) is DONE. Nothing is
blocked. Nothing is in flight.**

**NEXT: PD9 — Sheets, the detail overlay (Part 11).** PD8 unblocks it; PD9 is the LAST feature phase
before PD10 (hardening/docs). PD9 is an intercepting-routes phase: a story or ticker opens OVER the
app on mobile and dismisses back to exactly where the reader was.

## What PD8 did, in one paragraph

Depth arrives in two moves and the pipeline went first (PD7). PD8 is the second move: the surfaces
that speak it. The **story page v2** grew a ten-block anatomy — Context tonight (verified figures in
mono, glossary doorways ≤2), the snapshotted watch rows (each a door to the Desk calendar's day),
"what our record says" on the affected names, and a provenance footer that prints the models it
actually ran. Every block names its absence, read from `verification.sections`, and the old
`verification.dropped` boolean retired into one version-dispatching reader. The **feed byline** became
a real external door in its own footer box (E8), verified live in production. The **ticker page v2**
grew from two queries to six — an identity line, a 52-week strip, tonight's mention, the record here,
the calendar, the paper position — all from what the schema already serves. A non-served name renders
the honest subset. **Q-PD6-2 solved:** the touch sweep visits nc-fda-nonopioid now (real controls to
measure). The record layer is shared by both pages; the setup-card view builder is extracted once.

## The seven things a fresh session must know

1. **READ THE PROSE, and it is now a BROWSER assertion.** PD7 published a sha1 hash into a sentence.
   PD8 rendered the seeded surfaces and read them (all English, no hashes), AND pinned it:
   `news.spec.ts` fails if the story context ever contains `tkr:`/`cls:`/`cal:`. A green VRT tells you
   the pixels are stable; it does not tell you the sentence is English.

2. **The 52-week strip states its window HONESTLY.** "52-week range · {n} sessions" only at ≥240
   sessions, else "Trading range · {n} sessions". The seed's 22 bars read "Trading range · 22
   sessions"; production (252 bars) reads "52-week range · 252 sessions". This delivers the plan's
   strip as an explicit-window band — no seed bar bump (which would re-baseline the Desk's watchlist
   sparkline). DECISIONS logged.

3. **`verification.dropped` IS RETIRED.** `lib/news.ts:readSectionStatus` reads the per-section
   verdict and falls back to the old `dropped` flag ONLY for why_it_matters (the one field v1 knew).
   One reader with a version fallback, not two live readers. The seeded JPMorgan row (v1 gate-drop)
   still resolves to "dropped"; the fixture test proves it.

4. **The record layer is SHARED (lib/record + SymbolRecord).** Both pages ask "does our ledger hold
   evidence?" — one loader, one component. `buildSetupCardView` was extracted from lib/morning.ts, so
   the Desk reads it too. The setup card renders READ-ONLY off the Desk (its weakener writes are a
   Desk-scoped action; rendering them off-Desk revalidates the wrong path).

5. **Calendar day anchors are NEW.** CalendarTimeline stamps `id="cal-{iso}"` on the first visible
   row of each day; a story's watch rows link `/#cal-{iso}`. A hash link never 404s — a watch date
   past the Desk's forward window lands on the module without scrolling.

6. **The seed's coverage, confirmed empirically:** served (bars) = SPY/QQQ/DIA/IWM/AAPL/NVDA/MSFT
   (22 bars each); vol bands only AAPL (the Range Ladder); setup cards SPY/QQQ/SMCI; all 3 signals
   RESOLVED (no active signals in the seed); AAPL has an open paper buy. VRT targets: **AAPL**
   (served-full) and **SMCI** (non-served, which richly exercises the record block).

7. **Q-PD5-1's second half — the Desk BRIEF's KeyFigure — is DEFERRED (Q-PD8-1).** The story context
   honors E5 (via `sections.context.cleared`), but the Desk's evening brief is a surface outside
   PD8's Part 9.6/9.7/10 scope, and its own verification record may need the same `cleared` wiring.

## The gate at `pd-8`

- App unit tests: **710 → 733** (+23: v2 news readers, formatModel, computeRangeStrip, hasRecord,
  calendar-anchor, SymbolRecord + RangeStrip component tests). Pipeline: **576 + 35 skipped**
  (unchanged — app phase). New files: `lib/record.ts`, `lib/ticker-depth.ts`, `lib/setup-card-view.ts`,
  `lib/calendar-anchor.ts`, `components/SymbolRecord.tsx`, `components/news/StoryContext.tsx`,
  `components/ticker/RangeStrip.tsx`, `components/ticker/TickerBlocks.tsx` (+ their tests).
- Anti-drift: **28** (unchanged; RangeStrip joined P2_FILES). Rooms: **14**. e2e specs: **25**. Oracle
  legs: **4**.
- **VRT baselines: 83 → 91** — 8 new (news-story-dropped ×4, news-story-sparse ×2, ticker-thin ×2),
  21 re-shot (news feed byline, story anatomy repointed to nc-fda-nonopioid, ticker v2 blocks). All
  candidates diffed against committed; login-desktop (176px dither) and track-record-dark-desktop
  (0px) left alone as the CAMERA.
- **Bundles:** every route within slack, under the 200KB ceiling. `/news` 197.4 (baseline 195.1),
  `/news/[cluster]` 165.3 (161.6), `/ticker/[symbol]` 150.4 (148.5). Worst `/paper` 198.1 (shared-chunk
  drift, 1.9 under ceiling). Fonts pass, 317 KB headroom.
- **`check:live` — all 7 GREEN**, including the news bylines (20 outbound links in production), which
  closes one of pd-7's two pending live assertions. **`check:migrations` clean** — NO migration this
  phase. **Lighthouse:** CLS 0.000 hard gate holds (advisory perf re-sampled).

## The local harness (all works — use it)

Docker Postgres IS available on this Mac now (the daemon is running). The seeded browser suite:
```bash
docker run -d --name msm-e2e -e POSTGRES_PASSWORD=test -e POSTGRES_DB=msmtest -p 55434:5432 postgres:16
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest" DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy && npm run db:seed
export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9          # ALWAYS, before any run — reuseExistingServer will lie
npx playwright test --project=phone --workers=1 --ignore-snapshots e2e/news.spec.ts
```
PD8 ran this heavily — the touch sweep, the content assertions, and the read-the-prose dump all came
out of it, and none would have been catchable without it locally.

## Two local e2e failures that are NOT yours (both re-confirmed)

- **`scans.spec.ts:44`** — the thin-night database race (passes in isolation; CI gives each leg its
  own Postgres). Reran clean at pd-7's tag.
- **`settings.spec.ts:29`** — a local ISR-revalidation flake; fails on tagged green trees too.
- **grid.spec on mbp16** flaked ONCE at PD8's first rehearsal (the documented "measured 0/0 before the
  stylesheet applied" CSSOM race — it passed on desktop + wide, the identical ≥lg layout, so the code
  is fine). The reshoot rehearsal is the confirmation.
