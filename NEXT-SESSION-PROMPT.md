You are Claude Opus 4.8, sole builder of myStockMarket. Continue executing NEWS-AND-CONTROL-PLAN.md
(phases N0–N7) under its Autonomy Contract. **N0, N1, N2, N3 and N4 are DONE and tagged (nc-0 … nc-4).**

## SESSION RHYTHM — ONE PHASE PER SESSION
Do NOT run multiple phases in one session. Long single-session runs bloat the context window and
degrade the quality of the later work. Work ONE phase, then stop. (Standing rule in CLAUDE.md.)

At the end of the phase:
1. Finish it properly — tests green, the plan's standing gate passed, tagged `nc-5`, everything
   committed and pushed. Never stop mid-task or with a red build.
2. Bring EVERY intelligence file fully current: PROGRESS.md, DECISIONS.md, LESSONS.md, PATTERNS.md,
   QUESTIONS-FOR-BISHANT.md, plus the evidence table for the phase (`docs/nc-evidence/`). Write them
   as if the next session has NO memory of this one — because it won't.
3. Rewrite NEXT-SESSION-PROMPT.md at the repo root: complete, paste-ready, self-contained.
4. Report back in plain English: what you built, what passed, anything new in QUESTIONS-FOR-BISHANT.md,
   and confirm NEXT-SESSION-PROMPT.md is ready.

Then STOP and wait. Do not roll into the next phase.

Within a phase the Autonomy Contract holds in full: never ask, never wait, never end a phase with a
question. Anything that would be a question goes to QUESTIONS-FOR-BISHANT.md with the most reasonable
assumption made and clearly marked.

## START HERE, IN THIS ORDER
1. Run the CLAUDE.md session ritual: git pull → read CLAUDE.md + PROGRESS.md + LESSONS.md → diff
   DECISIONS.md for any non-[claude] line (a user veto, rank 2.5 — honor it FIRST) → run both test
   suites → announce your checkpoint.
2. **nc-4's CI is green — do not re-verify it.** Read `docs/nc-evidence/n4-newsdesk.md` once: it is the
   ground truth about what the news providers actually send, and four of the plan's assumptions about
   them were wrong.
3. **Do N4's ONE carry-over first — the LLM narration** (see below). It is small, additive, and nothing
   depends on it, but N4's scope included it and it is honest to close it before adding UI.
4. Execute **N5 — the Front Page UI** (plan Part 7.7, 7.8, 7.10's UI half, Desk module 08, the nav
   wiring per Part 0.1, the Today/Week RangeControl, copy deck additions, axe on both routes).
5. Finish N5, checkpoint it per the rhythm above, hand over NEXT-SESSION-PROMPT.md, and stop.

## N4'S CARRY-OVER — the narrative line (do this first, it is contained)
**Stage-A write-back and Stage-B-mini are the one part of N4 I did not reach.** Everything else in the
data layer is built, tested, and live in production.

- Today every cluster publishes with `why_it_matters = null`. **That is a first-class state, not a
  bug** — the schema and the card design both say "a null here prints NOTHING, never a placeholder"
  (P9). The room renders correctly without it. So this is additive, not blocking.
- What to build: plan Part 7.5 + Appendix D. Stage A (Haiku, Message Batches — the existing
  `briefing/extract.py` machinery) extended to one representative article per cluster, capped at
  `STAGE_A_CLUSTER_CAP = 60`, with the parsed extract written back to `news_item.extract` and
  `news_cluster.extract`. Stage B-mini (Sonnet, ONE sync call) writes `why_it_matters` (≤160 chars) and
  `affected_note` for the top `STAGE_B_CLUSTER_CAP = 20`. **The existing `verify.py` gate runs on every
  note regardless**; a failing note drops to null and the decision is recorded in
  `news_cluster.verification`. The facts publish; the prose is what gets dropped.
- `ANTHROPIC_API_KEY` **is already in both workflow env blocks** (P-3 was closed in N0). The Stage-A
  cap already ranks by pre-LLM salience (corroboration, then magnitude) — deliberately NOT by
  significance, because significance depends on `event_type` and for the top clusters `event_type` is
  supposed to come FROM Stage A.

## BINDING CONTEXT — DO NOT RE-DERIVE
- **Intent binds; where the plan and the tree disagree on a detail, the tree wins on the detail.** N4
  amended the plan five times, every one in an honesty rule's favour, all logged in DECISIONS.md.
  Expect to do the same.
- **`docs/nc-evidence/` is the ground truth**: `n0-audit.md`, `n2-footprint.md`, `n3-board.md`, and
  **`n4-newsdesk.md`** (what the news providers really send, the measured clustering threshold, the
  production verification).
- **The seed ALREADY contains a full news night** — `app/prisma/fixtures/news.mjs`: images, clusters,
  catalyst links. N5's UI reads it. **Check what is there before inventing shapes.**
