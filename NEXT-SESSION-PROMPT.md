# Your session: PD9 — Sheets: the detail overlay. PD9 ONLY.

**PD8 is done and tagged `pd-8`.**
**PD8 rendered everything PD7 computed — a story page and a ticker page worth opening — and this time,
reading the prose agreed with the instruments: the context reads as English, the footer names the real
models, the thin history says "22 sessions" not "52-week". The guard that reads the SENTENCE, not just
the pixels, is now in the browser suite.**

The polish & depth build runs PD0 → PD10, one phase per session, and it is not gated on Bishan's word —
he said go.

Read `POLISH-AND-DEPTH-PLAN.md` **Part 11** (the detail overlay, in full — 11.1 architecture, 11.2
motion & dismissal, 11.3 state restoration, 11.4 budgets & tests), plus **Part 12's PD9 entry** and
**Appendix D** (the VRT sheet shots). **Your phase is PD9 and PD9 only.**

**PD9 is the SHEETS phase — the detail overlay.** The commission: on mobile, a story or ticker opens
OVER the app and dismisses back to exactly where the reader was. PD8 built the pages the overlay will
wrap; PD9 makes them open as a sheet without losing the reader's place.

**Before any route work, re-read `app/AGENTS.md`** — the tree runs a customized Next 16, its docs live
in `node_modules/next/dist/docs/`, and the plan binds you to read the LOCAL docs on **parallel and
intercepting routes** in THIS Next version rather than trust memory. **The overlay is a new surface:
read `.claude/skills/new-surface` FIRST.**

**PD9 is the LAST feature phase.** PD10 is hardening/evidence/docs. Do not do PD10's work (the iOS
manual checklist, the drift-rule renumbering, the CLAUDE.md Commands edit) — that is PD10.

---

## WHAT PD8 BUILT THAT PD9 NOW WRAPS — one component tree, two presentations

The overlay's whole architecture (E9) is that it renders THE SAME server components the standalone
pages render. PD8 built those pages, so they are ready:

- **`app/(desk)/news/[cluster]/page.tsx`** — the story page v2, ten blocks, each naming its absence.
- **`app/(desk)/ticker/[symbol]/page.tsx`** — the ticker page v2, six queries in one parallel stage.

Part 11.1: the `(desk)` layout gains an `@modal` parallel slot (default null); two intercepting routes
`(.)news/[cluster]` and `(.)ticker/[symbol]` render `<DetailOverlay>` wrapping those same trees. In-app
list → overlay opens over the LIVE room (the room stays mounted — scroll, filters, disclosure state all
survive by never unmounting). Hard load / refresh / shared link → the standalone page. Back / Esc /
scrim / ✕ / overscroll-past-top → `router.back()` → the room exactly as left.

---

## THE FIVE THINGS PD9 MUST NOT RE-LEARN

### 1. **THE MOTION IS OPACITY ONLY. A SLIDE-UP SHEET IS A VETO (E7, and it is PRE-DECIDED).**

The sheet opens over rooms that contain probability and money figures, so a `[data-p2]` node WILL have
an animating ancestor — and `app/components/p2-motion.test.tsx` walks up from every `[data-p2]` node and
fails on exactly that. The plan (11.4, the pre-authorized block) settled this before you: the sheet's
transition is a **sanctioned P2-walk exemption, BY NAME** — one named class added to the allowlist in
`p2-motion.test.tsx`, with the reason beside it, the way `.route-fade` is. **Opacity ONLY — no
transform, no translate, no scale.** A `translateY` on an ancestor of a `[data-p2]` node MOVES the
figure, and no "it's just the container" changes what the reader sees. If the sheet must feel like it
arrives, it arrives by fading. **A blanket exemption or a widened selector is a veto** — the list is
short and closed on purpose.

### 2. **THE CODE-SPLIT IS PRE-AUTHORIZED, NOT A FALLBACK — `/news` HAS ~2.6 KB OF HEADROOM.**

