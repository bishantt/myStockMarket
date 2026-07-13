# PROGRESS.md — resumable state

# THE NEWS & CONTROL BUILD IS DONE (2026-07-13) — tagged `nc-final`, CI green on the tag.

All eight phases, N0 through N7. Nothing is blocked. Nothing is in flight.

**If you read only one thing:** N7's job was to harden the guards, and **the repaired guards then
caught a real bug and two rotting gates on the tag run itself** — which is the best evidence there is
that the repair was worth making.

- **The story page's source links are 20px tall on a phone.** Measured: "CNBC" 39×20, "Reuters" 48×20,
  "Associated Press" 110×20 — five stacked links, each under half the 44px floor. Those links are how
  you check a story against the outlet that reported it; they are the room's whole honesty argument.
  The bug shipped in N5 and survived two tagged phases, **and it was unmeasurable the entire time** —
  the sweep had never been given the route, and when it finally was, it was reading the 404 page.
- **The `/paper` screenshots did not break. They EXPIRED.** The seed dated its trades absolutely while
  the app counts "round trips this week" against the wall clock, so a trade aged out of the window
  **at 19:50Z — twenty-eight minutes after the run that last certified the picture.** The cost mirror
  silently halved, from −31.2%/yr to −15.6%/yr. Re-shooting would have bought exactly one day. The
  fixture is relative now, and the count is 2 forever.
- **A control-room test was passing only while the market was open.** It ran at 3:22pm at `nc-6` and
  at 4:39pm here; the clock moved and a green test turned red.

And the two findings from the hardening itself: **two of the things guarding this build were not
guarding anything.**

1. **Your route sweeps were passing on a page that does not exist.** The touch-target, sideways-scroll
   and accessibility sweeps measure whatever is on screen. Ask for a news story whose id is not in the
   database and the app shows its 404 screen — so on any unseeded run, the sweeps measured **the 404
   page**, found nothing wrong with it, and reported the story page clean. I proved it: the
   accessibility sweep **passed** a story page against a database that has never contained it.

   **Then my own fix failed the same way.** I checked the HTTP status — and it still passed, because
   **this app answers a missing page with "200 OK" and then shows the 404 screen.** You already knew
   half of that; an F-phase note in QUESTIONS says *"unknown tickers return HTTP 200 instead of 404"*
   and judged it fairly: *"a wrong status code, not a wrong screen."* That is true of what **you** see.
   Nobody asked what it does to a **guard** — and the answer is that it silently disarms every guard
   that trusts the status. **A cosmetic flaw in the product was a load-bearing flaw in the
   instruments**, and the two were never thought about together for a month.

2. **The Development Plan PDF has been wrong for a month.** There were *two* hand-kept HTML copies of
   that document — one feeding the markdown, one feeding the PDF — and nobody had ever decided that.
   They drifted. **Not one of the 2026-07-12 app-feel amendments had ever reached the PDF.** Its route
   map was missing `/scans/[preset]`, a room that has existed for a month, and it still promised a
   rendering strategy the app abandoned. The markdown was right, the PDF was wrong, and both looked
   equally current and confident. **The copy that rots is the one read least — which is the PDF, the
   one you actually open.** One source now; both outputs are generated from it.

**Counts at `nc-final`:** **577 app tests** · **462 pytest local** (26 skipped — no Postgres on this
Mac) · **20 drift rules** · **76 VRT baselines** · 4 pipeline modes · 13 product routes ·
B1 **12 of 13** rooms cached · B4 worst **196.2KB** under the 200KB ceiling · `check:migrations`
green (production is running this schema). **Evidence:** `docs/nc-evidence/n7-hardening.md`, which
also carries the closing table for all seven chapters.

## What N7 changed

- **The sweeps got `/news` and the story page** (they had never measured the Front Page — the densest
  room in the app for touch rules; it passes clean), they read the **body** rather than the status,
  they refuse a redirect, and the touch sweep now **fails if it measured zero controls**. All
  negative-controlled.
- **The docs agree with the tree.** The route map, §2.1 and the repo layout know about `/news`,
  `/news/[cluster]`, the control room, `/api/pipeline/status`, the four pipeline modes and the
  non-session-day skip. CLAUDE.md's Commands block gains the modes and a control-room section naming
  the load-bearing `run-name:` line. The `new-surface` skill gains the window checklist line.
- **One source for the plan document**, and the PDF is re-rendered (37 pages, cover intact — I
  photographed the route map through `print.css` before shipping it, which is how I caught that the
  first table I checked was the wrong one).
- **`/settings` gave back a database round-trip.** It costs ~455ms because it is the one room that
  cannot be cached (it is a writer). Not a regression — F7 measured 564ms in the same state — but two
  independent reads were running in series for no reason.

## What is still open (nothing blocks anything)

- **P-2 — the GitHub token.** Every button in the control room is dark in production until it exists.
  The panel says so, once, and renders every other state honestly. **The whole path is proven** — I
  ran it locally with a real token and fired real runs at real GitHub. It is a secret and nothing
  else: a fine-grained PAT, this repo only, Actions read+write, added to **Vercel** as
  `GH_DISPATCH_TOKEN`. Two minutes.
- **P-1 — the R2 media bucket.** Absent. The Front Page renders its designed generated cards.
- **Q-N6-1 — the Saturday rows: ANSWERED by the user (2026-07-13) — delete them.** I fixed the cause
  (`job_a` skips a non-session day) and declined to delete production data on my own judgment; the
  user has now made that call. **The deletion is not N7's to run:** POLISH-AND-DEPTH-PLAN's **PD1**
  executes the SQL *after Monday's edition is verified*, and running it early would break that
  sequencing. Until then the rows (`pipeline_run`, `market_context`, `scan_result`, all stamped
  2026-07-11) remain in production — invisible to every display, but present in any series that walks
  those tables by date.
- **The iOS device pass is yours.** There is no iPhone here. Everything a machine can check is checked
  on every push; the checklist for the ten minutes only a real device can do is in QUESTIONS.

---

# Previously — N6 (the control room)

**If you read only one thing:** the control room is built, and **the plan was wrong about the one API
it was built on.** GitHub's dispatch endpoint returns **204 with an empty body** — no run id — and
GitHub's own documentation says otherwise. I recorded the real response before writing a line of the
bridge, and it inverted the whole design. Then firing one real run at the real GitHub found three more
bugs that 572 green tests could not see.

---

## The eight things worth knowing from N6

### 1. The dispatch API tells you NOTHING, and the plan (and GitHub's docs) said it told you everything

Plan 8.2 said to dispatch with `return_run_details: true` and read `workflow_run_id` off the response.
GitHub's own REST docs describe exactly that. **Both are wrong:**

```
POST .../actions/workflows/nightly-a.yml/dispatches  ->  HTTP 204 No Content, EMPTY BODY.
```

No run id. No `return_run_details` parameter. Had I trusted either source, **every button would have
dispatched a real run and then reported "requested…" forever** — a run that fired and a run that never
fired, identical from the couch, which is precisely the hazard I was warned about.

So the run id is **recovered, not received**: each dispatch stamps a `request_id`, the workflow prints
it into `run-name:`, and the app matches it in the runs list. That makes the `run-name:` line
load-bearing — delete it and nothing fails, every test but one passes, and the control room goes blind.

**N4's rule was "record the provider's response before writing the parser". N6 extends it: the
vendor's own documentation is not a recording.**

### 2. The panel's real subject is the ABSENCE of a button

Plan 8.1 did the honest evaluation: on a normal weeknight the pipeline has already run, and a manual
re-run would recompute identical data — so **the honest control for that case is the explanation.**
Photographed in production at 2pm on a Monday:

> **Run tonight's full pipeline**
> Ingest the close, recompute everything, publish.
> *Markets are open — today's closing data doesn't exist until 4:00pm ET. The nightly run lands
> ~6:37pm ET.*   **← no button**

`full` is the only action with real reasons to refuse, because it is the only one that ingests the
market. The other four (news, macro, compute, briefing) touch no price and depend on no session having
closed — which is exactly why 8.1 found they earn real buttons.

### 3. The panel crashed on its first poll, and the button looked completely inert

**JSON has no Date type.** The first render comes from a server component and carries real `Date`
objects, so the panel mounted perfectly. Then it polled, `JSON.parse` returned **strings**, and
`formatEtClock` threw `RangeError: Invalid time value`. React kept the old DOM.

So a **real run** — dispatched, accepted by GitHub, executed, completed, written to the ledger — left
the screen showing a Run button and "2 of 2 left today", exactly as if the press had done nothing.

TypeScript could not see it **because I told it not to**: `(await response.json()) as {...}` is an
assertion, not a check, and it was false. This is N5's `_json_safe` lesson mirrored — there, *does the
payload SERIALIZE?*; here, *does it DESERIALIZE into what the type claims?*

Found by firing one real run and watching the screen. **572 unit tests were green.**

### 4. `compute` mode died in production on its first run, and the FAKE is why

`R2Store.sync_down` never created its parent directories. Real boto3 raises `FileNotFoundError`; it
will not `mkdir` for you. It survived six phases because **the fake was kinder than reality** —
`FakeS3.download_file` began with `target.parent.mkdir(...)`, doing the one thing boto3 refuses to do.

And nothing had ever really used `sync_down`: the full nightly *writes* the lake and syncs **up**.
N6's `compute` mode is its first true caller. **A function with no real caller has no real test.**

**A mock more forgiving than the thing it stands for does not fail to test the code — it certifies
that the code works in a world that does not exist.** N3's lie was in the VALUES, N5's in the SHAPE,
N6's in the FAKE'S BEHAVIOUR.

### 5. Production has been claiming its data runs "through" a SATURDAY

The panel opened with **"Data through 2026-07-11"** — a Saturday. No session, no close, no bars. A
full run had stamped Friday's bars with Saturday's date.

**Not a one-off:** the cron is `37 22 * * 1-5`, so it never fires at a weekend — but it **fires on
every market holiday**, which is a weekday. ~9 times a year it wakes on a closed market, ingests
nothing, and publishes a run dated to a session that did not happen, with every gate green.

`job_a` now skips a non-session day and exits cleanly. **The bad row is still in production — it is
Q-N6-1, with the SQL, for you to decide.**

### 6. The Desk's doorway has led nowhere since N2

The freshness strip has linked to `/settings#pipeline` from all three states — **including the red
DEAD alert**, the one a reader follows when the pipeline is broken and they most need to get here. No
element with that id existed. **A fragment that matches nothing is not an error; it is a link that
quietly does half of what it says.**

### 7. The panel was reading the WRONG CLOCK — and the pixel oracle caught it

The first VRT baseline photographed the panel saying **"Markets are open"** directly underneath a nav
bar reading **"MARKET CLOSED"**. One page, two clocks, two answers. The nav grades in the browser; the
panel was grading on the **server**; CI happened to run at 3pm ET.

**N4's bug in a new surface** — and with a second head: the baseline would have **rotted on its own**,
changing with the hour CI happened to run and failing with nobody touching a line of code. The states
are derived in the browser now. The server action still grades server-side, and must — a client clock
is an input the caller controls.

### 8. The most important sentence on the panel was unreadable

The P-2 notice rendered as light text on `#6d648c`. I had used `band` — a **data-visualisation**
colour, for breadth bars — as a *surface*. Found by opening the PNG.

---

## What N6 landed (tag `nc-6`)

- **The control room** (`/settings#pipeline`): five actions, each in exactly one of ten states, with
  the caps, the cooldowns, and the four C5 "not available" sentences that are the actual feature.
- **`compute` mode** — the last of the four. Its promise (*touches no provider*) is held by the TYPE:
  `ComputeDeps` carries no fetcher at all, and a test enumerates its five fields. It takes its run
  date from **the data**, not the clock.
- **`publish_compute`** — because `publish()` REPLACES `source_status` wholesale, and a recompute
  going through it would have **erased the night's record of a degraded provider** (ruling M2, by the
  back door).
- **A dispatch GitHub refuses writes no ledger row and burns no cap.** A bad token must not eat the
  day's single `full` run — the recovery button — for a run that never happened.
- **A `lost` state**: an unfindable run is reported after 90s, and stops blocking the other buttons.
- **VRT**: `/settings` had **no baseline at all** — the one room in the app that is a writer, and the
  pixel oracle had never looked at it.

**The live drill (plan 8.7's gate), fired at real GitHub from a real browser:**

```
nightly-a · macro · c55011e8-…   -> success. Panel followed it. Cap 6->5. Cooldown engaged.
job_a (compute): recomputed 2026-07-10 from stored bars — 11017 symbols, 1315 scan matches.
                 No provider was called; the night's own source health is untouched.
```

`recomputed 2026-07-10` — Friday, on a Monday. The run date came from the data, exactly as designed.

**Counts at nc-6:** **577 app tests** · **462 pytest local, 26 skipped** · 20 drift rules · **76 VRT baselines** (was 71) · 4 modes.
**Evidence:** `docs/nc-evidence/n6-control.md`.

---

## What N6 did NOT do

1. **P-2 is still unprovisioned**, so every button is dark in production. The panel says so, once, and
   renders every other state honestly. **I proved the whole path works** by running it locally with a
   real token and firing real runs — see the evidence, §6. It is a secret and nothing else.
2. **The bad Saturday row is still in production** (Q-N6-1 has the SQL). Tonight's nightly supersedes
   it for display; the row remains.
3. **Weekend recovery is not offered** (Q-N6-2). A failed Friday nightly waits for Monday, which
   backfills the bars anyway — what is genuinely lost is Friday's scan/signal rows.

---

# Previously — N5 (the Front Page)

## The six things worth knowing from N5

### 1. Every photograph on the Front Page was broken, and only the PNG showed it

The image optimizer does not proxy your request — it makes its **own server-side fetch** of the
source image, and that fetch carries no session cookie. `/fixtures/` was behind the login wall, so
the optimizer followed a 307 to the login page, decided the source was not an image, and served a
400. **Every photo rendered as a broken-image icon.** The generated fallback cards — which need no
optimizer — rendered perfectly, so the page still looked plausible.

Every DOM assertion passed throughout. The `<img>` was present, visible, correctly sized (the width
and height come from the database row, which is exactly what makes the layout shift zero) and
carrying the right `src`. **`naturalWidth` is the only thing in a browser that knows an image from a
broken one**, and nothing was asking it. It does now.

**Had I committed the baselines I had in hand, every visual-regression gate from here on would have
been locking in a picture of that bug.** That is seven real bugs this build has found by opening a
PNG and looking at it.

### 2. The lead story's headline was below the fold

Same photograph, second finding. A 1.91:1 image is a comfortable 204px on a 390px phone. The same
ratio across a 1366px desktop column is **715 pixels** — so above the fold there was the masthead,
the filter rows, and a photograph, and nothing else. **A front page whose lead headline you have to
scroll to find is not a front page; it is a poster.** The ratio governs where it is right (the
phone); the height is capped where it is not.

### 3. The corroboration count could not be OPENED

The card whispers "5 sources" — and **nothing anywhere named them.** `news_cluster.sources` is a bare
integer. So the card could not print its outlet, and the story page's source list (the *first line* of
its spec) had no data at all. The number doing **25% of the work of ranking the whole front page** was
one you simply had to believe.

