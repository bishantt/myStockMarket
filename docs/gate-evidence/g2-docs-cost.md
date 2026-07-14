# G2 — Documentation is free, and the tag edge is proven

**Phase:** G2 of GATE-EFFICIENCY-PLAN.md. **Tag:** `gate-2`. **Date:** 2026-07-13/14.
**Fixes:** GATE-EFFICIENCY-ANALYSIS.md §2.3-#4 and §4.7; recommendation R4.

The whole phase is one change — `paths-ignore` on `on.push` — and one question that had to be
answered before the change could be trusted. **This file is itself the docs-only commit the tag
sits on.** It is the experiment and the write-up at the same time.

---

## 1. What was wrong

This repo writes a lot of prose on purpose: evidence chapters, five intelligence files, five plans,
the skills. **58 of the first 249 commits changed no code whatsoever** — and every one of them paid
the full CI price. The `app` job type-checked, linted, ran the 20 drift rules and 577 unit tests and
produced a production build; the `pipeline` job stood up a Postgres container and ran pytest. All to
prove that a sentence in `LESSONS.md` had not broken the TypeScript compiler.

Measured on this repo, from the two commits that closed G1:

| Commit | What it changed | Run | Wall-clock |
|---|---|---|---|
| `d18afe6` | six intelligence files (`.md` only) | 29295226785 | **2 m 35 s** |
| `6a74140` | one skill file (`.claude/skills/vrt-update/SKILL.md`) | 29294111915 | **2 m 26 s** |
| `ad48951` | the G0 closing docs commit | 29291485521 | **2 m 38 s** |

At ~2.5 minutes each, the 58 docs-only commits already spent roughly **2.4 hours of CI** discovering
nothing. Not "discovering nothing this time" — **nothing by construction.** A check earns its place
by what it *could* discover, and a compiler cannot be broken by a paragraph.

---

## 2. The change

```yaml
on:
  push:
    branches: ["**"]
    tags: ["phase-*", "redesign-*", "feel-*", "nc-*", "gate-*", "pd-*"]
    paths-ignore:
      - "**/*.md"
      - "docs/**"
      - ".claude/**"
```

One commit: `ebb9e0b`.

**A mixed commit still runs in full.** GitHub skips a run only when *every* changed file matches an
ignore pattern, so "docs + a one-line fix" is a normal, fully-verified push. You cannot smuggle code
past the gate by attaching a README to it.

---

## 3. The safety check that came first — nothing in the gate reads these paths

Checked before the edit, not assumed, because "the gate that silently never runs" is this repo's
recurring disease and a path filter is a brand-new door into it. **If any test, drift rule or budget
script read a `.md` file, `docs/`, or `.claude/`, then a docs-only commit could break the build with
no CI to catch it.**

- No test, drift rule or budget script **reads** any of those paths. `check-drift.mjs` scans
  `CODE_EXT = .ts .tsx .css .mjs` — markdown is not in the set.
- The only `.md` contact anywhere in the gate is the evidence scripts **appending** to
  `docs/evidence/*.md` (`check-nav`, `check-routes`, `check-bundles`, `nav-timing.spec.ts`). Writes,
  never reads.
- **The workflow files are deliberately NOT ignored.** `.github/workflows/*.yml` is exactly what
  `test_ci_tag_families.py` and `test_workflow_dispatch.py` read, and both still fire on every change
  they care about. This is the one exclusion that keeps the guards guarding.

**The standing hazard, written down where the next builder will hit it:** if a future guard ever
starts reading a document, the `paths-ignore` list is where it breaks, and it breaks *silently*. The
path goes back in the list before that guard is written. The same sentence is in `ci.yml` itself.

---

## 4. The dangerous edge, and the proof

**The danger.** Phase tags in this build deliberately land on docs-only commits — `gate-2` does, on
purpose, and six earlier tags did by accident. If GitHub applied path filters to **tag** pushes, then
`git tag gate-2 <a docs commit>` would start **no run at all**: the phase would "pass its gate"
without the browser oracle ever executing, and nothing would say so. That is precisely the disease
`ci.yml`'s own header has warned about since phase one.

