# PATTERNS.md — recurring code & design patterns worth copying

Add an entry when you catch yourself copying something a SECOND time (plan §9.1). Reference
entries from code reviews. Write every entry in plain English — describe the pattern the way you
would explain it to a new teammate, and keep any code sample as the clear version, not the clever
one (CLAUDE.md, "Readability & documentation"). Format:

```
## <pattern-name>
Where it lives: <file(s)>
Shape: <the 3–6 line essence>
Use when: <trigger>
```

The plan pre-names four patterns expected to land here once they exist in code: the provider
adapter shape (P1), the SectionMasthead composition (P1), the server-action + zod + revalidate
write pattern (P1), and the useLightweightChart hook lifecycle (P1). Do not write them until the
first real implementation exists — this file records working code, not intentions.

---

(no entries yet — no code exists)

## provider-adapter
Where it lives: pipeline/adapters/base.py (TokenBucket, load_fixture, Adapter) + one file per provider (alpaca.py).
Shape: subclass Adapter with super().__init__("<name>", client, limiter); call self.get(url, params=) which rate-limits + raises on non-2xx; parse JSON into frozen dataclasses only (no business logic). Tests replay REAL recorded fixtures via httpx.MockTransport + load_fixture; the job (not the adapter) catches per-source errors for sourceStatus.
Use when: adding any data-provider adapter. Follow the new-provider-adapter skill.

## Design-system patterns (added during the UI redesign, 2026-07-12)

**The honesty rule goes where the number goes.** If a visual IS a base rate — a proportion bar, a
dot array — then it lives inside `BaseRate`, because the N-gate, the interval, the baseline and
the WEAK cap have to travel with it. A guardrail that a component can be rendered *without* is a
guardrail that will eventually be rendered without. Put the rule inside the thing it governs, and
grep for strays.

**Enforce structurally, not by discipline.** "Probability visuals never move" cannot be enforced by
remembering it: the redesign now allows hover-lifts and drawer slides, and a card is innocent until
the day someone puts a base rate inside it. So every probability visual carries `data-p2`, and a
jsdom test walks UP from each one asserting no animated or transformed ancestor. The rule is
checked by the machine, at the only place it can actually break.

**A guard needs a negative control.** Every enforcement test in this codebase now includes a case
that proves it CAN fail — the P2 ancestor test wraps a real component in exactly the kind of
innocent hover-lift the design system permits elsewhere, and asserts the walk-up notices. Without
that case, a guard that silently stopped matching would pass forever.

**Derive the constant from the thing it protects.** The reserved amber–orange region is enforced by
a hue test. The band's bounds (17°–50°) are not a guess — they are measured from the six colours the
reservation exists to protect. A threshold chosen by eye would have been wrong by two degrees, which
is exactly enough to let the loss colour fail its own test.

---

## Escalating chrome: a surface that gets LOUDER as the news gets worse (N2)

The pipeline strip is the reference implementation, and the shape generalises to any status surface.

The failure it fixes is not "the card was too big". It is that the old card **looked identical on a
healthy night and on a night the pipeline had been dead for a week.** A status surface with one
appearance is not a status surface; it is a decoration that mentions status.

So the surface has a ladder, and the ladder is the design:

| rung | chrome |
|---|---|
| normal | one quiet line. No card, no masthead, no colour. It costs the page almost nothing |
| degraded | colour, plus the WORD, naming both what failed and what the reader is looking at instead |
| broken | the loudest thing on the page, undismissable, stating what every number on screen actually is |
| not-started | quiet. An empty database is not a failure; it is a system that has not run yet |

Three rules make it work:

1. **The quiet rung must be genuinely unremarkable.** Escalation only means something if the normal
   case is boring. A lamp that glows amber every Saturday is a lamp nobody reads by Tuesday — and
   then it is not there on the night it matters. This is why freshness counts in SESSIONS, never in
   days: a weekend is not staleness, a holiday is not staleness, and Monday morning is not staleness.
2. **The escalation is carried redundantly — colour, WORD, and ARIA role.** Status → alert. If it
   lived only in the hue, a screen-reader user would get the app's calmest voice on the worst night.
3. **The loudest rung cannot be dismissed.** A dismissible catastrophe notice is one that gets
   dismissed, once, and is then never seen again on any of the nights that follow.

The same shape now governs the sources footer: it sheds its card on an all-ok night and keeps it at
full strength, forced open, on a degraded one. **A surface that gets quieter as the news gets worse
is the inverse of the rule**, and it is the easy mistake to make while "tidying up".

## Cached data, live clock: what a cache may hold and what it may not (N2)

The Desk is cached. The pipeline strip renders on it. Grade the strip on the server and you grade it
with **the cache's clock** — so a render made Monday morning, when everything was healthy, is what
the reader is served on Tuesday. A pipeline that died overnight shows as "fresh" on their first
paint, silenced by the cache, by the one surface whose entire job is to catch exactly that.

The rule: **split the render by what is data and what is not.**

- The last completed run is DATA. It changes once a night. Caching it is correct.
- "Now" is NOT data. It is different for every reader and every visit. It belongs in the browser.

The implementation is the standard hydration-safe shape: the server's clock seeds the first paint (so
hydration matches its own HTML byte for byte), and a mount effect regrades against the real clock. On
a healthy day the two agree and nothing moves. On a bad day the page changes loudly — which is not a
layout-shift bug to engineer away; it is the page speaking up on the one day we want it to.

Ask this of any cached surface: *does anything here depend on when it is?* If so, that part is not
data, and the cache may not hold it.

## Test the JOINT, not just both sides of it (N2)

Nineteen tests on the freshness machine. Fifteen on the strip. All thirty-four green, and the Desk
could not render at all.

