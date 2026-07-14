# PD1 — Production made current

**Tag:** `pd-1` · **Date:** 2026-07-14 (the work ran through the small hours of Tue 14 ET)
**Plan:** POLISH-AND-DEPTH-PLAN.md Part 4 (the PD1 playbook), Part 0.1 (the authorised deletion),
Part 3.6 (the six assertions).

PD1 is the phase that repairs production. PD0 built the instrument that can see it; this is the
phase that acts on what the instrument said, and then puts the instrument in the standing gate so
nobody has to notice again.

---

## 1. The verdict, before and after

`npm run check:live` against `https://mystockmarket-eight.vercel.app`.

| # | surface | expected | before (00:07 ET) | after (00:27 ET) |
|---|---|---|---|---|
| 1 | masthead · session truth | the latest closed session | ✅ 2026-07-13 | ✅ 2026-07-13 |
| 2 | macro board · presence | all five figures | ✅ mortgage · CPI · gold · rupee · mood | ✅ same |
| 3 | macro pulse · index honesty | every slot attributed | ✅ real FRED levels (S&P 7,575.39) | ✅ same |
| 4 | session calendar · hygiene | no retired providers, no rows behind the edition | ❌ **"Coinbase Cryptocurrencies"** | ✅ **clean** |
| 5 | news · press-time truth | a real session | ✅ 2026-07-13 | ✅ 2026-07-13 |
| 6 | news · byline links | real external anchors | … **PENDING → PD8** (plan 9.4) | … PENDING → PD8 |
| 7 | strip · next-edition promise | the session after this edition | ✅ Tue | ✅ Tue |

**Final: `All 6 live checks pass (1 pending a later phase).`**

**Production had self-healed on its own, exactly as plan 1.3 predicted — for the macro board.** The
board the user reported as "absent" was never broken; it was starving on a poisoned edition, and
Monday's real edition fed it. That is verified, not re-diagnosed.

**The calendar did NOT self-heal, and the plan was wrong to expect it to.** Why, exactly, is the
substance of this phase.

---

## 2. The one live defect — and why "fix the write path" was never going to be enough

Plan 1.3 #2 assumed the stale `Coinbase Cryptocurrencies` rows would be replaced by the next nightly,
because the calendar refresh "replaces the forward window on each run". That is precisely why they
survived:

> **The refresh deleted `WHERE date >= run_date`. A row whose date has fallen BEHIND the window is
> not in the window, so nothing ever touched it again.**

**FIXING A WRITE PATH DOES NOT CLEAN A TABLE.** The allowlist landed a month ago and stopped new
litter; it could not reach the litter already there, because the delete only ever looked forward.

### It was not cosmetic. It was evicting the calendar.

The Desk takes the **15 earliest** rows in date order. The four dead rows sorted **first** and spent
4 of those 15 slots:

| | before | after |
|---|---|---|
| `calendar_event` rows total | 27 | 23 |
| rows behind the edition (unreachable litter) | **4** | **0** |
| the Desk's stated horizon | **"+ 8 more · through Jul 16"** | **"+ 8 more · through Jul 22"** |

The table held real events through **Jul 23**. The reader was told the calendar ran through **Jul 16**.
**The rot truncated the horizon by six days** — the four junk rows displaced four real ones, and
nothing anywhere said so. Screenshots: `pd1/before-desk-desktop.png` vs `pd1/after-desk-desktop.png`
(module 03 — SESSION CALENDAR).

The four rows, named:

```
2026-07-11  code=null  kind=fed    "FOMC Press Release"        ← a Saturday
2026-07-11  code=null  kind=macro  "Coinbase Cryptocurrencies" ← a Saturday
2026-07-12  code=null  kind=macro  "Coinbase Cryptocurrencies" ← a Sunday
2026-07-12  code=null  kind=fed    "FOMC Press Release"        ← a Sunday
```

All four carry `code=null` — the signature of the pre-allowlist ingest. Two of them are dated on days
the market never opened.

### Two fences, because one is not enough

- **The write** (`publish._replace_calendar`): the refresh now replaces the **whole table**. The
  calendar is a forward view; the table **is** that window, and a row behind it is litter, not
  history. Deleting all of it costs nothing — no reader wants a past calendar row. (The one ledger
  that may never be rewritten is `signal_log`, and it is elsewhere, and it was not touched.)
