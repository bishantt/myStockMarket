# Your session: CC6 — Honest relevance. CC6 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1, LC1, LC2, LC3, CC2, CC3, CC4 and CC5 are DONE
and tagged (`cc-1`, `lc-1`, `lc-2`, `lc-3`, `cc-2`, `cc-3`, `cc-4`, `cc-5`). LEAN-CODEBASE (Plan B) is
COMPLETE.** Two plans sit at the repo root: **CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and
**LEAN-CODEBASE-PLAN.md** (Plan B, done). The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 → CC7 → CC8 → CC9 → CC10**

You run **CC6 of CLARITY-AND-CADENCE-PLAN.md and nothing else** — one phase per session is standing
law (CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked. **After CC6 the order continues at CC7.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, and the phase evidence file — CC evidence goes under
   `docs/clarity-evidence/cc6.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, **CC7** of CLARITY-AND-CADENCE-PLAN.md) — carrying
   this handoff rule forward verbatim in spirit, the phase-order line, the phase's build list distilled
   from its plan, its gate, and anything in flight. Assume the next session has NO memory of yours.
   (Read CLARITY-AND-CADENCE-PLAN.md's CC7 section — Part 4.6 + the Part 5 CC7 line + Appendix C — to distill it.)
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into CC7.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to the OPEN
   questions (QUESTIONS-FOR-BISHANT.md): **Q-LC1-1** (vrt-diff.mjs BROKEN — `pixelmatch` absent from
   node_modules; fix is `npm i -D pixelmatch` or a pngjs-only rewrite — if unanswered and CC6's re-shoot
   needs a candidate diff, use the pngjs-only counter in PATTERNS.md, "Count VRT candidate pixels without
   pixelmatch"). **Q-CC5-2** (the check:live "strip · next-edition" transient — see below; it is CC8/CC9's,
   not CC6's, but if it is STILL red at your post-deploy step, read it the same way: is a nightly delayed
   past its cron? If so it is the PD1 wall-clock window, not your defect). **Q-CC5-1** (the story-sheet
   image reposition — P-1's; not CC6's). **P-1** (media bucket — still text-first default; not CC6's).
2. Read CLARITY-AND-CADENCE-PLAN.md before touching anything — especially **Part 4.5** (the CC6 spec:
   the movers floor, RelVol diagnosis, significance v2, calendar hygiene), **R5** in Part 3 (relevance is
   significance, ties break newest-first — the ruling + its guard), **D6** in Part 2 (the junk-parade
   diagnosis) and **D7** (the calendar-tells-yesterday-twice diagnosis), **Appendix B #1** (the
   `instrument.assetClass/exchange` migration), **Appendix E** (Significance v2 worked example — THE TEST
   IS THIS TABLE), and the **Part 5 CC6 line**.
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 781 · pipeline 579 passed / 35 skipped** (unchanged since cc-5).

## CC6's build list (Part 4.5 + the Part 5 CC6 line are authoritative; this is the distillation)

CC6 makes RELEVANCE honest — two deterministic, pipeline-side, tested scores (R5). Build 4.5 exactly:

- **RelVol diagnosis FIRST (the first hour).** Every seeded mover prints RelVol "20.0×" exactly (D6) —
  find the clamp or the degenerate denominator. Fix it, or if it is a real cap, LABEL it ("≥20×",
  copy `relvolCapped`). A number that cannot exceed its cap must SAY so.
- **The movers floor (Desk module + "moved without a story").** Eligible = common stocks + the ~15 core
  sector/index ETFs; EXCLUDE trusts, ADR-hedged wrappers, structured products, and anything below the
  dollar-volume floor. **Reuse `_DV_WINDOW` (the base-rate engine's large/mid bucket boundary) — do NOT
  invent a second liquidity notion.** Instrument classification comes from Alpaca's `list_universe`
  payload (already fetched nightly). Module footnote: "Liquid names only — the full universe stays in
  Scans." (copy `movers.floorNote`). Scans stay universe-wide (their job; D6). The Desk movers e2e
  asserts every rendered symbol carries the liquid-floor marker the loader exposes.
- **THE MIGRATION (Appendix B #1):** `instrument.assetClass String?` + `instrument.exchange String?` —
  ONE additive migration, backfilled from the Alpaca universe payload on the next full run; null stays
  legal (delisted rows). `npx prisma migrate dev --name <name>`, then **run `check:migrations` (it is a
  once-per-phase local check, and CC6 is the phase that adds a migration — CI structurally cannot answer
  whether the LIVE db got it; deploy runs `prisma migrate deploy`).**
- **Front-page significance v2:** `score = catalyst_weight × corroboration × entity_weight × freshness`.
  catalyst_weight ranks hard events over commentary (M&A/FDA/earnings/Fed > guidance > analyst/opinion —
  this kills the single-name-blog analyst lead); corroboration = distinct outlets (already computed);
  entity_weight uses the same dollar-volume bucket (a mega-cap/index outranks a micro-cap PR at equal
  catalyst); freshness decays over the window and **ties break NEWEST-first** (amends the documented
  oldest-first tie). **Weights live in ONE table with a unit test PER ROW, and the worked example is
  Appendix E — the test IS that table (d > a > b > c for the four clusters).** The Front-page dek names
  the new ordering in one sentence (copy.ts).
- **Calendar hygiene (D7):** row grammar becomes `[WEEKDAY DATE] [KIND CHIP] Title`, the symbol spoken
  ONCE ("JPM earnings" — the chip says EARNINGS, the ticker chip says JPM, the title stops repeating
  both); ordering is forward-first (post-close: tomorrow's events lead), and today's reported earnings
  collapse into ONE "Reported today: JPM · BAC · GS · C · WFC" row (copy `reportedToday`). NOTE: the
  dedupe BUG itself landed earlier (CC1, on (code,date,symbol)); CC6 is the row GRAMMAR + ordering.

## CC6's gate (the Endgame, CLAUDE.md) — pipeline-first TDD, a migration, and a REAL run read by eye

1. **Pipeline tests FIRST** (the significance scoring table row-by-row against Appendix E; movers-floor
   membership; the calendar dedupe/collapse fixture). Then app tests (the module footnote, the ordering,
   the calendar grammar). Then build.
2. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift` — **29 rules at cc-5**). Guard scripts
   need Node 24 — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. **`check:migrations`
   once-per-phase — CC6 ADDS a migration, so this matters: apply it locally AND confirm the live DB gets
   it (deploy runs migrate deploy; check:migrations compares disk vs live).**
