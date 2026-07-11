"""
parquet_store.py — the full-market history as year-partitioned Parquet (plan Appendix A, P1 step 4).

The whole ~5-6k-symbol universe over years of bars is far too much for the serving Postgres, so it
lives as Parquet — written by Polars, queried by DuckDB — and only the pipeline ever reads it (the
app reads Postgres). This bucket is a re-pullable cache: losing it costs one Alpaca re-pull, not
data, so it holds no source of truth.

Layout (Appendix A): <root>/<dataset>/year=YYYY/part.parquet. Partitioning by year is what makes
the nightly "rewrite the current year" and the "rewrite one symbol across all years after a
corporate action" paths cheap — they touch only the partitions that changed.

The store takes a filesystem root: a local directory in tests and on the Actions runner, which
job_a syncs to and from R2. DuckDB can also read the partitions directly for ad-hoc SQL.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import polars as pl

PRICES = "prices_daily"
INDICATORS = "indicators_daily"
SIGNAL_EVENTS = "signal_events"


class ParquetStore:
    """Year-partitioned Parquet datasets under one root directory."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)

    def _dataset_dir(self, dataset: str) -> Path:
        return self.root / dataset

    def write_year(self, dataset: str, year: int, frame: pl.DataFrame) -> Path:
        """
        Write (replacing) one year partition of a dataset.

        Replacing the whole partition — rather than appending — is deliberate: the nightly run
        rewrites the current year from scratch each time (a trailing re-pull catches vendor
        restatements), and a full-partition write is the simplest way to stay idempotent.
        """
        partition = self._dataset_dir(dataset) / f"year={year}"
        partition.mkdir(parents=True, exist_ok=True)
        path = partition / "part.parquet"
        frame.write_parquet(path)
        return path

    def write_partitioned(self, dataset: str, frame: pl.DataFrame) -> list[Path]:
        """
        Write a frame spanning multiple years, one partition per year found in its `date` column.

        The frame must have a `date` column. Each distinct year becomes its own partition.
        """
        with_year = frame.with_columns(pl.col("date").dt.year().alias("_year"))
        written: list[Path] = []
        for (year,), group in with_year.group_by("_year", maintain_order=True):
            written.append(self.write_year(dataset, int(year), group.drop("_year")))
        return written

    def scan(self, dataset: str) -> pl.LazyFrame:
        """
        Lazily read every partition of a dataset as a Polars LazyFrame.

        Lazy so a caller can push symbol/date filters down to the Parquet before anything is read.
        Raises if the dataset does not exist — an empty read would silently hide a broken run.
        """
        glob = self._dataset_dir(dataset) / "year=*" / "*.parquet"
        matches = list(self._dataset_dir(dataset).glob("year=*/*.parquet"))
        if not matches:
            raise FileNotFoundError(f"No partitions for dataset '{dataset}' under {self.root}")
        return pl.scan_parquet(glob)

    def sql(self, dataset: str, query: str) -> pl.DataFrame:
        """
        Run a DuckDB SQL query over a dataset's partitions; `{dataset}` in the query is the source.

        DuckDB reads the Parquet directly with predicate/projection push-down — the tool the plan
        uses for scanning the full universe out of core. Example:
            store.sql(PRICES, "SELECT symbol, max(close) FROM {dataset} GROUP BY symbol")
        """
        glob = str(self._dataset_dir(dataset) / "year=*" / "*.parquet")
        con = duckdb.connect()
        try:
            resolved = query.replace("{dataset}", f"read_parquet('{glob}')")
            return con.execute(resolved).pl()
        finally:
            con.close()
