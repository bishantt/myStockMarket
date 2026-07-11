"""
Tests for storage.py — the R2 (S3-compatible) sync of the Parquet history store (plan Appendix A).

No live R2 is touched: a fake S3 client records uploads and serves listings/downloads from an
in-memory map, so the tests prove the key layout mirrors the local tree and that a sync round-trips.
The real client is a boto3 S3 client pointed at the R2 endpoint, built in from_settings.
"""

from pathlib import Path

from storage import R2Store


class FakeS3:
    """A minimal in-memory stand-in for the boto3 S3 client surface storage.py uses."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def upload_file(self, Filename: str, Bucket: str, Key: str) -> None:  # noqa: N803 (boto3 casing)
        self.objects[Key] = Path(Filename).read_bytes()

    def download_file(self, Bucket: str, Key: str, Filename: str) -> None:  # noqa: N803
        target = Path(Filename)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(self.objects[Key])

    def list_objects_v2(self, Bucket: str, Prefix: str = "", **_kw):  # noqa: N803
        contents = [{"Key": k} for k in sorted(self.objects) if k.startswith(Prefix)]
        return {"Contents": contents, "IsTruncated": False}


def _write(root: Path, rel: str, data: bytes) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def test_sync_up_mirrors_the_local_tree_as_object_keys(tmp_path):
    root = tmp_path / "store"
    _write(root, "prices_daily/year=2026/part.parquet", b"prices-2026")
    _write(root, "prices_daily/year=2025/part.parquet", b"prices-2025")
    _write(root, "indicators_daily/year=2026/part.parquet", b"ind-2026")

    fake = FakeS3()
    keys = R2Store(fake, "msm-history").sync_up(root)

    assert set(keys) == {
        "prices_daily/year=2026/part.parquet",
        "prices_daily/year=2025/part.parquet",
        "indicators_daily/year=2026/part.parquet",
    }
    # The bytes actually landed under the mirrored keys.
    assert fake.objects["prices_daily/year=2026/part.parquet"] == b"prices-2026"


def test_sync_up_then_down_round_trips_the_bytes(tmp_path):
    root = tmp_path / "store"
    _write(root, "prices_daily/year=2026/part.parquet", b"payload")
    fake = FakeS3()
    store = R2Store(fake, "msm-history")
    store.sync_up(root)

    restored = tmp_path / "restored"
    keys = store.sync_down(restored)

    assert keys == ["prices_daily/year=2026/part.parquet"]
    assert (restored / "prices_daily/year=2026/part.parquet").read_bytes() == b"payload"


def test_sync_down_honours_a_dataset_prefix(tmp_path):
    root = tmp_path / "store"
    _write(root, "prices_daily/year=2026/part.parquet", b"a")
    _write(root, "indicators_daily/year=2026/part.parquet", b"b")
    fake = FakeS3()
    store = R2Store(fake, "msm-history")
    store.sync_up(root)

    restored = tmp_path / "restored"
    keys = store.sync_down(restored, prefix="prices_daily/")

    assert keys == ["prices_daily/year=2026/part.parquet"]
    assert not (restored / "indicators_daily").exists()


def test_put_file_uploads_a_single_object_to_an_exact_key(tmp_path):
    src = tmp_path / "msm-2026-07-10.dump"
    src.write_bytes(b"dump-bytes")
    fake = FakeS3()
    key = R2Store(fake, "msm-history").put_file(src, "backups/msm-2026-07-10.dump")
    assert key == "backups/msm-2026-07-10.dump"
    assert fake.objects["backups/msm-2026-07-10.dump"] == b"dump-bytes"


def test_sync_up_ignores_non_parquet_files(tmp_path):
    root = tmp_path / "store"
    _write(root, "prices_daily/year=2026/part.parquet", b"keep")
    _write(root, "prices_daily/year=2026/.DS_Store", b"junk")
    fake = FakeS3()
    keys = R2Store(fake, "msm-history").sync_up(root)
    assert keys == ["prices_daily/year=2026/part.parquet"]
