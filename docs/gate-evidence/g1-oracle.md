# G1 — move the oracle before the tag

**Phase:** GATE-EFFICIENCY-PLAN G1. **Tag:** `gate-1` on `6a74140`. **Date:** 2026-07-13.
**Thesis:** the browser oracle ran for the first time *on the tag*, which made the tag the first
real test. 52% of all tag runs failed; `nc-final` needed six pushes of one tag. Move the identical
suite to *before* the tag exists and the tag becomes a formality.

**It worked. `gate-1` went green on the first try, in 7 m 58 s, and the tag never moved.**

---

## 1. The headline, before and after

| | before (`gate-0`) | after (`gate-1`) |
|---|---|---|
| Tag-run wall-clock | 14 m 53 s | **7 m 58 s** (−46%) |
| When the oracle first runs | on the tag | **before the tag, on demand** |
| Tag pushes this exit | 1 | **1** (and green first try) |
| A pixel failure costs | a second dispatch + download + re-tag | **the failing run mints its own candidates** |
| Billed job-minutes per tag run | ~14.8 | ~18.6 (+26%) — see §5, this is a deliberate trade |

The wall-clock number is the one that matters: it is what a human waits for, and it is paid several
times per exit. Billed minutes went *up*, and that is a trade made with open eyes.

---

## 2. The rehearsal (commit 1)

`gh workflow run ci.yml -f job=e2e` now runs the browser oracle on any ref, with no tag involved.
It is not a copy of the oracle — it is the **same job**, one `if:`, entered two ways, so a rehearsal
cannot go green while the tag run reds.

**Run 29291878002** — the first rehearsal ever dispatched, on main's HEAD:

- `success`, 15 m 26 s (this is also the honest "before" measurement of the un-sharded suite).
- `app`, `pipeline` and `vrt-baselines`: all **skipped**. G0's sit-out condition holds for dispatch
  runs, so a rehearsal costs the oracle and nothing else.
- No 422. The input value was accepted because the commit defining it was already on the target ref.

**The 422 trap is real and the plan was right to shout about it.** GitHub validates
`workflow_dispatch` inputs against the workflow file **on the target ref**. Push first, then dispatch.

---

## 3. The bug the rehearsal exposed on its first run

**G0's concurrency group was `ci-${{ github.ref }}` with `cancel-in-progress: true`.** A rehearsal
dispatched on main carries `github.ref == refs/heads/main` — *the same ref, and therefore the same
group,* as main's own push run.

Observed, live, at 23:0x UTC: dispatching run **29291878002** (the rehearsal) **cancelled run
29291818293** — the push run of the very commit it was rehearsing.

The reverse direction is the dangerous one. Push a docs commit while a 9-minute rehearsal is
running and **the rehearsal dies**, and the exit walks to its tag believing it rehearsed. That is
the "gate that silently never runs" disease, which this workflow's own header warns about — arriving
by a door nobody had thought about, because before G1 there was nothing to collide with.

Fixed in `a0644c6`: `github.event_name` joins the group. Every supersede-cancel G0 bought still
holds (push-vs-push and tag-vs-retagged-tag share an event); a dispatch now lives in its own lane.

**Proven:** run 29292729474 (push) and run 29292738991 (rehearsal) ran to completion **side by side**
on the same ref. The exit ritual deliberately overlaps the branch push and the rehearsal, so this had
to work, and now does.

---

## 4. The shards (commit 2)

The e2e job became a matrix of three legs — `desktop`, `phone`, `wide` — each on its own runner with
its own Postgres service container. **`playwright.config.ts` was not edited.**

`workers: 1` is not weakened. It exists because seeded specs write to the database (watchlist adds),
so two specs sharing *one* database could race. Three legs are three throwaway databases that cannot
see each other, which dissolves the sharing without touching the rule: each leg is still one worker,
still serial, still seeing exactly the seed it expects.

Measured, across three sharded runs:

| leg | rehearsal #1 (29292738991) | exit rehearsal (29294119059) | tag run (29294523392) |
|---|---|---|---|
| `wide` | 3 m 16 s | 3 m 12 s | 3 m 26 s |
| `desktop` | 7 m 31 s | 7 m 49 s | 7 m 53 s |
| `phone` | 8 m 10 s | 7 m 47 s | 7 m 15 s |
| **wall-clock** | **8 m 12 s** | **7 m 49 s** | **7 m 58 s** |