`/news` is the tightest route in the app: **197.4 KB against a 200 KB HARD ceiling** (not
re-baselinable — the script's own words are "Ship less JavaScript"). The `@modal` slot + overlay chrome
add client JS to the `(desk)` shared chunk, which `/news` carries. Plan 11.4's amendment does the sum:
"baseline+10" is arithmetically impossible on `/news`. **So assume from the start that the overlay
chrome loads behind the first open (`next/dynamic`), and let the gate prove the split.** Do not spend a
phase discovering this at the exit. The ceiling does not move. (`/paper` is even tighter at 198.1, but
it carries no overlay — watch `/news` and `/`.)

### 3. **STATE RESTORATION IS THE SPEC, AND THE ACCEPTANCE TESTS ARE 11.3.** The room behind the sheet
must not unmount — restoration is free (never reconstructed) only if it never unmounts. The e2e (phone
project): scroll the feed to card N → open story → scroll INSIDE the sheet → dismiss (EACH of the five
ways, parameterized) → assert `window.scrollY` unchanged, filters unchanged, focus returned to the
opening element. Reload while open → the standalone page renders, content-identical (E9's DOM-
equivalence). Focus trapped inside (Radix Dialog — the house pattern); `inert` on the room behind; body
scroll locked while open.

### 4. **`@modal` PARALLEL ROUTES ARE A NEXT FEATURE YOU MUST READ THE LOCAL DOCS FOR.** This Next is
customized. Read `node_modules/next/dist/docs/` on parallel routes (`@slot`), intercepting routes
(`(.)`, `(..)`), and `default.tsx` (the slot's null fallback) BEFORE writing the routes. The census's
standing warning: a framework flag with a whole-route-tree blast radius (drift rule 17's
`revalidatePath(..., "layout")` 404'd a closed-param route family) is exactly the kind of thing that
bites when you trust memory over the local docs.

### 5. **iOS SPECIFICS (Part 13.1).** 92**dvh** (not vh — the URL bar), `env(safe-area-inset-bottom)`
padding on the footer zone, the grabber ≥44px, `overscroll-behavior-y: contain` on the sheet's scroll
container so its overscroll dismissal does not fight Safari's edge-swipe-back (the LEFT edge stays
Safari's). These are MANUAL-verified at PD10 on the real device — but build them right now.

---

## THE PRESENTATION (11.2)

`<md` a bottom sheet (92dvh, grabber, `--radius-card` top corners, `.surface-overlay` L4 recipe +
scrim); `≥md` a centered overlay (max-w 720px, 85vh, same L4 material). The house already speaks this
material (0.2.7). Dismissals, all five: overscroll-past-top (scroll physics — the one lawful motion
over P2 content, the rubber band is the container's own overscroll, not a JS transform), scrim tap, Esc,
the ✕ (≥44px, top-right, first focusable), hardware/gesture back. On close, focus returns to the
TickerChip/card that launched it.

---

## State of the tree

- `main` is clean, `pd-8` is tagged and green, everything is pushed.
- App unit tests: **733** (was 710 at pd-7; +23). Pipeline: **576 + 35 skipped** (unchanged — PD8 was
  an app phase).
- Anti-drift: **28 rules** (RangeStrip joined P2_FILES, no new rule). VRT baselines: **91** (was 83;
  8 new: news-story-dropped ×4, news-story-sparse ×2, ticker-thin ×2; 21 re-shot). e2e specs: **25**.
  Rooms: **14**. Oracle legs: **4**.
- **Bundles: worst `/paper` 198.1 KB, `/news` 197.4 KB — both under the 200 KB ceiling but TIGHT.**
  `/news` is PD9's binding constraint (see thing #2). `/news/[cluster]` 165.3, `/ticker/[symbol]` 150.4.
  Fonts pass with 317 KB headroom.
- **`check:live` green — all 7 pass** (the news bylines closed one of pd-7's two pending assertions).
  **`check:migrations` clean.** PD8 shipped NO migration. Lighthouse CLS 0.000 holds.
- Nothing is blocked. Nothing is in flight.

## The exit ritual (unchanged — read CLAUDE.md's "The Endgame" block)

1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` (**one project, `--workers=1`, `lsof -ti:3210 | xargs
   kill -9` first**) · `check:drift`. `check:migrations` once (PD9 ships no migration — a formality).
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e --ref main` on the exact SHA you will tag. In
   parallel: wait for the Vercel deploy, then **`check:live`**, `check:nav`, `check:lighthouse`.
4. **PD9 WILL red on pixels** — it adds sheet VRT shots (story sheet phone, ticker sheet phone, overlay
   desktop, both themes — Appendix D). Pull the candidates for EVERY red leg, **diff ALL against
   committed (decode + count, not just the failures), OPEN EVERY IMAGE, state your prediction, fix
   everything, dispatch ONCE** (the batch rule). A brand-new surface's first baseline gets eyes.
   **The sheet shots need the seed and a mounted overlay** — mask over the live figures the seed pins.
5. **Green → `git tag pd-9 <the rehearsed SHA>` — BY SHA, never `HEAD`.** Push, confirm green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — READ THE FAILURE FIRST.
   (PD8's first rehearsal flaked `grid.spec` on mbp16 with the CSSOM "measured 0/0" race — it passed on
   desktop + wide, the identical layout, so the code was fine. The reshoot cleared it.)
7. **ONE docs commit, AFTER the tag** — intelligence files + `docs/pd-evidence/pd9-sheets.md` (incl.
   the five-dismissals e2e matrix output) + this prompt rewritten for PD10, together. Free (paths-ignore).
8. **The evidence file ends with the gate-size line.** At `pd-8`: **28 drift rules · 91 VRT baselines ·
   25 e2e specs · 733 app unit tests · 611 pipeline tests · 16 bundle baselines · 14 manifest rooms ·
   4 oracle legs.**

---

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Prepend Node 24 in every shell:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`scans.spec.ts:44`** (thin-night DB race) and **`settings.spec.ts:29`** (local ISR flake) fail on
  green tagged trees too. Neither is yours. **grid.spec on mbp16** can flake on the CSSOM race — reruns
  clean.
- **`lsof -ti:3210 | xargs kill -9` before ANY local e2e run** — `reuseExistingServer` serves a stale
  build for an hour.
- **Docker Postgres works on this Mac now** (daemon running). The seeded-suite setup is in PROGRESS.md.
- **`git checkout -- docs/feel-evidence/nav-timing.md`** before you commit, if you ran the browser suite
  locally — it appends this-Mac-under-contention samples.
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced. Advisory perf varies ±10 — RE-SAMPLE before you explain a move.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable, deliberately left uncommitted. **Not yours; leave them.**
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED** — the control room's buttons are
  dark in production. Not yours.

## Questions waiting for Bishan — none blocks you

Read `QUESTIONS-FOR-BISHANT.md`, and **diff `DECISIONS.md` for any non-`[claude]` line (= a user veto,
rank 2.5 — honor it FIRST).** All user-authored lines (PD1's deletion, the muted-token floor, the public
repo, the two withdrawn CI reforms, the batch-reshoot rule) are already honored.

- **Q-PD8-1 [FYI, capability available]** — the Desk's evening brief could now emphasize its verified
  figures (E5), completing Q-PD5-1's second half. Deferred: it's a Desk surface outside PD8's scope, and
  the briefing's own verification record may need the same `cleared` wiring the news notes got. The story
  page's context prose DOES honor E5.
- **Q-PD7-1 [available]** — the eighth depth stat (sector breadth) is absent; threading the lake into the
  newsdesk, or a second migration. Not required.
- **Q-PD6-1 [PD10]** — the pixel oracle is blind to a large, low-contrast change (`threshold` unset).
- **Q-PD6-2 — CLOSED at PD8.** The touch sweep visits nc-fda-nonopioid; the TickerChip doors are measured.
- **Q-PD5-1 — CLOSED at PD7 (pipeline) and honored at PD8 on the story context (app).** The Desk brief is
  Q-PD8-1.

---

## The rhythm — non-negotiable

**ONE PHASE PER SESSION.** Finish PD9, tag `pd-9`, bring every intelligence file current as **ONE**
commit, rewrite this file to point at **PD10**, **report to Bishan in plain English, and STOP.**

Within the phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question — anything that needs Bishan goes to `QUESTIONS-FOR-BISHANT.md` with the most reasonable
assumption made and marked.

Run the CLAUDE.md session ritual first (git pull → constitution + PROGRESS.md + LESSONS.md → diff
DECISIONS.md for user vetoes → `npm test` from `app/` and `env -u DATABASE_URL uv run pytest` from
`pipeline/` → announce the checkpoint), then begin PD9.
