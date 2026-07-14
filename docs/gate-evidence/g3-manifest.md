# G3 — one list of rooms, and defuse the clocks

**Phase:** G3 of GATE-EFFICIENCY-PLAN.md · **Tag:** `gate-3` · **Date:** 2026-07-13
**Fixes:** analysis §2.3-#2, §4.6; recommendations R8, R9.

The only phase in this plan that edits specs and scripts. Full TDD. Its crown is a guard that makes
rot-by-omission mechanically impossible — and the crown's first act was to find a room that had been
going unmeasured since F3.

---

## 0. The one-paragraph version

Five hand-kept lists answered the question *"what rooms are there?"*, and they disagreed with each
other and with the app. That is how `/news` shipped in N5 and went through two tagged phases with no
sweep looking at it. There is now **one** list — `app/lib/routes-manifest.json` — and a unit test
that walks `app/app/**/page.tsx` and reds if the filesystem and the manifest disagree in either
direction. Separately, **thirty absolute date literals** across the seed, its fixtures and the browser
suite were collapsed onto **two named anchors**, and new drift rule 21 fails the build for a thirty-
first. Nothing the reader can see changed: the rehearsal swept the same routes and compared the same
76 baselines with zero pixel diffs, which is the proof.

---

## 1. The routes manifest (R8)

`app/lib/routes-manifest.json` — 14 rooms, each with `path`, `family`, `seeded`, `sweeps`,
`navBudget`, `vrtRoom`, and a `note` that has to defend it. JSON, so the `.mjs` scripts, the
TypeScript specs and vitest all read it without ceremony; `app/lib/routes.ts` is the typed door for
the TypeScript side, validating at the boundary rather than trusting TypeScript's inference over a
heterogeneous literal.

### The five consumers, wired — and proven identical to `gate-2`

The risk in this phase was silently *changing* what gets measured while claiming to have only
reorganised it. So the derived lists were held against the literals they replaced, copied out of the
pre-G3 tree:

| Consumer | Routes | Same set as `gate-2`? |
|---|---|---|
| `a11y.spec.ts` ROUTES | 11 | ✓ identical |
| `a11y.spec.ts` SEEDED_ROUTES | 1 | ✓ identical |
| `hardening.spec.ts` ROUTES | 12 | ✓ identical |
| `hardening.spec.ts` SEEDED_ROUTES | 1 | ✓ identical |
| `vrt.spec.ts` SEEDED_ROOMS | 11 | ✓ identical |
| `check-nav.mjs` PRODUCT_ROUTES | 12 | ✓ identical |
| `check-nav.mjs` CONTROL_ROUTES | 2 | ✓ identical |

Order differs in places and does not matter: every test signs in fresh, and snapshot names come from
the room slug, not the loop index. **The rehearsal is what actually proves this** — see §4.

### Three differences between the old lists, deliberately preserved

A "unify the lists" change is at its most dangerous when it smooths away a distinction that was
load-bearing. Three were, and all three survive:

1. **`/styleguide` is swept by `hardening` and NOT by `a11y`.** It is not a product room — no reader
   opens it — so it is not in the manifest, and `hardening.spec.ts` names it by hand with the reason.
   It is the densest control surface in the repo (one of every button, input and disclosure), which
   makes it the best possible target for a touch-target sweep and the wrong one for an accessibility
   sweep *of rooms*.
2. **The ticker room is swept at `/ticker/SPY` but photographed at `/ticker/AAPL`.** SPY needs no
   seed; the Range Ladder only renders with seeded vol bands behind it. So the manifest carries the
   sweep instance and records `vrtRoom: null`, with the note saying where its baselines actually are.
   The plan expected one canonical instance per family; the tree had two, and the tree wins on the
   detail.
3. **`/academy/glossary` is a nav-budget CONTROL, not a gated route.** It is the static yardstick the
   product rooms are measured against, so gating it would be circular.

### The completeness guard (the crown) — three REDs, all witnessed

`app/lib/routes-manifest.test.ts` walks the filesystem, derives the route each `page.tsx` serves
(stripping route groups, keeping dynamic segments in bracket form), and demands agreement in **both**
directions. Written RED first, exactly as the plan required:

**RED 1 — the guard has nothing to read.** The test was written before the manifest existed:

```
Error: Failed to resolve import "./routes-manifest.json" from "lib/routes-manifest.test.ts"
```

