# PROGRESS.md — resumable state

# PD2 IS **COMPLETE** — tagged `pd-2`, CI green on the first try. **The app has a face.**

**Checkpoint: POLISH-AND-DEPTH-PLAN.md, PD2 (Part 5 — brand: the identity kit) is DONE.
Nothing is blocked. Nothing is in flight.**

**NEXT: PD3 — the desktop grid contract v2** (plan Part 6).

## What PD2 did, in one paragraph

The app had good plumbing and no identity: a placeholder gradient tile with a letter "M" in the top
bar, and — it turned out — **no browser tab icon at all**, because `proxy.ts` had allowlisted
`/favicon.ico` since P0 and no such file ever existed. PD2 built the identity kit. **One master file
goes in (`assets/brand/logo-source.png`), ten artifacts come out** (`npm run brand`), each with a
named size, geometry, budget and consumer. There is now exactly one component allowed to render the
mark (`components/BrandMark.tsx`, the argued second door in drift rule 20), one place a brand colour
may be stated outside the token sheet (the generator, policed by new drift rule 23), and a link
preview — the only public face a login-walled product has — generated from the same master and
photographed by the pixel oracle. Along the way the phase found a **387-pixel bug that the VRT's own
tolerance had been hiding for months**.

## The five things that are now true (a fresh session must know these)

1. **`npm run brand` IS THE ONE GENERATOR.** `npm run icons` is an alias of it; `scripts/icons.mjs`
   and the old placeholder tile (`public/mark.svg`) are deleted. Ten artifacts, all from
   `assets/brand/logo-source.png`. The generator prints its own artifact table with byte sizes and
   **exits non-zero if any budget is missed** — which is how it caught, on its very first run, that
   the new raster mark encodes to 300 KB at 512px against a 120 KB budget written for the flat SVG
   tile it replaced (19 KB). Palette quantisation to 128 colours brings the set to 97.3 KB.
   `public/mark-glyph.svg` SURVIVES — it is still the source for Android's monochrome icon, which
   must be one flat colour on transparency and therefore cannot come from a rendered logo.

2. **THE MASTER'S TRANSPARENCY IS PAINTED ON, and the generator undoes it.** The delivered file has
   no alpha channel: the transparency *checkerboard* is rendered into the pixels. `brand-geometry.mjs`
   keys it out by flood-filling light-and-grey pixels **from the border inward** — which is the whole
   safety argument, because the mark's own whites (the M, the book) are interior and a fill that
   starts at the edge can never reach them. It then fits the mark's true circle (median reach over 72
   angular sectors, so a drop shadow on one side cannot inflate it) and cuts a real alpha.

3. **A LIBRARY THAT "WORKS" CAN BE IGNORING YOU.** sharp accepts a `fontfile`, so the OG card's type
   looked easy. Measured: the same string at the same size rendered to **exactly 1135×159px with our
   monospace font, with our proportional font, and with no font named at all**. Pango was ignoring the
   file and substituting a system font. The card would have shipped in the wrong typeface, differently
   on every machine, and no test on earth would have said so. **The text is now vector outlines**
   (`brand-type.mjs` + `opentype.js`) from two TTFs vendored in `assets/brand/fonts/` — by the time
   anything rasterises there is no text left, only shapes.

4. **THE TOLERANCE WAS HIDING A REAL BUG — read this before you touch VRT.** `maxDiffPixels: 600`.
   `e2e/briefing.spec.ts` writes a journal entry, runs before `e2e/vrt.spec.ts` (workers: 1,
   alphabetical) and never cleans up — so the Desk the *full oracle* photographs says "1 saved
   tonight" while the baseline minted by the standalone `vrt-baselines` job (which runs `vrt.spec`
   alone on a fresh DB) says "none saved tonight". **They had disagreed by 387 px for as long as that
   baseline existed.** PD2's 746-px mark cleared the tolerance and it fell out. Fixed: `Disclosure`
   takes an opt-in `maskCount` and the journal is its only consumer — the reader still sees the count,
   the camera does not.
   **AND: only 14 baselines went red, but 59 had actually CHANGED.** The other 45 moved by 746 px,
   sat under the tolerance, and would have gone on passing while showing a top bar the app no longer
   has. All 59 were re-photographed. **A baseline that is tolerated is still a baseline that is wrong.**

