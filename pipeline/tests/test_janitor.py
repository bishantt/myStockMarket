"""
test_janitor.py — the lifecycle stage (CC10, plan 4.8).

Two kinds of test. The manifest⇔schema mirror and the allow-list refusal are pure — they read
schema.prisma and the manifest, no database. The retention arithmetic, the citation-resolution proof,
the forever-survives guarantee and the FK-safe news deletion use the throwaway-Postgres `db` fixture
(they SKIP without TEST_DATABASE_URL, and CI always runs them).
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from pathlib import Path

import psycopg
import pytest

import janitor
from janitor import (
    MANIFEST,
    Forever,
    Replace,
    Trailing,
    TrailingByParent,
    delete_allow_list,
    run_janitor,
)
from trading_calendar import sessions_before

_SCHEMA = Path(__file__).resolve().parents[2] / "app" / "prisma" / "schema.prisma"


# ── the manifest ⇔ schema mirror (no database) ────────────────────────────────────────────────


def _schema_tables() -> set[str]:
    """Every @@map table name in schema.prisma — the tables that actually exist."""
    return set(re.findall(r'@@map\("([^"]+)"\)', _SCHEMA.read_text()))


def test_manifest_names_every_table_and_no_ghosts():
    """The mirror, BOTH directions: a new table with no policy reds this, and a policy for a table that
    no longer exists reds it too. This is the routes-manifest guarantee applied to the data model."""
    schema = _schema_tables()
    manifest = set(MANIFEST)
    missing = schema - manifest
    ghosts = manifest - schema
    assert not missing, f"tables in schema.prisma with no janitor policy: {sorted(missing)}"
    assert not ghosts, f"janitor policies for tables that do not exist: {sorted(ghosts)}"


def test_every_trailing_policy_names_a_date_column():
    """"Old" must be defined by the data. A trailing policy without a named date column would let the
    janitor decide what "old" means by opinion — a red test by design (Appendix D)."""
    for name, policy in MANIFEST.items():
        if isinstance(policy, (Trailing, TrailingByParent)):
            assert policy.column, f"{name}: a trailing policy with no date column"
            assert policy.unit in ("days", "sessions"), f"{name}: {policy.unit!r} is not a retention unit"


# ── the allow-list (the deletion door) ────────────────────────────────────────────────────────


def test_allow_list_is_exactly_the_trailing_tables():
    assert delete_allow_list() == {
        "news_item", "news_cluster", "news_image", "catalyst_link",
        "scan_result", "setup_card", "vol_band", "price_bar",
    }


@pytest.mark.parametrize("table", ["briefing", "signal_log", "signal_resolution", "watchlist_item",
                                    "calendar_event", "pipeline_run", "paper_trade"])
def test_guard_refuses_a_forever_or_replace_table(table):
    """The janitor cannot be pointed at a table it does not own, even by a typo — the forever models are
    unreachable through this door. calendar_event is self-cleaning (Replace) and also refused."""
    with pytest.raises(ValueError, match="refusing to delete"):
        janitor._guard(table)


@pytest.mark.parametrize("table", ["news_item", "price_bar", "scan_result", "catalyst_link"])
def test_guard_allows_a_trailing_table(table):
    janitor._guard(table)  # does not raise


# ── the R2 backup trim (a fake bucket, no network) ───────────────────────────────────────────


class _FakeR2:
    """A stand-in for R2Store with the two methods the janitor calls."""

    def __init__(self, keys):
        self.keys = list(keys)
        self.deleted: list[str] = []

    def list_keys(self, prefix):
        return sorted(k for k in self.keys if k.startswith(prefix))

    def delete_key(self, key):
        self.deleted.append(key)
        self.keys.remove(key)


def test_backup_trim_keeps_the_most_recent_dumps():
    keys = [f"backups/msm-2026-07-{day:02d}.dump" for day in range(1, 13)]  # 12 dumps
    r2 = _FakeR2(keys + ["prices_daily/year=2026/part.parquet"])  # a lake key it must ignore
    report = janitor.JanitorReport(run_date=date(2026, 7, 12))
    janitor._trim_backups(r2, report, keep=8)
    assert report.backups_seen == 12
    assert report.backups_kept == 8
    assert len(r2.deleted) == 4
    # The four OLDEST were retired; the lake key was never touched.
    assert r2.deleted == [f"backups/msm-2026-07-{day:02d}.dump" for day in range(1, 5)]
    assert "prices_daily/year=2026/part.parquet" in r2.keys


def test_backup_trim_noop_under_the_cap_and_without_r2():
    r2 = _FakeR2([f"backups/msm-2026-07-0{day}.dump" for day in range(1, 4)])  # 3 < 8
    report = janitor.JanitorReport(run_date=date(2026, 7, 3))
    janitor._trim_backups(r2, report, keep=8)
    assert report.backups_kept == 3 and r2.deleted == []
    # No R2 configured (local / fixtures) is a no-op, never a failure.
    janitor._trim_backups(None, report, keep=8)


# ── the database stage (throwaway Postgres) ──────────────────────────────────────────────────

# A fixed anchor that is a real NYSE session, so the session arithmetic is exact.
_ANCHOR = date(2026, 7, 10)  # a Friday


def _insert_scan(cur, run_date: date, symbol: str = "AAA"):
    cur.execute(
        "INSERT INTO scan_result (id, run_date, preset_key, symbol, rank, metrics) "
        "VALUES (%s, %s, 'unusual-volume', %s, 1, '{}'::jsonb)",
        (f"s-{run_date.isoformat()}-{symbol}", run_date, symbol),
    )


def _insert_bar(cur, day: date, symbol: str = "AAA"):
    cur.execute(
        "INSERT INTO price_bar (symbol, date, open, high, low, close, adj_close, vol) "
        "VALUES (%s, %s, 1, 1, 1, 1, 1, 1)",
        (symbol, day),
    )


def _insert_news_item(cur, published_at: datetime, id_: str):
    cur.execute(
        "INSERT INTO news_item (id, published_at, provider, url, headline, snippet, tickers, industries) "
        "VALUES (%s, %s, 'finnhub', %s, 'h', 's', '{}', '{}')",
        (id_, published_at, f"https://x/{id_}"),
    )


def _insert_briefing(cur, run_date: date, *, sources_json: str | None):
    cur.execute(
        "INSERT INTO briefing (run_date, am_json, verification_json, model_meta, status, sources_json) "
        "VALUES (%s, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'published', %s::jsonb)",
        (run_date, sources_json),
    )


def _count(cur, table: str) -> int:
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    return cur.fetchone()[0]


def test_sessions_retention_keeps_the_last_30(db):
    """scan_result is trailing(30 sessions): the row at the 30-session floor survives, the one a session
    past it does not. Sessions, not calendar days — the arithmetic runs through the NYSE calendar."""
    with db.cursor() as cur:
        _insert_scan(cur, sessions_before(_ANCHOR, 0), "keep-newest")
        _insert_scan(cur, sessions_before(_ANCHOR, 29), "keep-floor")   # the 30th-most-recent session
        _insert_scan(cur, sessions_before(_ANCHOR, 30), "drop-just-past")
        _insert_scan(cur, sessions_before(_ANCHOR, 60), "drop-old")
    db.commit()

    report = run_janitor(db, run_date=_ANCHOR)

    with db.cursor() as cur:
        cur.execute("SELECT symbol FROM scan_result ORDER BY symbol")
        remaining = [r[0] for r in cur.fetchall()]
    assert remaining == ["keep-floor", "keep-newest"]
    assert report.deleted["scan_result"] == 2
    assert report.scan_sessions == 2  # two whole sessions of scan rows fell past the window


def test_price_bars_keep_400_sessions(db):
    with db.cursor() as cur:
        _insert_bar(cur, sessions_before(_ANCHOR, 399), "AAA")  # the floor — survives
        _insert_bar(cur, sessions_before(_ANCHOR, 400), "AAA")  # one past — deleted
    db.commit()

    run_janitor(db, run_date=_ANCHOR)

    with db.cursor() as cur:
        cur.execute("SELECT date FROM price_bar ORDER BY date")
        rows = [r[0] for r in cur.fetchall()]
    assert rows == [sessions_before(_ANCHOR, 399)]


def test_news_retention_is_calendar_days_and_floored_at_the_cutover(db):
    """news_item is trailing(45 DAYS) — and its deletion starts at the snapshot cutover (the earliest
    briefing that stored its own sources). A pre-cutover article is protected even when it is far past 45
    days; a post-cutover one past 45 days is retired; a fresh one is kept."""
    with db.cursor() as cur:
        _insert_briefing(cur, _ANCHOR - timedelta(days=100), sources_json='[{"title":"t"}]')  # the cutover
        _insert_news_item(cur, datetime(2026, 7, 8, 12), "fresh")            # ~2 days old — kept
        _insert_news_item(cur, _ANCHOR - timedelta(days=60), "post-cutover-old")  # >45d, after cutover — dropped
        _insert_news_item(cur, _ANCHOR - timedelta(days=200), "pre-cutover-old")  # before cutover — protected
    db.commit()

    report = run_janitor(db, run_date=_ANCHOR)

    with db.cursor() as cur:
        cur.execute("SELECT id FROM news_item ORDER BY id")
        remaining = [r[0] for r in cur.fetchall()]
    assert remaining == ["fresh", "pre-cutover-old"]
    assert report.deleted["news_item"] == 1


def test_news_deletion_is_skipped_with_no_cutover(db):
    """Before the first briefing stores its sources (the CC10 deploy night, before Job B runs), there is
    no cutover — so NO news is deleted. Deleting a stale article whose brief cannot yet resolve its own
    sources is exactly the orphaning the coupling prevents."""
    with db.cursor() as cur:
        _insert_news_item(cur, _ANCHOR - timedelta(days=200), "very-old")
    db.commit()

    report = run_janitor(db, run_date=_ANCHOR)

    with db.cursor() as cur:
        assert _count(cur, "news_item") == 1
    assert report.deleted["news_item"] == 0


def test_a_purged_news_item_leaves_the_briefings_sources_resolvable(db):
    """The citation-resolution proof (4.8). A published briefing snapshots its sources; when the janitor
    purges the underlying news_item, the briefing's sources still resolve — from sources_json, no join."""
    sources = '[{"title":"Fed holds","outlet":"Reuters","url":"https://reuters/fed"}]'
    with db.cursor() as cur:
        _insert_briefing(cur, _ANCHOR - timedelta(days=100), sources_json=sources)  # cutover + the brief
        _insert_news_item(cur, _ANCHOR - timedelta(days=60), "the-source-article")  # post-cutover, >45d
    db.commit()

    run_janitor(db, run_date=_ANCHOR)

    with db.cursor() as cur:
        assert _count(cur, "news_item") == 0  # the article is gone
        cur.execute("SELECT sources_json FROM briefing WHERE run_date = %s", (_ANCHOR - timedelta(days=100),))
        resolved = cur.fetchone()[0]
    # The sources resolve entirely from the briefing row, with no news_item to join against.
    assert resolved == [{"title": "Fed holds", "outlet": "Reuters", "url": "https://reuters/fed"}]


