# PD7 — News depth: the pipeline

**Tag:** `pd-7` · **Phase:** POLISH-AND-DEPTH-PLAN Part 9.2, 9.3, 9.5 + Appendix B
**Date:** 2026-07-14 · **Nothing in this phase renders. PD8 builds the surfaces.**

Part 9's thesis is that depth arrives in two moves and the pipeline goes first: *the LLM narrates
only what the pipeline computed*, so the pipeline must compute more before any surface can show
more. PD7 is the first move.

---

## 1. Q-PD5-1 — the gate publishes what it CLEARED

This was the phase's heart, and the fix is smaller than the problem.

The deterministic gate has always recorded its **flags** — the entities that traced back to no
source — and thrown away the other half of the same decision: the entities it **checked and
matched**. So a published brief carried a list of what FAILED and no list of what PASSED, and ruling
E5 ("a number is set in mono — the *this was checked* typeface — only if the gate cleared it") had no
allow-list to consult. That is why the Desk's brief carries glossary doorways and **not one
emphasized figure**.

The alternative was a **deny-list**: emphasize everything number-shaped except the flagged. That
would make the *app* decide what counts as a number, with its own regex, when `verify.py` already
answers that question — and its own header names the cost of a second answer:

> "Two definitions of that would be one too many: the day they drifted apart, one of the two
> surfaces would start publishing numbers the other would have refused, and nobody would find out
> from a test."

So the gate answers it once, out loud. `check_text` now returns a `CheckResult` carrying `cleared`
alongside `flags` and `checked`; `VerificationResult.to_json()` publishes it; and every news note
records a per-section `cleared` list. **The scan already made this decision — it was simply keeping
half of it.**

**PD8 can now honour E5 on the Desk.** The allow-list is in the row.

---

## 2. The registry grew (9.2) — and the rendered value is the gate's source of truth

`briefing/depth.py` — pure functions over bars, fixture-tested:

| stat | value | absent when |
|---|---|---|
| `tkr:{sym}:pos52w` | position in the 52-week range (three numbers, one id) | fewer than 252 bars, or a zero-width range |
| `tkr:{sym}:move_atr` | tonight's move in units of the name's OWN ATR14 | no ret1, or no ATR |
| `tkr:{sym}:streak` | consecutive same-direction sessions | fewer than 2 bars, or a flat close |
| `tkr:{sym}:from50d` | signed distance from the 50-day average | fewer than 50 bars |
| `cls:{id}:corroboration` | outlet count | never (always known) |
| `cls:{id}:history7d` | stories on this name in 7 sessions | the count is unknown |
| `cal:{key}:next` | the next scheduled event, per key | no dated row in the horizon |

Two rules govern every one of them, and they are the same rule twice: **a window that is not full
yields None**, and **absence beats invention**. Not fastidiousness — the registry is what the gate
checks prose against, so *a number the registry invents is a number the gate will CERTIFY*. A
fabrication the pipeline mints itself is the one kind no gate can catch.

### The window is a number too

**THE RENDERED VALUE OF A STAT IS THE GATE'S SOURCE OF TRUTH**, and PD7 is where that stopped being
a detail. `verify.py` parses each value into the allowed set, so the numbers a value *contains* are
exactly the numbers the narrator is licensed to write.

A narrator describing a 52-week range writes the words **"52-week"** — and 52 is a number. Unless it
traces to a source, the gate flags an honest sentence *for the very window it was asked to describe*.
The same trap sits in "50-day average" and "the last 7 sessions".

So each value **states its window, in the words the narrator will use**:

```
tkr:MRNA:pos52w  = 71.4% of the way up its 52-week range (low 82.10, high 154.90)
tkr:MRNA:move_atr = 2.3x its normal daily range (ATR14)
cls:{id}:history7d = 2 stories on this name in the last 7 sessions
```

The window is licensed through the ordinary mechanism rather than a special case carved into the
gate. **A stat that describes a window is a stat that must say the window out loud.**

---

## 3. The eighth stat is NOT here, and the absence is the point