The plan said the articles lived in `news_item`. They cannot: Job B reads every `news_item` row in its
window and synchronously extracts every id that was not in the nightly batch, so putting the market
feed there would fire ~200 extra model calls a night and feed the entire feed into the evening
briefing. New column, snapshotted at publish. **And the seed now refuses to load** if a cluster's
`sources` count disagrees with the number of articles behind it — without that check the card prints
"5 sources" over a list of two and every test still passes, because no test compared those two numbers.

### 4. The narrator could hold the night open for hours

The first live news run sat in the extraction stage for **over twenty minutes** and had to be
cancelled. The Anthropic SDK's default per-call timeout is **ten minutes** with retries on top, and
Stage A makes up to 60 sequential calls.

That is backwards. The narrator runs LAST precisely so everything before it can publish without it —
**a context line does not get to make the front page late.** The client is bounded per call now (30s),
the extraction stage takes a six-minute wall-clock budget, and when the budget is gone it stops
reading, the rest go to the narrator with their headlines, and the page ships. The night says how many
it gave up on.

### 5. The seed described JSON shapes the pipeline has never produced — and the tests agreed with it

The seeded news night was hand-written in N4, before the narrator existed, and it **guessed** at two
shapes. The app reads the real ones, so it silently found nothing: the story page told the reader the
narrator had simply had nothing to add — **when the gate had actually deleted a line** — and every key
number in the seeded room was thrown away on read, so the **mono emphasis on a verified headline
figure, whose entire meaning is "this was checked against its source", had never once rendered.**

**And the tests agreed with the fixture.** The fixture test asserted the invented shape, and its
hand-written TYPE declared it. The fixture agreed with the test, the test agreed with the fixture, and
neither agreed with the producer. That is N3's fabricated-fixture lesson wearing different clothes:
there the lie was in the values; here it is in the SHAPE — **and the app reads shapes.**

Caught by the `nc-5` tag's e2e. The guard now runs the whole seed through the app's own boundary
reader and counts what goes in against what comes out.

### 6. The room would have shipped uncached, with a `revalidate` that did nothing

`/news/[cluster]` re-rendered on **every single request** despite carrying `export const revalidate =
600`. A dynamic route needs `generateStaticParams` — even an empty array — or the framework silently
ignores the revalidate. `/ticker/[symbol]` carries a comment documenting this exact trap. The story
page fell into it anyway, because the failing code *looks* right.

Caught by the routes budget — not by eye, and not by any test, because the page never misbehaved. It
was simply correct and expensive. **A performance budget is the only instrument that can see that.**

---

## What N5 landed (tag `nc-5`)

- **`/news`** — the feed. A lead card, uniform rows, catalyst + sector filter chips, Today/This week,
  pagination, "Moved without a story", and the press-time and cadence lines. **The lead is a POSITION,
  not a prize**: the seeded night puts the largest move on the tape (SMCI, +18.4%) at rank three,
  behind a Fed statement that moved nothing at all, and an e2e goes red if that ever changes.
- **`/news/[cluster]`** — one story in full: the named and linked sources, the image, what happened,
  why it matters, the numbers, the affected-ticker table, and the Academy doorway (which renders only
  where a lesson actually exists).
- **Desk module 08** — a glance and a doorway. It states its own cut ("First 3 of 14 by significance")
  and reads the pipeline's order rather than re-deriving it.
- **News is the sixth tab** (Part 0.1, option A — the plan's default, and no DECISIONS line overrode
  it). The Desk gave up the newspaper icon to the room actually titled "Front page" and took a sunrise.
- **N4's narration carry-over is CLOSED.** Stage A (Haiku, ≤60 clusters) and Stage B-mini (Sonnet, one
  call), with the briefing's own verification gate reused on every note — one definition of "what
  counts as verified" in the whole system, not two.
- **The gate turned "2.1x" into the phantom number "2" and flagged it** — so every honest note about
  relative volume would have been silently deleted, and a deleted note prints nothing. Fixed for both
  the Front Page and the evening briefing.
- **Drift rule 20** (negative-controlled): news imagery has ONE door.

**The narrator is LIVE in production.** The final news-mode run:

```
job_a (news): 163 articles in, 27 filings dropped, 133 stories published.
              Sources: {finnhub: ok, marketaux: degraded, images: not_configured, narration: ok}
              narration: 59/60 extracted, 20 notes written, 0 dropped by the gate.
```

`59/60` is the degradation rule working — one call failed, was dropped, and the other 59 were read.
The notes it writes name mechanisms, not predictions: *"Rising oil prices feed into headline
inflation, a channel central banks watch when setting interest rate expectations."*

**Counts at nc-5:** **541 app tests** · **446 pytest local, 22 skipped** · 20 drift rules · 71 VRT
baselines · B1 12 of 13 routes cached · B4 worst 195.1KB under the 200KB ceiling. **CI is GREEN on the
`nc-5` tag — all four jobs, including the pixel oracle.** **Evidence:** `docs/nc-evidence/n5-frontpage.md`.

---

## What N5 did NOT do

1. **There are still no photographs in production** (P-1, the media bucket, does not exist). Every card
   renders the designed L4 generated catalyst card. Every article in the recorded feed carried a
   publisher image (160 of 160), so L1 answers for nearly every card the moment a bucket exists — a
   secret and one environment variable, not a code change. **Q-N5-2 asks you to look at the four rungs
   in the styleguide and tell me whether the claim holds.**
2. **`compute` mode is still not declared.** It lands with N6, which builds the panel its button belongs
   to, so the promise and the code arrive in the same commit.

---

## The eight amendments to the plan, all logged, all in an honesty rule's favour

1. **`copy.news.ordering`** now says the page **ties** (Q-N4-1). Two of the three signals it named are
   near-constant on the real feed. Change the words, not the ranking — inventing a tiebreaker would be
   the app forming an editorial opinion, which is what ruling C1 forbids.
2. **The extract lands on `news_cluster.extract` only**, not `news_item` (see #3 above).
3. **Stage A runs synchronously**, inside the news stage, so the whole page — facts and prose — lands in
   ONE transaction. Split across two jobs, the publish upsert would null out the prose every time news
   mode ran. Cost of the difference: ~$18/year.
4. **The Stage-A cap ranks by significance**, reversing N4's own rule. Measured: **8 of the 20 narrated
   clusters were never read by the extractor**, and they were the eight biggest stories of the night.
5. **The filter chips are derived from the feed** and include "Other" — the plan's fixed list could not
   reach every story on the page.
6. **Card timestamps are absolute**, never "3h ago" — a relative time on a cached page is computed at
   build time, which this build has shipped twice.
7. **The generated cards use one restrained ground**, not twelve sector tints. Colour is scarce.
8. **The lead card sets sideways on a desktop.** Stacked, a 1.91:1 photo across 1366px is 715px tall
   and the lead's own headline lands below the fold. A front page you must scroll to read the lead of
   is a poster.

---


**Where I was.** N0–N4 are complete and tagged `nc-0` … `nc-4`.

**If you read only one thing:** the news data layer is live in production — 186 stories, ranked, in the
database — and **four of the plan's assumptions about the providers were wrong**, each one caught by
recording the real response before writing the parser. The plan's clustering threshold would have
clustered *nothing at all*. Details below.

**P-5 is closed.** The gold cell is filled in production (`gold_usd 2026-07-13 · 4034.215 · goldapi`).

---

## The six things worth knowing from N4

### 1. A secret in GitHub is not a secret in the job — and this build has now shipped that bug TWICE

You added `GOLDAPI_KEY`. The gold cell would **still** have printed "not yet reported" every night,
because `nightly-a`'s env block never passed the key to the job. That is exactly the
`ANTHROPIC_API_KEY` bug N0 found, which silently skipped every LLM stage in production for four phases.

Why the class is so dangerous: **good error handling hides it.** The pipeline degrades quietly when a
key is missing — correctly, because one dead provider must not take the night down — so the job prints
a calm line, carries on, and every gate stays green.

Both were found by hand. A thing found by hand twice will be missed the third time, so the check is now
derived from the code: `pipeline/tests/test_workflow_env.py` walks the import graph from each job
module, reads what it actually takes off the settings object, and fails if the workflow that runs it
does not pass a required secret. Negative-controlled.

### 2. Finnhub's market news carries NO tickers, and that reshaped the whole phase

`related` is empty on **all 100 general and all 60 merger items**. Company news carries it on **20 of
20**. Same provider, different endpoint — and the market feed is the Front Page's main source.

The plan's clustering rule required *"overlapping ticker sets"* and its significance formula measured
magnitude *"over the linked tickers"*. Applied literally: two empty sets never overlap, so **nothing
would ever cluster**, and every story would score the magnitude floor.

So `newsdesk/resolve.py` does entity resolution deterministically, against the instrument table, with
no model near it — a wrong ticker link is a card telling the reader a story is about a company it never
mentions, beside a real price move. **Zero false positives across the whole recorded night** with every
trap name loaded (Target, Gap, Visa, Key, Match, and C3.ai — whose ticker is literally `AI`).

**Why it was missed:** the repo already had a Finnhub fixture, so the endpoint *felt* known. It was a
different endpoint. A fixture for a neighbouring endpoint is not evidence about this one.

### 3. The plan's clustering threshold clusters NOTHING, and the right one sits 0.05 from fabrication

At the plan's Jaccard ≥ 0.55: **zero merges out of 134 real articles.** "VitalHub acquires Buddy
Healthcare" and "VitalHub Announces Acquisition of Buddy Healthcare" score 0.50 — `acquires` and
`acquisition` are different tokens. **A bar that high is not strict, it is inert**, and the Front Page
would have printed every story once per outlet while its "3 sources" line never once appeared, with
every test green.

Measured: **0.45 finds every true merge and no false one. 0.40 fabricates** — Qiagen, Conmed and Tiny
Ltd collapse into ONE card because all three headlines say "jumps after report of takeover interest".
Three companies, three deals, one headline standing for all of them. Pinned by tests from **both** sides.

The tickers' honest role turned out to be a **veto**, not a requirement: "Apple beats on revenue" and
"Microsoft beats on revenue" are near-identical strings (Jaccard 0.67) about different companies.

### 4. The sixth bug found by printing the output and reading it

Everything passed. Printing the actual front page showed **"Iran's IRGC navy says Strait of Hormuz
closed until further notice"** — arguably the biggest market story of the day — classified `other` and
sitting **dead last at 0.165**, while *"An emboldened India holds out for better terms in US trade
talks"* **led the page** because it contained the words "trade talks". The macro keyword vocabulary now
covers what actually moves markets. **Six real bugs, this way, and by no other means.**

### 5. Production found two more, AFTER the first publish — and one of them was in the app

**The resolver named companies that were not in the story.** It was clean against a 44-name test
universe. Against production's **12,933 instruments** it linked **UAE** (a country) and **LNG** (a
commodity) to real ETFs, **NDAQ** to five stories about the *index*, and the ordinary words
"strategy", "people", "popular", "team" and "fossil" to Strategy Inc, People Inc, Popular Inc, Team
Inc and Fossil Group. **A stoplist that has to grow with the data it filters is the wrong shape of
guard** — so the test was inverted: list the WORDS, not the names. Re-published and verified: **zero
false links.**

**And a provider's symbol is not our symbol.** Marketaux tagged the VitalHub story with VHI — right
for VitalHub in *Toronto*, and in our table VHI is **Valhi, Inc.** of New York. The card would have
printed Valhi's real price move under a headline about a Canadian software acquisition: every number
true, the card a lie.

**The pixel oracle then found one in the APP.** The Desk's baselines failed, and it was not N4's
code: `/` is ISR-cached and computed "markets open/closed" in a **server component**, so the phrase was
frozen at cache-generation time. **A Desk built at 3:55pm told readers "markets open" long past the
close.** F4's cooling-off bug again. It reads the browser's clock now.

### 6. The ranking signal is thinner than the plan assumed — read Q-N4-1 before N5

corroboration = 1 for **131 of 134** clusters; magnitude = 0 for **~130**. That is **45% of the
formula's weight sitting nearly constant**, so the order collapses onto scope + class prior, and
**ten-plus stories tie at exactly 0.600**. It is honest (a macro day *is* a wall of macro stories) and I
did not invent a discriminator to break the ties, because that would be the app forming an editorial
opinion. But N5's header copy must not overclaim a fine ranking the data cannot support. Full write-up
and the three options in QUESTIONS-FOR-BISHANT.md.

---

## What N4 landed (tag `nc-4`)

- **Both market endpoints RECORDED before a parser was written** — `/news?category=general`, `=merger`,
  the `minId` probe, and Marketaux with N4's exact parameters. Neither Finnhub market endpoint had ever
  been called by this repo.
- **The deterministic newsdesk**, with no model anywhere in it: `resolve.py` (tickers), `taxonomy.py`
  (the closed sector set + AI/Defense themes, word-boundary matched so "aid" is not "AI"), `noise.py`
  (43% of the merger feed is UK Takeover-Panel Form 8.x paperwork), `outlets.py` (three press wires
  carrying one announcement are ONE source, not three), `cluster.py`, `rank.py`, `ingest.py`.
- **`rank.py` holds ruling C1 structurally.** A test enumerates `significance()`'s signature: six
  inputs, every one a property of the EVENT. No behavioral signal could be added quietly, because the
  test would have to be edited to let one in — and none is ingested anywhere in the system.
- **The image pipeline** (Pillow): L1–L4 ladder, 1200/640/240 variants, blur placeholder, EXIF
  stripped, and a crop rule that refuses to decapitate a portrait photo. **No bucket yet (P-1)** — it
  records `news-images: not_configured` and the cards fall to the designed L3/L4 rungs.
