# N7 — hardening, evidence, docs sync

*The last phase of the News & Control build. Tag: `nc-final`.*

The job of this phase was to make the guards honest, make the documents agree with the code, and
close the build. It found five things, and they are all the same shape: **something that looked
correct because nobody had asked it the one question that could have refuted it.**

Two of them were found by the guards N7 had just repaired, on the tag run itself — which is the
strongest evidence this chapter has that the repairs were worth making:

| # | What | How it was found |
| --- | --- | --- |
| 1 | The sweeps were passing on a page that does not exist | Asked a passing guard to prove it had measured anything |
| 2 | **The story page's source links are 20px tall on a phone** | **The repaired sweep, the first time it ever saw the room** |
| 3 | **The `/paper` baseline had EXPIRED, not broken** | The tag's CI, failing with nobody having touched a line of code |
| 4 | A control-room test that passed only while the market was open | Same run, same cause: the clock |
| 5 | The Development Plan we print had rotted for a month | Went to edit it and found two copies |

---

## 1. The sweeps were passing on a page that does not exist

The plan's N7 playbook says the touch-target sweep must be "re-run WITH the new routes in its list —
the sweep is only as honest as its route list." That was true, and it was the smaller half.

**The route lists.** `/news` shipped in N5. Neither the touch-target sweep nor the sideways-scroll
sweep had ever measured it — and it is the densest room in the app for exactly those rules: two
horizontally-scrolling chip rows, a pagination control, a grid of card links. Added at N7. **It
passes clean**, which is the honest and uneventful result: the room was built to the rules, the
sweep simply had never looked at it.

**The vacuous pass, which is the real finding.** All three sweeps (touch targets, sideways scroll,
axe) walk to a route and measure whatever is on the screen. A story page is addressed by a cluster
id; ask for one that is not in the database and the route calls `notFound()`. So an unseeded run
did not measure the story page at all — **it measured the 404 page, found nothing wrong with it, and
reported the story page clean.**

Verified before anything was changed: the axe sweep **passed** `/news/nc-fed-hold` against a
database that has never contained that cluster.

**And the status code cannot see it.** The first version of the guard asserted `status === 200`, and
it still passed. Recorded on this tree:

| Request | Status | Body |
| --- | --- | --- |
| `/news/nc-fed-hold` (unseeded) | **200** | "404 — This page could not be found." |
| `/news/utter-nonsense-id` | **200** | "404 — This page could not be found." |
| `/ticker/NOTAREALTICKER` | **200** | "404 — This page could not be found." |
| `/scans/not-a-preset` | 404 | — |
| `/no-such-room-at-all` | 404 | — |

A `notFound()` raised **inside a statically-generated route** is served as **200 with the 404 page in
the body**; only a path the router cannot match at all gets a real 404. So a status check certifies
exactly the page it was written to refuse.

This build already knew half of this. An F-phase entry in QUESTIONS-FOR-BISHANT logged *"unknown
tickers return HTTP 200 instead of 404"* and judged it correctly at the time: **"it is a wrong status
code, not a wrong screen."** That is true of what the reader sees. What nobody had asked was what it
does to a **gate** — and the answer is that it silently disarms every guard that trusts the status.
A cosmetic defect in the product turned out to be a load-bearing defect in the instruments.

**The repair.** `open()` reads the **body**, because the body is the only honest witness. It also
refuses a redirect (a lapsed session would have put the login form under the ruler — also clean, also
a pass). Seeded rooms now state the condition they need (`MSM_SEEDED=1`) instead of quietly measuring
an error page. And the touch sweep **counts what it measured**: finding zero controls in a room that
always has a tab bar means the page did not render, and that is a failure, not a pass.

**Negative-controlled.** Forced seeded against an unseeded database, every new guard fires:

```
Error: /news/nc-fed-hold rendered the 404 PAGE — the sweep would have measured an error page
and passed. (Note: it answers HTTP 200, so no status check can see this.)
```

---

## 1b. What the repaired sweep found the first time it saw the room

