# Your session: CC5 — News, text-first. CC5 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1, LC1, LC2, LC3, CC2, CC3 and CC4 are DONE and
tagged (`cc-1`, `lc-1`, `lc-2`, `lc-3`, `cc-2`, `cc-3`, `cc-4`). LEAN-CODEBASE (Plan B) is COMPLETE.**
Two plans sit at the repo root: **CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and
**LEAN-CODEBASE-PLAN.md** (Plan B, done). The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

You run **CC5 of CLARITY-AND-CADENCE-PLAN.md and nothing else** — one phase per session is standing
law (CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked. **After CC5 the order continues at CC6.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, and the phase evidence file — CC evidence goes under
   `docs/clarity-evidence/cc5.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, **CC6** of CLARITY-AND-CADENCE-PLAN.md) — carrying
   this handoff rule forward verbatim in spirit, the phase-order line, the phase's build list distilled
   from its plan, its gate, and anything in flight. Assume the next session has NO memory of yours.
   (Read CLARITY-AND-CADENCE-PLAN.md's CC6 section — Part 4.5 + the Part 5 CC6 line + Appendix E — to distill it.)
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into CC6.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to **Q-LC1-1**
   (vrt-diff.mjs is BROKEN — `pixelmatch` absent from node_modules; the fix is `npm i -D pixelmatch`
   or a pngjs-only rewrite — pattern in PATTERNS.md). If Bishan has NOT spoken and CC5's VRT re-shoot
   needs a candidate diff, use the pngjs-only counter from PATTERNS.md; the triptych `*-diff.png`
   images are the real proof regardless. Also check **CLARITY Part 0** — **P-1 (the media bucket) is
   CC5's own decision point**: the news image ladder's L1/L2 rungs only ever render if P-1 is
   provisioned. If Bishan has NOT provisioned P-1, the default proceeds (text-first, no image case —
   which is 4.4's explicit design TARGET anyway, so nothing is blocked).
2. Read CLARITY-AND-CADENCE-PLAN.md before touching anything — especially **Part 4.4** (the CC5 spec:
   the lead/row/sheet anatomy, R4's frame deletion, the "Market-wide" word, the byline source count),
   **D5** in Part 2 (the placeholder-as-a-hole diagnosis), **R4** in Part 3 (the ruling + its guard),
   the **Part 5 CC5 line**, and **Appendix C** (the CC5 VRT delta — news room, desk front-page module,
   story sheets).
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 778 · pipeline 579 passed / 35 skipped** (unchanged since cc-4).

## CC5's build list (Part 4.4 + the Part 5 CC5 line are authoritative; this is the distillation)

CC5 makes the news TEXT-FIRST — the placeholder ladder (D5) is a designed rung rendering as a hole,
so every card every night is a grey L4 catalyst slab taller than its headline. Build 4.4 exactly:

- **Delete the L4/L3 frames (R4).** NewsImage shrinks to the L1/L2 rungs only (a real stored image,
  which needs P-1 — absent today, so the default is the no-image case, which is the design target).
  L3/L4 code is DELETED, not latched (LEAN would flag it as dead). Keep NewsImage's one-door status +
  its drift rule (rule 20).
- **The text-first anatomy** (no image case — the default):
  - lead card: [CATALYST TAG] [SECTOR TAG] · headline serif up to 3 lines (was clamp-2) · why-it-matters
    serif italic when present · the affected-ticker DeltaChips · a rule · byline "Reuters · Tue, Jul 14 ·
    9:01 PM ET · 3 sources".
  - row card: [CATALYST] [SECTOR] · headline serif 2 lines · chips / market-wide word · byline.
  - When a real image DOES exist (L1/L2, only if P-1 lands): lead renders it right-of-headline at 40%
    width, rows a small thumb, the story sheet BELOW the byline (never between headline and body).
- **"No direct listing in our universe."** leaves the LIST cards; a macro story's ticker row prints the
  single word **"Market-wide"** in the mono meta voice (copy.ts). The full sentence SURVIVES on the
  story sheet where there is room to mean it (amends C9's card-level application, keeps its intent).
- **Source count** moves into the byline and speaks only when it outranks the default: one source →
  say nothing ("Reuters · Tue, Jul 14 · 9:01 PM ET"); >1 → "… · **3 sources**" (corroboration is the
  news). The standalone mono-caps sourcesLine row DIES. (copy: `copy.news`? — check; the plan names
  the byline shape.)
- **The story sheet** keeps its excellent structure (What happened / Why it matters / Context tonight /
  By the numbers / Affected tickers / On the calendar / Sources / provenance footer) — CC5 only REMOVES
  the placeholder block and applies CC2's date shapes (`formatEtStamp` etc.). Do not redesign it.
- **The desk front-page module and the news room share ONE card component** as today; the desk module's
  "FIRST 3 OF 190 BY SIGNIFICANCE" honesty label STAYS (it is R5's ordering label).
- **R4's e2e guard:** news e2e asserts `data-testid="news-image-generated"` appears NOWHERE, and asserts
  the lead card's HEADLINE is the tallest element when no image exists.
- **Amend UI-REDESIGN-PLAN §7.7/7.9 + C9** with dated correction blocks (the "every card ships a visual"
  rule is repealed by the finding — a weeks-of-L4 visual is an eye-magnet that says nothing).

## CC5's gate (the Endgame, CLAUDE.md) — a FULL FOUR-LEG REHEARSAL

1. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift` — **30 rules at cc-4**; if CC5 deletes
   the generated-image code, mind drift rule 20's NewsImage door still exists for L1/L2 — do NOT remove
   the door, only the L3/L4 rungs). Guard scripts need Node 24 — prepend
   `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. `check:migrations` once-per-phase; CC5 adds no
   migration.
2. Push to main → confirm the branch CI green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag (the four-leg oracle).
   **VRT: news room + desk front-page module + story sheets move (Appendix C).** The text-first LEAD is
   a NEW composition — the PD3 first-baseline-eyes law applies (open every candidate, confirm the diff
   is the frame deletion + text-first anatomy and nothing else). Read `.claude/skills/vrt-update/SKILL.md`
   first. Batch every red leg's fixes into ONE re-shoot (standing rule). In parallel: wait for the
   Vercel deploy, then `check:live` (must be GREEN), `check:nav`, `check:lighthouse`.
   **check:live watch:** CC5 changes the news byline copy. `scripts/live-truth.mjs` reads the strip and
   masthead, NOT the news cards — so a news-copy change should NOT ripple into check:live. But GREP
   `scripts/live-truth.mjs` before the deploy anyway (CC3's lesson: any reader-facing copy the guard
   reads is a trap) — confirm no news phrase is asserted.
4. Rehearsal green → tag `cc-5` **by SHA** → push → confirm the tag run.
5. ONE docs commit after (evidence `docs/clarity-evidence/cc5.md`; intelligence files; this file
   rewritten for CC6). Every evidence file ends with the gate-size line. Then report and STOP.

## Scope discipline

CC5 is the news text-first rebuild + R4. Do NOT touch relevance/significance/movers-floor (CC6 — the
front page ORDER and the movers floor are CC6's), the control room table (CC7), or the grid columns.
If a text-first change tempts an adjacent significance fix, log it — CC6 owns ordering.

## Carry-forward notes (do not lose these)

- **`cc-4` state:** app **778** unit · pipeline **579** passed / 35 skipped · **97 VRT baselines** ·
  **29 drift rules** (no new rule in CC4 — the chip-scroll fade is a CSS class, not a guard) · **27 e2e specs** · 14 rooms · 4 oracle legs · **16 bundle baselines**. Tag `cc-4` on `16422d0`. (Run ids in
  docs/clarity-evidence/cc4.md.)
- **The settings-watchlist e2e is FIXED, not just documented (cc-4's last commit `16422d0`):** it added
  a row and cleaned up through a flaky UI remove, which — when it flaked in CI — left the row in the
  leg's shared DB and POISONED the settings/desk VRT (both render the watchlist), redding cc-4's tag run
  twice. It now has a guaranteed afterEach DB cleanup + a documented 20s reflection timeout. So the
  "green in isolation" note below is history: the gate is reliable now. If a settings/desk VRT ever reds
  on a RESIZE to ~1762px again, it is a leftover watchlist row — check the DB, do not re-baseline.
- **The CC4 as-of treatment is LIVE but dormant:** every Desk module gets `editionAsOf`; today all
  stamps match → muted; CC9's morning edition makes some differ → ink-2. SectionMasthead compares the
  rendered minute (`formatEtClock`). The plan said "faint on a match" — it is MUTED (drift rule 18 +
  axe forbid faint on a timestamp; the differ-outranks-match hierarchy is preserved). Do not "fix" it
  back to faint.
- **lib/time.ts is the ONE door for date/time rendering** (CC2, drift rule 29). CC5's byline renders
  times through CC2's formatters (`formatEtStamp` / `formatEtDate` / `formatEtClock`) — never a new
  Intl formatter. Weekday words go through formatUtc/formatEtDate (drift rule 22).
- **`vrt-diff.mjs` is BROKEN** (`pixelmatch` absent — Q-LC1-1, unanswered through CC4). Use the
  pngjs-only counter (PATTERNS.md, "Count VRT candidate pixels without pixelmatch"): write it INSIDE
  app/, run under Node 24, delete after. The triptych `*-diff.png` images are the authoritative "what
  moved" — open every one.
- **The guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit
  version (`v24.18.0`; the glob `v24*` breaks). `check:live`/`check:nav`/`check:lighthouse` need
  `set -a; source .env; set +a`; Lighthouse needs `CHROME_PATH`.
- **The local e2e harness (docker `msm-e2e`) works** — DB URL
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, ONE project at a time with `--workers=1 --ignore-snapshots`. **RE-SEED before the run.**
  **The settings-watchlist add/focus/remove journey WAS a flaky poison (fixed at cc-4, `16422d0`)** —
  it now has a guaranteed afterEach DB cleanup + a 20s reflection timeout, so it no longer reds under
  full-suite runs or poisons the settings/desk VRT. If it or a settings/desk VRT ever reds, read the
  failure (a ~1762px settings resize = a leftover watchlist row) — do not reflexively rerun.
- **Open questions (QUESTIONS-FOR-BISHANT.md, none blocking):** Q-LC1-1 (vrt-diff/pixelmatch);
  **Q-CC1-1 got its picture at CC4** — the ticker-slug rendered proof was handed to CC4, but CC4 renders
  scan LABELS in the Sectors & Scans module, not the raw signal slug (that leak is on ACTIVE
  scan-fired signals the seed does not model); it remains a unit-proven fix, and CC6's calendar/movers
  work is the next natural place if a picture is still wanted [confirm what you decided]. Q-PD6-3
  CLOSED at CC4 (watchlist reason clamps + `title`). PD10 iOS on-glass photos (Bishan's device).
  CLARITY Part 0: **P-1 is CC5's** (news imagery — default proceeds text-first), P-2/dawn-cron/retention
  land at CC7/CC8/CC10.
- **`dummy/`** (Plan A's screenshot evidence) — Part 4.4 hands LEAN the note that they MAY RETIRE AFTER
  CC5. CC5 is the phase that may retire them: once the news room is rebuilt, the dummy screenshots of
  the old news placeholder are stale. Decide with eyes whether to delete `dummy/` at the CC5 docs commit
  (or leave for LEAN). The **UI-LIBRARY-EVALUATION trio** (`.md` + PDF + HTML, untracked) is a finished
  deliverable — leave it. **Stage by explicit path, never `git add -A`** (the 2026-07-12 scar).