9.2's table asks for `sector:{key}:breadth1d` — "advancers/decliners within the sector's scan
universe tonight", computed from "lake bars… the pipeline sees ALL bars". **It cannot be computed in
this stage, and it took looking at the two candidate tables to find out:**

- **`scan_result` holds only the preset MATCHES**, not the universe. A breadth count over the names
  that matched a scan is not the sector's breadth — `NEAR_52W_HIGH` alone skews it advancing — and
  it would have been a *confidently wrong number wearing a computed number's clothes*. That is the
  worst thing this pipeline can publish, because the gate would then **certify** it.
- **`price_bar` holds only the SERVED symbols**: 15 ETFs plus the watchlist. There is no per-sector
  stock population in it to count.

The per-symbol returns for the whole universe exist in exactly one place — the **in-memory lake,
during the full nightly** — and the newsdesk never sees it. `_build_front_page` is a **Postgres
closure in BOTH modes**: the full night has the lake but never hands it over, and `news` mode has no
lake at all, which is precisely what makes it safe to run at any hour.

So the honest options were to thread the lake into the newsdesk seam, or store a per-sector breadth
in its own column. Appendix B already ruled on the second: *"if PD7 discovers it needs one more
column, it lands with its OWN migration and a DECISIONS line, never by widening this one silently."*
A second migration is a deliberate act, not something a long phase slips in at its end.

**The stat is absent, the narrator has one less word, and nothing invents a number** — 9.2's own
closing rule, turned on 9.2's own premise. Booked as **Q-PD7-1** for PD8.

---

## 4. The gate extends, it does not relax (9.3)

`ClusterNote` v2 adds `context` (≤420 chars) and `watch` (≤2 calendar refs). The gating shape was
decided by two sentences in the plan pulling in opposite directions, and both are honoured:

- **E3's guard:** "a fixture night includes one insight with a fabricated number and the test asserts
  that section — **and only that section** — is dropped and counted."
- **9.3:** "the gate **extends, not relaxes**."

Which settles it. **The v1 pair stays COUPLED** — decoupling `why_it_matters` from `affected_note`
would let a note that is dropped whole today start publishing half of itself, which is a relaxation
by any reading, and N5's argument for coupling them (they are one thought; a model that invented a
figure in one has not earned the benefit of the doubt in the other) is untouched. **The NEW sections
gate independently**, because there was nothing there before to relax.

`watch` is verified **structurally**: every ref must resolve to a calendar row *this cluster was
actually shown*. A dangling ref is dropped. That is what makes "the LLM cannot author a calendar
entry" a **property of the system** rather than a request in a prompt.

### E4's teeth — `briefing/lexicon.py`

Advice verbs anywhere; a frequency adverb **only in a sentence that also cites a COMPUTED stat**.
An uncited "usually" is folk probability wearing prose: it claims how *often* something happens with
no base rate, no N, no interval — and this product publishes base rates with Wilson intervals
precisely so it never has to say "usually" and hope.