- **The read** (`morning.loadCalendar`): the query is now floored at the **edition's session**, so a
  stranded row can never be rendered — nor evict a real one — whatever is sitting in the table. This
  is the half that holds when the pipeline has not run for a few days.

Guarded by `test_calendar_refresh_sweeps_a_row_that_has_fallen_behind_the_window`,
`test_a_degraded_ingest_still_leaves_a_stale_row_alone`, and `calendarFloor`'s three unit tests.

---

## 3. The bug the instrument had, three times over

**The most valuable thing PD1 found, and it was only findable by running the checker against a live
Desk after midnight.**

`check:live` went green on the calendar and immediately failed twice more — on a Desk that was
completely correct:

| the check | what it demanded | what production said | who was right |
|---|---|---|---|
| `strip · next-edition promise` | "Wed" — the next trading day after **today** (Tue 00:07) | "Tue" — the next edition, landing tonight | **production** |
| `session calendar · hygiene` | every row dated ≥ **today** (Tue) | Monday's edition carries Monday's own FOMC decision | **production** |

Both checks walked forward from the **wall clock**. The Desk serves a dated **edition**. Between
midnight ET and the evening run those two disagree — so both checks would have **failed a healthy
product every single night**, starting the night `check:live` joined the standing gate.

**A gate that cries wolf nightly is not a gate.** And it is the same bug as the calendar read itself:

> **IF A SURFACE IS DERIVED FROM THE EDITION, IT IS MEASURED AGAINST THE EDITION.**

Three surfaces, one disease, all three found within an hour: `loadCalendar`'s floor, the next-edition
promise, and the calendar hygiene check. All three now anchor on the edition; the two checks take **no
clock at all**. A *stale* edition is assertion 1's job, and assertion 1 does it loudly — so nothing is
lost by taking the clock out of the other two.

Also fixed in passing: the calendar check inferred a row's year from the clock, so a "Jan 2" row on a
December edition would have read as 363 days stale and **redded the gate every Christmas**.

---

## 4. Part 0.1 — the deletion Bishan authorised

**This is the user's decision, not an assumption.** Recorded in POLISH-AND-DEPTH-PLAN.md Part 0.1
("ANSWERED by the user, 2026-07-13 (at commissioning): A — delete them") and in Q-N6-1. Executed
**after** the six assertions were checked against Monday's real edition (§1), as the plan requires.

**An authorisation check ran first.** The poisoned Saturday reaches **exactly** the three authorised
tables and no others — `briefing`, `news_cluster`, `setup_card`, `vol_band` all held **0** rows for
`2026-07-11`. Nothing was deleted outside what was authorised.

| table | before | deleted | after |
|---|---|---|---|
| `scan_result` (`run_date = 2026-07-11`) | 1315 | 1315 | **0** |
| `market_context` (`run_date = 2026-07-11`) | 1 | 1 | **0** |
| `pipeline_run` (`run_date = 2026-07-11`) | 1 | 1 | **0** |
| `calendar_event` (behind the edition) | 4 | 4 | **0** |
| **`signal_log`** — **UNTOUCHABLE** | **4551** | **0** | **4551** |

`signal_log` is trigger-guarded and insert-only, deliberately absent from the authorised list, and
verified unchanged by the repair script itself (it aborts if the count moves). **Signals that fired
are a historical fact about what the app told its reader, and the ledger is the one thing in this
product that may never be rewritten.** It has no `run_date` column at all, so it was never even in
reach.

The edition on the Desk after the deletion is still **2026-07-13**, as intended.

---

## 5. The probes (plan Part 4, in order)

