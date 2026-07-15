# myStockMarket — constitution
Single-user US-equities command center + learning hub. Next.js 16 app (app/) + Python pipeline
(pipeline/) + two GitHub Actions jobs. Executor: Claude Opus 4.8. Contract: DEVELOPMENT-PLAN.md,
plus UI-REDESIGN-PLAN.md for everything visual and APP-FEEL-PLAN.md for structure, layout
containers, navigation and performance (F0–F7, complete 2026-07-12). Authority: RR Part 8/9 > Blueprint > plan >
DECISIONS.md > judgment — except on looks, where UI-REDESIGN-PLAN.md wins (deliberate user
amendment, 2026-07-11). Evidence chapters win on evidence.

## Session rhythm — ONE PHASE PER SESSION (standing rule — user, 2026-07-13, permanent)
Do NOT run multiple phases in one session. Long single-session runs bloat the context window and
degrade the quality of the later work. Work ONE phase, then stop.
At the end of the phase:
1. Finish it properly — tests green, the plan's standing gate passed, tagged, everything committed
   and pushed. Never stop mid-task or with a red build.
2. Bring EVERY intelligence file fully current: PROGRESS.md (exact checkpoint, what's done, what's
   next, anything in flight), DECISIONS.md, LESSONS.md, PATTERNS.md, QUESTIONS-FOR-BISHANT.md, plus
   any evidence table. Write them as if the next session has NO memory of this one — because it won't.
3. Write NEXT-SESSION-PROMPT.md at the repo root: the complete, paste-ready prompt for the next
   session, self-contained.
4. Report back in plain English: what was built, what passed, anything new in QUESTIONS, and confirm
   NEXT-SESSION-PROMPT.md is ready. Then STOP and wait.
**Within a phase the Autonomy Contract below still holds in full** — never ask, never wait, never end
a phase with a question. Anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the
most reasonable assumption made and marked.

## Autonomy (standing directive — user, 2026-07-11, permanent)
**[Amended 2026-07-13, G0: "roll straight into the next phase" is REPEALED by the Session-rhythm
rule above — ONE phase, then stop and check in with Bishan. Within a phase, this contract below
holds in full: never ask, never wait, never end a phase with a question.]**

Run the entire plan to completion without pausing. Do NOT stop at phase boundaries or ask
permission to continue: after tagging a phase, roll straight into the next one. Work through every
remaining phase autonomously, in order, following all the rules below (TDD, plain English, the
non-negotiables, the session ritual).
- **The only reason to stop** is something that GENUINELY blocks further progress and cannot be
  worked around (e.g. a required secret that is absent and cannot be faked).
- **For anything else that needs the user's input:** write it to QUESTIONS-FOR-BISHANT.md, make the
  most reasonable assumption, clearly mark whatever you built on that assumption (in code comments,
  DECISIONS.md, and PROGRESS.md), and keep going.
