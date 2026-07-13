# N5 — the Front Page: what the room actually does, and the four things it found

*Written 2026-07-13. Every claim below has a test, a measurement, or a production run behind it.
Where the plan and the tree disagreed, the disagreement is recorded with its reason.*

---

## 1. What shipped

| Surface | Route | What it is |
|---|---|---|
| The room | `/news` | The feed: a lead card, uniform rows, catalyst + sector filter rows, Today/This week, pagination, "Moved without a story", the press-time and cadence lines. |
| The story | `/news/[cluster]` | One story in full: the named sources, the image, what happened, why it matters, the numbers, the affected-ticker table, the Academy doorway. |
| Module 08 | `/` (the Desk) | A bounded preview — top 3 by significance, its own stated cut, one doorway. |
| The bar | everywhere | News is the sixth room (Part 0.1, option A — the plan's default; no DECISIONS line overrode it). |

**The narration carry-over from N4 also closed here**: Stage A (Haiku, ≤60 clusters) and Stage B-mini
(Sonnet, one call), with the briefing's own verification gate reused on every note.

---

## 2. The claim the room makes, and the test that can falsify it

**The lead is a POSITION, not a prize.** The seeded night exists to make that refutable:

```
 1. [0.800] macro     5 src  (no tickers)   Fed holds rates steady, signals patience on cuts
 2. [0.740] fda       4 src  MRNA LLY PFE   FDA approves first non-opioid painkiller
 3. [0.620] earnings  3 src  SMCI +18.4%    Super Micro beats on AI server demand
```

SMCI rose **18.4%** — the largest move on the tape — and it ranks **third**, behind a Fed statement
that moved nothing at all. If a change ever lets the big number float to the top, the e2e goes red.

**Filtering is subtraction, never sorting.** It would be one line to "float the matching stories to
the top", and that would quietly turn the reader's attention into an editorial signal — the exact
thing ruling C1 forbids. The pipeline's order is the only order, and a filtered page states what it
is hiding in its own count line ("2 catalysts · FDA · Health care").

---

## 3. The four findings

### 3.1 The corroboration count could not be OPENED

`news_cluster.sources` is a bare `Int`. The card whispers "5 sources" — and **nothing anywhere named
them.** No outlet on the card, and the story page's source list (the *first line* of its spec) had no
data to render at all.

That is not a cosmetic gap. Corroboration is the **second-heaviest term in the significance formula**
(25%), so the number that does the most work in ranking the page was a number the reader simply had
to believe.

**The plan said these live in `news_item`. They cannot.** Job B reads every `news_item` row in its
window and **synchronously extracts every id that was not in the nightly batch**. Writing the
market-wide feed there would fire ~200 extra Haiku calls a night AND feed the entire market feed into
the evening briefing's synthesis. That is a different product, not a schema detail.

**The fix:** `news_cluster.articles` (Json), snapshotted at publish — the same discipline
`catalyst_link` already keeps, and for the same reason: the feed and the story page must never be
able to disagree about what a story was built from.

**The seed now checks itself.** A cluster whose `sources` count disagrees with the number of articles
behind it makes the seed *refuse to load*. Without that, the card would print "5 sources" over a list
of two and every test would still pass, because no test compared those two numbers.

### 3.2 The room would have shipped UNCACHED, with a `revalidate` that did nothing

`/news/[cluster]` re-rendered on **every request** despite carrying `export const revalidate = 600`.
A dynamic route needs `generateStaticParams` — even returning an empty array — or the framework
silently renders it on demand and the `revalidate` line does nothing at all.

`/ticker/[symbol]` documents this exact trap in a comment written when F1 hit it. **The story page
fell into it anyway.** It was caught by the B1 routes budget, not by eye, and not by any test — the
page worked perfectly, it was just rebuilt from scratch for every reader.

Result: **12 of 13 product routes served from a cache** (settings is the allowlisted writer).

### 3.3 "3h ago" would have been a lie

The plan's card anatomy asks for a relative timestamp (`{h}h ago`, absolute past 24h). On an
ISR-cached page a relative timestamp is computed **when the page is BUILT** and then served, frozen,
to every reader after.

This build has now shipped that exact bug **twice** — F4's cooling-off stamp (a "now" interpolated on
the server, recording when the page was generated rather than when the reader clicked) and N4's
"markets open" strip (a Desk built at 3:55pm telling readers the market was open long past the
close). Both times the string was well-formed and simply false.

