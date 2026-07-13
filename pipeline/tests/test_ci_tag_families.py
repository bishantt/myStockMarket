"""
test_ci_tag_families.py — the tag families in ci.yml live in two places and must not drift (G0).

ci.yml's own header has warned about this since the first phase:

    "The tag list here and the `if:` conditions on the tag-gated jobs below must be kept in step.
     A tag family that appears in one but not the other is a gate that silently never runs."

That warning was a comment, and a comment cannot fail a build. This test makes it mechanical.

The two places:

1. `on.push.tags` — which tags start a CI run at all. A family missing HERE means pushing the tag
   does nothing: no run, no oracle, no red. The phase looks like it passed its gate because nothing
   ever ran.

2. The e2e job's `if:` — which tags actually run the browser oracle (e2e + VRT + PWA + axe). A
   family missing HERE means the tag starts a run, the run goes green, and the green is a lie: the
   only job that can see pixels, seeded data, and accessibility never executed.

Both failures are silent, and both look exactly like success from the outside. The `nc-*` family
was wired correctly by hand four times running; the fifth family is where hand-wiring runs out.
"""

from __future__ import annotations

import re
from pathlib import Path

CI = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "ci.yml"


def _families_in_the_trigger(text: str) -> set[str]:
    """The tag globs from `on.push.tags` — e.g. {"phase-", "gate-"} from ["phase-*", "gate-*"].

    Returned as bare prefixes (the `*` stripped) so they compare directly against the `refs/tags/`
    prefixes the e2e job's `if:` tests with startsWith().
    """
    tags_line = re.search(r"^\s+tags:\s*\[(.+)\]\s*$", text, re.MULTILINE)
    assert tags_line, "ci.yml has no `tags:` list under on.push — no tag can start a run at all."
    globs = re.findall(r"['\"]([^'\"]+)['\"]", tags_line.group(1))
    return {glob.removesuffix("*") for glob in globs}


_FAMILY_IN_A_CONDITION = re.compile(r"refs/tags/([\w-]+-)")


def _families_in_the_e2e_gate(text: str) -> set[str]:
    """The tag prefixes the e2e job's `if:` will actually run the browser oracle for.

    Matched on a NAMED FAMILY (`refs/tags/nc-`), not on the bare string `refs/tags/`. The app and
    pipeline jobs also mention `refs/tags/` — they use it to sit tag runs OUT — and a naive search
    would collect those and think the workflow had three tag-gated jobs. The e2e job is the only one
    that names families, because it is the only one a tag is for.
    """
    gate = [
        line
        for line in text.splitlines()
        if line.lstrip().startswith("if:") and _FAMILY_IN_A_CONDITION.search(line)
    ]
    assert len(gate) == 1, (
        f"expected exactly one job gated on named tag families (the browser oracle); found {len(gate)}. "
        f"If a second tag-gated job was added, teach this test which families it owes."
    )
    return set(_FAMILY_IN_A_CONDITION.findall(gate[0]))


def test_the_tag_families_are_wired_in_both_places():
    """The trigger list and the oracle's `if:` are one fact written twice. They must agree exactly.

    A family in the trigger but not the gate: the tag runs CI, CI is green, the oracle never ran.
    A family in the gate but not the trigger: the tag starts nothing, so the `if:` is never asked.
    """
    text = CI.read_text()
    triggered = _families_in_the_trigger(text)
    gated = _families_in_the_e2e_gate(text)

    assert triggered == gated, (
        f"ci.yml's tag families have drifted apart.\n"
        f"  on.push.tags runs CI for: {sorted(triggered)}\n"
        f"  the e2e oracle runs for:  {sorted(gated)}\n"
        f"  only in the trigger (tag runs, but the oracle sits it out — a GREEN THAT PROVED "
        f"NOTHING): {sorted(triggered - gated) or 'none'}\n"
        f"  only in the gate (the tag starts no run at all): {sorted(gated - triggered) or 'none'}"
    )


def test_the_guard_can_actually_fail():
    """Negative control. A guard that cannot fail is not a guard — this build has shipped several.

    The check above reads the real file, so the way to prove it bites is to run its two halves
    against a workflow with exactly the drift it exists to catch: a family that starts a run but
    that the oracle does not answer to.
    """
    drifted = (
        "on:\n"
        "  push:\n"
        '    tags: ["phase-*", "gate-*"]\n'
        "jobs:\n"
        "  app:\n"
        "    if: github.event_name == 'push' && !startsWith(github.ref, 'refs/tags/')\n"
        "  e2e:\n"
        "    if: startsWith(github.ref, 'refs/tags/phase-')\n"
    )

    triggered = _families_in_the_trigger(drifted)
    gated = _families_in_the_e2e_gate(drifted)

    assert triggered == {"phase-", "gate-"}
    assert gated == {"phase-"}  # the app job's bare `refs/tags/` exclusion is correctly ignored
    assert triggered != gated  # the real test fails here, which is the point
    assert triggered - gated == {"gate-"}  # a gate-* tag would go green without an oracle run