Note which numbers earn the adverb: **the registry's, and only the registry's.** A figure a
journalist wrote in an article (an extract's `key_number`) is a fact about the world; a registry stat
is a figure *this pipeline computed and can defend*. Quoting the former beside "usually" is still
folk probability with a decoration next to it.

**The false positive is the dangerous failure here** — a flagged section is DELETED, and a deleted
section prints exactly the same nothing as an honest silence, so a too-eager lexicon would strip
honest prose off the front page and no screen would ever say so. Hence "a buy **rating**" survives
and "buy the dip" does not — and the tests caught **"the sell-off spread"** matching `\bsell\b`
before it could delete an ordinary sentence about a market decline.

---

## 5. THE COST INSTRUMENT, AND THE OUTAGE IT FOUND (9.5)

Plan 0.2.3 priced the depth delta at **≈$0.03–0.06/night on top of ~$0.33**, and said explicitly:
*"measured at PD7's gate, not promised."* So PD7 measured it — and the measurement is the reason
this phase did not ship a broken narrator.

`model_meta` is written from the API's **own** `usage` block via a metering proxy around the client:
one interception point sees **both** stages, and `briefing/extract.py` never learns it is being
counted (a module that reads articles should not also be a ledger). **Token counts are measured;
only the dollars are arithmetic.**

### The three real dispatches

| run | Sonnet calls | out tokens | notes | context sections | cost |
|---|---|---|---|---|---|
| **1 — v2 as written** | 2 | **16,384** (= 2 × 8,192, the cap **dead-on** twice) | **0** | 0 | $0.4344 |
| **2 — cap raised** | 1 | 5,281 | 14 | 7 published *(all padding — see §6)* | **$0.2253** |
| **3 — ids out of prose** | 1 | 6,528 | 15 | **0 — and 0 is the honest answer** | $0.2444 |

**Run 1 published ZERO notes to production, and the entire test suite was green while it happened.**

Production went from 5 notes (Jul 10, pre-PD7) to none. Two things ate the budget, and only one was
obvious:

1. **v2 output is bigger** — 8 clusters now also carry a 420-char `context` and a `watch` array. But
   that is only ~1,000 extra tokens against a ~4,000-token response; it could never have reached
   8,192 alone. Plan 9.3 said *"output cap rises to fit 8× context sections"* and PD7 missed the line.
2. **`max_tokens` caps THINKING PLUS TEXT, and Sonnet 5 thinks by default.** On Sonnet 4.6 a request
   that omits `thinking` runs with it **off**; on Sonnet 5 the identical request runs with **adaptive
   thinking**. That default changed with the **model**, not with our code. Reasoning tokens were
   quietly consuming a budget sized for the JSON alone. *Nothing in `narrate.py` asked for thinking;
   it simply started happening.*

This is the **same bug** `narrate.py`'s own comment was written for, one cap-size up:

> "4096 was too tight and it failed SILENTLY, which is the worst way for a token cap to fail… Run out
> mid-object and the response is a TRUNCATED JSON document — which the tolerant parser cannot
> balance, so it reports 'malformed' and the page loses all its prose, **with nothing anywhere saying
> 'you ran out of room'**."

Fix: `_MAX_TOKENS` 8192 → **16000** (room for ~12k of reasoning above a ~4k response, still under the
line where a non-streaming request risks an SDK timeout — no streaming rewrite), and
`output_config.effort = "medium"` to bound the reasoning so it cannot expand to fill the new
headroom. **Medium and not low:** the narrator *chooses* which computed stats belong in a
two-sentence context, and Sonnet 5 respects low effort strictly enough that under-thinking is a real
risk on exactly that judgement.

**The fixed run is cheaper than the broken one** ($0.2253 vs $0.4344) — the failed retry was pure
waste — and it beats 0.2.3's estimate.

### Measured against 0.2.3

| | 0.2.3's estimate | measured (run 2) |
|---|---|---|
| news-stage LLM, per night | ~$0.33 + $0.03–0.06 delta ≈ **$0.36–0.39** | **$0.2253** |
| extraction (Haiku 4.5) | — | 60 calls · 67,405 in / 7,058 out = $0.1027 |
| narration (Sonnet 5) | — | 1 call · 14,450 in / 5,281 out = $0.1226 |

**Under the estimate**, and now measured every night, forever. One honest wrinkle, stated rather than
buried: Sonnet 5 is running an **introductory** rate ($2/$10 per MTok) through 2026-08-31, while
`config.py` carries the **list** price ($3/$15). So the printed figure is an **upper bound** — too
high, never too low. The alternative was a table that silently goes *wrong in the under-reporting
direction* on 2026-09-01, on a night nobody is watching, and **a cost instrument that under-reports
is worse than none, because it is trusted.**

---

## 6. THE SENTENCE THAT SHIPPED — and why only looking found it

Run 2 succeeded. Every instrument said the night was healthy: *"14 notes written, 0 dropped by the
gate, 7 context sections published."* The schema validated. The tolerance gate cleared every figure.
The E4 lexicon passed it.

Then I read the prose it had published to production:

> "This story is carried by 1 outlet tonight
> **(cls:798fa63d458eaeca83850221b351fe71ed9cddae:corroboration)**."

**A sha1 hash, in a sentence a human is meant to read.**

Every number in it is true. The citation is correct. And the cause is a *fair reading of our own
prompt*: the model was told each number "appears VERBATIM in the inputs and **is cited by its
stat_id**", so it wrote the stat_id where the reader could see it. The note has carried a `citations`
**array** since N4 whose entire purpose is to hold those ids away from the prose — and nothing had
ever said so out loud.

Fixed at both ends, because **a prompt is a request and a gate is a rule**:
- the prompt now says where citations *go* ("write the VALUE, put the ID in `citations`");
- `lexicon.py` enforces it **deterministically** — any registry id (`tkr`/`cls`/`cal`/`sector`),
  `doc_id`, `cluster_id` or bare hash inside a prose section **drops that section**. There is no
  sentence in which a reader benefits from seeing one, so this needs no judgement call.

PD7's brief named the fixture night and the real dispatch as this phase's **pictures**: *"Print them.
Read them. A schema that validates is not a schema that says something true."* It was right, and this
is the proof: **no test in this repo could have caught it, and every guard we own passed it.**

### The context count went 7 → 0, and 0 is correct

Run 3's clean prose also published **zero** context sections, down from run 2's seven. That looks
like a regression and is the opposite. Run 2's seven "contexts" were the padding above — the
citation restated as a sentence ("carried by 1 outlet tonight (cls:hash…)"). With that route closed,
the narrator returned honest nulls, and it was right to: **tonight's top 8 clusters are all
macro/geopolitical stories with `tickers=[]`** (oil, Hormuz, EU sanctions), so the ticker-driven
registry gives them no vocabulary and there is genuinely no context to write. **Zero padded contexts
beats seven, every time.**

Reading run 3's record surfaced one more real bug, this time in arithmetic: **13 sections reported
`silent`** on a page where only 8 clusters are ever deep. The fully-silent early return was marking
*every* section `silent`, including `context` on clusters that were never in the budget — telling
PD8's story page "the narrator had nothing to add" about a section nobody ever asked for. The
`sections` map exists precisely to distinguish absences that print identically; it may not be sloppy
about which one this is. A cluster outside the top 8 now correctly reports its context and watch as
`out_of_budget`, and only a *deep* cluster's honest null reports `silent`.

---

## 7. The fixture night — four pinned shapes, and two lies it was already telling

| # | cluster | shape |
|---|---|---|
| 1 | `nc-fda-nonopioid` | **full v2** — context + 2 watch rows + model_meta |
| 2 | `nc-smci-earnings` | **gate-dropped context** — the narrator invented "94.2%"; the section died, the why-line lived |
| 3 | `nc-amd-acquisition` | **honest silence** — a deep cluster whose narrator had nothing to add |
| 4 | `nc-uber-expansion` (+ the tail) | **pre-PD7** — none of the new fields, which is what most of production looks like |

Shape 1 is deliberately the **only seeded story with three catalyst links**, so it is the only one
whose affected table renders any rows — PD6 learned the hard way that a 21px touch target lived on
the story page for a whole phase because the sweep visited `nc-fed-hold`, which has **zero** links,
so the table rendered nothing and there was nothing to measure. **The rule was being kept by the
shape of a fixture.** Q-PD6-2 is now half-solved: PD8 has somewhere real to point its sweep.

**Regenerating the fixture found it had been modelling prose its own producer would refuse:**

- Two `whyItMatters` lines carried **uncited frequency adverbs** ("an approval of this class
  *usually* re-prices…", "it *rarely* changes this quarter's revenue"). E4's lexicon deletes both.
  The fixture was seeding output the pipeline can no longer emit — *the exact sin the JPM row's own
  comment was written to name.*
- The FDA row's first draft claimed the gate had cleared a **"2"** it never saw — `2nd` is an
  **ordinal**, and `verify.py` has refused to read one as a number since N5. A fixture claiming a
  cleared figure the gate never cleared would license PD8's `KeyFigure` to set an **unverified number
  in the "this was checked" typeface** — the exact bug E5 exists to prevent, seeded into the app's
  own test data.
- Its watch rows pointed at a **`cal:LLY:next` that does not exist** in the seeded calendar — i.e. a
  *resolved* row seeded in the shape of the **dangling ref the gate exists to drop** — and gave CPI a
  date it does not have.

All three were caught by **running the real gate over the fixture's own prose**, then querying the
seeded database to confirm each watch row resolves to a real calendar event. Both now do.

---

## 8. The database test that did not exist

**`publish_news`'s COLUMN WRITE had no database test at all.** The only test touching it was
`test_publish_invariant.py`, which asserts it *refuses* a non-session date — a guard on the door, not
a check of what gets carried through it. The INSERT's column list, its `ON CONFLICT` clause and the
JSON adaptation of every payload were covered by **nothing**. A misspelled column, an unbound
parameter, a silently dropped field: the suite stays green and production finds out.

Survivable while the shape was stable. Not survivable when a phase adds three columns.
`test_publish_news_depth.py` writes a row and reads it back — including the v1-shaped caller (the
night the narrator never ran), which must keep publishing exactly as it always has.

**And one more, found by the same instinct:** `lib/news.ts` reads `verification.dropped` to tell the
reader *"the gate held this line"* apart from *"the narrator had nothing to say"*. The v2 shape
replaced that key with a richer `sections` map. **PD7 ships to production BEFORE PD8 builds the
surfaces that read `sections`** — so the live story page would have gone blind on the first night,
and *nothing would have failed*, because the app reads an absent key as `false` and would have
calmly told the reader the narrator was silent about a line the gate had killed. The v1 key stays;
`sections` is added **alongside** it.

---

## 9. VRT — a pipeline phase that moved ten pixels' worth of pictures

PD7 renders nothing new, and the prediction was stated before the run: **only the `/news` feed shots
move**, because two card sentences changed text under E4; **no `news-story-*` shot may move**
(`nc-fed-hold`'s prose is untouched); nothing else may move at all.

The rehearsal confirmed it exactly. **10 baselines re-shot** — `news-light`, `news-dark`,
`news-week`, `news-filtered` across desktop/phone/wide/mbp16. The phone page came back **20px
SHORTER**, which is the right direction for a deleted word (PD3's law).

**All 83 candidates were diffed against their committed baselines, not just the 4 failures** — the
law that has bitten this repo four times. **16 had changed; only 4 failed.** The other 12 are the
**camera, not the app**: the login gradient's dither (~17,500px — PD6 saw this same shot move too)
and 1–31px rasterisation jitter on `track-record`, `ticker` and `news-story`, all on pages this phase
never opened. Left alone: re-baselining a picture you cannot vouch for trades one unexplained image
for another.

---

## 10. What PD8 inherits

- **The allow-list is in the row.** `verification.cleared` (brief and per-section, per cluster).
  E5 is unblocked on the Desk and on the story page's context prose.
- **`verification.sections`** gives every absence a *reason*: `narrated` / `dropped` / `silent` /
  `out_of_budget`. The story page can finally say **why** a section is not there.
- **`watch` is snapshotted rows, not refs** — render it directly; it can never disagree with the feed.
- **`model_meta`** — the provenance footer can stop hardcoding "Claude Haiku" and print what ran.
- **Q-PD7-1**: sector breadth needs the lake threaded into the newsdesk, or its own migration.
- **Q-PD6-2 is half-solved**: point the touch sweep at `nc-fda-nonopioid` (3 links, an affected table
  with rows) instead of `nc-fed-hold` (zero links, nothing to measure).
- **`/news` bundle headroom is unchanged** — PD7 spent none of it. PD9's overlay still has to fit.

---

## Gate size at `pd-7`

**28 drift rules · 83 VRT baselines · 25 e2e specs · 710 app unit tests · 610 pipeline tests
(+75) · 16 bundle baselines · 14 manifest rooms · 4 oracle legs · tag run 6m 43s (`306e1c8`,
run 29374389350, green on all four legs first try).**

The gate grew by **74 pipeline tests and one migration**, and no drift rule. Three of those tests
exist because a **real dispatch to production** found what no fixture could: a token cap the schema
had outgrown, and a sha1 hash in a sentence meant for a human. The rest exist because the fixture
night, once regenerated, turned out to have been modelling prose its own producer would have refused
to publish.

**Every instrument in this pipeline reported a healthy night while it was publishing hashes.** The
only thing that caught it was reading the output.