- **`news` mode**, and the guard that matters more than the mode: every mode `main()` did not recognise
  **fell through to the full nightly**. A "refresh the news" button pressed at noon would have
  re-ingested the entire market mid-session. `main()` now refuses any mode it has no handler for.
- **Verified in production**: `gh workflow run nightly-a.yml -f mode=news` → *218 articles in, 26
  regulatory filings dropped, 186 stories published, 126 past the extraction cap.* Live DB: **186
  `news_cluster` rows, 141 `catalyst_link` rows.**

**Counts at nc-4:** 506 app tests · **406 pytest local, 22 skipped** (was 296) · 110 new pipeline tests · 318 e2e · 19 drift rules · 55 VRT
baselines. **Evidence:** `docs/nc-evidence/n4-newsdesk.md`.

---

## What N4 did NOT do — N5 inherits these, and they are deliberate

1. **The LLM narration is not built.** Stage-A write-back and Stage-B-mini (the `why_it_matters` line)
   are the one part of N4's scope I did not reach. Every cluster publishes with `why_it_matters = null`,
   which the schema and the card design **already treat as a first-class state** ("a null here prints
   NOTHING — never a placeholder"). The facts, the ranking, the sectors, the themes and the ticker links
   are all real and all published. The prose layer is absent, and the room renders correctly without it.
   Do this first in N5, or fold it into N5 — it is additive, and nothing depends on it.
2. **`compute` mode is not declared.** It lands with N6, which builds the panel its button belongs to,
   so the promise and the code arrive in the same commit.
3. **The image bucket (P-1) does not exist**, so no image is fetched or stored. The ladder is built and
   tested; the L3/L4 rungs are what N5 must render anyway.

---

## Resumable state — start here

- **Done:** N0 (`nc-0`), N1 (`nc-1`), N2 (`nc-2`), N3 (`nc-3`), N4 (`nc-4`).
- **Next: N5 — the Front Page UI** (plan Part 7.7, 7.8, 7.10's UI half, Desk module 08, nav per Part
  0.1). **The seed already contains a full news night** (`app/prisma/fixtures/news.mjs`) — check what is
  there before inventing shapes.
- **Provisioning:** P-1 (R2 media bucket) still absent, does not block. P-2 (GitHub PAT) is N6's.
  **P-3 and P-5 are CLOSED.**
- **Open for the user:** Part 0.1 — where the News room lives. N5 builds the plan's default (a sixth
  tab) unless a DECISIONS line says otherwise; it stays a one-file flip. Plus **Q-N4-1**, the ranking
  finding, which is an FYI rather than a blocker.


