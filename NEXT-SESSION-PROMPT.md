You are Claude Opus 4.8, sole builder of myStockMarket. Continue executing NEWS-AND-CONTROL-PLAN.md
(phases N0–N7) under its Autonomy Contract. **N0, N1, N2, N3, N4 and N5 are DONE and tagged (nc-0 … nc-5).**

## SESSION RHYTHM — ONE PHASE PER SESSION
Do NOT run multiple phases in one session. Long single-session runs bloat the context window and
degrade the quality of the later work. Work ONE phase, then stop. (Standing rule in CLAUDE.md.)

At the end of the phase:
1. Finish it properly — tests green, the plan's standing gate passed, tagged `nc-6`, everything
   committed and pushed. Never stop mid-task or with a red build.
2. Bring EVERY intelligence file fully current: PROGRESS.md, DECISIONS.md, LESSONS.md, PATTERNS.md,
   QUESTIONS-FOR-BISHANT.md, plus the evidence table for the phase (`docs/nc-evidence/`). Write them
   as if the next session has NO memory of this one — because it won't.
3. Rewrite NEXT-SESSION-PROMPT.md at the repo root: complete, paste-ready, self-contained.
4. Report back in plain English: what you built, what passed, anything new in QUESTIONS-FOR-BISHANT.md,
   and confirm NEXT-SESSION-PROMPT.md is ready.

Then STOP and wait. Do not roll into the next phase.

Within a phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question. Anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and clearly marked.

## START HERE, IN THIS ORDER
1. Run the CLAUDE.md session ritual: git pull → read CLAUDE.md + PROGRESS.md + LESSONS.md → diff
   DECISIONS.md for any non-[claude] line (a user veto, rank 2.5 — honor it FIRST) → run both test
   suites → announce your checkpoint.
2. **nc-5's CI is green — do not re-verify it.** Read `docs/nc-evidence/n5-frontpage.md` once: it is
   the ground truth about what the Front Page actually does, and the seven places the plan was amended.
3. Execute **N6 — the control room** (plan Part 8): the manual-run panel, `compute` mode, the
   `manual_run` table (already in the schema), the GitHub `workflow_dispatch` bridge, the caps and
   cooldowns, and the honest "not available" states.
4. Finish N6, checkpoint it per the rhythm above, hand over NEXT-SESSION-PROMPT.md, and stop.

## WHAT N6 IS, AND THE ONE THING IT MUST NOT BECOME
Plan Part 8. The commission asked for user-triggered pipeline runs, and **Part 8.1 already did the
honest evaluation and narrowed it**: on a normal weeknight the pipeline has already run and a manual
re-run would recompute identical data — **the honest control for that case is the EXPLANATION, not the
button.** Four cases earn real buttons: a failed/missed nightly (recovery), a news re-fetch, a macro
refresh, and a scan recompute. Read 8.1 before you build a single control.

- **`compute` mode is deliberately NOT declared in the pipeline yet.** N4 left it out on purpose so
  the promise and the code would land in the same commit — N6's. `MODE_STAGES` in
  `pipeline/jobs/job_a.py` is where it goes, and `main()` REFUSES any mode it has no handler for.
  That guard exists because every unrecognised mode used to fall through to the FULL nightly: a
  "refresh the news" button pressed at noon would have re-ingested the entire market mid-session and
  written half a day of unformed bars over the last good close.
- **`news` mode DOES spend LLM budget now** (N5 amended its promise). It runs the narrator — up to 60
  Haiku extracts and one Sonnet call — because the honest scope of a "refresh the news" button is the
  WHOLE page, facts and context lines together. `copy.control.runNewsDesc` has a `{cost}` placeholder;
  fill it with a real, measured number.
- **`copy.control` is already written** in Appendix B, including every "not available" sentence
  (markets open, weekend, holiday, already ran). Those sentences are the feature.
- **The `manual_run` table already exists** in the schema (`app/prisma/schema.prisma`), with its index.

## PROVISIONING — P-2 IS N6's, AND IT IS THE ONE THING THAT COULD BLOCK YOU
- **P-2 (a GitHub PAT with `workflow` scope)** is what lets the app dispatch a run. It is **NOT
  provisioned.** Per the Autonomy Contract: **build the whole panel against the missing secret**, use
  `copy.control.notConfigured` ("Manual runs need a GitHub token — see QUESTIONS-FOR-BISHANT (P-2)"),
  make the panel render its real states, and **do not block**. It flips live with a secret.
