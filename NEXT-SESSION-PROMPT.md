# NEXT-SESSION-PROMPT.md

## The News & Control build is CLOSED (2026-07-13)

All eight phases, N0 → N7, are done and tagged: `nc-0` … `nc-6`, and **`nc-final`** with green CI.
There is no unfinished work in it, nothing in flight, and no half-landed change in the tree.

**Read `PROGRESS.md` first.** Then `docs/nc-evidence/n7-hardening.md`, which carries the closing
table for all seven evidence chapters and the two things N7 found — both of them guards that were
not guarding anything.

---

## There is a NEW PLAN in the tree, and it is not mine

While N7 was running, a **parallel planning session** wrote two files that are **untracked and
uncommitted**:

```
POLISH-AND-DEPTH-PLAN.md            ("The Second Edition")
docs/src/polish-and-depth-plan.html
```

I did not write them and I did not commit them — they are not part of `nc-final`, and I do not commit
or overwrite work I did not create. The file's own header says it was authored *"while the News &
Control build's last phase (N7) was still pending in a parallel session"*, and that where it and the
tree disagree on a detail, **the tree wins on the detail and the plan wins on the intent.**

**If Bishan wants that plan executed, that is the next build.** Read it in full, run the CLAUDE.md
session ritual, and follow its own phase structure and Autonomy Contract — one phase per session.
Commit those two files first (they are the contract), or confirm with Bishan that they should be.

**If not**, there is no queued work. The app is complete against DEVELOPMENT-PLAN, UI-REDESIGN-PLAN,
APP-FEEL-PLAN and NEWS-AND-CONTROL-PLAN.

---

## What is waiting for Bishan, in priority order (none of it blocks a build)

1. **P-2 — the GitHub token.** Two minutes, and it turns the entire control room on. Every button is
   dark in production without it. A **fine-grained PAT**, *this repository only*, **Actions: read and
   write**, added to **Vercel** as `GH_DISPATCH_TOKEN`. The whole path is proven working against real
   GitHub (`docs/nc-evidence/n6-control.md` §6) — it is a secret and nothing else.
2. **Q-N6-1 — the Saturday row.** Production holds one `pipeline_run` stamped 2026-07-11, a day the
   market never opened. The **cause** is fixed (`job_a` now skips a non-session day); I did not delete
   production data on my own judgment. The SQL is in `QUESTIONS-FOR-BISHANT.md`.
3. **P-1 — the R2 media bucket.** Absent. The Front Page renders its designed generated cards; every
   article in the recorded feed carried a publisher image, so real photographs appear the moment a
   bucket exists.
4. **The iOS device pass.** There is no iPhone here. Everything a machine can check runs on every
   push; the checklist for the ten minutes only a real device can do is in QUESTIONS.

---

## The hazards, if you build anything on top of this

Earned, not theoretical. Every one cost a real bug.

- **OPEN THE PICTURE AND LOOK AT IT.** Nine real bugs in this build were found that way and by no
  other means. A green suite is evidence about the tests, not about the system.
- **A SWEEP THAT SWEPT NOTHING IS A PASS.** N7's finding. A guard that walks routes measures whatever
  is on the screen — a 404 page, a login form, an unhydrated island — and reports all three as clean.
  Make every guard prove it measured something. **And the status code is not the witness:** a
  `notFound()` raised inside a statically-generated route answers **HTTP 200** with the 404 page in
  the body. Only an unmatched path gets a real 404.
- **THE VENDOR'S OWN DOCUMENTATION IS NOT A RECORDING.** GitHub's docs were wrong about GitHub's API.
  One `curl` before you design costs two minutes and can invert the design.
- **A FAKE MUST BE NO KINDER THAN THE THING IT STANDS FOR.** And a function with no real caller has no
  real test, whatever coverage says.
- **AN `as` CAST ON A PARSED PAYLOAD IS A PROMISE, NOT A CHECK.** JSON has no Date type.
- **NEVER HAND-WRITE A FIXTURE THAT LOOKS RECORDED.** It is not a weak test — it is an inverted one.
- **TWO SOURCES OF TRUTH FOR ONE DOCUMENT IS A SLOW-MOTION LIE.** N7's other finding. `DEVELOPMENT-PLAN.md`
  **and** the PDF are both generated from `docs/src/dp-*.html` now — edit the parts, then run
  `build-plan-md.py` **and** `build-plan-pdf.py`. Never edit a generated file; it says so in its own
  first line, and I still did it once this phase.
- **CI's database is DISPOSABLE and can tell you NOTHING about production's.** `npm run
  check:migrations` is the instrument that can, and it is in the standing gate. A Vercel deploy
  applies migrations.
- **There is no local Postgres on this Mac.** ~26 pipeline tests and every seeded e2e journey skip
  locally — **CI is the only oracle for anything seeded** (it sets `MSM_SEEDED=1`).
- **VRT baselines are BORN IN CI:** `gh workflow run ci.yml -f job=vrt-baselines`, download the
  artifact, commit it. Never shoot a baseline on macOS. The e2e+VRT job is TAG-GATED.
- **The `run-name:` line in `nightly-a.yml` / `nightly-b.yml` is LOAD-BEARING.** The dispatch API
  returns no run id, so the app recovers it by matching that name. Delete the line and nothing fails,
  every test but one passes, and the control room goes permanently blind.
- Prepend `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` to node commands.
  `npm test` runs from `app/`; `uv run pytest` runs from `pipeline/`.
