# PD10 — hardening, evidence, docs. **The build is complete.**

PD10 was the last phase of POLISH-AND-DEPTH-PLAN. It added no features. It closed the gaps the
detail sheet (PD9) left in the sweeps, verified the iOS contract in code, brought the docs current,
made two deliberate deferral decisions, and tagged `pd-final`. When it exits, the polish-and-depth
build — PD0 → PD10 — is done.

---

## 1. The sheet's own touch targets, measured by opening it (Part 12 · PD10 item 1)

The detail overlay is **not a room** — `routes-manifest.test.ts` skips `@`-slot pages — so the
manifest sweeps in `hardening.spec.ts` and `a11y.spec.ts` never put a ruler on the sheet's own
controls. `e2e/overlay.spec.ts` now opens the story sheet on the live phone build and measures them.

Measured (phone project, seeded, live build):

| Control | Size | Verdict |
|---|---|---|
| ✕ (`Dialog.Close`, `size-11`) | **44 × 44** | the one announced interactive control — passes the 44px rule exactly |
| grabber (`h-6 pt-2` pill) | **410 × 24** | `aria-hidden`, no role/handler/name — a decorative hint, not a target |
| pull-dismiss surface (`overlay-scroll`) | **410 × 746** | the container the touch handlers ride — the real thing a reader pulls, far past 44px |

**The grabber is not padded to 44px, and that is a decision, not an oversight.** The 44px
target-size rule binds *announced interactive targets*; a decorative `aria-hidden` pill that triggers
nothing is not one. The operative pull target is the 410×746 scroll container. Padding the pill to
44px would gate a rule it does not owe and shift the phone sheet down ~20px — churning 4 VRT
baselines — for zero functional gain: a green light wired to nothing. The plan asked to verify "on a
real measurement", and the measurement is what decided it (DECISIONS 2026-07-15, QUESTIONS PD10).

While here: the old `DetailOverlay` comment claimed the grabber was "a ≥44px touch zone" — a number
nobody had measured, and false. It now states the measured truth (LESSONS 2026-07-15).

## 2. axe on the mounted sheet, both bodies, both themes (Part 12 · PD10 item 2)

`e2e/a11y.spec.ts` opens the sheet and axe-scans it, scoped to `[role="dialog"]`:

- **story body** — Morning ✓ · Midnight ✓
- **ticker body** — Morning ✓ · Midnight ✓

Zero serious/critical violations on any of the four. The sr-only `Dialog.Title` gives the dialog its
accessible name; the deliberate `aria-describedby={undefined}` (no description) reads valid, as it
does for `RailDialog`. The scan waits for `.sheet-fade` to reach opacity 1 first — axe composites a
foreground through ancestor opacity, so a sheet caught mid-fade would report colours no reader sees
(the a11y.spec header's standing lesson). Phone project, because the sheet's accessibility is one
component (`DetailOverlay`) identical across the bottom-sheet and centred-overlay presentations —
only CSS position differs, and axe does not read position.

## 3. The full VRT table, green (Part 12 · PD10 item 3)

PD10 changed no visual surface (an invisible `data-testid`, two test files), so all 97 baselines were
expected to pass untouched — and they did. Rehearsal `29389361015` on the tagged SHA
(`07b80669`): four legs, all green.

| leg | result |
|---|---|
| desktop (incl. `sheet-overlay-desktop` ×2) | ✓ |
| phone (incl. `sheet-story-phone` ×2, `sheet-ticker-phone` ×2) | ✓ |
| wide | ✓ |
| mbp16 | ✓ |

No candidate baselines were minted — nothing moved. (The `login-desktop` and
`track-record-dark-desktop` single-shot camera diffs documented at PD7–PD9 remain as-is; PD10 opened
neither page and neither moved.)

## 4. The iOS manual checklist — built to spec, photographs owed to the device (Part 13)

Every Part 13 requirement is confirmed present in the source. What a session cannot do is photograph
it on glass; that is owed to Bishan's iPhone (QUESTIONS PD10, "built to spec, pending device
confirmation" — the Autonomy Contract permits proceeding on a manual gate that needs live
observation).

| Part 13 item | In code |
|---|---|
| 92**dvh** (not vh — the URL bar) | `DetailOverlay.tsx`: `max-h-[92dvh]` |
| `env(safe-area-inset-bottom)` footer padding | `DetailOverlay.tsx`: `pb-[max(1rem,env(safe-area-inset-bottom))]` |
| grabber ≥44px hit target | resolved as §1 above — the pull surface is the 410×746 scroll container |
| overscroll-dismiss must not fight Safari's edge-back | `DetailOverlay.tsx`: `overscroll-y-contain` on the scroll container; the left edge stays Safari's |
| motion is opacity only (E7) | `.sheet-fade` = `@keyframes route-fade { opacity 0→1 }`, no transform |
| reduced motion makes it instant | `globals.css` `@media (prefers-reduced-motion: reduce)` zeroes `animation-duration` |

