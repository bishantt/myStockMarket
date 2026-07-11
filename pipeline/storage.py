"""
storage.py — sync the Parquet history store to and from Cloudflare R2 (plan Appendix A, P1 step 5).

The full-universe Parquet tree (parquet_store.py) is written on the Actions runner, whose disk is
thrown away when the job ends. R2 is where it persists between nightly runs: Job A pulls the store
down, rewrites the current year, and pushes it back up. R2 is S3-compatible, so this is a thin
wrapper over a boto3 S3 client pointed at the R2 endpoint.

The bucket is a re-pullable cache, not a source of truth (Appendix A) — losing it costs one Alpaca
re-pull. So the sync is deliberately simple: object keys mirror the local relative paths exactly
(<dataset>/year=YYYY/part.parquet), and an upload just overwrites. Only `.parquet` files move; a
stray .DS_Store or a lock file never becomes an object.
"""

from __future__ import annotations

from pathlib import Path


class R2Store:
    """
    A mirror between a local Parquet root and an R2 bucket.

    Construct with a boto3 S3 client and the bucket name. `from_settings` builds the real client
    against the R2 endpoint; tests pass a fake client with the same small method surface
    (upload_file / download_file / list_objects_v2).
    """

    def __init__(self, client, bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    @classmethod
    def from_settings(cls, settings) -> "R2Store":
        """Build an R2Store from pipeline settings (Appendix D). Imports boto3 lazily so the rest
        of the pipeline — and the tests, which inject a fake client — never require it."""
        import boto3

        account_id = settings.require("r2_account_id")
        client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.require("r2_access_key_id"),
            aws_secret_access_key=settings.require("r2_secret"),
            # R2 ignores the AWS region but the SDK insists on one; "auto" is Cloudflare's guidance.
            region_name="auto",
        )
        return cls(client, settings.r2_bucket)

    def sync_up(self, local_root: str | Path) -> list[str]:
        """
        Upload every .parquet file under `local_root`, keyed by its path relative to the root.

        Returns the object keys written, sorted, so a caller can log exactly what moved. An upload
        overwrites, which is what makes the nightly "rewrite the current year" idempotent.
        """
        root = Path(local_root)
        keys: list[str] = []
        for path in sorted(root.rglob("*.parquet")):
            key = path.relative_to(root).as_posix()
            self._client.upload_file(str(path), self._bucket, key)
            keys.append(key)
        return keys

    def sync_down(self, local_root: str | Path, prefix: str = "") -> list[str]:
        """
        Download every object (optionally under `prefix`) into `local_root`, mirroring the key as
        the relative path. Returns the keys restored, sorted. Used to hydrate the runner's disk
        before a re-pull, and by the restore test.
        """
        root = Path(local_root)
        keys: list[str] = []
        for key in self._list_keys(prefix):
            self._client.download_file(self._bucket, key, str(root / key))
            keys.append(key)
        return keys

    def _list_keys(self, prefix: str) -> list[str]:
        """List all object keys under a prefix, following pagination to the end."""
        keys: list[str] = []
        token: str | None = None
        while True:
            kwargs = {"Bucket": self._bucket, "Prefix": prefix}
            if token:
                kwargs["ContinuationToken"] = token
            response = self._client.list_objects_v2(**kwargs)
            keys.extend(obj["Key"] for obj in response.get("Contents", []))
            if not response.get("IsTruncated"):
                break
            token = response.get("NextContinuationToken")
        return sorted(keys)