The story page's **source links — the named outlets a reader taps to check the story against the
outlet that reported it** — are **twenty pixels tall on a phone.** Measured by the sweep, on the tag
run, the first time it was ever pointed at `/news/[cluster]`:

```
a.underline — 48×20  — "Reuters"
a.underline — 70×20  — "Bloomberg"
a.underline — 39×20  — "CNBC"
a.underline — 110×20 — "Associated Press"
a.underline — 99×20  — "Financial Times"
```

Five of them, stacked, each **under half** the 44px floor this project's constitution sets. And they
are not incidental controls: the linked source list is *the first line of the room's spec*, and the
whole reason the room can claim a story is corroborated. They are the last controls in the app that
should be hard to hit.

WCAG's inline exception does not rescue them, and should not. It exempts a target sitting "in a
sentence or block of text"; this is a **list of discrete controls** — outlet, timestamp, headline.
(The `<li>` is a flex container, so the anchor is *blockified* and sits in no line box at all, which
is exactly why the sweep measured it instead of exempting it.)

Fixed with touch-only padding — `md:py-0`, so every desktop pixel is where it was. The two phone
story baselines are updated in the same commit, with the reason, per the `vrt-update` skill.

**This is the entire argument for §1 in one finding.** The bug was not new. It shipped in N5 and sat
there through two tagged phases, and it was *unmeasurable* the whole time — because the sweep had
never been given the route, and when it finally was, it was reading the 404 page instead.

---

## 1c. The `/paper` baseline did not break. It EXPIRED.

The tag's CI failed on five `/paper` screenshots with nobody having touched a line of `/paper`.

The seed dated its closed paper trades **absolutely** — 2026-07-02, 07-06, 07-07. The app counts
"round trips this week" as `closedAt >= now - 7 days`: a window that **rolls against the wall
clock**, which is the correct product behaviour. An absolute fixture date cannot stay inside a
rolling window. It can only wait to fall out of it. Here is the minute it did:

| Run | CI time | 7-day cutoff | The 07-06T19:50 trade | Count |
| --- | --- | --- | --- | --- |
| `nc-6` | 2026-07-13 **19:22Z** | 07-06 19:22 | **inside** | **2** ✅ |
| `nc-final` | 2026-07-13 **20:39Z** | 07-06 20:39 | **outside** | **1** ❌ |

**The baseline expired at 2026-07-13T19:50Z — twenty-eight minutes after the run that last certified
it.** And it took the cost mirror with it: the projected annual drag read **−31.2%/yr** in the
baseline and **−15.6%/yr** in the actual, because half the round trips had aged out of the year's
projection. A reader would have been shown a different lesson about their own trading costs
depending on what time the page was built.

**The trap is that re-shooting the baseline works — for one day.** Tomorrow the 07-07 trade ages out
too, the count reads 0, and the whole mirror goes to zero. A green re-baseline would have hidden a
fixture that was still decaying.

There is no fixed date that stays "this week" forever, so a fixture that claims *two round trips this
week* must say so **relative to the week**. It does now (`DAYS_AGO(3)`, `DAYS_AGO(2)`, and one
deliberately at `DAYS_AGO(11)` to stay outside): the count is 2 at every hour, forever. It costs no
pixels — `PaperLedger` renders no dates at all.

**And the proof it worked is in the baselines:** the regenerated `/paper` shots came back
**byte-identical** to the ones committed before this phase. The seed fix restored the count to 2, and
the pictures matched the world again.

## 1d. A test that passed because the clock was kind

Same run, same cause. The control-room e2e asserted that the `full` row must **always** carry one of
five reasons. It passed at `nc-6` (CI at 3:22pm ET — the market was **open**, so the row truthfully
said "Markets are open") and failed at `nc-final` (4:39pm ET — **after the close**, when `full` is
genuinely *runnable* and has no reason to give).

And while it did, it **contradicted N6's own ruling**: the missing-token sentence is deliberately
printed *once, above the rows* — "the STATE is per-row, the REASON is per-panel" — so a row that is
runnable-but-for-the-token correctly says nothing, and the test was demanding it repeat the panel.

