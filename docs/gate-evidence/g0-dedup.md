# G0 — Stop paying twice (2026-07-13)

The first phase of GATE-EFFICIENCY-PLAN.md. It changes **where and how often** the existing checks
run. It does not change **what** they check — with one exception, and that exception makes the gate
*stronger*: `check:drift` now runs in CI, and until today it ran in no CI workflow at all.

Everything below was measured against this repo's own Actions runs, not estimated.

---

## 1. The before picture, measured

The last green `nc-final` tag run — run `29286543491`, the one that certified the News & Control
build — did this:

| Job | Result | Duration |
|---|---|---|
| app — typecheck, lint, unit, build | success | 2.12 min |
| pipeline — pytest | success | 0.82 min |
| **e2e + VRT + PWA (the browser oracle)** | success | **15.73 min** |
| VRT — generate baselines | skipped | — |
| **run wall-clock** | | **15.8 min** |

The `app` and `pipeline` jobs in that list are the finding. That tag pointed at a SHA which had
run both jobs green on `main` **one second earlier** — run `29286513129`, same commit. Two full
jobs, ~2.9 billed minutes, re-proving a thing that was already proven, on every tag, forever. The
analysis put this class at ~43% of all CI minutes in the build (§2.3-#5).

And the tag itself moved six times. From the run list, `nc-final` on 2026-07-13:

| time (UTC) | result | note |
|---|---|---|
| 20:22 | **cancelled** | 785 s — superseded, but nothing cancelled it; it ran on |
| 20:35 | failure | the oracle found something |
| 21:02 | (mint) | baselines |
| 21:10 | success | the actual green gate |
| 21:27 | **cancelled** | tag re-pointed *after* green |
| 21:29 | success | re-pointed again |

Two of those cancellations were hand-cancellations of runs that had no business still being alive.

---

## 2. What G0 changed

Six edits to `.github/workflows/ci.yml`, one new test, two text repairs. Commit `5876861`.

1. **`concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.** A superseded push
   or a re-pushed tag now kills its predecessor the moment the successor starts. Branch refs and
   tag refs are distinct groups, so tagging a commit never cancels that commit's own `main` run.
2. **`app` and `pipeline` sit out tag runs and dispatch runs** —
   `if: github.event_name == 'push' && !startsWith(github.ref, 'refs/tags/')`. A tag now runs
   exactly one job: the browser oracle, which is the only thing a tag is for.
3. **`check:drift` joined the `app` job.** Twenty rules, a one-second grep, and it had never run in
   CI. It was local discipline only: if a session forgot gate step 5, nothing mechanical noticed.
4. **`gate-*` and `pd-*` wired** into `on.push.tags` **and** the oracle's `if:`.
5. **`pipeline/tests/test_ci_tag_families.py`** — the header's oldest warning, mechanized.
6. **Playwright's Chromium and uv's wheels are cached.**

Plus: the header's claim that Lighthouse "runs on the phase-exit tags" is deleted. No Lighthouse job
has ever existed in any workflow in this repo's history; it runs locally via `check:lighthouse`.

---

## 3. The guard that was a comment, and the bug it caught immediately

Since the first phase, `ci.yml`'s header has said:

> The tag list here and the `if:` conditions on the tag-gated jobs below must be kept in step. A tag
> family that appears in one but not the other is a gate that silently never runs.

A comment cannot fail a build. `test_ci_tag_families.py` reads the file and does.

It was written RED first, and the RED it produced was **not** a contrived one. Mid-edit, having
added `gate-*` and `pd-*` to the trigger but not yet to the oracle's `if:`, the test said:

```
AssertionError: ci.yml's tag families have drifted apart.
    on.push.tags runs CI for: ['feel-', 'gate-', 'nc-', 'pd-', 'phase-', 'redesign-']
    the e2e oracle runs for:  ['feel-', 'nc-', 'phase-', 'redesign-']
    only in the trigger (tag runs, but the oracle sits it out — a GREEN THAT PROVED NOTHING):
      ['gate-', 'pd-']
    only in the gate (the tag starts no run at all): none
```

That is exactly the disease, caught in the exact half-wired state that produces it: `git tag gate-0`
would have started a run, the run would have gone **green**, and the browser oracle — the only job
that can see pixels, seeded data, or accessibility — would never have executed. The phase would have
"passed its gate" without one.

It bit a second time, more usefully. My first version of the test looked for any job `if:` containing
the string `refs/tags/` — but edit #2 above put that same string into the `app` and `pipeline`
conditions, where it means the *opposite* (sit tag runs out). The test refused to guess and failed
loudly ("expected exactly one job gated on named tag families; found 3"). It now matches on a *named
family* (`refs/tags/nc-`), which is the thing it actually cares about. A guard that fails when it is
confused is worth more than one that quietly picks a side.

---

## 4. The after picture, measured

### 4.1 The branch run — run `29290147772`, green

| Job | Result | Duration |
|---|---|---|
| app — typecheck, lint, **drift**, unit, build | success | 2.45 min |
| pipeline — pytest | success | 0.80 min |
| e2e (the browser oracle) | **skipped** | — |
| VRT — generate baselines | skipped | — |

Two proofs pulled from that run's own logs:

- `Anti-drift rules (gate step 5 — was local-only until G0)` → **`All 20 anti-drift rules pass.`**
  The first time in this build's history that the drift rules have run in CI.
- `pipeline — pytest` → **`490 passed`** (464 locally + the 26 Postgres-backed tests that skip on
  this Mac), so the two new tag-family tests ran in CI as well as locally.

The app job cost ~0.3 min more than before, which is `check:drift` plus a cold Playwright/uv cache.
That is the price of the stronger gate, and it is paid on branch pushes — never on the tag.

### 4.2 The cancellation proof

This evidence file was pushed in two commits, the second landing inside the first's CI run — the
exact "superseded push" case that used to leave a zombie running.

```
29290386804 | in_progress |    -    | docs(g0): evidence — the branch run, green, with dri…
29290367271 | completed   | cancelled | docs(g0): evidence — the before picture, measured
29290147772 | completed   | success | ci(g0): a tag runs only the oracle, drift joins CI,…
```

Run `29290367271` was killed the instant its successor started. **It lived 40 seconds.** The
equivalent superseded run at `nc-final` — same situation, no concurrency group — ran for **785
seconds** before anyone noticed, and a 13-minute one had to be cancelled by hand.

### 4.3 The `gate-0` tag run — run `29290643430`, green on the first try

| Job | Result | Duration |
|---|---|---|
| **e2e + VRT + PWA + axe (the browser oracle)** | **success** | **14.82 min** |
| app — typecheck, lint, drift, unit, build | **skipped** | — |
| pipeline — pytest | **skipped** | — |
| VRT — generate baselines | skipped | — |
| **run wall-clock** | | **14.88 min** |

That job list is the phase. A tag now runs the oracle and nothing else.

---

## 5. What this actually bought, stated honestly

| | before (`nc-final`) | after (`gate-0`) |
|---|---|---|
| Jobs on a tag run | app + pipeline + e2e | **e2e only** |
| Billed job-minutes per tag run | 18.67 | **14.82** (−3.85, −21%) |
| Tag-run **wall-clock** | 15.8 min | 14.88 min |
| A superseded run | ran on (785 s observed) | **cancelled in 40 s** |
| `check:drift` in CI | never ran | **runs on every branch push** |
| Tag-family drift | a comment | **a failing test** |
| Tag pushes for this exit | up to 6 | **1** |

**The wall-clock barely moved, and that is expected.** The `app` and `pipeline` jobs ran in
*parallel* with the oracle, so deleting them removes billed minutes and heat, not waiting. **The
15-minute wait is one serial job, and killing it is G1's work, not G0's** (shard the oracle into
three legs → ~7–9 min). G0's job was to stop paying twice, to make a superseded run die, and to close
the two holes where a gate could pass without running. It did those three things.

The honest headline: **one tag push, one green run, first try, and the tag has not moved.** The
endgame that produced `nc-final` needed six.

---

## 6. Gate at exit

**20 drift rules · 76 VRT baselines · 22 e2e specs · tag run 14 m 53 s.**

No growth this phase: G0 added no drift rule, no baseline, and no spec. It added **one pytest**
(`test_ci_tag_families.py`, 2 cases — 464 local / 490 in CI) and moved an existing 1-second check
(`check:drift`) into CI where it can finally fail a build.