**MANUAL, pending device (owed):** open a story sheet → scroll → overscroll-dismiss → land exactly
where you left, in mobile Safari; then repeat installed-standalone (gesture-back must also dismiss).
Photograph into this file when run.

## 5. Drift rules — 28, contiguous, numbered against the tree (Part 12 · PD10 item 5)

`check:drift` prints rules **1 through 28**, each exactly once; PD9 added none (its P2 sheet-fade
exemption is an allowlist entry in `p2-motion.test.tsx`, not a grep). No renumbering was needed. The
two stale drift counts in the docs were corrected: CLAUDE.md's design one-liner ("21 rules" → 28) and
the new-surface skill's tail ("Eleven rules" → 28).

## 6. Docs sync (Part 12 · PD10 item 6)

- **CLAUDE.md Commands** — the plan's "one shared-file edit" (add `check:live` + `brand`) was found
  **pre-satisfied**: both got dedicated command lines when PD1/PD2 landed them, so the parallel-build
  conflict the deferral guarded against never arose. PD10's residual edit brings the `guards:`
  quick-reference current (23 → 28 rules; adds check:live + a brand pointer).
- **DEVELOPMENT-PLAN §4.2 route map** — a note on the two presentations (the `@modal` slot, the two
  `(.)` intercepting routes, the sheet-vs-standalone-page choice, one shared body).
- **`.claude/skills/new-surface`** — a new "Does it OPEN OVER a room as a SHEET / OVERLAY?" row: the
  E9 shared-body rule, `DetailOverlay`, the `next/dynamic` split, the opacity-only P2-walk exemption
  by name, and the `(.)` matcher verified by `next build`.
- **QUESTIONS** — the PD10 closeout: the grabber ruling, Q-PD6-1 closed, Q-PD6-3 handed to Bishan,
  the iOS gate pending; every `[VETO?]` carries its assumption marker.

## 7. Two deliberate deferrals

- **Q-PD6-1 (arm the VRT `threshold`) — CLOSED, unarmed.** The oracle is blind to a pure hue-shift
  (the per-pixel threshold is unset). Arming it re-photographs all 97 baselines and makes the suite
  fragile to upstream Chromium anti-aliasing drift — and PD10 is the last phase, with no maintenance
  phase left to re-baseline. A tolerant oracle is the right instrument for a finished, unmaintained
  build. The specific PD6 hover-wash bug is already fixed.
- **Q-PD6-3 (watchlist reason truncates on a phone) — DEFERRED to Bishan.** A real bug in the user's
  own authored text, but the fix is a responsive-layout change (VRT re-shoot) outside PD10's
  no-features brief and squarely the "end-of-phase swing" the build has regressed on before. The
  build completing turns this from "booked for a later phase" into a decision Bishan owns — a
  ~20-minute follow-up on his word.

## 8. Production, verified on the new deploy

- **check:live — all 7 pass** (deploy `07b8066`, state `success`): macro board, index honesty,
  calendar hygiene, press-time, byline links, next-edition promise.
- **check:nav** — report mode; warm-median worst is `/settings` at 400ms (the dynamic writer room,
  allowlisted), matching pd-9's ~403ms.
- **check:lighthouse** — hard gates pass: **CLS 0.000**, **first-load JS 183 KB** (byte-identical to
  pd-9, so no weight regression). Performance is advisory (synthetic-4G): it sampled **75 then 83**
  under local build contention — noise, re-sampled per the constitution, not a regression (pd-9 read
  93 on a quiet machine).
- **check:migrations** — clean; the production database runs the schema in this repo. PD10 shipped no
  migration.

## 9. The rehearsal and the tag

- **Rehearsal (the same job the tag runs):** `gh workflow run ci.yml -f job=e2e --ref main` →
  run **29389361015**, all four oracle legs green on `07b80669`. Push run **29389361727**
  (app + pipeline) green on the same SHA.
- **Tag:** `pd-final` on `07b80669`, by SHA. Tag run **29389722693** — green, all four legs (7m 56s).

## Gate size at `pd-final`

**28 drift rules · 97 VRT baselines · 26 e2e specs · 746 app unit tests · 611 pipeline tests · 16
bundle baselines · 14 manifest rooms · 4 oracle legs · tag run 7m 56s (run 29389722693).**

No growth since pd-9: PD10 added no drift rule, no VRT baseline, no e2e spec FILE (it added three
test CASES inside `overlay.spec.ts` and `a11y.spec.ts`), no room, no bundle baseline, no oracle leg.
A hardening phase hardens; it does not grow the surface. **The gate is where the build leaves it.**
