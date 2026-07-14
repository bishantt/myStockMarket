"""
config.py — every environment value the pipeline reads, in one typed place.

The placement authority for these is DEVELOPMENT-PLAN.md Appendix D: in the cloud they arrive as
GitHub Actions secrets, and locally they come from the repo-root .env. This module does not care
which — pydantic-settings reads the process environment first and falls back to the .env file.

Two design choices worth stating:

1. Most fields are optional here, and a job asks for what it needs with `require()`. That suits
   how the project comes up: secrets are provisioned progressively during Session-0, so a config
   that demanded all of them at import time could not be built until the very last key landed.
   `require()` fails loudly, names the missing variable, and says where it belongs — at the exact
   moment a job actually needs it.

2. `database_url_psycopg` exists because the app and the pipeline share one DATABASE_URL, but they
   need it in slightly different shapes. Prisma wants `?pgbouncer=true` on the transaction pooler;
   psycopg rejects that parameter outright. So the canonical URL carries the Prisma form and this
   property strips the Prisma-only bits before the pipeline hands it to psycopg.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

from pydantic_settings import BaseSettings, SettingsConfigDict


# The repo-root .env, found relative to this file. Absent in CI, which is fine: pydantic-settings
# simply skips a missing env_file and reads the process environment (the GitHub secrets).
_REPO_ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"

# Query-string parameters that Prisma understands but psycopg does not. Stripped from the URL
# before it reaches the Postgres driver.
_PRISMA_ONLY_DB_PARAMS = frozenset({"pgbouncer", "connection_limit", "schema"})


class MissingConfig(RuntimeError):
    """Raised when a job needs an environment value that was never provided."""


class Settings(BaseSettings):
    """
    The full inventory of pipeline environment values (Appendix D).

    Fields are optional so the object always constructs; `require()` enforces presence per value,
    per job. The two model fields with defaults (`model_extract`, `model_synth`, `r2_bucket`) match
    the plan's pinned defaults and are safe to rely on unset.
    """

    model_config = SettingsConfigDict(
        env_file=_REPO_ROOT_ENV if _REPO_ROOT_ENV.exists() else None,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database (Supabase). DATABASE_URL is the transaction pooler; SESSION_POOLER_URL is used by
    # the weekly backup and the migrate workflow.
    database_url: str | None = None
    session_pooler_url: str | None = None

    # Data providers.
    alpaca_key_id: str | None = None
    alpaca_secret: str | None = None
    finnhub_key: str | None = None
    fmp_key: str | None = None
    marketaux_key: str | None = None
    fred_key: str | None = None
    edgar_user_agent: str | None = None
    # The macro board's gold cell (provisioning row P-5). Absent today, and the board says so on
    # screen — the cell renders "not yet reported" rather than a number nobody checked.
    goldapi_key: str | None = None

    # LLM briefing. Models are pinned with defaults; reconfirm pricing at build time (plan §2.1).
    anthropic_api_key: str | None = None
    model_extract: str = "claude-haiku-4-5"
    model_synth: str = "claude-sonnet-5"

    # History store (Cloudflare R2).
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret: str | None = None
    r2_bucket: str = "msm-history"

    # Monitoring (healthchecks.io).
    healthchecks_ping_url: str | None = None
    healthchecks_api_key: str | None = None

    # App handshake.
    cron_secret: str | None = None
    app_base_url: str | None = None

    def require(self, field: str) -> str:
        """
        Return the value of a field, or fail loudly if it is empty.

        The error names the environment variable and points at Appendix D, so a missing secret
        produces an instruction rather than a stack trace nobody can act on.
        """
        value = getattr(self, field, None)
        if not value:
            env_name = field.upper()
            raise MissingConfig(
                f"{env_name} is not set. This job needs it. Provide it as a GitHub Actions "
                f"secret (or in the repo-root .env for local runs) per DEVELOPMENT-PLAN.md "
                f"Appendix D."
            )
        return value

    @property
    def database_url_psycopg(self) -> str:
        """
        DATABASE_URL with Prisma-only query parameters removed, so psycopg will accept it.

        psycopg errors on an unknown connection parameter like `pgbouncer`; Prisma requires it.
        Rather than store the URL twice, the canonical value carries the Prisma form and this
        property produces the psycopg form on demand.
        """
        url = self.require("database_url")
        parts = urlsplit(url)
        kept = [(k, v) for k, v in parse_qsl(parts.query) if k.lower() not in _PRISMA_ONLY_DB_PARAMS]
        return urlunsplit(parts._replace(query=urlencode(kept)))


def load_settings() -> Settings:
    """Build the settings object. Kept as a function so tests can construct it in isolation."""
    return Settings()


# ----- The price table (PD7, plan 9.5 — the cost instrument) -----
#
# Dollars per MILLION tokens, (input, output), per model. THIS IS THE ONLY PLACE IN THE PIPELINE
# WHERE A PRICE IS WRITTEN DOWN, and it is written down because 0.2.3 committed to a number:
# "≈$0.03–0.06/night on top of the current ~$0.33 — measured at PD7's gate, not promised."
# A promise nobody measures is a guess with a decimal point in it, so the night now MEASURES.
#
# PROVENANCE (checked 2026-07-14 against the Anthropic model catalogue, cached 2026-06-24):
#   claude-haiku-4-5  — $1.00 in / $5.00  out per MTok
#   claude-sonnet-5   — $3.00 in / $15.00 out per MTok  (list price)
#
# ONE HONEST WRINKLE, AND IT IS STATED RATHER THAN QUIETLY BAKED IN: Sonnet 5 is running an
# INTRODUCTORY rate of $2.00/$10.00 per MTok through 2026-08-31. The constants below carry the LIST
# price, not the intro price, which means every dollar figure this pipeline prints between now and
# then is an UPPER BOUND on the real bill — too high, never too low.
#
# That is deliberate. The alternative is a table that silently becomes WRONG on 2026-09-01, in the
# direction of under-reporting, on a night nobody is watching — and a cost instrument that
# under-reports is worse than no cost instrument, because it is trusted. An upper bound that quietly
# becomes exact is the failure mode to prefer. The evidence file records both numbers.
#
# TOKEN COUNTS ARE MEASURED, FROM THE API'S OWN `usage` BLOCK. Only the multiplication happens here.
_PRICE_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-haiku-4-5": (1.00, 5.00),
    "claude-sonnet-5": (3.00, 15.00),
}

# A model we have no price for costs an UNKNOWN amount, and the honest rendering of an unknown
# amount is zero dollars with the model named in the log — never a guessed rate. A wrong price is a
# lie the reader cannot check; a missing price is visibly missing.
_PRICE_UNKNOWN = (0.0, 0.0)


def price_per_mtok(model: str) -> tuple[float, float]:
    """The (input, output) dollars-per-million-tokens for a model, or zeroes if it is not priced."""
    return _PRICE_PER_MTOK.get(model, _PRICE_UNKNOWN)
