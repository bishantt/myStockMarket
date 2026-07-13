# N4 — the news data layer: what the providers actually sent

*Recorded 2026-07-13 via `.github/workflows/record-fixtures.yml`. Every number below was MEASURED
against a real response, not predicted from the plan. Four of them contradicted the plan, and in each
case the tree won on the detail.*

---

## 1. The recordings

| Fixture | Endpoint | What came back |
|---|---|---|
| `finnhub/news_general.json` | `/news?category=general` | **100 items**, sources: Reuters 75, Bloomberg 13, CNBC 12 |
| `finnhub/news_general_minid.json` | `/news?category=general&minId=8200027` | **54 items** — the forward-filter probe |
| `finnhub/news_merger.json` | `/news?category=merger` | **60 items**, sources: GlobeNewswire 39, SeekingAlpha 20, BusinessWire 1 |
| `marketaux/news_market.json` | `news/all?countries=us&filter_entities=true&must_have_entities=true&sort=published_on` | **3 items** (`meta.returned: 3` against `meta.found: 3,481,263`) |
| `goldapi/xau_usd.json` | `GET /api/XAU/USD` | **HTTP 200** — the real success shape, at last (P-5) |

Neither Finnhub market endpoint had ever been called by this repo before. The company-news fixture
that existed is a **different endpoint** and, as it turned out, behaves differently in the one way
that mattered most.

---

## 2. The four findings that changed the build

### 2.1 Finnhub's market news carries NO tickers — 0 of 160

`related` is an empty string on **all 100 general items and all 60 merger items**. On company news it
is populated on **20 of 20**. Same provider, same adapter, different endpoint.

This is the finding that reshaped N4. The market feed is the Front Page's main source, and the plan's
clustering rule required *"overlapping ticker sets"* while its significance formula measured magnitude
*"over the linked tickers"*. Applied literally: two empty sets never overlap, so **nothing would ever
cluster**, and every cluster would score the magnitude floor.

**Consequence:** `newsdesk/resolve.py` — deterministic entity resolution against the instrument table.
No model involved: a wrong ticker link is a card telling the reader a story is about a company it never
mentions, beside a real price move.