**Where I am.** N0 (ground truth, wiring, seeds), N1 (the macro truth fix), N2 (windows, density, the
grid) and N3 (the macro board) are complete and tagged `nc-0` … `nc-3`. Nothing is blocked. The next
phase is **N4 — the news data layer** (plan Part 7.3–7.6 + 7.9's pipeline half).

**If you read only one thing:** the macro board is live, and the fifth real bug of this build was
found by opening a screenshot and looking at it. Both facts below.

---

## The three things worth knowing from N3

### 1. Three of this repo's test fixtures were fabricated, and had been passing for three phases

The `new-provider-adapter` skill's first rule is *record REAL fixtures*. R0 did not. It hand-wrote
`sp500.json`, `nasdaqcom.json` and `djia.json` in the shape of a genuine FRED response and filled in
plausible numbers. Two tells: the fake claimed the S&P series has **8,000 observations** (it has
2,610), and put the index at **6,812** where FRED actually said **7,575**.

Nothing broke — the parser works on real data too. So for three phases, every index-level test was
proving that the code agreed with **my own imagination**. And the fiction had already destroyed a real
property of the data: FRED's index series post a day AHEAD of the VIX, and the invented fixtures gave
them the same date.

**A fabricated fixture is not a weak test — it is an INVERTED one.** It does not fail to check the
provider; it actively certifies that the code matches a fiction, and hands you a green tick for doing
it. All three are real recordings now.

**The rule adopted: a fixture that was not recorded must say so in its own FILENAME.** Gold's key does
not exist (P-5), so its success fixture is `xau_usd_UNVERIFIED.json`, and the only *real* gold
recording in the repo is `error_403.json` — the genuine unkeyed rejection, which pins the route and
the auth header. Two facts, which is two more than a beautiful invention pins.

### 2. The board shipped with the footprint disease it was written to cure — and only the PNG showed it

The Mood gauge was, briefly, the fifth card on the phone's money shelf. A shelf stretches every card
to the height of its tallest, and the gauge — a score, a position strip, two sentences that may never
be folded away, and a disclosure — is roughly **three times** the height of "6.72% · wk of Jul 9".

So the four stat cards were each padded with about **200 pixels of white space**, and the phone Desk
grew 347px in order to show four short facts and a lot of nothing. Every test passed. The DOM was
correct. The numbers were right.

The category error underneath it: **F5's own triage says GLANCE stations get bounded and READ stations
stay vertical.** The four stats are glances. The gauge is something you read. It was never shelf
material. It is full-width below the stats now.

The same photograph showed a second one: **a falling mortgage rate rendered in red**, with a down
triangle and a red wash. On a tape, red-down is a fact with no opinion in it. On the price of housing
money it is an opinion, and the wrong one — a falling mortgage rate is the best news on this board, and
the app was colouring it as a loss. Household-cost deltas render in ink now; gold keeps its direction
colour, because gold IS a market price.

**That is five real bugs this build has found by opening a PNG and looking at it, and by no other
means.** Keep doing it.

### 3. A staleness rule must count in the unit its SOURCE publishes in

The board's amber "stale" rule is "older than three cadences". Implemented in calendar days, the gold
cell would go amber **every Monday** — Friday's price is three days old and **zero sessions** old,
because the market was shut and there is no newer price to have. A lamp that cries wolf every Monday
is not there on the morning it is finally right.

But the opposite unit is equally wrong one cell to the right: **Nepal Rastra Bank publishes every
calendar day, weekends included**, so for the rupee a weekend genuinely IS three missed publications,
and counting sessions would hide a real outage.

Same ladder, different clocks, because the sources keep different clocks. N2's "count in sessions,
never days" turns out to be half of a bigger rule. The session counter that `freshness.ts` kept
privately is now shared (`market-hours.sessionsBetween`) — two copies of "what counts as old" is one
copy too many.

---

## What N3 landed (tag `nc-3`)

- **Four fetchers, all verified live before a line of adapter code was written.** NRB and
  open.er-api answered from this laptop (no key); FRED's seven series + three histories were recorded
  in CI; GoldAPI answered **HTTP 403 "No API Key provided"** — which is what P-5 being absent actually
  looks like, and is now a recorded fixture.
- **The cadence rule: a source is CHECKED nightly but only WRITES when its own observation advances.**
  A Thursday mortgage rate stamped with Tuesday's date is a false freshness claim — the same species of
  lie as an ETF's price wearing an index's name. A revision (same date, changed value) also writes,
  because agencies restate their prints and a date-only rule would disagree with its own source forever.
- **The Mood gauge.** Five components, each a percentile of its OWN trailing year, two of them inverted
  (a high VIX and a wide credit spread are both FEAR). Unweighted mean — a weight is an opinion, and an
  opinion is what this number is trying not to have. Under three components it suppresses itself and
  NAMES what is missing. **Computed by the full nightly and by nothing else:** two of its inputs need a
  run that actually ingested the market, and the 6am refresh does not. A run that did not look at the
  market does not get to say how the market feels.
- **Ruling C8 lives in the TYPE.** `MoodGauge`'s `components` prop is a required NON-EMPTY tuple, so a
  score without its breakdown does not compile — plus a runtime throw for the boundary the type cannot
  see. The app enforces the three-component floor itself rather than trusting the pipeline to have been
  careful.
- **The C7 ladder**, with only ONE loud rung. A stale cell goes amber and says the word. "not yet
  reported" (an unprovisioned key) and "source unreachable tonight" (one failed fetch) stay quiet — an
  app that shouts about a missing API key has nothing left to say on the night its numbers are wrong.
- **CPI is fetched with `units=pc1`** — the year-over-year computed BY FRED. The test asserts the
  parameter is on the WIRE: if it ever dropped, FRED would answer with the raw index level (~320) and
  the board would print "Inflation (CPI YoY) 320.5%" through a path where every value assertion passed.

**`nc-3` is tagged and its CI is GREEN — all three jobs, including the pixel oracle (318 e2e passed,
all 55 VRT baselines matched).**

**Counts at nc-3:** 506 app tests · 296 pytest local / **321 in CI** (the DB tests only run there) ·
**318 e2e** · 19 drift rules · 55 VRT baselines · B1 10/11 cached · B4 worst 193.3KB under the ceiling.

**Evidence:** `docs/nc-evidence/n3-board.md` — every source, what it really returned, and the ladder.

---

## Two amendments to the plan, both logged, both in the honesty rule's favour

The plan is rank-2; the honesty rules outrank it, and both of these were caught by existing tests
within a minute of the change.

1. **Appendix B's shelf strings broke ruling M8.** "Markets — swipe" and "Money & mood — swipe" state
   no count, and a shelf that hides an unstated number of things can hide anything. The count stays,
   and it is COUNTED rather than typed.
2. **`copy.window` gains `vsPriorWeek`.** The mortgage cell states its change against last week's
   SURVEY, and no existing token said that truthfully — "5D" would have implied five trading days of
   quotes where Freddie Mac publishes one weekly number.

---

## Resumable state — start here

- **Done:** N0 (`nc-0`), N1 (`nc-1`), N2 (`nc-2`), N3 (`nc-3`).
- **Next: N4 — the news data layer** (plan Part 7.3–7.6, plus 7.9's pipeline half). Adapter field
  extensions (fixture-first), ingest budgets, `cluster.py`, `rank.py`, the Stage-A cap + write-back,
  Stage B-mini, the image pipeline (Pillow, the L1–L4 ladder, R2 PUT), the schema migrations
  (news_item columns, news_cluster, catalyst_link, news_image), and `ANTHROPIC_API_KEY` into both
  workflow env blocks (P-3).
- **N4 inherits a working fixture recorder.** `.github/workflows/record-fixtures.yml` is checked in
  and dispatchable (`gh workflow run record-fixtures.yml`), with recorder scripts for FRED, NRB,
  er-api and GoldAPI. N4 needs the same flow for Marketaux/Finnhub's extended fields. **Record, do not
  invent** — see the first lesson above.
- **Provisioning still open (none block):** P-1 (R2 media bucket) and P-3 (ANTHROPIC_API_KEY into the
  workflow env) are N4's; P-2 (GitHub PAT) is N6's; **P-5 (GoldAPI key) is asked for in QUESTIONS and
  is a two-minute job** — the gold cell fills itself in on the next nightly the moment the secret exists.
- **Open for the user:** Part 0.1 — where the News room lives. N5 builds the plan's default (a sixth
  tab) unless a DECISIONS line says otherwise; it stays a one-file flip.

## Standing hazards for the next session

- **OPEN THE PNG AND LOOK AT IT.** Five real bugs, found this way and by no other means. When a
  re-baseline surprises you — by changing more than you expected, or less — that is a finding.
- **A byte-changed baseline is not necessarily a pixel-changed one.** N3's re-baseline showed 14
  modified PNGs; 5 of them (ticker, track-record) were **pixel-identical** and differed only in PNG
  encoding. Measure before you believe. (`pixelmatch` + `pngjs`, installed with `--no-save`.)
- **There is no local Postgres on this Mac**, and there will not be. CI's container is the DB oracle —
  and it is DISPOSABLE, so it can say nothing about production's. `npm run check:migrations` is the
  instrument that can.
- **VRT baselines are born in CI** — `gh workflow run ci.yml -f job=vrt-baselines`, download, commit.
- **The VRT clock is pinned** to the seed's session (`SEEDED_SESSION` in `vrt.spec.ts`). The macro
  board grades against the RUN's date rather than the browser clock, so it does not rot the pin.
- **`npm run e2e:local` runs against PRODUCTION data**, unseeded — so the board is ABSENT there and the
  seeded journeys skip. Run it anyway; it is what caught N2's a11y regression. But do not read its
  green as coverage of anything seed-dependent.

---


# THE APP FEEL PLAN IS DONE (2026-07-12) — tagged `feel-final`, CI green on the tag.

F0 through F7, all eight phases, unattended. Nothing is blocked. Read this section and then, if you
want the numbers, `docs/feel-evidence/BUDGETS.md` — every claim below has a measured record behind it.

## What actually changed, in one line

**The app used to rebuild the page you were leaving before it would show you the one you asked for.**
Eight of the ten rooms re-rendered on the server on every single tap. Now they are served from a
cache. A tab tap on the phone went from **824–1342ms of frozen screen to 130–280ms**, and the Desk's
own server answer went from 382ms to 48ms.

That is the whole plan in a sentence, and it is the one thing you will feel in the first ten seconds.

## The budgets you set, and where they landed

| | Budget | Before | Now |
|---|---|---|---|
| B1 | Rooms served from a cache | 2 of 10 | **10 of 11** (settings is a writer — see below) |
| B2 | Production server answer (warm median) | 382–1237ms | **48–133ms** (ceiling 150) |
| B3 | Phone: tap → the room is there | Scans **1342ms** | Scans **280ms** |
| B4 | First-load JavaScript, `/ticker` | 193KB | **145KB** |
| B5 | Layout shift | 0.000 | **0.000**, both regimes |
| B6 | Lighthouse | perf 93 · a11y 93 | perf **86** · a11y **100**, contrast gate fully on |

**B6's performance score fell seven points on purpose, and you should know why.** The app now
prefetches the five tab rooms while the browser is idle — that is precisely the mechanism that took a
tab tap from 1342ms to 280ms. Lighthouse measures one cold load and counts the bandwidth spent on
your NEXT screen against your current one. Both hard budgets still pass (layout shift 0.000,
first-load JS 165KB against a 200KB ceiling). It is one line to reverse and the cost of reversing it
is written down: `docs/feel-evidence/lighthouse-tradeoff.md`. Flagged [FYI] in QUESTIONS.

## The three real bugs the gates found (all were already in production)

1. **Changing your theme once would have deleted every scan table in the app.** A theme switch
   revalidated at layout scope, which drops the known-parameter set of the scans route — so every
   `/scans/<preset>` URL would 404 until the next deploy. Live since P6. Found because a VRT baseline
   came back as a photograph of the 404 page. Drift rule 17 now forbids it.
2. **Every write on the Desk hung its own response.** The journal, the setup-card checkboxes: the row
   landed in the database and the button said "Saving…" forever. Live since 2026-07-11. It survived
   six phases because the test asserted a marker that renders on the form's *initial* state — a guard
   that could not fail. Now fixed with `after()`, and the test asserts the textarea actually cleared.
3. **Accessibility, 93 → 100, and the contrast floor is now closed.** A link nested inside a button
   (unreachable by keyboard), a scroll region no keyboard could reach, the TradingView attribution
   link sealed inside the chart's `role="img"` box, and `text-faint` carrying real information at
   2.08:1 where AA wants 4.5:1. All fixed; drift rule 18 stops the colour one coming back.

## The contrast fix you approved — done, and it corrected two of my own claims

You approved darkening the muted grey. Doing it properly meant measuring it properly, and the
measurement showed I had been wrong twice.

- **The palette is `#676577` in Morning (was #6e6c80) and `#9c99b1` in Midnight (was #918ea6).** Both
  now clear 4.5:1 against **the lightest card the grey ever sits on** — 4.99:1 and 5.10:1. The change
  is so slight the visual-regression suite cannot even see it: not one of the 46 baselines moved,
  because the shift is below the pixel oracle's own threshold. Axe can measure it; your eye will
  read it; the screenshots can't tell. That is exactly the price you said you were happy to pay.
- **The "58 failing nodes" I reported was my own test lying to me.** Every page here fades in, and axe
  composites a text colour through any ancestor's transparency — so it was measuring the page *while
  it was still arriving* and reporting the colours of a half-transparent screen. Wait for the fade and
  58 collapse to **one** real finding. The gate has a `settle()` helper now, and the lesson
  generalises: never measure a colour, a size or a position while the page is still animating.
- **I told you Midnight didn't need the fix. It did.** Its grey cleared 5.00:1 on the standard card —
  measured by a survey I ran on the desktop project only. The phone Desk's shelf cards are *raised*,
  and there the same grey measured 4.44:1. I measured half the app and called all of it clean. CI
  caught it. The gate runs both themes and both device sizes now, which is what would have caught me.
- **The gate holds the full line: nothing is excluded, 42 checks, green.**

**One thing fell out of it.** The extra measurement made a latent bug reproducible: add a name to your
watchlist, click Focus, and the row could *vanish* — the page you got back was the cached copy from
before your click. The rule: **a page may be cached, or it may be written to and read back in the same
click — not both.** Settings is the only room that is a writer rather than a reader, so it renders on
request now. B1 reads **10 of 11 cached** instead of "all of them", with `/settings` in the allowlist
and its reason written down. That is the honest number, and the guard still fails the build for any
other route that reaches for the same flag.

## What is waiting for you (nothing is blocked on it)

- **The iOS device pass is yours to run, and I have left the gate open.** There is no iPhone here. The
  rules a machine can check (44px targets, 16px inputs, no sideways scroll, no manufactured motion,
  and now the full axe sweep in both themes and both device sizes) are checked on every push. What
  remains is the ten minutes only a real device can do — VoiceOver, the notch, Safari's URL bar, real
  thumbs. The checklist is in QUESTIONS-FOR-BISHANT.md. **Pending your verification, not mine — I
  have not marked it passed.**
- **The two PDFs are not re-rendered.** The markdown plans carry the Part 9 amendments
  (DEVELOPMENT-PLAN §4.5 and §3.8, the route map, the commands); `docs/*.pdf` still show the old text.

## State of the build

Tests: **384 unit · 214 pytest · e2e + VRT + PWA green on the `feel-final` tag · 18 drift rules ·
font budget.** Evidence: `docs/feel-evidence/` (BUDGETS, routes, nav, nav-timing, bundles, prefetch
experiment, the Lighthouse trade, accessibility, desk height). Docs sync: done — DEVELOPMENT-PLAN,
CLAUDE.md, the `new-surface` skill, and the redesign plan's cross-reference all agree with the code.

---

**F6 COMPLETE (2026-07-12) — tagged `feel-6`, CI green on the tag.**
Next: F7, the last phase — hardening, the evidence tables, and the docs sync. Nothing is blocked.

**Track record** is the page that keeps the whole product honest, so the two things that matter there
are enforced by the table itself now: the filter **defaults to ALL**, and a seeded miss is on the
first page with nobody touching a control (a default of "hits" would be a product grading its own
homework), and the outcome rides line 1 of the phone card-row — never below the fold of its own row.
If a reader has to scroll to find out whether the app was wrong, the app has hidden being wrong.

It also killed **the app's last sideways-scrolling table**. A six-column grid peeked through a 390px
keyhole was the phone experience there. Drift rule 16 has unlisted the page: there is one table in
this app now, and the rule is closed.

**Academy** goes two-up from 1024px and each module states its position as a COUNT — "2 of 4 read".
Never a progress bar or a ring: a half-full ring is a nudge to finish, and this is a reading room.

**Settings** became the three cards it always was.

Tests at F6 exit: **384 unit · 214 pytest · e2e + VRT + PWA green on the `feel-6` tag · 17 drift rules.**

---


**F5 COMPLETE (2026-07-12) — tagged `feel-5`, CI green on the tag.**
Next: F6, the remaining rooms (track record, academy, settings). Nothing is blocked.

**The phone Desk is 14% shorter — 5,041px to 4,319px — and nothing was removed.** The plan estimated
~50%, and the honest number is 14%. It is recorded with its reason
(docs/feel-evidence/desk-height.md) rather than restated as a target:

What folded is real — five mover rows, two watchlist rows, the journal textarea, the per-provider
source list. What could NOT fold is what actually makes the page tall: **the daily brief**, which the
plan explicitly refuses to truncate ("a briefing behind a 'read more' is a briefing unread"), and the
setup cards, which have been modular since P4. The calendar did not fold at all on the seeded morning
(six routine rows, and the cut allows six). And the source list is FORCED open, because the seeded
run has a degraded provider — which is ruling M2 working, costing height on exactly the nights it
should. The remaining height is the brief, which is the thing you came for.

**The stations were triaged BEFORE their containers were chosen, and the triage is the principle.**
READ stations (the brief, the movers) stay vertical, because swiping is skimming and those exist to
be read. GLANCE stations get bounded:

- **The macro figures are the app's one shelf**, on phones. The reader pushes it; it never pushes
  itself. The order is reasoned, not traced: the hero above already states the equity tape, so the
  figures that merely echo it (Nasdaq, Dow, the small-cap proxy) take the tail, and the two carrying
  INDEPENDENT information — VIX and the 10-year — ride first. **Breadth stays fixed below it**: the
  one line that claims to describe the whole market must not be reachable only by swiping.
- **The calendar's cut is on TIME, and every high-importance row is always visible.** A CPI print or
  an FOMC decision is never behind a fold, at any width. The seed plants two of them below the
  routine cut precisely so a test can prove it.
- **A degraded source cannot be folded away.** The component enforces this itself rather than
  trusting its caller: the per-provider rows fold behind a summary ONLY when every provider is ok.
  A summary reading "6 sources · all reporting" with its own refutation folded underneath is exactly
  the lie ruling M2 exists to forbid.
- **The journal folds behind one labelled tap, and the summary row IS the prompt** — so it is not
  chrome hiding a form, it is the question, asked once. Its count keeps it honest.
- **Module 07 was a paragraph of prose pointing at another page** — which is the opposite of a
  glance: a station you must READ to learn a number you could have been shown. It is a count and a
  doorway now. (It first shipped at hero scale, wrapping to three lines of 32px numerals and
  competing with the S&P for the eye. The Desk gets exactly ONE hero figure. Fixed.)
- The **fired-signal forcing rule is built and DORMANT**: a watchlist row with an unresolved signal
  forces itself into view past the focus cap. Its producer has never existed — the redesign specced
  the marker and nothing sets it — so the branch is unreachable today. It is built now so that the
  day the marker lands, hiding it is already impossible. **This is not dead code; it is a latch.**

**The spread now engages at 1024px, not 1366px.** Most laptop windows sharing a screen were getting
the phone column with wider margins, and the arithmetic says they did not have to. The 768–1023 band
(exactly iPad portrait) keeps the ritual column and caps it at a 720px measure — a 990px-wide card is
a stretched receipt, which is the disease this plan opened with, one band down.

Tests at F5 exit: **384 unit · 214 pytest · e2e + VRT + PWA green on the `feel-5` tag · 17 drift rules.**

---


**F4 COMPLETE (2026-07-12) — tagged `feel-4`, CI green on the tag.**
Next: F5, the Desk. Nothing is blocked.

**Read this bit first, because it is the most important thing F4 found.**

**Your journal was saving your entry and then telling you it was still saving. Forever.** The row
landed in the database correctly; the button sat on "Saving…", the form never cleared, and the honest
conclusion for anyone using it would be "that didn't work" — and to write the entry again. The same
was true of the setup cards' weakener checkboxes. Every write on the Desk. **Since 2026-07-11, when
the Desk became a cached route — six phases ago.**

The cause: calling `revalidatePath("/")` inside a server action that was invoked FROM "/" deadlocks
that action's own reply. It invalidates the very page whose fresh render it is trying to send back as
its response. Both Desk writes now do their cache invalidation inside `after()` — the framework's own
primitive for work that must happen once the response is finished. You get your reply immediately;
the cache is busted a moment later, for whoever comes next.

**It survived six phases because the test that was supposed to catch it could not fail.** It waited
for a "Saved." marker — which renders whenever `useActionState`'s state is ok, and the INITIAL state
is ok. "Saved." was on the page from the moment it loaded, before anything had been written. The test
passed whether or not the save worked. It asserts the textarea CLEARED now, which cannot be true
until the write has actually come back.

That is the third guard-that-could-not-fail this build has turned up (the fonts-blocked screenshot
that tested nothing, the TTFB probe that scored a 404 as a fast page, and this). The pattern is
always the same: **the assertion is already true in the state the page starts in, so it never
observes the transition it was written to observe.**

**What F4 actually built.** The paper ticket was five fields in a wrapping row, every one typed by
hand — including a symbol with no autocomplete, while the Instrument table sat there holding a name
for every ticker in the universe. It is a ticket now: one column, a symbol field that suggests real
instruments, a quantity stepper with presets, and a tap-to-fill last-close chip that carries its
DATE (the disclaimer covers liveness, the date covers age — two different lies to prevent).

- **Side has no default (M9).** Every other field keeps one, because every other field is a
  parameter. Side is the decision, and the old form quietly pre-selected "buy" on the one surface
  whose entire design exists to slow that decision down. The old cooling-off e2e had to be updated to
  pick a side before submitting — which is the rule working: that test used to pass by relying on the
  nudge M9 removed.
- **The cooling-off pause finally has a producer.** It has been built, tested and completely
  unreachable since P6 — nothing in the product ever constructed the URL that arms it, only the e2e
  did. The setup card's "Practice on paper →" link (ruling M10) is its first real one. The timestamp
  is stamped ON CLICK, in your browser: interpolating it on the server would have recorded the moment
  the page was GENERATED, which on a cached Desk can be ten minutes before you ever saw the card.
- The ledger is two tables; the closed book folds behind a disclosure that states its own count; and
  realized P&L renders as a chip with the WORD in it — a loss reads as a loss without relying on hue.
- The format sweep landed with drift rule 12: the whole paper surface had been calling `.toFixed()`
  directly, which is how a loss ends up with a hyphen instead of a true minus.

Rule 14 was tightened while here and immediately caught **two more raw anchors** — the setup card's
and the brief's "Learn →" doorways — both doing a full document reload on the app's most important
path into the Academy since P5.

Tests at F4 exit: **376 unit · 214 pytest · e2e + VRT + PWA green on the `feel-4` tag · 17 drift rules.**

---


**F3 COMPLETE (2026-07-12) — tagged `feel-3`, CI green on the tag.**
Next: F4, paper. Nothing is blocked.

**The dead end is gone.** /scans printed each preset's matches as a wall of bare ticker chips, capped
at 24, ending in "+ N more" — which was a plain `<li>`: not a link, not a button, not anything. On
the first live pipeline night, 1,825 matches sat behind it, unreachable from the page whose whole job
is to show them. You could see that 141 names had matched and had no way to find out which.

Every match is reachable now. The e2e that pages to the end of the table and finds the last seeded
symbol is that dead end's grave.

- **The index** keeps its recipes (all clauses, always — the five presets differ by recipe, count and
  grade and by nothing else, so the recipes ARE the comparison content). The chip wall becomes a
  three-row preview that states its own cut: "First 3 of 32 by scan order". The cards stay in the
  fixed preset order and are never sorted by match count — a busy scan is not a better scan.
- **The table** (`/scans/[preset]`, new) answers "why did this match?" with columns that restate each
  preset's own criteria. That cost NO pipeline change: a 34-key metrics snapshot has been sitting on
  every match row since P4 and the page was reading two of them. The **lottery-risk flag** — which
  the pipeline has been setting since P4 and nothing has ever rendered — finally appears on screen.
- Above a 500-row cap, sorting is DISABLED and the page says why: sorting a silent subset would
  present "the biggest movers among the most salient" as "the biggest movers".

**The important thing that happened in F3 was not the table. It was the bug the gates caught.**

The route shipped with `dynamicParams = false` — the obvious way to declare a closed set of five.
Any `revalidatePath(path, "layout")` call **wipes that route's known-parameters list, and every URL
in the family then 404s permanently, until the next deploy.** The theme action had called it since
P6; the watchlist action since F1. **The first time you changed your theme, every scan table in the
app would have vanished.**

CI caught it as a visual-regression baseline that came back as a *photograph of the 404 page*. I
reproduced it locally in two commands (request → 200; layout-revalidate; request → 404), and the fix
removes the pattern rather than working around it: the theme now revalidates nothing (it has not
needed to since F1 — it applies client-side), the watchlist names the five rooms it changes, and
drift rule 17 fails the build if a layout-scoped revalidation ever reappears.

**Two diagnostics were repaired on the way, both broken for six phases:**
1. The VRT diff images have **never once been uploaded**. ci.yml pointed at `playwright-report/`,
   which CI never writes (it runs the `github` reporter, not `html`), so every pixel failure uploaded
   an empty artifact — the one thing a VRT failure owes you was the one thing you could not get. It
   uploads `test-results/` now, and the very first failure after the change produced the screenshot
   that identified the bug above in a single look.
2. The pixel oracle could photograph a **loading skeleton**. It refuses to now.

Two live defects fixed while here: the rail's bottom sheet had no safe-area inset (its "Open full
view →" sat in the iPhone home-indicator band, where a tap is a swipe-to-home), and /ticker's "← Back
to Desk" was 20px tall — the one control that promises the reader they can get back, under-sized for
six phases, unnoticed only because /ticker was never in the touch sweep's route list.

Tests at F3 exit: **376 unit · 214 pytest · e2e + VRT + PWA green on the `feel-3` tag · 16 drift rules.**

---


**F2 COMPLETE (2026-07-12) — tagged `feel-2`, CI green on the tag.**
Next: F3, scans — the first room to consume the kit. Nothing is blocked.

F2 built the six primitives and consumed none of them: the only pixels that moved in the whole app
are the four styleguide baselines, which is exactly what "build the kit, then build the rooms" is
supposed to look like. Each piece carries a ruling, and each ruling is held by a test rather than by
anyone's memory:

- **lib/table.ts** — sort and paginate. Two of its rules are honesty rules wearing an algorithm's
  clothes: **null sorts last in both directions** (the pipeline coerces a NaN to null rather than to
  zero, and a comparator that treats null as 0 undoes that in one line, floating every unknown to
  the top of an ascending sort dressed as the day's smallest value), and **the sort is stable**, so
  tied rows keep the pipeline's own rank — the order the UI calls "scan order" and never "top".
- **DataTable** — the table the app has needed since /scans started printing a chip wall with a dead
  "+123 more". It is P2-bearing by construction: its delta cells are money, so no ancestor may
  animate them, so the file contains no transitions at all.
- **Disclosure** — ruling M2 in code. The count is required BY TYPE, so an uncounted disclosure does
  not compile, and `forceOpen` renders no toggle at all: not a disclosure that happens to be open,
  but a thing that cannot be closed. That is what a degraded source line needs.
- **Shelf**, **Skeleton**, and the **form kit** (whose Side control has no default — ruling M9).

**Two bugs the tests caught before a reader could, and both are worth knowing:**
1. The Stepper clamped on every keystroke, so clearing the quantity field instantly refilled it with
   the minimum — typing "42" into an emptied box gave you "142". Unusable, and invisible until
   someone typed.
2. The Disclosure's fade reused `.route-fade`, which is EXEMPT by name from the P2 ancestor walk
   (it is the page-level opacity fade, which moves nothing relative to anything else). A subtree
   fade over a base rate animates a probability *arriving* — the exact thing the stillness rule
   forbids. It would have inherited an exemption it had not earned and passed the guard in silence.
   The negative control caught it. That is what negative controls are for.

**One architectural fact, learned from the build:** a table Column's accessor is a function, and
functions cannot cross the server-to-client boundary. So column sets live in client modules and the
server passes only rows. Every table consumer from F3 on follows that shape.

Tests at F2 exit: **368 unit · 214 pytest · e2e + VRT + PWA green on the `feel-2` tag · 15 drift rules.**

---


**F1 COMPLETE (2026-07-12) — tagged `feel-1`, CI green on the tag. The app is fast now.**
Next: F2, the kit (Disclosure, Shelf, DataTable, the form controls). Nothing is blocked.

**What the reader will feel tonight.** Tap a tab, and the room is there. Measured the same way
before and after, on the phone project against the seeded database:

| Tap | Before | After |
|---|---|---|
| Desk → Scans | 1342 ms | **204 ms** |
| Desk → Paper | 824 ms | **151 ms** |
| Desk → Track record | 825 ms | **126 ms** |
| Desk → Academy | 827 ms | **141 ms** |

And against the real production deployment, authenticated (budget B2, warm median):

| Route | Before | After |
|---|---|---|
| `/ticker/SPY` | 1127 ms | **58 ms** |
| `/scans` | 851 ms | **52 ms** |
| `/paper` | 698 ms | **65 ms** |
| `/settings` | 517 ms | **48 ms** |

Every product route now answers in 48–77 ms against a 150 ms budget. Ten of ten are served from a
cache, with an empty allowlist. The server's own response time on the Desk is **12 ms**.

**What actually changed.** Eight force-dynamic routes became ISR; the ticker's four sequential
cross-region queries became one parallel stage; the chart library is code-split (`/ticker` first-load
JS 193 → 143 KB); every room got a skeleton so a tapped page shows its bones instead of freezing on
the page you are leaving; and the revalidation wiring was extended to every cached path.

**Two freshness holes were closed WITH the conversion, not discovered after it.** Both were invisible
before, because a page that re-renders on every request cannot be stale: filing a forecast refreshed
the Desk but not `/track-record`, which is the page that shows open forecasts; and the lesson
read-beacon told nobody at all, so finishing a lesson left the Academy still showing it unread.

**One thing to know before you look at Lighthouse.** The advisory performance score on the Desk moved
93 → 87, and I measured why rather than shrugging: the Desk's own JavaScript did not grow (179.6 →
179.7 KB), the server answers in 12 ms, and the main thread blocks for 20 ms. The score drops because
the app now prefetches the five tab rooms while the browser is idle — which IS the thing that made
every tap instant. The lab test measures one cold load and counts bandwidth spent on your next screen
against your current one. Both HARD budgets still pass (layout shift 0.000, first-load JS 157 KB of a
200 KB budget). Full numbers: docs/feel-evidence/lighthouse-tradeoff.md. Flagged [FYI] in QUESTIONS —
reversible in one line if you disagree, at the cost of slow navigation.

**Three existing tests changed, each because F1 exposed them as weaker than they looked** — worth
knowing, because none of them were "adjusted to make the build pass":
- The touch sweep waited on `networkidle`, which now never arrives (static routes prefetch as the
  browser idles, so the network keeps trickling). It waits on fonts instead — which is what it
  actually depended on, since a button measured mid-font-swap is measured at the wrong width.
- `theme.spec` used the toggle's pressed state as proof the cookie write had landed. That was fair
  when the toggle was a server component and could not look pressed before the server re-rendered
  it. It is a client component now and marks itself pressed on click, so the test waits on the
  cookie — the write itself, not a proxy for it.
- `nav-timing` is gated to seeded databases. Against production Supabase it was timing a
  cross-country round trip over 1,825 live scan rows instead of this app's navigation.

Budgets B1–B5 are ARMED. B1 (routes) and B4 (bundles) now run in CI on every push.

Tests at F1 exit: **308 unit · 214 pytest · e2e + VRT + PWA green on the `feel-1` tag.**

---


**F0 COMPLETE (2026-07-12) — tagged `feel-0`, CI green on the tag.**
Next: F1, the speed layer. Nothing is blocked.

F0 built the instruments and measured the disease; it deliberately cured nothing. What it proved:

- **The CI wiring works.** `feel-*` tags triggered NO workflow at all before this — every gate the
  plan promises would have been a claim nobody checked. The `feel-0` tag ran the full e2e + VRT +
  PWA job on Linux and came back green.
- **The diagnosis reproduces, from checked-in scripts.** `/` answers in 51ms; `/ticker/SPY` takes
  1127ms. 2 of 10 product routes are served from a cache; the other eight re-render on every tap.
  What the reader actually feels (tap → content): Scans 1342ms, Paper 824ms, Track 825ms, Academy
  827ms. Tables in `docs/feel-evidence/`.
- **The prefetch question is settled by measurement, not by reading.** The pinned framework's docs
  claim both answers in two tables and never reconcile them. Real probe routes + real prefetch
  headers say: BRANCH A — a `loading.tsx` does NOT downgrade an ISR route's prefetch. So F1 gets
  skeletons everywhere, with no trade-off to manage.
- **The seed has teeth and is deterministic.** 52 scan matches (one preset deliberately EMPTY, so
  the "0 matches — that is information" state is actually tested), six paper trades whose fills are
  priced by `lib/paper.ts` itself. Two independent CI runs produced 39 of 40 byte-identical
  screenshots; the fortieth is explained below.

**Three things I found by not trusting my own instruments** — each was a guard that could not fail,
which is worse than no guard, because it also hands you a reassuring green tick:

1. The TTFB budget passed `/scans/unusual-volume` at 46ms. It is a **404** — the route does not
   exist until F3. A missing page is the fastest page there is. The gate now requires that something
   was actually served before it will call speed a success.
2. The navigation-timing test reported Scans as the app's **fastest** room (14ms) when it is its
   **slowest** (1342ms). Playwright matches accessible names by substring, so the heading "Scans"
   was matching the Desk's own "07 — Sectors & scans" masthead, which is on screen *before* the tap:
   it was timing nothing. Every sample now proves the destination is absent before tapping.
3. The pixel oracle was shooting pages **before their fonts arrived**. A regenerated track-record
   baseline came back with its prose in a fallback sans, visibly re-wrapped, while its own dark twin
   from the same run was correct. `await document.fonts.ready` is not enough — it settles against
   the fonts pending *when it is called*, so it can resolve instantly against an empty set. Fixed in
   `shoot()`; that is the fortieth screenshot above, and it is why F0 regenerated its baselines
   twice. Committing it would have made every VRT gate from F2 to F7 a picture of a bug.

**Known limitation, settled and not worth re-litigating:** there is no way to run Postgres on this
Mac (no brew bottle for macOS 26.3, its source build fails, the prebuilt binaries need a libz that
lives only inside the dyld shared cache, and Docker's daemon can't be started headlessly — the same
wall as 2026-07-11). **CI's Postgres service container is the database oracle.** The seed is
verified by 12 DB-free unit tests that lock its promises (negative-controlled: nudging SMCI's return
by 0.006 turns them red) plus the real `migrate deploy && db:seed` that CI runs on every tag. Do not
spend another session trying to install Postgres here.

**Budgets are all in REPORT mode** and arm as hard gates in F1 — a budget armed before the cure
exists is a red gate you learn to walk past.

Tests at F0 exit: **303 unit · 214 pytest (19 skipped) · e2e + VRT + PWA green on the `feel-0` tag.**

---


**APP FEEL PLAN AUTHORED (2026-07-12) — APP-FEEL-PLAN.md at the repo root, typeset at
docs/App-Feel-Plan.pdf. The build has NOT started; this session was commissioned to plan,
not to write app code. Next session: session ritual, then F0.**

The plan answers the four commissioned problems with measurements, not impressions:
- **The receipt problem.** Every route below 1366px is one vertical column; the app has
  zero pagination and three collapsibles total. The plan gives every room a glance layer
  with depth one tap away (Part 4), a small kit of primitives to do it with (Part 3 —
  Disclosure, Shelf, DataTable, form controls, Skeleton), and ten new honesty rulings
  (M1–M10) so none of it can lie.
- **Scans.** The "+123 more" that isn't clickable becomes a real data table: /scans turns
  into a summary index, each preset gets /scans/[preset] with the full match set —
  sortable, paginated, every match reachable, per-preset "why it matched" columns straight
  from the 34 metric keys the database already stores per match (no pipeline change).
- **Paper.** The five type-everything fields become a ticket: symbol autocomplete from the
  instrument table, segmented side control with NO default (a deliberate M9 ruling, [VETO?]
  logged), bucket segments, a quantity stepper with presets, a dated tap-to-fill last-close
  chip. Cost mirror, cooling-off, and half-Kelly survive untouched — and the cooling-off
  finally gets a real producer (the setup-card "Practice on paper →" doorway, ruling M10,
  [VETO?] logged), because today nothing in the product constructs its URL.
- **Speed, measured.** Production probes: cached routes answer in 51–67ms; the eight
  force-dynamic rooms answer in 382–1237ms with a frozen screen (zero loading.tsx, no
  prefetch for dynamic routes — the framework's own docs state both). The fix extends the
  Desk's proven ISR + on-demand revalidation to every read route, adds skeletons and two
  streaming islands, parallelizes the ticker's four sequential queries, code-splits the
  chart, and wires the revalidate route to every cached path. Budgets B1–B6 are testable
  gates with named instruments; baselines are in the plan and get re-captured by checked-in
  scripts at F0.

**Decisions needed from the user: NONE** (plan Part 0 — the honest version: seven near-miss
calls, each decided, logged, and vetoable; three carry [VETO?] flags in QUESTIONS).

**The plan was adversarially reviewed before delivery** (five lenses, 57 findings
integrated). The three that would have stopped the build cold, all fixed in the text:
runtime ISR on /ticker/[symbol] requires an EMPTY generateStaticParams (the pinned Next
docs are explicit; the first draft omitted it and the flagship budget would have failed
forever); `feel-*` tags trigger NO CI workflow until ci.yml is amended (now F0's first
step); and the DB-less CI app job breaks on prerendering loaders unless they follow the
house catch-and-degrade pattern (named file:line list in P-1).

**Phases:** F0 instruments/baselines/seeds/CI-wiring → F1 speed layer → F2 kit → F3 scans →
F4 paper → F5 desk → F6 remaining rooms → F7 hardening + docs sync (DEVELOPMENT-PLAN
§4.5/§3.8 amendments land there). Tags `feel-N`, gates in the plan Part 6, ~8–11 days at
R-phase pace.

---

**UI REDESIGN COMPLETE (2026-07-12) — R0 through R6 shipped, tagged `redesign-final`.**
The app is now "Morning Broadsheet": an editorial serif over mono numerals, one lavender
morning-light wash across both rooms, glass cards on the Desk and solid paper in the Academy, one
theme at a time (Morning or Midnight) governing every route. Every honesty rule in the plan's Part 2
ledger survived, and several got teeth they did not have before.

**The two content bugs are dead (R0), and they mattered more than any of the styling.**
- The Macro Pulse printed the SPY ETF's price under the label "S&P 500" — the Desk's hero numeral
  read ~755 while the index sat near 6,800. It now reads true index levels from FRED (SP500,
  NASDAQCOM, DJIA), and where no free index series exists (the Russell 2000) the slot shows an ETF
  and SAYS so, with a chip. A unit test locks the coupling: a slot may claim an index name ONLY when
  its number came from the index series. There is no third path.
- The Session Calendar ingested every FRED release in the window — Coinbase Cryptocurrencies,
  Commercial Paper, daily Treasury quotes. A seven-release allowlist now filters at the write path.
  On the recorded FRED window: 40 rows in, 3 real catalysts out.

**What the redesign added to the honesty layer, beyond keeping it:**
- The proportion bar and the dot array moved INSIDE BaseRate. They ARE base-rate displays, so the
  N-gate, the interval, the baseline and the WEAK cap now travel with them. The collapsed setup card
  carries `n=108` and nothing else numeric.
- The Range Ladder replaced the fan-cone that was never built. Discrete horizon rows on a
  signed-return axis, twenty countable quantile dots per row, no 50th-percentile mark of any kind,
  and nothing joining the rows. Two locks: the geometry function cannot RETURN a median or a
  connector, and a DOM test counts the elements.
- `data-p2` + a jsdom ancestor walk: probability visuals never move, and no ancestor may move them
  either. That rule was unenforceable before the redesign allowed general UI motion; it is enforced
  now, structurally, with a negative control proving the guard can fail.
- The vol_band table gained `n` and `window_days`. A range without its sample size is an assertion,
  so a band that lacks them does not render at all.

**Gate status at `redesign-final`: CI GREEN on the tag, all three jobs.**
- app — typecheck, lint, **291 unit tests**, build
- pipeline — **233 pytest** (the DB integration tests run here; 19 of them skip locally for want of
  a throwaway Postgres, which is why the tag gate is the only place the full suite is real)
- e2e + VRT + PWA — **173 passed**, including the 40 visual baselines, the touch-target sweep across
  every route, the iOS keyboard rule, the seeded-Desk honesty locks, and the PWA/offline assertions
- anti-drift 11/11 · Lighthouse on the deployed app: **performance 93, accessibility 100,
  CLS 0.000, first-load JS 128KB**

LCP 3.09s remains above its 2.5s target and remains ADVISORY (synthetic-4G lab artifact,
user-accepted 2026-07-11). It is the only budget not green, and QUESTIONS-FOR-BISHANT.md says what
it would cost to fix.

**The tag gate earned its keep.** It caught seven failures that no local run could have found,
because they all needed the seeded Postgres that only CI has: a watchlist row that had silently lost
its price in the restyle, a mover's source link that was a 15px touch target, and the setup cards'
14px checkboxes. Three of those were real product regressions, not stale assertions.

**One thing worth knowing before you touch performance:** the plan's fallback ladder (strip card
translucency, then the orbs) was NOT taken, and should not be. Measured: Total Blocking Time 20ms —
the glass costs nothing. The LCP was ten font files at 429KB. Cutting two font weights took
performance from 86 to 93 with the design intact. Measure before you cut.

---

**P4 COMPLETE — tagged `phase-4` (2026-07-11). CI-green on the tag: app (typecheck/lint/120 unit/
build), pipeline (190 pytest incl. the P4 DB tests), and the full e2e + PWA gate (journeys 1–4
against a seeded Postgres).** The signature unit ships honest-by-construction: the six pattern
detectors (shift-guarded), base rates with Wilson intervals + point-in-time buckets + the always-up
baseline + decay stamps, vol bands (≤20d), the nightly resolver (insert-only outcomes from the
Parquet lake), and the visible resolved log. UI: the one BaseRate renderer (N-gated: ≥100 %+CI ·
30-99 natural frequency + wide-interval note · <30 suppressed), setup cards (module 06 — tier
lexicon word neutral-by-law, WEAK-capped when the CI spans the baseline, weakener checklist via
server action, scope line, provenance), `/scans` (verbatim criteria + evidence grades + folklore
label), the VolBand typical-range panel (with the mandatory regime-break caveat), `/track-record`
(the app's own misses), and ScorecardPM grading now live off signal_resolution. Prisma v4 migrated.
Mints `new-pattern-detector`. Anti-drift §3.10 verified on the card UI (no hex, no colour chips
outside Tag, tier tag neutral).
- **Enhancements deferred (documented, NOT acceptance blockers):** CalendarTimeline branch base
  rates (needs earnings-reaction base rates — honest default is suppression), the on-chart vol fan
  overlay (the panel content is complete), full-universe base rates (served+watchlist is the logged
  P4 scope choice). Assumptions in QUESTIONS-FOR-BISHANT.md (regime split, universe scope, decay
  wording, breadth grade) — none blocking.

**P6 COMPLETE — tagged `phase-6` (2026-07-11). The phase-6 tag CI is GREEN: app (typecheck/lint/
190 unit/build), pipeline (pytest), and the full e2e + PWA + Lighthouse gate — including the new
paper cooling-off interstitial journey and the Dark-Desk-only journey.** The only outstanding P6
acceptance item is ≥30 resolved signals visible with misses, which is inherently time-gated (signals
resolve ten trading days after firing; the resolver and the public misses log are built and correct)
— a pending live-observation gate, in the same category as P3's five-night briefing week, not a
blocker. What shipped:
- **Paper desk (steps 1–2):** Prisma paper_trade + migration (paper-only, simulated fills, dev/test
  seed only). lib/paper.ts (simulateFill = next-open moved against the trader by half the at-open
  spread + 5bp slippage; halfKellyFraction — zero on non-positive edge, property-tested never above
  half-Kelly; costMirrorDrag = spread × turnover; frequency mirror). lib/ledger.ts (open/closed
  split, directional realized P&L, this-week round trips, cooling-off check — clock injected).
  /paper route (nav link): ledger with close forms, entry form with the half-Kelly sizing helper
  and the cooling-off interstitial (fires within 30 min of a viewed signal, via copy.coolingOff.body
  — a pause, never a block), the cost mirror (arithmetic spelled out), the frequency-mirror note
  above five round trips/week. Soft-gated on Academy M3. zod-validated action boundaries.
- **Forecast Brier + calibration (steps 3–4):** lib/brier.ts (brierScore 0.25=coin flip,
  rollingBrier, calibrationBuckets). Journal gains an optional forecast (call + 1–99% + resolves-on);
  resolveForecast scores it with Brier. Track record gains a "Your forecasts" section: rolling Brier,
  a CalibrationScatter (predicted vs actual against the diagonal, point size = N), open forecasts
  with hit/miss resolvers. Misses first-class, same public grading the app uses on itself.
- **Dark Desk (step 6):** the §3.3 dark column under [data-theme=dark] (explicit) and
  [data-theme=system] under prefers-color-scheme:dark; token overrides only; academy-bg untouched so
  the Academy stays light. Cookie-backed System/Light/Dark toggle in Settings; the shell stamps
  data-theme before paint. viewport.themeColor gains light/dark media variants (status bar follows
  the OS; manifest theme_color stays light). Anti-drift §3.10 greps clean (no stray hex, no bad radii).
- **⌘K command palette (step 5):** lib/palette.ts pure zone-badged index + prefix-ranked search;
  CommandPalette (⌘K, arrow/enter/escape, Desk/Academy badges) over the live index (routes + lessons
  + watchlist tickers).
- **e2e added:** paper cost mirror + sizing helper, the cooling-off interstitial firing, and
  Dark-Desk-only (Academy never darkens). Run on the phase-6 tag with a throwaway Postgres.
- **Prisma migrations this phase:** p6_paper_trade.
- **DEFERRED within P6 (documented, NOT acceptance blockers — plan §7 P6 acceptance does not gate on
  them):** quantile dotplots in the rail and sector small multiples (module 07) are step-5
  "should-widgets"; the calibration scatter, cost mirror, and ledger — the protective core — are
  complete. Logged in DECISIONS.
- **PENDING gates (time/CI-gated, per the standing autonomy directive — not blockers):** ≥30 resolved
  signals visible with misses needs live time (signals resolve ten trading days after firing; the
  resolver and the public misses log are built and correct). Lighthouse ≥90, the §5.5 PWA matrix, the
  §3.10 checklist on every screen, and the full §6.4 gate run on the phase-6 tag CI. Tag phase-6 once
  the tag CI is green; the ≥30-resolved criterion is met as horizons pass in production.

**P5 CODE-COMPLETE (2026-07-11) — the Academy. All six steps built; phase-5 tag CI is GREEN
(e2e + Lighthouse) — P5 COMPLETE and tagged.** Local gate green: app typecheck + lint + 157 unit + production
build (all routes compile, incl. /academy, /academy/glossary, /academy/[slug], /academy/review).
What shipped since the M0 checkpoint:
- **All 25 lessons authored** (M0 done earlier; the 21 M1–M6 lessons this session). Voice checked
  (no first person, no buy-imperatives, no exclamation marks), all frontmatter parses, no live
  prices (only the $25,000 PDT regulatory figure, which is a fact not a quote). Myth lessons cite
  their RR Part 4/5/6 verdict + evidence grade (golden cross WEAK, RSI WEAK, candlesticks
  WEAK/contested-negative, 52w-high MIXED, unusual volume MIXED, gaps FOLKLORE — the flagship
  worked example). Drafted by parallel module subagents against a fixed spec, then reviewed.
- **Glossary (step 3):** lib/glossary.ts seeds all 40 Appendix I terms (price-free, lesson
  doorways); GlossaryTerm (server, first-occurrence-per-view via a React cache()-scoped registry)
  + GlossaryPopover (client: dotted underline, hover tip, click popover, Full-lesson link). Wired
  into MacroPulse (breadth/advance-decline/50-day) and /scans (each preset's core term).
  /academy/glossary term index. Registry + 40-term-coverage + popover tests.
- **Worked-example drawer (step 4):** lib/worked-example.ts pure builder for the fixed three-step
  template (data → pattern+belief-with-grade → last N with the failure count shown), honest N<30
  suppression, numbered markers 1:1 to steps. WorkedExampleDrawer renders the steps beside a
  labelled SCHEMATIC path (not a live price) whose markers light in sync. Wired into every setup card.
- **Review queue (step 5):** lib/review.ts pure Leitner scheduler (5 boxes, doubling intervals,
  promote/reset, queue capped at 5/day, most-overdue-first). Prisma concept_state + migration.
  A concept enters when its glossary popover is first OPENED (a genuine encounter). /academy/review
  + ReviewSession (recall → reveal → knew/not-yet/skip, no streaks).
- **Doorways + M3 soft gate (step 6):** lib/academy-progress.ts (pattern modules M4/M5 gated until
  all four M3 lessons read — a nudge, never a lock). Prisma lesson_progress + migration. A read
  beacon marks a lesson complete on view; the curriculum map ticks read lessons and shows the
  "finish M3 first" marker; the lesson page shows the soft-gate notice. Return rail to the Desk
  already in the Academy layout. e2e added: no-live-prices-under-/academy, glossary index, review
  cap, soft gate.
- **Two Prisma migrations applied to Supabase this session:** p5_concept_state, p5_lesson_progress.
- **Pending for the phase-5 tag:** the CI e2e (journeys 3/6, no-price guard, seeded Desk) and the
  Lighthouse budgets run on the tag with a throwaway Postgres — not run locally (running e2e
  against production Supabase would violate the seed/honesty rules). Per the standing autonomy
  directive, P6 proceeds in parallel; tag phase-5 once the tag CI is green.

**(historical) P5 IN PROGRESS (2026-07-11) — the Academy.** Step 1 (infra) done + module M0 authored.
- **Done:** MDX infrastructure via **next-mdx-remote/rsc** (`compileMDX` at request time — chosen
  specifically to AVOID a `next.config.ts` change, since that file carries the delicate Serwist/
  webpack integration). `lib/academy.ts` is the synchronous frontmatter loader (gray-matter) — it
  builds the curriculum manifest and the doorway gate `isKnownLesson` (now backed by real lessons,
  still a sync predicate so the brief/card view-model builders keep calling it inline). The warm
  Academy room: `app/academy/layout.tsx` (warm `academy-bg`, return rail), `app/academy/page.tsx`
  (curriculum map grouped by module), `app/academy/[slug]/page.tsx` (renders MDX with a Newsreader-
  prose `mdxComponents` map + the frontmatter retrieval questions). **Module M0 complete** — all 4
  lessons authored (how-this-app-explains-itself, reading-a-base-rate-sentence, the-probability-
  lexicon, the-track-record-page), each teaching the honesty machinery, mechanical voice, no prices,
  2-3 retrieval questions. Doorways now auto-light: the seeded brief's Learn link and setup-card
  links resolve to authored lessons via the gate (`patternLessonSlug` maps cards to M5/M4 lessons —
  dark until those are written). `new-lesson` skill MINTED. Tests: `lib/academy.test.ts` (loader +
  gate, 4 tests), `e2e/academy.spec.ts` (room + lesson render). Deps added: next-mdx-remote 6,
  gray-matter 4. **Content lives in `content/academy/<module-lowercase>/<slug>.mdx`.**
- **STILL TO DO for P5 (follow the `new-lesson` skill — it's a production line now):**
  1. Author the remaining 21 lessons (M1–M6 per Appendix H — slugs contractual; myth-vs-evidence
     lessons cite their RR Part 4/5/6 verdict + grade). M1: nyse-nasdaq-and-tickers · the-us-trading-
     day · order-types-and-the-spread · reading-the-macro-pulse. M2: what-a-round-trip-costs ·
     slippage-taxes-and-drag · the-cost-mirror. M3: position-sizing-before-patterns · stops-and-
     invalidation · expectancy-and-drawdown-math · why-base-rates-beat-anecdotes (M3 completion
     lifts the pattern-lesson soft gate). M4: candles-honestly · support-resistance-and-round-numbers
     · volume-and-rvol · gaps-what-the-data-says. M5: moving-averages-and-the-golden-cross · rsi-and-
     oscillators · the-myth-vs-evidence-ledger · how-our-base-rates-are-computed. M6: the-four-
     behavioral-taxes · journaling-and-the-pm-scorecard. (The pattern-lesson slugs in
     `lib/patterns.ts::PATTERN_LESSON` already point at M4/M5 ones — authoring those lights the card
     doorways automatically.)
  2. Glossary (step 3): seed the 40 Appendix I terms (`lib/glossary.ts`) + a GlossaryTerm popover,
     first-occurrence-per-view registry, wired across the Desk.
  3. Worked-example drawer (step 4): the fixed 3-step template + on-chart annotation markers.
  4. Review queue (step 5): Leitner boxes on `concept_state` (max 5/day, due dates), seeded from
     concepts the user actually encountered (Desk render logs exposures to concept_state — needs a
     Prisma addition for concept_state if not present).
  5. Doorways completed (step 6): Learn chips, "See this live", ReturnRail on every crossing,
     adaptive fading v1. Then the P5 exit gate + tag phase-5, then P6.

**(reference) P5 build order** (plan §7 P5, content-heavy). Build order: (1) MDX infra
(@next/mdx + frontmatter loader — `lib/academy.ts` already stubbed with the empty manifest to
populate; `content/academy/<module>/<slug>.mdx`; warm-token Academy layout, Newsreader, 65ch); (2)
author the 25 launch lessons (Appendix H slugs — contractual; each cites its RR Part 4 ledger row;
mechanical-honest voice; 2-3 retrieval questions in frontmatter — MINT `new-lesson` after the 2nd);
(3) glossary (40 Appendix I terms + GlossaryTerm popover, first-occurrence-per-view registry); (4)
worked-example drawer (3-step template + on-chart annotation markers); (5) review queue (Leitner on
concept_state, max 5/day, seeded from encountered concepts); (6) doorways completed (Learn chips,
brief's learning link, "See this live", ReturnRail, adaptive fading v1). When lessons land, their
slugs populate `lib/academy.ts` LESSON_SLUGS and the Learn doorways (brief + cards) light up
automatically. Then P6 (paper desk, calibration, dark mode — plan §7 P6). Per the standing autonomy
directive, roll straight into P5.
- **Pipeline (done):** `detectors.py` (the six detectors, shift-guarded), `baserates.py` (Wilson CI,
  point-in-time buckets, always-up baseline, pattern_meta decay seed), `volbands.py` (empirical
  bands, ≤20d), `analytics.py` (base rates + setup cards with the tier + CI-spans-baseline cap +
  stated rate, vol bands), `resolve.py` (nightly resolver, insert-only outcomes). Wired: Job A
  computes + publishes the honesty engine (`publish_analytics`) over the served history; Job B
  resolves due signals from the Parquet lake. Prisma v4 (base_rate_stat, setup_card, vol_band,
  signal_resolution — resolution insert-only by trigger), migration applied. The lottery-flag rule
  (P1) got its direct test. Mints the `new-pattern-detector` skill.
- **UI (done — the acceptance core):** `components/BaseRate.tsx` — the ONE renderer, N-gated (≥100
  %+CI · 30-99 natural frequency + wide-interval note · <30 suppressed) + decay stamp; `SetupCards`
  (module 06) — tier lexicon word (neutral, never colour), the base rate, weakener checklist (server
  action), scope line, provenance, WEAK-capped when the CI spans the baseline; `/track-record` — the
  app's own resolved log (hits/misses/na + hit rate); ScorecardPM grading now lives off
  signal_resolution. `lib/constants` (tier bands + cap, tested), `lib/baserate` (view-model, all
  three N regimes tested), `lib/weakeners`, `lib/patterns`, `lib/track-record`. Seed demonstrates all
  three N regimes + the WEAK cap + resolved hits/misses. Journey-4 e2e added.
- **STILL TO DO for the P4 exit gate (plan step 6 + acceptance):**
  1. `/scans` page — the five presets with criteria strings verbatim + evidence-grade Tags +
     folklore labels (module 07 is still a placeholder).
  2. CalendarTimeline branches — attach per-branch base rates, or the N<30 suppression line.
  3. VolBand on the ticker chart (`/ticker/[symbol]`) — the 50%/80% fan + the regime-break caveat
     line (copy.volband.caveat), hard stop at 20 days. Vol bands are published + seeded; the chart
     overlay is not drawn yet.
  4. Lookahead guards "commit the red test first" — the shift guards + bucket guard are tested, but
     were committed test+impl together, not as separate red→green commits. Acceptance wants the red
     proof in git history; consider a demonstrative red commit if the user wants it literal.
  5. Anti-drift §3.10 checklist on the card UI (the screen most at risk of chip-confetti) — verify no
     coloured chips beyond the Tag component; the tier tag is neutral by construction.
  6. Base rates currently computed over the served+watchlist history (logged assumption, QUESTIONS) —
     full-universe replay is the enhancement for larger N.
- **Tests:** pipeline 190 pass + 16 CI-only DB skips (new: detectors 9, baserates 6, volbands 5,
  analytics 5, resolve 1+3-in-CI, scans lottery 2); app 120 unit (new: constants 6, baserate 9,
  BaseRate render 3) + journey-4 e2e. typecheck, lint, webpack build all green.
- **Assumptions logged in QUESTIONS-FOR-BISHANT.md:** the market regime split (breadth dichotomy),
  the base-rate universe scope (served+watchlist), the decay-note wording (my paraphrase vs RR Part
  4 verbatim), and breadth-regime's grade. None blocking.

**P3 CODE-COMPLETE (2026-07-11) — the briefing. Pending the live observation week, not yet tagged.**
The editorial heart ships: extract → synthesize → verify across the two jobs, rendered as the
BriefArticle, degradable and offline-cached (the brief is part of the cached Desk document the SW
already caches). What was built:
- **Pipeline (`briefing/`):** `schema.py` (Appendix G pydantic, strict, round-trip tested);
  `extract.py` (Stage A — one Haiku call per article over the Message Batches API, batch-cutoff
  collect with an injected clock: ended→all, past-cutoff→cancel + sync the remainder, malformed
  result dropped not fatal); `synthesize.py` (Stage B — one sync Sonnet call, structured output,
  one-retry-on-schema-violation → None held); `verify.py` (the deterministic gate — Appendix E
  tolerances for percent/money/number/date/ticker, held on a focus flag or >2 flags, verification
  JSON records every decision); `stats.py` (the computed-stats table — movers as unsigned magnitudes
  so an honest "fell 2.3%" is not flagged); `evening.py` (Job B orchestration, dependency-injected).
- **Wiring:** Job A submits the extraction batch (deterministic sha1(provider|url) news ids so the
  batch custom_id, the news_item row, and the citation URL all line up) and records batch_id on
  pipeline_run. Job B: holiday preflight (non-session night → ping success, no row), collect →
  synthesize → verify → publish_briefing (atomic; held nights recorded; PM edition preserved on an
  AM rerun), weekly backup, revalidate, dead-man ping. Comes up key-free during buildout.
- **Prisma v3:** `briefing` (am/pm JSON, verification_json, model_meta, status) + `journal_entry`;
  migration `20260711195243_p3_briefing_and_journal` applied to Supabase.
- **App (step 4):** `lib/briefing.ts` (zod parse — malformed → held — + pure view-model builder,
  numbering only news-backed citations); `BriefArticle` (module 02 — display-italic Today's-focus
  headline, labeled item slots, per-claim source superscripts linking to news_item URLs, one Academy
  doorway gated on the empty-until-P5 manifest, neutral "briefing unavailable" on a held gate); the
  `ScorecardPM` shell ("grading begins in P4") over the PM journal write (`journal_entry` server
  action); wired into the morning loader and the Desk page; the seed writes a published briefing.
- **Tests:** pipeline 162 passing + 13 CI-only DB-integration skips locally (45 new briefing tests:
  schema 8, verify 13, extract 8, synthesize 4, evening 7, stats 5; plus 3 briefing-publish + 1
  batch_id integration tests that run in CI); app 105 unit (briefing 11 incl. the mandatory
  "zod rejects malformed briefing JSON" suite, journal 4) + a new MSM_SEEDED e2e briefing journey.
  typecheck, lint, and the webpack build all green.
- **Deferred within P3 (logged in DECISIONS):** the live late-news delta sweep (Job B runs with
  late_news=None) — the batch already captures the day's news; the batch-cutoff fallback is built.
- **STILL TO DO for the P3 exit gate (Blueprint P3):** five consecutive nights of real briefings in
  which every number/ticker/date passes the gate (observe the week; workflow_dispatch reruns if a
  night is missed); the batch-cutoff fallback drill exercised once for real; publish confirmed atomic
  under a mid-publish request; the brief read on the phone ritual column and offline. Requires the
  ANTHROPIC_API_KEY to be live and the jobs to run in the cloud.

**P2 COMPLETE — tagged `phase-2` (2026-07-11).** The Desk explains itself. CI-green on the tag
(app + pipeline + e2e incl. journey 4). Delivered: the five adapters (Finnhub/Marketaux/FMP/EDGAR/
FRED-calendar, real fixtures); Prisma v2 (news_item, calendar_event); the catalyst matcher
(classify + ticker/time-window join); publish persistence; the nightly catalyst ingest with
PER-SOURCE degradation (one provider down ⇒ its section degrades, run succeeds); and the Desk
modules — Movers (04) with catalyst chip + reason + source link or the honest noise line,
CalendarTimeline (03) with consensus, and the SourceStatusFooter (degraded lines + FRED
attribution). Universe narrowed to common stocks + ETFs. Deferred: EDGAR filings in the ingest
(need symbol→CIK). Next: **P3 — the briefing** (extract → synthesize → verify, the BriefArticle).

**P2 (2026-07-11) — catalyst & context layer.** Detail:
- **Housekeeping:** universe narrowed to common stocks + ETFs (drops warrants/units/rights/
  preferreds/baby-bonds by asset name; no-OTC kept; flows through to movers/scans/served — test-first);
  QUESTIONS closed (Supabase password rotation DECLINED, healthchecks check deleted, Vercel git
  auto-deploy connected).
- **Step 1 — adapters (DONE):** finnhub (company news + metrics), marketaux (market-wide tagged
  news), fmp (earnings calendar — /stable/ has date+consensus, no bmo/amc, logged), edgar (per-CIK
  filings, User-Agent asserted), fred extended (release calendar). All test-first vs REAL recorded
  fixtures (recorded via a temp workflow, since deleted; fixtures trimmed). Credentials constructor-
  injected. 12 new tests.
- **Step 2 — schema + matcher + persistence (DONE):** Prisma v2 news_item (dedup provider+url,
  tickers[], event_type, extract Json) + calendar_event (kind/symbol?/timing?/consensus/prior),
  migrated. catalysts.py — classify(headline)→type + match_catalysts() (ticker + time-window join,
  most-recent-wins, provider-agnostic NewsRecord), 5 tests. publish() writes news_item (upsert) +
  calendar_event (replace forward window; None leaves it untouched), 2 DB tests.
- **STILL TO DO for P2:** (a) wire the nightly catalyst ingest — fetch news for the movers
  (finnhub+marketaux) + the calendar (fmp+fred), match/classify, publish, with PER-SOURCE status
  into pipeline_run.sourceStatus (one provider down ⇒ its section degrades, run succeeds); (b) Desk
  step 3 — 03 CalendarTimeline, 04 Movers upgraded (catalyst Tag + reason + source link, or the
  noise line), SourceStatusFooter with FRED attribution; (c) step 4 copy-deck degraded/empty states;
  (d) e2e journey 4 (partial). Acceptance: every >3% mover shows a catalyst chip or the noise tag;
  killing one provider key degrades one section, not the run.
- Pipeline 116 tests (incl. new DB tests run in CI). app 82 unit + 48 e2e green. main is CI-green.


**P1 COMPLETE — tagged `phase-1` (2026-07-11).** The full P1 exit gate is green on the tag CI:
app (typecheck/lint/80 unit/webpack build), pipeline (96 pytest incl. DB + backup-restore round
trip), and the browser suite (48 Playwright: auth, PWA, seeded Desk data, watchlist CRUD, drill &
return, offline + expired-cookie drills). Steps 1–9 done: schema v1 + market_context, adapters
(Alpaca/FRED), indicators, scans + Parquet/DuckDB, publish, the real Desk (macro/movers/watchlist +
all 8 mastheads), the ticker drill (RailSheet level 2 + /ticker Lightweight Charts level 3), the SW
morning cache + OfflineRibbon, and the weekly pg_dump backup + restore test. signal_log emits with an
exact 10-trading-day resolves_on (NYSE calendar). Job A's nightly flow ran real data end to end
(12,933 instruments, 98.4% coverage, 1,825 scans). **Exit-gate budgets:** first-load JS 133KB ✓,
CLS 0.000 ✓, a11y 100 ✓; **LCP accepted as a synthetic-4G artifact** (user decision 2026-07-11 —
real TTFB is ~100ms via ISR + edge cache; Lighthouse's simulated cold-4G LCP is a lab number). Two
P1 follow-ups logged: capture visual-regression baselines on a CI Linux runner, and narrow the
12,933 universe to common-stock + ETF asset classes (currently includes warrants/units/preferreds).

**REAL DATA IS LIVE (2026-07-11).** Job A ran the full nightly flow in the cloud end to end and
published real market data to Supabase: universe 12,933 instruments, coverage 98.4% (over the 95%
floor), 1,825 scan matches, 15 served symbols (indices + sector ETFs; watchlist empty), breadth
5,091 advancing / 3,987 declining / 60.75% above the 50-day, VIX + 10-year from FRED. The deployed
Desk's Macro pulse and Movers now render live data; the watchlist shows its empty state until names
are added. Two fixes got the first run green: Alpaca IEX feed (free plan 403'd on SIP), and NaN
scan metrics coerced to JSON null (Postgres jsonb rejects NaN). Both committed + tested.
- **Universe note (P2 refinement):** 12,933 is broader than the plan's "common stocks + ETFs" — it
  currently includes warrants (…WW), units (…U), preferreds (…P), rights. The no-OTC rule holds;
  narrowing to common stock + ETF asset classes is a P2 universe-quality item, not a blocker.


**Current phase:** P0 COMPLETE — tagged `phase-0` (2026-07-10). P1 (data spine) is next.
**Last green gate (§6.4), 2026-07-10:** typecheck, lint, 45 app unit, 13 pytest, webpack build,
font budget (237/320KB), 28 Playwright (auth + PWA, both viewports), anti-drift §3.10 greps —
all green. **Lighthouse** (deployed /, mobile 4G, authenticated via a minted cookie —
scripts/lighthouse-check.mjs): performance 90–95 ✓, a11y 100 ✓, CLS 0.000 ✓, first-load JS
131KB ✓; LCP 2.8–3.4s accepted as a synthetic cold-4G artifact on a contentless page (DECISIONS
2026-07-10, QUESTIONS-FOR-BISHANT.md — a [VETO?] item). **Healthchecks down-drill: PASSED** —
/start with no success → STATUS=down after the 45-min grace → recovery → STATUS=up, all via the
read-only API.
**Checkpoint:** P0 steps 1, 3, 4, 5, 6, 7, 8 done and committed; step 9 is done except the
Vercel deploy. **The P0 loop is proven end to end:** the cloud wrote a pipeline_run row and the
app renders it. Only the Vercel deploy and the remaining Session-0 secrets stand between here
and the P0 exit gate.

**THE LOOP IS CLOSED (2026-07-10).** Dispatched nightly-a → Job A ran green in GitHub Actions
and wrote pipeline_run(run_date=2026-07-10, stage={hello: ok}) to Supabase, cloud-only. The
Desk reads it and shows "as of 14:43 ET · Written by the nightly pipeline in the cloud". CI is
green on every push (app + pipeline jobs; e2e runs on phase-* tags).

**SESSION-0 ALL BUT DONE (2026-07-10).** All 9 provider probes green with real keys
(Alpaca, Finnhub, FMP, Marketaux, FRED, EDGAR, Anthropic, R2 put/get/delete, healthchecks) —
a named P0 exit criterion. 19 GitHub secrets set. App login (bishantt) in local .env, hash
verified through Next's loader + bcrypt. nightly-b dispatched → the healthchecks dead-man check
is **up**, confirmed via the read-only API. The only Session-0 item left is Vercel.
- FMP needed the /stable/ API (v3 retired 2025-08-31) — probe fixed, P2 adapter noted.
- `.env.session0` collection file deleted after distribution; `.vercel-auth-hash.tmp` (raw hash
  for Vercel, git-ignored) is kept for the deploy.

**GitHub is live (2026-07-10).** github.com/bishantt/myStockMarket — private, Actions enabled,
all commits pushed. Token has repo + workflow scope. First push needed http.postBuffer raised
(the PDFs exceeded Git's 1MB default) and HTTP/1.1; those are set in the local git config.

**PWA seed done (step 6).** Manifest, six icons from public/mark.svg, Serwist service worker,
/offline. 14 e2e tests green. The production build uses `next build --webpack` (Serwist needs
webpack; Next 16 defaults to Turbopack) — dev stays on Turbopack.

**Supabase is live (2026-07-10).** All three connection strings verified; `pipeline_run`
migrated onto the real database; a Prisma write/read/delete round-trip through the pooler
succeeds. `DIRECT_URL` points at the IPv4 session pooler because the free-tier direct host is
IPv6-only on this network (logged). The DB password was visible in chat when pasted — a
rotation at the end of Session-0 is recommended, after which the strings get re-pasted and
re-tested once.

## Where the build actually is

Eleven commits on `main`, all pushed to github.com/bishantt/myStockMarket (private, CI green):

- repo init + scaffold verified against §2.2; DEVELOPMENT-PLAN.md regenerates byte-identical.
- Next 16.2.10 + React 19 + Tailwind v4; the full §3.2–3.4 token set; fonts 237KB / 320KB.
- `lib/time.ts` (DST-tested), `lib/copy.ts` (Appendix J, pinned), `SectionMasthead` / `Tag` /
  `StatFigure`, the Desk shell, `/styleguide`.
- The login wall: `lib/auth.ts`, `lib/password.ts`, `proxy.ts`, `/login`, hash script.
- Prisma 6.19 schema v0 (`pipeline_run`), migrated onto Supabase, `lib/db.ts`.
- PWA seed: manifest, six icons from `public/mark.svg`, Serwist SW (`app/sw.ts`), `/offline`.
- Pipeline skeleton: `config.py`, `monitoring.py`, `jobs/job_a.py`, `jobs/job_b.py`,
  `scripts/probe_providers.py`; four workflow YAMLs (nightly-a/b, ci, migrate).
- The Desk reads `pipeline_run` and shows the cloud run's timestamp — the loop, closed.

Tests: 45 app unit + 14 Playwright (auth + PWA) + 13 pipeline pytest, all green. CI runs the
app and pipeline jobs on every push; e2e + Lighthouse on `phase-*` tags.

## P0 is DONE (tagged phase-0, CI green). Now in P1 — the data spine (plan §7 P1).

**P1 build order (plan §7):** 1) Prisma schema v1 + seed · 2) adapters/base.py + alpaca.py
(mint new-provider-adapter) · 3) indicators.py toy-series-tested (mint new-indicator) ·
4) Parquet/DuckDB store + scans.py (5 presets) · 5) publish.py wired into job_a · 6) Desk
modules 01 macro / 04 movers / 05 watchlist, all 8 mastheads · 7) RailSheet + /ticker/[symbol]
with Lightweight Charts · 8) SW morning-payload cache + OfflineRibbon · 9) weekly pg_dump.
**Tests-first (§6.2):** every indicator (toy series), adapter fixtures + rate-limit, universe
hard-fail (<95%), publish transaction isolation, stage-skip rerun, signal_log idempotency,
watchlist server actions, e2e journeys 1/2/5, visual baselines.

