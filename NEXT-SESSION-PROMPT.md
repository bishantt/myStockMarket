# Your session: CC2 — Time, told properly. CC2 ONLY. Back to Plan A.

The two-plan commission (2026-07-15) is under way. **CC1, LC1, LC2 and LC3 are DONE and tagged (`cc-1`,
`lc-1`, `lc-2`, `lc-3`). LEAN-CODEBASE (Plan B) is COMPLETE.** Two plans sit at the repo root:
**CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and **LEAN-CODEBASE-PLAN.md** (Plan B, done).
The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

You run **CC2 of CLARITY-AND-CADENCE-PLAN.md and nothing else** — one phase per session is standing law
(CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked. **After CC2 the order continues at CC3.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, and the phase evidence file — CC evidence goes under
   `docs/clarity-evidence/cc2.md`; make the directory if it does not exist).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, that is **CC3** of CLARITY-AND-CADENCE-PLAN.md) —
   carrying this handoff rule forward verbatim in spirit, the phase-order line, the phase's build list
   distilled from its plan, its gate, and anything in flight. Assume the next session has NO memory of
   yours. (Read CLARITY-AND-CADENCE-PLAN.md's CC3 section to distill it.)
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into CC3.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to **Q-LC1-1**
   (vrt-diff.mjs devDependencies — still open, no veto through LC3; NOT a CC2 concern, leave it unless
   Bishan now speaks) and for any word on **CLARITY Part 0** (P-1/P-2/dawn-cron/retention — those
   defaults land at CC5/CC7/CC8/CC10, not CC2).
2. Read CLARITY-AND-CADENCE-PLAN.md in full before touching anything — especially **Part 4.1** (the CC2
   spec, the formatter table), the phase line in **Part 6** (`CC2 — Time, told properly`), **Appendix A**
   (the copy.ts time templates that change), and **Appendix C** (the VRT delta — every timestamp).
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 753 · pipeline 579 passed / 35 skipped** (unchanged since lc-2).

## CC2's build list (the plan's Part 4.1 + the Part 6 CC2 line are authoritative; this is the distillation)

CC2 tells time properly, and NOTHING else — it is "the cleanest possible diff list: every timestamp
string, nothing else" (Appendix). Build Part 4.1 exactly:

- **The formatters in `lib/time.ts`** — names final, shapes pinned by tests. New/changed:
  - `formatEtClock(instant)` → `7:36 PM` (12-hour, no pad) — as-of lines, status lines, news footers.
  - `formatEtClockPadded(instant)` → `07:36 PM` — mono columns only (the control-room table).
  - `formatAsOf(instant)` → `as of 7:36 PM ET` — every SectionMasthead.
  - `formatEtDate(instant)` → `Tue, Jul 14` (GAINS a weekday) — news card footers, run stamps.
  - `formatUtcDate(bareDate)` → `Tue, Jul 14` (GAINS a weekday) — settings, strips, calendar rows.
  - `formatUtcDateLong(bareDate)` → `Tuesday, July 14, 2026` (UNCHANGED) — the masthead.
  - `formatEtStamp(instant)` → `Tue, Jul 14 · 7:36 PM ET` — one-line provenance (footers, sheets).
- **The bare-date-vs-instant distinction is load-bearing and UNCHANGED** — a bare date renders from its
  UTC components, an instant in ET. Only the SHAPES change, never which function a call site uses.
- **Every call site** updated to the new shapes.
- **copy.ts templates that embed times** update in the SAME commit (Appendix A) — they are Appendix J
  contract strings, so a change is structural and the copy.test pins them (see CLAUDE.md `voice:`).
- **Kill the ISO leak:** the settings pipeline card renders dates through `formatUtcDate`, never a raw
  `runDate` string.
- **The pipeline strip keeps its weekday voice** ("Data through Tue's close · ran 7:36 PM ET · next:
  Wed ~6:37 PM ET").
- **A NEW drift rule: `Intl` (DateTimeFormat) lives only in `lib/time.ts`.** Same family as drift rule 22
  (weekday words) — one door for date/time rendering. Add it to `app/scripts/check-drift.mjs` (which now
  PRINTS its own rule count), and it makes the gate GROW by one rule — a booked decision, so say so in
  the evidence file's gate-size line with the reason.
- **TDD:** rewrite `app/lib/time.test.ts` to the new shapes FIRST (it goes RED), then implement until
  green. This is the phase's whole point — the shapes are pinned by the test before the render changes.

**Scope discipline:** CC2 is timestamps only. Do not touch the masthead layout, the theme toggle, the
hierarchy grammar — those are CC3/CC4. If a timestamp change tempts an adjacent fix, log it and leave it.

## CC2's gate (the Endgame, CLAUDE.md) — a FULL FOUR-LEG REHEARSAL is required

Every timestamp in the product changes, so this is a VRT phase — the rehearsal is not optional.
1. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift` — the new Intl rule must be live and
   green). The guard scripts need Node 24 — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`
   (name the version; the glob `v24*` matches TWO dirs and breaks). `check:migrations` is once-per-phase;
   CC2 adds no migration.
2. Push to main → confirm the branch CI green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag (the full four-leg
   oracle). **VRT: every timestamp shot MOVES — this is expected and is the phase's ENTIRE VRT budget.**
   Batch nothing else into it. When legs red on pixels, download the candidates for EVERY red leg, OPEN
   EVERY IMAGE (use `app/scripts/vrt-diff.mjs <candidate-dir>` from `app/`), and CONFIRM the diff reads
   "timestamps only" — a diff on anything that is not a timestamp is a bug, not a baseline. Read
   `.claude/skills/vrt-update/SKILL.md` first. Fix all reds, then re-shoot ONCE (the batch-into-one-reshoot
   standing rule — CLAUDE.md `VRT:`).
4. Rehearsal green → tag `cc-2` **by SHA** (never HEAD — the nightly heartbeat can move main) → push →
   confirm the tag run.
5. ONE docs commit after (evidence file **`docs/clarity-evidence/cc2.md`** with the before/after shape
   examples, the VRT-candidate confirmation that the diff is timestamps-only, the rehearsal run id;
   intelligence files; this file rewritten for CC3). Every evidence file ends with the gate-size line
   (note the +1 drift rule). Then report and STOP.

## Carry-forward notes (do not lose these)

- **`lc-3` state:** app **753** unit · pipeline **579** passed / 35 skipped · **97 VRT baselines**
  (0 changed at lc-3 — comments render nothing) · **28 drift rules** · **26 e2e specs** · 14 rooms · 4
  oracle legs · **16 bundle baselines**. Tag `lc-3` on `16f83cd`, branch run `29432105571` green, tag
  run `29432745654` green. (CC2 will make the drift-rule count 29 — book it.)
- **The LEAN tools are committed and available** (do not re-create them):
  `pipeline/scripts/comment_stats.py` (comment density + worklist), `pipeline/scripts/comment_prover.py`
  (proves an edit is comment-only — use it if CC2's boy-scout rule tidies a file's comments), and
  `app/scripts/vrt-diff.mjs` (candidate-diff for a red rehearsal leg). See PATTERNS.md.
- **The comment standard is law and CC2 must honor it in new code** (CLAUDE.md Readability point 3):
  comment only where a reader would be lost, ≤1 line (2 when truly necessary), never restate the code,
  the why always earns its place, boy-scout the file you edit. The 25 hottest files are already lean
  (LC3); keep them that way — copy.ts especially, since CC2 edits its time templates.
- **The guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit
  version. `check:live`/`check:nav`/`check:lighthouse` need `set -a; source .env; set +a`; Lighthouse
  needs `CHROME_PATH`.
- **The local e2e harness (docker `msm-e2e`) works** — DB URL
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, ONE project at a time with `--workers=1 --ignore-snapshots`. Full recipe in PROGRESS.md.
- **Open questions (QUESTIONS-FOR-BISHANT.md, none blocking):** Q-LC1-1 (the vrt-diff devDependency
  choice — LEAN is done, so it now travels with CC or waits for Bishan), plus the carried CC1 items:
  Q-CC1-1 (ticker-slug rendered proof handed to CC4), Q-PD6-3 (watchlist reason truncation, now CC4's),
  the PD10 iOS on-glass photos (Bishan's device), and CLARITY Part 0 (P-1/P-2/dawn-cron/retention —
  defaults proceed at CC5/CC7/CC8/CC10).
- **`dummy/`** (Plan A's screenshot evidence) stays untracked/kept until CC5 (Part 4.4 hands LEAN the
  note that they may retire after CC5). Do not commit or delete it. The **UI-LIBRARY-EVALUATION trio**
  (`.md` + PDF + HTML, untracked) is a finished deliverable — leave it. Stage by explicit path, never
  `git add -A` (the 2026-07-12 parallel-session sweep is the scar).
