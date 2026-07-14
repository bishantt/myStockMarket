# PROGRESS.md — resumable state

# PD3 IS **COMPLETE** — tagged `pd-3`, CI green on the first try. **The hole is gone, and the oracle was caught defending a bug.**

**Checkpoint: POLISH-AND-DEPTH-PLAN.md, PD3 (Part 6 — the desktop grid contract v2) is DONE.
Nothing is blocked. Nothing is in flight.**

**NEXT: PD4 — the phone composition** (plan Part 7).

## What PD3 did, in one paragraph

The Desk had a hole in it. On a thin night — the briefing held, no setup cards — a short module dug a
dead acre of nothing into the middle of the app's main room, and the user found it by looking at his
own screen. **The two columns were ONE grid, and a grid row is as tall as its tallest cell**: the held
Brief shared a row track with the open Session Calendar, and the difference became empty space under
the Brief. Measured on the `pd-2` build at 1512: **334px**. The columns are two independently-flowing
stacks now, they share no tracks, and the same night measures **24px, 24px, 24px** — the designed
rhythm, and the page is 322px shorter. Then the guards, pointed at things they had never been asked
to look at, found **three more defects that had all been green** — including one that had been shipping
to production for months with the pixel oracle photographing it and passing it every run.

## The five things that are now true (a fresh session must know these)

1. **THE ORACLE WAS DEFENDING A BUG, AND THIS IS THE SHARPEST LESSON THIS BUILD HAS PRODUCED.**
   `/ticker` on a phone renders the **Range Ladder** — the app's central probability visual. Its
   sentences were coming out **one word per line**: "In / the / past, / 8 / in / 10 / 5- / day /
   paths / from / here / stayed / inside / this / range." `ticker-light-phone-linux.png` and
   `ticker-dark-phone-linux.png` were **committed photographs of that**, green, run after run, for
   months.
   > **A VRT baseline proves a page has not CHANGED. It does not prove the page was ever RIGHT.**
   > If the first baseline is already wrong, the oracle locks the bug in and *defends* it. Nothing
   > ever fails. PD2's law was "a baseline that is TOLERATED is still WRONG." **This is the harder
   > version: a baseline that is EXACT can still be wrong.**

   The cause: `flex-1` is `flex: 1 1 0%` — **a flex-basis of ZERO**, and a zero-basis flex item **can
   never cause its line to wrap; it can only be crushed.** Fixed with `min-w-[18ch]` (a flex item's
   min-width *does* participate in line breaking). **In a `flex-wrap` row, anything that must stay
   legible needs a `min-w-*`.** It surfaced only because PD3 moved a container 4px, which changed the
   styleguide's HEIGHT — and **a page that gets wider is not supposed to get taller**, so I looked.

