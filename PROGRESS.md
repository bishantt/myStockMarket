# PROGRESS.md — resumable state

# CC9 IS DONE — tagged `cc-9` (2026-07-16). Next phase: CC10 (the LAST CC phase).

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`, COMPLETE). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 ✓ → CC7 ✓ → CC8 ✓ → CC9 ✓ → CC10**

**Checkpoint: CC9 ("The Desk greets the morning") is DONE and tagged `cc-9` by SHA on `e2a0162` (the buildSourceStatus fix rode in `78989a5`; the baselines in `e2a0162`). Nothing is
blocked. The next phase is CC10** (CLARITY-AND-CADENCE-PLAN.md — "Fresh in, stale out": the janitor + "new"
tags — the LAST CC phase), and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What CC9 did, in one paragraph

CC9 taught the Desk to greet a Morning Edition. A new edition-state machine (`app/lib/edition-state.ts`)
computes one of four states — Evening / Morning / Session / Overnight gap — IN THE BROWSER against the
reader's clock (R6, MarketStateLine's law; the server seeds the first paint). Once a dawn has really run for
today's session, before the open: the masthead greets "MORNING EDITION · {today} · before the open · market
data through {weekday}'s close · news & macro refreshed {time}" (Appendix A), module 02 becomes THE MORNING
PLAN (Overnight stories · Today's calendar bmo-first with timing in words · Where things closed, reusing the
evening's verified numbers · last evening's brief collapsed beneath), and the calendar rail flips today-first.
The masthead, module 02 and the calendar switch together on the client (`EditionStateProvider` +
`EditionSwitch`, rendering both variants server-side so TermProse stays a server render). check:live learned
the states — a morning masthead (dated today) is no longer a false "future edition" (the Q-CC5-2 fix), and
`--window=morning` asserts the Morning truths. It is presentation only (app), no migration.

## The judgment calls worth knowing (all in DECISIONS)

1. **The edition is CLIENT-computed** (R6): the server seeds `serverNow`, the client corrects on mount. Rejected
   server-side computation (a cache carries the clock it was made with — a morning cache served that evening
   would greet a gone morning).
2. **"before the open" is edition PROVENANCE, not the live market state** (Q-CC9-1): the pill stays the one live
   truth, so R3 holds. The morning R3 test strips the phrase before counting. Marked for veto.
3. **Module 02 renders both variants server-side, the browser switches** — keeps TermProse a server render; the
   evening brief renders first and keeps its glossary (confirmed unchanged in the re-shoot).
4. **The seeded Overnight is EMPTY** — /news date-range queries would pollute /news beyond CC9's VRT surface, so
   the populated Overnight is verified in production (where it renders real stories). Today's calendar (seeded
   Friday events with timing) and Where things closed render populated.
5. **Q-CC8-1 CLOSED** — the dawn control-room row now describes the full macro+news+calendar dawn (+ a real Last
   run from a seeded Friday 6:31 AM dawn).

## The gate at `cc-9` (all green on `e2a0162`)

- **App unit 852** (was 825: +8 edition-state, +4 timingLabel, +4 morning-plan calendar, +10 check:live
  morning-window, +1 buildSourceStatus dawn-skip). **Pipeline 595 passed / 40 skipped** (untouched; 634/1 DB).
- typecheck · lint · build · check:routes 14/15 · **check:bundles** (worst /news 199.6 KB of 200; "/" 188.2,
  +3.1 from the client edition machinery) · check:fonts (243 KB, 317 KB headroom) · **check:drift 29/29 (no new
  rule)** · check:migrations (production DB matches — CC9 adds NO migration).
- **e2e:local (--ignore-snapshots):** the morning masthead + R3-in-morning (both legs), the Morning Plan +
  today-first calendar, the plan's phone overflow (412 + 360); evening specs unchanged (desk, control-room,
  grid, a11y, hardening green with the new seed).
- **VRT: 103 baselines** (up 6 from 97) — 18 changed: 6 NEW morning shots (`desk-morning-{light,dark}`
  desktop+phone, `desk-morning-light` wide+mbp16) + 12 re-shot (evening desk gained Friday calendar events + the
  footer fix + the corrected source/degraded counts; settings gained the dawn row's description + a real Last
  run; desk-thin-night same calendar). Camera-noise shots (login/sheet-ticker/ticker) LEFT (antialiasing jitter, PD5).

## CI + production evidence (full in docs/clarity-evidence/cc9.md)

- **Push CI (ac256d6 = code): `29475650871` green.** Rehearsal #1 (ac256d6): `29475657978` RED on VRT (intended
  changes + a footer bug it surfaced). **Footer bug fixed → `78989a5`** (push CI `29476603404` green; Rehearsal
  #2 `29476613009` clean candidates). **Baselines committed → `e2a0162`** (push CI `29477289384` green;
  Rehearsal #3 `29477299890` GREEN, all four legs). **Tag run (cc-9 on `e2a0162`): `29477793717`.**
- **The footer bug CC9 surfaced (buildSourceStatus rendered the nested `dawn` object as a degraded provider —
  "dawn [object Object]" + inflated degraded count):** live in production since CC8, caught by the morning VRT
  shot, fixed in `78989a5`. A unit test guards it.
- **Post-deploy: check:live 7/7 (default, morning-aware) AND 8/8 (`--window=morning`) against production's REAL
  morning window** — CC8's own 12:23 AM dawn still sat on the run, so production was genuinely in the Morning
  edition at 2 AM, and the state-aware masthead check passed it (the Q-CC5-2 false red is gone, proven on real
  data). Read the prose: the production masthead matched Appendix A; the Morning Plan's Overnight was POPULATED
  ("Fewer vessels travel through Hormuz…"), Today's calendar showed real timing prose (UNH/GE "before the open",
  NFLX "after the close"), Where things closed reused S&P 7,572.40 +0.38% + VIX 16.50.
- check:nav worst warm 470ms (report mode). check:lighthouse **CLS 0.000** (the client masthead swap causes no
  layout shift), first-load JS 183 KB, a11y 100; advisory perf 76 (synthetic-4G, within 74–86).

## Open / carried forward (none blocking)

1. **Q-CC9-1 (new, [VETO?]):** "before the open" ruled edition-provenance so R3 holds; veto if you want the
   morning status reworded.
2. **Q-CC8-1 CLOSED** — the dawn sheet describes the full dawn now.
3. **Q-CC5-2 FIXED** — check:live no longer false-reds a healthy morning Desk.
4. **Q-CC6-2 STILL open (carried):** the event classifier mislabels headlines — wants a dedicated pass or a
   folded phase. NOT CC10's domain.
5. **Q-LC1-1 STILL open:** vrt-diff.mjs broken (pixelmatch absent). Worked around with the pngjs counter again.
6. **P-1 (news media bucket) + P-2 (control-room PAT) still unprovisioned** — nothing blocked.
7. **/news bundle is at 199.6 KB of the 200 KB ceiling** — CC10's "new" tags must keep their client cost near
   zero, or /news blows the ceiling.
8. **`dummy/` + the UI-LIBRARY-EVALUATION trio** — untracked audit/deliverable evidence, LEFT in place.

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1   # RE-SEED before any e2e run
npm run build                                     # REBUILD after a code change — the webServer serves .next
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots   # one project at a time
```
Guard scripts need **Node 24** — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
`check:live/nav/lighthouse` need `set -a; source .env; set +a`; Lighthouse needs
`CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`. check:migrations + check:live
are LOCAL-ONLY. **`--window=morning` is CC9's real check: run check:live against a production dawn window (a
dawn stamped for today makes production a live morning fixture until that day's nightly runs).**
To read production directly: `set -a; source .env; set +a`, then in `pipeline/`: `from config import
load_settings; import psycopg; psycopg.connect(load_settings().database_url_psycopg)`.

## The committed dev tools (LC1–LC3 + the VRT diff)

- `pipeline/scripts/comment_stats.py` · `pipeline/scripts/comment_prover.py`
- `app/scripts/vrt-diff.mjs` — **STILL BROKEN (pixelmatch absent); see Q-LC1-1.** The pngjs-only workaround
  pattern is in PATTERNS.md ("Count VRT candidate pixels without pixelmatch").