## Next 3 tasks

1. **P1 step 7 — the drill (level 2)**: RailSheet + `/ticker/[symbol]` with Lightweight Charts
   (candles + volume). Desk watchlist/movers rows open the rail (no route change); "Open full view"
   pushes the ticker route with a back rail. e2e journey 2 (drill & return).
2. **P1 steps 8-9**: SW morning-payload cache + OfflineRibbon (X-SW-Source header); weekly pg_dump
   in nightly-b + one restore test. Wire the trading calendar (exchange_calendars) and turn on
   signal_log emission (deferred — see below).
3. **Phase-1 exit**: §6.4 gate (LCP now a HARD gate — real content is measurable now), capture
   visual baselines, then tag phase-1. Also a P2 universe-quality item: narrow the 12,933 universe
   to common stock + ETF asset classes (currently includes warrants/units/preferreds).

## P1 progress
- **step 1 DONE:** Prisma schema v1 migrated (Instrument/PriceBar/ScanResult/SignalLog/
  WatchlistItem); signal_log insert-only via trigger (owner bypasses REVOKE).
- **step 2 DONE:** `adapters/base.py` (TokenBucket rate limiter, load_fixture, Adapter — 11 tests)
  and `adapters/alpaca.py` (daily_bars + list_universe — 7 tests) built test-first against REAL
  recorded fixtures. `new-provider-adapter` skill MINTED; PATTERNS.md has the adapter shape.
  Structural fix logged: exchange is a String (ETFs list on ARCA), no-OTC enforced at ingest.
  Fixtures recorded via `scripts/record_alpaca.py` + a temp Actions workflow (removed).