The assertion now states the invariant that is true at **every** hour: the row states a reason, **or**
offers a button, **or** the panel explains the absence — the reader is never left with a control that
neither works nor says why. *When a test is time-dependent, the fix is almost never to pin the clock;
it is to find the sentence that was true all along.*

---

## 2. The plan had two HTML copies, and the one we print had rotted

`DEVELOPMENT-PLAN.md` is **generated** from `docs/src/dp-*.html` — its own first line says so. The
first draft of this phase's docs sync edited the generated file, and the next person to run the build
script would have silently erased it. Caught, moved to the source, regenerated.

Except **the PDF is built from a different file.** `docs/src/development-plan.html` was a second,
hand-maintained copy of the same document. Nobody decided that; it simply happened. And then the two
copies quietly disagreed for a month:

| Text | in `dp-*.html` (→ the markdown) | in `development-plan.html` (→ the PDF) |
| --- | --- | --- |
| `Amended 2026-07-12` | 3 | **0** |
| `APP-FEEL-PLAN` | 3 | **0** |
| `/scans/[preset]` | 1 | **0** |
| `revalidate = 600` | 1 | **0** |

**Not one of the F-phase amendments had ever reached the PDF.** Its route map had no
`/scans/[preset]` row — a room that has existed since 2026-07-12 — and it still promised the
`force-dynamic` rendering the app abandoned a month ago. The markdown was right, the PDF was wrong,
and nothing anywhere said so, because both files looked authored, current and confident.

**Two sources of truth for one document is not redundancy. It is a slow-motion lie** — and the copy
that rots is the one that gets read least, which is the PDF: the one the user actually opens.

**The repair.** There is one source now. `docs/src/build-plan-pdf.py` generates
`development-plan.html` **and** the PDF from the same `dp-*` parts the markdown comes from, and it
**asserts** the parts still concatenate into exactly one document (`<!DOCTYPE>`, `<body>`, `</body>`,
`</html>` — one each) rather than trusting it, because a part that quietly stopped closing its tags
would print a plausible PDF missing its second half. Re-rendered: **37 pages, cover intact.**

The route map was **photographed through `print.css` before shipping** — which is how I caught that
the first table I checked was the wrong one.

---

## 3. `/settings` costs 455ms, by design, and one round-trip of that was free

The nav budget (B2) reports a worst warm median of **455ms against a 150ms budget**, and every sample
is a cache `MISS`. That is `/settings`, and it is **not a regression**: F7's own evidence
(`docs/feel-evidence/nav.md`) recorded it at **564ms** in exactly this state.

It is the standing price of the app's one **writer** room. The rule, from F7: *a page may be cached,
or it may be written to and read back in the same click — not both.* `/settings` is the only room
that is a writer, so it is the only route on B1's allowlist, and it renders on request every time.
Every other product route is served from a cache and answers in 50–103ms.

**One free improvement, taken — and it did not do what I predicted.** Inside the panel's loader,
`readPanel()` and the last-run query know nothing about each other and were awaited in series. I
expected that to be worth a full Supabase round-trip, roughly 100ms. **Measured on the deployed app:
455ms → 434ms. About 20ms.**

The change is kept — a sequential await of two independent reads is wrong however little it happens to
cost — but **the prediction was wrong, and the number is what goes in the record.** The honest reading
is that these two queries were never this room's problem, and the remaining ~280ms over the cached
rooms lives somewhere I have not measured. **I have not gone looking for it**, because `/settings` is
a room the single user of this app opens rarely and deliberately, and a 434ms settings page is not a
defect worth a phase. If it ever becomes one, that paragraph is the starting point, and it starts by
saying where the time is *not*.

**B2 remains in report mode for this route, and that is the honest posture:** the 150ms budget
describes a cached room, and this room cannot be cached without breaking the read-after-write it
exists to do. The number is recorded rather than hidden behind a gate that was never going to fire.

---