**RED 2 — `/news` deleted from the manifest.** This is the plan's mandated proof, and it reproduces
the exact N5 omission:

```
FAIL  lib/routes-manifest.test.ts > names every room that exists on disk — a new page.tsx with
                                     no entry fails HERE, not two phases later
AssertionError: these routes have a page.tsx but no entry in lib/routes-manifest.json, so NOTHING
measures them — no touch-target sweep, no axe scan, no nav budget, no pixel baseline. This is
exactly how /news shipped in N5 and went unmeasured for two tagged phases. […]
    expected [ '/news' ] to deeply equal []
```

**RED 3 — an entry for a room that does not exist.** The direction people forget. A deleted room
serves the 404 page, and the 404 page has no controls under 44px and no accessibility violations, so
the sweeps would "pass" on it forever:

```
FAIL  lib/routes-manifest.test.ts > names only rooms that still exist — an entry for a deleted
                                     room is a sweep that passes on a 404
    expected [ '/movers' ] to deeply equal []
```

All three restored to green. **A new `page.tsx` with no manifest entry is now a red `npm test`,
seconds after it is written, by the person who still remembers why.**

---

## 2. What the manifest found on its first run

The plan asked for "a consistency assert that every baseline key is a manifest path and vice versa."
It fired immediately, on a real hole:

```
✗ B4 fails: the baselines and lib/routes-manifest.json disagree about what exists.

    /scans/[preset] is a room in the manifest with NO baseline here — so its first-load JavaScript
    is never judged, and it could double without anything failing.
```

**`/scans/[preset]` — the match table, the app's one `DataTable` — shipped in F3 and has never had a
bundle baseline.** Not because anyone decided it did not need one. `BASELINE_KB["/scans/[preset]"]`
came back `undefined`, the verdict column printed an empty string, and the route was reported without
ever being judged:

```
  /scans           186.5 KB  exact   12 chunks  ✓ (baseline 186.2)
  /scans/[preset]  153.6 KB  ≤bound  14 chunks                        ← no verdict. ever.
  /settings        153.3 KB  ≤bound  12 chunks  ✓ (baseline 181.7)
```

That is not a failure. It is a **silence**, and a silence in a gate is indistinguishable from a pass.
It is the same rot-by-omission that let `/news` ship unswept, wearing a budget's clothes instead of a
sweep's — and it is exactly the class R8 predicted the manifest would close. Baselined at **153.6 KB**
(an upper bound, like every on-demand family), comfortably under the 200 KB ceiling.

**This is the phase's most valuable single finding, and it cost nothing to make: the manifest simply
gave the hole nowhere to hide.**

---

## 3. Drift rule 21 — the fuse-finder (R9)

> *"An absolute fixture under a relative rule has a fuse on it — `/paper`'s baseline expired 28
> minutes after the run that certified it."*

That is not a metaphor. `prisma/fixtures/paper.mjs`'s own header carries the recording: the ledger's
closed trades sat on absolute dates while the page counted them against a rolling seven-day window.
The window walked forward; the fixture did not.

```
nc-6's CI ran 2026-07-13 19:22Z → cutoff 07-06 19:22 → the 07-06T19:50 trade was IN  → count 2 ✅
nc-final's   ran 2026-07-13 20:39Z → cutoff 07-06 20:39 → the same trade was OUT     → count 1 ❌
```

Nobody had changed a line of code. The gate went red because of the calendar, and it looked exactly
like a regression.

### The design decision, and why the plan's literal wording could not be followed

The plan said: *no absolute date literals in `prisma/seed.mjs` or `e2e/*.spec.ts` outside the
sanctioned constants,* and named only e2e-side constants. **The tree had ~25 absolute dates in
`seed.mjs` alone** — the plan was written expecting one or two. Per Part 1's own rule (*"the tree wins
on the detail and this plan wins on the intent"*), the intent had to be recovered.

A rule that simply banned every date in the seeded world would have been **wrong, and dangerously
so**: the seeded world *is* a fixed morning and has to be — a seed that drifted with the calendar
would repaint every VRT baseline every night, and the pixel oracle would be photographing whatever
today happened to hold instead of a known state. Such a rule would fire on ~25 lines that are not
fuses, and *"a gate that fires on those trains its reader to skim past it, and this codebase has
already learned that lesson three separate times."*