Against the un-sharded 15 m 26 s: **a 47–49% cut, landing exactly in the plan's predicted 7–9 min.**

`wide` is the short leg, as predicted — `playwright.config.ts` scopes it to `vrt+hardening` via
`testMatch`, so it shoots the wide grid, sweeps for sideways scroll, and stops. **3 m 26 s.**

`fail-fast: false` — a red desktop leg must not cancel phone. At an exit you want the whole truth
from one run, not the first failure and another 8-minute round trip to learn the rest. This was not
theoretical: see §5, where two legs red and the third finished green.

---

## 5. The trade this makes, stated plainly

Sharding **raises** the bill and **lowers** the wait:

- Billed job-minutes on a tag run: ~14.8 → ~18.6 (+26%). Three legs each pay their own `npm ci`,
  Playwright install, migrate+seed, and production build. That fixed setup is now paid three times.
- Wall-clock: 14 m 53 s → 7 m 58 s (−46%).

That is the right trade for this build and it is worth saying why: the thing this plan exists to kill
is *a human waiting at an exit*, several times per phase, and CI minutes are cheap next to that. G0
bought back ~21% of billed minutes by deleting the duplicated tag jobs; G1 spends some of it. Booked,
not hidden.

---

## 6. Auto-mint, and proving it can fail honestly (commit 3)

A rehearsal that reds on pixels now mints its own candidate baselines. Guarded: the step only fires
when `test-results/**/*-actual.png` exists — the precise witness of a snapshot *comparison* failure.
A red **assertion** leaves no such file and must not buy four minutes of photography.

### The ordering bug, caught before it shipped

**Playwright empties its output directory at the start of every run.** So the mint's re-run of
`vrt.spec.ts` **deletes `test-results/`** — including the expected/actual/diff triptych, which is the
one thing a pixel failure owes you. The failure-artifact upload therefore runs **before** the mint.
Photograph the crime scene before rebuilding on it.

### The proof (scratch branch `g1-mint-proof`, run 29293233570)

One deliberate line: `gap-12` → `gap-14` on the `/styleguide` wrapper. Nothing else in the tree.

| leg | result | artifacts |
|---|---|---|
| `desktop` | **failure** (pixels) | `playwright-failures-desktop`, `vrt-baselines-candidate-desktop` |
| `phone` | **failure** (pixels) | `playwright-failures-phone`, `vrt-baselines-candidate-phone` |
| `wide` | **success** | none — all four failure steps `skipped` |

`wide` is green because there is no `styleguide-*-wide` baseline, and it **finished anyway** while the
other two were red. That is `fail-fast: false`, demonstrated rather than asserted.

The step trace on a red leg is exactly the intended order:

```
failure   The oracle (desktop)
success   Upload the failure artifacts (the expected/actual/diff images live here)
success   Was it the pixels, or was it an assertion? (`*-actual.png` is the witness)
success   Mint CANDIDATE baselines for this leg
success   Upload them — a candidate for your eyes, never an auto-commit
```

The diff image was opened. It shows the masthead unchanged and every section below it displaced
progressively further down the page — the exact signature of a gap that grew between every section,
and nothing else. **The branch was then deleted, local and remote. Nothing merged.**

### What the picture taught us — the finding that changed the skill

Only **2** shots failed on the desktop leg. The candidate artifact came back with **6** byte-different
files:

| | failed the comparison | byte-different in the candidate |
|---|---|---|
| desktop | 2 (`styleguide-light`, `styleguide-dark`) | **6** |
| phone | 2 (same) | **5** |

The extras — `desk-light`, `desk-dark`, `ticker-dark`, `track-record-light` — **cannot** have changed:
the edit was in `app/app/styleguide/page.tsx`, which no other room imports. They passed their
comparison, correctly, inside the 600-pixel tolerance, and left no `*-diff.png`. They came back
different anyway because **`--update-snapshots=all` re-photographs every baseline**, and rasterisation
jitters a few dozen pixels between runs.

`=all` stays — it is an untouchable, and it is the only reason a real change hiding inside the
tolerance ever gets caught. But it means **the candidate directory is every shot, not the shots that
moved.** Copy the whole thing and you commit four files you cannot explain, which breaks the one rule
the VRT suite has.

This is very likely a large share of the churn the analysis measured (283 snapshot files rewritten;
whole-world re-bakes of 44 and 58 files). `.claude/skills/vrt-update/SKILL.md` now says it plainly:
**the triptych is the list of what moved; the candidate is only where you fetch those files from.**

