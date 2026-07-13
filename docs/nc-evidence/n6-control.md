# N6 — the control room: what it does, and the eight things it found

*Written 2026-07-13. Every claim below has a test, a measurement, or a live production run behind it.
Where the plan and the world disagreed, the world won and the disagreement is recorded.*

---

## 1. The headline: the dispatch API tells you NOTHING, and the plan said it told you everything

Plan 8.2 said the app should dispatch with `return_run_details: true` and read `workflow_run_id` off
the response. **GitHub's own REST documentation says the same thing** — a 200, carrying
`workflow_run_id`, `run_url`, `html_url`.

Both are wrong. Recorded against the live API before a line of the bridge was written:

```
POST /repos/bishantt/myStockMarket/actions/workflows/nightly-a.yml/dispatches
     { "ref": "main", "inputs": { "mode": "macro" } }

->   HTTP/2.0 204 No Content
     (empty body. no workflow_run_id. no run_url. no html_url.)
```

There is no `return_run_details` parameter either. It is not in the docs and it is not accepted.

**Had this been built on the plan's claim**, every dispatched run would have carried a null run id,
could never have been polled, and would have sat on "requested…" forever. Which is exactly the hazard
this phase was warned about: **a run that fired and a run that never fired would look identical from
the couch.**

So the run id is **recovered, not received**. Each dispatch carries a `request_id`; the workflow
prints it into `run-name:`; the app finds its run by matching that id in the runs list. The plan
listed this as a *fallback*. It is the only path there is.

**That makes the `run-name:` line load-bearing.** Delete it and nothing fails — the workflow still
runs, the job still works, every test but one still passes — and the control room goes permanently
blind. `pipeline/tests/test_workflow_dispatch.py` guards it.

---

## 2. The panel's real subject is the ABSENCE of a button

Plan 8.1 did the honest evaluation and narrowed the commission hard: this is an end-of-day product,
and on a normal weeknight the pipeline **has already run**. A manual re-run would recompute
byte-identical data — so **for that case the honest control is the explanation, not the button.**

Photographed in production, at 2pm on a Monday with the market open:

```
Run tonight's full pipeline
Ingest the close, recompute everything, publish.
Markets are open — today's closing data doesn't exist until 4:00pm ET. The nightly run lands ~6:37pm ET.
                                                                          [ no button ]

Refresh the news        [Run]   Fetch today's articles… ~$0.15 of API budget.   2 of 2 left today
Refresh macro stats     [Run]   Re-read rates, gold, FX and the gauge inputs.   6 of 6 left today
Recompute scans         [Run]   Re-run indicators and scans over stored data.   2 of 2 left today
Re-run the evening briefing [Run]                                               2 of 2 left today
```

`full` is the only action with real reasons to refuse, because it is the only one that ingests the
market. The other four touch no price and depend on no session having closed — which is precisely why
8.1 found that they earn real buttons.

**The four C5 sentences** name the reason AND the next moment something changes: market open,
weekend, named holiday, already-ran. "Not available" without a "next" is a dead end.

---

## 3. The eight findings

### 3.1 The panel crashed on its FIRST poll, and the button looked completely inert

**This is the phase's own warned-of failure, and I built it anyway.**

JSON has no Date type. The panel's first render comes from a server component, which hands it real
`Date` objects — so it mounts perfectly. Then it polls, `JSON.parse` returns **strings**, and
`formatEtClock("2026-07-13T19:04:00.000Z")` throws `RangeError: Invalid time value`. The panel died
on re-render and React kept the old DOM on screen.

So a **real run** — dispatched, accepted by GitHub, executed, completed, and written to the ledger —
left the screen showing a Run button and "2 of 2 left today", exactly as if the press had done
nothing at all.

**TypeScript could not see it because I told it not to:**

```ts
const next = (await response.json()) as { rows: ActionRow[]; history: ManualRunRow[] };
```

An `as` cast on a parsed payload is not a check. It is an **assertion**, and this one was false.
`response.json()` returns `any`, the cast said "trust me", and the compiler did.

This is **N5's `_json_safe` lesson wearing the mirror image of its clothes.** There the question was
*"does the payload actually SERIALIZE?"* — a dict that looked perfect killed a production run four
and a half minutes in. Here it is *"does it actually DESERIALIZE into what the type claims?"* — and
for every instant on it, the answer was no.

