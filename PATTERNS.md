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

---

## A guard that cannot see the failure it was written for

Three of this build's worst bugs shared one shape: **the observable the test looked at was correct,
and the thing that was broken was not observable from it.**

- The journal's "Saving…" bug (F4) waited on a marker that renders in the form's INITIAL state, so
  the assertion was already true before the write happened.
- The Front Page's photographs (N5) rendered as broken-image icons while `<img>` was present,
  visible, correctly sized, and carrying the right `src`. **`naturalWidth` is the only thing in a
  browser that knows an image from a broken one**, and nothing was asking it.
- `_json_safe` (N5) returned a dict that *looked* right and could not be serialized. A shape
  assertion passes; `json.dumps` is what fails.

The pattern, and the cure: **assert the CONSEQUENCE, not the shape.** Did the textarea clear (not:
does a "Saved" marker exist). Did the image decode (not: is there an `<img>`). Does the payload
actually serialize (not: does it have the right keys). A shape is what the code produced; a
consequence is what the reader gets.

---

## The narrator's failure mode is SILENCE, and silence is indistinguishable from working

The Front Page's context line is null whenever the verification gate deleted it, and a null prints
NOTHING on the card — by design (P9: never a placeholder).

Which means a gate that was too strict, a Stage B that never ran, an extractor that read the wrong
stories, or a narrator with genuinely nothing to add **all produce exactly the same page.** Nothing
on screen can tell them apart, and neither can any test that only looks at the page.

Two of N5's bugs lived precisely there: the gate turning "2.1x" into a phantom "2" (which would have
deleted every honest sentence about volume), and the extractor never reading the eight biggest
stories of the night (which would have left the top of the page narrated from headlines alone).

**So every outcome is COUNTED, and the night prints the counts**: how many were attempted, extracted,
written, dropped by the gate, and left blank by the narrator. "0 notes" and "0 notes out of 20
attempted" are different nights, and only one of them is healthy. A count is the only instrument that
can see an absence.

---

## The vendor's documentation is not a recording (N6, 2026-07-13)

**The rule:** before you design around an API's response, make ONE real call and look at what comes
back. Not the docs. Not the plan. The wire.

N4 established "record the provider's real response before writing the parser", after four of the
plan's assumptions about Finnhub and Marketaux turned out to be wrong. N6 extends it in the direction
that hurts most: **the vendor's own official documentation can be wrong about the vendor's own API.**

GitHub's REST docs describe `POST .../dispatches` as returning **200 with a `workflow_run_id`**. The
plan repeated it. The live API returns **204 No Content, with an empty body**. There is no run id in
it, and there is no parameter to ask for one.

