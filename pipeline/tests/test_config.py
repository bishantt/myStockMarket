"""
Tests for config.py — the plan's "missing env fails loudly" requirement (§6.2, P0 tests-first),
plus the psycopg URL sanitising that keeps one DATABASE_URL usable by both Prisma and psycopg.
"""

import pytest

from config import MissingConfig, Settings


def _settings(**overrides) -> Settings:
    """
    Build a Settings object from an explicit dict, ignoring the ambient environment and the
    repo-root .env, so a test's expectations do not depend on the machine it runs on.
    """
    # _env_file=None disables the .env fallback; the values passed here are the whole world.
    return Settings(_env_file=None, **overrides)


class TestRequire:
    def test_missing_value_fails_loudly_and_names_the_variable(self):
        settings = _settings()
        with pytest.raises(MissingConfig) as exc:
            settings.require("alpaca_key_id")
        message = str(exc.value)
        # The error has to be actionable: it names the env var and points at the placement authority.
        assert "ALPACA_KEY_ID" in message
        assert "Appendix D" in message

    def test_an_empty_string_counts_as_missing(self):
        # An empty value is not a provided value — it is the classic "the secret was set to nothing"
        # failure, and it must be caught exactly like an absent one.
        settings = _settings(finnhub_key="")
        with pytest.raises(MissingConfig):
            settings.require("finnhub_key")

    def test_a_present_value_is_returned(self):
        settings = _settings(fred_key="abc123")
        assert settings.require("fred_key") == "abc123"


class TestDefaults:
    def test_model_and_bucket_defaults_match_the_plan(self):
        settings = _settings()
        assert settings.model_extract == "claude-haiku-4-5"
        assert settings.model_synth == "claude-sonnet-5"
        assert settings.r2_bucket == "msm-history"


class TestDatabaseUrlForPsycopg:
    def test_strips_prisma_only_pgbouncer_param(self):
        settings = _settings(
            database_url="postgresql://u:p@host:6543/postgres?pgbouncer=true",
        )
        # psycopg would reject ?pgbouncer=true; the sanitised form drops it.
        assert settings.database_url_psycopg == "postgresql://u:p@host:6543/postgres"

    def test_keeps_ordinary_params_and_drops_only_prisma_ones(self):
        settings = _settings(
            database_url="postgresql://u:p@host:6543/postgres?pgbouncer=true&sslmode=require&connection_limit=1",
        )
        result = settings.database_url_psycopg
        assert "pgbouncer" not in result
        assert "connection_limit" not in result
        assert "sslmode=require" in result

    def test_a_url_with_no_query_is_unchanged(self):
        settings = _settings(database_url="postgresql://u:p@host:5432/postgres")
        assert settings.database_url_psycopg == "postgresql://u:p@host:5432/postgres"

    def test_missing_database_url_fails_loudly(self):
        settings = _settings()
        with pytest.raises(MissingConfig):
            _ = settings.database_url_psycopg