Measured on the full 160-article night, with every trap name loaded into the universe (Target, Gap,
Visa, Key, Match, C3.ai): **zero false positives.** The four links it made are all real mentions —
`AAPL` (summary: "Apple lands a big price target hike"), `TSM` ("Earnings at Taiwan Semiconductor
Manufacturing Co."), `NVDA`, `CRM`. Against production's full instrument table the same code produced
**141 catalyst links across 186 clusters**.

The sharpest trap is `AI`: it is simultaneously this decade's biggest market theme and a real listed
company (C3.ai). A bare-uppercase rule accepting two-letter tokens would have tagged every AI story in
the feed as a story about C3.ai — dozens of false cards a night, every one plausible.

### 2.2 `minId` is a forward filter, not a page cursor

The plan's budget bought **2 Finnhub calls** for the general feed, "the second with `minId` pagination",
expecting ~100–200 items.

- `minId` **below** the oldest id held → the **identical 100 articles**, byte for byte.
- `minId` at the **median** (8200027) → **54 items**, all with ids above it.

So `minId` means "ids greater than X". There is no way to reach further back than the newest ~100. **The
second call fetches nothing new.** The ingest budget is one call per category.

*(A subtlety worth keeping: the 54 are not a strict subset of the 100. Two carry ids above page 1's
maximum — articles published in the seconds between the two calls — and three sit inside page 1's id
range yet were absent from it, because the default call returns the newest 100 by PUBLISH TIME while
`minId` filters by ID, and Finnhub does not issue ids in strict publication order. A live feed is not a
frozen list.)*

### 2.3 43% of the merger feed is UK regulatory paperwork

**26 of 60** merger items are UK Takeover-Panel **Form 8.3 / 8.5** disclosures — "Form 8.3 - Picton
Property Income Limited", "Man Group PLC : Form 8.3 - JTC Plc". Mandatory compliance filings. Not
catalysts.

Left unfiltered they do specific damage rather than general clutter: the **M&A filter chip** — one of
the ten the room offers — would have been almost entirely paperwork about UK property trusts, and each
filing would have collected the **M&A class prior, the highest there is**, for being filed.

Same disease R0 found in the Session Calendar (which ingested every FRED release and printed "Coinbase
Cryptocurrencies" as a market catalyst). Same cure: a denylist at the write path, checked in, tested,
and deliberately **narrow** — `newsdesk/noise.py` names the boilerplate families it knows and keeps
everything else, because wrongly dropping a real story (which the reader never learns existed) is far
worse than wrongly keeping a dull one (which ranks low and sits at the bottom).

The 34 survivors are real M&A: VitalHub/Buddy Healthcare, TransDigm/Stellant, Baker Hughes/Chart
Industries, Conmed takeover interest, Saipem/Subsea 7.

### 2.4 The merger feed's "sources" are press wires, not newsrooms

GlobeNewswire (39), BusinessWire (1). A company **pays** these to carry its announcement verbatim; they
do not decide whether it is worth carrying — which is the entire thing corroboration measures.

VitalHub's acquisition appears **twice**, under two wire names. Counted naively that is "2 sources", and
the significance formula would pay the story for its own press office's distribution budget — ruling C1's
failure mode wearing a costume.

`newsdesk/outlets.py` collapses every PR wire into a single `press release` bucket. Three wires carrying
one announcement = **one source**. A wire *plus* Reuters = two, and the second one is evidence.

---

## 3. The clustering threshold was MEASURED, not chosen

The plan set Jaccard ≥ 0.55. Run against the 134 real articles that survive the boilerplate filter:

| Threshold | Clusters | Multi-article merges | Verdict |
|---|---|---|---|
| 0.70 | 134 | **0** | inert |
| 0.55 *(the plan)* | 134 | **0** | **inert — clusters nothing at all** |
| 0.50 | 132 | 2 | both correct |
| **0.45** | **131** | **3** | **every true merge, no false one** |
| 0.40 | 129 | 4 | **fabricates** |

**At the plan's threshold the clusterer does nothing.** Not "a few misses" — zero merges out of 134. The
Front Page would have printed every story once per outlet, and its "3 sources" line would never once have
appeared, while every test stayed green.

Why 0.55 fails: *"VitalHub acquires Buddy Healthcare"* and *"VitalHub Announces Acquisition of Buddy
Healthcare"* score **0.50** — because `acquires` and `acquisition` are different tokens. A bar that high
is not strict, it is **inert**.

The three true merges at 0.45:
1. VitalHub acquires Buddy Healthcare / VitalHub Announces Acquisition of Buddy Healthcare
2. Trump says US agreed to Iran's request to continue talks / Iran has asked to continue talks and the US agreed, Trump says *(one newsroom rewriting its own headline an hour later)*
3. Baker Hughes wins E.U. approval for Chart Industries deal / Baker Hughes set to win conditional E.U. approval

**What 0.40 does, and why the number is not a matter of taste:** Qiagen, Conmed and Tiny Ltd collapse
into **one cluster** — three different companies, three different deals, one card — because all three
headlines contain the phrase *"jumps after report of takeover interest"*. That is a fabricated connection
presented as fact, and it lives **0.05** away. The threshold is pinned by tests from both sides.

**The tickers' honest role is a VETO, not a requirement.** "Apple beats on revenue" and "Microsoft beats
on revenue" are near-identical strings (Jaccard 0.67) about different companies. No amount of word
agreement may join them. Where both items name companies and none is shared, they never merge.

---

## 4. The front page the formula actually produces — and its honest weakness

On the recorded night (a day of Gulf escalation), the top of the page:

```
 1. [0.662] macro  1src NVDA  US makes it easier to export Nvidia AI chips and military equipment
 2. [0.600] macro  1src  —    Tech stocks skid, bond yields rise as Gulf conflict sends oil surging
 3. [0.600] macro  1src  —    Dollar wavers amid renewed Iran attacks, yen slides
 …ten more at exactly 0.600…
```

**The good news:** scope is the biggest term, so a market-wide event leads even though it names no
company. A feed ranked by ticker moves — or by clicks — would have buried the Gulf story under a
price-target change. That is what "edited by evidence" means in practice, and it works.

**The finding that must not be buried (see QUESTIONS Q-N4-1):** the deterministic signals on this feed
are **weak**, and the page ties.

- **corroboration ≈ 1 for 131 of 134 clusters** (only 3 merged — the feed has 3 outlets and few genuine
  duplicates)
- **magnitude = 0 for ~130 of them** (no tickers, so no move to measure)

Together that is **45% of the formula's weight sitting nearly constant**, so the order collapses onto
scope + class_prior — both derived from a keyword classifier. Result: **ten-plus stories tied at exactly
0.600**, and the lead slot decided by the publication-time tiebreak. In production the lead came out as
*"ONGC approves project to expand strategic crude reserve"* — an Indian oil company — ahead of *"Tech
stocks skid as Gulf conflict sends oil surging"*.

A first draft of the classifier made this worse and the bug was found **only by printing the page and
reading it**: *"Iran's IRGC navy says Strait of Hormuz closed until further notice"* — arguably the
biggest market story of the day — matched no keyword, was classified `other`, and sank to **0.165, dead
last**, while *"An emboldened India holds out for better terms in US trade talks"* **led the page** on
the strength of the words "trade talks". The macro vocabulary now covers what actually moves markets
(war, strait, oil, sanctions, shipping, missile). **The sixth real bug this build has found by looking at
the output rather than at the tests.**

---

## 5. Production, verified end to end

**News-mode dispatch** (`gh workflow run nightly-a.yml -f mode=news`), 2026-07-13:

```
job_a (news): 2026-07-10 — 218 articles in, 26 regulatory filings dropped,
              186 stories published, 126 past the extraction cap.
              Sources: {news-finnhub: ok, news-marketaux: ok, news-images: not_configured}
```

Live database: **186 `news_cluster` rows, 141 `catalyst_link` rows.**

**Gold (P-5), closed end to end.** The secret alone was not enough — `nightly-a`'s env block never passed
`GOLDAPI_KEY` to the job, so the cell would have printed "not yet reported" that night and every night
after. The same shape as the `ANTHROPIC_API_KEY` bug that hid for four phases. After the fix, a macro-mode
run produced:

```
gold_usd   2026-07-13   value=4034.215   prior=4120.515   Jul 13   (goldapi)
```

The fabricated `xau_usd_UNVERIFIED.json` is deleted. It had got one real thing wrong: it stamped the quote
at **exactly midnight UTC**, as though gold arrived as a settled daily observation like CPI. GoldAPI stamps
the **live quote instant** (13:21:02 UTC in the recording) — the cell's as-of date is the day we *asked*,
not the day a session closed, which is why it is labeled an indicative spot reference.

---

## 6. What is NOT done in N4 (carried to N5)

- **Stage A write-back and Stage B-mini (the narrative line).** Every cluster currently publishes with
  `why_it_matters = null`, which the schema and the card design already treat as a first-class state ("a
  null here prints NOTHING — never a placeholder"). The facts, the ranking and the links are all real; the
  prose layer is absent.
- **The image pipeline is built and tested but not wired to a bucket** (P-1 absent). `news-images:
  not_configured` is recorded on every run. Cards fall to the designed L3/L4 rungs, which are first-class
  outcomes by design.
- **`compute` mode** is deliberately not declared: it lands with N6, which builds the panel it belongs to.