The guard asserts the **consequence**: it round-trips the payload through real JSON and asserts the
panel still *renders*. Negative-controlled — without `revive()` it throws exactly as production did.
Checking that the keys survived would have proved nothing; the keys always survived.

**Found by firing one real run and watching the screen. 572 unit tests were green.**

### 3.2 The refresh never fired — React does not call `onSubmit` on an action form

I hung the post-dispatch refresh off the form's `onSubmit`. React does not fire it when a form has an
`action` function, so the ref it set stayed false forever. It rides `pending` true→false now, which
is React's own record that the action ran and came back.

### 3.3 `compute` mode died in production on its first run, and THE FAKE IS WHY

```
FileNotFoundError: [Errno 2] No such file or directory:
'parquet-store/prices_daily/year=2021/part.parquet.0D8fEcCE'
```

`R2Store.sync_down` never created its parent directories. Real boto3 writes to a temp file *beside*
the destination and raises if the directory is not already there; it will not `mkdir` for you.

It survived six phases because **the fake was kinder than reality**:

```python
def download_file(self, Bucket, Key, Filename):
    target = Path(Filename)
    target.parent.mkdir(parents=True, exist_ok=True)   # <-- boto3 does NOT do this
    target.write_bytes(self.objects[Key])
```

The mock did the one thing the real client refuses to do. And nothing had ever really exercised
`sync_down`: the full nightly *writes* the lake to disk (which mkdirs on the way) and syncs **up**.
N6's `compute` mode is its first true caller, on a fresh runner with an empty checkout.

**A mock more forgiving than the thing it stands for does not fail to test the code — it certifies
that the code works in a world that does not exist.** That is N3's fabricated fixture in a third set
of clothes: there the lie was in the **values**, in N5 it was in the **shape**, here it is in the
**fake's behaviour**. The fake refuses to mkdir now, and both `sync_down` tests go red without the fix.

### 3.4 Production has been claiming data "through" a Saturday

The panel opened with **"Data through 2026-07-11"**. July 11 2026 is a **Saturday** — no session, no
close, no bars. A full run had stamped Friday's bars with Saturday's date, and the Desk had been
telling the reader its data ran through a day the market never opened.

**And it was not a one-off.** The cron is `37 22 * * 1-5`, so it never fires at a weekend — but it
**does fire on every market holiday**, which is a weekday. Roughly nine times a year this job would
wake on a closed market, ingest nothing new, and publish a `pipeline_run` and a `market_context` row
dated to a session that did not happen. Nothing failed, so every gate stayed green.

`job_a` now skips a non-session day and says so, and exits cleanly — a skipped run on a closed market
is the *correct* outcome, not an error. Failing the workflow would send a red e-mail every
Thanksgiving, and an alert that cries wolf is not there on the night it is finally right.

**The bad row is still in production.** See QUESTIONS-FOR-BISHANT (Q-N6-1).

### 3.5 The Desk's doorway has led nowhere since N2

The freshness strip has linked to `/settings#pipeline` from all three of its states — **including the
loud one**, the red alert a reader follows when the pipeline is DEAD and they most need to get here
and re-run it. No element with that id existed. The fragment matched nothing and the browser quietly
dropped the reader at the top of the settings page, looking at a form for adding a stock to a
watchlist.

It never 404'd and nothing ever failed, which is exactly why it survived: **a fragment that matches
nothing is not an error. It is a link that quietly does half of what it says.**

### 3.6 The panel was reading the WRONG CLOCK, and the pixel oracle caught it

The first VRT baseline photographed the panel saying **"Markets are open — today's closing data
doesn't exist until 4:00pm ET"** directly underneath a nav bar reading **"MARKET CLOSED"**. One page,
two clocks, two answers. The nav grades in the browser; the panel was grading on the **server**; CI
happened to run at 3pm ET.

That is **N4's bug wearing a new surface** — a Desk built at 3:55pm told readers "markets open" long
past the close — and here it had a second head: **the baseline would have rotted on its own.** Every
state on this panel turns on what time it is, so the picture would change with the hour CI happened
to run and start failing with nobody having touched a line of code. That is *precisely* what the
`SEEDED_EVENING` clock pin was introduced to prevent, and the panel walked straight around it.

`controlPanel` is a pure function, so the fix is to run it where the reader's clock is: the server
sends the FACTS (the ledger, the last completed run, whether the token exists) and the browser
derives the states. **The server action still grades against the server's clock, and must** — a client
clock is an input the caller controls, and "the market is closed, honest" is not something a form
body gets to assert.

