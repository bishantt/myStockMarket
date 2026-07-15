# PD9 — Sheets: the detail overlay

**Tag:** `pd-9` · **Phase:** POLISH-AND-DEPTH-PLAN Part 11 (the detail overlay) · **Kind:** app (routing + a new surface)

## The commission, met

On the phone, a story or a ticker now opens OVER the live room and dismisses back to exactly where the
reader was. PD8 built the pages; PD9 makes them open as a sheet without losing the reader's place. The
whole thing is Next.js parallel + intercepting routes over the existing overlay material — the URL is
always the canonical one (E9), a hard load is always the deep-link truth, and P2's stillness rules are
kept to the letter.

## What shipped

- **`(desk)/@modal` parallel slot** (`default.tsx` returns null) + **two intercepting routes**,
  `(.)news/[cluster]` and `(.)ticker/[symbol]`, each rendering `<DetailOverlay>` around the SAME server
  body the standalone page renders. In-app taps open the sheet over the still-mounted room; a hard load,
  refresh or shared link renders the standalone page.
- **The bodies were extracted** to `components/news/StoryPageBody.tsx` and
  `components/ticker/TickerPageBody.tsx` — one component tree, two presentations (E9). The standalone
  pages are now thin route contracts (ISR window + empty-params array); the overlay pages render the
  same body wrapped in the sheet chrome.
- **`DetailOverlay.tsx`** (Radix Dialog, the house pattern): a bottom sheet below `md` (92dvh, grabber,
  `--radius-card` top corners, `overscroll-behavior-y: contain`, `env(safe-area-inset-bottom)` footer
  padding), a centred overlay at and above `md` (max-w 720px, 85vh), both in the `.surface-overlay` L4
  glass. Focus trapped, room behind inert, body scroll locked — all from Radix's modal default.
- **`OverlayMount.tsx`** — a `next/dynamic` boundary so the overlay chrome (Radix + DetailOverlay) loads
  behind the first open, keeping the weight out of the shared `(desk)` chunk.
- **`.sheet-fade`** (globals.css) — the sheet's one motion, OPACITY ONLY, admitted to the P2 ancestor
  walk by name.

## The five things PD9 was told not to re-learn — and how each landed

1. **The motion is opacity only (E7).** `.sheet-fade` reuses the route-fade keyframes (opacity 0→1, no
   transform). It joins the P2-walk allowlist in `p2-motion.test.tsx` BY NAME, on identical terms to
   `.route-fade`, with the reason beside it. A new test renders the REAL mounted `DetailOverlay` around a
   `StatFigure` and walks up from the `[data-p2]` node through the portal — the extended scan set the
   plan asked for — plus a negative control proving a `translateY` ancestor is still caught. The desktop
   overlay is centred with a **flex wrapper**, never `-translate-1/2`, precisely because a centering
   transform would be an ancestor transform over the figures inside.

2. **The code-split is pre-authorized, and the gate proved it.** `check:bundles` reports **`/news` at
   197.4 KB — IDENTICAL to pd-8**, and `/` at 185.8 KB, also unchanged. The `@modal` slot added ZERO to
   either. The overlay chrome lives only in the intercept routes' own chunks (`/(.)news/[cluster]`
   166.7 KB, `/(.)ticker/[symbol]` 150.9 KB, both `≤bound`, not baselined). The 200 KB ceiling did not
   move, and nothing pressed on it.

3. **State restoration is the spec, and the acceptance tests pass.** `e2e/overlay.spec.ts` (phone
   project): the room stays put on open, and **all five dismissals — the ✕, Esc, a scrim tap, the back
   button, and an overscroll-past-top pull — restore `window.scrollY`, the active filter, and keyboard
   focus** to the launcher. Reload while open renders the standalone page, content-identical (the E9
   DOM-equivalence assertion: the sheet's `<h1>` equals the reloaded page's `<h1>`). Focus return is an
   unmount-cleanup effect because the hardware-back path never runs through the dismiss handler.

4. **`@modal` parallel routes — read the LOCAL docs, and verify the matcher.** The local Next docs
   (`node_modules/next/dist/docs`) on parallel/intercepting routes and `default.js` were read first. The
   plan and a first guess reached for `(..)`; **`next build` rejected it outright** — "Cannot use (..)
   marker at the root level, use (.) instead" — because a route group (`(desk)`) is transparent, so
   `@modal` sits at the root level and `news`/`ticker` are its same-level siblings. `(.)` it is. The
   matcher was proved by the build, not trusted from memory.

