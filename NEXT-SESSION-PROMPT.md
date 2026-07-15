# Your session: PD10 — Hardening, evidence, docs. PD10 ONLY. It is the LAST phase.

**PD9 is done and tagged `pd-9`.**
**PD9 gave the finished story and ticker pages a way to OPEN: on the phone a story or a ticker now opens
as a sheet OVER the live room and dismisses back to exactly where the reader was — same scroll, same
filters, focus returned. It is Next.js parallel + intercepting routes over the existing overlay glass;
the URL is always the canonical one, a hard load is always the standalone page (E9), and P2's stillness
is kept to the letter — the sheet arrives by fading, never by sliding.**

The polish & depth build runs PD0 → PD10, one phase per session, and it is not gated on Bishan's word —
he said go.

**PD10 is the LAST phase. It is hardening, evidence, and docs — no new features.** Read
`POLISH-AND-DEPTH-PLAN.md` **Part 12's PD10 entry**, **Part 13** (Mobile & iOS specifics — the MANUAL
checklist), and skim **Appendix E** (the decisions this plan seeds). Your phase is PD10 and PD10 only,
and when it exits the build is COMPLETE: tag `pd-final`.

---

## WHAT PD10 MUST DO (Part 12 · PD10)

1. **Touch-target sweep re-run WITH the overlay in scope.** `e2e/hardening.spec.ts` sweeps manifest
   rooms; the detail sheet is NOT a room, so its own controls — the ✕ (44px), the grabber zone
   (≥44px) — are unmeasured by the room sweep. **Decide and implement:** either extend the touch sweep
   to OPEN a sheet and measure its controls, or add a dedicated overlay touch assertion. The ✕ is
   `size-11` and the grabber zone is `h-6 pt-2` inside a flex row — verify the grabber's HIT area is
   actually ≥44px on a real measurement (it may need a taller touch zone than its visual pill). This is
   the plan's "the new anchors/overlays in its route list" made concrete.

2. **axe full pass — including the OPEN sheet.** `e2e/a11y.spec.ts` scans rooms in both themes; it does
   not open the overlay. Add an axe scan of the mounted sheet (story + ticker) in both themes — a Radix
   Dialog is the house pattern and should be clean, but "should be" is not "is". Watch for the sr-only
   `Dialog.Title` and the `aria-describedby={undefined}` (deliberate, like RailDialog) reading clean.

3. **Full VRT table green.** All 97 baselines pass on the tag run, including PD9's 6 new sheet shots.

4. **The iOS MANUAL checklist (Part 13) — Bishan's device, photographed.** This is the one thing a
   session cannot do itself. 92**dvh** (not vh), `env(safe-area-inset-bottom)` footer padding, the
   grabber ≥44px, `overscroll-behavior-y: contain` so the sheet's overscroll-dismiss does not fight
   Safari's left-edge swipe-back. Open a story sheet → scroll → overscroll-dismiss → land where you
   left; repeat installed-standalone (gesture back must also dismiss). **Everything is BUILT for this
   already (PD9); PD10 verifies it on glass and photographs it into `docs/pd-evidence/`.** If Bishan
   cannot run it this session, note it in QUESTIONS with the assumption "built to spec, pending device
   confirmation" and proceed — a manual gate that needs live observation is not a blocker (the Autonomy
   Contract).

5. **Drift rules landed and numbered.** PD9 added NO new drift rule (its P2 exemption is an allowlist
   entry in `p2-motion.test.tsx`, not a grep). Confirm the count is still 28 and that every rule's
   number matches the tree. If the plan wants any of PD's rules renumbered against the final tree, this
   is the phase.

6. **Docs sync — and this is where the ONE shared-file edit lands (deliberately last).**
   - **`CLAUDE.md` Commands block gains `check:live` + `brand`** — the single edit to a shared file this
     whole plan makes, held to the end now that the parallel-build risk is gone.
   - `DEVELOPMENT-PLAN.md` route map notes the overlay presentations (the `@modal` slot, the two
     intercepting routes, the sheet-vs-page presentation).
   - **`.claude/skills/new-surface` gains an OVERLAY row** — how to add a sheet: extract the body to a
     shared server component, wrap it in `DetailOverlay`, code-split via `next/dynamic`, opacity-only
     motion admitted to the P2 walk by name, and the `(.)` matcher verified by the build.
   - QUESTIONS closeout: every `[VETO?]` carries its assumption marker.
   - PROGRESS closing entry — the build is complete.