**So the rule is not "never write a date." It is: there is exactly ONE date per world, it has a NAME,
and everything else derives from it.** A second, unnamed copy is how the two silently walk apart, and
walking apart is the entire failure mode. Before G3 there were **two copies of the seeded evening**
(`vrt.spec.ts` and `desk.spec.ts` each carried the literal by hand) and twenty-eight unanchored
literals across `seed.mjs`, `news.mjs` and `macro.mjs`.

### The two anchors

| File | Owns | Value |
|---|---|---|
| `app/prisma/fixtures/clock.mjs` | the seeded world | `SEEDED_SESSION = "2026-07-09"` |
| `app/e2e/seeded-clock.ts` | the browser suite | `SEEDED_EVENING` (11pm ET that night) |

They must agree, and `vrt.spec.ts` checks it at runtime rather than trusting it: the Desk's pipeline
strip has to read FRESH before any shot is taken, and it only reads FRESH if the pinned clock and the
seed are the same night.

### Both REDs witnessed

**RED — the rule against the real tree.** All 30 fuses, before any anchoring:

```
✗ rule 21 — THE FUSE-FINDER — no absolute date outside the two anchors
    prisma/fixtures/macro.mjs:21   const RUN_DATE_ISO = "2026-07-09";
    prisma/fixtures/macro.mjs:27   const FETCHED_AT = new Date("2026-07-09T22:39:00.000Z");
    prisma/fixtures/news.mjs:32    const RUN_DATE = new Date("2026-07-09T00:00:00.000Z");
    prisma/seed.mjs:23             const RUN_DATE = new Date("2026-07-09T00:00:00.000Z");
    prisma/seed.mjs:167            { date: new Date("2026-07-12T00:00:00.000Z"), kind: "macro", …
    …
30 anti-drift violation(s).
```

Note what did **not** fire: the four dates in comments across `a11y`, `control-room`, `nav-timing` and
`theme` specs. Comments are exempt, like rule 1's hex — prose has to be able to say which day it
means, and a date nothing reads has no fuse on it.

**RED — a fresh date, after the anchoring.** The proof the rule still bites. A scratch literal planted
in `paper.spec.ts`, in the exact shape of the one that blew:

```
✗ rule 21 — THE FUSE-FINDER — no absolute date outside the two anchors
    e2e/paper.spec.ts:1  const CUTOFF = new Date("2026-07-06T19:50:00.000Z");
```

Restored → `All 21 anti-drift rules pass.`

### The proof the data did not move

A thirty-site date refactor is precisely the change that can shift the seeded world by a day and
silently repaint a dozen VRT baselines. So `app/prisma/fixtures/clock.test.ts` writes **every instant
the seed used to name as a literal** out longhand and asserts it against the expression that now
produces it — the forward calendar (all eight rows), the backward ledger (fired and resolved
signals), the news night's prior session, the macro board's two odd cadences, and the briefing's
prose date. Six tests, and they fail in milliseconds rather than in CI twelve minutes later as an
unexplained wall of pixels.

Every derived call site also carries its answer in a trailing comment — `sessionPlus(3)  // 2026-07-12`
— which is *why* rule 21 exempts comments: a human has to be able to check the arithmetic against a
calendar without running the code.

### One helper exists purely for readability

`monthStart(1)` → `2026-06-01`. CPI is a **monthly** series stamped with the first of the month it
describes. Written as a day offset it would be `sessionPlus(-38)` — honest, and unreadable. *A fixture
nobody can check against a calendar is how the wrong one survives.* Readability is a
non-negotiable in this repo, and the anchor rule must not be allowed to erode it.

---

## 4. Rule 22 does not exist, and that is the finding

The plan asked whether time-of-day-dependent assertions could be mechanized (the control-room test
that passed only while the market was open). **They cannot, not without false positives** — every grep
for them fires on code that is perfectly correct, and a gate that cries wolf trains its reader to skim
past it. This codebase has learned that three separate times, and building rule 22 would have been
learning it a fourth.

So it stays a **question**, and it is now asked where surfaces and their tests get written
(`.claude/skills/new-surface/SKILL.md`): *"Does every assertion you just wrote hold at 3am AND 3pm —
Saturday included?"* Logged in DECISIONS.

**Deviation, recorded:** the plan said to put this line in the `new-lesson` skill. `new-lesson` is
about authoring Academy lesson MDX and has nothing to do with test assertions — the plan pointed at
the wrong skill. It went into `new-surface`, whose checklist is the one a builder actually runs. See
QUESTIONS-FOR-BISHANT Q-G3-3.