The loader serialised a `@db.Date` with `.toISOString()` — right for an instant, wrong for a date —
and handed `"2026-07-10T00:00:00.000Z"` to a machine that wanted `"2026-07-10"`. Every date built
from it was an Invalid Date, and the first formatter to touch one threw.

Every test passed because **every test constructed its own fixture, and every fixture was correct.**
The defect was in neither unit. It was in the joint, and **both sides of a joint can be individually
perfect while the joint is broken.** A test that builds its own inputs is structurally incapable of
seeing the seam where the real inputs come from.

Two habits fall out of it:

- **Write one test per seam**, feeding the real producer's actual output to the real consumer with no
  hand-tidying in between. It is the only test that can see this class of bug.
- **Make the consumer refuse bad input at its own front door**, with a message naming what it wanted.
  Otherwise the failure surfaces three components downstream, in a formatter that did nothing wrong,
  and the stack trace names neither the producer nor the consumer that actually disagreed.

## A budget expressed only as "no worse than last time" has a hole in it (N2)

Drift baselines (`baseline + slack`) catch a surprise. They cannot catch **accumulation**, because
drift is measured against the last thing that was accepted.

Every step of "it only grew a little, and here is why" is individually true and individually
defensible. Six of them puts the app 60KB over its real budget with a green gate the whole way, and
no single commit was ever wrong.

So a drift baseline needs an **absolute ceiling beside it** — the budget that was actually specified,
which no re-baselining can move. Drift catches the unexplained; the ceiling catches the accumulation
of the explained. When re-baselining is the right call (it sometimes is), land the ceiling in the
same commit.

## A fabricated fixture is an INVERTED test, not a weak one (N3)

A test with no fixture is missing. A test with a **hand-written fixture that looks recorded** is
worse than missing: it certifies that the code matches a fiction, and it hands you a green tick for
doing it. Three FRED fixtures in this repo were invented in R0 and spent three phases proving that
the parser agreed with someone's imagination — while quietly erasing a real property of the data
(the index series post a day ahead of the VIX).

**The rule: a fixture that was not recorded must say so in its own filename.** `xau_usd_UNVERIFIED.json`
cannot be mistaken for evidence by anyone, including its author six weeks later. And record the real
FAILURE when the real success is out of reach — GoldAPI's unkeyed 403 is a genuine recording, and it
pins the route and the auth header, which is two more facts than a beautiful invention pins.

## A staleness rule must count in the unit its source publishes in (N3)

Not days. Not sessions. **Whichever one the source actually uses.**

- Gold trades on market sessions → Friday's price on Monday is *zero sessions old*. Counting calendar
  days paints it amber every Monday, and a lamp that cries wolf every Monday is not there on the
  morning it is right.
- Nepal Rastra Bank publishes every calendar day, weekends included → for that cell a weekend IS
  three missed publications, and counting sessions would hide a real outage.

Two cells, side by side, opposite units, and each one wrong if given the other's. Before writing
"stale after N", ask what N is a count OF.

## Derive the label; never store it beside the thing it describes (N3)

A field whose value is a pure function of the field next to it is a future contradiction with a
timestamp on it. The Mood gauge's "greedy / fearful" arrow is a function of its percentile — stored
as its own field in the N0 seed, it had *already* drifted (48th percentile, labelled "greedy") before
anything rendered it.

This is ruling C6 (a provenance line must be composed from what actually rendered) applied inside a
data structure. Same disease, one level down. Derive at both ends, and a stored contradiction cannot
reach the screen.

## Derive the guard from the code, never from a checklist (N4)

Two production bugs in this build had the same shape: a secret existed in GitHub, the code read it, and
the workflow never passed it to the job. `ANTHROPIC_API_KEY` (four phases of silently-skipped LLM
stages) and `GOLDAPI_KEY` (a macro cell that would have said "not yet reported" forever). Both were
found by hand.

The pattern that makes them invisible: **good error handling hides them.** The pipeline degrades quietly
when a key is missing — correctly, since one dead provider must not take the night down — so the job
prints a calm line, carries on, and every gate goes green.

A checklist would have been a third thing to forget. So the guard reads the truth out of the code:
walk the import graph from each job's module, collect every `Settings` field it actually reads, and
fail if the workflow that runs that job does not pass one. `pipeline/tests/test_workflow_env.py`.

**The general rule: when a bug is found by hand twice, do not resolve to look harder. Derive the check
from the source of truth, and negative-control it so you know it can fail.**

## Measure the threshold against the real data; pin it from BOTH sides (N4)

The clustering bar was set to 0.55 in the plan. Against 134 real articles it merged nothing at all — an
inert clusterer, silently making the Front Page's central promise ("one story, one card, several
sources") impossible, with every test green.

Measured: **0.45 finds every true merge and no false one. 0.40 fabricates** — three unrelated takeover
stories collapse into one card because their headlines share a phrase. The correct value sits 0.05 from
catastrophe.

So the tests pin it in both directions: one asserts the true merges are found, another asserts the
specific fabrication that lives just below the line is refused. **A threshold with a test only on the
permissive side is a threshold that can drift into invention without failing anything.**

## Print the output and read it (N4 — the sixth time)

The clusterer, the classifier and the formula all passed their tests. Printing the actual front page
showed the biggest market story of the day — "Iran's IRGC navy says Strait of Hormuz closed until
further notice" — sitting **dead last at 0.165**, classified `other`, while a story about India's
negotiating posture led the page because it contained the words "trade talks".

Six real bugs in this build have been found this way and by no other means. The tests check that the
machine does what it was told. Reading the output checks whether what it was told was right.