**Gate:** the full standing gate + every evidence file present + **`pd-final` tagged green.**

---

## WHAT PD9 BUILT — so PD10 knows the surface it is hardening

- **`app/(desk)/@modal/`** — the parallel slot. `default.tsx` returns null; `(.)news/[cluster]/page.tsx`
  and `(.)ticker/[symbol]/page.tsx` render `<OverlayMount><XPageBody/></OverlayMount>`, both ISR-cached.
- **`app/components/DetailOverlay.tsx`** — the sheet (Radix Dialog): bottom sheet `<md`, centred overlay
  `≥md`, `.surface-overlay` glass, `.sheet-fade` (opacity only), five dismissals, focus-return on unmount.
- **`app/components/OverlayMount.tsx`** — the `next/dynamic` boundary that keeps the chrome off `/news`.
- **`app/components/news/StoryPageBody.tsx` + `app/components/ticker/TickerPageBody.tsx`** — the extracted
  bodies. The standalone `page.tsx` files are now thin route contracts. THE OVERLAY AND THE PAGE RENDER
  THE SAME BODY — do not fork them (E9).
- **`app/lib/overlay-dismiss.ts`** — the pure overscroll-past-top decision (unit-tested).
- The Rail's "Full view" now opens the ticker SHEET (an in-app `/ticker` nav is intercepted); one Back
  closes both, via the rail's own history entry. `e2e/drill.spec.ts` asserts this.

## THE FIVE THINGS PD10 MUST NOT RE-LEARN (carried from PD9)

1. **The overlay is not a room.** `routes-manifest.test.ts` skips `@`-slot pages; the sheet's coverage is
   `e2e/overlay.spec.ts` + its 6 VRT shots, not the room census. If PD10 sweeps the overlay for touch/axe,
   it does so by OPENING it, not by adding it to the manifest.

2. **`/news` is at 197.4 KB against a HARD 200 KB ceiling.** PD9 held it exactly there by code-splitting
   the overlay chrome. Do not undo the split, and do not add client weight to the shared `(desk)` chunk.

3. **The sheet motion is opacity only (E7).** If PD10 touches the sheet, `.sheet-fade` stays opacity-only
   and the desktop overlay stays flex-centred (never `-translate-1/2`). A transform over a `[data-p2]`
   node is a veto, and `p2-motion.test.tsx` walks the mounted sheet.

4. **The `(.)` matcher was proven by the build.** If you ever move the intercept routes, re-run
   `next build` — `(..)` is rejected at the root level, and the build is the only reliable oracle.

5. **Run the seeded browser suite for any change that touches an accessible name or a shared body.** The
   local DB pollutes across runs (a failed `settings.spec` leaves an `e2e DIA` watchlist row that reds
   `desk.spec:143`) — re-seed or delete `where reason like 'e2e %'` between runs.

---

## State of the tree

- `main` is clean, `pd-9` is tagged and green, everything is pushed.
- App unit tests: **746** (was 733 at pd-8; +13: overlay-dismiss, DetailOverlay chrome + E9 structural,
  the P2 sheet-mounted walk + its negative control). Pipeline: **576 + 35 skipped (611)** — unchanged
  (PD9 was an app phase).
- Anti-drift: **28 rules** (unchanged — the P2 sheet-fade exemption is an allowlist entry, not a rule).
  VRT baselines: **97** (was 91; +6 sheet shots — story/ticker sheet on a phone, centred overlay on a
  desktop, both themes). e2e specs: **26** (+`overlay.spec.ts`). Rooms: **14**. Oracle legs: **4**.
- **Bundles: `/news` 197.4 KB — UNCHANGED from pd-8 — worst `/paper` 198.2, both under the 200 KB
  ceiling.** The two intercept routes are `≤bound` (166.7 / 150.9), not baselined. Fonts pass, 317 KB
  headroom.
