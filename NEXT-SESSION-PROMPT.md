# The CLARITY-AND-CADENCE commission is COMPLETE. There is no next phase.

You are picking up a repository whose current commission has finished. **Do not start a phase.** Read
this, confirm the state, and wait for Bishan to tell you what he wants next. If he has not said, ask.

## What just finished (2026-07-16)

Two plans made up the commission, and both are done and tagged:

- **CLARITY-AND-CADENCE-PLAN.md** — `cc-1` … `cc-10`. The Desk's clarity + cadence pass.
- **LEAN-CODEBASE-PLAN.md** — `lc-1` … `lc-3`. The comment/dead-code diet.

The fixed order ran to completion: CC1 → LC1 → LC2 → LC3 → CC2 → CC3 → CC4 → CC5 → CC6 → CC7 → CC8 →
CC9 → CC10. Every phase is tagged by SHA; every tag run went green.

### What shipped, phase by phase (one line each)
- **CC1** — two live defects (the swap-font flash, the empty Daily Brief) + three paper cuts.
- **LC1–LC3** — the "comments are one line of why" standard, the deletions, and comment compression across
  the 25 hottest files (−1766 comment lines).
- **CC2** — every timestamp rewritten to R1's shapes (12-hour clocks, weekday dates); Intl only in time.ts.
- **CC3** — one-truth masthead (R3), the slimmed pipeline strip, a one-tap Light↔Dark toggle everywhere.
- **CC4** — one header/meta grammar across every market room; the dead-space fixes; D10's phone cuts.
- **CC5** — the news room rebuilt TEXT-FIRST (R4); the generated image frames retired.
- **CC6** — honest relevance (R5): significance v2, the movers liquid floor, the RelVol label, calendar grammar.
- **CC7** — the control room: a table of the three schedules with a detail sheet per row.
- **CC8** — the dawn cron became the Morning Edition's engine (`dawn` mode: macro + news + calendar).
- **CC9** — the Desk greets a Morning Edition in the browser (R6): the edition-state machine, the Morning Plan.
- **CC10** — fresh in, stale out: the janitor (a retention manifest + a nightly deletion stage + the R2
  backup trim), the briefing citation snapshot (`sourcesJson`), the control-room Janitor row, the "new" tags (R8).

## Session start (the CLAUDE.md ritual, even with no phase to run)

1. `git pull` → read CLAUDE.md → this file → PROGRESS.md → LESSONS.md → diff DECISIONS.md (any non-[claude]
   line is a user veto, rank 2.5 — honor it FIRST).
2. Run both suites to confirm the tree is green:
   - app: `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" npm test` → expect **860 passed**.
   - pipeline: `env -u DATABASE_URL uv run pytest` → expect **613 passed / 48 skipped** (660/1 with a DB
     via `TEST_DATABASE_URL="postgresql://postgres:test@localhost:55434/msmtest"`).
3. Announce the checkpoint and WAIT for Bishan's direction.

## The open questions Bishan still owns (QUESTIONS-FOR-BISHANT.md, newest first)

None block anything. The ones with a real decision attached:
- **Q-CC10-2 [VETO?]** — the calendar "new" tag is DEFERRED. `calendar_event` is replace-policy with no
  first-seen column, so an honest per-row tag needs a second migration (`firstSeenAt` + preserve-on-replace)
  that Appendix B did not sanction. Clusters carry the tag; the calendar does not. A ~1-session follow-up
  if Bishan wants it.
- **Q-CC10-3 [VETO?]** — on a fresh evening MOST front-page stories wear "new" (by design, R8 — the signal
  is the tag's ABSENCE on a carried-over story). A one-line scope change if it reads as clutter (e.g. only
  the Desk module, or only the /news "This week" view).
- **Q-CC10-1 [FYI]** — watchlist_item is `forever` in the janitor manifest (user data, the record).
- **Q-CC9-1 [VETO?]** — the morning masthead's "before the open" was ruled edition-provenance so R3 holds;
  reword to avoid the word "open" if Bishan prefers.
- **Q-CC6-2 [NEEDS A DECISION]** — the pre-existing `classify_event` keyword classifier mislabels real
  headlines (a crypto PR as "macro", analyst opinions as "M&A"), so the front page can lead by a weak guess.
  It wants a dedicated classifier pass (its own small phase) or a fold into a future phase. NOT touched by any
  CC phase — it is N4's code.
- **Q-LC1-1 [VETO?]** — `app/scripts/vrt-diff.mjs` is broken (pixelmatch vanished from node_modules). Every
  VRT phase worked around it with the pngjs-only counter (PATTERNS.md). The fix is one line
  (`npm i -D pixelmatch`) or a pngjs rewrite. No CC phase left to fold it in — it now waits for a word.

## Follow-ups Bishan named, or that fell out of the build (not started)

- **P-1 (news media bucket)** and **P-2 (control-room GitHub PAT)** are still unprovisioned. Both paths are
  built and proven; they are secrets/config, not code. Provision either and the feature lights up.
- The **iOS on-glass manual checklists** (PD10 §4, and the story-sheet overscroll) are owed to Bishan's
  iPhone — built to spec, photographs pending. Not any phase's work.

## If Bishan wants to keep building

There is no queued plan. A new commission would start the way the last two did: a plan document at the repo
root, a fixed phase order, one phase per session under the CLAUDE.md contract. Until Bishan writes or names
one, do not invent phases — confirm the green tree and ask what he wants.
