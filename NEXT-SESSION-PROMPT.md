# Your session: CC4 — One hierarchy grammar. CC4 ONLY.

The two-plan commission (2026-07-15) is under way. **CC1, LC1, LC2, LC3, CC2 and CC3 are DONE and
tagged (`cc-1`, `lc-1`, `lc-2`, `lc-3`, `cc-2`, `cc-3`). LEAN-CODEBASE (Plan B) is COMPLETE.** Two
plans sit at the repo root: **CLARITY-AND-CADENCE-PLAN.md** (Plan A, `cc-1`…`cc-10`) and
**LEAN-CODEBASE-PLAN.md** (Plan B, done). The decided execution order, fixed across both plans:

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 → CC5 → CC6 → CC7 → CC8 → CC9 → CC10**

You run **CC4 of CLARITY-AND-CADENCE-PLAN.md and nothing else** — one phase per session is standing
law (CLAUDE.md, Session rhythm). Within the phase the Autonomy Contract holds in full: never ask, never
wait; anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and marked. **After CC4 the order continues at CC5.**

## The standing handoff rule (this is how Bishan steers, phase by phase)

At the END of your phase, after the tag is green:
1. Bring every intelligence file current (PROGRESS.md exact checkpoint, DECISIONS.md, LESSONS.md,
   PATTERNS.md, QUESTIONS-FOR-BISHANT.md, and the phase evidence file — CC evidence goes under
   `docs/clarity-evidence/cc4.md`).
2. **Rewrite THIS file** (NEXT-SESSION-PROMPT.md) as the complete, self-contained, paste-ready prompt
   for the NEXT phase in the order above (for you, that is **CC5** of CLARITY-AND-CADENCE-PLAN.md) —
   carrying this handoff rule forward verbatim in spirit, the phase-order line, the phase's build list
   distilled from its plan, its gate, and anything in flight. Assume the next session has NO memory of
   yours. (Read CLARITY-AND-CADENCE-PLAN.md's CC5 section — Part 4.4 + the Part 5 CC5 line — to distill it.)
3. Report back to Bishan in plain English: what was built, what passed (cite the tag and run id), what
   changed in QUESTIONS, and confirm this file is ready. **Then STOP and wait.** Do not roll into CC5.

## Session start (the CLAUDE.md ritual)

1. `git pull` → read CLAUDE.md → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude] line
   is a user veto, rank 2.5 — honor it FIRST). Check specifically for any answer/veto to **Q-LC1-1**
   (vrt-diff.mjs is BROKEN — `pixelmatch` absent from node_modules; the two-line fix is
   `npm i -D pixelmatch`, or rewrite onto pngjs alone — pattern in PATTERNS.md). If Bishan has NOT
   spoken and CC4's VRT re-shoot needs a candidate diff, use the pngjs-only counter from PATTERNS.md;
   the triptych diff images are the real proof regardless. Also check for any word on **CLARITY Part 0**
   (P-1/P-2/dawn-cron/retention — those land at CC5/CC7/CC8/CC10, not CC4).
2. Read CLARITY-AND-CADENCE-PLAN.md before touching anything — especially **Part 4.3** (the CC4 spec:
   the grammar table + the concrete room fixes + D10's phone cuts), **D4** in Part 2 (the diagnosis
   the grammar answers), the **Part 5 CC4 line**, and **Appendix C** (the CC4 VRT delta — headers/meta
   everywhere, Paper, Track, Scans card, Academy measure).
3. Run both suites (app: `npm test` · pipeline: `env -u DATABASE_URL uv run pytest`) and announce the
   checkpoint. Expect **app 768 · pipeline 579 passed / 35 skipped** (unchanged since cc-3).

## CC4's build list (Part 4.3 + the Part 5 CC4 line are authoritative; this is the distillation)

CC4 is ONE hierarchy grammar applied to every room (D4) — the widest VISUAL phase. Build 4.3 exactly:

