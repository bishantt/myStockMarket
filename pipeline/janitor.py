"""
janitor.py — fresh in, stale out (CC10, plan 4.8).

ONE manifest names every Prisma model with a retention policy, and a unit test mirrors it against
schema.prisma in BOTH directions: a new table with no policy reds the build, and a policy naming a
table that no longer exists reds it too (the routes-manifest pattern, applied to data). The janitor's
DELETE targets are derived from the `Trailing` entries ONLY — everything else is `Forever` (the
record, which the janitor may never name) or `Replace` (self-cleaning, which it leaves alone). A test
proves the deleter refuses any table not on that derived allow-list, so a `forever` model can never be
reached through this door even by a typo.

Two locks, not one. The allow-list is the janitor's own promise; signal_log and signal_resolution are
ALSO trigger-guarded in the database (insert-only), so the ledger this product may never rewrite is
protected physically as well as by policy.

The stage appends to the nightly FULL run, after publish and before revalidate. It NEVER touches the
R2 parquet lake (compute mode reads the five-year history from it); the one R2 deletion it performs is
trimming the `backups/` prefix to the most recent dumps.

Couplings honored (4.8):
  · Sessions are trading sessions (trading_calendar answers), days are calendar days. Every trailing
    entry names the DATE COLUMN it trims by — "old" is defined by the data, never the janitor's opinion.
  · Foreign keys decide deletion ORDER: catalyst_link (a child of news_cluster with no date of its own)
    goes before its parent; an old news_image is removed only once no surviving cluster references it.
  · Brief citations: news_item deletion starts at the snapshot cutover date — the earliest briefing that
    stored its own sources (sourcesJson, CC10). Before that date a published briefing's sources are only
    joinable, so its news is never purged; after it, every briefing is self-contained and its news may age.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Mapping, Union

import psycopg

from trading_calendar import sessions_before

# How many weekly database dumps to keep under the R2 `backups/` prefix (Part 0.4 default).
DEFAULT_BACKUPS_KEEP = 8


# ── policies ─────────────────────────────────────────────────────────────────────────────────────
# A policy is a promise about what happens to a table's rows over time. Three kinds, and only the
# trailing ones are ever deleted by this stage.


@dataclass(frozen=True)
class Forever:
    """The record. The janitor cannot name these as delete targets; some are also DB-trigger locked."""

    reason: str


@dataclass(frozen=True)
class Replace:
    """Rewritten wholesale by the pipeline each run (the forward calendar). The janitor leaves it alone."""

    reason: str


@dataclass(frozen=True)
class Trailing:
    """Keep the most recent `amount` `unit`s of rows, trimmed by `column`. `unit` is "days" (calendar)
    or "sessions" (trading). `per_symbol` is informational for price_bar — the served symbols share the
    market calendar, so a single date floor keeps at most `amount` sessions for every one of them."""

    amount: int
    unit: str  # "days" | "sessions"
    column: str
    per_symbol: bool = False


@dataclass(frozen=True)
class TrailingByParent:
    """A child with no date of its own (catalyst_link), retired when its parent row is. Its `column`
    names the PARENT's date column, so "old" is still defined by the data — just the parent's data."""

    parent: str
    amount: int
    unit: str
    column: str


Policy = Union[Forever, Replace, Trailing, TrailingByParent]


# ── the manifest (Appendix D) ────────────────────────────────────────────────────────────────────
# Keyed by the Prisma @@map table name — the name the janitor's SQL uses. schema.prisma is the truth
# for WHICH tables exist; this is the truth for what happens to each. The unit test binds them.

MANIFEST: Mapping[str, Policy] = {
    # forever — the record. ~250 pipeline_run rows a year is operational memory the control room reads;
    # the two insert-only ledgers are trigger-locked in the database as a second, physical guarantee.
    "pipeline_run": Forever("operational memory the control room reads (~250 rows/year)"),
    "instrument": Forever("the universe; delisted names are retained, never dropped (survivorship, RR §6.5)"),
    "signal_log": Forever("insert-only track record; a DB trigger second-locks it (§1.5 rule 7)"),
    "signal_resolution": Forever("insert-only; a DB trigger second-locks it"),
    "market_context": Forever("one row per session — the macro board's history"),
    "briefing": Forever("the editorial record; snapshots its own sources so news purges never orphan it"),
    "journal_entry": Forever("the reader's own words — the accountability record"),
    "base_rate_stat": Forever("the honesty engine's evidence, recomputed in place, never purged"),
    "concept_state": Forever("the reader's Academy review schedule"),
    "lesson_progress": Forever("what the reader has read"),
    "paper_trade": Forever("the reader's own ledger"),
    "macro_stat": Forever("each series' observation history, on its own cadence"),
    "manual_run": Forever("the reader's own dispatch history — user state (✎)"),
    "watchlist_item": Forever("the reader's own watchlist — user data, never purged (Q-CC10-1)"),
    # replace — the pipeline rewrites the forward window each run. The janitor never names it.
    "calendar_event": Replace("the forward calendar is replaced wholesale each run (publish_calendar)"),
    # trailing — the janitor's only delete targets.
    "news_item": Trailing(45, "days", "published_at"),
    "news_cluster": Trailing(45, "days", "run_date"),
    "news_image": Trailing(45, "days", "fetched_at"),
    "catalyst_link": TrailingByParent("news_cluster", 45, "days", "run_date"),
    "scan_result": Trailing(30, "sessions", "run_date"),
    "setup_card": Trailing(30, "sessions", "run_date"),
    "vol_band": Trailing(30, "sessions", "run_date"),
    "price_bar": Trailing(400, "sessions", "date", per_symbol=True),
}


def delete_allow_list() -> frozenset[str]:
    """The ONLY tables the janitor may delete from — derived from the trailing policies, nothing else.
    A `forever` or `replace` table is not here, so the deleter refuses it (see _guard)."""
    return frozenset(
        name
        for name, policy in MANIFEST.items()
        if isinstance(policy, (Trailing, TrailingByParent))
    )


def _guard(table: str) -> None:
    """Refuse to delete from a table not on the derived allow-list. This is the door `forever` models
    can never come through — the manifest is a promise, and this is the promise enforced in code."""
    if table not in delete_allow_list():
        raise ValueError(
            f"janitor: refusing to delete from {table!r} — it is not a trailing policy in the manifest. "
            f"The janitor deletes ONLY {sorted(delete_allow_list())}."
        )


# ── the report ───────────────────────────────────────────────────────────────────────────────────


@dataclass
class JanitorReport:
    """What one janitor run retired — countable and boring (4.8). `deleted` is per-table row counts;
    the display numbers (news rows, scan sessions, backups kept) are derived for the control-room line."""

    run_date: date
    deleted: dict[str, int] = field(default_factory=dict)
    scan_sessions: int = 0
    backups_seen: int = 0
    backups_kept: int = 0
    backups_deleted: list[str] = field(default_factory=list)
    news_days: int = 45

    @property
    def news_rows(self) -> int:
        """Total news rows retired across the whole news group — what the reader sees as "N news items"."""
        return sum(self.deleted.get(t, 0) for t in ("news_item", "news_cluster", "catalyst_link", "news_image"))

    def to_entry(self, ran_at) -> dict:
        """The nested entry publish_janitor merges into the night's source_status — the twin of the dawn
        entry (CC8). The control room reads it for the Janitor row's "Retired last night" line."""
        return {
            "ranAt": ran_at.isoformat(),
            "news": self.news_rows,
            "days": self.news_days,
            "scans": self.scan_sessions,
            "backupsKept": self.backups_kept,
            "backupsSeen": self.backups_seen,
            "deleted": dict(self.deleted),
        }


