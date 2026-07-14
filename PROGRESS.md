# PROGRESS.md — resumable state

# PD1 IS **COMPLETE** — tagged `pd-1`, CI green. **Production is repaired and now watched.**

**Checkpoint: POLISH-AND-DEPTH-PLAN.md, PD1 (Part 4 — production made current) is DONE.
Nothing is blocked. Nothing is in flight.**

**NEXT: PD2 — Brand: the identity kit** (plan Part 5).

## What PD1 did, in one paragraph

PD0 built `check:live`, the first instrument that asks whether PRODUCTION is right rather than whether
the code is. PD1 acted on what it said. The macro board had already self-healed (it was never broken —
it was starving on the poisoned Saturday edition, exactly as plan 1.3 predicted). The session
calendar had NOT, and the plan was wrong to expect it to. Both were verified against the live site,
the poisoned rows Bishan authorised were deleted, the calendar was fenced at both ends, and
`check:live` is now **in the standing gate** at the post-deploy step of every phase from here on.

## The four things that are now true (a fresh session must know these)

1. **PRODUCTION IS GREEN AND THERE IS A COMMAND THAT PROVES IT.** `npm run check:live` reports **all
   six assertions pass** (1 PENDING, owed to PD8 — the news bylines are plain text because that
   feature does not exist yet). It runs at the **post-deploy step of the standing gate** now. It needs
   `set -a; source .env; set +a` for `AUTH_COOKIE_SECRET`. **It is local-only by nature** — CI builds a
   fresh database and deployment every run, so it structurally cannot answer this (same as
   `check:migrations`).

2. **THE EDITION RULE — the most important thing PD1 learned, and it is now law.**
   > **IF A SURFACE IS DERIVED FROM THE EDITION, IT IS MEASURED AGAINST THE EDITION — never the wall
   > clock.**
   The Desk serves a dated edition, like a newspaper; Monday's paper is still Monday's paper at 1am
   Tuesday. THREE surfaces broke this rule and all three were found within an hour: the calendar's own
   read (no floor at all), the next-edition promise, and the calendar hygiene check. **Two of them were
   in the INSTRUMENT, and they would have failed a perfectly healthy Desk EVERY NIGHT** between
   midnight ET and the ~6:40pm publish — starting the night `check:live` joined the gate. Both checks
   now take **no clock at all**. The one assertion that legitimately reads the clock is the one that
   asks whether the edition itself is current, and it is loud — so everything else can trust the
   edition and stop asking what time it is.

3. **FIXING A WRITE PATH DOES NOT CLEAN A TABLE.** The `Coinbase Cryptocurrencies` rows survived a
   correct allowlist for a month because the refresh deleted `WHERE date >= run_date` — the forward
   window — and a row that has fallen BEHIND the window is not in it. **And it was not cosmetic:** the
   Desk takes the 15 earliest rows in date order, so the 4 dead rows sorted FIRST and spent 4 of the 15
   slots. The calendar said "through Jul 16"; the table held events through Jul 23. **The rot was
   evicting six days of real horizon.** Now fenced at BOTH ends — `publish._replace_calendar` replaces
   the whole table, and `loadCalendar` floors at the edition — because the two fences fail differently.

4. **PRODUCTION SCREENSHOTS ARE POSSIBLE.** The old QUESTIONS note saying otherwise is **wrong and now
   marked so**. The login wall does not need the app's password — it needs `AUTH_COOKIE_SECRET`, which
   is in the root `.env`. `check-nav.mjs` and `check-live.mjs` both mint a session cookie exactly as
   `lib/auth.createSessionToken` does. PD1's before/after shots are in `docs/pd-evidence/pd1/`.

## Production, verified 2026-07-14 00:27 ET

```
✓ masthead · session truth      2026-07-13   (Monday — correct)
✓ macro board · presence        mortgage · CPI · gold · rupee · mood  (ALL FIVE)
✓ macro pulse · index honesty   real FRED levels (S&P 7,575.39)
✓ session calendar · hygiene    clean  ← was the one live defect; repaired
✓ news · press-time truth       2026-07-13
… news · byline links           PENDING → PD8 (plan 9.4)
✓ strip · next-edition promise  Tue
All 6 live checks pass (1 pending a later phase).
```