**The Desk's freshness strip settled this argument in N4 and says so in its own comment.** There is
one clock in this app that matters, and it is the reader's.

### 3.7 The most important sentence on the panel was unreadable

The P-2 notice rendered as light text on `#6d648c`. I had used `band` — a **data-visualisation**
colour, for bars and breadth segments — as a *surface*. It is a tinted wash now, and legible. Found
by looking at the picture; no contrast gate caught it, because the page was not in the axe sweep's
route list for that element.

### 3.8 The same sentence, five times

The first build printed `copy.control.notConfigured` on every row — which is what the state machine
honestly reports, since all five rows *are* `not_configured`. Every test passed. Then I photographed
the page and found the same 63-character sentence printed **five times in a column**.

The state is per-row; the **reason** is per-panel. Printing a shared reason once per row is not more
honest, it is just louder — and a wall of repetition is how a reader learns to skip a surface.

---

## 4. The amendments to the plan

| # | The plan said | The tree does | Why |
|---|---|---|---|
| 1 | Dispatch with `return_run_details: true`; the response carries `workflow_run_id` | Dispatch plainly; **recover** the run id by matching `request_id` in `run-name` | The API returns **204, empty body**. Recorded. There is no such parameter. GitHub's own docs are wrong too. The plan's "fallback" is the only path. |
| 2 | `compute` = "snapshot/scans/analytics from the stored lake + publish" | Same, but it publishes through a **dedicated `publish_compute`** | `publish()` sets `source_status = EXCLUDED.source_status` — a wholesale REPLACE. A recompute going through it would have **erased the night's record of a degraded provider**: ruling M2 broken by the back door. `publish_compute` merges `stage_status` and never touches `source_status`. |
| 3 | (unstated) run date for `compute` | Taken from **the DATA**, not the clock | The lake knows which session it holds. Ask the clock and a recompute fired at noon on Tuesday stamps its scans with Tuesday — a session that has not closed. This build has shipped a wrong-clock bug three times. |
| 4 | `not_configured` is one of eight row states | A row shows `not_applicable` **above** `not_configured`, and the missing token is stated **once**, above the rows | A fact about the world outranks a fact about our configuration. Checked the other way, P-2's absence swallowed every C5 sentence and the reader could not discover the feature existed. |
| 5 | (unstated) | **Nothing outranks a live run** | A `full` run writes its `pipeline_run` row at publish, near the END of its work — so "tonight's run already succeeded" is briefly true *while the run the reader started is still going*. Printing it over a live run is a lie about the present. |
| 6 | `manual_run` rows: `requested \| queued \| running \| succeeded \| failed` | Adds a UI state **`lost`** (never stored) | The dispatch returns no run id, so the app must hunt for the run. When the hunt never resolves, "requested…" forever is the silent failure. After 90s the panel says the run never appeared, and stops blocking the other buttons — one bad dispatch must not freeze the panel until midnight. |
| 7 | (unstated) — the panel is a server component | The row STATES are derived **in the browser**, against the reader's clock | The first VRT baseline caught the panel saying "Markets are open" under a nav reading "MARKET CLOSED". The nav grades in the browser; the panel was grading on the server. It is N4's bug in a new surface, and it would also have made the baseline ROT — the picture would change with the hour CI ran. The server action still grades server-side, and must: a client clock is an input the caller controls. |
| 8 | A dispatch writes a `manual_run` row | The row is written **only after GitHub accepts (204)** | A dispatch GitHub refuses requested nothing and ran nothing. Writing the row first would let a bad token **burn the day's single `full` run** — the recovery button — for a run that never happened. Plan 8.3's own principle, applied one case further. |

---

## 5. THE DEPLOYMENT ORDERING FACT (this will bite whoever forgets it)

**GitHub validates `workflow_dispatch` inputs against the workflow file as it exists ON THE TARGET
REF — not your working tree, not a PR branch.** The first live drill failed with:

```
HTTP 422  {"message":"Unexpected inputs provided: [\"request_id\"]"}
```

...because `request_id` existed locally and not yet on `main`.

**So N6's app half and workflow half cannot ship independently.** The workflow must be on the default
branch before the app can dispatch with its new inputs. One push carries both, and the ordering is
naturally safe: GitHub reads the workflow from `main` the instant it lands, while Vercel takes a
minute or two to build the app. The workflow is ready first. There is no gap.