- **P-1 (R2 media bucket) is still ABSENT.** Not N6's problem. The Front Page renders its designed L4
  generated cards today — see Q-N5-2.
- **P-3 (ANTHROPIC_API_KEY) and P-5 (GOLDAPI_KEY) are CLOSED and verified live.**

## BINDING CONTEXT — DO NOT RE-DERIVE
- **Intent binds; where the plan and the tree disagree on a detail, the tree wins on the detail.** N4
  amended the plan five times and N5 amended it seven more, every one in an honesty rule's favour, all
  logged in DECISIONS.md. Expect to do the same.
- **`docs/nc-evidence/` is the ground truth**: `n0-audit.md`, `n2-footprint.md`, `n3-board.md`,
  `n4-newsdesk.md`, **`n5-frontpage.md`**.
- **The Front Page is live**: `/news`, `/news/[cluster]`, Desk module 08, and News is the sixth tab.
  The pipeline narrates it, and the briefing's own verification gate deletes any note whose numbers do
  not trace back to a source.

## HARD-WON HAZARDS — read these before you trust a green gate
- **OPEN THE PNG AND LOOK AT IT.** **Seven** real bugs in this build have been found that way and by
  no other means — most recently N5's, where **every photograph on the Front Page rendered as a
  broken-image icon** while every DOM assertion passed. The `<img>` was present, visible, correctly
  sized and carrying the right `src`; the login wall was redirecting `/fixtures/`, and the image
  optimizer makes its OWN server-side fetch with no session cookie. **`naturalWidth` is the only thing
  in a browser that knows an image from a broken one.**
- **ASSERT THE CONSEQUENCE, NOT THE SHAPE.** Three of this build's worst bugs shared one shape: the
  observable the test looked at was correct, and the broken thing was not observable from it. Did the
  textarea CLEAR (not: does a "Saved" marker exist). Did the image DECODE (not: is there an `<img>`).
  Does the payload ACTUALLY SERIALIZE (not: does it have the right keys — `_json_safe` returned a dict
  that looked perfect and killed a production run four and a half minutes in, after every model call
  had already been paid for).
- **A SILENT FAILURE MODE NEEDS A COUNT.** A dropped narrative note prints nothing by design, so a
  too-strict gate and a narrator with nothing to say produce an identical page. Every outcome is
  counted and the night prints them. **N6's buttons have exactly this property**: a run that did
  nothing and a run that was never dispatched look the same from the couch.
- **NEVER hand-write a fixture that looks recorded.** N3 found three fabricated FRED fixtures. An
  invented fixture is not merely an inverted test — it is a SMOOTHED one. Humans write tidy data; real
  data is untidy, and the untidiness is the information.
- **The test suite never runs a job module as a script.** `run_news_mode` was appended below
  `if __name__ == "__main__"`, every unit test passed, and production died with a NameError in eleven
  seconds. There is a structural guard now, but the general lesson stands.
- **CI's database is DISPOSABLE and can tell you NOTHING about production's.** `npm run
  check:migrations` is the instrument that can, and it is in the standing gate. **A Vercel deploy
  applies migrations** — N5's migration landed within a minute of the push.
- **A `revalidate` on a dynamic route caches NOTHING without `generateStaticParams`** (even an empty
  array). `/news/[cluster]` shipped that way and was caught by the B1 budget, not by eye — the page
  worked perfectly, it was just rebuilt for every reader.
- **There is no local Postgres on this Mac**, and there will not be. ~22 pipeline tests SKIP locally,
  and every seeded e2e journey skips too — **CI is the only oracle for anything seeded.**
- **VRT baselines are BORN IN CI**: `gh workflow run ci.yml -f job=vrt-baselines`, download the
  artifact, commit it. Never shoot a baseline on macOS. The e2e+VRT job is TAG-GATED.
- **`npm run e2e:local` runs against PRODUCTION data**, unseeded — seeded journeys skip. Run it anyway;
  never read its green as coverage of a seeded surface.
- **Every sweep must assert that it swept something.** Seven guards in this build have passed because
  the thing they measured was absent rather than correct.
- Prepend `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` to node commands.

## DONE MEANS (across all sessions)
`nc-final` tagged with green CI, every evidence table in `docs/nc-evidence/`, the N7 docs sync
executed, every [VETO?] carrying its assumption marker, and a closing PROGRESS.md entry written for
the user to read.

Begin: run the session ritual, then execute N6 and stop.