- **N5 must USE what N4 built**, not invent parallel machinery. The pipeline publishes
  `news_cluster` (headline, eventType, sectors[], themes[], tickers[], significance, sources,
  whyItMatters?, affectedNote?, extract, verification, imageId?), `catalyst_link` (symbol, ret1,
  rvol20, hasSetupCard — all SNAPSHOTTED at publish so the feed and the story page can never disagree),
  and `news_image`.
- **Ruling C1 is the deepest guard: the Front Page is edited by evidence, never by attention.**
  Significance is a fixed formula in `newsdesk/rank.py`, weights as module constants, and a test
  enumerates its signature so no behavioral signal can be added quietly. No such signal is ingested
  anywhere in the system. The room's header sentence EXPLAINS the ordering (copy.news.ordering).

## READ Q-N4-1 BEFORE YOU WRITE THE ROOM'S HEADER COPY
The ranking signal is thinner than the plan assumed, and the room's copy must not overclaim it.
Measured on the real feed: **corroboration = 1 for 131 of 134 clusters** (three outlets, few genuine
duplicates) and **magnitude = 0 for ~130** (most stories name no listed company). That is 45% of the
formula's weight sitting nearly constant, so the order collapses onto scope + class prior and
**ten-plus stories tie at exactly 0.600**, with the lead decided by a publication-time tiebreak.

This is honest — a macro day genuinely is a wall of macro stories — and I deliberately did NOT invent a
discriminator, because a "US-market relevance" term would be the app forming an editorial opinion,
which is exactly what C1 forbids. **But `copy.news.ordering` as written in Appendix B implies a finer
ranking than the data supports.** Amend it so it is true, log the amendment, and let the page tie.

## HARD-WON HAZARDS — read these before you trust a green gate
- **OPEN THE PNG AND LOOK AT IT.** **Six** real bugs in this build have been found that way and by no
  other means — most recently N4's classifier, which buried "Strait of Hormuz closed" dead last at
  0.165 while a story about India's trade posture led the page, with every test green.
- **NEVER hand-write a fixture that looks recorded.** N3 found three fabricated FRED fixtures; N4
  retired the last one (gold). When the real gold recording finally arrived, the invention turned out to
  have been wrong about something real: it stamped a **clean midnight timestamp**, where GoldAPI stamps
  the **live quote instant**. **An invented fixture is not merely an inverted test — it is a SMOOTHED
  one.** Humans write tidy data; real data is untidy, and the untidiness is the information.
- **A fixture for a NEIGHBOURING endpoint is not evidence about this one.** The repo had a Finnhub
  fixture, so the market-news endpoint felt known. It was a different endpoint, and it behaves
  differently in the one way that mattered (no tickers, ever).
- **The test suite never runs a job module as a script.** `run_news_mode` was appended below
  `if __name__ == "__main__"`, every unit test passed, and production died with a NameError in eleven
  seconds. There is a structural guard now, but the general lesson stands.
- **CI's database is DISPOSABLE and can tell you NOTHING about production's.** `npm run
  check:migrations` is the instrument that can, and it is in the standing gate.
- **There is no local Postgres on this Mac**, and there will not be. ~22 pipeline tests SKIP locally.
- **VRT baselines are BORN IN CI**: `gh workflow run ci.yml -f job=vrt-baselines`, download the
  artifact, commit it. Never shoot a baseline on macOS. The e2e+VRT job is TAG-GATED.
- **`npm run e2e:local` runs against PRODUCTION data**, unseeded — seeded journeys skip. Run it anyway;
  never read its green as coverage of a seeded surface.
- **Every sweep must assert that it swept something.** Seven guards in this build have passed because
  the thing they measured was absent rather than correct.
- Prepend `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` to node commands.

## PROVISIONING (never block on any of these)
- **P-3 (ANTHROPIC_API_KEY into the workflow env blocks) is CLOSED** — N0 did it. Both jobs have it.
- **P-5 (GOLDAPI_KEY) is CLOSED and verified live** — `gold_usd 2026-07-13 · 4034.215 · goldapi`.
- **P-1 (R2 media bucket) is ABSENT and is N5-relevant but not blocking.** The image pipeline is built
  and tested; every run records `news-images: not_configured`. **N5 renders the designed L3/L4 fallback
  rungs, which are first-class outcomes and must be built properly anyway** (plan 7.9): a text-treatment
  card next to a photo card must read as an editorial choice, not a failure. Every item in the recorded
  feed DID carry a publisher image (160 of 160), so L1 will answer for nearly every card the moment a
  bucket exists — flipping it live is a secret plus one env var, not a code change.
- **P-2 (GitHub PAT) is N6's.**

## DONE MEANS (across all sessions)
`nc-final` tagged with green CI, every evidence table in `docs/nc-evidence/`, the N7 docs sync
executed, every [VETO?] carrying its assumption marker, and a closing PROGRESS.md entry written for
the user to read.

Begin: run the session ritual, close N4's narration carry-over, then execute N5 and stop.