3. Push to main → confirm branch CI green.
4. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag (four-leg oracle).
   **VRT: desk + news move (Appendix C CC6 — movers module, front-page ORDER, calendar rail).** The
   front-page order changes (significance v2), so the lead may change — open every candidate, confirm the
   diff is the new ordering + the movers floor + the calendar grammar, and nothing else. Read
   `.claude/skills/vrt-update/SKILL.md` first. Diff EVERY candidate (the pngjs counter — Q-LC1-1). Batch
   every red leg into ONE re-shoot (standing rule). In parallel: wait for the Vercel deploy, then
   `check:live`, `check:nav`, `check:lighthouse`.
   **check:live watch:** CC6 changes movers ordering + calendar + the front-page dek. `scripts/live-truth.mjs`
   reads the macro board, the calendar hygiene (retired providers / rows behind the edition), the news
   press-time and byline links — GREP it before the deploy (the CC3 lesson) and confirm no CC6 phrase is
   asserted that your copy change would break. If the "strip · next-edition" red is still present, it is
   the Q-CC5-2 delayed-nightly transient (CC8/CC9's), not CC6's — verify by checking whether the current
   nightly-a has fired.
5. **Post-deploy, the pipeline-verification memory (the real check):** dispatch a REAL `news` mode run
   (`gh workflow run nightly-a.yml -f mode=news` or the control-room path) and **READ THE PUBLISHED FRONT
   PAGE IN PRODUCTION** — the suite going green is NOT the check (PD7's sha1-hash-in-a-newspaper scar; the
   `pipeline-phase-verification` memory). Confirm the new ordering reads sensibly and the movers floor
   actually filtered the junk.
6. Rehearsal green → tag `cc-6` **by SHA** → push → confirm the tag run.
7. ONE docs commit after (evidence `docs/clarity-evidence/cc6.md`; intelligence files; this file
   rewritten for CC7). Every evidence file ends with the gate-size line. Then report and STOP.

## Scope discipline

CC6 is honest relevance: the front-page ORDER, the movers floor, RelVol, and calendar grammar. Do NOT
touch the news CARD anatomy (CC5, DONE — text-first is shipped), the control-room table (CC7), the dawn
cron / Morning Edition (CC8/CC9), or the grid columns. If a relevance change tempts an adjacent
control-room or edition fix, LOG it — CC7/CC8/CC9 own those.

## Carry-forward notes (do not lose these)

- **`cc-5` state:** app **781** unit · pipeline **579** passed / 35 skipped · **97 VRT baselines** ·
  **29 drift rules** (no new rule in CC5 — R4 deletes the L3/L4 rungs but keeps drift rule 20's NewsImage
  door) · **27 e2e specs** · **14 manifest rooms** · 4 oracle legs · **16 bundle baselines**. Tag `cc-5`
  on `5382f06`, tag run `29458574720` green (7 m 51 s). (All run ids in docs/clarity-evidence/cc5.md.)
- **CC5 is shipped and correct:** the news is text-first — NewsImage is L1/L2-or-nothing (L3/L4 DELETED),
  the card is headline-first with a byline carrying the source count (only when >1), "Market-wide" on the
  card / the full sentence on the sheet, the story-sheet placeholder gone. `bylineSourceCount` is the new
  pure helper. If you touch the movers or the front page, you are working ON TOP of the text-first cards —
  do not re-introduce any image frame; drift rule 20 + the R4 e2e guard (`news-image-generated` count 0)
  will red the build if you do.
- **Q-CC5-2 — the check:live "strip · next-edition" transient (NOT a CC5 or CC6 defect).** At CC5's
  post-deploy step, check:live redded 6/7: the strip promised "next edition Thu" while the edition was
  Tuesday, because tonight's Wednesday nightly-a had not fired at 44 min past its 22:37 UTC cron, so the
  strip's wall-clock next-edition rolled forward. It is the PD1 transitional window, stretched by a GitHub
  cron delay. It is owed to CC8/CC9 (the edition-state machine). If your CC6 post-deploy check:live shows
  the same red, check whether the current nightly has fired before believing it (PD1: read it first).
- **Q-CC5-1 — the story-sheet image "below the byline" reposition — deferred to P-1** (Option B: the
  placeholder is removed, real photos stay put). Not CC6's.
- **The seed's news images:** three fixture photos (fed-hold, fda-nonopioid, amd-acquisition) exercise
  the L1/L2 paths in VRT; the other 11 clusters are text-first. The Desk front-page module
  (FrontPagePreview) is a GLANCE list (headline + tag + sourcesLine), NOT the NewsCard — CC6's front-page
  ordering changes which 3 it shows, so its VRT may move.
- **The pipeline-verification memory is load-bearing for CC6:** the test suite goes green while production
  can publish garbage (PD7's sha1 hash in a sentence). CC6's real check is dispatching a `news` run and
  READING the front page. Memory: `pipeline-phase-verification`.
- **`vrt-diff.mjs` is BROKEN** (`pixelmatch` absent — Q-LC1-1, unanswered through CC5). Use the pngjs-only
  counter (PATTERNS.md), write it INSIDE app/, run under Node 24, delete after. The moved==failed check it
  gives you is the PD5 law's proof that nothing hid under the 600px tolerance.
- **The guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit
  version (`v24.18.0`; the glob `v24*` breaks). `check:live`/`check:nav`/`check:lighthouse` need
  `set -a; source .env; set +a`; Lighthouse needs `CHROME_PATH`.
- **The local e2e harness (docker `msm-e2e`) works** — DB URL
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, ONE project at a time with `--workers=1 --ignore-snapshots`. **RE-SEED before the run.**
  **CC6 adds a migration — after `prisma migrate dev`, re-run `migrate deploy && db:seed` on the docker DB
  before the e2e harness.** The new columns are nullable so the seed is safe, BUT the movers-floor logic
  needs SOME seeded instruments classified (assetClass/exchange) or the floor will exclude everything or
  nothing — seed a few values so the filter is actually exercised by the Desk movers e2e.
- **`dummy/`** was RETIRED at CC5's docs commit (the old news-placeholder screenshots are stale). The
  **UI-LIBRARY-EVALUATION trio** (`.md` + PDF + HTML, untracked) is a finished deliverable — leave it.
- **Stage by explicit path, never `git add -A`** (the 2026-07-12 scar).
