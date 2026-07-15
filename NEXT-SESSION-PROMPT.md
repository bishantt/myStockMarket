# Your session: CC3 — The masthead and the toggle. CC3 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1, LC1, LC2, LC3 and CC2 are DONE and tagged
(`cc-1`, `lc-1`, `lc-2`, `lc-3`, `cc-2`). LEAN-CODEBASE (Plan B) is COMPLETE.** Two plans sit at the
repo root: **CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and **LEAN-CODEBASE-PLAN.md**
(Plan B, done). The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

You run **CC3 of CLARITY-AND-CADENCE-PLAN.md and nothing else** — one phase per session is standing law
(CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked. **After CC3 the order continues at CC4.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, and the phase evidence file — CC evidence goes under
   `docs/clarity-evidence/cc3.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, that is **CC4** of CLARITY-AND-CADENCE-PLAN.md) —
   carrying this handoff rule forward verbatim in spirit, the phase-order line, the phase's build list
   distilled from its plan, its gate, and anything in flight. Assume the next session has NO memory of
   yours. (Read CLARITY-AND-CADENCE-PLAN.md's CC4 section — Part 4.3 + the Part 5 CC4 line — to distill it.)
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into CC4.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to **Q-LC1-1**
   (vrt-diff.mjs is now BROKEN — `pixelmatch` vanished from node_modules; the two-line fix is
   `npm i -D pixelmatch`, or rewrite it onto pngjs alone — see the pattern in PATTERNS.md). If Bishan
   has NOT spoken and CC3's VRT re-shoot needs a candidate diff, use the pngjs-only counter from
   PATTERNS.md; the triptych diff images are the real proof regardless. Also check for any word on
   **CLARITY Part 0** (P-1/P-2/dawn-cron/retention — those defaults land at CC5/CC7/CC8/CC10, not CC3).
2. Read CLARITY-AND-CADENCE-PLAN.md before touching anything — especially **Part 4.2** (the CC3 spec:
   the masthead mock, the strip, the toggle, the phone pill), **R3** in Part 3 (one truth per line —
   and its e2e guard), the **Part 5 CC3 line**, **Appendix A** (the two copy strings that change +
   the toggle aria), and **Appendix C** (the CC3 VRT delta: top strip of every room + toggle journey).
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 761 · pipeline 579 passed / 35 skipped** (unchanged since cc-2).

## CC3's build list (Part 4.2 + the Part 5 CC3 line are authoritative; this is the distillation)

CC3 is the masthead, the strip, and the theme toggle — a structural + chrome phase. Build 4.2 exactly:

- **One-truth masthead (ruling R3).** The desktop Desk masthead becomes four lines:
  - Line 1: `THE DESK — EVENING EDITION` (kicker) with the icon row top-right: `[◐ theme] [⚙ gear] [● MARKET CLOSED pill]`.
  - Line 2: the long date (`Tuesday, July 14, 2026` — formatUtcDateLong, UNCHANGED from CC2).
  - Line 3 (NEW, replaces BOTH current meta lines): one reader-voice sentence, weekday first —
    **`Tuesday's close · updated 7:36 PM ET`** (copy `"{weekday}'s close · updated {stamp}"`; `{stamp}`
    is CC2's 12-hour "7:36 PM ET" clock). "Markets closed" LEAVES this line — the pill top-right is the
    single market-state truth (R3). The `{weekday}` comes through lib/time.ts (formatWeekdayLong or
    formatUtcWeekday — do NOT mint a second weekday formatter; drift rules 22 AND 29 forbid it).
  - Line 4: the pipeline strip, provenance voice ONLY.
- **Strip slimming.** The strip keeps pipeline provenance ONLY: sources, degraded, next run. The phrase
  "Data through Tue Jul 14 close" DIES — "Tuesday's close" in line 3 carries the data vintage now.
  New copy (Appendix A): `"{n} sources · {degraded} degraded · next edition {day} ~{time}"` →
  "14 sources · 2 degraded · next edition Wed ~6:37 PM ET". (CC2 deliberately left the strip's fresh
  copy alone — this is where it restructures.)
- **The theme toggle** — a sun/moon icon button (◐) in the top bar, LEFT of the gear, in EVERY room and
  BOTH zones (the Academy top bar gets the same pair). One tap cycles Light ↔ Dark (long-press or
  Settings for System — Settings keeps the three-way System/Light/Dark control as the canonical
  surface, UNCHANGED). It writes the SAME cookie the pre-paint script reads (`lib/theme.ts`) so there
  is no flash and SSR stays honest. 44px touch target; `aria-label` from copy.ts
  (`"Switch to {mode} theme"`); icon-only, no text.
- **Phone masthead** gains the market-state pill (dot + "CLOSED") between the logo and the two icon
  buttons — the phone currently states the market's state NOWHERE (D10). The pill + two icon buttons
  must fit 360px without wrapping (measure in the phone sweep, not by eye — CLAUDE.md `phone:`).
- **a11y sweep** covers the new toggle button (it is a real control — announced name, 44px). **grid.spec
  is unaffected** (no column changes — do NOT touch the grid; that is not this phase).
- **TDD:** the masthead e2e guard for R3 comes FIRST — it counts occurrences of the market-state word
  and the close-date within the header region and fails on more than one of each. Then the toggle: a
  unit test on the cycle logic + the e2e journey below.

## CC3's gate (the Endgame, CLAUDE.md) — a FULL FOUR-LEG REHEARSAL is required

The masthead and every room's top strip change, and the toggle adds a new control, so this is a VRT
phase — the rehearsal is not optional.
1. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift` — still 29 rules, no new rule in CC3
   unless you add one; if you do, book it). Guard scripts need Node 24 — prepend
   `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (name the version; the glob `v24*` breaks).
   `check:migrations` is once-per-phase; CC3 adds no migration.
2. Push to main → confirm the branch CI green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag (the four-leg
   oracle). **VRT: every room's top strip MOVES (the masthead + strip restructure) plus the toggle
   journey shots.** When legs red on pixels, download the candidates for EVERY red leg, OPEN EVERY
   IMAGE, and CONFIRM the diff is the masthead/strip/toggle and NOTHING else. (`vrt-diff.mjs` may still
   be broken — use the pngjs-only counter pattern in PATTERNS.md, but the triptychs are the real proof.)
   Read `.claude/skills/vrt-update/SKILL.md` first. Fix all reds, re-shoot ONCE (batch-into-one-reshoot).
   In parallel: wait for the Vercel deploy, then `check:live` (must be GREEN), `check:nav`, `check:lighthouse`.
4. Rehearsal green → tag `cc-3` **by SHA** (never HEAD — the nightly heartbeat can move main) → push →
   confirm the tag run.
5. ONE docs commit after (evidence `docs/clarity-evidence/cc3.md`; intelligence files; this file
   rewritten for CC4). Every evidence file ends with the gate-size line. Then report and STOP.

## The e2e toggle journey (Part 5 CC3 line + Appendix C)

One journey, both themes, via the NEW button: click the toggle → assert `data-theme` on the root
flipped AND the theme cookie was written (the same cookie lib/theme.ts's pre-paint reads) → reload →
assert it PERSISTS (no flash, SSR honest). VRT: every room's top strip in the toggle journey shots.

## Scope discipline

CC3 is the masthead, the strip, and the toggle. Do NOT touch the hierarchy grammar / table treatment
(CC4), news (CC5), or the grid columns. If a masthead change tempts an adjacent fix, log it and leave it.

## Carry-forward notes (do not lose these)

- **`cc-2` state:** app **761** unit · pipeline **579** passed / 35 skipped · **97 VRT baselines**
  (65 re-shot at cc-2, timestamps only) · **29 drift rules** (CC2 added rule 29, the Intl one-door) ·
  **26 e2e specs** · 14 rooms · 4 oracle legs · **16 bundle baselines**. Tag `cc-2` on `a9356a9`.
  (Branch/rehearsal/tag run ids are in docs/clarity-evidence/cc2.md.)
- **lib/time.ts is the ONE door for date/time rendering** (CC2, ruling R1, drift rule 29). CC3's
  masthead line 3 and strip render times through CC2's formatters — never a new Intl formatter. The
  `{weekday}` in "Tuesday's close" uses formatWeekdayLong/formatUtcWeekday; the `{stamp}` uses the
  12-hour clock. lib/market-hours.ts is the argued second Intl door (it decides, never renders).
- **The theme system already exists** (lib/theme.ts, the pre-paint script, the Settings three-way
  control, the THEME_COOKIE). CC3 adds a one-tap TOGGLE that writes the same cookie — it does not
  rebuild the theme system. Read lib/theme.ts and the Settings theme control before writing the button.
- **`vrt-diff.mjs` is BROKEN** (`pixelmatch` absent from node_modules — Q-LC1-1, now with proof in
  QUESTIONS). Until Bishan flips the switch, use the pngjs-only counter (PATTERNS.md, "Count VRT
  candidate pixels without pixelmatch"): write the script INSIDE app/, run under Node 24, delete after.
  The triptych `*-diff.png` images are the authoritative "what moved" — open every one.
- **The guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit
  version. `check:live`/`check:nav`/`check:lighthouse` need `set -a; source .env; set +a`; Lighthouse
  needs `CHROME_PATH`.
- **The local e2e harness (docker `msm-e2e`) works** — DB URL
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, ONE project at a time with `--workers=1 --ignore-snapshots`. **RE-SEED before the run**
  — a prior run's mbp16 thin-night test can leave the shared DB thinned (unusual-volume drops to 3),
  which reads as a broken scans page and is NOT (CLAUDE.md `e2e:` documents it). Full recipe in PROGRESS.md.
- **Open questions (QUESTIONS-FOR-BISHANT.md, none blocking):** Q-LC1-1 (vrt-diff/pixelmatch — now with
  proof), Q-CC1-1 (ticker-slug rendered proof, handed to CC4), Q-PD6-3 (watchlist reason truncation,
  CC4's — and CC4 is the phone-cuts phase, its natural home), the PD10 iOS on-glass photos (Bishan's
  device), and CLARITY Part 0 (P-1/P-2/dawn-cron/retention — defaults proceed at CC5/CC7/CC8/CC10).
- **`dummy/`** (Plan A's screenshot evidence) stays untracked/kept until CC5 (Part 4.4 hands LEAN the
  note that they may retire after CC5). Do not commit or delete it. The **UI-LIBRARY-EVALUATION trio**
  (`.md` + PDF + HTML, untracked) is a finished deliverable — leave it. **Stage by explicit path, never
  `git add -A`** (the 2026-07-12 parallel-session sweep is the scar).