def test_forever_tables_survive_a_run(db):
    """The record is untouchable. A run over aged data leaves every forever table exactly as it was —
    the allow-list holds at runtime, not only in the unit test."""
    with db.cursor() as cur:
        cur.execute("INSERT INTO instrument (symbol, name, exchange) VALUES ('AAA', 'Aaa', 'NASDAQ')")
        cur.execute(
            "INSERT INTO watchlist_item (id, symbol, reason, added_at) VALUES ('w1', 'AAA', 'why', %s)",
            (_ANCHOR - timedelta(days=999),),
        )
        cur.execute(
            "INSERT INTO signal_log (id, fired_date, symbol, pattern_key, horizon_days, resolves_on) "
            "VALUES ('sig1', %s, 'AAA', 'golden-cross', 10, %s)",
            (_ANCHOR - timedelta(days=999), _ANCHOR - timedelta(days=985)),
        )
        _insert_briefing(cur, _ANCHOR - timedelta(days=999), sources_json=None)
        # And an old scan row, so the run actually does delete SOMETHING (proving it ran).
        _insert_scan(cur, sessions_before(_ANCHOR, 90))
    db.commit()

    run_janitor(db, run_date=_ANCHOR)

    with db.cursor() as cur:
        assert _count(cur, "watchlist_item") == 1
        assert _count(cur, "signal_log") == 1
        assert _count(cur, "briefing") == 1
        assert _count(cur, "instrument") == 1
        assert _count(cur, "scan_result") == 0  # the run really did clean


