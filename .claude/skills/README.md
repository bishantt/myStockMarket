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

Expected skills and their minting moments (mint on evidence, not in advance — plan §9.3 table):
new-provider-adapter (P1, after Alpaca) · new-indicator (P1, after 2nd indicator) ·
new-pattern-detector (P4, after 2nd detector) · new-desk-module (P2, after the calendar) ·
new-lesson (P5, after 2nd lesson) · pwa-audit (P1, first full audit) · release-phase (P0 exit) ·
visual-regression-update (first intentional baseline change).

Two PRE-SEEDED skills exist below (`new-provider-adapter`, `base-rate-display`). They are
documented procedures distilled from the plan's contracts, created before any code existed —
refine each at its first real use, then treat it as minted.
