"""
test_workflow_dispatch.py — the wiring between the control room's buttons and the jobs they fire (N6).

Two things live in two files and MUST NOT DRIFT APART, and both of them fail silently when they do.
This test reads the workflow YAML and compares it against the code.

1. **The mode dropdown vs MODE_STAGES.** The workflow offers a set of modes; the job implements a
   set of modes. If the workflow offers one the job does not have, GitHub accepts the dispatch, the
   job raises, and the run goes red *after* the reader was told it started. If the job gains a mode
   the workflow does not offer, the button cannot be built at all.

2. **`run-name` must carry `request_id`.** This is the load-bearing one, and it is not obvious.
   The dispatch API answers **204 No Content with an EMPTY BODY** — recorded against the live API on
   2026-07-13, and contrary to both the plan and GitHub's own REST docs, which claim a 200 carrying a
   `workflow_run_id`. There is no run id in the response. So the app recovers it by matching the
   request id in the run's NAME, and the run's name is set by this line in the YAML.

   Delete that line and nothing fails: the workflow still runs, the job still works, every test but
   this one still passes — and the control room goes permanently blind. Every button would dispatch
   a real run and then report that it could not find it, forever. **A run that fired and a run that
   never fired would look identical from the couch**, which is the precise failure this phase was
   warned about.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from jobs.job_a import MODE_STAGES

_WORKFLOWS = Path(__file__).resolve().parents[2] / ".github" / "workflows"

DISPATCHABLE = ["nightly-a.yml", "nightly-b.yml"]


def _text(workflow: str) -> str:
    return (_WORKFLOWS / workflow).read_text()


@pytest.mark.parametrize("workflow", DISPATCHABLE)
def test_the_run_name_carries_the_request_id(workflow: str):
    """Without this, a dispatched run cannot be found again — see the module docstring."""
    run_name = next(
        (line for line in _text(workflow).splitlines() if line.startswith("run-name:")),
        None,
    )
    assert run_name is not None, (
        f"{workflow} has no `run-name:`. The control room finds its run by matching the request id "
        f"in the run's name — the dispatch API returns 204 with no body and tells us nothing."
    )
    assert "inputs.request_id" in run_name, (
        f"{workflow}'s run-name does not interpolate `inputs.request_id`. The control room would "
        f"dispatch runs it can never find, and would report every one of them as pending forever."
    )


@pytest.mark.parametrize("workflow", DISPATCHABLE)
def test_the_workflow_accepts_a_request_id_input(workflow: str):
    """A run-name can only print an input the workflow actually declares."""
    assert re.search(r"^\s+request_id:", _text(workflow), re.MULTILINE), (
        f"{workflow} must declare a `request_id` workflow_dispatch input."
    )


def test_the_mode_dropdown_offers_exactly_the_modes_the_job_implements():
    """
    The workflow's options and MODE_STAGES are one fact written in two places. They must agree.

    An option the job cannot run is worse than a missing one: GitHub accepts the dispatch, the panel
    tells the reader their run started, and the job dies on `unknown mode`. The reader is looking at
    a button that reported success and did nothing.
    """
    text = _text("nightly-a.yml")

    # The `options:` block of the `mode` input — the lines between `options:` and the next key.
    block = re.search(r"options:\n((?:\s+-\s+\w+.*\n)+)", text)
    assert block, "nightly-a.yml has no mode options block"
    offered = set(re.findall(r"-\s+(\w+)", block.group(1)))

    assert offered == set(MODE_STAGES), (
        f"the workflow offers {sorted(offered)} but job_a implements {sorted(MODE_STAGES)}. "
        f"A mode offered but not implemented is a button that reports success and does nothing."
    )


def test_the_dawn_cron_fires_monday_to_friday_pre_open():
    """
    CC8 moved the dawn run to `30 10 * * 1-5` (6:30 AM EDT / 5:30 AM EST, Mon–Fri). Monday GAINS a
    dawn run — the morning after the most news, weekend plus Friday's close — and the pointless
    Saturday run (the old `0 10 * * 2-6`) is gone. The mode-picker maps this schedule to `dawn`.
    """
    text = _text("nightly-a.yml")

    assert 'cron: "30 10 * * 1-5"' in text, "the dawn cron must fire Mon–Fri, pre-open"
    assert "0 10 * * 2-6" not in text, "the old Tue–Sat dawn cron must be gone (it ran Saturday, skipped Monday)"
    # The schedule→mode step turns exactly this cron into the `dawn` mode.
    assert 'github.event.schedule }}" = "30 10 * * 1-5"' in text
    assert "value=dawn" in text


def test_the_guard_can_actually_fail():
    """Negative control. A guard that cannot fail is not a guard — this build has shipped three.

    Every assertion above reads a real file, so the way to prove they bite is to run them against a
    workflow that is missing the thing they demand.
    """
    broken = "name: nightly-a\non:\n  workflow_dispatch:\n    inputs:\n      mode:\n        type: choice\n"

    run_name = next((line for line in broken.splitlines() if line.startswith("run-name:")), None)
    assert run_name is None  # the real check would fail here, which is the point

    assert not re.search(r"^\s+request_id:", broken, re.MULTILINE)