That is not a detail — it inverted the entire design. The run id has to be RECOVERED (stamp a request
id into the dispatch, print it into the workflow's `run-name:`, match it in the runs list) rather than
received. A two-minute `curl` produced a completely different architecture from the one the plan
imagined, and it produced it *before* any code was written rather than after a phase of it.

```bash
# The whole discipline, and it costs two minutes.
gh api -i -X POST repos/OWNER/REPO/actions/workflows/FILE/dispatches -f ref=main -f 'inputs[x]=y'
```

**The corollary, which is the expensive half:** an API that returns nothing gives you no way to know
what you just did. Any design built on it needs a way to answer "did that actually happen?" — and if
it does not have one, then *a thing that worked and a thing that never ran look identical*.

---

## A fake must be no kinder than the thing it stands for (N6, 2026-07-13)

**The rule:** when you write a test double, make it fail everywhere the real thing fails. Every
convenience you build into a fake is a bug you have agreed in advance not to find.

`FakeS3.download_file` began with `target.parent.mkdir(parents=True, exist_ok=True)`. Real boto3 does
not do that — it writes to a temp file beside the destination and raises `FileNotFoundError` if the
directory is not there. So `R2Store.sync_down`, which never made its directories, passed every test
for six phases and died in production on its first real execution.

This is the third form of the same disease:

| Phase | The lie was in the… | What it certified |
|---|---|---|
| N3 | **values** — hand-written FRED fixtures | that the parser agreed with my imagination |
| N5 | **shape** — a seed modelling JSON the pipeline never emits | that the app agreed with a fiction |
| N6 | **behaviour** — a mock kinder than boto3 | that the code works in a world that does not exist |

**A fabricated fixture is not a weak test — it is an INVERTED one.** So is a forgiving mock. It does
not fail to check the code; it actively hands you a green tick for being wrong.

**The tell:** ask what your double does that the real thing refuses to do. If the answer is anything
at all, that is exactly where the bug is. And: **a function with no real caller has no real test**,
whatever the coverage says — `sync_down`'s only true caller arrived in N6, six phases after the test
that "covered" it.

---

## Assert that it DESERIALIZES, not that it has the right keys (N6, 2026-07-13)

**The rule:** a payload crossing a JSON boundary must be tested by *round-tripping it through real
JSON and using the result*, never by inspecting the object you built in memory.

JSON has no `Date`. A server component hands a client real `Date` objects, so the first render is
perfect; the first `fetch` poll hands back **strings**, and the component throws where it formats one.
The control-room panel crashed on its very first poll, React kept the old DOM, and a real dispatched
run — accepted, executed, completed — left the screen looking exactly as though the button had done
nothing.

**And `as` is why TypeScript said nothing:**

```ts
const next = (await response.json()) as { rows: ActionRow[] };   // an ASSERTION, and it was false
```

`.json()` returns `any`. Every `as` on a parsed payload is a place where the type system has been
switched off and nobody wrote it down. **Convert at the boundary; never assert across it.**

This is the mirror of N5's `_json_safe` lesson — there, *does the payload actually SERIALIZE?*; here,
*does it actually DESERIALIZE into what the type claims?* Same boundary, opposite direction.

```ts
// The guard that catches it. It asserts the CONSEQUENCE (the thing still renders), because
// asserting the keys survived proves nothing — the keys always survive.
const revived = revive(JSON.parse(JSON.stringify(payload)));
render(<Panel {...revived} />);          // throws "Invalid time value" without revive()
```

## A sweep must prove it swept the room (N7, 2026-07-13)

**The shape.** A guard that walks a list of routes and measures what it finds — touch targets,
horizontal overflow, axe violations, contrast — is measuring *whatever is on the screen*. It cannot
tell the difference between "this room obeys the rule" and "this room did not render".

Every failure mode below is a clean pass:

- The route 404s (a seeded id on an unseeded database) → it measures **the error page**.
- The session lapsed → it measures **the login form**.
- The island had not hydrated → it measures **nothing at all**, and iterates over an empty list.

**And you cannot use the status code as the witness.** Recorded on this tree: a `notFound()` raised
inside a statically-generated route answers **HTTP 200 with the 404 page in the body**. Only a path
the router cannot match at all returns a real 404. A status assertion passes on precisely the page it
was written to refuse.

**The form:**

```ts
async function open(page: Page, route: string) {
  await page.goto(route);

  // The BODY is the only honest witness — the status lies (see above).
  expect(await page.getByText("This page could not be found").count(), `${route} is the 404 page`).toBe(0);

  // A lapsed session would put the login form under the ruler. Also clean. Also a pass.
  expect(new URL(page.url()).pathname, `${route} redirected`).toBe(route);
}
```

...and then **count what you measured**, and fail on zero:

```ts
expect(swept, `measured NO controls on ${route} — every room has a tab bar, so the page did not render`)
  .toBeGreaterThan(0);
```

**Why it keeps happening.** The three times this build has shipped it — `/paper`'s form hydrating
after the sweep queried, the chart's `figcaption` not yet code-split in, and the story page that was
never in the database — the guard was *correct*, the rule was *right*, and the answer was *green*. A
guard's own null result is indistinguishable from success unless you make it distinguishable.

**The rule: every sweep asserts that it swept something, and names the room it swept.** If it can
pass on an empty screen, it is not a guard; it is a decoration that fails only when you are unlucky.

## A fixture pinned to an absolute date, under a rule that is relative (N7, 2026-07-13)

**The shape.** The product asks a rolling question — *this week*, *the last 30 days*, *since the
last close*, *in the past hour*. The fixture answers it with a fixed timestamp. The two agree on
the day you write them and diverge every day after.

`/paper` counts "round trips this week" as `closedAt >= now - 7 days`. The seed dated its closed
trades `2026-07-02`, `07-06`, `07-07`. Watch it go:

```
nc-6      CI 2026-07-13 19:22Z → cutoff 07-06 19:22 → the 07-06T19:50 trade is IN  → count 2 ✅
nc-final  CI 2026-07-13 20:39Z → cutoff 07-06 20:39 → the same trade is OUT        → count 1 ❌
```

**The baseline expired at 19:50Z — 28 minutes after the run that last certified it.** Nobody
touched a line of code. The cost mirror silently halved (−31.2%/yr → −15.6%/yr) because half the
round trips had aged out of the year's projection.

**The trap inside the trap: re-shooting the baseline WORKS — for one day.** Then the next trade
ages out, the count reads 0, and the mirror goes to zero. A green re-baseline hides a fixture that
is still decaying. *If a re-baseline makes a failure go away, ask what it will look like tomorrow.*

**The rule.** *Anything a test pins — a pixel, a count, a sentence — must be pinned to something
that does not move on its own.* There is no fixed date that stays "this week" forever, so a fixture
claiming "two round trips this week" must say so **relative to the week**:

```js
const DAYS_AGO = (n) => new Date(SEED_NOW - n * 86_400_000);
closedAt: DAYS_AGO(3),   // inside the window, on every run, at every hour
closedAt: DAYS_AGO(11),  // deliberately outside it — the count must be able to be wrong
```

**Where else this lives.** The same phase found a *test* with the same fuse: the control-room e2e
asserted the `full` row always carries a reason, which is true while the market is open and false
after the close. It passed at `nc-6` (CI at 3:22pm ET) and failed at `nc-final` (4:39pm ET). **When
a test is time-dependent, the fix is almost never to pin the clock — it is to find the sentence
that was true all along.** There, it was: *the reader is never left with a row that neither works
nor explains itself.*

**Smell test.** Grep your fixtures for absolute dates, then grep the code for `now -`. Every place
those two meet is a fuse with a length you have not measured.

## If it cannot go red, it is documentation (G0, 2026-07-13)

**The shape.** A rule is real, correct, prominently written — and enforced by prose. A comment at the
top of a config file. A checklist line in a plan. A sentence in a skill. It is obeyed exactly as
often as someone happens to read it at the moment they need it, which at a phase exit, tired, is
close to never.

**Where this build has now found it.**

| The prose | What it could not stop |
|---|---|
| `ci.yml`'s header: "the tag list and the `if:` must be kept in step" | `gate-*` in the trigger, absent from the oracle — a tag that runs CI, goes green, and never opens a browser |
| Gate step 5: "run `check:drift`" | The rules ran in no CI workflow at all; a forgotten step was noticed by nothing |
| "Add the new route to the sweeps" | `/news` shipped in N5 and was measured by nothing until N7 |

**The tell.** Ask of any rule: *what turns red when I break it?* If the honest answer is "a person
notices," it is documentation. Documentation is useful — but it is not a gate, and it must not be
counted as one when you are deciding whether a phase is safe to exit.

**The repair is always the same.** Move the sentence into something that executes. The comment stays
(it explains *why*, which a test cannot), but a test now reads the same file and fails on the same
condition. `pipeline/tests/test_ci_tag_families.py` is the pattern: it parses the artefact the prose
was describing, asserts the invariant the prose asserted, and carries a negative control proving it
can fail.

**And when the guard gets confused, it goes red — it does not guess.** The tag-family test found
three jobs mentioning `refs/tags/` where it expected one (the new de-duplication conditions use the
same string to mean the opposite thing) and it stopped the build rather than picking a line to read.
A guard reading the wrong line is a guard that cannot fail, just better dressed.

**Smell test.** Grep your config files and plans for the word "must". For each hit, name the thing
that turns red. The ones with no answer are your next tests.

## Rehearse the gate, then tag (G1, 2026-07-13)

**The pattern:** if a check can only run in CI, do not let the *tag* be the first time it runs.
Give it a second door.

The browser oracle (e2e + VRT + PWA + axe) needs a browser, a seeded Postgres and a full build, so
it can only run in CI — and it was wired to run on phase-exit tags. That made the tag the first real
test of the phase. 52% of all tag runs failed. `nc-final` needed six pushes of one tag.

The fix is not a new job. It is **the same job with a second trigger**:

```yaml
if: startsWith(github.ref, 'refs/tags/gate-') || …
    || (github.event_name == 'workflow_dispatch' && inputs.job == 'e2e')
```

One `if:`, two doors. This matters more than it looks: a *copy* of the oracle could drift from the
real one and go green while the tag reds. There is one oracle, invoked twice, so a green rehearsal
is not evidence about the tag run — it is the *same evidence*.

**The ritual that falls out of it:** rehearse on the candidate SHA → green → tag *that SHA* → the tag
run confirms. `gate-1` was green on the first try, and that is the expected outcome now, not a
hopeful one. A suspected flake gets `gh run rerun <id> --failed`; **the tag never moves.**

**Two things this pattern breaks on its way in, both worth expecting elsewhere:**

1. **Concurrency by ref is not enough once a job has two doors.** A dispatch on main shares main's
   ref, so a ref-keyed `cancel-in-progress` group makes the rehearsal and the branch run kill each
   other. Key the group on `<ref>-<event_name>`. Two individually-correct features whose composition
   is a silent hole is the shape to watch for.
2. **`workflow_dispatch` inputs are validated against the workflow file on the TARGET REF.** A new
   input value must be pushed before it can be dispatched. Push, then dispatch, or take a 422.

## Shard by the axis the config already declares (G1, 2026-07-13)

`playwright.config.ts` already had three projects — `desktop`, `phone`, `wide`. The CI job ran all
three serially in one runner: 15 m 26 s, and 90% of every exit's wall-clock.

**The shard axis was already in the config. The matrix just names it:**

```yaml
strategy: { fail-fast: false, matrix: { project: [desktop, phone, wide] } }
…
run: npm run e2e -- --project=${{ matrix.project }}
```

`playwright.config.ts` is not edited and does not know it is being sharded. 15 m 26 s → 7 m 58 s.

**The serialisation rule survives because the reason for it does.** `workers: 1` exists because
seeded specs write to one shared database. Each matrix leg is a separate runner with its own Postgres
service container — three databases, no sharing — so the rule's *premise* is gone, not the rule. Each
leg is still one worker, still serial. **Before you parallelise something, find the sentence that
justified the serialisation and check whether it still describes the world.**

The trade is booked, not hidden: billed minutes rise ~26% (three legs each pay their own setup),
wall-clock falls ~46%. Wall-clock is what a human waits for, several times per exit.

## Silence the checks that cannot discover anything — then prove the silence has an edge (G2, 2026-07-13)

**The pattern:** a check earns its place by what it *could* discover, not by what it verifies. When
you find one that can discover nothing by construction, delete it — and then go looking for the one
place where "delete it" quietly means "delete the gate."

Docs-only commits were paying full CI: typecheck, lint, drift, 577 unit tests, a production build, a
Postgres container, pytest — to prove a paragraph had not broken the TypeScript compiler. 58 of 249
commits, ~2.5 minutes each. The fix is three lines:

```yaml
on:
  push:
    paths-ignore: ["**/*.md", "docs/**", ".claude/**"]
```

**The two things that make it safe are not in the diff.**

1. **Ask what still reads the paths you are silencing.** If any test, drift rule or budget script
   read a `.md` file, a docs-only commit could break the build with nothing left to catch it. Nothing
   did — and the workflow files are deliberately *not* in the list, because that is exactly what the
   two CI-guard tests read. That check took ten minutes and is the whole reason this is a safe change
   rather than a new silent hole. **If a future guard starts reading a document, that list is where
   it breaks, and it breaks silently.**

2. **Find the edge where the filter meets the gate.** This build tags phase exits on docs-only
   commits. If GitHub filtered *tag* pushes too, the tag would start nothing and the phase would pass
   its gate with the oracle never running. GitHub documents that it doesn't. **Prove it anyway** —
   this repo has caught GitHub's own docs being wrong twice. Prove it in **both** directions, with the
   **same query shape**, so a zero is never an artifact of having looked in the wrong place:

   | push | run created? |
   |---|---|
   | `.yml` / `.ts` commit | **yes** — the control: the filter is specific, not a blanket mute |
   | empty commit | no |
   | docs-only commit | no — *the absence is the pass* |
   | `workflow_dispatch` on that docs-only SHA | **yes** — dispatches ignore path filters entirely |
   | **the tag, on that docs-only commit** | **yes — the full oracle, green** |

**Test the negative case in the direction that would embarrass you**, not only the one that confirms
the change. The dispatch row above is the one nobody would have thought to check: had path filters
applied to `workflow_dispatch`, G2 would have silently disarmed G1's rehearsal on precisely the
commits a phase tag lands on — two individually-correct features composing into a hole, which is the
same shape G1 hit with the concurrency group. **A phase whose safety rests on an unobserved vendor
behaviour is not a change; it is an observation with a change attached.**

## The one locator call that does not wait (G2, 2026-07-13)

**The pattern:** `locator.all()` does **not** auto-wait. Everything else in Playwright does — `click`,
`fill`, `expect(...).toBeVisible()` all retry until the element is there. `.all()` hands back whatever
is in the DOM at that instant, and an empty array is a perfectly valid answer.

So a loop that enumerates a **streamed** or **client-rendered** list runs zero times, the counter keeps
its initial value, and the test reports a **finding** — "0 stories reachable" — when what it actually
did was **measure a page that had not arrived yet.**

```ts
// WRONG — .all() does not wait; a streamed row that has not landed is an empty list
for (const chip of await chips.all()) { … }

// RIGHT — wait for the row, then say how many you are about to sweep
await expect(chips.first()).toBeVisible();
const row = await chips.all();
expect(row.length, "the filter row rendered no chips — this sweep measured nothing").toBeGreaterThan(0);
for (const chip of row) { … }
```

**The tell:** the failure blames the *product* ("the filter row is broken") on a tree where no product
code changed. When a red accuses code that nobody touched, suspect the instrument.

**And the discipline that goes with it:** this looked exactly like a flake and `rerun --failed` would
have made it green. It had failed on its retry, and the mechanism was ten minutes of reading away.
`rerun --failed` is for a *suspected* flake — re-running a known race until it passes is how a real
defect becomes folklore. Grep the suite for every `.all()` when you find one; here there was exactly
one, so it was an instance rather than a class.

## The single register, and the guard that keeps it honest (G3, 2026-07-13)

**The pattern.** When the same fact is written down in more than one place, it will diverge — and the
divergence is silent, because nothing is comparing the copies. The cure is not discipline. It is (a)
**one register** that holds the fact, (b) **every consumer derives from it**, and (c) **a test that
fails when the register and reality disagree**.

`app/lib/routes-manifest.json` is the worked example. Five lists answered "what rooms are there?";
they disagreed; `/news` went unmeasured for two tagged phases. Now: one JSON file, five consumers
reading it, and `lib/routes-manifest.test.ts` walking `app/app/**/page.tsx` to hold the register
against the filesystem — **in both directions**, because the reverse one is the one people forget (an
entry for a room that no longer exists means the sweeps "pass" on a 404 page forever).

**Where else this shape already lives in the repo**, and it is worth seeing them as one pattern:
`check-drift.mjs`'s `ALERT_ALLOWED` is the register of who may spend amber; `DANGER_ALLOWED` is the
register of who may be red; `BLUR_ALLOWED` is the blur budget. Each is a list with an argued entry per
line, and the script is the truth.

**The three rules that make it work, all learned the hard way:**
1. **Every entry defends itself.** The manifest gives each room a `note` field; the drift allowlists
   give each entry a comment. *An entry with no argument is an entry nobody has had to defend*, and
   those are the ones that turn out to be wrong.
2. **A field nobody reads must not exist.** The plan asked for a per-route `wide` flag; nothing in the
   codebase scopes the wide viewport by route, so the field would have been a measurement that is not
   being taken, wearing a measurement's clothes. Left it out (Q-G3-1).
3. **A lookup that can return `undefined` must fail, not shrug.** `check-bundles.mjs` printed
   `/scans/[preset]` with an empty verdict column for phases, because `BASELINE_KB[route]` was
   `undefined` and the code read that as "no opinion". **A silence in a gate is indistinguishable from
   a pass.** The register reconciliation now runs before any measuring and refuses to proceed on a
   disagreement.

## One clock per world (G3, 2026-07-13)

**The pattern.** A fixture may be absolute. It may **not** be absolute *twice*. Any world that has a
pinned time — the seeded database, the browser suite that photographs it — gets exactly **one named
anchor**, and every other instant in that world is derived from it by a helper.

- `app/prisma/fixtures/clock.mjs` — the seeded world. `SEEDED_SESSION`, `sessionAt`, `sessionPlus`,
  `monthStart`, `sessionDayIso`.
- `app/e2e/seeded-clock.ts` — the browser suite. `SEEDED_SESSION`, `SEEDED_EVENING`.

Drift rule 21 fails the build for a date written anywhere else in `prisma/` or `e2e/`.

**Why one and not zero.** The instinct after `/paper`'s baseline expired was "make everything
relative". That is wrong, and expensively so: a seed that moved with the calendar would repaint every
VRT baseline every night, and the pixel oracle would stop being an oracle. **The failure was never the
absolute date. It was the second copy of it** — two clocks, one edit apart from disagreeing.

**Keep the derived call sites readable, or the cure is worse than the disease.** Every one carries its
answer in a trailing comment (`sessionPlus(3)  // 2026-07-12`), and rule 21 exempts comments so it
can. Where an offset would destroy the meaning, write a helper that keeps it: CPI is a *monthly* series
stamped with the first of the month it describes, so it is `monthStart(1)` and never `sessionPlus(-38)`.
A fixture nobody can check against a calendar is how the wrong one survives.

**And pin the derivation with a test.** `prisma/fixtures/clock.test.ts` writes out every instant the
seed used to name as a literal and asserts it against the expression that now produces it. A thirty-site
date refactor is exactly the change that shifts a world by one day and repaints a dozen baselines; this
catches it in milliseconds instead of twelve minutes into CI, as an unexplained wall of pixels.

---

## The register pattern — one file holds the rule, every document points at it

**When a rule has a list, the list lives in exactly one place, and that place is the one the machine
reads.** Everything else cites it by name and *does not restate its contents.*

This is the same shape as G3's routes manifest (one list of rooms; five consumers derive from it)
and G4's amber register (`ALERT_ALLOWED` in `check-drift.mjs`; six documents cite it). The failure
mode it prevents is not staleness in the abstract — it is the specific, repeated, expensive event
where **the machine is right and every human-readable description of it is wrong**, and nobody
notices because all the descriptions look authored and confident.

**The three rules:**

1. **The register is the file that RUNS.** Not the plan, not the skill, not the docstring — the
   array the guard actually iterates. If a document and the register disagree, the register wins by
   definition, because it is the thing that will fail your build.
2. **Repair the register FIRST.** If its own header is wrong (G4: `ALERT_ALLOWED`'s docstring said
   "two" while the array held four), then pointing other documents at it *relocates the lie instead
   of killing it*. Fix the source, then aim everything at the source.
3. **Never restate a count. State the RULE.** "Amber has exactly two consumers" is a rule with a
   fuse on it — it detonates the moment a properly-argued amendment adds a third. "Amber is
   RESERVED; the list is SHORT; every entry is ARGUED IN PLACE; the register is `ALERT_ALLOWED`" is
   the same rule, and it cannot rot. **Counts belong in the machine, which prints them** — the drift
   script now announces "All 21 anti-drift rules pass" precisely so no prose has to.

**The tell that you need this:** you are about to type a number, a list, or a file set into a
document that a *script* also knows. Don't. Type the script's name instead.

## the-three-layer-invariant (a gate, a derivation, and a lock)
Where it lives: `pipeline/jobs/job_a.py` (`full_run_edition`), `pipeline/nightly.py`
(`edition_from_bars`), `pipeline/publish.py` (`_require_session`)
Shape:
```
1. THE GATE       policy, at the job's door — "should this run happen at all?"
                  Refuses the known bad case. Cheap, polite, exits cleanly.
2. THE DERIVATION truth, at the point of knowledge — "what IS this, actually?"
                  Asks the DATA, then cross-checks it against an independent authority.
                  A disagreement is fatal, not something to shrug at and pick one.
3. THE LOCK       law, at the choke point every writer passes — publish/save/commit.
                  Raises BEFORE touching the resource. Cannot be reasoned around by a
                  new caller, a refactor, or a backfill script written at 2am.
```
Use when: a wrong value would be *silently correct-looking* downstream. The reason for three layers
is that the gate alone shipped, looked complete, and was not: it stopped every path anybody had
thought of, and the bug came back through a door nobody had. **Modes are policy; publish is law.**
The lock is the only one that survives a maintainer who does not know the story.

## the-instrument-that-can-see-production
Where it lives: `app/scripts/check-live.mjs` + `live-truth.mjs` (pure) + `live-truth.test.ts`
Shape:
```
- Split the checker in HALF. The pure half takes rendered pages + an injected clock and
  returns verdicts; the shell half fetches, authenticates, prints, and sets the exit code.
- Test the pure half against a recording of the HEALTHY system AND a recording (or an
  honestly-named reconstruction) of the DISEASE. A checker that cannot fail its fixtures
  is decoration.
- Verdicts are PASS / FAIL / PENDING. PENDING names the phase that owes the feature, so a
  check written before its subject exists is measured from day one rather than remembered later.
- Do not gate on a window where the correct system legitimately looks wrong (here: between the
  closing bell and the night's publish). A guard that cries wolf is not there on the night it
  is right.
```
Use when: every existing guard runs against a world it built itself thirty seconds earlier — so none
of them can answer "is the deployed thing actually true?" CI cannot answer this **structurally**, and
that is not a shortcoming to fix; it is the reason this instrument is local-only and belongs in the
phase gate's post-deploy step.

## one-list-many-readers (and where to put the prose)
Where it lives: `app/lib/market-calendar.json` (the NYSE table) · `app/lib/routes-manifest.json` (the rooms)
Shape:
```
When a THIRD thing needs to read a list, move the list to data — JSON — and let all of them
read the one file. A table only one language can read is a table that gets COPIED, and a
second copy of a fact is a second answer waiting to happen.
Then write a test that holds the list against an independent authority (here: the real XNYS
exchange calendar, walked day by day). Agreement is the property; the list is just where it lives.
CAVEAT, MEASURED: if the JSON ships to the browser, its prose ships too. A `_comment` key is
DATA. Keep the file bare and put the explanation in the module that imports it.
```
Use when: two implementations of the same fact exist in different languages and both are load-bearing.

---

## The edition anchor — never measure an edition against a clock

Where it lives: `app/lib/morning.ts` (`calendarFloor`) · `app/scripts/live-truth.mjs`
(`checkCalendar`, `checkNextEdition`) · CLAUDE.md's `live:` command block
Shape:
```
This product serves a dated EDITION, like a newspaper. Monday's paper is still Monday's paper
at 1am on Tuesday. So:

  IF A SURFACE IS DERIVED FROM THE EDITION, IT IS MEASURED AGAINST THE EDITION — never `now`.

The floor of the session calendar is the edition's session (INCLUSIVE — an event on the
edition's own day belongs to that edition). The "next edition" promise is the next trading day
after the EDITION. The staleness check on a calendar row is against the EDITION.

None of these three take a clock at all. The ONE surface that legitimately reads the clock is
the assertion that the edition itself is current — and it is loud, so everything else can
safely trust the edition and stop asking what time it is.
```
Use when: any check, filter or label derived from a dated snapshot. **Two clocks in one system will
disagree eventually; the only question is whether they disagree where someone is looking.** Here they
disagreed for the ~6 hours between midnight ET and the evening publish — long enough that a
clock-reading gate would have failed a healthy product every night, and short enough that nobody
would have been awake to see why.

---

## Fix the write path, then go back for the rows

Where it lives: `pipeline/publish.py` (`_replace_calendar`) · `app/lib/morning.ts` (`loadCalendar`)
Shape:
```
A write-path fix changes what happens NEXT. It says NOTHING about what is already in the table.

The calendar refresh deleted `WHERE date >= run_date` — the forward window. A row whose date had
fallen BEHIND the window was not in the window, so nothing ever touched it again. The allowlist
that stopped the bad rows being written was correct and landed a month earlier; the rows it was
meant to prevent sat on the live Desk the whole time.

So, whenever you fix an ingest, ask the second question OUT LOUD:
  "what did the broken version already leave behind, and what will ever go back for it?"
Very often the answer is "nothing", and it will be "nothing" forever, silently.

And fence BOTH ends, because they fail differently:
  - the WRITE fence stops litter accumulating (here: the refresh replaces the whole table);
  - the READ fence holds when the writer has not run for days, and cannot be defeated by
    whatever is sitting in the table (here: the query is floored at the edition).
```
Use when: any table that a periodic job "replaces". Also: **a bounded read (`take: N`) with no lower
bound is an eviction waiting for something to rot** — the four dead rows sorted first and displaced
six days of real calendar, which is a data-loss bug wearing a cosmetic bug's clothes.

## one-master-many-artifacts (and the budget check that catches the day it stops working)

**The shape.** A single source file, a single committed generator, and a table where every emitted
artifact names its size, geometry, budget and consumer. `npm run brand` →
`app/scripts/brand-assets.mjs` → ten files. Nothing is drawn twice, so nothing can drift from
anything else, and the phase's evidence is the generator's own printed output.

Three parts make it hold, and each one earned its place by catching something:

1. **The source is ASSERTED, not assumed.** The generator samples the master's field colour and
   refuses to run if it no longer matches the committed `BRAND_FIELD`. Swap the master for a
   differently-tinted logo and the build does not silently re-tint every icon and the OG card to a
   colour nobody chose — it stops and says the field moved. *A build that changes twenty files
   because one file changed should have to announce itself.*

2. **The BUDGET is asserted, and it is the only test an icon set can fail.** An icon set has no
   failing assertion; it just quietly gets heavier until someone notices the app is slow. PD2's very
   first run printed a 300 KB 512px icon against a 120 KB budget for the whole set — because the
   budget had been written for the flat SVG tile it replaced (19 KB), and the new mark is a rendered
   illustration. Nothing else in the repo would have said a word.

3. **The pure logic is a separate, hermetic module.** `brand-geometry.mjs` takes raw pixels and
   returns numbers; `brand-assets.mjs` does the IO. The tests run the geometry against **synthetic**
   fixtures — never the real logo. A test that asserted today's logo is today's logo would pass
   forever, prove nothing, and go red the day the mark is redrawn, which is precisely the day it
   should stay green.

**Where it generalises:** any time one input fans out into many committed binary artifacts nobody
can grep — icons, sprites, OG cards, seeded fixtures, generated schemas.

## Measure a library's promise; do not read it

An API that accepts a parameter is not an API that USES it. sharp takes a `fontfile`; Pango ignored
it and substituted a system font, and the only way to know was to construct a measurement it could
not fake: **a monospace font and a proportional font must set the same string to different widths.**
They did not. The parameter was dead.

The general form: find an observable that MUST differ if the thing you asked for actually happened,
and check that observable — not the exit code, not the presence of output, not the docs. Then, where
you can, delete the dependency on the promise entirely (the OG card's text is now vector outlines,
so there is no font to resolve and nothing to fall back to).

## What the gate forgives is where the next bug lives

`maxDiffPixels: 600` had been absorbing a 387-pixel disagreement in the Desk's baseline — a picture
that said "none saved tonight" against a run that produced "1 saved tonight", because one spec writes
a journal entry and never cleans up. It also absorbed the 45 shots whose top bar changed and did not
fail.

**A tolerance is not neutral.** It is a region where drift is invited to accumulate, and it is the
one region nobody inspects, precisely because it is green. When a tolerance finally lets something
through, do not just re-baseline what failed: re-baseline everything that MOVED, and go and look at
what else the tolerance has been quietly holding.

Related: [the-instrument-that-can-see-production] (PD0/PD1) — the same disease, one layer up. A guard
that cannot fail on a real defect, and a guard that forgives one, are the same guard.

## Two columns that never trade heights (and the DOM price you cannot avoid paying)

**The defect this exists to prevent.** Put two columns in ONE CSS grid, pin the modules with
`col-start`, and the modules pair off into shared implicit rows. **A grid row is as tall as its tallest
cell.** So a short module beside a tall one leaves a dead hole — and `items-start` pins the short one
to the top of the shared track, which makes the hole *visible* rather than merely present.
`grid-flow-row-dense` does not help: it backfills empty CELLS, not slack inside a track.

**The only shape that actually decouples them** is two independently-flowing stacks:

```
<div class="grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
  <Hero class="lg:col-span-2" />                              <!-- belongs to neither column -->
  <div data-column="main" class="contents lg:flex lg:flex-col lg:gap-6"> … </div>
  <div data-column="rail" class="contents lg:flex lg:flex-col lg:gap-6"> … </div>
</div>
```

`display: contents` below the breakpoint **dissolves the wrappers**, so their children become grid
items of the outer grid again and the single-column layout is exactly what it was. It is safe on a
plain `div` with no role — dissolving it removes nothing from the accessibility tree.

**THE PRICE, AND IT IS NOT AVOIDABLE.** CSS can only group children that are **adjacent in the DOM**.
If your reading order interleaves the two columns (narrative, reference, narrative, reference…), then
a ritual-ordered DOM and column-grouped wrappers are **mutually exclusive**. There is no CSS that
gives you both. So:

- the DOM becomes **column-grouped** (main, then rail) at every width, and that is what a screen reader
  hears everywhere — at least it is *one* consistent order rather than two;
- the single-column visual order is restored with `order` utilities (make the order numbers *be* the
  ritual indices — then one set of numbers is correct at every width and it reads as documentation);
- **a sighted keyboard user below the breakpoint tabs in DOM order while seeing the visual order.** That
  is a WCAG 2.4.3 divergence, **axe cannot see it** (no tool can — it is a comparison between two
  orders, not a property of one), and the only honest thing to do is *state it and pin it*, not
  discover it later.

**The trap that looks like a way out and is not.** Making the rail one cell that ROW-SPANS the main
column keeps the ritual DOM. But when the rail is taller than the main column, the grid **grows the
spanned rows to fit it** — and the dead gap comes straight back, merely *distributed* between the main
modules instead of pooled under one. That is precisely the case (short main, tall rail) the law exists
for. It is strictly worse.

**Test the pixels, not the DOM.** A DOM-order assertion will pass happily through this entire rewrite
while the screen shows something else — the old ritual test did exactly that. Assert **bounding boxes,
per viewport**: what a reader sees is the only thing a reader experiences.

## One empty state, one height, one component

A module that renders its own bespoke empty state is a module whose empty height **nobody controls**.
Six modules doing that is six empty states of six different heights, and no way to hold any of them to
a budget.

- **One `EmptyModule`.** The *caller* decides when to show it; the module renders a list that HAS
  things in it. (Watch for `[]` being **truthy** — `data && data.length > 0`, or the empty array walks
  straight past your guard into the component and renders its own thing.)
- **Reserve no height.** `min-h`, fixed heights and aspect boxes on a module surface are a promise, made
  in whitespace, that content is coming to fill them. Grep for it (`min-h-`), and argue the exemptions
  out loud: the 44px touch floor is the *opposite* rule and is a requirement; `min-h-0` is a *reset* and
  reserves nothing; the page shell is not a module.
- **No shimmer on "the run found nothing".** A shimmer means *content is on its way*. That is true when
  nothing has ever run and **false** when the run happened and found nothing — and "found nothing" is
  the common case while "never ran" happens once.
- **"Nothing yet" and "nothing tonight" are different facts and must not read the same.** *"Setup cards
  arrive with the nightly base rates"* is a schedule, and carries **no timestamp**, because none exists
  and a fabricated one is worse than none. *"No setups fired tonight"* is a **finding**, as of a moment,
  and takes the run's stamp.

## The wrap contract — atoms, not tokens (PD4)

**A figure and its chip wrap; a chip's INSIDES do not.** Three versions were built and each wrong one
was caught by looking at the screen, never by a test.

- The value row is `flex flex-wrap min-w-0 gap-x-2 gap-y-0.5` — the chip drops **below** the value
  when they cannot share a line. Numbers never truncate, never ellipsize, never clip.
- The chip is `flex flex-wrap max-w-full`, and it holds exactly **two atoms**, each
  `whitespace-nowrap`:
  1. the **signed delta** — `▲ +0.29%` — glyph, sign and number are one fact in three redundant
     channels, and they never separate;
  2. the **window** — `· 1D`, `· vs prior week` — the delta's unit, which moves as one phrase or not
     at all.
- So a narrow cell drops the window to a second line **whole**, and never shatters it into
  `vs / prior / week`.

**The rule:** the unit of wrapping is the **atom** — the smallest group that still means something on
its own. "Wrapping is honest, truncating is not" is a claim about a *sentence*; a phrase broken one
word per line has been shattered, not wrapped.

**Corollary for layout:** making a chip FIT is the layout's job, not the chip's. If a cell cannot give
a chip the ~95px it needs, the cell is the wrong shape — that is why the Desk's phone tape is a
full-width list and not three cards.

## Overflow is asked of the CELL, not the page (PD4)

`document.scrollWidth === clientWidth` cannot see a cell that spills into its **neighbour** — that
spill lands inside the page, never past its edge. A page-level sweep will report clean on a figure
sitting under the border of the card next to it.

**So both questions get asked.** The page sweep (`hardening.spec.ts`, every room, 412 **and** 360)
and the cell sweep (`desk.spec.ts`: does anything inside this box reach past the box's **content**
edge?). Measure to the content edge, not the border edge — a figure in its own padding is already
touching the wall.

**And a sweep proves it swept:** it counts the rooms it visited and fails if it visited none, or
fewer than the manifest lists. A sweep that measured nothing must not report success.

---

## PD5 — the richness kit (2026-07-14)

### The kit, and which door each thing goes through

| You want to render… | Use | Never |
|---|---|---|
| a ticker symbol, anywhere | `components/TickerChip.tsx` | a bare mono span, a raw `<Link href="/ticker/…">` (drift rule 26) |
| a signed move + its window | `components/DeltaChip.tsx` | a hand-rolled chip. There were four, and three carried a bug (LESSONS) |
| a word with a definition | `components/Term.tsx` (`Term` / `TermProse`) | a hand-written dotted underline |
| a gate-verified number in prose | `components/KeyFigure.tsx` (`KeyFigure` / `VerifiedProse`) | mono on any number you like — it is a type error, and a dev-time throw |
| any table | `components/DataTable.tsx` | a `<table>` (drift rule 16) |

### TickerChip is a DOOR or a LABEL, and HTML decides which

```
<TickerChip symbol="AAPL" door />   // a <Link> — a table cell, anywhere nothing else is interactive
<TickerChip symbol="AAPL" />        // a <span> — inside a news card (one big <Link>) or a movers
                                    //            row (a <button>). An anchor inside either is
                                    //            INVALID HTML: the browser closes the outer one,
                                    //            and half the card silently stops being clickable.
```

The chip **looks identical** either way. Only its interactivity changes — which is the right split:
the symbol reads as a symbol everywhere, and it is a door only where a door is legal *and wanted*.

### The two-atom rule, now in one place

A delta chip has exactly **two atoms**, each `whitespace-nowrap`:

1. the **signed delta** (`▲ +8.2%` — glyph, sign and number are one fact in three redundant channels)
2. its **window** (`· 1D` — the delta's *unit*, not a second number)

The chip is `flex-wrap max-w-full`; it breaks **between** the atoms and **never inside one**. A phrase
broken one word per line has not been wrapped, it has been **shattered**.

`DeltaChip` has two *presentations* of that one contract, and the distinction is a reason, not a knob:

- `chip` — the delta **stands alone** (a movers row, beside a StatFigure). It brings its own wash: a
  bare coloured number floating on the paper does not read as a unit.
- `inline` — the delta sits **inside another chip** (a TickerChip's trailing move). The wash and the
  padding are already there. A second one would be a pill inside a pill.

### Emphasis is a CLAIM, so it takes a type and not a string

```
splitVerified(text, allowList)  →  the ONLY mint of a VerifiedFigure
<KeyFigure figure={...} />      →  accepts nothing else
```

`allowList` comes from the **pipeline's gate** (a news cluster's `key_numbers`). The app never decides
what counts as a number — `briefing/verify.py` already answers that, and a second answer is how the
two halves of the product start disagreeing about what is verified. **A deny-list is the trap**; an
allow-list is the rule.

Where no allow-list exists (the Desk's brief today), **nothing is emphasized.** Unemphasized prose
claims nothing, which is the honest default — not a gap.

### Term: two disciplines, stacked, and they compose

- **the budget** — at most **2 doorways per paragraph** (`lib/prose.ts`). An underline forest is noise.
- **the registry** — **first occurrence per view** (`React.cache`, per request). The same word is
  dotted once on the page, however many modules mention it.

They compose, which is why a paragraph can honestly render **fewer** than two: MacroPulse spends
"Breadth" at the top of the Desk, so the brief 200px below renders it plain — correctly.

**The registry is only real on a SERVER render.** `cache()` does not memoise under vitest's client
render, so the per-view rule is pinned in `e2e/voice.spec.ts`, not in a unit test. A unit test that
cannot see the behaviour it names is a green light wired to nothing.

## the-invisible-touch-target
Where it lives: `components/TickerChip.tsx` (`DOOR_HIT_AREA`)
Shape:
```tsx
// A control must be 44px on touch. The thing you SEE may be 21px. Those are two boxes.
<Link className="-my-3 inline-flex min-h-11 items-center">   {/* the target: a true 44px */}
  <span className="rounded-chip border px-1.5 py-0.5">…</span>  {/* the chip: still 21px */}
</Link>
```
Use when: a small inline object (a chip, a symbol, an icon) has to become a link or a button.

Two rules, and PD6 got the first one right and the second one wrong before it shipped:

1. **Do not grow the visual.** A 44px pill in every table cell destroys the density a table exists
   for. Put `min-h-11` on the ANCHOR and leave the chip alone inside it.
2. **`-my-3` is not optional.** Without it the 44px target ADDS to the cell's existing padding, and
   every row grows from 45px to 69px — for a target nobody can see. The negative margin pulls the
   target's box back INTO padding the layout had already reserved. `boundingBox()` (what the touch
   sweep and the browser's hit-testing both read) still returns a true 44px. Nothing is faked; the
   target simply occupies space that was already there.

**And it only works where there is padding to borrow.** A table cell has 12px to lend. The scans
index's 37px teaser rows have none — which is why the symbols there are LABELS, not doors. If the
row is shorter than the target, the honest answer is that the row is not a place for a control.

## a-chip-is-wider-than-the-word-it-replaces
Where it lives: `app/(desk)/settings/WatchlistManager.tsx` (`w-32`)
Shape: when plain text becomes a bordered chip, it gains a border and horizontal padding — "AAPL"
goes from ~34px to ~48px. Every container that was measured for the WORD is now too narrow.
Use when: swapping bare text for any chip component (`TickerChip`, `Tag`, `DeltaChip`).

The failure is quiet: the chip does not overflow, it WRAPS — and a wrapped chip pushes whatever was
beside it onto a new line and grows the row. Nothing fails. No guard in this repo has an opinion
about it. **Making a chip fit is the LAYOUT's job, not the chip's** (PD4's law). So: after any
text→chip swap, grep for the fixed widths (`w-24`, `max-w-`, a grid column) around the thing you
changed, and go and LOOK at the room.

## Pipeline patterns (added during PD7, 2026-07-14)

### The metering proxy: count an LLM's spend at one seam, and let both stages stay ignorant of it

A cost instrument that lives in each stage is a cost instrument copied twice and drifted once. When
two stages both call `client.messages.create(model=...)` — extraction once per article, narration
once for the page — wrap the client in a thin proxy that records `usage` on every call, and hand the
proxy to both. ONE interception point sees the whole night's spend, buckets it by the `model`
argument (so the two models price apart with nobody telling it which is which), and neither stage
learns it is being counted — `briefing/extract.py` is untouched by the accounting. The proxy is
deliberately forgiving of a response with no `usage` (the test fakes return bare objects), because a
metering wrapper that CRASHES the narration stage over a missing accounting field would be a cost
instrument that takes the front page down. See `newsdesk/narrate.py` `_MeteredClient`. Token counts
are MEASURED from the API; only the dollars are arithmetic, from the one price table in `config.py`.

### The rendered value carries its own window: a stat that describes a period must say the period out loud

When a computed value feeds a deterministic gate that parses the value back into its allowed-number
set, the words of the value are load-bearing. A narrator describing a "52-week range" writes
"52-week", and 52 is a number the gate will check — so the value must contain it, or an honest
sentence is flagged for the window it was asked to describe. Render `"71.4% of the way up its
52-week range (low 82.10, high 154.90)"`, not a bare `"71.4%"`: the window, the low and the high all
become licensed sources through the ordinary mechanism, and the reader can check the claim. The same
holds for "50-day average" and "the last 7 sessions". See `briefing/stats.py` `build_depth_stats`.

### Absence over invention: a measure the data cannot support is absent, never defaulted

A registry that feeds a verification gate must never emit a number it guessed, because the gate's job
is to certify against the registry — so a default the registry invents is a fabrication no gate can
catch. Every measure in `briefing/depth.py` returns `None` rather than a fallback: a "52-week range"
over 200 sessions is absent (not computed over four months), a move divided by an unknown ATR is
absent (not divided by zero), a symbol the lake lacks produces a depth object with every field
`None`. The cost is that the narrator sometimes has less to say; that is the intended failure mode —
honest degradation, zero new ways to be wrong. The property test names it: "no stat is emitted for a
symbol the lake lacks."

### Added-alongside, not replaced: a new record shape ships beside the old one until the reader moves

When a pipeline phase changes a record's shape but ships to production BEFORE the app phase that
reads the new shape, replacing the old field silently breaks the live surface — and nothing fails,
because the app reads an absent key as its falsy default. PD7 changed news `verification` from a flat
`{dropped: true}` to a per-section `sections` map, but `lib/news.ts` reads `verification.dropped`
right now. So `dropped` stays, and `sections` is added beside it; the app phase migrates the reader
and THEN retires the old key. The rule: a pipeline change that outruns its consumer keeps the old
contract until the consumer catches up.

## Shared read + shared component when two surfaces ask the same question (PD8)

The story page and the ticker page both ask a name "does our ledger hold evidence?" — so it is ONE
loader (`lib/record.ts:getSymbolRecord`) and ONE component (`components/SymbolRecord.tsx`), never two.
Two answers to one question drift apart, and then two surfaces tell the reader two different truths
(the same law the news room keeps for "a mover"). When you catch a second page reaching for the same
data, extract the read AND the render before writing the second copy — PD5's four delta chips are the
scar. Corollary: the row → view-model mapping lives in ONE builder (`lib/setup-card-view.ts`), read by
the Desk loader and the per-symbol record alike.

## A nested anchor is a sibling footer, not a stretched link (PD8)

A card that is one big `<Link>` cannot contain a second anchor — the browser closes the outer one and
the card's bottom half silently stops working (drift rule 26's whole reason). The feed's byline door
out is a SIBLING of the story link: the card became a `<div>` holding the story `<Link>` and a footer
row with the external anchor in its own box, hairline-separated, ≥44px on touch. No stretched-link
pseudo-element, no `z-index` fight — two real controls side by side, each valid HTML.

## State the window, then you can degrade honestly (PD8)

The 52-week strip is a "52-week range" claim, and a claim about a year is a lie over a month. Rather
than fake the year (or bump the seed and re-baseline an unrelated flagship shot), the strip states the
TRUE session count and calls itself "52-week" only when the window really is one. This is the §5.2 rule
(every number states its window) turned into a degradation strategy: a surface that names its own scope
can shrink that scope honestly instead of overclaiming a fixed label. Absence beats invention; so does
an honest smaller window beat a fabricated full one.
