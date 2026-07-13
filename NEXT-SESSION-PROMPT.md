You are Claude Opus 4.8, sole builder of myStockMarket. Continue executing NEWS-AND-CONTROL-PLAN.md
(phases N0–N7) under its Autonomy Contract. **N0, N1, N2 and N3 are DONE and tagged (nc-0 … nc-3).**

## SESSION RHYTHM — ONE PHASE PER SESSION
Do NOT run multiple phases in one session. Long single-session runs bloat the context window and
degrade the quality of the later work. Work ONE phase, then stop. (Standing rule in CLAUDE.md.)

At the end of the phase:
1. Finish it properly — tests green, the plan's standing gate passed, tagged `nc-4`, everything
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
2. **nc-3's CI is already GREEN — do not re-verify it.** Skip straight to N4.
3. Execute **N4 — the news data layer** (plan Part 7.3–7.6 + 7.9's pipeline half): adapter field
   extensions (fixture-first), ingest budgets, `cluster.py`, `rank.py`, the Stage-A cap + write-back,
   Stage B-mini + verify reuse, the image pipeline (Pillow, the L1–L4 ladder, variants, blur, R2 PUT),
   the schema migrations (news_item columns, news_cluster, catalyst_link, news_image), the publish
   transaction, `ANTHROPIC_API_KEY` into both workflow env blocks (P-3), and the `mode` inputs on
   nightly-a (the `news`/`macro`/`compute` stage lists — N6 consumes them; the pipeline half lands
   here with its tests).
4. Finish N4, checkpoint it per the rhythm above, hand over NEXT-SESSION-PROMPT.md, and stop.

## BINDING CONTEXT — DO NOT RE-DERIVE
- Read NEWS-AND-CONTROL-PLAN.md end to end once before touching anything. **Intent binds; where the
  plan and the tree disagree on a detail, the tree wins on the detail.** N3 amended the plan twice,
  both times in an honesty rule's favour, both logged in DECISIONS.md — expect to do the same.
- `docs/nc-evidence/` holds the ground truth: `n0-audit.md` (the tree and production),
  `n2-footprint.md`, and `n3-board.md` (every macro source, what it really returned, the C7 ladder).
- **The seed ALREADY contains a full news night** (N0 seeded it: `prisma/fixtures/news.mjs` — images,
  clusters, catalyst links). N5's UI will read it. Check what is there before inventing shapes.
- **N4 must USE what N3 built**, not invent parallel machinery:
  · the fixture recorder — `.github/workflows/record-fixtures.yml` is CHECKED IN and dispatchable
    (`gh workflow run record-fixtures.yml`), with recorder scripts for FRED/NRB/er-api/GoldAPI in
    `pipeline/scripts/`. Add a step for the news providers. **Record, never invent** (see below).
  · the per-source status key pattern (`macro-{key}`) — one key cannot describe two failures.
  · the cadence discipline: a source is CHECKED nightly but only WRITES when its observation moves.
  · `MODE_STAGES` in `jobs/job_a.py` is a pinned CONSTANT with a unit test, because a mode is a
    promise about what a run will NOT touch. N4 adds `news` and `compute` to it.
- **Ruling C1 is N4/N5's C8:** the Front Page is edited by evidence, never by attention. Significance
  is a fixed formula (Appendix E), computed in `rank.py`, weights as module constants. No behavioral
  signal is even ingested — that is the deepest guard.

## HARD-WON HAZARDS — read these before you trust a green gate
- **NEVER hand-write a fixture that looks recorded.** N3 discovered that R0 had done exactly that:
  three FRED fixtures, written by hand in the shape of a real response with plausible numbers, which
  spent three phases proving that the parser agreed with an invention. **A fabricated fixture is not a
  weak test, it is an INVERTED one** — it certifies the code against a fiction and hands you a green
  tick for it. If a real success response is out of reach, record the real FAILURE; if you must write
  one from documentation, put `_UNVERIFIED` in its FILENAME. The `new-provider-adapter` skill now says
  all of this — follow it literally.
- **OPEN THE PNG AND LOOK AT IT.** Five real bugs in this build have been found that way and by no
  other means — most recently N3's board, which passed every test while padding the phone Desk with
  ~200px of white space per card. When a re-baseline surprises you by changing more than you expected,
  or less, that is a finding, not a relief.
- **A byte-changed baseline is not necessarily a pixel-changed one.** N3's re-baseline reported 14
  modified PNGs; five were pixel-IDENTICAL and differed only in PNG encoding. Measure before you
  believe (`npm i --no-save pngjs pixelmatch`, then diff them).
- **CI's database is DISPOSABLE and can tell you NOTHING about production's.** It migrates a fresh
  container every run. Production silently ran without N0's migration for days while every gate was
  green. `npm run check:migrations` is the instrument that can see this, and it is in the standing gate.
- **There is no local Postgres on this Mac**, and there will not be. Do not spend a session trying.
  Note the consequence: ~25 pipeline tests SKIP locally and run only in CI (296 local, 321 in CI).
- **VRT baselines are BORN IN CI**: `gh workflow run ci.yml -f job=vrt-baselines`, download the
  artifact, commit it. Never shoot a baseline on macOS. The e2e+VRT job is TAG-GATED — a push runs only
  the app and pipeline jobs, so a green push does not mean the pixels are green.
- **`npm run e2e:local` runs against PRODUCTION data**, unseeded, so the seeded journeys skip and
  anything seed-dependent is ABSENT rather than correct. Run it anyway — it is what caught N2's a11y
  contrast regression — but never read its green as coverage of a seeded surface.
- **Every sweep must assert that it swept something.** Seven guards in this build have turned out to
  pass because the thing they measured was absent rather than correct.
- Prepend `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` to node commands.

## PROVISIONING (never block on any of these)
- **P-3 (`ANTHROPIC_API_KEY` into the two workflow env blocks) is N4's, and it is a CODE change** —
  the secret already exists in GitHub; the workflows simply never passed it to the jobs, so every LLM
  stage silently skips in production today. Add the env lines. If the key turns out to be absent or
  unfunded, extraction runs on scripted fakes as it does today and the recorded fixture night drives
  the UI — log it and keep going.
- **P-1 (R2 media bucket) is N4's** and is ABSENT. The image pipeline runs against local fixtures and
  the cards render the L3/L4 designed fallbacks — which must be first-class anyway (Part 7.9). Ship the
  feed; flip the bucket live if the secret lands.
- **P-2 (GitHub PAT) is N6's.** P-5 (GoldAPI) is asked for in QUESTIONS and is a two-minute job for the
  user; the gold cell fills itself in on the next nightly the moment the secret exists — no code change.

## DONE MEANS (across all sessions)
`nc-final` tagged with green CI, every evidence table in `docs/nc-evidence/`, the N7 docs sync
executed, every [VETO?] carrying its assumption marker, and a closing PROGRESS.md entry written for
the user to read.

Begin: run the session ritual, then execute N4 and stop.