**Article timestamps are absolute, in ET.** They cannot rot. The room states its press time at the
top, so between the two the reader knows exactly how old everything is — which is more than "3h ago"
ever told them.

### 3.4 The plan's filter chips could not reach every story on the page

Appendix B's chip list is: Earnings · Guidance · M&A · FDA · Fed/Macro · Analyst · Filings · Legal ·
Product. The classifier's tenth class — **`other`, the escape hatch that exists so it never has to
force a bad fit** — has no chip, and on the real feed a good many stories carry it.

Ship the list verbatim and the reader sees "40 catalysts", adds up the chips, reaches 37, and has no
way to open the missing three. **A filter row that cannot reach a story sitting on the page is a cut
nobody stated** — the same disease as ruling M8's unlabelled slice.

The chips are **derived from the feed** now, so they cannot drift away from the data again. A unit
test asserts that every story on the page is reachable by some chip; the e2e clicks every chip in
turn and asserts the counts sum to the whole page.

---

## 4. The amendments to the plan, and why each one is in an honesty rule's favour

| # | The plan said | The tree does | Why |
|---|---|---|---|
| 1 | `copy.news.ordering`: "scope, corroboration, and the size of the move it explains" | Names the three signals **and says the page ties, oldest-first** | Measured (Q-N4-1): corroboration is 1 for 131 of 134 clusters and magnitude is 0 for ~130. Nearly **half the formula's weight barely varies**, and ten-plus stories routinely tie at exactly 0.600. The old sentence promised a ranking the data cannot support. Inventing a tiebreaker — a "US-market relevance" term — would be the app forming an editorial opinion, which is what C1 forbids. **Change the words, not the ranking.** |
| 2 | Extract written back to `news_item.extract` | Written to `news_cluster.extract` only | See 3.1: `news_item` is the movers' catalyst table, and Job B sync-extracts everything in it. Evidence-backed, not a preference. |
| 3 | Stage A via Message Batches, collected by Job B | Stage A **synchronous**, inside the news stage | The whole page — facts AND prose — lands in ONE publish transaction. Split across two jobs, `publish_news`'s own upsert (`why_it_matters = EXCLUDED.why_it_matters`) would NULL out prose written by the later job every time news mode ran. Cost of the difference: ~$18/year. |
| 4 | Stage A cap ranked by "pre-LLM salience" (corroboration, then magnitude) | Ranked by **significance**, like Stage B | Measured: **8 of the 20 narrated clusters were never read by the extractor** — and they were the eight biggest stories of the night, the whole Gulf/Hormuz/oil cluster. The circularity the old rule defended against does not exist in this tree (`rank.classify_event` is deterministic and runs pre-LLM). The narrated set is now a subset of the extracted set BY CONSTRUCTION. |
| 5 | L3/L4 generated cards tinted **by sector** | One restrained ground; distinguished by **typography** | Twelve sector hues is twelve colours whose only job is decoration. UI-REDESIGN-PLAN (which outranks this plan on looks) says colour is scarce and always means something. A reader cannot learn twelve hues, so they would carry no meaning and would only add noise beside the two colours that DO mean something here — up and down. |
| 6 | "This week" shown **disabled** when the archive is shallow | Always enabled; the window **says how deep it goes** | A shallow archive does not make the week meaningless — it makes it short, and "everything I have, which is less than a week" is a true and useful answer. Disabling it would hide the coverage the app actually holds behind a greyed-out button. (The plan's own copy string, `weekUnavailable`, reads "showing all of it" — it was always a note, not a refusal.) |
| 7 | Relative timestamps on cards | Absolute ET timestamps | See 3.3. |

---

## 5. The narration (N4's carry-over), and the bug it found in the briefing's gate

**Stage A** — Haiku, one representative article per cluster, capped at 60, through the *existing*
`briefing/extract.py` prompt, schema and parser. **Stage B-mini** — Sonnet, ONE call for the page,
top 20 clusters. **The gate is the briefing's own**, reused rather than re-implemented:
`verify.py` now exposes `build_source_set` + `check_text`, so there is exactly ONE definition of
"what counts as verified" in the system. Two definitions would be one too many — the day they drifted
apart, one surface would start publishing numbers the other would have refused, and no test would say so.

**The narrator is never shown a rank.** A test asserts the significance score does not reach the
prompt. If it did, the model could write prose that justifies the ordering — the app forming an
editorial opinion by the back door.

**The verdict is harsher than the briefing's, and it should be.** The brief tolerates up to two flags
across a whole page of prose, because holding the entire briefing over one bad figure costs the
reader everything. A note is one sentence: dropping it costs the reader that sentence, and the facts
on the card stand without it. So **any** flag drops the note — and the sentence beside it too,
because a model that invented one figure has not earned the benefit of the doubt on the next one.

### The gate turned "2.1x" into the phantom number "2", and flagged it

The bare-number rule refuses a number glued to a letter, so "Q3" is not the number 3 — correct. But
faced with a **decimal** glued to a letter it **backtracked to a shorter match** instead of refusing
the token: `2.1x` produced the number `2`.

"2.1x its usual volume" is exactly how anyone writes relative volume, and 2.1 is a figure the
pipeline actually computes and hands the narrator. The gate would score the phantom `2` against the
sources, find nothing, and delete the note.

**So every honest note about relative volume would have been silently thrown away** — and a deleted
note prints nothing (P9), so *nothing on any screen would ever have told us*. This is the whole
reason the module counts its outcomes and the night prints them.

Fixed for both surfaces: a multiplier is now a first-class number (checked — so a made-up `9.9x` is
still refused), and the quantifiers are possessive so a decimal welded to letters yields no entity at
all instead of a phantom one. **The evening briefing had this bug too.**

---

## 6. What the room renders TODAY, and it is not a corner case

**The media bucket does not exist (P-1).** The pipeline records `news-images: not_configured` on
every run and stores no images. So **every card on the live Front Page renders the L4 generated
catalyst card** — the room is carried entirely by its bottom rung.

That is exactly why the rungs were built properly rather than as empty states. The claim they make —
*"a text-treatment card next to a photo card reads as an editorial choice, not a failure"* — is only
ever true or false in a picture, and no DOM assertion can hold it. The styleguide renders all four
rungs side by side and the pixel oracle locks them.

Every article in the recorded feed **did** carry a publisher image (160 of 160), so L1 will answer for
nearly every card the moment a bucket exists — **a secret and one environment variable, not a code
change** (`NEXT_PUBLIC_MEDIA_BASE` feeds both the pipeline's URL construction and the app's image
allowlist, so the two cannot disagree about where images live).

**L3 (publisher identity) is a latch, not dead code.** A favicon must be fetched once per domain into
our own bucket with the same etiquette as any other image — hotlinking one at render is what 7.9
forbids — so it has no producer until P-1 lands. The branch exists and the styleguide exercises it.

---

## 7. Guards added

- **Drift rule 20** — one door for imagery: news visuals render only through
  `components/news/NewsImage.tsx`. **Negative-controlled** (a planted second `next/image` consumer
  fails it; removing it passes). Rationale: etiquette (fetch at ingest, never hotlink), layout shift
  (explicit width/height is what makes CLS zero by construction), and the fallback rungs (a second
  consumer would render an empty box and call it a failure state).
- **The seed asserts its own consistency** — `articles.length === sources`, or it refuses to load.
- **Bundle baselines** recorded for `/news` (184.2 KB) and `/news/[cluster]` (161.6 KB); the
  styleguide rebaselined 180.7 → 187.9 (the four image rungs joined the living spec).
- **axe** runs on `/news` and `/news/[cluster]`, both themes, both device sizes.
- **VRT**: the room and one story in both themes, plus the filtered, zero-state and week-view
  pictures, plus the four image rungs in the styleguide.

---

## 8. Counts at `nc-5`

| | |
|---|---|
| App unit tests | **537** (was 507) |
| Pipeline tests | **436 local, 22 skipped** (was 409) |
| Anti-drift rules | **20** (was 19) |
| B1 — routes cached | **12 of 13** (settings is the allowlisted writer) |
| B4 — worst first-load JS | **194.8 KB** against the 200 KB ceiling |
