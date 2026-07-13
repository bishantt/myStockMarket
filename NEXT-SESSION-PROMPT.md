You are Claude Opus 4.8, sole builder of myStockMarket. Continue executing NEWS-AND-CONTROL-PLAN.md
under its Autonomy Contract. **N0–N6 are DONE and tagged (nc-0 … nc-6).** One phase remains: **N7**.

## SESSION RHYTHM — ONE PHASE PER SESSION
Work N7, finish it properly, and stop. (Standing rule in CLAUDE.md.) At the end:
1. Tests green, the plan's standing gate passed, tagged `nc-final`, everything committed and pushed.
   Never stop mid-task or with a red build.
2. Bring EVERY intelligence file current: PROGRESS.md, DECISIONS.md, LESSONS.md, PATTERNS.md,
   QUESTIONS-FOR-BISHANT.md, plus the evidence table (`docs/nc-evidence/`). Write them as if the next
   session has NO memory of this one — because it won't.
3. Rewrite NEXT-SESSION-PROMPT.md (or retire it, if the build is genuinely done).
4. Report back in plain English. Then STOP.

Within a phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question. Anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and clearly marked.

## START HERE, IN THIS ORDER
1. Run the CLAUDE.md session ritual: `git pull` → read CLAUDE.md + PROGRESS.md + LESSONS.md → diff
   DECISIONS.md for any non-`[claude]` line (a user veto, rank 2.5 — honor it FIRST) → run both test
   suites → announce your checkpoint.
2. **`nc-6`'s CI is green — do not re-verify it.** Read `docs/nc-evidence/n6-control.md` once. It is
   the ground truth about what the control room actually does, and the seven places the plan was
   amended.
3. Execute **N7 — hardening, evidence, docs sync** (plan Part 9, N7).
4. Checkpoint per the rhythm above, and stop.

## WHAT N7 IS
Plan Part 9, N7. The last phase. Read it — but the substance is:
- **The docs sync.** DEVELOPMENT-PLAN.md, CLAUDE.md and the skills must agree with the code. N6 added
  a fourth pipeline mode (`compute`), a new `/settings` section, two new server surfaces
  (`/api/pipeline/status`, the dispatch action) and a new provisioning row — none of that is in
  CLAUDE.md's Commands block or the plan's route map yet.
- **The evidence tables.** All six exist (`n0-audit`, `n2-footprint`, `n3-board`, `n4-newsdesk`,
  `n5-frontpage`, `n6-control`). N7 owes the closing summary and any gaps.
- **Hardening.** The standing gate, end to end, on the tag: drift (20 rules), fonts, routes, nav,
  bundles, migrations, lighthouse, e2e + VRT + PWA.
- **`nc-final` tagged with green CI**, and a closing PROGRESS.md entry written for the user to read.

## THE ONE THING TO KNOW ABOUT N6, IF YOU READ NOTHING ELSE
**The plan's most confident technical claim was false, and I only found it because I made one real
API call before designing around it.** Plan 8.2 said the workflow-dispatch endpoint returns
`workflow_run_id`. GitHub's own REST docs say so too. **It returns 204 with an EMPTY BODY.** There is
no run id, and no `return_run_details` parameter.

So the app RECOVERS the run id: it stamps a `request_id` into each dispatch, the workflow prints it
into `run-name:`, and the app matches it in the runs list. **That `run-name:` line in
`.github/workflows/nightly-a.yml` and `nightly-b.yml` is load-bearing.** Delete it and nothing fails —
the workflow still runs, every test but one still passes — and the control room goes permanently
blind. `pipeline/tests/test_workflow_dispatch.py` guards it.

## PROVISIONING — THE ONE OPEN ITEM
- **P-2 (a GitHub PAT with `workflow` scope) is STILL NOT PROVISIONED.** Every button in the control
  room is dark in production; the panel says so, once, at the top, and renders every other state
  honestly. **The whole path is proven working** — I ran the app locally with a real token and fired
  real `macro` and `compute` runs at real GitHub; both dispatched, were found, were followed to
  "succeeded", decremented their caps and engaged their cooldowns (evidence §6). It is a secret and
  nothing else: a fine-grained PAT, this repo only, Actions read+write, added to **Vercel** as
  `GH_DISPATCH_TOKEN`. It is a [NEED] in QUESTIONS-FOR-BISHANT.
- **P-1 (R2 media bucket) is still ABSENT.** Not blocking. The Front Page renders its designed L4
  generated cards.
- **P-3 (ANTHROPIC_API_KEY) and P-5 (GOLDAPI_KEY) are CLOSED and verified live.**

