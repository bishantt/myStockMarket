# PROGRESS.md — resumable state

# PD6 IS **COMPLETE** — tagged `pd-6` (`026c9cf`), CI green — the tag run reran ONE known flake (scans.spec:44) and went green. **Twelve tags.**

**Checkpoint: POLISH-AND-DEPTH-PLAN.md, PD6 (Part 8.3's second half — the voice, the remaining
rooms) is DONE. Nothing is blocked. Nothing is in flight.**

**NEXT: PD7 — news & ticker depth, the PIPELINE** (plan Part 9.2/9.3/9.5 + Part 12's PD7 entry).
It is a **pipeline** phase, not an app phase — the first one since N5.

## What PD6 did, in one paragraph

Carried PD5's richness kit into the five rooms it had not reached — scans, paper, track-record,
Academy, settings — and found that the kit had **six** delta chips rather than the four PD5 hunted
down, that the app's one table had been rendering **a delta with no window on every phone** since the
table was written, and that a **21px touch target** had been live on the news story page since PD5,
passing the phone sweep every night because the seeded story it visits has no rows in it. Built
`OutcomeChip` (three hand-rolled copies, three comments promising equal weight, two of them already
drifted). Added **drift rule 28**. Closed **Q-PD5-2** — the `scans-preset` baseline really was a
photograph of a hover state, and I have looked at it. And then the pictures caught **two bugs of my
own** that every single guard had passed — and a THIRD when a fix for one of those broke the phone.
**The repository went PUBLIC mid-endgame** (Bishan's decision) when a GitHub Actions billing wall
stopped CI dead; Actions is unmetered on public repos, and the login wall is untouched.

## The six things that are now true (a fresh session must know these)

1. **A HAND GREP IS NOT A GUARD.** PD5 wrote the law — *a duplicated component is not a bug, it is a
   bug's habitat* — hunted the delta chip's siblings, found FOUR, and closed the file. **There were
   SIX.** `DataTable.tsx` held a private `function DeltaChip` that **shadowed the kit component's own
   name**, so a grep found it and read it as the kit; `scans/page.tsx` held a sixth inline, with no
   component name to grep for at all. Both rendered nightly on front-facing rooms.
   **Drift rule 28** is the answer: the direction WASH (`bg-up-wash`/`bg-down-wash`) has exactly two
   doors — `DeltaChip` and `OutcomeChip`. It is pointed at the one thing all six copies had in common
   and could not have avoided, so a seventh must paint one to exist, and fails the build when it does.

2. **THE TABLE SHOWED A NAKED DELTA ON EVERY PHONE, AND ONE OF THEM ACTIVELY MISLEADS.** The window
   lived in the COLUMN HEADER — honest on a desktop, where a `<th>` labels every cell beneath it, and
   **completely absent on a phone**: DataTable draws a card list, and a priority-1 cell is rendered
   with *no header beside it*. Every signed-percent column in the app is priority 1 or 2. So
   `dist_52w_high` — which means *"12.4% below the 52-week HIGH"* — rendered as a bare red `▼ −12.4%`,
   which any reader takes for a bad day.
   **The fix is a TYPE.** `lib/table.ts`'s `Column<Row>` is a discriminated union: `kind:
   "signedPercent"` **does not compile** without a `window`. It cannot be forgotten and cannot be
   pointed at the wrong file, and it named the three remaining call sites the moment it was written.
   It reached the news story page too — PD5 fixed the delta chip on the news FEED and left the
   identical bug on the news STORY page, one component over, behind the table's private chip.

3. **A GUARD ONLY GUARDS WHAT IT IS POINTED AT — AND THAT INCLUDES THE DATA.** A `door` is a control,
   so it is ≥44px on touch. `TickerChip` shipped at **34×21px**, and the same 21px door had been LIVE
   on the news story page since PD5 with the phone sweep passing it every night. The sweep visits one
   story, `nc-fed-hold`, and that cluster has **zero** catalyst links in the seeded world — so the
   affected table renders no rows, so there were no doors to measure. **The rule was being kept by the
   shape of a fixture.** Fixed in the component (so it lands everywhere at once) and pinned in
   `TickerChip.test.tsx`, not in a sweep that needs the data to cooperate. **Q-PD6-2** asks PD8 to
   point the sweep at a story that actually has an affected table.

4. **LOOK AT THE PICTURES — AND THIS TIME THEY CAUGHT THREE OF MINE.** Third phase running.
   · **The 44px door made every table row 69px.** `min-h-11` gave the anchor a true 44px box, and that
     44px then ADDED to the `<td>`'s 12px of padding: every row in every table went 45px → **69px**,
     half again as tall, to make room for something invisible. **Every guard passed** — including the
     touch sweep, which asks "is it 44px?" and got 44px. Caught by putting the candidate baseline next
     to the committed one. `-my-3` pulls the box back INTO padding the cell had already reserved;
     `boundingBox()` still returns a true 44px. Measured after: **row 46.3px, door 44px.**
   · **A chip is wider than the word it replaces.** The settings watchlist's symbol column was `w-24`
     (96px), sized for the text "AAPL" (~34px). As a bordered chip that is ~48px, and beside its FOCUS
     tag it no longer fit — so the tag wrapped to its own line. `w-32` fixed it, and *also* stopped the
     company names wrapping, which is why the settings baseline came back **35px SHORTER**.
   · **AND THAT FIX BROKE THE PHONE.** `w-32` added 32px to a tight row and `/settings` began
     **scrolling sideways 16px at 360** — PD4's bug, reintroduced by a fix for something else. Then
     `flex-wrap` fixed 360 and **broke 1366** (the reason text's flex-basis is `auto`, so under wrap it
     stops shrinking and starts pushing). The answer was a RESPONSIVE column, `w-24 md:w-32`.
   **PD4's law, in two new rooms: making a chip FIT is the LAYOUT's job, not the chip's.**
   **And the harder one: A FIX VERIFIED AT ONE WIDTH IS NOT VERIFIED. Touch a room, re-run its sweeps.**

5. **THE PIXEL ORACLE IS BLIND TO A LARGE, LOW-CONTRAST CHANGE — AND THAT IS NOT THE TOLERANCE.**
   PD5 saw `scans-preset` change by ~56,000px *without failing* and assumed `maxDiffPixels: 600` had
   absorbed it. It had not — 56,000 would blow straight through 600. Playwright ALSO takes a per-pixel
   **`threshold`** (default 0.2, a colour distance), and we never set it. **A hover wash is a big
   region of a *slightly* different colour: every one of those pixels falls under the cutoff, so none
   of them counts as differing and the 600-pixel budget is never even consulted.** The oracle was not
   tolerating the hover. It could not see it.
   The specific bug is dead: those baselines dated from **PD2**, before PD4 parked the mouse at (0,0),
   and were photographs of row 2 (GME) sitting in a `hover:bg-accent-soft` wash. **I cropped them side
   by side and looked. Q-PD5-2 is CLOSED.** Arming `threshold` is a change to the instrument all 83
   baselines are measured by → **Q-PD6-1, booked for PD10.**

6. **`/paper`'s RESTRAINT HELD, AND IT WAS THE HARDEST LINE TO KEEP.** The room got glossary doorways
   in the standing prose that *introduces* it — where "the spread" and "slippage" are being explained
   to a beginner — and the chip treatment on its ledger symbols. It got **nothing** near the ticket.
   The cost mirror's `−X% / yr drag` is still plain mono; it was deliberately NOT wrapped in
   `DeltaChip`, because it is a **cost**, not a market move, and it has no window. **A cost mirror is
   the one place in this app where a reader is about to spend money. A ticket decorated with
   underlines and emphasized numerals is a ticket that is selling something.**

## The gate at `pd-6`

- App unit tests: **710** (was 692). Pipeline: **535** (504 + 31 skipped locally without Postgres).
- Anti-drift: **28 rules** (was 27 — rule 28, the direction wash). Rooms: **14**. Oracle legs: **4**.
  e2e specs: **25**. VRT baselines: **83** (34 re-shot, 0 added).
- **Bundles: worst `/news` 197.3 KB against the 200 KB hard ceiling — ≈2.7 KB of real headroom.**
  **PD9's overlay still has to fit in what is left.** Two baselines rebooked, each with its reason:
  `/track-record` 185.1 → **192.7** (the kit crossed into a client component: TickerChip → DeltaChip,
  plus the glossary popover island) and `/settings` 181.7 → **154.7** — that one was a **28 KB hole in
  the drift guard**: a rebuild of `pd-5` measures the room at 153.5 KB, so it had been ~28 KB lighter
  than its baseline for some time, and **a guard that only fires on GROWTH is silent about a number
  that is too generous**.
- Fonts 243/560 KB · `check:migrations` clean · `check:live` **green — 5 pass, 2 pending** (news
  bylines, owed to PD8; and the masthead, owed to *tonight's* nightly — it was run at 5:15pm ET,
  before the 6:37pm edition, and the checker says so rather than failing a healthy Desk) · `check:nav` report-mode · `check:lighthouse` **CLS 0.000, first-load JS 181 KB** (both hard
  gates; perf 77 is the advisory synthetic-4G number that varies ±10).
- Every candidate baseline was diffed against its committed one — **all 83, not just the failures** —
  and the ones that moved were **opened and looked at** before they were committed.

## The local harness, as actually used this phase (it all works — use it)

A seeded Postgres in Docker turns 149 skipped browser tests into 222 that actually run. PD6's whole
touch-target finding came out of it, and it would have reached CI otherwise.

```bash
docker run -d --name msm-e2e -e POSTGRES_PASSWORD=test -e POSTGRES_DB=msmtest -p 55434:5432 postgres:16
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest" DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy && npm run db:seed
export MSM_SEEDED=1
lsof -ti:3210 | xargs kill -9          # ALWAYS, before any run — reuseExistingServer will lie to you
npx playwright test --project=phone --workers=1 --ignore-snapshots
```

**The seed only deletes the three watchlist symbols it creates**, so a failed `settings.spec` leaves
`QQQ`/`DIA` behind and poisons the next run. Delete them between runs.

## Two local e2e failures that are NOT yours (both re-confirmed at PD6)

- **`scans.spec.ts:44`** — passes in isolation. The thin-night specs mutate the shared local database;
  CI gives every leg its own.
- **`settings.spec.ts:29`** — **fails on the tagged, green `pd-5` tree too.** I stashed PD6, rebuilt
  `pd-5`, ran it against the same database, and it failed *earlier*, at a different assertion. A local
  ISR-revalidation flake, and it has now been confirmed against two different tags. Do not chase it.
