# PROGRESS.md — resumable state

# PD0 IS **COMPLETE** — tagged `pd-0`, CI green. The polish & depth build has begun.

**Checkpoint: POLISH-AND-DEPTH-PLAN.md, PD0 (Part 3 — session truth, the dating contract) is DONE.
Nothing is blocked. Nothing is in flight.**

**NEXT: PD1 — Production made current** (plan Part 4). It is the phase that repairs production, and
it now has a real, named defect to repair (below) plus a deletion Bishan has already authorised.

## What PD0 was for, in one paragraph

On Saturday 2026-07-11 a manually dispatched nightly asked the wall clock what day it was. The clock
said Saturday. Alpaca — correctly — returned **Friday's** bars, because Saturday has no close. The
run stamped Friday's data with Saturday's date and published. **Nothing failed. Every gate was
green.** For two days the app told its reader, in four places at once, that its data ran "through
Saturday's close" — a close that has never existed. The defect was never the arithmetic: every
formatter was correct. It is that **a non-session day was allowed to become an edition date at all**
— a wrong premise, which every number below it then reported faithfully.

## The five things that are now true (and that a fresh session must know)

1. **AN EDITION MAY ONLY CLAIM A SESSION THAT HAPPENED, and three layers enforce it.** The *gate*
   (job A refuses a day with no session — N6, verified not redone) · the *derivation* (the edition is
   the session **the bars describe**, cross-checked against the market's calendar; a disagreement
   fails the night before a row is written) · the *invariant* (`publish` refuses a non-session
   `run_date` **before touching the database**). **Modes are policy; publish is law.** There are three
   because the first one shipped, looked complete, and was not.
2. **`npm run check:live` EXISTS — the first instrument that asks whether PRODUCTION is right**, not
   whether the code is. Six checks against the deployed origin. It is **local-only by nature**: CI
   structurally cannot answer this (it builds a fresh database and deployment every run), exactly as
   with `check:migrations`. **It joins the standing gate at PD1**, not PD0 — because it is currently
   RED on a genuine production defect that PD1 repairs.
3. **THERE IS ONE NYSE CALENDAR: `app/lib/market-calendar.json`.** Three readers — the app,
   `check-live.mjs`, and `pipeline/tests/test_calendars_agree.py`, which walks **every day to 2028**
   comparing the two calendars' *answers*. A disagreement would make `check:live` red against a Desk
   that is perfectly correct.
4. **The seeded world is held to the same law as production.** `prisma/fixtures/sessions.test.ts`
   reds if any seeded `runDate`/`firedDate`/`resolvesOn` is not a trading session. Drift rule 21 made
   the seed's dates *agree*; it could not make them *lawful* — the offsets are calendar days, so
   `sessionPlus(-12)` from the anchor would land on a Saturday.
5. **CI runs the unit suite in TWO timezones** (`TZ=UTC` and `TZ=America/New_York`). Proven capable of
   failing: a tz-naive formatter reading a bare trading day passes under UTC and fails under New York.

## Production, as of 2026-07-13 23:24 ET — READ THIS BEFORE PD1

**The Desk has self-healed.** `check:live` against the live deployment reports:

```
✓ masthead · session truth      2026-07-13   (Monday — correct)
✓ macro board · presence        mortgage · CPI · gold · rupee · mood  (ALL FIVE, populated)
✓ macro pulse · index honesty   real FRED levels (S&P 7,575.39), not ETF prices under index names
✗ session calendar · hygiene    still showing "Coinbase Cryptocurrencies"
✓ news · press-time truth       2026-07-13
… news · byline links           PENDING → PD8 (plan 9.4) — publisher names are plain text today
✓ strip · next-edition promise  Tue
```

**The board the user reported as "absent" was never broken — it was starving on a poisoned edition.**
Plan 1.3's diagnosis is confirmed and its "expected self-heal" happened.

**The ONE live defect, and the plan was wrong about it.** The stale `Coinbase Cryptocurrencies`
calendar rows did **NOT** self-heal, and the reason is exact: the calendar refresh replaces the
**forward window**, and those rows have fallen **behind** it. A row behind the window is not in the
window, so nothing touches it. **Fixing the write path does not clean the table.** Two of them are
dated Jul 11 and Jul 12 — a Saturday and a Sunday. **→ PD1 cleans this.**

## PD1's job (the next session)

Plan **Part 4**, in order. It is calendar-gated by nothing — Monday's edition has already landed and
is verified above, so PD1 can run immediately.