---

## 5. The rehearsal — the no-behavior-change proof

This phase rewrote the lists that decide **what gets measured**. The only honest way to prove it
changed nothing is to run the full oracle and watch it measure exactly the same things. **That is what
the rehearsal is for, and it is why G1 had to come first.**

Push and rehearsal were dispatched **together**, deliberately — G1's concurrency group is
`ci-<ref>-<event_name>`, and the `event_name` half exists precisely so a rehearsal on main does not
cancel the push it is rehearsing. Both ran on `96c5793`:

| Run | Event | Result | Wall-clock |
|---|---|---|---|
| `29298852891` | `push` | ✅ success (app + pipeline) | — |
| `29298865171` | `workflow_dispatch` (`job=e2e`) | ✅ **success, all three legs, first try** | **8 m 11 s** |

On the rehearsal, `app`, `pipeline` and the VRT mint job all show `skipped` — G0's dedup still holding.

**What the green means, precisely:**
- **the same routes were swept** — 11 always-there rooms + 1 seeded, in `a11y` (both themes) and
  `hardening` (touch + scroll), plus `/styleguide`
- **the same 76 VRT baselines were compared** — not 75, not 77
- **zero pixel diffs.** The auto-mint step (G1) **declined to fire**, which is itself the signal: no
  `*-actual.png` was ever written, so no snapshot comparison failed anywhere in the suite.

The seeded world came through the thirty-site date refactor **byte-identical**. Had a single offset
been wrong, the Desk's calendar, the news timestamps and the track-record ledger would all have moved,
and the pixel oracle would have said so in a dozen places at once.

## 6. The tag

`git tag gate-3 96c5793f0f3f7ccb5e3c767f4d1184a25caaea55` — **the exact SHA that was rehearsed, by
SHA**, never `HEAD` (G1's lesson: `main` can move under an endgame).

| Run | Result | Wall-clock |
|---|---|---|
| `29299234093` | ✅ **green, first try** | **8 m 43 s** |

Jobs: `oracle (desktop)` ✅ · `oracle (phone)` ✅ · `oracle (wide)` ✅ · `app` skipped · `pipeline`
skipped · `VRT mint` skipped.

**THE TAG NEVER MOVED.** Third phase running. Before this reform, 52% of tag runs failed and
`nc-final` needed six pushes of one tag.

The rehearsal and the tag run are **the same job through two doors** — one `if:`, two triggers — so the
tag run was a confirmation rather than a discovery, which is the entire point of R1.

## 7. What this phase cost, and what it caught

| | |
|---|---|
| Tag pushes | **1** |
| Rehearsal loops | **0** — green on the first dispatch |
| Pixel diffs | **0** |
| Baselines re-minted | **0** |
| Real defects found | **1** (`/scans/[preset]` unjudged since F3) |
| Latent fuses defused | **30** (28 unanchored dates + 2 duplicate clocks) |

## 8. Gate at exit

**21 drift rules · 76 VRT baselines · 22 e2e specs · 586 unit tests · 16 bundle baselines ·
14 manifest rooms · tag run 8 m 43 s.**

Growth from `gate-2` (20 · 76 · 22 · 577 · 15 · — · 7 m 59 s), **booked with its reason** as R12
requires:

| Item | gate-2 | gate-3 | Why it grew |
|---|---|---|---|
| Drift rules | 20 | **21** | Rule 21, the fuse-finder. The absolute-fixture class had cost two exits; it is now a grep, not a lesson people are asked to remember. |
| Unit tests | 577 | **586** | +3 the completeness guard (the crown), +6 pinning every instant of the seeded world so a date refactor cannot move it silently. |
| Bundle baselines | 15 | **16** | `/scans/[preset]` — **not new work, a hole being closed.** The room shipped in F3 and the guard had been printing it with an empty verdict column ever since. |
| VRT baselines | 76 | **76** | **Unchanged — and that is the phase's proof, not an absence of one.** |
| e2e specs | 22 | **22** | Unchanged. G3 rewired the specs' lists; it added none. |
| Manifest rooms | — | **14** | New register. It replaces five hand-kept lists; it does not add a sixth. |

**The gate got 1 rule and 9 tests bigger, and one room stopped being invisible. Nothing got slower:
the tag run moved 7 m 59 s → 8 m 43 s, which is run-to-run variance on a three-leg matrix, not a cost
this phase introduced.**
