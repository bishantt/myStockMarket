# PROGRESS.md — resumable state

# PD9 IS **COMPLETE** — tagged `pd-9`, rehearsal green on the reshoot, all baselines explained.
**Fifteen tags.**

**Checkpoint: POLISH-AND-DEPTH-PLAN.md, PD9 (Sheets — the detail overlay, Part 11) is DONE. Nothing is
blocked. Nothing is in flight.**

**NEXT: PD10 — Hardening, evidence, docs (Part 12 · PD10). It is the LAST phase.** When PD10 exits, the
polish & depth build is complete: tag `pd-final`. PD10 is not a feature phase — it is the overlay's
touch/axe sweep, the iOS MANUAL device checklist (Part 13), the full VRT table green, the drift-rule
renumbering, and the ONE shared-file edit the plan held to the end (CLAUDE.md's Commands block gains
`check:live` + `brand`).

## What PD9 did, in one paragraph

PD8 built the story and ticker pages; PD9 made them OPEN. On the phone a story or a ticker now opens as a
sheet OVER the live room and dismisses back to exactly where the reader was — same scroll, same filters,
focus returned. It is Next.js parallel + intercepting routes: a `(desk)/@modal` slot plus two intercept
routes (`(.)news/[cluster]`, `(.)ticker/[symbol]`) render the SAME server body the standalone pages
render, wrapped in `DetailOverlay` (a bottom sheet below `md`, a centred overlay at and above it, both in
the house L4 glass). The page bodies were extracted to `components/news/StoryPageBody` and
`components/ticker/TickerPageBody`, so one component tree serves two presentations (E9) — the standalone
page is now a thin route contract. An in-app tap opens the sheet; a hard load / refresh / shared link
renders the standalone page (the deep-link truth). The motion is opacity only (E7): the sheet fades in,
never slides — a `translateY` over a price is a veto, and `p2-motion.test` now walks the real mounted
sheet. The overlay chrome code-splits behind the first open (`OverlayMount` → `next/dynamic`), so `/news`
held at 197.4 KB, unchanged, under the 200 KB ceiling.

## The seven things a fresh session must know

1. **THE OVERLAY AND THE PAGE RENDER THE SAME BODY — do not fork them (E9).** `StoryPageBody` /
   `TickerPageBody` are rendered by BOTH the standalone route and the `@modal` intercept route. The
   reload-while-open e2e asserts the two DOMs are content-identical; they can only be if they are one
   component. The presentation difference (scrim, grabber, material, positioning) is ENTIRELY in
   `DetailOverlay`, the wrapper.

2. **The intercepting-route matcher is `(.)`, and the BUILD proved it.** A route group is transparent, so
   this Next places `@modal` at the ROOT level, the same level as `news`/`ticker`. `next build` rejects
   `(..)` outright at the root level. Verify a routing detail with the build, never memory (LESSONS
   2026-07-15).

3. **The motion is opacity only (E7), admitted to the P2 walk BY NAME.** `.sheet-fade` (route-fade
   keyframes) joins `p2-motion.test.tsx`'s allowlist, and the desktop overlay is flex-centred, never
   `-translate-1/2` (a centering transform is still a transform over the figures inside). The test walks
   the REAL mounted `DetailOverlay` + a negative control.

4. **The overlay is not a room.** `routes-manifest.test.ts` skips `@`-slot pages; its coverage is
   `e2e/overlay.spec.ts` + the 6 VRT sheet shots, not the room census. If PD10 sweeps it for touch/axe,
   it OPENS the sheet — it does not add a manifest entry.

5. **`/news` is at the 200 KB ceiling (197.4 KB).** PD9 held it there by code-splitting the overlay
   chrome (`next/dynamic`). Do not add client weight to the shared `(desk)` chunk.

6. **Focus returns on UNMOUNT, not in a handler.** The sheet closes by navigating (Radix's focus restore
   never runs; Next moves focus on a route change), so `DetailOverlay` captures the launcher in a
   `useState` initializer (ahead of Radix's autofocus) and re-focuses it in an unmount-cleanup effect —
   which covers the hardware-back path that never runs through `dismiss()`.

7. **The Rail's "Full view" now opens the ticker SHEET.** It is an in-app `/ticker` nav, so the intercept
   catches it; the Rail's own pushed history entry means one Back closes both. Kept a plain `<Link>` —
   wrapping it in `Dialog.Close` unmounts it mid-click and cancels the nav.

## The gate at `pd-9`

- App unit tests: **733 → 746** (+13: overlay-dismiss (5), DetailOverlay chrome + E9 structural (5), the
  P2 sheet-mounted walk + its negative control (3)). Pipeline: **576 + 35 skipped (611)** — unchanged
  (app phase). New files: `components/DetailOverlay.tsx` (+test), `components/OverlayMount.tsx`,
  `components/news/StoryPageBody.tsx`, `components/ticker/TickerPageBody.tsx`, `lib/overlay-dismiss.ts`
  (+test), `e2e/overlay.spec.ts`, `app/(desk)/@modal/**`.
- Anti-drift: **28** (unchanged; the P2 sheet-fade exemption is an allowlist entry, not a rule). Rooms:
  **14**. e2e specs: **25 → 26** (`overlay.spec.ts`). Oracle legs: **4**.
- **VRT baselines: 91 → 97** — 6 new (sheet-story-phone ×2, sheet-ticker-phone ×2, sheet-overlay-desktop
  ×2). A full decode+count diff of EVERY candidate confirmed the 6 are the only additions and 70 existing
  baselines are byte-identical; login-desktop (17226px) and track-record-dark-desktop (4px) are the
  documented CAMERA (single-project/theme, passed the oracle), left as-is exactly as PD7 and PD8 did.
- **Bundles:** `/news` 197.4 (baseline 195.1) — UNCHANGED from pd-8, under the 200 KB ceiling. `/` 185.8.
  Worst `/paper` 198.2. Intercept routes `≤bound`: `/(.)news/[cluster]` 166.7, `/(.)ticker/[symbol]`
  150.9. Fonts pass, 317 KB headroom.
- **`check:live` — all 7 GREEN.** **`check:migrations` clean** — NO migration this phase. **Lighthouse:
  Performance 93, Accessibility 100, CLS 0.000, first-load 183 KB.**

## The local harness (all works — use it)

```bash
docker start msm-e2e   # or run it fresh (see below)
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"   # SEPARATE export — $DATABASE_URL in the same line expands to the OLD value
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9          # ALWAYS, before any run — reuseExistingServer serves a stale build
npx playwright test --project=phone --workers=1 --ignore-snapshots e2e/overlay.spec.ts
```
Fresh container: `docker run -d --name msm-e2e -e POSTGRES_PASSWORD=test -e POSTGRES_DB=msmtest -p 55434:5432 postgres:16`.

## Local e2e failures that are NOT yours

- **`settings.spec.ts:29`** — a local ISR-revalidation flake; fails on tagged green trees too.
- **`desk.spec.ts:143`** — a CASCADE: the settings flake leaves an `e2e DIA` watchlist row that pollutes
  the Desk watchlist across runs. Re-seed or `delete from watchlist_item where reason like 'e2e %'`
  between runs; passes clean. In CI each leg has a fresh Postgres, so neither occurs.
- **`scans.spec.ts:44`** — the thin-night database race (passes in isolation).
- **grid.spec on mbp16** can flake on the documented CSSOM "measured 0/0" race — reruns clean.