- **The grammar table, room by room:**
  - Room title: Playfair 700, Title case, `text-display` — every room, including Paper ("Paper desk")
    and Settings ("Settings").
  - Room dek (the one-paragraph explainer): Newsreader, Sentence case, `text-prose` ink-2 — already
    right in Scans/Track; adopt everywhere.
  - Section header (within a room): JetBrains Mono 600, UPPER tracked, `text-xs` (up from 2xs), ink-2
    (up from muted). Desk keeps its `01 —` numbering; Settings/Paper/Track adopt the same face WITHOUT
    numbers.
  - Card title: Playfair 700, Title case, `text-title` (19px floor).
  - The one hero figure per card: JetBrains Mono, `text-num-lg` — unchanged (law).
  - Meta / as-of / provenance: JetBrains Mono 400 UPPER `text-2xs` muted — BUT the as-of moves into the
    section-header row's RIGHT slot and renders `text-faint` when it EQUALS the masthead's updated
    stamp, `ink-2` when it DIFFERS (the one moment it is information; the morning edition at CC9 makes
    differing stamps real), NEVER `text-alert`.
  - Empty states: the em-dash line, unchanged (EmptyModule; no skeletons).
- **Concrete room fixes riding this phase:**
  - Paper title → serif; "YOUR FORECASTS"/"WATCHLIST"/"THEME"/"PIPELINE" adopt section grammar.
  - Sectors & Scans card becomes a REAL module — one hairline row per preset (name serif-italic, grade
    chip, match count mono, → link) so its height is earned (D4's dead space).
  - Paper's two columns rebalance: Cost Mirror + Sizing Helper stack RIGHT, ledger main-left, the form
    becomes a compact ticket card (~420px max-width).
  - Track record's empty page gains its two informative lines ("576 signals logged · first resolutions
    due Mon, Jul 28" — REAL numbers from signal_log) — an empty state that teaches the mechanism.
  - Academy lesson column centers (`mx-auto` measure) on wide screens.
- **D10's phone cuts:** tape row grammar unified (all three rows label-left figure-right); the noise
  line printed ONCE per movers card ("No news found on any of these — most moves this size are noise."
  when ALL rows lack catalysts; per-row lines return only for the mixed case); "This week" chip
  `whitespace-nowrap`; chip-row scroll tracks styled away (`scrollbar-width: none` + fade mask);
  watchlist reason clamps at one line with a `title` attribute (this is **Q-PD6-3's** home).
- **The as-of differs-vs-matches treatment** (see the meta row above). Its e2e guard proves the two
  renderings differ.

## CC4's gate (the Endgame, CLAUDE.md) — a FULL FOUR-LEG REHEARSAL, and budget TWO round-trips

CC4 restyles headers and meta in EVERY room — the widest visual phase in the plan. The plan says
budget TWO rehearsal round-trips and BATCH every red leg's fixes into ONE re-shoot (the standing rule).
1. Local gate (`typecheck && lint && test` · `uv run pytest` · `build` + `check:routes` +
   `check:bundles` + `check:fonts` · `e2e:local` · `check:drift` — 29 rules; if you add one, BOOK it).
   Guard scripts need Node 24 — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (name the
   version; the glob `v24*` breaks). `check:migrations` once-per-phase; CC4 adds no migration.
2. Push to main → confirm the branch CI green.
3. **REHEARSE:** `gh workflow run ci.yml -f job=e2e` on the exact SHA you will tag (the four-leg
   oracle). **VRT: headers/meta everywhere + Paper + Track + Scans card + Academy measure move.** When
   legs red on pixels, download the candidates for EVERY red leg, OPEN EVERY IMAGE, confirm the diff is
   the grammar/room-fixes and NOTHING else (the Scans card and Track empty are NEW compositions — the
   PD3 first-baseline-eyes law applies). Read `.claude/skills/vrt-update/SKILL.md` first. Fix all reds,
   re-shoot ONCE. In parallel: wait for the Vercel deploy, then `check:live` (must be GREEN), `check:nav`,
   `check:lighthouse`.
4. Rehearsal green → tag `cc-4` **by SHA** (never HEAD — the nightly heartbeat can move main) → push →
   confirm the tag run.
5. ONE docs commit after (evidence `docs/clarity-evidence/cc4.md`; intelligence files; this file
   rewritten for CC5). Every evidence file ends with the gate-size line. Then report and STOP.

## Scope discipline

CC4 is the hierarchy grammar + the concrete room fixes + D10's phone cuts. Do NOT touch news (CC5),
relevance/significance (CC6), or the grid columns. If a grammar change tempts an adjacent fix, log it.

## Carry-forward notes (do not lose these)

- **`cc-3` state:** app **768** unit · pipeline **579** passed / 35 skipped · **97 VRT baselines** ·
  **29 drift rules** (no new rule in CC3) · **27 e2e specs** (masthead.spec.ts added) · 14 rooms · 4
  oracle legs · **16 bundle baselines**. Tag `cc-3` on `299ab90`. (Run ids in docs/clarity-evidence/cc3.md.)
- **lib/time.ts is the ONE door for date/time rendering** (CC2, R1, drift rule 29). CC4's meta/as-of
  row renders times through CC2's formatters — never a new Intl formatter. Weekday words go through
  formatWeekdayLong/formatUtcWeekday (drift rule 22).
- **CC3 built the toggle + the masthead line 3 + the slim strip.** The masthead's `updatedAt` stamp is
  what the as-of "matches vs differs" treatment compares against (4.3's meta row). The toggle is
  `components/ThemeToggleButton.tsx`; the pill is `components/desk/MarketState.tsx` (single truth).
- **`vrt-diff.mjs` is BROKEN** (`pixelmatch` absent — Q-LC1-1). Use the pngjs-only counter (PATTERNS.md,
  "Count VRT candidate pixels without pixelmatch"): write it INSIDE app/, run under Node 24, delete
  after. The triptych `*-diff.png` images are the authoritative "what moved" — open every one.
- **The guard scripts need Node 24** (Claude Code runs Node 20 and shadows nvm). Prepend the explicit
  version. `check:live`/`check:nav`/`check:lighthouse` need `set -a; source .env; set +a`; Lighthouse
  needs `CHROME_PATH`.
- **The local e2e harness (docker `msm-e2e`) works** — DB URL
  `postgresql://postgres:test@localhost:55434/msmtest` (both DATABASE_URL and DIRECT_URL), then
  `npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1`, `lsof -ti:3210 | xargs kill -9`
  before any run, ONE project at a time with `--workers=1 --ignore-snapshots`. **RE-SEED before the run**
  (a prior run's mbp16 thin-night can leave the DB thinned — reads as a broken scans page and is NOT).
- **Open questions (QUESTIONS-FOR-BISHANT.md, none blocking):** Q-LC1-1 (vrt-diff/pixelmatch), Q-CC1-1
  (ticker-slug rendered proof — CC4 renders ticker chips in the news/movers grammar, a natural place to
  prove it), Q-PD6-3 (watchlist reason truncation — **CC4's, and this IS the phone-cuts phase, its
  home**), the PD10 iOS on-glass photos (Bishan's device), CLARITY Part 0 (defaults proceed at
  CC5/CC7/CC8/CC10).
- **`dummy/`** (Plan A's screenshot evidence) stays untracked/kept until CC5 (Part 4.4 hands LEAN the
  note that they may retire after CC5). Do not commit or delete it. The **UI-LIBRARY-EVALUATION trio**
  (`.md` + PDF + HTML, untracked) is a finished deliverable — leave it. **Stage by explicit path, never
  `git add -A`** (the 2026-07-12 parallel-session sweep is the scar).