Part 0.1 executed (Bishan's decision, logged as **user-authored** in DECISIONS.md): `scan_result`
**1315** · `market_context` **1** · `pipeline_run` **1**, all `run_date = 2026-07-11`, deleted.
**`signal_log` untouched — 4551 rows before, 4551 after.** An authorisation check ran FIRST and
confirmed the poisoned date reached exactly the three authorised tables and no others.

## The exit ritual (unchanged, and it works — SEVEN tags, SEVEN first-try greens)

Read **CLAUDE.md's "The Endgame"** block. Local gate → push → **REHEARSE** (`gh workflow run ci.yml
-f job=e2e --ref main` — the same job the tag runs, on the exact SHA you will tag) → tag **BY SHA** →
confirm → **ONE docs commit after the tag** (it is free; `paths-ignore` means prose starts no CI run).

**The post-deploy step now has four instruments:** `check:live` (must be GREEN — a PENDING owed to a
later phase is fine, a FAIL is not), `check:nav`, `check:lighthouse`, and once per phase
`check:migrations`.

**THE TRAP:** nothing in the gate reads a `paths-ignore`d path (`**/*.md`, `docs/**`, `.claude/**`),
which is the only reason the filter is safe. If you write a guard that reads a document, put its path
back in the trigger FIRST.

## Gate size at `pd-1`

**22 drift rules · 76 VRT baselines · 22 e2e specs · 625 unit tests · 16 bundle baselines ·
14 manifest rooms.** Pipeline: **535** (534 passed + 1 skipped locally with Postgres running).

**Growth, booked:** +8 unit tests (3 for `calendarFloor`; 5 for the instrument's edition anchoring and
the year-turn guard) · +2 pipeline tests (the write fence, and the degraded-ingest case that must NOT
sweep) · **+1 gate command (`check:live`, now LIVE in the standing gate)**. No new drift rule, no new
VRT baseline, no new room.

## Budgets — unchanged, and still tight

**`/news`: 196.3 KB against a 200 KB HARD ceiling. Real headroom is ≈3.7 KB**, NOT the ≈4.9 KB the
plan records. PD5's shared kit and PD9's overlay both spend from this pot; PD9's code-split is
pre-authorised. **Plan against 3.7 KB.** Fonts: 243 KB of 560.

Lighthouse: advisory perf **87** (a 77 appeared on one sample and was **re-measured**, not shrugged at
— two further samples gave 87 and 86; synthetic-4G variance). The two HARD gates pass: **CLS 0.000**
and **first-load JS 178 KB ≤ 200**.

## Known-and-fine (do not chase)

- **Node 20 shadowing.** Claude Code exports its own Node 20 into every shell it spawns; `check:fonts`
  then dies with a `globSync` export error. Not a regression. Prepend Node 24:
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`.
- **`uv run pytest` fails `test_missing_database_url_fails_loudly` if you sourced the root `.env`** —
  the test asserts a *missing* `DATABASE_URL` fails loudly. Not a regression. Run `env -u DATABASE_URL
  uv run pytest`.
- **The 29 Postgres-backed pipeline tests skip on this Mac** — but **they do not have to.** PD1 started
  Docker and ran them locally:
  `docker run -d --name msm-pd1-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=msm_test -p 55433:5432 postgres:16`
  then `TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55433/msm_test" uv run pytest`.
  **Do this whenever you touch a database write path.** PD0's first push went red in CI on a test that
  "passed" locally as a skip. A local green with a skip count is not a green.
- **`check:lighthouse` needs** `export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  and the root `.env` sourced.
- **`/settings` answers in ~400 ms, every sample a cache MISS.** Correct — the app's one *writer* room,
  `force-dynamic` by design, with an argued exemption. Every cached room answers in 43–205 ms.
- **P-2 (a GitHub PAT with `workflow` scope) is still NOT PROVISIONED**, so the control room's buttons
  are dark in production. The path is proven working end to end. It is a secret and nothing else.
- **Three untracked files** (`UI-LIBRARY-EVALUATION.md` + its PDF/HTML) are a finished research
  deliverable from an earlier session, deliberately left uncommitted. Not PD's; leave them.

## Open questions (none blocking — see QUESTIONS-FOR-BISHANT.md)

- **Q-N6-1 — CLOSED at PD1.** The Saturday rows are deleted; his decision, carried out and logged.
- **Q-PD0-1 — CLOSED at PD1.** The `Coinbase Cryptocurrencies` rows are gone and both ends are fenced.
- **[FYI] A tracked file went missing from the working tree during PD1 and was restored.**
  `Screenshot 2026-07-12 at 6.20.46 PM.png` (repo root, committed in `cb20a9f`) appeared as deleted;
  **I did not delete it and cannot account for what did.** Restored byte-for-byte from HEAD rather than
  committing the deletion. Flagged for Bishan.
- **Q-G4-1 [VETO?]** PD5's movers delta chip carries `data-p2` (hover = opacity/underline only).
  **PD5 has not started — nothing is built on it. Reversing it still costs one paragraph.**
- **Q-G3-2 [WORTH HIS EYES]** `/academy/[slug]` is neither swept nor pixel-locked. A one-line manifest
  change (`"sweeps": ["touch","scroll","axe"]`). Cheap, and worth doing early in PD.
- **Q-PD0-2 [FYI]** the 1.2 KB of bundle headroom PD0 spent, and why.
- Q-G2-1 · Q-G4-2 · Q-G3-1 · Q-G3-3 · Q-G3-4 · Q-G2-2 — all decided, no action needed.
