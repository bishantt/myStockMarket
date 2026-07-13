"""
The guard for a bug this build has now shipped TWICE, both times to production, both times silently.

THE BUG: a secret exists in GitHub, the code reads it, and the workflow never passes it to the job.
The secret is present everywhere a human would look — `gh secret list` shows it, the config object
declares it — and absent in the only place that matters, which is the environment the job actually
runs in. The pipeline is written to degrade quietly when a key is missing (correctly: one dead
provider must not take the night down), so the job prints a calm line about skipping and carries on,
every gate stays green, and nobody is told.

Twice:

1. **ANTHROPIC_API_KEY** — in GitHub since 2026-07-10, passed to NEITHER nightly job. Every LLM
   stage in the product silently skipped in production for four phases. The evening brief was
   assembling without the stage that reads the articles. Found by the N0 audit, by hand.
2. **GOLDAPI_KEY** — added 2026-07-13 to fill the macro board's gold cell. The cell would have kept
   printing "not yet reported" that night and every night after, because nightly-a's env block did
   not carry the key. Found in N4, by hand, again.

A thing found by hand twice is a thing that will be missed the third time. So this test derives the
truth from the code instead of from anyone's memory: it reads what each job ACTUALLY reads off the
settings object (walking the import graph from the job's own module), and requires that the workflow
which runs that job passes every one of those secrets to it.

Note what it does NOT do: it does not check that the secret exists in GitHub. Nothing here can see
GitHub, and a test that pretended to would be the same species of lie it is written to catch. It
checks the one half that lives in this repo — the wiring — which is the half that broke both times.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

from config import Settings

_PIPELINE = Path(__file__).resolve().parent.parent
_WORKFLOWS = _PIPELINE.parent / ".github" / "workflows"

# Which workflow runs which job. The map is the contract this test enforces.
JOB_WORKFLOWS = {
    "jobs.job_a": "nightly-a.yml",
    "jobs.job_b": "nightly-b.yml",
}

# A line like `  FRED_KEY: ${{ secrets.FRED_KEY }}` — every env value a workflow takes from a secret.
_SECRET_ENV_LINE = re.compile(r"^\s*([A-Z][A-Z0-9_]*)\s*:\s*\$\{\{\s*secrets\.", re.MULTILINE)


def _local_modules() -> dict[str, Path]:
    """Every module in the pipeline package, keyed by its importable name."""
    modules: dict[str, Path] = {}
    for path in _PIPELINE.rglob("*.py"):
        parts = path.relative_to(_PIPELINE).parts
        if any(p in {".venv", "tests", "scripts", "__pycache__"} for p in parts):
            continue
        name = ".".join(parts)[: -len(".py")].removesuffix(".__init__")
        modules[name] = path
    return modules


def _import_closure(entry: str, modules: dict[str, Path]) -> set[str]:
    """
    Every pipeline module reachable from `entry` by following imports.

    Only local modules are followed — a third-party import is not something this repo has to wire
    secrets for. Import names that resolve to a symbol rather than a module (`from config import
    Settings`) simply miss the module map and are ignored.
    """
    seen: set[str] = set()
    pending = [entry]
    while pending:
        name = pending.pop()
        if name in seen or name not in modules:
            continue
        seen.add(name)
        tree = ast.parse(modules[name].read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                pending.append(node.module)
                pending.extend(f"{node.module}.{alias.name}" for alias in node.names)
            elif isinstance(node, ast.Import):
                pending.extend(alias.name for alias in node.names)
    return seen


def _settings_fields_read(module_names: set[str], modules: dict[str, Path]) -> set[str]:
    """
    The Settings fields these modules read — the job's real environment requirement.

    Two shapes count, because the codebase uses both: a plain attribute read (`settings.fred_key`)
    and the explicit `require("fred_key")`. Only names that are genuinely fields on Settings are
    collected, which is what keeps a derived property like `database_url_psycopg` — a shape of
    DATABASE_URL, not an environment variable of its own — from being demanded as a secret.
    """
    fields = set(Settings.model_fields)
    found: set[str] = set()
    for name in sorted(module_names):
        tree = ast.parse(modules[name].read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
                if node.attr in fields:
                    found.add(node.attr)
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                if node.func.attr == "require" and node.args:
                    first = node.args[0]
                    if isinstance(first, ast.Constant) and first.value in fields:
                        found.add(first.value)
    return found


def _secrets_passed_to(workflow: str) -> set[str]:
    """Every environment variable the workflow fills from a GitHub secret."""
    return set(_SECRET_ENV_LINE.findall((_WORKFLOWS / workflow).read_text()))


@pytest.mark.parametrize(("job", "workflow"), sorted(JOB_WORKFLOWS.items()))
def test_every_secret_a_job_reads_is_passed_to_it_by_its_workflow(job: str, workflow: str):
    """
    The guard itself. A key the job reads and the workflow does not pass is a silent production
    failure with a green build — so it is a red test here instead.

    A field carrying a usable default (the pinned model names, the R2 bucket name) is not demanded:
    the job runs correctly without it. Only fields that default to None are real requirements, and
    those are exactly the credentials.
    """
    modules = _local_modules()
    reachable = _import_closure(job, modules)
    read = _settings_fields_read(reachable, modules)

    required = {
        field.upper()
        for field in read
        if Settings.model_fields[field].default is None
    }
    passed = _secrets_passed_to(workflow)

    # The sweep must prove it swept something. Seven guards in this build have passed because the
    # thing they measured was absent rather than correct, and a walk that silently resolved to zero
    # modules would "pass" this test forever.
    assert len(reachable) > 5, f"{job}: the import walk found almost nothing — it is not walking"
    assert "DATABASE_URL" in required, f"{job}: every job talks to the database; this walk missed it"

    missing = required - passed
    assert not missing, (
        f"{workflow} does not pass {sorted(missing)} to {job}, which reads {sorted(missing)} off "
        f"the settings object. The secret may well exist in GitHub — that is not the same thing as "
        f"the job being able to see it, and the job will degrade QUIETLY without it. Add it to the "
        f"env: block of the step that runs {job}."
    )


def test_the_guard_can_actually_fail():
    """
    The negative control. A guard that cannot fail is worse than no guard, because it also hands you
    a green tick — this build has found seven of those, which is why every new guard now proves it
    has teeth.

    Here the proof is direct: the real nightly-a is asked to satisfy a job that requires a secret it
    was never going to carry, and the check must notice.
    """
    passed = _secrets_passed_to("nightly-a.yml")
    invented = {"A_SECRET_NOBODY_PASSES"}

    assert invented - passed == invented, "the workflow reader claims to pass a secret that is not there"

    # And the reader is genuinely reading: the keys it found are the real ones.
    assert {"DATABASE_URL", "FINNHUB_KEY", "GOLDAPI_KEY"} <= passed