- **step 3 DONE:** `indicators.py` — the full Appendix F set as Polars expressions, verified
  against pandas-ta-classic on a deterministic toy series (`tests/toy_series.py`); exact for
  non-recursive, converged-tail for the smoothers; causality guard. 20 tests. `new-indicator`
  skill MINTED. Uses polars-lts-cpu (Rosetta/no-AVX2 dev machine) + pyarrow (dev).
- **step 4 DONE:** scans.py (5 presets, 19 tests) + parquet_store.py (year-partitioned Parquet +
  DuckDB, 5 tests).
- **step 5 DONE:** publish.py — single-transaction serving-DB refresh (upserts + insert-only
  signal_log + per-run scan replacement + atomic rollback + market_context), 7 integration tests
  against a throwaway Postgres (skip locally without Docker; CI runs them via a postgres:16 service).
- **step 5 WIRING DONE:** `nightly.py` — Job A's full flow as run_nightly(deps), dependency-injected
  and tested end to end with fakes (5 tests: universe coverage floor, full-publish, FRED-outage
  degrade, breadth, served-bar selection). `storage.py` — R2Store (boto3 S3, key-mirrors the Parquet
  tree, 4 tests with a fake client). `jobs/job_a.py` rewritten from the hello-run to build the real
  Alpaca/FRED adapters + ParquetStore + R2 + conn and call run_nightly; nightly-a.yml now passes the
  Alpaca/FRED/R2 secrets. **Deferred (logged):** signal_log emission waits for the trading calendar
  (permanent insert-only log must not bake an approximate 10-trading-day horizon). **Not yet run in
  the cloud** — dispatch nightly-a to prove it end to end and light up the deployed Desk.