5. **iOS specifics, built now (manual-verified at PD10).** 92**dvh** (not vh), `env(safe-area-inset-
   bottom)` footer padding, a ≥44px grabber zone, `overscroll-behavior-y: contain` so the sheet's
   overscroll does not fight Safari's edge-swipe-back.

## The one interaction PD9 had to reconcile: the Rail's "Full view"

The Rail's "Full view: {SYM} →" is an in-app `/ticker` navigation, so PD9's intercept catches it — it
opens the ticker SHEET over the Desk now, not a full-page transition. That is E9 being consistent (in-app
is always the overlay; the standalone page is the deep-link truth). The Rail already pushes its own
history entry on open, so a single Back pops the ticker route AND fires the Rail's `popstate` — both
close together, and the reader lands on a clean Desk. The link stays a plain in-app `<Link>`; wrapping it
in `Dialog.Close` unmounted it mid-click and cancelled the navigation, so that was reverted.
`e2e/drill.spec.ts` was updated to assert the sheet-over-Desk behaviour on both viewports.

## The local gate (all green)

- `typecheck` · `lint` · **`npm test` — 746 app unit tests** (was 733 at pd-8; +13: overlay-dismiss,
  DetailOverlay chrome + E9 structural, the P2 sheet-mounted walk + its negative control).
- **`uv run pytest` — 576 passed, 35 skipped (611)** — unchanged; PD9 is an app phase.
- `build` · `check:routes` — **B1 green, both intercept routes ISR-cached** (matching their standalone
  twins) · `check:bundles` — **B4 green, `/news` 197.4 KB, worst `/paper` 198.2, all under the ceiling** ·
  `check:fonts` — 317 KB headroom.
- `e2e:local` (phone, `--workers=1`): the overlay suite (9), drill (6), and every other spec pass. The
  two failures on the shared local DB — `settings.spec:29` (the documented ISR flake) and `desk.spec:143`
  (a cascade: the settings flake leaves an `e2e DIA` watchlist row that pollutes the Desk) — are both
  local-DB artifacts, verified clean after re-seeding, and cannot occur in CI where each leg gets a fresh
  Postgres.
- `check:drift` — **28 rules pass** (no new rule; the P2 exemption is an allowlist entry, not a grep).
- `check:migrations` — **clean against production**; PD9 ships NO migration.

## Rehearsal & VRT

The rehearsal (`gh workflow run ci.yml -f job=e2e`) redded on pixels, as expected: **6 brand-new sheet
baselines** — `sheet-story-phone`, `sheet-ticker-phone`, `sheet-overlay-desktop`, each in Morning and
Midnight — had no committed baseline. Every candidate was diffed against its committed baseline (decode +
count) to confirm ONLY the six new shots appeared and nothing else moved; the story/ticker standalone
baselines were byte-for-byte unchanged (the body is the same component, just relocated). Each of the six
new images was opened and read before its baseline was committed — the brand-new-surface law. The
composition was also previewed locally on macOS (chrome, grabber, scrim, card-radius corners, the centred
desktop overlay) and the local previews deleted; the committed baselines are the CI-Linux ones.

- **check:live:** all 7 pass (macro board, index honesty, calendar hygiene, press-time, 20 byline
  links, next-edition promise).
- **check:nav:** report mode — warm medians fast; worst 403ms is `/settings` (the dynamic writer room,
  allowlisted). **check:lighthouse:** Performance 93, Accessibility 100, CLS 0.000 (hard gate holds),
  first-load 183 KB.
- **Rehearsal runs:** `29386955062` redded on the 6 brand-new sheet baselines (no committed baseline —
  their `-actual.png` appeared with no `-diff.png`, the signature of a new shot). The 6 Linux baselines
  were committed after a full decode+count diff of every candidate; the re-rehearsal `29387494973` ran
  green on the tagged SHA.

## Gate size at `pd-9`

**28 drift rules · 97 VRT baselines · 26 e2e specs · 746 app unit tests · 611 pipeline tests · 16 bundle
baselines · 14 manifest rooms · 4 oracle legs · tag run 7m 19s (run 29387811680).**

Growth since pd-8: VRT baselines 91 → 97 (+6 sheet shots, Appendix D); e2e specs 25 → 26
(`e2e/overlay.spec.ts`); app unit tests 733 → 746. No new drift rule, no new room, no new bundle
baseline, no new oracle leg.
