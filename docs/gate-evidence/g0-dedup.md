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

*(Filled in below — the branch run, the cancellation proof, and the `gate-0` tag run.)*