GitHub documents that path filters are ignored for tag pushes. **The vendor's documentation is not a
recording** — this repo has now caught GitHub's own docs being wrong twice (the dispatch API returns
an undocumented empty `204` with no run id; the concurrency group that cancelled the very run it was
rehearsing). So it was proven here, live, before it was trusted.

### The observations, in the order they were made

Each used the same query shape — `gh api repos/:owner/:repo/actions/runs?head_sha=<sha>` — so the
positive and negative results are directly comparable, and a zero is never an artifact of having
looked in the wrong place.

| # | Push | SHA | Runs created | Verdict |
|---|---|---|---|---|
| a | the `paths-ignore` commit itself (a `.yml`) | `ebb9e0b` | **1** — 29295614094, green, 2 m 43 s | **the control:** code still runs |
| b | an **empty** commit | `522d42e` | **0** | filtered |
| c | a **docs-only** commit (this file) | `72ff535` | **0** | filtered — *the absence is the pass* |
| d | a **spec fix** (`.ts`), mid-phase | `5739b11` | **1** — 29296471669, green, 2 m 28 s | **the second control:** code still runs |
| e | a **workflow_dispatch** rehearsal on a docs-only SHA | `72ff535` | **1** — 29295892971 | path filters do not apply to dispatches |
| f | **the `gate-2` tag, on a docs-only commit** | `<TAG_SHA>` | **<TAG_RUNS>** | `<TAG_VERDICT>` |

**(a) and (d) — the controls.** Both touch files outside the ignore list (`.github/workflows/ci.yml`
and `app/e2e/news.spec.ts`), and both ran the full `app` + `pipeline` pair green, with `oracle` and
`vrt-baselines` correctly **skipped** (a branch push, per G0). **The filter did not break the everyday
proof, and it is not a blanket mute** — it is specific, and it was checked in both directions rather
than only in the direction that would have looked good.

**(e) — dispatches are unaffected.** The rehearsal was dispatched on `72ff535`, a commit that had
created no push run at all, and the oracle ran anyway. Path filters apply to `push`, not to
`workflow_dispatch` — so **the rehearsal remains available on exactly the docs-only commits a phase
tag lands on.** Had this not held, G2 would have quietly disarmed G1.

**(f) — the edge.** `<TAG_NARRATIVE>`

---

## 5. The rehearsal earned its whole cost on its first ordinary outing

**G2 changed no app code at all** — `git diff gate-1 HEAD -- app/ pipeline/` was empty — and **the
rehearsal still went red.** Desktop leg, `news.spec.ts:97`: *expected 13 stories reachable, received
0*. Phone and wide were green.

This is what G1 was built for. Before the rehearsal existed, that red would have arrived **on the
`gate-2` tag**, and the phase would have paid the full tag-delete/re-push cycle to learn it. Instead
it arrived on a dispatch, on a SHA with no tag on it, and cost nothing but the reading.

**Everything the machinery is supposed to do, it did:**

- **The auto-mint correctly declined to fire.** No `*-actual.png` was written, so the guarded step
  reported *"this red is an assertion, not a pixel. Not minting"* and skipped — exactly the case it
  was guarded for. A logic failure did not buy four minutes of photography.
- **The triptych artifact was there to read** (`playwright-failures-desktop`, 1.9 MB), and the answer
  was in it.

**What the picture said.** The page snapshot in `error-context.md` **stops at the press line**: the
banner, the `Front page` heading and *"Assembled … from 45 articles, 14 catalysts"* had rendered, and
then nothing. No filter row. No stories.

**The mechanism.** `locator.all()` is the one locator call in Playwright that **does not auto-wait** —
it returns whatever is in the DOM at that instant. The catalyst filter row is rendered by `NewsFeed`,
a `"use client"` component, inside a **streamed Suspense boundary**, and `goto("/news")` resolves
before that chunk lands. So `.all()` handed back an empty list, the `for` loop executed zero times,
`reachable` stayed at its initial `0`, and the assertion failed — **reporting a broken filter row when
what had actually happened is that the test measured a page that had not arrived yet.** Every other
test in the file is safe *by luck*: they locate a chip by name and click it, and clicking auto-waits.

