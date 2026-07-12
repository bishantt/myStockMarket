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