def test_news_group_deletes_in_fk_safe_order_and_spares_referenced_images(db):
    """The news group is a graph: catalyst_link → cluster → image. An old cluster's link goes first (or
    the parent delete would fail on the FK); an old image is spared while a SURVIVING cluster still points
    at it."""
    old = _ANCHOR - timedelta(days=100)
    young = _ANCHOR - timedelta(days=1)
    with db.cursor() as cur:
        for img, fetched in (("img-orphaned", old), ("img-shared", old)):
            cur.execute(
                "INSERT INTO news_image (id, source_kind, url_full, url_card, url_thumb, width, height, "
                "blur_data_url, dominant_color, attribution_source, attribution_url, fetched_at) "
                "VALUES (%s, 'og', 'u', 'u', 'u', 1, 1, 'b', '#000', 'a', 'u', %s)",
                (img, fetched),
            )
        _insert_cluster(cur, "cl-old", old, image_id="img-orphaned")   # aged out
        _insert_cluster(cur, "cl-young", young, image_id="img-shared")  # survives — its image must too
        cur.execute(
            "INSERT INTO catalyst_link (id, cluster_id, symbol, has_setup_card) VALUES ('lk1','cl-old','AAA',false)"
        )
    db.commit()

    report = run_janitor(db, run_date=_ANCHOR)

    with db.cursor() as cur:
        cur.execute("SELECT id FROM news_cluster ORDER BY id")
        assert [r[0] for r in cur.fetchall()] == ["cl-young"]
        cur.execute("SELECT id FROM news_image ORDER BY id")
        assert [r[0] for r in cur.fetchall()] == ["img-shared"]  # the referenced image survived
        assert _count(cur, "catalyst_link") == 0
    assert report.deleted["news_cluster"] == 1
    assert report.deleted["news_image"] == 1  # only the orphaned one
    assert report.deleted["catalyst_link"] == 1


def _insert_cluster(cur, id_: str, run_date: date, *, image_id: str | None = None):
    cur.execute(
        "INSERT INTO news_cluster (id, run_date, first_seen, headline, event_type, sectors, themes, "
        "tickers, significance, sources, extract, verification, image_id) "
        "VALUES (%s, %s, %s, 'h', 'macro', '{}', '{}', '{}', 0.5, 1, '{}'::jsonb, '{}'::jsonb, %s)",
        (id_, run_date, datetime.combine(run_date, datetime.min.time()), image_id),
    )
