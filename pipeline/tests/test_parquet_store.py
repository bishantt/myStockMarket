"""
Tests for parquet_store.py (plan Appendix A, P1 step 4), using a local temp directory as the root.
Verifies year partitioning, round-trips through both Polars and DuckDB, idempotent partition
rewrites, and that a missing dataset fails loudly.
"""

from datetime import date

import polars as pl
import pytest

from parquet_store import PRICES, ParquetStore


def _bars(symbol: str, days: list[date]) -> pl.DataFrame:
    return pl.DataFrame(
        {
            "symbol": [symbol] * len(days),
            "date": days,
            "close": [100.0 + i for i in range(len(days))],
            "volume": [1_000_000 + i for i in range(len(days))],
        }
    )


def test_writes_one_partition_per_year(tmp_path):
    store = ParquetStore(tmp_path)
    frame = _bars("AAA", [date(2024, 12, 31), date(2025, 1, 1), date(2025, 6, 1)])
    store.write_partitioned(PRICES, frame)

    years = sorted(p.name for p in (tmp_path / PRICES).glob("year=*"))
    assert years == ["year=2024", "year=2025"]


def test_polars_round_trip(tmp_path):
    store = ParquetStore(tmp_path)
    frame = _bars("AAA", [date(2025, 1, 1), date(2025, 1, 2)])
    store.write_partitioned(PRICES, frame)

    read = store.scan(PRICES).collect().sort("date")
    assert read["close"].to_list() == [100.0, 101.0]
    assert read["symbol"].to_list() == ["AAA", "AAA"]


def test_duckdb_can_query_the_partitions(tmp_path):
    store = ParquetStore(tmp_path)
    store.write_partitioned(
        PRICES,
        pl.concat([
            _bars("AAA", [date(2025, 1, 1), date(2025, 1, 2)]),
            _bars("BBB", [date(2025, 1, 1)]),
        ]),
    )
    counts = store.sql(PRICES, "SELECT symbol, count(*) AS n FROM {dataset} GROUP BY symbol ORDER BY symbol")
    assert counts.to_dicts() == [{"symbol": "AAA", "n": 2}, {"symbol": "BBB", "n": 1}]


def test_rewriting_a_year_replaces_it_rather_than_appending(tmp_path):
    store = ParquetStore(tmp_path)
    store.write_year(PRICES, 2025, _bars("AAA", [date(2025, 1, 1), date(2025, 1, 2)]))
    # A vendor restatement re-pulls the year with corrected values.
    store.write_year(PRICES, 2025, _bars("AAA", [date(2025, 1, 1)]))

    read = store.scan(PRICES).collect()
    assert read.height == 1  # replaced, not appended


def test_a_missing_dataset_raises(tmp_path):
    store = ParquetStore(tmp_path)
    with pytest.raises(FileNotFoundError):
        store.scan(PRICES).collect()