- **step 6 DONE (incl. watchlist writes):** the three Desk modules render live data, and the
  watchlist is now fully CRUD. `lib/watchlist.ts` (pure rules: reason required, focus cap = 3 —
  9 tests). `/settings` route: server actions (add/remove/toggleFocus, cap enforced in the write
  path, validated at the boundary with zod) + an editorial add form and an editable list
  (`AddWatchlistForm`, `WatchlistManager`). A "Settings" nav link added. Watchlist copy is inline UI
  microcopy (Appendix J has no watchlist strings — logged). `e2e/settings.spec.ts` (MSM_SEEDED-gated,
  per-project symbol to avoid the desktop/phone DB race): add → shows on Desk → focus/unfocus →
  remove, plus a duplicate-refused check. Build green (/settings is dynamic); typecheck + lint clean.
- **step 6 (earlier) — real-data wiring:** the three Desk modules WIRED to real serving data.
  - `market_context` table added (VIX / 10-year / breadth had no home in Appendix B) + migration
    `market_context`; `publish.py` writes it in the same transaction (2 new DB tests).
  - `fred.py` minimal adapter (VIXCLS + DGS10) — 4 tests, real recorded fixtures.
  - `lib/format.ts` — the number-formatting home the conventions name (price/signedPercent/percent/
    multiple/directionOf), 8 tests; true-minus, flat band.
  - `lib/morning.ts` — the Desk loader: pure builders (buildMacro/buildMovers/buildWatchlist, 8
    tests) + `getMorning()` with per-module graceful degradation. Movers are sourced from the
    unusual-volume scan (volume-confirmed moves; catalysts in P2 — logged).
  - The Desk page renders MacroPulse/Movers/Watchlist when data exists, else the quiet placeholder;
    a live module only stamps a date when a run is recorded.
  - `prisma/seed.mjs` — deterministic synthetic morning, plain ESM (`npx prisma db seed`), with a
    guard that refuses any Supabase host (dev/test only; honesty rules forbid seeding production).
  - `e2e/desk.spec.ts` — journey 1 (P1 variant), gated by MSM_SEEDED=1; CI e2e job now stands up a
    Postgres service, runs `prisma migrate deploy` + `db:seed`, and asserts the rendered morning.
  - STILL TO DO for step 6: job_a's full ingest→compute→scan→publish flow (writes the real
    market_context + scans the loader reads). Until then the deployed Desk shows placeholders (no
    production seed by design).