2. **LAW 1 — the Desk's two columns flow independently, and the DOM price is real and is stated.**
   CSS can only group children that are **adjacent in the DOM**, and the ritual interleaves the
   columns — so a ritual-ordered DOM and column-grouped wrappers are **mutually exclusive, in any CSS
   that exists**. The DOM is now **main-then-rail at every width** (amendment 0.2.2's order); below
   `lg` the phone's ritual is restored *visually* with `display: contents` + `order`. **The residual
   cost: below lg a sighted keyboard user tabs main-then-rail while seeing the ritual — a WCAG 2.4.3
   divergence axe cannot see, because it is a comparison between two orders, not a property of one.**
   It is pinned by e2e so it cannot drift. **The alternative (a rail that row-SPANS the main column)
   is strictly worse — it brings the dead gap straight back, distributed.**

3. **LAW 2 — one empty state, one height, one component.** `components/EmptyModule.tsx`, policed by
   drift rule 24 (`min-h-` on any surface). `SetupCards` **lost its own empty branch** — six modules
   each inventing their own empty state is six heights nobody can hold to a budget. **The shimmer is
   gone:** a shimmer means "content is on its way", which is TRUE on an empty database and **FALSE on
   a thin night** where the run happened and nothing fired. 124px → 104px. And the copy now separates
   two facts that read the same before: *"Setup cards arrive with the nightly base rates"* (a
   schedule — **no timestamp**, because none exists) vs *"No setups fired tonight."* (a **finding**,
   so it takes the run's stamp). **Watch for `[]` being truthy** — that is how the old code walked
   straight past its own guard.

4. **TWO 44px DEFECTS THAT WERE GREEN.** The Desk's front-page headlines were a **23px tap target on
   a phone** and the sweep passed — because the sweep runs on **Linux**, where Playfair sets wider, the
   headline wraps to two lines, and two lines clear 44px **by accident**. On macOS/iOS metrics it fits
   one line. **So on the reader's actual iPhone it was under the floor the whole time.** Verified
   against `pd-2` rather than assumed. And `/academy/[slug]` was the one room in the manifest with an
   **empty `sweeps` list** — its "← All lessons" link was 17px while its identical twin on
   `/academy/review` has had a 44px box since it shipped. **Q-G3-2 is CLOSED.**

5. **THE 16-INCH LOCK, AND THE ARITHMETIC A FUTURE SESSION MUST NOT RE-DERIVE.** The `mbp16` project
   (1512×982) is the 4th oracle leg. But **1512 sits INSIDE the `desk:` band (1366–1535) and the
   container caps at 1360px — so 1366 and 1512 render an IDENTICAL 1296px interior** (measured, all 13
   rooms; only `wide` ≥1536 opens up, to 1436px). **The project does not buy a new layout map and it
   would be dishonest to say it does.** It buys: the night the bug happens on (the thin-night shot),
   the screen the reader actually uses, and the sideways-scroll sweep at 1512. That is why the
   manifest's new `mbp16` flag is **false for most rooms**.

## Gate size at `pd-3`

**25 drift rules · 83 VRT baselines · 24 e2e specs · 642 unit tests · 16 bundle baselines · 14
manifest rooms · 4 oracle legs · tag run 8 m 08 s.** Pipeline: 535 (504 + 31 skipped without Postgres).

Growth this phase, each with a reason (full detail in `docs/pd-evidence/pd3-grid.md`):
- **+2 drift rules (25)** — 24 = Law 2's `min-h` grep; 25 = `PageContainer` is the one door for the
  room measure (it had been written by hand in five files, and the styleguide was already out of step
  by 4px and nobody knew).
- **+1 e2e spec (24)** — `grid.spec.ts`, which measures **bounding boxes, not the DOM**. A DOM-only
  assertion would have passed happily through this entire rewrite while the screen showed something
  else — the old ritual test did exactly that.
- **+4 unit tests (642)** — EmptyModule's contract, and a guard that a room flagged for the 16-inch
  lock is actually *shot* at 16 inches.
- **+7 VRT baselines (83)** — the `mbp16` set, including `desk-thin-night`.
- **+1 oracle leg (4)** — `mbp16`. **Costs a runner, not wall-clock**: the legs are parallel and the
  exit still waits on `desktop`.
- **Bundles UNMOVED** — worst `/news` **196.3 KB**. Structure is not JavaScript.

## Production is green and watched

`npm run check:live` — **all six assertions pass** (1 PENDING, owed to PD8: the news bylines are plain
text because that feature does not exist yet). Needs `set -a; source .env; set +a`.

`check:nav`: every cached room **45–57 ms**, every sample a cache HIT. `/settings` 385 ms — the argued
writer-room exemption, unchanged. **Lighthouse: CLS 0.000 and first-load JS 178 KB (both HARD gates).**
Advisory perf **re-sampled four times before being explained**: 76 · 77 · 83 · 84, LCP 5.16 → 4.53 →
4.31 → 4.30 s. The first post-deploy sample is the cold outlier and the series converges as the
deployment warms; the spread is inside the documented ±10 band, bundles are byte-identical, and nothing
PD3 touched is on the critical path.

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Claude Code exports its own Node 20 into every shell; `check:fonts` then dies
  with a `globSync` export error. Not a regression. Prepend Node 24:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`uv run pytest` fails `test_missing_database_url_fails_loudly` if you sourced the root `.env`.**
  Not a regression. Run `env -u DATABASE_URL uv run pytest`.
- **The 29 Postgres-backed pipeline tests skip on this Mac — but they do NOT have to.**
  `docker run -d --name msm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=msm_test -p 55433:5432 postgres:16`
  then `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55433/msm_test" uv run pytest`.
- **⚠ NEW AT PD3 — the thin-night specs need ONE DATABASE PER PLAYWRIGHT PROJECT.** CI gives this for
  free (each matrix leg is its own runner with its own Postgres, `workers: 1`). **But `npm run
  e2e:local` runs EVERY project against the ONE local database in parallel workers** — the thin-night
  tests in desktop/phone/mbp16 will then thin it simultaneously and fight, and the symptom is a
  **duplicate-primary-key error inside the restore, which reads like a broken layout and is not.**
  Run one project at a time locally: `npx playwright test --project=mbp16`.
- **⚠ Running the e2e suite locally DIRTIES `docs/feel-evidence/nav-timing.md`** — `nav-timing.spec.ts`
  appends its samples to it. Those rows are this Mac under contention (bimodal, 30–830ms), not evidence.
  `git checkout -- docs/feel-evidence/nav-timing.md` before committing.
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. **Advisory perf varies ±10 — RE-SAMPLE before explaining a move.**
- **`/settings` answers in ~385 ms, every sample a cache MISS.** Correct — the app's one *writer* room,
  `force-dynamic` by design, with an argued exemption. Every cached room answers in 45–57 ms.
- **`nav-timing — Desk → Scans` on the phone leg is timing-flaky on a contended runner.** Read the
  samples before believing it; a real slowdown moves every one of them.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The path is proven working end to end. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. Not PD's; leave them.

## Open questions (none blocking — see QUESTIONS-FOR-BISHANT.md)

- **[VETO?] The phone login has no mark.** The brand panel is `hidden lg:flex`, so the 96px lockup is
  desktop-only and a phone sees no mark on the first page anyone ever opens. **PD4 owns the phone
  composition — this is the phase to decide it.** Two-line change.
- **[NEW, PD3 — WORTH HIS EYES] The Desk's phone tab order now differs from its visual order.** Forced
  by CSS (see #2 above); axe cannot see it; it is pinned by e2e. If Bishan wants the DOM to follow the
  ritual instead, the price is the dead gap coming back — they cannot both be had.
- **[NEW, PD3 — FYI] The pixel oracle can enshrine a bug.** `/ticker`'s phone baselines did, for months.
  **Any brand-new surface's FIRST baseline deserves eyes** — it is the only moment anyone will ever look
  at it with fresh judgement.
- **Q-G4-1 [VETO?]** PD5's movers delta chip carries `data-p2` (hover = opacity/underline only). **PD5
  has not started — nothing is built on it.**
- **Q-G3-2 — CLOSED at PD3.** `/academy/[slug]` is swept, and the sweep found a real 17px defect on its
  first run.
- **Q-N6-1 · Q-PD0-1 — CLOSED at PD1.** Q-PD0-2 · Q-G2-1 · Q-G4-2 · Q-G3-1 · Q-G3-3 · Q-G3-4 · Q-G2-2 —
  all decided, no action needed.
- **[FYI] `e2e/briefing.spec.ts` never cleans up its journal entry.** The camera looks away
  (`Disclosure`'s `maskCount`). The deeper fix needs a journal delete path — a feature, not a test fix.
- **[FYI] Bishan's logo file has painted-on transparency**; the generator keys it out itself. Nothing to do.