- **A phase gate you cannot complete now is not a blocker.** If a gate needs live observation (e.g.
  P3's five-night briefing week), proceed with the next phase in parallel and tag the earlier phase
  when its gate is finally met. Note the pending gate in PROGRESS.md.
- Keep updating PROGRESS.md, DECISIONS.md, LESSONS.md, PATTERNS.md and minting skills as you go.

## Non-negotiables (full list: plan §1.5 — re-read weekly)
No directional forecasts; vol bands ≤ 20d + regime caveat · base rates = natural frequency + N +
Wilson CI, N-gated display · CI spanning always-up baseline ⇒ tier weak · new patterns need
t > 3.0 or a ledger grade · decay stamps · folklore labeled · insert-only
signal_log/resolution, misses public · no trending surfaces, no gamification · movers need a
catalyst or the noise line · LLM narrates, never computes; deterministic gate blocks unverified
numbers · Desk/Academy separated, doorways + return rails · general UI motion is allowed
(2026-07-11 amendment) but probability/money visuals NEVER move and nothing manufactures
urgency · timestamps everywhere · mechanical voice (copy.ts) · paper-first ·
login wall always (licensing) · TDD per plan §6.2.

## Readability & documentation (permanent, non-negotiable — user directive 2026-07-10)
The user leads this build. They read the code in VS Code and the terminal output as it happens.
Optimize everything for a human reader, never for machine brevity.
1. **Plain English everywhere.** This file, DECISIONS.md, PATTERNS.md, LESSONS.md, PROGRESS.md,
   and all docs are written in simple, clear English: short sentences, plain words, no jargon or
   clever shorthand. Brief is good; terse at the cost of clarity is not. (Fixed formats — the
   decision-log line, checklists — stay compact by design; all prose around them must be plain.)
2. **Code favors clarity over cleverness.** If a clever version and a clear version both work,
   ship the clear one. No dense one-liners or obscure idioms where a simpler form does the job.
3. **Function-level docs, developer-style.** Every non-trivial function or method gets a
   plain-English comment or docstring saying what it does and why — purpose and intent, not a
   line-by-line restatement. Target: a new developer could read this codebase without help.
4. **The terminal talks in plain English.** Progress reports, decisions, and summaries are
   written for a leader reading along — human terms, never walls of technical shorthand.

## Commands
app:      npm run dev | test | typecheck | lint | build
guards:   npm run check:drift (28 anti-drift rules) · check:fonts (budget) · check:lighthouse ·
          check:live (PD1 — production truth; needs root `.env` sourced) · brand (PD2 — the ONE
          generator; full line below)
brand:    (PD2) `npm run brand` is THE ONE GENERATOR — `npm run icons` is an alias of it, and
          scripts/icons.mjs is gone. One master in (assets/brand/logo-source.png, repo root, OUTSIDE
          app/public/ so the 1.2MB original never ships), ten artifacts out, each with a named size,
          geometry, budget and consumer. It PRINTS its artifact table with byte sizes and EXITS
          NON-ZERO on a missed budget — which is how it caught, on its first run, that the raster mark
          encodes to 300KB at 512px against a 120KB budget written for the flat SVG tile it replaced
          (19KB). Needs Node 24. Three things a future session must not re-learn the hard way:
          · THE MASTER'S TRANSPARENCY IS PAINTED ON — the delivered PNG has no alpha channel at all;
            the checkerboard is IN the pixels. brand-geometry.mjs keys it out by flood-filling from
            the BORDER inward, which is why it can never eat the white M in the middle of the mark.
          · SHARP CANNOT USE OUR FONTS AND SAYS NOTHING. `fontfile` is silently ignored: a monospace
            and a proportional font rendered one string to the same 1135x159px. The OG card's type is
            VECTOR OUTLINES (brand-type.mjs), from TTFs vendored in assets/brand/fonts/. Never
            re-introduce a font lookup here.
          · public/mark-glyph.svg SURVIVES the retirement of mark.svg — Android's monochrome icon must
            be one flat colour on transparency, which a rendered logo cannot be.
          Any new brand hex goes in the generator and NOWHERE else (drift rule 23). components/
          BrandMark.tsx is the ONLY component that may render the mark (drift rule 20's second door).
rooms:    (G3) app/lib/routes-manifest.json is THE ONE LIST OF ROOMS. The sweeps (a11y, hardening),
          the pixel oracle (vrt), the nav budget (check-nav) and the bundle budget (check-bundles) all
          read it. app/lib/routes-manifest.test.ts walks app/app/**/page.tsx and REDS THE UNIT SUITE if
          a room exists with no entry — in both directions (a room nobody measures, or an entry for a
          room that is gone, which would let the sweeps "pass" on a 404 page forever). Add a room?
          Add it there. `app/lib/routes.ts` is the typed door.
          (PD3) `mbp16` is a per-room flag: does this room get a 1512×982 pixel lock? It is FALSE for
          most rooms and that is the point — **1512 sits INSIDE the `desk:` band (1366–1535) and the
          container caps at 1360px, so 1366 and 1512 render an IDENTICAL 1296px interior** (measured,
          all 13 rooms; only `wide` ≥1536 opens up, to 1436px). The mbp16 leg does NOT buy a new layout
          map. It buys the screen the reader actually uses, the sideways-scroll sweep at 1512, and the
          one shot in the whole suite that shows the night the Desk's dead gap HAPPENS on.
grid:     (PD3) THE DESK'S TWO COLUMNS FLOW INDEPENDENTLY — `[data-column="main"]` and
          `[data-column="rail"]`, two flex stacks that share no row tracks. A grid row is as tall as its
          tallest cell, so one shared grid let a short module dig a dead hole beside a tall one (334px,
          measured). THE DOM PRICE IS UNAVOIDABLE AND IS STATED: CSS can only group children that are
          ADJACENT IN THE DOM, and the ritual interleaves the columns, so a ritual-ordered DOM and
          column-grouped wrappers are mutually exclusive. The DOM is main-then-rail at every width
          (amendment 0.2.2); below `lg` the phone's ritual is restored VISUALLY (`display: contents` +
          `order`, whose numbers ARE the ritual indices). Below lg a sighted keyboard user therefore
          tabs main-then-rail while seeing the ritual — a WCAG 2.4.3 divergence axe cannot detect, and
          e2e/grid.spec.ts pins BOTH orders so neither drifts. DO NOT "fix" it with a rail that
          row-SPANS the main column: the grid then grows the spanned rows to fit a tall rail and the
          dead gap comes straight back, distributed. **Layout is asserted in BOUNDING BOXES, never the
          DOM** — a DOM-order test passed happily through this entire rewrite while the screen changed.
          LAW 2: a module reserves no height (drift rule 24, `min-h-`). ONE empty state exists —
          components/EmptyModule.tsx — and the CALLER decides when to show it (watch for `[]` being
          TRUTHY). No shimmer on it: a shimmer promises content is coming, which is FALSE on a night the
          run happened and found nothing, and that is the common case.
          (PD4) **A BOUNDING BOX IS ONLY EVIDENCE ONCE THE THING THAT DECIDES IT HAS ARRIVED.**
          grid.spec.ts measured a page before its stylesheet applied and reported `mainRight: 0,
          railLeft: 0` — every module at x=0, which is not a collapsed grid, it is UNSTYLED HTML. It
          reproduced on its retry and never locally: `page.goto()` resolves on `load`, which does not
          guarantee the CSSOM is applied to the layout you then force. `waitForLayout()` waits for the
          TOKENS (`--color-paper` is "" until globals.css is in effect) and for fonts. Any new
          box-measuring spec calls it.
phone:    (PD4) THE DESK'S PHONE MACRO COMPOSITION — three named groups, no shelves. `data-macro-group`
          = "risk" (VIX | 10-year, 2-up cards) · "tape" (Nasdaq/Dow/Small caps, ONE Surface, three
          hairline rows, `dense` + `layout="row"`) · "money" (the 4 stats, 2×2, `dense`). The Mood gauge
          is FULL-WIDTH BELOW the money grid and may NEVER enter it — a grid row is as tall as its
          tallest cell, so a gauge in the grid drags all four stat cells up to its height, which is the
          exact 347px bug the shelf once produced. e2e measures the cell heights (real: 125–163px).
          **THREE CARDS DO NOT FIT ACROSS A PHONE.** A 3-up cell gives 74px at 360 and 91px at 412; an
          index level is ~81px and its delta chip ~95px. Part 7.1 guessed "≈112px" and is AMENDED in
          place. A mono numeral has no wrap opportunity inside itself — it cannot be made to fit, only
          to overflow. Do not "fix" it by shrinking the type: that lands within 1px of breaking.
          **OVERFLOW IS ASKED OF THE CELL, NOT THE PAGE.** `document.scrollWidth === clientWidth` CANNOT
          SEE a cell that spills into its NEIGHBOUR — the spill lands inside the page, never past its
          edge — so the sweep reports clean while a figure sits under the border of the card next door.
          That is exactly how PD4's own first tape passed every guard while broken. Both questions get
          asked now: hardening.spec sweeps the PAGE (every room, 412 AND 360, and it COUNTS the rooms it
          visited); desk.spec sweeps the CELL, to the CONTENT edge.
voice:    (PD5) THE RICHNESS KIT — four components, and each is the ONE door to its kind of thing.
          components/TickerChip.tsx (every ticker symbol) · components/DeltaChip.tsx (every signed
          move) · components/Term.tsx (every glossary doorway — it SUPERSEDES GlossaryTerm.tsx, which
          is deleted) · components/KeyFigure.tsx + lib/verified.ts (every emphasized number).
          · **TickerChip is a DOOR or a LABEL, and HTML decides which.** `door` renders a `<Link>`;
            without it, a `<span>`. Three of the five consumers REQUIRE the label: a news card is one
            big `<Link>` and a movers/watchlist row is a `<button>` — an anchor inside either is
            invalid HTML, and the browser's repair silently kills the outer control. Drift rule 26.
          · **A DUPLICATED COMPONENT IS NOT A BUG, IT IS A BUG'S HABITAT.** There were FOUR delta
            chips (StatFigure, Movers, Watchlist, NewsCard) and PD4's wrap fix had landed in exactly
            ONE. The other three still carried the shape of the bug PD4 spent a phase killing, and
            nothing failed and nothing would have. Fix a bug ⇒ grep for the component's SIBLINGS.
          · **EMPHASIS IS EARNED, AND IT IS A TYPE (E5).** `VerifiedFigure` has ONE mint —
            `splitVerified(text, allowList)` — and the allow-list comes from the PIPELINE's gate
            (a cluster's `key_numbers`). **A DENY-LIST IS THE TRAP:** it would make the app decide what
            counts as a number, and `briefing/verify.py` already answers that. Its own header says what
            a second answer costs. **The Desk's brief therefore carries NO emphasized figures** — the
            briefing stores its FLAGS, not its CLEARED list, so nothing there can be proven verified.
            That is not a gap; it is the rule. PD7 fixes it at the source (Q-PD5-1).
          · **A MATCHER OVER NARRATED PROSE MUST MATCH THE WORDS THE NARRATOR WRITES.** The glossary
            holds the title "RVOL"; the pipeline writes "relative volume". TermProse landed green on
            every unit test and decorated NOTHING. Entries carry `aliases` now. Term budget: ≤2 per
            paragraph (lib/prose.ts) AND first-occurrence-per-view (the React `cache` registry) — two
            different rules that COMPOSE, which is why a paragraph may honestly show fewer than two.
            **`cache()` only memoises on a SERVER render**, so the per-view rule is pinned in
            e2e/voice.spec.ts and CANNOT be unit-tested. A unit test that cannot see the behaviour it
            names is a green light wired to nothing.
p2:       (PD5) **A GUARD ONLY GUARDS WHAT IT IS POINTED AT.** The delta chip carries `data-p2`
          (Q-G4-1, ruled). Movers and Watchlist had carried `transition-colors` on their row hover for
          six phases and got away with it for ONE reason: their delta chips were UNMARKED, so the P2
          ancestor walk had never once looked at the two busiest money surfaces on the Desk. The rule
          was being kept by LUCK. Marking them failed the build on both rows at once (drift rule 6 AND
          the ancestor walk). Their hover is INSTANT now — a background change with no transition,
          like NewsCard's always was. P2_FILES: BaseRate · StatFigure · DeltaChip · TickerChip ·
          CalibrationScatter · SetupCards · MacroPulse · Movers · Watchlist · RangeBands.
wrap:     (PD4) **THE UNIT OF WRAPPING IS THE ATOM.** A figure and its chip wrap; a chip's INSIDES do
          not. StatFigure's value row is `flex-wrap min-w-0` so the chip drops BELOW the value rather
          than overflowing. The chip is `flex-wrap max-w-full` and holds exactly TWO atoms, each
          `whitespace-nowrap`: the signed delta (`▲ +0.29%` — glyph, sign and number are one fact in
          three redundant channels) and its window (`· vs prior week` — the delta's unit). It breaks
          BETWEEN them, never WITHIN one. Told to "wrap rather than clip", PD4's first chip shattered
          into "▲" / "+0.29%" / "· 1D" — PD3's Range Ladder bug reintroduced one component over, green
          on every test. **"Wrapping is honest, truncating is not" is a claim about a SENTENCE**; a
          phrase broken one word per line has not been wrapped, it has been SHATTERED. Making a chip FIT
          is the LAYOUT's job, not the chip's.
clocks:   (G3, drift rule 21) NO absolute date literal in prisma/seed.mjs, prisma/fixtures/*.mjs or
          e2e/**/*.ts outside TWO anchors: prisma/fixtures/clock.mjs (the seeded world) and
          e2e/seeded-clock.ts (the browser suite). The rule is NOT "never write a date" — the seeded
          world IS a fixed morning and must be. It is that there is ONE date per world, it has a name,
          and everything else derives from it. A second unnamed copy is how the two silently walk
          apart: /paper's baseline expired 28 minutes after the run that certified it. Comments are
          exempt, so every derived call site carries its answer (`sessionPlus(3)  // 2026-07-12`).
db-drift: npm run check:migrations — is the LIVE database running the schema in this repo? CI can
          never answer this (it migrates a fresh container every run), and production silently ran
          without N0's migration for days because nothing asked. Deploy applies migrations too.
live:     (PD1, IN THE STANDING GATE) `set -a; source .env; set +a` then npm run check:live — is
          PRODUCTION telling the truth? Six assertions against the deployed origin (masthead session ·
          macro board present · index honesty · calendar hygiene · press-time · next-edition promise).
          It mints its own session cookie, so it needs AUTH_COOKIE_SECRET but NOT the app's password.
          LOCAL-ONLY BY NATURE, like check:migrations: CI builds a fresh database and a fresh
          deployment every run, so it structurally cannot answer this. Runs at the POST-DEPLOY step of
          every phase gate. Every other guard asks whether the CODE is right; this is the only one
          that asks whether the PRODUCT is.
          THE RULE IT ENFORCES, learned the hard way in PD1 (three surfaces, one bug, one hour): IF A
          SURFACE IS DERIVED FROM THE EDITION, IT IS MEASURED AGAINST THE EDITION — never the wall
          clock. The Desk serves a dated edition; between midnight ET and the evening run the clock
          and the edition disagree, and a check that reads the clock reds a healthy Desk every night.
budgets:  npm run check:routes (every room cached) · check:nav (TTFB, needs AUTH_COOKIE_SECRET) · check:bundles
e2e:      npx playwright test  ·  LOCAL: npm run e2e:local (--ignore-snapshots; CI is the pixel oracle)
          Seeded journeys need MSM_SEEDED=1 and a seeded Postgres — CI sets both; this Mac has neither.
          (PD3) THE THIN-NIGHT SPECS NEED ONE DATABASE PER PLAYWRIGHT PROJECT. e2e/thin-night.ts thins
          the edition (brief HELD, 3 movers, no setups), shoots, and puts the exact rows back. CI is
          structurally safe — every matrix leg is its own runner with its own Postgres, and `workers: 1`
          makes each leg serial. BUT `e2e:local` runs EVERY project against your ONE database in
          parallel workers, so the thin-night tests fight and the symptom is a duplicate-primary-key
          error inside the RESTORE, which reads exactly like a broken layout and is not. Locally, run
          one project at a time: `npx playwright test --project=mbp16`.
          (PD4) AND ADD `--workers=1`. One project at a time is NOT ENOUGH: inside a project the local
          worker default is still PARALLEL, which is enough to make ticker-range fail on the shared
          database. It is not a flake and not your code.
          (PD5) **`reuseExistingServer` WILL SERVE YOU A LIE FOR AN HOUR.** It is TRUE locally, so a
          server from an earlier run STAYS BOUND to 3210 and keeps serving whichever build it started
          with — while `npm run build` rewrites `.next` underneath it. PD5 spent an hour chasing a
          "regression" in settings.spec on the strength of an A/B that showed pd-4 passing and PD5
          failing. BOTH measurements were taken against a stale server. With the port actually cleared,
          **pd-4 fails the same test at the same rate** — a local-only flake (ISR revalidation timing
          under `next start`), never a regression. **`lsof -ti:3210 | xargs kill -9` before ANY local
          A/B against another commit**, or the answer you get is about the server, not the code.
          (PD5) **`:visible` IS LOAD-BEARING ON ANY DataTable CELL.** DataTable renders BOTH layouts
          into the DOM — the desktop table and the phone's card list — and hides one with CSS. A
          `.first()` selector picks whichever copy comes first, which on a DESKTOP is the HIDDEN one:
          the locator resolves, the click waits 30s for a box that never arrives, and the test dies
          pointing at a chip that is on screen in front of you. **It passes on the phone**, where the
          visible copy happens to be first — a green tick on one leg and a death on the other, from one
          selector. A spec that passes on one project and dies on another is telling you about the DOM,
          not the viewport.
          (PD4) **DO NOT HAND-START THE SERVER AND LET PLAYWRIGHT REUSE IT** (`reuseExistingServer` is
          true locally). If your server has no CRON_SECRET, thin-night's ISR cache-bust silently no-ops
          and the Law-2 test photographs a STALE FULL-NIGHT render — 318px where it wants ≤120. It reads
          exactly like a layout regression and is not. Let Playwright start its own: webServer.env has
          the secret. Cost me a stash, a rebuild and a bisect against pd-3 to find.
          ALSO: running the browser suite locally DIRTIES docs/feel-evidence/nav-timing.md —
          nav-timing.spec.ts appends its samples. Those rows are this Mac under contention, not
          evidence. `git checkout -- docs/feel-evidence/nav-timing.md` before you commit.
rehearse: gh workflow run ci.yml -f job=e2e — LIVE since G1. Runs the FULL browser oracle (all three
          shards) on any ref, with no tag involved. Run it on main's HEAD — the exact SHA you are
          about to tag — and the tag run becomes a confirmation instead of a discovery. `gate-1` went
          green on the first try because of this. Add `--ref <branch>` to rehearse a scratch branch.
          THE TRAP: GitHub validates dispatch inputs against the workflow file ON THE TARGET REF, so
          a new input value must be pushed BEFORE you can dispatch it. Push first, then dispatch.
ci shape: (G0/G1/G2, 2026-07-13; a 4th leg at PD3) branch pushes run app + pipeline; TAGS RUN ONLY THE
          BROWSER ORACLE — the tagged SHA already proved app+pipeline on main, and re-running them was
          43% of the CI bill. The oracle is SHARDED into FOUR legs (desktop, phone, wide, mbp16), one
          Postgres each: 15.9 m -> ~8 m. `workers: 1` is untouched — four legs are four databases, so
          nothing is shared (and PD3's thin-night mutation DEPENDS on that isolation). A 4th leg costs a
          RUNNER, not wall-clock: the legs are parallel and the exit still waits on `desktop`.
          One live run per ref AND PER EVENT: the group is `ci-<ref>-<event_name>`, and the
          event part is load-bearing — a rehearsal on main shares main's ref, and on its first outing
          it CANCELLED the push run it was rehearsing. Push and rehearsal must overlap; they now do.
docs=free: (G2) `on.push` carries `paths-ignore: ['**/*.md', 'docs/**', '.claude/**']` — a prose-only
          commit starts NO CI run. A MIXED commit (docs + code) still runs in full. PROVEN LIVE, not
          taken from the vendor's docs: GitHub does NOT apply path filters to TAG pushes (gate-2 sits
          on a docs-only commit and its push ran the full oracle green), and `workflow_dispatch`
          ignores them too, so the REHEARSAL still runs on exactly the commits a tag lands on.
          THE TRAP THIS SETS FOR YOU: nothing in the gate currently READS those paths, which is the
          only reason this is safe. If you ever write a guard that reads a document, put its path back
          in the trigger FIRST — otherwise the guard breaks silently. The workflow files are
          deliberately NOT ignored (test_ci_tag_families.py and test_workflow_dispatch.py read them).
heartbeat: nightly-a pushes an EMPTY `chore: heartbeat` commit to main after each full nightly (it
          keeps GitHub from disabling the cron after 60 idle days). Since G2 it starts no CI run —
          paths-ignore skips an empty commit — and it still works, because what keeps the cron alive
          is a PUSH, not a run. THAT CHANGES NOTHING ABOUT THE HAZARD: MAIN CAN STILL MOVE UNDER YOUR
          ENDGAME. Tag the SHA you rehearsed, by SHA — never `HEAD`.
pipeline: uv run pytest      jobs: uv run python -m jobs.job_a (fixtures: MSM_FIXTURES=1)
modes:    job_a runs in FOUR modes, pinned in MODE_STAGES (pipeline/jobs/job_a.py), and main() REFUSES
          any mode it has no handler for — an unrecognised mode used to fall through to the full
          nightly, so "refresh the news" at noon would have re-ingested the whole market mid-session.
          full (the cron) · news · macro · compute (recomputes from STORED bars — calls no provider,
          takes its run date from the DATA not the clock, publishes via publish_compute so it never
          overwrites the night's source_status). job_a SKIPS a non-session day and exits cleanly.
db:       npx prisma migrate dev --name <name> · npx prisma db seed   deploy: git push (Vercel auto)
VRT:      baselines are BORN IN CI. Never shoot one on macOS. Since G1 a rehearsal that reds on
          PIXELS mints its own candidates: download `vrt-baselines-candidate-<leg>`, OPEN EVERY IMAGE,
          commit only an explained diff. THE CANDIDATE IS EVERY SHOT, NOT THE SHOTS THAT MOVED —
          `--update-snapshots=all` re-photographs all of them, so copying the whole directory commits
          files nobody can explain. Read .claude/skills/vrt-update FIRST. `-f job=vrt-baselines`
          remains for a deliberate restyle. FOUR legs now (PD3): desktop · phone · wide · mbp16.
          **BATCH VISUAL FIXES INTO A SINGLE RE-SHOOT (standing rule — user, 2026-07-14, permanent).**
          After a red rehearsal: download the failure artifacts AND the candidates for EVERY red leg,
          OPEN EVERY IMAGE, LIST EVERY DIFF, fix them ALL, and dispatch ONCE. Never one dispatch per
          fix. PD6 ran FOUR serial red rehearsals because it looked at the pictures, found a real bug,
          fixed it, and re-shot — three times over (69px table rows · a chip wrapping in a column
          sized for a word · that fix pushing /settings into a 16px sideways scroll at 360). Every one
          was a genuine defect and the looking was right; the SERIALIZING was the waste. **The repo is
          public and the minutes are free, and this rule still holds — what it saves is not money, it
          is the ~50 minutes of round-trip WAITING that four rehearsals cost instead of one or two.**
          FOUR LAWS, EACH LEARNED THE HARD WAY, IN ASCENDING ORDER OF DANGER:
          · (PD2) "WHAT MOVED" AND "WHAT FAILED" ARE NOT THE SAME LIST. `maxDiffPixels: 600`, so a shot
            can CHANGE and still PASS. PD2's 28px mark moved 59 baselines and redded only 14 — the other
            45 would have gone on passing while showing a top bar the app no longer had. DIFF EVERY
            CANDIDATE AGAINST ITS COMMITTED BASELINE (decode both, count differing pixels) rather than
            trusting the failure list. A baseline that is TOLERATED is still a baseline that is WRONG.
          · (PD3) A RESIZE IS LOUDER THAN A DIFF. A shot whose HEIGHT changed changed its LAYOUT. Check
            the height moved in the direction the change implies — wider ⇒ shorter. **A page that gets
            WIDER is not supposed to get TALLER**, and that one sentence is what caught the next law.
          · (PD3, THE WORST ONE) **A BASELINE PROVES THE PAGE DID NOT CHANGE. IT NEVER PROVED THE PAGE
            WAS RIGHT.** If the first picture was already wrong, the oracle locks the bug in and DEFENDS
            it — nothing ever fails, and nothing ever will. `/ticker`'s phone baselines were committed
            photographs of the Range Ladder rendering ONE WORD PER LINE, in production, for months. A
            baseline that is EXACT can still be wrong; the tolerance was innocent. **So: any brand-new
            surface's FIRST baseline gets eyes before it is committed** — that is the only moment anyone
            will ever look at it with fresh judgement.
          · (PD5, AND IT IS THE SAME LAW A FOURTH TIME — the fix did NOT reach everywhere) DIFFING
            EVERY CANDIDATE, not just the failures, found THREE shots that had changed WITHOUT FAILING,
            on pages PD5 never touched: `scans-preset` (~56,000px), `login` (~2,400px),
            `settings-light` (161px). **The committed `scans-preset` baseline has a ROW HIGHLIGHTED AS
            IF THE MOUSE WERE RESTING ON IT.** The app is identical; the CAMERA moved. PD4 parked the
            mouse at (0,0) in `shoot()` and that fixed the ticker — it did not fix this. Left alone
            deliberately (the oracle passes it; re-baselining from a candidate you cannot vouch for
            trades one unexplained picture for another). **Q-PD5-2, for PD6.**
          · (PD4, AND IT IS THE SAME LAW A THIRD TIME) **A BASELINE CAN BE A PHOTOGRAPH OF THE TEST
            HARNESS RATHER THAN OF THE APP.** `signIn()` CLICKS the Sign-in button; Chromium leaves the
            pointer resting there and Playwright never moves it. On `/ticker` the candle chart sits under
            that cursor, lightweight-charts thinks it is hovered, and draws a CROSSHAIR into the baseline
            — so the ticker's picture encoded WHERE THE LOGIN BUTTON WAS. PD4 moved that button (the
            phone login gained its mark) and the crosshair slid down the price axis on a page PD4 never
            touched: 214.54 → 213.02, byte-identical on a re-run, so it was never flake. `shoot()` now
            parks the mouse at (0,0). **Ask of every diff on a page you did not touch: is this the APP,
            or is this the CAMERA?**

## The control room (/settings#pipeline — N6)
The reader can run the pipeline by hand: five actions, each in exactly one of ten states, with daily
caps and cooldowns. Server surfaces: `app/(desk)/settings/pipeline-actions.ts` (the dispatch) and
`app/api/pipeline/status/route.ts` (a 15s poll, paused when the tab is hidden).
- **THE DISPATCH API RETURNS NOTHING.** `POST .../dispatches` answers **204 with an EMPTY BODY** — no
  run id — and GitHub's own REST docs say otherwise. So the app RECOVERS the id: it stamps a
  `request_id` into each dispatch, the workflow prints it into `run-name:`, and the app matches it in
  the runs list. **That `run-name:` line in nightly-a.yml and nightly-b.yml is LOAD-BEARING** — delete
  it and nothing fails, every test but one passes, and the control room goes permanently blind.
  `pipeline/tests/test_workflow_dispatch.py` guards it.
- GitHub validates `workflow_dispatch` inputs against the workflow file **on the target ref**: a new
  input that exists only in your working tree gets a 422. The workflow must land on `main` first.
- **P-2 (a GitHub PAT with `workflow` scope) is NOT PROVISIONED**, so every button is dark in
  production. The whole path is proven working (evidence §6). It is a secret and nothing else.

## Conventions
**THIS REPO OVERRIDES THE GLOBAL RULES.** The `~/.claude/rules/*` files load into every session and
announce that they "OVERRIDE any default behavior" — in this repo they do not. Plan §6.2's targeted
TDD list and this constitution supersede them: no 80%-coverage chase (this repo has no coverage
tooling at all, deliberately — the TDD list names what gets tested and UI is explicitly exempt), no
planner/code-reviewer/tdd-guide agent ceremony, no research-first ritual before an implementation
the plan already specifies. Follow the plan you are executing. This sentence exists because every
fresh session was re-deriving it, and a session that took the globals literally would burn a phase
on coverage-chasing.

Conventional commits · TDD-first list in plan §6.2 · numbers render ONLY via components/BaseRate
and lib/format · all copy from lib/copy.ts · tokens from globals.css @theme (UI-REDESIGN-PLAN.md §3 +
Appendix A) — never ad-hoc hex · timestamps via lib/time.ts · adapters follow .claude/skills/new-provider-adapter ·
readable-first code and plain-English docs per the Readability section above.

**Any new card, panel, module or overlay: read .claude/skills/new-surface FIRST. Any new ROOM goes in
app/lib/routes-manifest.json — the sweeps, the oracle and both budgets read it, and the unit test reds
if you forget. Any table renders through components/DataTable — there is one table in this app.** It carries the
honesty checklist you run BEFORE writing markup (does it show a base rate → it renders through
BaseRate and nothing else; a probability or money → `data-p2`, and no ancestor may animate or
transform it; an outcome → the word goes in the chip; an empty state → it is information, not an
apology). Also: every control ≥44px on touch, every input ≥16px below `md` (iOS zooms in on a
smaller focused field and does NOT zoom back out), and never the slash-opacity modifier on a token
colour (`bg-surface/50` silently no-ops in Tailwind v4).

## Session ritual
Start: git pull → read this + PROGRESS.md + LESSONS.md → diff DECISIONS.md (any non-[claude]
line = user veto, rank 2.5 — honor it FIRST) → run tests → announce checkpoint.
End: update PROGRESS.md → log DECISIONS/LESSONS ([claude]-marked) → push.
**Phase exit: THE STANDING GATE OF THE PLAN YOU ARE CURRENTLY EXECUTING → tag.** Not §6.4.
DEVELOPMENT-PLAN §6.4 is the ORIGINAL 6-step gate from the P-phase era and it is history, not
law: it orders a local full `npx playwright test` (which reds ~46 snapshots on this Mac, because
baselines are Linux-born) and `npx lhci autorun` (an instrument this repo has never contained —
the real one is `check:lighthouse`). It carries a dated correction block saying so. The live gate
is the active plan's own standing-gate block — today POLISH-AND-DEPTH-PLAN.md's, run in the
Endgame order below.

## The Endgame — how a phase actually exits (GATE-EFFICIENCY-PLAN Part 3, installed at G4)
Read this before every phase exit. It is the reformed ritual, and every mechanism in it is live
and proven (evidence: `docs/gate-evidence/g0`–`g4`). The old way — tag first and let the tag run
be the first real test — is what made 52% of tag runs fail and endgames run 60–90 minutes.
1. **Local gate:** `typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift`. Once per phase: `check:migrations`
   (local only — CI structurally cannot answer it).
2. **Push to main.** Confirm the branch run green.
3. **REHEARSE — this is the reform.** `gh workflow run ci.yml -f job=e2e` runs the FULL browser
   oracle (all three shards) on any ref, with no tag involved. It is **the same job the tag runs**,
   so a green rehearsal is not evidence *about* the tag run — it is the same evidence, collected
   before the tag exists. Rehearse on the exact SHA you are about to tag. In parallel (they
   overlap; push and rehearsal deliberately share a ref): wait for the Vercel deploy, then
   **`check:live`** (PD1 — it must be GREEN; a pending assertion owed to a later phase is fine, a
   FAIL is not), `check:nav` and `check:lighthouse`.
   **`check:live` is the only guard that asks whether PRODUCTION is right rather than whether the
   CODE is, and it is the reason a phase may not exit on a deployment nobody looked at.** If it reds,
   read it before you believe it: PD1's own run reds were twice the CHECKER being wrong, not the
   Desk. And if an advisory number moves (Lighthouse perf), RE-SAMPLE before you explain it —
   synthetic-4G runs vary by ten points, and a shrug and a panic are equally wrong.
4. **Rehearsal red on pixels?** The run mints its own candidate baselines
   (`vrt-baselines-candidate-<leg>`). Download, **OPEN EVERY IMAGE**, commit only an explained
   diff. Read `.claude/skills/vrt-update/SKILL.md` first. An unexplained diff is a bug, not a
   baseline to refresh.
5. **Rehearsal green → tag the rehearsed SHA, BY SHA** (`git tag <family>-N <sha>` — never `HEAD`;
   the nightly heartbeat can move main under you) → push → confirm the tag run green.
6. **THE TAG STAYS PUT.** A suspected flake gets `gh run rerun <id> --failed` — never a re-point.
   But READ THE FAILURE FIRST: G2's "flake" was a real race that had failed its retry too. A real
   defect found after tagging means the phase was not done: fix forward, and the *next* tag's
   evidence file tells the honest story.
7. **ONE docs commit, AFTER the tag** — intelligence files + evidence + NEXT-SESSION-PROMPT.md
   together. That commit is FREE: `on.push` carries `paths-ignore: ['**/*.md', 'docs/**',
   '.claude/**']`, so a prose-only commit starts no CI run at all (a MIXED commit still runs in
   full). Never re-point a green tag onto trailing prose. Never write a post-tag "CI confirmed
   green" commit — the tag run's green IS the record, cited by run-id in the evidence file.
   **THE TRAP: nothing in the gate currently READS those ignored paths, which is the only reason
   the filter is safe. If you ever write a guard that reads a document, put its path back in the
   trigger FIRST — otherwise the guard breaks silently.**
8. **Every evidence file ends with the gate-size line** — "N drift rules · N VRT baselines · N e2e
   specs · N unit tests · N bundle baselines · N manifest rooms · tag run M m S s." Growth of the
   gate is a booked decision with a reason, never an accident.

## Design one-liner
“Morning Broadsheet” (amended 2026-07-11/12; supersedes “Broadsheet Terminal”): editorial
serif over mono numerals, ONE lavender morning-light wash across the whole app, glass cards
with soft depth, modular rooms — bounded cards, one tap to depth — hairlines inside cards,
one hero figure. One theme at a time — light
“Morning” or dark “Midnight” — governs every room including the Academy (the Academy-stays-
light rule was repealed by the user, 2026-07-12); rooms differ by structure and pace, never
by palette. Color is scarce and always means something. If it could be a template — austere
OR glossy — it is wrong. Spec: UI-REDESIGN-PLAN.md Part 3 · checklist: **`app/scripts/check-drift.mjs`
is the checklist** (28 rules, `npm run check:drift`). §3.10 v2 is its prose ancestor and is now a
pointer, not a register — the script is the truth, and it is the thing that actually runs.

## Timing (user lives on market time)
User: Long Island, NY — America/New_York, observes DST. Crons UTC-fixed (DST-proof):
Job A 22:37 UTC = 6:37pm EDT / 5:37pm EST · Job B 00:25 UTC = 8:25pm EDT / 7:25pm EST.
Briefing ready ~8:40pm EDT / ~7:40pm EST — promise 9:00pm ET year-round. Display tz: ET only.
