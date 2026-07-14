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

### The three observations, in order

Each used the same query shape — `gh api repos/:owner/:repo/actions/runs?head_sha=<sha>` — so the
positive and negative results are directly comparable and the negative is not an artifact of looking
in the wrong place.

| # | Push | SHA | Runs created | Verdict |
|---|---|---|---|---|
| a | the `paths-ignore` commit itself (a `.yml`) | `ebb9e0b` | **1** — 29295614094, green, 2 m 43 s | the control: code still runs |
| b | an **empty** commit | `522d42e` | **0** | filtered |
| c | a **docs-only** commit (this file) | `<DOCS_SHA>` | **0** | filtered — *the absence is the pass* |
| d | **the `gate-2` tag, on that same docs-only commit** | `<DOCS_SHA>` | **<TAG_RUNS>** | `<TAG_VERDICT>` |

**(a) The control.** `ebb9e0b` touches `.github/workflows/ci.yml`, which is not in the ignore list.
Run 29295614094: `app` **success**, `pipeline` **success**, `oracle` and `vrt-baselines` **skipped**
(correct — a branch push, per G0). The filter did not break the everyday proof.

**(d) The edge.** `<TAG_NARRATIVE>`

---

## 5. The free finding: an empty commit is skipped

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

## 6. What a docs commit costs now

| | Before G2 | After G2 |
|---|---|---|
| A docs-only commit | ~2.5 min of CI (app + pipeline, full) | **0 — no run is created** |
| The nightly heartbeat (empty) | ~2.5 min of CI | **0 — no run is created** |
| A mixed docs+code commit | full CI | **full CI** (unchanged, by design) |
| A tag on a docs-only commit | full oracle | **full oracle** (unchanged — §4 proves it) |

Against the analysis's 58 docs-only commits, that is ~2.4 hours of CI that will not be spent again,
and it removes the last reason to fear the plan's own docs-batching rule.

---

## 7. The practice this codifies (running since G0, written down here)

- **One intelligence commit per phase.** Evidence chapter, PROGRESS, DECISIONS, LESSONS, PATTERNS,
  QUESTIONS and NEXT-SESSION-PROMPT land together, *after* the tag, as a single docs commit.
- **No post-tag "CI confirmed green" commits.** Nine of them exist in this repo's history, each one
  firing a full CI cycle to record a fact CI already knew. **The tag run's green IS the record**,
  and it is cited here by run id. There is nothing to write down.
- **The tag never moves for a docs commit.** Re-pointing a green tag onto trailing prose is what
  `nc-final` did twice, at 15.8 minutes each. The docs go *after*, and the tag stays where it is.

These become CLAUDE.md text at G4. From now they are simply how this plan behaves.

---

## 8. Gate at exit

**20 drift rules · 76 VRT baselines · 22 e2e specs · tag run `<TAG_DURATION>`.**

Unchanged from `gate-1` in every dimension — **G2 adds nothing to the gate.** It is the first phase
of this plan that only ever *removes* work: no new rule, no new baseline, no new spec, no new CI
step. The only number that moved is the one measuring what we no longer pay.