5. **THE EDITION RULE still stands (PD1's law, unchanged and still the most dangerous thing here).**
   > **IF A SURFACE IS DERIVED FROM THE EDITION, IT IS MEASURED AGAINST THE EDITION — never the wall
   > clock.**
   PD2 touched no clock. Every later phase that filters, labels or checks anything dated must obey it,
   and the failure mode is invisible at the hour you usually work (between midnight ET and the
   ~6:40pm publish).

## Gate size at `pd-2`

**23 drift rules · 76 VRT baselines · 23 e2e specs · 638 unit tests · 16 bundle baselines · 14
manifest rooms · tag run 8 m 17 s.** Pipeline: 535 (504 + 31 skipped without Postgres).

Growth this phase, each with a reason (full detail in `docs/pd-evidence/pd2-brand.md`):
- **+1 drift rule (23)** — the brand's hexes have one door outside the token sheet. Rule 1 never
  scanned `scripts/` or `public/*.svg`. Proven to bite.
- **+1 e2e spec (23)** — `brand.spec.ts`: every brand path fetched **unauthenticated**, 200 +
  content-type; the login mark; the OG card's absolute URL.
- **+13 unit tests (638)** — the generator's geometry, against **synthetic** fixtures only. A test
  that asserted today's logo is today's logo would pass forever and prove nothing.
- **+1 amendment to drift rule 20** — `BrandMark.tsx` is the argued second door for imagery.
- **Bundles UNMOVED** — worst `/news` 196.3 KB, exactly as before. Images are not code.

## Production is green and watched

`npm run check:live` — **all six assertions pass** (1 PENDING, owed to PD8: the news bylines are plain
text because that feature does not exist yet). Needs `set -a; source .env; set +a` for
`AUTH_COOKIE_SECRET`. **Local-only by nature** — CI builds a fresh database and deployment every run,
so it structurally cannot answer this. It runs at the **post-deploy step of the standing gate**.

All ten brand paths verified 200 + correct content-type against the deployed origin, unauthenticated.
The OG card's `og:image` resolves **absolute** (`metadataBase` from `APP_BASE_URL`), which is what an
unfurler requires. Lighthouse: **CLS 0.000** and **first-load JS 177 KB** (both HARD gates) ·
advisory perf 86 (was 87) · **LCP 3.83 s, unmoved** from PD1's 3.86 s — the mark did not join the
critical path.

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Claude Code exports its own Node 20 into every shell it spawns; `check:fonts`
  then dies with a `globSync` export error. Not a regression. Prepend Node 24:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. **The brand generator needs Node 24 too**
  (`sharp`, `png-to-ico`, `opentype.js`).
- **`uv run pytest` fails `test_missing_database_url_fails_loudly` if you sourced the root `.env`** —
  the test asserts a *missing* `DATABASE_URL` fails loudly. Not a regression. Run `env -u DATABASE_URL
  uv run pytest`.
- **The 29 Postgres-backed pipeline tests skip on this Mac** — but **they do not have to**:
  `docker run -d --name msm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=msm_test -p 55433:5432 postgres:16`
  then `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55433/msm_test" uv run pytest`.
  **Do this whenever you touch a database write path. A local green with a skip count is not a green.**
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. Advisory perf varies ±10 — **re-sample before explaining a move.**
- **`/settings` answers in ~385 ms, every sample a cache MISS.** Correct — the app's one *writer* room,
  `force-dynamic` by design, with an argued exemption. Every cached room answers in 42–94 ms.
- **`nav-timing — Desk → Scans` on the phone leg is timing-flaky on a contended runner.** PD2 saw it
  red at median 451 ms against a 400 ms ceiling — on a commit whose *application code was identical* to
  a passing one (the only difference was 59 PNG baselines, which cannot slow a client-side nav). The
  samples were bimodal: `[451, 178, 904, 877, 164, 178, 482]` — half of them *faster* than the passing
  run. `gh run rerun <id> --failed` → green. **Read the samples before believing it; a real slowdown
  moves every one of them.**
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The path is proven working end to end. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. Not PD's; leave them.

## Open questions (none blocking — see QUESTIONS-FOR-BISHANT.md)

- **[VETO?] The phone login has no mark.** The brand panel is `hidden lg:flex` by existing design, so
  the 96px lockup is desktop-only. PD4 owns the phone composition; if Bishan wants it there, it is a
  two-line change.
- **[FYI] `e2e/briefing.spec.ts` never cleans up its journal entry.** The camera now looks away, which
  is the cheap correct fix. The deeper fix needs a journal delete path — a feature, not a test fix.
- **[FYI] Your logo file has fake transparency.** Handled entirely by the generator; nothing to do. A
  genuine RGBA re-export would let ~40 lines of pixel-keying be deleted.
- **Q-N6-1 · Q-PD0-1 — CLOSED at PD1.** The Saturday rows are deleted; the Coinbase calendar rows are
  gone and both ends are fenced.
- **[FYI] A tracked file went missing from the working tree during PD1 and was restored.**
  `Screenshot 2026-07-12 at 6.20.46 PM.png` (repo root, committed in `cb20a9f`). **PD2 did NOT see it
  disappear again** — one occurrence, not yet a pattern.
- **Q-G4-1 [VETO?]** PD5's movers delta chip carries `data-p2` (hover = opacity/underline only).
  **PD5 has not started — nothing is built on it. Reversing it still costs one paragraph.**
- **Q-G3-2 [WORTH HIS EYES]** `/academy/[slug]` is neither swept nor pixel-locked. A one-line manifest
  change (`"sweeps": ["touch","scroll","axe"]`). Cheap, and worth doing early in PD.
- **Q-PD0-2 [FYI]** the 1.2 KB of bundle headroom PD0 spent, and why.
- Q-G2-1 · Q-G4-2 · Q-G3-1 · Q-G3-3 · Q-G3-4 · Q-G2-2 — all decided, no action needed.