---

## 7. The exit itself — the first outing of the reformed ritual

Local gate: typecheck · lint · **577** app unit tests · **464** pytest (26 Postgres-backed skip on this
Mac) · build · `check:routes` · `check:bundles` (worst 196.2 KB, under the 200 KB ceiling) ·
`check:fonts` (317 KB headroom) · `e2e:local` (177 passed, 301 skipped) · `check:drift` (all 20 rules).

Once per phase, local only: **`check:migrations` — the live database is running the schema in this
repo.** CI structurally cannot answer this.

Deploy checks, run **in parallel with the rehearsal** (that overlap is the reform):
- `check:nav`: every cached room 41–113 ms warm, all `HIT`. `/settings` 432 ms, every sample `MISS` —
  **correct, not a regression**: it is `force-dynamic` by design (the one writer room; a page may be
  cached, or written to and read back in one click, never both), and it is excluded from B1 with an
  argued exemption. B2 is in report mode for exactly this reason.
- `check:lighthouse`: **CLS 0.000** and **first-load JS 177 KB** — both hard gates pass. Performance 77
  / LCP 5.03 s are the advisory synthetic-4G numbers already logged in DECISIONS.

Then: push → branch run green (29294111915) → **rehearse** (29294119059, green, 7 m 49 s) → tag
`gate-1` **on the exact rehearsed SHA** → tag run green **first try** (29294523392, 7 m 58 s).

The tag was placed on `6a74140` by SHA, not on `HEAD`, deliberately — see §8.

### The number this phase was asked to produce

> *"`gate-1` is the first tag expected to go green on the first try, because the rehearsal will have
> already run the identical suite on the identical SHA. If it does, say so."*

**It did.** One tag push. One green. The tag never moved. The rehearsal (29294119059) and the tag run
(29294523392) ran the same three legs on the same SHA `6a74140` and agreed, which is the entire point:
the tag run is now a confirmation, not a discovery.

---

## 8. Something else that moves `main`: the heartbeat bot

Mid-endgame, a push to `main` was **rejected** — the remote had a commit this session did not write:

```
92f7d72  chore: heartbeat   github-actions[bot]
```

It is an **empty** commit (no files changed), pushed by `nightly-a.yml` after each *full* nightly run.
Its purpose is real: GitHub disables scheduled workflows in a private repo after 60 days without repo
activity, so one empty commit a night keeps the schedule alive. It is legitimate machinery, not a
rogue push, and it was rebased onto cleanly — nothing was rewritten.

**But it means `main` can move under an endgame, at 22:37 UTC-ish, every night.** The consequence for
the ritual: **tag the SHA you rehearsed, by SHA — never `HEAD`.** If the heartbeat lands between the
rehearsal and the tag, tagging `HEAD` would put the tag on a commit the oracle never saw. The tree is
byte-identical so the risk is currently nil in practice, but the invariant ("the suite ran on the
exact tagged SHA") is an untouchable and should hold in letter, not just in luck.

**This has a bearing on G2.** `paths-ignore` filters on *changed paths*, and an empty commit changes
none. Whether GitHub runs it, skips it, or does something else is not documented anywhere we should
trust — G2 must find out by looking, the same way this phase found the concurrency collision.

---

## 9. The runs, for the record

| run | what | result |
|---|---|---|
| 29291818293 | push run of `87ebcdc` | **cancelled** — by the rehearsal. The collision. |
| 29291878002 | first rehearsal, un-sharded | success, **15 m 26 s** (the "before") |
| 29292729474 | push run, commits 2–4 | success — **coexisted** with the rehearsal |
| 29292738991 | rehearsal, sharded | success, **8 m 12 s** |
| 29293233570 | scratch branch, deliberate pixel change | **failure** (desktop, phone) + green `wide`; 4 artifacts |
| 29294111915 | branch run, candidate SHA | success |
| 29294119059 | **exit rehearsal**, candidate SHA | success, **7 m 49 s** |
| 29294523392 | **`gate-1` tag run** | **success, first try, 7 m 58 s** |

---

## 10. Gate at exit

**20 drift rules · 76 VRT baselines · 22 e2e specs · tag run 7 m 58 s.**

**No growth.** G1 added no drift rule, no baseline, no spec, and no test. It moved an existing suite
earlier and cut it into three. The only thing that grew is the number of ways to *run* the oracle,
which is not gate surface — it is gate access.
