# myStockMarket

A single-user US-equities command center and learning hub — a calm, editorial web app and
installable mobile PWA. After the market closes, a cloud pipeline ingests the day, computes what is
defensible, and publishes a verified evening briefing. It never predicts direction.

The look is "Morning Broadsheet": editorial serif over mono numerals, one light wash, glass cards,
bounded rooms, one tap to depth. Colour is scarce and always means something.

## Status

The core build is complete and running in production: the app (`app/`, Next.js 16) and the pipeline
(`pipeline/`, Python) are deployed behind a login wall, fed nightly by two GitHub Actions jobs.
Work now is polish, executed one phase per session under two plans —
CLARITY-AND-CADENCE (`cc-1`…`cc-10`) and LEAN-CODEBASE (`lc-1`…`lc-3`).

**The repository is public; the app is not.** Publishing the source says nothing about who may read
the Desk — the login wall guards the product and its data, not the code.

## What it will not do — the honesty principles

These are load-bearing, not marketing. The full list is in CLAUDE.md and DEVELOPMENT-PLAN §1.5.

- **No directional forecasts.** Volatility bands only (a ≤20-day window, with a regime caveat). The
  app never tells you where a price is going.
- **Base rates are honest or absent.** Every rate is a natural frequency carrying its sample size
  and a Wilson confidence interval, and it is withheld when the sample is too small to mean anything.
- **The language model narrates; it never computes.** A deterministic gate blocks any number the
  pipeline did not verify — an over-narrated draft is held, not published.
- **Misses are public.** The signal log is insert-only; a resolved signal that failed stays visible.
- **Nothing manufactures urgency.** No trending surfaces, no gamification, no streaks; probability
  and money figures never animate; timestamps are everywhere; the portfolio is paper-first.

## The documents

| File | Role |
|---|---|
| `CLAUDE.md` | The standing constitution — the rules every session obeys. |
| `DEVELOPMENT-PLAN.md` · `docs/Development-Plan.pdf` | The original executable build contract (phases P0–P6). |
| `docs/Research-Report.pdf` | Evidence and product design; Parts 8/9 are the top-ranked authority. |
| `docs/Build-Blueprint.pdf` | Architecture, stack, data plan, roadmap, risks. |
| `UI-REDESIGN-PLAN.md` · `APP-FEEL-PLAN.md` | The visual system, and the app's structure, layout and feel. |
| `NEWS-AND-CONTROL-PLAN.md` · `POLISH-AND-DEPTH-PLAN.md` · `GATE-EFFICIENCY-PLAN.md` | The later build phases and the CI reform. |
| `CLARITY-AND-CADENCE-PLAN.md` · `LEAN-CODEBASE-PLAN.md` | The two current polish plans. |
| `docs/src/*.html` | Grep-able sources of every PDF (`rr-*`, `bp-*`, `dp-*`, and the rest). |
| `PROGRESS.md` | The resumable checkpoint — read this first to orient any session. |
| `DECISIONS.md` · `LESSONS.md` · `PATTERNS.md` · `QUESTIONS-FOR-BISHANT.md` | The living memory: the decision log (and the user's veto channel), mistakes and their guards, reusable patterns, and open questions. |

Authority when sources disagree: Research Report Part 8/9 → Build Blueprint → Development Plan →
DECISIONS.md → judgment — except on looks, where UI-REDESIGN-PLAN.md wins (CLAUDE.md).
