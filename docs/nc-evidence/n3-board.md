# N3 evidence — the macro board

*What was verified, measured, and found. Written for someone with no memory of the session.*

---

## 1. The four sources, verified live (not from memory)

Every endpoint in this phase was fetched before a line of adapter code was written. Two of them
answered from this laptop (no key required); FRED's answered from GitHub Actions, where its key
lives; gold's answered with a rejection, which is itself the finding.

| Source | Verified | What came back |
|---|---|---|
| **Nepal Rastra Bank** (`nrb.org.np/api/forex/v1/rates`) | live, 2026-07-13 | Works, no key. USD unit=1, buy/sell as **strings**. Weekend rows repeat the preceding fix, as documented. |
| **open.er-api.com** (`/v6/latest/USD`) | live, 2026-07-13 | Works, no key. Carries its own `time_last_update_utc`, which is what dates the cell. |
| **FRED** (7 series + 3 histories) | recorded in CI, 2026-07-13 | All live. See the table below. |
| **GoldAPI** (`goldapi.io/api/XAU/USD`) | live, 2026-07-13 | **HTTP 403 `{"error": "No API Key provided"}`** — the route is real, the key is absent (P-5). |

### What the real FRED responses said

| Series | Newest observation | Value | Note |
|---|---|---|---|
| `MORTGAGE30US` | 2026-07-09 (**a Thursday**) | 6.49% | Weekly, exactly as Freddie Mac publishes. |
| `CPIAUCNS` (`units=pc1`) | 2026-05-01 | 4.24867% | **May's print, not June's** — June's lands Jul 14. Rung 2 in the wild. |
| `BAMLH0A0HYM2` | 2026-07-09 | 2.70 | **Live.** The plan flagged it for re-verification: FRED's 2022 purge took the ICE *Benchmark Administration* series, not the ICE BofA index family. 795 observations deep. |
| `SP500` / `VIXCLS` / `BAMLH0A0HYM2` histories | — | 575 / 593 / 595 usable observations | Enough for the gauge's 252-session percentiles, with room. |

**The CPI row is the whole cadence argument in one line.** On 13 July the newest inflation figure in
existence is May's. A board that stamped it with tonight's date would be claiming a freshness the
source does not offer; a board that called it "stale" would be crying wolf about the most normal
thing CPI does. It is neither. It says **"May 2026"**, and that label is the honesty.

---

## 2. Three fabricated FRED fixtures, found and replaced

`sp500.json`, `nasdaqcom.json` and `djia.json` were **not recordings**. R0 (commit `4a1c736`) wrote
them by hand in the shape of a real FRED response and filled in plausible numbers. Two tells:

- the committed `sp500.json` claims `"count": 8000`; the real series has **2610** observations
- its value was **6812.34**; the real S&P on that date was **7575.39**