## 4. The standing gate, on the tag

| Gate | Result |
| --- | --- |
| Anti-drift rules | **20 / 20 pass** |
| Font budget | pass — 317KB of headroom |
| `check:migrations` (live DB vs repo schema) | **pass** — production is running this schema |
| B1 — rooms served from a cache | **12 of 13** · allowlist: 1 (`/settings`, the writer) |
| B2 — authenticated TTFB | 50–103ms cached · `/settings` 455ms uncached (report mode, §3) |
| B4 — first-load JS | pass — worst **196.2KB**, ceiling 200KB |
| App unit tests | **577 pass** (53 files) |
| Pipeline tests | **462 pass**, 26 skipped (no local Postgres — CI is the oracle) |
| typecheck · lint | clean |
| Production build | clean |
| e2e + VRT + PWA | CI, on the tag (the pixel oracle) |

---

## 5. The build, closed

Six phases, six evidence chapters, and one line each for what they proved.

| Phase | Tag | Evidence | The thing it found |
| --- | --- | --- | --- |
| N0 | `nc-0` | `n0-audit.md` | A secret in GitHub is not a secret in the job — the briefing had run with no AI extraction for four phases, silently, because good error handling hid it. |
| N2 | `nc-2` | `n2-footprint.md` | Production was missing a migration and nothing could tell you. CI's database is disposable; `check:migrations` is the only instrument that can see the live one. |
| N3 | `nc-3` | `n3-board.md` | Three fabricated fixtures had been passing for three phases. **A fabricated fixture is not a weak test — it is an inverted one.** |
| N4 | `nc-4` | `n4-newsdesk.md` | The plan's clustering threshold clustered *nothing at all*. Record the provider's real response before writing the parser. |
| N5 | `nc-5` | `n5-frontpage.md` | Every photograph on the Front Page was broken, and only the PNG showed it. The fixture's LIE was in the SHAPE, and the app reads shapes. |
| N6 | `nc-6` | `n6-control.md` | **The vendor's own documentation is not a recording.** GitHub's dispatch API returns 204 with an empty body; GitHub's docs say otherwise. |
| N7 | `nc-final` | this file | The guards were passing on a page that does not exist, and the document we print had been wrong for a month. |

**Counts at `nc-final`:** 577 app tests · 462 pytest local (26 skipped) · 20 drift rules · 76 VRT
baselines · 4 pipeline modes · 13 product routes. **CI green on the tag — all four jobs, including the
pixel oracle.**

### One thing this phase could not explain

On the first tagged run, a `/news` test failed because the page server-rendered an **empty `<main>`**
(nav present, room absent) while the server logged a Next.js `Internal: NoFallbackError`. It failed on
retry too. After the fixes above — none of which touch how `/news` renders — it passed, and has passed
since. **A transient server error, not a flaky assertion: the page really did render nothing.** No
mechanism, no reproduction. Recorded in QUESTIONS rather than closed, because "it went away" is not a
diagnosis.

**Nine real bugs in this build have been found by opening the picture and looking at it**, and by no
other means. N7 added the tenth of a different kind: by asking a passing guard to prove it had
measured anything at all.

### Still open, and neither blocks anything

- **P-2 — the GitHub token** is still unprovisioned, so every button in the control room is dark in
  production. The panel says so, once, and renders every other state honestly. The whole path is
  proven working against real GitHub (`n6-control.md` §6). It is a secret and nothing else.
- **P-1 — the R2 media bucket** is still absent. The Front Page renders its designed generated cards.
- **Q-N6-1 — ANSWERED by the user (2026-07-13): delete the Saturday rows.** The cause is fixed
  (`job_a` skips a non-session day). The deletion itself is **not N7's to run**: POLISH-AND-DEPTH-PLAN's
  **PD1** executes the SQL *after Monday's edition is verified*, and running it early would break that
  sequencing. Until then the rows (`pipeline_run`, `market_context`, `scan_result`, stamped
  2026-07-11) remain in production — invisible to every display, present in any series that walks
  those tables by date.
