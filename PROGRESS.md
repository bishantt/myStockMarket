# PROGRESS.md — resumable state

# CC5 IS DONE — tagged `cc-5` (2026-07-15). Next phase: CC6.

**Two plans are active (2026-07-15): CLARITY-AND-CADENCE-PLAN.md (Plan A, `cc-1`…`cc-10`) and
LEAN-CODEBASE-PLAN.md (Plan B, `lc-1`…`lc-3`, COMPLETE). Fixed execution order:**

> **CC1 ✓ → LC1 ✓ → LC2 ✓ → LC3 ✓ → CC2 ✓ → CC3 ✓ → CC4 ✓ → CC5 ✓ → CC6 → CC7 → CC8 → CC9 → CC10**

**Checkpoint: CC5 ("News, text-first") is DONE and tagged `cc-5` by SHA on `5382f06`.
Nothing is blocked. Nothing is in flight. The next phase is CC6** (CLARITY-AND-CADENCE-PLAN.md —
"Honest relevance"), and NEXT-SESSION-PROMPT.md is the paste-ready prompt for it.

## What CC5 did, in one paragraph

CC5 made the news TEXT-FIRST (R4/D5). NewsImage shrank to L1/L2 (a real stored photo) or nothing — the
generated L3/L4 catalyst/publisher cards are DELETED, because with P-1 unprovisioned every card every
night was a grey L4 slab carrying the catalyst word, taller than its own headline, saying nothing the
Tag did not. The card is now its words: catalyst + sector tags · headline (a LEAD up to 3 lines, a ROW
2) · why-it-matters (the LEAD's alone) · ticker chips OR the single word "Market-wide" · a byline
(outlet · date · time · source count, the count speaking only when >1 — the standalone "1 SOURCE" row
is gone). A real photo, when one exists (seed: fed-hold/fda/amd), renders right-of-headline at 40% on a
lead, a small thumb on a row. The story sheet keeps its structure; only the placeholder block goes (the
figure renders ONLY when a real image exists), so a no-photo story falls straight from headline into
body. The full "No direct listing in our universe." sentence keeps its room on the sheet. No migration,
no pipeline change.

## The two judgment calls worth knowing (both in DECISIONS)

1. **The story-sheet image position ("below the byline") is DEFERRED, not built (Option B).** 4.4
   self-conflicts: "below the byline, never between headline and body" vs "only removes the placeholder
   block" vs "keep the excellent structure." A REAL photo between headline and body is standard news
   layout, and D5's complaint was the grey PLACEHOLDER hole, not a photo. So CC5 removed the placeholder
   (figure renders only with a real image) and left real photos where they are. The reposition is
   Q-CC5-1, for when P-1 lands and a real photo actually renders in production.
2. **The lead's photo flips to right-of-headline at 40% (was image-left at 55%).** This is the
   text-first thesis and 4.4 is explicit. It supersedes the PD8 "image-left broadsheet" justification.
   The seeded lead (fed-hold) has a real fixture photo, so this renders in VRT.

## The gate at `cc-5` (all green on `5382f06`)

- **App unit 781 (was 778; +3 `bylineSourceCount` tests). Pipeline 579 passed / 35 skipped —
  UNCHANGED (CC5 touches no pipeline code).** typecheck · lint · build · check:routes (14/15 cached) ·
  check:bundles (worst 198.8 KB < 200; /news shrank — L3/L4 deleted) · check:fonts (243 KB, 317 KB
  headroom) · **check:drift 29/29 (NO new rule — R4 deletes the L3/L4 rungs but KEEPS drift rule 20's
  NewsImage door)** · check:migrations (no migration; live DB matches repo).
- **e2e:local (--ignore-snapshots):** news.spec desktop 26 / phone 25+1 skip (the R4 height check is
  desktop-only); hardening sweep phone 30/30; all news/story/styleguide/sheet VRT surfaces render.
  Eyeballed the desktop + phone feed and the SMCI text-first story — all correct.

## VRT at `cc-5` — 24 of 97 re-shot, every diff explained

Rehearsal #1 (`7e11b56`) redded 13 shots. Per the PD5 law, EVERY candidate was diffed against its
committed baseline (pngjs counter — vrt-diff.mjs still broken, Q-LC1-1): the moved set EQUALS the
failure set (nothing snuck under the 600px tolerance), 24 baseline FILES across the four legs. All
explained + every actual/diff opened (PD3 first-baseline eyes on the new text-first lead composition):
news feed (text-first, RESIZE shorter — L4 slabs gone), news-filtered/week, news-story-dropped/sparse
(SMCI/Uber placeholder removed, ~444px shorter), sheet-story-phone + sheet-overlay-desktop (SMCI sheet,
placeholder removed), styleguide (ladder shrank to L1/L2). The ONE shot that got TALLER (news-filtered
phone, +27px) is the FDA lead headline gaining its 3rd line (clamp-2→clamp-3) — explained, not a bug.
NOTHING unexpected moved: the Desk front-page module, the image-bearing news-story room (fda keeps its
photo, Option B), login and scans are byte-identical. 24 re-shot, 0 added. 97 total.

## CI evidence (full in docs/clarity-evidence/cc5.md) — two pushes, one rehearsal each, one tag

- **Push CI (7e11b56 = code): 29457189445 green (app + pipeline). Rehearsal #1 (7e11b56): 29457195791
  RED on pixels (expected, all four legs), minted candidates.**
- **Push CI (5382f06 = 24 baselines): 29458095546 green. Rehearsal #2 (5382f06): 29458095405 GREEN,
  all four legs.**
- **Tag run (cc-5 on 5382f06): 29458574720 — four-leg oracle, green.**
- **Post-deploy: check:live 6/7 — the ONE red (strip · next-edition) is a DELAYED-NIGHTLY transient,
  NOT a CC5 defect** (see below). check:nav report mode, worst 407ms (settings writer room, no
  regression). check:lighthouse gates green (CLS 0.000/0.011, first-load JS 183 KB < 200, a11y 100);
  advisory perf 75→83 on re-sample (synthetic-4G noise, per the endgame rule), in line with cc-4.

## The check:live red — read it, it is a transient owed to CC8/CC9 (NOT a blocker, NOT CC5's)

check:live's "strip · next-edition promise" redded: the strip says "next edition Thu" while the edition
is Tuesday Jul 14 (next session is Wed). ROOT CAUSE, read not assumed: tonight's Wednesday nightly-a had
NOT fired at 44 min past its 22:37 UTC cron (last night's ran 52 min late), so production correctly
serves Tuesday's edition while the strip's WALL-CLOCK next-edition rolled to Thursday — the exact PD1
transitional window, extended by a GitHub cron delay. **CC5 touches no strip/masthead/edition/cron code**
(it changed news CARD copy), the assertion PASSED at cc-4 hours earlier, and the CC5-relevant assertion
(news byline links: 20 outbound anchors) is GREEN — proving the new byline works in production. The
next-edition/strip logic is CC8/CC9's explicit domain (R6 + the edition-state machine + check:live
`--window=morning`), so this is a red "owed to a later phase," which the Endgame permits. If you re-run
check:live after tonight's nightly lands it should go 7/7. Logged as Q-CC5-2.

## Open / carried forward (none blocking)

1. **Q-LC1-1 still open:** vrt-diff.mjs broken (`pixelmatch` absent). Worked around again with the
   pngjs-only counter (PATTERNS.md); the triptychs + the moved==failed proof are the real evidence.
   Fix is `npm i -D pixelmatch` or a pngjs rewrite — Bishan's call.
2. **Q-CC5-1 (new):** the story-sheet image position "below the byline" is deferred to P-1 (Option B —
   the placeholder is removed, real photos stay put; a reposition of an invisible-in-prod path is an
   end-of-phase over-reach). Decide the exact placement when a real photo renders.
3. **Q-CC5-2 (new):** the check:live strip transient above — a heads-up that the strip's next-edition
   follows the wall clock and rolls forward when a nightly is delayed past its cron; owed to CC8/CC9.
4. **P-1 (news media bucket) still unprovisioned** — the default (text-first, no image) is 4.4's design
   TARGET, so nothing is blocked. Provision any time and the kept L1/L2 code lights up.
5. **`dummy/` LEFT in place (not deleted) — Q-CC5-3.** Part 4.4 authorised CC5 to retire it, but it is
   UNTRACKED audit evidence (51 screenshots both plans were built from, not only news) that I did not
   create; CLAUDE.md's deletion-safety rule says surface rather than delete such files. The news
   screenshots in it are stale now, and Bishan can `rm -rf dummy/` any time. The UI-LIBRARY-EVALUATION
   trio (untracked .md + PDF + HTML) is a finished deliverable — also LEFT in place.

## The local harness (unchanged — still works; Node 24 required for the guard scripts)

```bash
docker start msm-e2e   # or it may already be up
export DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"
export DIRECT_URL="postgresql://postgres:test@localhost:55434/msmtest"
npx prisma migrate deploy && npm run db:seed && export MSM_SEEDED=1   # RE-SEED before any run
lsof -ti:3210 | xargs kill -9                     # ALWAYS, before any run
npx playwright test --project=desktop --workers=1 --ignore-snapshots   # one project at a time
```
Guard scripts need **Node 24** — prepend `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
`check:live/nav/lighthouse` need `set -a; source .env; set +a`; Lighthouse needs `CHROME_PATH`.

## The committed dev tools (LC1–LC3 + the VRT diff)

- `pipeline/scripts/comment_stats.py` · `pipeline/scripts/comment_prover.py`
- `app/scripts/vrt-diff.mjs` — **STILL BROKEN (pixelmatch absent); see Q-LC1-1.** The pngjs-only
  workaround pattern is in PATTERNS.md ("Count VRT candidate pixels without pixelmatch") — write it
  INSIDE app/, run under Node 24, delete after.
