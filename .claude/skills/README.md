# Skills — when to mint one (from plan §9.3)

A skill is a self-contained procedure at `.claude/skills/<name>/SKILL.md`:
name · when-to-use · exact steps · verification · one worked example.

**Mint when ALL four hold:**
1. The procedure has ≥ 3 non-obvious steps.
2. It will plausibly recur ≥ 3 times.
3. Its output is verifiable (a test, a checklist, a rendered page).
4. The procedure is stable (you'd write the same steps tomorrow).

**Do not mint** for one-offs, things an npm script already encodes, or anything still churning.
Update the skill when the procedure changes — a stale skill is worse than none.
**Invoke the skill (follow its steps literally) whenever the task recurs — re-deriving a minted
procedure is a process violation.**

MINTED so far: new-provider-adapter · base-rate-display · new-indicator · new-pattern-detector ·
new-lesson · **new-surface** (2026-07-12, R1–R5 — after building the same card eleven times) ·
**vrt-update** (2026-07-12, R1 — when the visual-regression suite became real).

Still expected, when the evidence arrives (mint on evidence, not in advance — plan §9.3 table):
new-desk-module · pwa-audit · release-phase.

The two newest, and when to reach for them:
- **new-surface** — ANY new card, panel, module, or overlay. It is not a class-string cheat sheet:
  it carries the honesty checklist you run BEFORE writing markup, because getting the classes right
  and the rules wrong ships something that looks like the product and lies like a dashboard.
- **vrt-update** — whenever a change moves pixels, and especially when CI says a change moved pixels
  you did not expect. The one rule: an intentional restyle updates its baselines in the same commit
  with the reason in the body; an UNEXPLAINED diff is a build failure.

Two PRE-SEEDED skills exist below (`new-provider-adapter`, `base-rate-display`). They are
documented procedures distilled from the plan's contracts, created before any code existed —
refine each at its first real use, then treat it as minted.