# ── the stage ──────────────────────────────────────────────────────────────────────────────────


def snapshot_cutover(conn: psycopg.Connection) -> date | None:
    """The earliest briefing that stored its own sources (sourcesJson, CC10) — the date from which news
    deletion is safe. None until the first such briefing exists (the CC10 deploy night, before Job B has
    run once): with no cutover the janitor deletes NO news, which is the safe default."""
    with conn.cursor() as cur:
        cur.execute("SELECT MIN(run_date) FROM briefing WHERE sources_json IS NOT NULL")
        row = cur.fetchone()
    return row[0] if row and row[0] is not None else None


def _delete(cur, table: str, where: str, params: tuple) -> int:
    """Run one guarded DELETE and return the row count. Every path into a DELETE goes through _guard."""
    _guard(table)
    cur.execute(f"DELETE FROM {table} WHERE {where}", params)
    return cur.rowcount


def run_janitor(
    conn: psycopg.Connection,
    *,
    run_date: date,
    r2=None,
    backups_keep: int = DEFAULT_BACKUPS_KEEP,
) -> JanitorReport:
    """
    Retire what has aged out, and return the report. Commits the database deletions atomically; the R2
    backup trim runs after the commit (it is object storage, not part of the transaction).

    News is a coupled group and deletes in foreign-key order: the child links first, then the clusters,
    then the standalone articles (floored at the snapshot cutover), then any image no surviving cluster
    still points at. Sessions-based tables trim to a trading-session floor; price bars to the 400-session
    serving history (the five-year lake on R2 is untouched).
    """
    report = JanitorReport(run_date=run_date)
    cutover = snapshot_cutover(conn)
    news_cutoff = run_date - timedelta(days=45)

    try:
        with conn.cursor() as cur:
            # News group, in FK-safe order. catalyst_link has no date of its own — it is retired with the
            # clusters about to go (TrailingByParent), so it must go FIRST or the parent delete fails.
            report.deleted["catalyst_link"] = _delete(
                cur, "catalyst_link",
                "cluster_id IN (SELECT id FROM news_cluster WHERE run_date < %s)", (news_cutoff,),
            )
            report.deleted["news_cluster"] = _delete(cur, "news_cluster", "run_date < %s", (news_cutoff,))
            # Articles are the briefing's sources. Delete only those from the snapshot era — a pre-cutover
            # briefing's sources are only joinable, so its news is left in place (4.8's brief-citation coupling).
            if cutover is not None:
                report.deleted["news_item"] = _delete(
                    cur, "news_item",
                    "published_at < %s AND published_at >= %s", (news_cutoff, cutover),
                )
            else:
                report.deleted["news_item"] = 0
            # An old image is removed only once no surviving cluster still references it (the FK points
            # cluster → image, so an old image under a young cluster must stay).
            report.deleted["news_image"] = _delete(
                cur, "news_image",
                "fetched_at < %s AND id NOT IN (SELECT image_id FROM news_cluster WHERE image_id IS NOT NULL)",
                (news_cutoff,),
            )

            # Sessions-based tables — keep the most recent N trading sessions of rows.
            floor30 = sessions_before(run_date, 30 - 1)
            # Counted BEFORE the delete: how many whole sessions of scan rows the trim covers — the
            # "{scans} sessions of scan rows" the control-room line reports. On the nightly cadence this
            # is normally one (the session that just fell past the 30-session window).
            cur.execute("SELECT COUNT(DISTINCT run_date) FROM scan_result WHERE run_date < %s", (floor30,))
            report.scan_sessions = cur.fetchone()[0]
            for table in ("scan_result", "setup_card", "vol_band"):
                report.deleted[table] = _delete(cur, table, "run_date < %s", (floor30,))

            # Price bars — the 400-session serving floor. The R2 parquet lake keeps the full history.
            floor400 = sessions_before(run_date, 400 - 1)
            report.deleted["price_bar"] = _delete(cur, "price_bar", "date < %s", (floor400,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise

    _trim_backups(r2, report, keep=backups_keep)
    return report


def _trim_backups(r2, report: JanitorReport, *, keep: int) -> None:
    """Keep the most recent `keep` weekly dumps under the R2 `backups/` prefix; delete the rest. The keys
    are `backups/msm-YYYY-MM-DD.dump`, so a lexicographic sort is chronological. Skipped (no-op) when R2 is
    not configured — the local and fixture worlds have no bucket, and that is not a failure."""
    if r2 is None:
        return
    keys = sorted(k for k in r2.list_keys("backups/") if k.endswith(".dump"))
    report.backups_seen = len(keys)
    if len(keys) <= keep:
        report.backups_kept = len(keys)
        return
    doomed = keys[: len(keys) - keep]
    for key in doomed:
        r2.delete_key(key)
    report.backups_deleted = doomed
    report.backups_kept = keep