1. `npm run check:migrations` — expect clean (it was, tonight).
2. Confirm the nightly's run green in the Actions ledger (`gh run list --workflow=nightly-a`).
3. `npm run check:live` against production — six assertions, table into the evidence file.
4. Screenshots of the Desk (phone + 1512 desktop) and `/news` into `docs/pd-evidence/pd1-production.md`.
5. **Execute Part 0.1 — the deletion Bishan ALREADY AUTHORISED** (`DELETE FROM market_context /
   scan_result / pipeline_run WHERE run_date = '2026-07-11'`). It is **his answer, not an
   assumption** — recorded in the plan at commissioning and in Q-N6-1. Record row counts before and
   after. `signal_log` is **untouchable by design** (trigger-guarded, insert-only) and is deliberately
   NOT in the list.
6. **Fix the calendar rows** (the live defect above) — the write path is already correct, so this is a
   data repair, and the fence belongs at the read/write boundary so it cannot come back.
7. Re-run `check:live`; it must be **all green**. Then wire it into the standing gate's post-deploy
   step (gate step 7) for every later phase.

## The exit ritual (unchanged, and it works — five tags, five first-try greens)

Read **CLAUDE.md's "The Endgame"** block. Local gate → push → **REHEARSE** (`gh workflow run ci.yml
-f job=e2e` — the same job the tag runs, on the exact SHA you will tag) → tag **BY SHA** → confirm →
**ONE docs commit after the tag** (it is free; `paths-ignore` means prose starts no CI run).

**THE TRAP:** nothing in the gate reads a `paths-ignore`d path (`**/*.md`, `docs/**`, `.claude/**`),
which is the only reason the filter is safe. PD0's new guards read `market-calendar.json`, `seed.mjs`
and `scripts/fixtures/live/*.txt` — **none of them ignored.** If you write a guard that reads a
document, put its path back in the trigger FIRST.

## Gate size at `pd-0`

**22 drift rules · 76 VRT baselines · 22 e2e specs · 617 unit tests · 16 bundle baselines ·
14 manifest rooms.** Pipeline: **504 local / 533 in CI** (the extra 29 are Postgres-backed and skip
on this Mac).

**Growth, booked:** +1 drift rule (22 — the weekday door) · +31 unit tests · +40 pipeline tests ·
+1 gate command (`check:live`, live from PD1).

## Budgets — one number moved, and it is tight

**`/news`: 195.1 → 196.3 KB against a 200 KB HARD ceiling that does not move.** The NYSE holiday table
now ships as JSON (one list, three readers). **Real headroom is ≈3.7 KB, NOT the ≈4.9 KB the plan
records.** PD5's shared kit and PD9's overlay both spend from this pot; PD9's code-split is already
pre-authorised. **Plan against 3.7 KB.**

Fonts: 243 KB of 560. Lighthouse: unchanged (advisory 87; the two hard gates — CLS 0.000 and
first-load JS ≤200 KB — pass).

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Claude Code exports its own Node 20 bin dir into every shell it spawns;
  `check:fonts` then dies with a `globSync` export error. Not a regression. Prepend Node 24:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`uv run pytest` fails `test_missing_database_url_fails_loudly` if you have sourced the root
  `.env`** — the test asserts a *missing* `DATABASE_URL` fails loudly, and sourcing `.env` sets one.
  Not a regression. Run it in a clean shell (`env -u DATABASE_URL uv run pytest`).
- **`check:live` needs** `set -a; source .env; set +a` (for `AUTH_COOKIE_SECRET`). It mints a session
  cookie exactly as `check-nav.mjs` does — it does not need the app's password.
- **`/settings` answers in ~400–510 ms, every sample a cache MISS.** Correct: it is the app's one
  *writer* room, `force-dynamic` by design, with an argued exemption. B2 is in report mode for it.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The path is proven working end to end. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a completed research
  deliverable from an earlier session, deliberately left uncommitted. Not PD's; leave them.

## Open questions (none blocking — see QUESTIONS-FOR-BISHANT.md)

- **Q-PD0-1 [VETO?]** the live `Coinbase Cryptocurrencies` calendar rows (PD1 cleans them).
- **Q-PD0-2 [FYI]** the 1.2 KB of bundle headroom PD0 spent, and why.
- **Q-G4-1 [VETO?]** the movers delta chip carries `data-p2` (hover is opacity/underline only).
  **PD5 has not started — nothing is built on it. Reversing it still costs one paragraph.**
- **Q-G3-2 [WORTH HIS EYES]** an Academy lesson (`/academy/[slug]`) is neither swept nor pixel-locked.
  Still a one-line manifest change, still worth doing early in PD.
- Q-G2-1, Q-G4-2, Q-G3-1/3/4, Q-G2-2 — all decided, no action needed.