## OPEN FOR THE USER (both in QUESTIONS-FOR-BISHANT, neither blocking)
- **Q-N6-1 [VETO?]** — production has a `pipeline_run` stamped **Saturday 2026-07-11**, a day the
  market never opened. A full run stamped Friday's bars with Saturday's date. I fixed the CAUSE
  (`job_a` now skips a non-session day — it was firing on every market holiday, ~9 times a year) but
  I did **not** delete production rows on my own judgment. The SQL is in QUESTIONS.
- **Q-N6-2 [FYI]** — a Friday nightly that fails cannot be recovered until Monday. Cost is bounded
  (Monday's run backfills five years of bars; what is lost is Friday's scan/signal rows). The honest
  fix — derive a run's date from the last CLOSED session rather than from `today` — is a change to the
  core nightly and I did not want to make it in the phase that first noticed the problem.

## BINDING CONTEXT — DO NOT RE-DERIVE
- **Intent binds; where the plan and the tree disagree on a detail, the tree wins on the detail.** N4
  amended the plan 5 times, N5 8 times, N6 7 times — every one in an honesty rule's favour, all logged
  in DECISIONS.md.
- **`docs/nc-evidence/` is the ground truth**: `n0-audit.md`, `n2-footprint.md`, `n3-board.md`,
  `n4-newsdesk.md`, `n5-frontpage.md`, **`n6-control.md`**.
- The pipeline has **four modes**: `full`, `news`, `macro`, `compute`. `MODE_STAGES` in
  `pipeline/jobs/job_a.py` is the pinned constant, `main()` REFUSES any mode it has no handler for,
  and a test walks the table and asserts every declared mode is dispatched.

## HARD-WON HAZARDS — read these before you trust a green gate
- **OPEN THE PNG AND LOOK AT IT.** **Eight** real bugs in this build have been found that way and by
  no other means. N6 added three: the panel crashed on its first poll while 572 tests stayed green (a
  real dispatched run left the screen looking exactly as if the button had done nothing); `compute`
  mode died in production on its first execution; and the Desk had been claiming its data ran "through
  a Saturday".
- **THE VENDOR'S OWN DOCUMENTATION IS NOT A RECORDING.** N4's rule was "record the provider's real
  response before writing the parser". N6 extends it: GitHub's docs were wrong about GitHub's API. One
  `curl` before you design costs two minutes and can invert the design.
- **A FAKE MUST BE NO KINDER THAN THE THING IT STANDS FOR.** `FakeS3.download_file` created the parent
  directory; real boto3 refuses to. So `sync_down` passed for six phases and died on its first true
  caller. **A mock more forgiving than reality certifies that the code works in a world that does not
  exist.** N3's lie was in the VALUES, N5's in the SHAPE, N6's in the FAKE'S BEHAVIOUR. And: **a
  function with no real caller has no real test**, whatever coverage says.
- **AN `as` CAST ON A PARSED PAYLOAD IS A PROMISE, NOT A CHECK.** JSON has no Date type. Convert at
  the boundary; never assert across it.
- **ASSERT THE CONSEQUENCE, NOT THE SHAPE.** Did the textarea CLEAR (not: does a "Saved" marker
  exist). Did the image DECODE (not: is there an `<img>`). Does the payload ACTUALLY SERIALIZE — and
  does it DESERIALIZE into what the type claims.
- **A SILENT FAILURE MODE NEEDS A COUNT.** A dropped narrative note prints nothing by design; a run
  that did nothing and a run that was never dispatched look the same from the couch.
- **NEVER hand-write a fixture that looks recorded.** An invented fixture is not merely an inverted
  test — it is a SMOOTHED one. Humans write tidy data; real data is untidy, and the untidiness is the
  information.
- **CI's database is DISPOSABLE and can tell you NOTHING about production's.** `npm run
  check:migrations` is the instrument that can, and it is in the standing gate. **A Vercel deploy
  applies migrations.**
- **There is no local Postgres on this Mac**, and there will not be. ~26 pipeline tests SKIP locally
  and every seeded e2e journey skips too — **CI is the only oracle for anything seeded.**
- **VRT baselines are BORN IN CI**: `gh workflow run ci.yml -f job=vrt-baselines`, download the
  artifact, commit it. Never shoot a baseline on macOS. The e2e+VRT job is TAG-GATED.
- **GitHub validates `workflow_dispatch` inputs against the workflow file ON THE TARGET REF.** A new
  input that exists only in your working tree gets a 422. The workflow must land on `main` before the
  app can dispatch with it.
- **Every sweep must assert that it swept something.** Guards in this build have passed because the
  thing they measured was absent rather than correct.
- Prepend `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` to node commands.
- `npm test` runs from `app/`; `uv run pytest` runs from `pipeline/`.

## DONE MEANS
`nc-final` tagged with green CI, every evidence table in `docs/nc-evidence/`, the N7 docs sync
executed, every [VETO?] carrying its assumption marker, and a closing PROGRESS.md entry written for
the user to read.

Begin: run the session ritual, then execute N7 and stop.
