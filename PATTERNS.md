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