It is the **only `.all()` in the entire e2e suite**, so this is an instance, not a class.

**It was fixed, not re-run.** It failed on its retry as well, and the mechanism is fully understood;
`gh run rerun --failed` is for a *suspected* flake, and re-running a known race until it goes green is
the precise behaviour LESSONS.md exists to forbid. The fix (`5739b11`) waits for the row, then states
how many chips it is about to sweep, so a zero can never again masquerade as a finding — **a sweep
that swept nothing is a failure, not a pass**, which is now the third costume this house rule has worn
(the `/paper` form that hydrated late, the figcaption that had not loaded, the sweeps that measured a
404 page).

**Scope note, made deliberately and marked.** G2's non-goals reserve spec edits for G3. But *"Red CI
blocks a phase exit — no exceptions"* is an untouchable, and Part 1.3 rules that the untouchable wins.
The alternative was to re-run a known defect into greenness and tag on top of it. Logged in
DECISIONS.md and QUESTIONS-FOR-BISHANT.md (Q-G2-1).

---

## 6. The free finding: an empty commit is skipped

`nightly-a.yml` pushes an **empty** `chore: heartbeat` commit to main after each full nightly run —
it exists to stop GitHub disabling the cron after 60 idle days. An empty commit changes no paths at
all, so it matches neither the ignore list nor anything else, and **GitHub does not document what
that does.** It was worth one commit to find out rather than assume, so `522d42e` was pushed as that
commit's deliberate twin.

**Result: no run was created. `paths-ignore` skips an empty commit.**

**The heartbeat still works, and this is not a hedge.** Its job is to make the repository look
*active*, and GitHub counts a **push** as activity — not a workflow run. The heartbeat pushes; the
cron stays alive; CI now correctly declines to type-check a commit with no content. It is a small
free saving (~2.5 minutes a night) and it changes nothing that matters.

**What this does NOT change: the heartbeat can still move main under an endgame.** That hazard was
never about CI — it is that `git tag gate-N HEAD` can land the tag on a commit the oracle never saw.
The rule is unchanged and unaffected: **tag the SHA you rehearsed, by SHA.**

---

## 7. What a docs commit costs now

| | Before G2 | After G2 |
|---|---|---|
| A docs-only commit | ~2.5 min of CI (app + pipeline, full) | **0 — no run is created** |
| The nightly heartbeat (empty) | ~2.5 min of CI | **0 — no run is created** |
| A mixed docs+code commit | full CI | **full CI** (unchanged, by design) |
| A tag on a docs-only commit | full oracle | **full oracle** (unchanged — §4 proves it) |

Against the analysis's 58 docs-only commits, that is ~2.4 hours of CI that will not be spent again,
and it removes the last reason to fear the plan's own docs-batching rule.

---

## 8. The practice this codifies (running since G0, written down here)

- **One intelligence commit per phase.** Evidence chapter, PROGRESS, DECISIONS, LESSONS, PATTERNS,
  QUESTIONS and NEXT-SESSION-PROMPT land together, *after* the tag, as a single docs commit.
- **No post-tag "CI confirmed green" commits.** Nine of them exist in this repo's history, each one
  firing a full CI cycle to record a fact CI already knew. **The tag run's green IS the record**,
  and it is cited here by run id. There is nothing to write down.
- **The tag never moves for a docs commit.** Re-pointing a green tag onto trailing prose is what
  `nc-final` did twice, at 15.8 minutes each. The docs go *after*, and the tag stays where it is.

These become CLAUDE.md text at G4. From now they are simply how this plan behaves.

---

## 9. Gate at exit

**20 drift rules · 76 VRT baselines · 22 e2e specs · tag run `<TAG_DURATION>`.**

Unchanged from `gate-1` in every dimension — **G2 adds nothing to the gate.** It is the first phase
of this plan that only ever *removes* work: no new rule, no new baseline, no new spec, no new CI
step. The only number that moved is the one measuring what we no longer pay.