**And the design held through it.** The panel said *"GitHub would not start the run. Nothing was
dispatched."*, wrote **no** ledger row, and left the cap at "6 of 6 left today".

---

## 6. The live drill (plan 8.7's gate)

Fired from a real browser, against real GitHub, with a real token.

**Run 1 — `macro`.** Dispatched, found, followed, reconciled:

```
display_title: "nightly-a · macro · c55011e8-ce9c-430a-bca4-a135d628d0f9"   -> success
ledger:        macro | succeeded | ghRunId=29274995603
panel:         "available again at 15:04 ET · 5 of 6 left today"
```

The run-name carries the request id; `findRun` recovered it; the status reconciled; **the cap
decremented 6 → 5**; the 30-minute cooldown engaged and the button went away. Every piece of the loop.

**Run 2 — `compute`**, which is the only thing that can prove the new pipeline mode works:

```
job_a[compute]: pulled 6 partition file(s) down from the history lake.
nightly: analytics — 24 base rates, 1 cards, 102 vol bands.
job_a: asked the app to revalidate the Desk.
job_a (compute): recomputed 2026-07-10 from stored bars — 11017 symbols, 1315 scan matches.
                 No provider was called; the night's own source health is untouched.
```

**`recomputed 2026-07-10`** — Friday, while the run happened on a Monday. The run date came from the
data, not the clock, exactly as designed. 11,017 symbols. And the merge held in production: the Jul 10
row's pre-existing `stage_status` survived and gained `{compute, scan, publish}` rather than being
replaced.

**Run 3 — the panel following a live run**, after the JSON fix:

```
BEFORE: Re-run the evening briefing | Run | 1 of 2 left today
POLL 200
AFTER : Re-run the evening briefing | requested | Dispatched — finding the run…
```

---

## 7. Guards added

- **`test_workflow_dispatch.py`** — the workflow's mode dropdown must equal `MODE_STAGES` (an option
  the job cannot run is a button that reports success and does nothing), and `run-name` must carry
  `request_id` (without it the control room is blind). Negative-controlled.
- **`ComputeDeps` carries no provider at all**, and a test enumerates its five fields. The promise
  ("this button fetches nothing") is held by the TYPE, not by a comment — same shape as `rank.py`'s
  significance signature test.
- **`publish_compute` preserves a degraded source** — a DB test, so CI is its only oracle.
- **A recompute cannot duplicate the track record** — `signal_log` is insert-only on its natural key.
- **`PipelinePanel.test.tsx`** — the payload survives a real JSON round-trip *and still renders*,
  with a negative control that throws.
- **VRT**: `/settings` had **no baseline at all** — the one room in the app that is a writer, and the
  pixel oracle had never looked at it. It does now, in both themes, and the pinned clock lands `full`
  in the already-succeeded state so the flagship C5 sentence is locked in a picture.

---

## 8. What N6 did NOT do

1. **P-2 is still unprovisioned.** The panel is built against the missing secret and renders every
   real state; it flips live the moment `GH_DISPATCH_TOKEN` exists in Vercel. Verified by running the
   whole thing locally with a real token — see §6.
2. **The bad Saturday `pipeline_run` row is still in production** (Q-N6-1). Tonight's nightly writes
   `2026-07-13` and supersedes it for every display purpose; the row itself remains.
3. **Weekend recovery is not offered.** `full` on a Saturday is `not_applicable`, so a Friday nightly
   that failed cannot be recovered until Monday — at which point Monday's run backfills the bars
   anyway (the nightly pulls five years every time). What is genuinely lost is that Friday's
   `scan_result` and `signal_log` rows never exist. Logged in QUESTIONS (Q-N6-2).

---

## 9. Counts at `nc-6`

| | |
|---|---|
| App unit tests | **577** (was 541) |
| Pipeline tests | **462 local, 26 skipped** (was 446/22) |
| Anti-drift rules | 20 |
| VRT baselines | **76** (was 71) — `/settings` had none at all |
| Modes | **4** — `full`, `news`, `macro`, `compute` |

**Six of the eight findings were found by running the thing and looking at it, or by firing a real run
at a real API. Two were found by a test** — and one of those two was the pixel oracle, which is a
camera rather than an assertion. That is ten bugs this build has found by opening the picture, and it
has not missed yet.

**And a note on the ones the tests DID catch.** Every bug above had a unit test that *could* have
caught it and did not — because the test was built from the same misunderstanding as the code. A green
suite is evidence about the tests, not about the system.
