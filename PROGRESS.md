# PROGRESS.md — resumable state

# THE BUILD IS COMPLETE. POLISH-AND-DEPTH-PLAN PD0 → PD10 is DONE — tagged `pd-final`.
**Sixteen tags. `pd-final` is the last one.**

**Checkpoint: PD10 (Hardening, evidence, docs — Part 12 · PD10) is DONE. The polish-and-depth build,
and with it the myStockMarket build the plans describe, is finished. Nothing is blocked. Nothing is in
flight.**

**There is NO next phase.** The one open item that a future session might pick up is a small deferred
usability fix Bishan owns (Q-PD6-3, below) — and one manual gate that needs his device (the iOS
photographs). Neither is a phase; both wait on Bishan's word.

## What PD10 did, in one paragraph

PD10 hardened the detail sheet PD9 built, verified it, and squared the docs. The sheet is not a room,
so the manifest sweeps never measured its own controls: PD10 opens it and does. `e2e/overlay.spec.ts`
measures the sheet's touch targets on the live phone build — the ✕ is 44×44 (the one announced
control), the grabber is a decorative 410×24 pill (`aria-hidden`, deliberately not padded to 44px),
and the real pull surface is the 410×746 scroll container. `e2e/a11y.spec.ts` opens the story AND the
ticker body and axe-scans the mounted dialog in both themes — all four clean. The iOS Part-13 contract
(92dvh, safe-area footer, `overscroll-y-contain`, opacity-only fade, reduced-motion) is confirmed in
the source; the on-glass photographs are owed to Bishan's iPhone. Two PD6-era questions were closed by
decision, not by code: the VRT `threshold` stays unarmed (a finished, unmaintained build wants a
tolerant oracle), and the watchlist-reason-truncation fix is handed back to Bishan. The docs were
brought current, including the plan's held CLAUDE.md edit (found pre-satisfied by PD1/PD2; the guards
summary was refreshed). `pd-final` was rehearsed green on all four legs, then tagged by SHA.

## The gate at `pd-final`

- **App unit tests: 746** (unchanged — PD10 added e2e cases, not unit tests). **Pipeline: 576 + 35
  skipped (611)** — unchanged.
- **Anti-drift: 28 rules** (unchanged; contiguous 1–28, confirmed against the tree). **VRT baselines:
  97** (unchanged — PD10 changed no visual surface). **e2e specs: 26 FILES** (unchanged; PD10 added 3
  test CASES inside `overlay.spec.ts` and `a11y.spec.ts`). **Rooms: 14. Oracle legs: 4.**
- **Bundles:** `/news` 197.4 KB — unchanged, under the 200 KB ceiling; worst `/paper` 198.2. Fonts
  pass, 317 KB headroom.
- **check:live — all 7 pass** (deploy `07b8066`). **check:migrations clean** — PD10 shipped NO
  migration. **check:nav** report mode (`/settings` 400ms, allowlisted). **Lighthouse:** hard gates
  pass — CLS 0.000, first-load 183 KB; Performance advisory (75→83 under local load, noise — pd-9 read
  93 quiet).
- **Rehearsal `29389361015` green on all 4 legs** at the tagged SHA `07b80669`. **Tag run
  `29389722693` — green.** (Full evidence: `docs/pd-evidence/pd10-hardening.md`.)

## The two things that outlive the build (both wait on Bishan — neither is a phase)

1. **Q-PD6-3 — the watchlist reason truncates to nothing on a 412px phone.** A real bug in the user's
   own authored text. Not fixed in PD10 (a responsive-layout change + a `/settings` VRT re-shoot is
   outside PD10's no-features brief and is the exact end-of-phase swing this build has regressed on).
   A ~20-minute follow-up whenever Bishan wants it. Details in QUESTIONS + DECISIONS (2026-07-15).
2. **The iOS manual checklist (Part 13) — built to spec, photographs owed.** Everything is in the
   code; the glass verification needs Bishan's iPhone. Home for the photos: `pd10-hardening.md` §4.

## The local harness (unchanged — still works)

```bash
docker start msm-e2e
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"   # SEPARATE export
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=phone --workers=1 --ignore-snapshots
```

## Local e2e failures that are NOT a regression (unchanged from pd-9)

- `settings.spec.ts:29` (ISR flake), `desk.spec.ts:143` (the settings-flake watchlist-pollution
  cascade — re-seed or `delete from watchlist_item where reason like 'e2e %'`), `scans.spec.ts:44`
  (thin-night DB race), `grid.spec` on mbp16 (CSSOM 0/0 race). All pass in CI (fresh Postgres per leg).
  This PD10 run saw NONE of them — the full phone suite went **249 passed** after a clean re-seed.