- **`check:live` — all 7 pass.** **`check:migrations` clean.** PD9 shipped NO migration. **Lighthouse:
  Performance 93, Accessibility 100, CLS 0.000, first-load 183 KB.**
- Nothing is blocked. Nothing is in flight.

## The exit ritual (unchanged — read CLAUDE.md's "The Endgame" block)

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` (one project, `--workers=1`, `lsof -ti:3210 | xargs kill
   -9` first) · `check:drift`. `check:migrations` once (PD10 ships no migration unless you add one).
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` on the exact SHA you will tag. In
   parallel: wait for the Vercel deploy, then **`check:live`**, `check:nav`, `check:lighthouse`.
4. **Rehearsal red on pixels?** Pull the candidates for EVERY red leg, diff ALL against committed
   (decode + count), OPEN EVERY IMAGE, fix everything, dispatch ONCE (the batch rule). PD10 SHOULD be
   green on pixels if it changes no surface — a red is a finding.
5. **Green → `git tag pd-final <the rehearsed SHA>` — BY SHA, never `HEAD`.** Push, confirm green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — READ THE FAILURE FIRST.
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd10-hardening.md` (incl.
   the iOS manual photos or their pending marker) + the final PROGRESS entry. Free (paths-ignore).
8. **The evidence file ends with the gate-size line.** At `pd-9`: **28 drift rules · 97 VRT baselines ·
   26 e2e specs · 746 app unit tests · 611 pipeline tests · 16 bundle baselines · 14 manifest rooms ·
   4 oracle legs.**

---

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Prepend Node 24 in every shell:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **Local seeded e2e:** Docker Postgres works on this Mac. Setup:
  ```bash
  docker start msm-e2e   # or: docker run -d --name msm-e2e -e POSTGRES_PASSWORD=test -e POSTGRES_DB=msmtest -p 55434:5432 postgres:16
  export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
  export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"   # set SEPARATELY — `$DATABASE_URL` in the same `export` expands to the OLD value
  npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1
  lsof -ti:3210 | xargs kill -9    # ALWAYS, before any run — reuseExistingServer serves a stale build
  npx playwright test --project=phone --workers=1 --ignore-snapshots
  ```
- **`scans.spec.ts:44`** (thin-night DB race), **`settings.spec.ts:29`** (local ISR flake), and
  **`desk.spec.ts:143`** (a CASCADE — the settings flake leaves an `e2e DIA` watchlist row that pollutes
  the Desk; re-seed or `delete from watchlist_item where reason like 'e2e %'` between runs) all fail on
  green tagged trees. None is yours. **grid.spec on mbp16** can flake on the CSSOM 0/0 race — reruns clean.
- **`git checkout -- docs/feel-evidence/nav-timing.md`** before you commit, if you ran the browser suite
  locally — it appends this-Mac-under-contention samples.
- **`check:live`** needs the root `.env` sourced (AUTH_COOKIE_SECRET). **`check:lighthouse`** needs
  `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and `.env`.
  Advisory perf varies ±10 — RE-SAMPLE before you explain a move.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable, deliberately left uncommitted. **Not yours; leave them.**
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED** — the control room's buttons are
  dark in production. Not yours.

## Questions waiting for Bishan — none blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).** All user-authored lines are already honored.

- **Q-PD8-1 [FYI, capability available]** — the Desk's evening brief could emphasize its verified
  figures (E5), completing Q-PD5-1's second half. Deferred; the story page's context prose already honors E5.
- **Q-PD7-1 [available]** — the eighth depth stat (sector breadth) is absent. Not required.
- **Q-PD6-1 [PD10]** — the pixel oracle is blind to a large, low-contrast change (`threshold` unset). This
  is a PD10 candidate: the sheet's scrim is a large low-contrast wash, exactly the kind of change the
  unset threshold could miss.

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD10, tag `pd-final`, bring every intelligence file current as **ONE**
commit, write a closing PROGRESS entry (the build is done), **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `env -u DATABASE_URL uv run pytest` from
`pipeline/` → announce the checkpoint), then begin PD10.