- **Vercel git auto-deploy** connected; Root Directory = `app` (fixed via API). Every push deploys.
- **Tests: 71 app unit + 31 e2e (28 + 3 seeded-Desk) + 82 pipeline (CI, incl. 7 DB) green.**
- **LCP ≤ 2.5s is now a HARD P1-exit gate** (user directive 2026-07-11; scripts/lighthouse-check.mjs
  exits non-zero on a miss). Do not tag phase-1 until it passes for real.
- Note: the deterministic `prisma/seed.ts` synthetic morning still pending (pairs with the Desk
  modules at step 6). DB verification should use a throwaway DB, not production Supabase.

## P1 progress
- **step 1 DONE (2026-07-10):** Prisma schema v1 migrated to Supabase (Instrument, PriceBar,
  ScanResult, SignalLog, WatchlistItem, Exchange enum). signal_log insert-only enforced by a
  trigger (owner bypasses REVOKE — see DECISIONS/LESSONS), verified UPDATE+DELETE both rejected.
  The deterministic `prisma/seed.ts` synthetic morning is deferred to pair with the Desk modules
  (step 6) that consume it and the e2e journey-1 P1 variant.
- Note for DB tests: use a throwaway/test DB, not production Supabase (a verification left an
  undeletable signal_log row I had to TRUNCATE). The plan calls for dockerised Postgres for
  pipeline tests and a seeded DB for e2e.

## Deployment facts (2026-07-10)
- Production: **https://mystockmarket-eight.vercel.app** — our /login wall gates it; preview/
  deployment URLs sit behind Vercel SSO (the licensing wall for previews). Vercel project
  `bishantts-projects/mystockmarket`, linked from `app/`, build command `npm run build`.
- Vercel env (production + preview): DATABASE_URL, DIRECT_URL, AUTH_USER, AUTH_PASS_HASH (raw),
  AUTH_COOKIE_SECRET, CRON_SECRET, APP_BASE_URL — all set.
- Local auth now lives in `app/.env.development.local` (dev-only), NOT root .env — see the
  DECISIONS/LESSONS entries on the e2e hermeticity fix. `.vercel-auth-hash.tmp` (raw hash) can be
  deleted now that Vercel has the value.
- Git auto-deploy is NOT connected yet (the repo is the parent of `app/`; do it in the dashboard).

## Blocked

- **Remaining Session-0 values** (Supabase ✓ and GitHub ✓ are already in): Vercel link +
  preview-protection confirmation · Cloudflare R2 (account id + access key + secret) · provider
  keys (Alpaca, Finnhub, FMP, Marketaux, FRED) · EDGAR name+email · Anthropic key + $15 cap ·
  healthchecks check + read-only API key · the app login username+password. Drop them in the
  git-ignored root `.env` and say so; I distribute per Appendix D. **Fallback in force:** none
  needed — all key-free P0 work is done.
- **Recommended cleanup:** rotate the Supabase DB password (it was visible in chat when pasted),
  then re-paste the three strings for a single re-test.
- Already generated / set: `CRON_SECRET`, `AUTH_COOKIE_SECRET`, `R2_BUCKET` in `.env`;
  DATABASE_URL, SESSION_POOLER_URL, CRON_SECRET as GitHub secrets.

## Decisions worth knowing before you touch anything

- **One structural deviation this session**, logged in DECISIONS.md and annotated into both
  `DEVELOPMENT-PLAN.md` §3.2/§4.5 and their `docs/src/dp-*.html` sources (Part 10 rule 9):
  Newsreader's optical-size axis is dropped. It cost 153KB and broke the plan's own font budget.
  The display italic survives. `npm run check:fonts` enforces the budget from now on.
- `globals.css` uses `@theme static`. A bare `@theme` tree-shakes unused tokens, which silently
  deleted 12 of the 17 colour tokens — including the three the chart hook will read at runtime.
- `lib/tokens.ts` is the only file besides `globals.css` allowed to contain a hex colour.
- Node 24 does **not** resolve by default in this environment: Claude Code runs on Node 20 and
  its PATH leaks into every spawned shell. Prepend
  `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` to build and test commands.

## Scaffold provenance (2026-07-09, planning session — before any build session)

Created: CLAUDE.md · DECISIONS.md · PATTERNS.md · LESSONS.md · this file ·
.claude/skills/ (README + 2 seed procedure skills) · .env.example · .gitignore · README.md ·
.github/workflows/ (empty, .gitkeep) · app/ and pipeline/ (deliberately EMPTY).
`app/` has since been scaffolded; `pipeline/` is still empty and belongs to `uv init`.
