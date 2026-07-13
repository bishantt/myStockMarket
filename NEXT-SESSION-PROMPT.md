You are Claude Opus 4.8, sole builder of myStockMarket. Continue executing NEWS-AND-CONTROL-PLAN.md
(phases N0–N7) under its Autonomy Contract. **N0, N1 and N2 are DONE and tagged (nc-0, nc-1, nc-2).**

## SESSION RHYTHM — ONE PHASE PER SESSION
Do NOT run multiple phases in one session. Long single-session runs bloat the context window and
degrade the quality of later work. Work ONE phase, then stop. (This is now a standing rule in
CLAUDE.md — read it there.)

At the end of the phase:
1. Finish it properly — tests green, the plan's standing gate passed, tagged nc-N, everything
   committed and pushed. Never stop mid-task or with a red build.
2. Bring EVERY intelligence file fully current: PROGRESS.md, DECISIONS.md, LESSONS.md, PATTERNS.md,
   QUESTIONS-FOR-BISHANT.md, plus the evidence table for the phase. Write them as if the next session
   has NO memory of this one — because it won't.
3. Rewrite NEXT-SESSION-PROMPT.md at the repo root: complete, paste-ready, self-contained.
4. Report back in plain English: what you built, what passed, anything new in QUESTIONS-FOR-BISHANT.md,
   and confirm NEXT-SESSION-PROMPT.md is ready.

Then STOP and wait. Do not roll into the next phase.

Within a phase, the Autonomy Contract still holds: never ask, never wait, never end a phase with a
question. Anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked.

## START HERE, IN THIS ORDER
1. Run the CLAUDE.md session ritual: git pull → read CLAUDE.md + PROGRESS.md + LESSONS.md → diff
   DECISIONS.md for any non-[claude] line (user veto, rank 2.5 — honor it FIRST) → run both test
   suites → announce your checkpoint.
2. Confirm the `nc-2` tag's CI is green (`gh run list`). If the pixel oracle (the e2e + VRT job) is
   red, the diagnosis is almost certainly in the VRT clock pin — see "Standing hazards" in PROGRESS.md.
   **Do NOT loosen the pixel tolerance to make it green.** That guard has now found four real bugs.
3. Then execute **N3 — the macro board** (plan Part 6): the four fetchers (30-yr mortgage, CPI YoY,
   gold, USD→NPR) with cadence-honest fetching and no-thrash logic, the C7 degradation ladder, the
   Mood gauge (compute + the C8 display contract), the board layout inside the Macro Pulse, and the
   provenance strings.
4. Finish N3, checkpoint it per the rhythm above, hand over NEXT-SESSION-PROMPT.md, and stop.

## BINDING CONTEXT — DO NOT RE-DERIVE
- Read NEWS-AND-CONTROL-PLAN.md end to end once before touching anything. Intent binds; where the
  plan and the tree disagree on a detail, **the tree wins on the detail**.
- `docs/nc-evidence/n0-audit.md` is the ground truth of the tree and production.
  `docs/nc-evidence/n2-footprint.md` is N2's evidence.
- **The `macro_stat` table ALREADY EXISTS in production.** It landed in N0's migration, which N2
  finally applied (see below). Do not write a new migration for it — check `prisma/schema.prisma`
  and the live DB first.
- **N3 must USE what N2 built**, rather than inventing parallel machinery:
  · `copy.window.*` — the CLOSED window vocabulary. A metric label without a token fails a test.
  · `copy.macroBoard.*` — already specced verbatim in the plan's Appendix B.
  · the `wide` (1536px) breakpoint and the per-room column maps.
  · **the escalation pattern the pipeline strip established**: quiet when normal, loud ONLY when the
    news is genuinely bad. Ruling C7's stale-cell alert colour is a sanctioned amber consumer; add it
    to `ALERT_ALLOWED` in check-drift.mjs and log the amendment.
  · `--color-danger` is NOT available to you. It has exactly one consumer forever (drift rule 19).
- **Ruling C8 is the one to get right:** the Mood gauge's number may NEVER render without its
  component breakdown. Enforce it in the TYPE (make the breakdown a required prop), the same shape
  BaseRate uses — not by convention, and not by a code review.
- Part 0.1 (where the News room lives) is unanswered: build the default (a sixth tab), keep the
  [VETO?] marker; it's a one-file flip until N5.
- Provisioning P-1 (R2 media bucket), P-2 (GitHub PAT), P-5 (GoldAPI key) are ABSENT. **Never block on
  them.** P-5 is N3's: the gold cell renders its honest "not yet reported" state (C7 rung 4) without
  it. Flip features live if the secret lands.
- Prepend `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` to node commands.

## HARD-WON HAZARDS — read these before you trust a green gate
- **CI's database is DISPOSABLE and can tell you NOTHING about production's.** It migrates a fresh
  container every run. Production silently ran without N0's migration for days while every gate was
  green, and the Macro Pulse degraded nightly because of it. `npm run check:migrations` is the
  instrument that can see this, and it is in the standing gate now. The deploy also applies
  migrations (vercel.json), failing closed.
- **There is no local Postgres on this Mac**, and there will not be. Do not spend a session trying.
- **VRT baselines are BORN IN CI**: `gh workflow run ci.yml -f job=vrt-baselines`, download the
  artifact, commit it. Never shoot a baseline on macOS.
- **The VRT clock is PINNED** to the seed's session (`SEEDED_SESSION` in `e2e/vrt.spec.ts`), because
  the Desk now renders something that depends on what time it is. If the seed's trading day moves,
  move the pin with it. The desk shots assert the strip is FRESH and will fail loudly saying so.
- **`npm run e2e:local` runs against PRODUCTION data**, unseeded, so the seeded journeys skip. Run it
  anyway — it is what caught N2's a11y contrast regression and two broken sweeps.
- **When a re-baseline or a gate surprises you by being green, that is a finding, not a relief.** Six
  guards in this build have turned out to pass because the thing they measured was ABSENT rather than
  correct. Make every sweep assert that it swept something.
- **Open the PNG and look at it.** Four real bugs in this build were found that way and by no other
  means.

## DONE MEANS (across all sessions)
`nc-final` tagged with green CI, every evidence table in `docs/nc-evidence/`, the N7 docs sync
executed, every [VETO?] carrying its assumption marker, and a closing PROGRESS.md entry written for
the user to read.

Begin: run the session ritual, confirm nc-2's CI, then execute N3 and stop.