| probe | result |
|---|---|
| `check:migrations` | ✅ clean — the live database runs the schema in this repo |
| nightly-a, scheduled `full` | ✅ [29293284366](https://github.com/bishantt/myStockMarket/actions/runs/29293284366) — success, 11 m 42 s |
| nightly-b, scheduled | ✅ [29304173750](https://github.com/bishantt/myStockMarket/actions/runs/29304173750) — success |
| `check:live` (six assertions) | §1 above |
| Screenshots (Desk phone + 1512, `/news`) | `docs/pd-evidence/pd1/{before,after}-*.png` |
| Read-only DB inspection | §2, §4 above |

**Production screenshots are possible, and the old QUESTIONS note saying otherwise is now wrong and
closed.** The login wall opens to a minted session cookie — the same trick `check:nav` and
`check:live` use. No password needed.

---

## 6. The gate

| gate | result |
|---|---|
| `typecheck` · `lint` · `test` | ✅ **625** unit tests (617 → 625) |
| `uv run pytest` | ✅ **535** (534 passed + 1 skipped) |
| `build` + `check:routes` + `check:bundles` + `check:fonts` | ✅ worst bundle **196.3 KB** of 200 · fonts 243 KB of 560 |
| `e2e:local` | ✅ 177 passed (snapshots ignored — CI is the pixel oracle) |
| `check:drift` | ✅ **22** rules |
| `check:migrations` (once per phase, local) | ✅ clean |
| **`check:live`** (NEW to the gate, post-deploy) | ✅ **all 6 pass**, 1 pending → PD8 |
| `check:nav` (post-deploy, report mode) | ✅ every cached room 43–205 ms · `/settings` 397 ms (the known writer room) |
| `check:lighthouse` (post-deploy) | ✅ hard gates: **CLS 0.000**, first-load JS **178 KB** ≤ 200 · advisory: perf **87/86** |
| Branch run (app + pipeline) | ✅ [29305503581](https://github.com/bishantt/myStockMarket/actions/runs/29305503581) on `f81daa3` · ✅ [29306025449](https://github.com/bishantt/myStockMarket/actions/runs/29306025449) on `5f665d8` |
| **Rehearsal** — the full oracle, before the tag existed | ✅ [29305507994](https://github.com/bishantt/myStockMarket/actions/runs/29305507994) on `f81daa3` (8 m 10 s) · ✅ [29306025074](https://github.com/bishantt/myStockMarket/actions/runs/29306025074) on `5f665d8`, **all three shards** |
| **Tag run `pd-1`** | ✅ [29306378349](https://github.com/bishantt/myStockMarket/actions/runs/29306378349) on `5f665d8` — **green first try, 7 m 56 s** |

**There were TWO rehearsals, and the reason is the phase's best finding.** The first (`f81daa3`) was
green. Then the post-deploy `check:live` — the step that only exists because of PD0 — failed on a
*healthy* Desk, and the checker turned out to be reading the wall clock. The fix (`5f665d8`) was
pushed and **re-rehearsed in full before the tag existed**, and the tag went on the SHA that was
actually rehearsed. **This is the reformed exit working exactly as designed:** the old way would have
tagged `f81daa3`, discovered the checker bug on the next phase's first nightly, and had a green tag
sitting on a gate that cries wolf.

**A Lighthouse performance score of 77 appeared on the first post-deploy sample and was re-measured
rather than shrugged at: two further samples returned 87 and 86, in line with the historical
baseline.** Synthetic-4G variance, not a regression. The two hard gates never moved.

**The local Postgres was real this time.** PD0's hardest lesson — "a local green with a skip count is
not a green" — was closed rather than restated: Docker was started and the 29 Postgres-backed
pipeline tests, which normally skip on this Mac, were **actually executed locally** before the push.
The new write-fence test was watched going RED against the old code and GREEN against the new. It is
the only honest way to change a database write path.

**Seven tags, seven first-try greens on the tagged SHA.**

---

## 7. Gate size at `pd-1`

**22 drift rules · 76 VRT baselines · 22 e2e specs · 625 unit tests · 16 bundle baselines ·
14 manifest rooms · tag run 7 m 56 s.**

**Growth, booked:** **+8 unit tests** (3 for `calendarFloor`, 5 for the instrument's edition
anchoring and the year turn) · **+2 pipeline tests** (the write fence, and the degraded-ingest case
that must NOT sweep) · **+1 gate command — `check:live`, which is now live in the standing gate's
post-deploy step for every phase from here on.**

No new drift rule, no new VRT baseline, no new room: PD1 repaired data and closed two holes in code
that was already covered. The gate grew by exactly the tests that prove the fences hold.