For three phases, every index-level test proved that the parser agreed with an invention. It hid no
behavioural bug — the parser works on the real data too — but it had already **erased a real property
of the data**: the index series post a day AHEAD of the VIX (S&P's newest observation is Jul 10, the
VIX's is Jul 9). The fabricated fixtures gave them the same date, which is simply not true.

All three are now real recordings. `tests/test_fred.py` argues with FRED again.

**The rule this produced:** a fixture that was not recorded must say so **in its own filename**. Gold's
key does not exist, so its success fixture is `xau_usd_UNVERIFIED.json`, and the only real gold
recording in the repo is `error_403.json`. A fabricated fixture that looks recorded is worse than no
fixture at all, because it also hands you a green tick.

---

## 3. The Mood gauge, computed

Five components, each scored as a percentile of its **own** trailing 252 sessions, all oriented so
that higher means greedier — which is what makes an unweighted mean of them defensible at all. Two
run backwards in nature (a high VIX and a wide credit spread are both FEAR) and are inverted on the
way in.

| Component | Source | Inverted? |
|---|---|---|
| Breadth | our own universe: share above the 50-day average | no |
| Volatility | `VIXCLS` | **yes** |
| Momentum | `SP500` vs its own 125-session mean | no |
| Range position | our own universe: share near 252-day highs minus share near lows | no |
| Credit spreads | `BAMLH0A0HYM2` | **yes** |

- Score = the unweighted mean × 100. A weight is an opinion, and an opinion is the thing this number
  is trying not to have.
- **Under three components, there is no score.** The board names the missing instruments instead. A
  market mood computed from two inputs is those two inputs wearing a costume.
- **The arrow is derived, never stored.** Each component shows which way it pulls the gauge, read off
  its percentile. The N0 seed had already drifted: momentum sat at the **48th percentile** — below its
  own median — carrying the arrow **"greedy"**. Nothing broke. Nothing was checking. A fixture test
  now holds the seed to the same rule.
- **The gauge is computed by the FULL nightly and by nothing else.** Two of its components can only be
  measured by a run that ingested the market, and the 6am macro refresh does not. A run that did not
  look at the market does not get to say how the market feels.

---

## 4. The degradation ladder, as it actually renders

| Rung | State | What the reader sees | Loud? |
|---|---|---|---|
| 1–2 | current for its own cadence | the number, and its own window label | quiet |
| 3 | source unreachable tonight | the stored number + "source unreachable tonight" | quiet |
| 4 | never reported | an em-dash + "not yet reported" | quiet |
| 5 | older than three cadences | the number + **amber** + the word **"stale — last Jul 2"** | **loud** |

Only rung 5 spends the app's alert voice, and that restraint is the point: an app that shouts about an
unprovisioned API key has nothing left to say on the night its numbers are actually wrong. Amber is a
sanctioned addition to drift rule 5's consumer list, argued and logged.

**Age is counted on each source's own clock.** This is not a detail:

| Cell | Unit | Why |
|---|---|---|
| gold, mood | **sessions** | The gold market is shut at the weekend. Friday's price read on Monday is 3 calendar days old and **zero sessions** old — there is no newer price to have. Counting days would paint it amber every Monday, and a lamp that cries wolf every Monday is not there on the morning it is telling the truth. |
| the rupee | **calendar days** | NRB publishes every calendar day, weekends included. Here a weekend genuinely IS three missed publications. |
| mortgage | 21 days | a weekly survey, three cadences |
| CPI | 93 days | monthly, and routinely six weeks old while perfectly healthy |

---

## 5. Gold's honest state in production, today

**The gold cell renders "not yet reported" (rung 4).** P-5 has not been provisioned, so there is no
source, so there is no number — and the board says so rather than printing a figure nobody checked.
The seeded database carries a deliberately week-old gold row instead, which is what drives the amber
specimen in the styleguide and the VRT.

When the key lands: add `GOLDAPI_KEY` to the GitHub secrets, re-run `scripts/record_goldapi.py` with
it, commit the real `xau_usd.json`, delete `xau_usd_UNVERIFIED.json` and the test that reads it. The
cell goes live with no other change.

---

## 6. What the board costs, measured

The board adds five figures the Desk did not have, and it is not free. The honest number, from the
VRT baselines (full-page, seeded):

| | Before N3 | After | Cost |
|---|---|---|---|
| Desk, phone (412px) | 4,183px | **4,723px** | +540px |
| Desk, desktop (1366px) | 2,623px | **3,013px** | +390px |

Roughly: the four-stat shelf ~190px, the gauge ~230px, borders and gaps the rest. Nothing here is
padding — the first attempt was, and that is the bug in §7 below.

**Why the gauge is not folded away to save the height.** Its two sentences — "computed by this app …
not CNN's index" and "context, not a signal" — are what make a home-built sentiment number legitimate
to print at all (C8). A gauge whose ownership line is behind a tap is a gauge most readers will never
see the ownership line of. The breakdown folds; the claim does not.

---

## 7. The bug the photograph found (and the tests did not)

The gauge shipped as the fifth card on the phone's money shelf. **A shelf stretches every card to the
height of its tallest**, and the gauge — a score, a position strip, two unfoldable sentences and a
disclosure — is about three times the height of "6.72% · wk of Jul 9". So the four stat cards were each
padded with ~200px of white space, and the phone Desk grew 347px in order to show four short facts and
a great deal of nothing.

Every test passed. The DOM was correct. The numbers were right. **Only the picture showed it.**

The category error underneath: F5's own triage says GLANCE stations get bounded and READ stations stay
vertical. The four stats are glances. The gauge is something you read. It was never shelf material.

The same photograph showed a second defect: **a falling mortgage rate rendered in red**, with a down
triangle and a red wash, because every delta in this app is coloured by direction. On a tape, red-down
is a fact with no opinion in it. On the price of housing money it is an opinion, and the wrong one — a
falling mortgage rate is the best news on this board. Household-cost deltas render in ink now. Gold
keeps its direction colour, because gold IS a market price.

Both are now held by tests. This is the **fifth** real bug in this build found by opening a PNG and
looking at it, and by no other means.

**One more thing the re-baseline taught us:** of the 14 PNGs git reported as modified, **five were
pixel-identical** (ticker, track-record) and differed only in PNG encoding. A byte-changed baseline is
not necessarily a pixel-changed one — measure before you believe.

---

## 8. Gate at nc-3

| | |
|---|---|
| app unit tests | **494** (was 472) |
| pipeline tests | **296** (was 240) |
| drift rules | 19 (rule 5's consumer list gains the board's stale cell) |
| B1 — routes cached | 10 of 11 |
| B4 — first-load JS | worst 193.3 KB, under the 200 KB ceiling |
| local e2e | 169 passed, 0 failed |
