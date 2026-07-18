"""
backup.py — the weekly database backup and its restore path (plan §P1 step 9, Appendix C).

The serving Postgres holds the user-state that the pipeline cannot re-derive: the watchlist, and
(from later phases) the journal, review state, and paper trades. The full-market history is a
re-pullable Parquet cache, but this is not — so once a week Job B takes a pg_dump and pushes it to
R2, and a test proves the dump can actually be restored (a backup you have never restored is a
hope, not a backup).

The dump is PostgreSQL's custom format (-Fc): compressed, and restorable with pg_restore's
selective/parallel options. Both wrappers shell out to the postgres client tools, whose major
version must be >= the server (Supabase is now 17 — pg_dump refuses to dump a newer server than
itself), so the workflow installs postgresql-client-17.
"""

from __future__ import annotations

import subprocess
from datetime import date
from pathlib import Path


def dump(database_url: str, out_path: str | Path) -> Path:
    """
    Write a custom-format pg_dump of `database_url` to `out_path`. Returns the path.

    --no-owner and --no-privileges keep the dump portable: it restores cleanly into a fresh database
    (the restore test's throwaway Postgres, or a rebuilt Supabase) without depending on the original
    role names. Raises CalledProcessError if pg_dump fails, so a broken backup is loud, not silent.
    """
    out = Path(out_path)
    subprocess.run(
        ["pg_dump", "--format=custom", "--no-owner", "--no-privileges", "--file", str(out), database_url],
        check=True,
    )
    return out


def restore(database_url: str, dump_path: str | Path) -> None:
    """
    Restore a custom-format dump into `database_url`, replacing what is there.

    --clean --if-exists drops each object before recreating it, so a restore into a populated
    database is idempotent rather than a pile of "already exists" errors. --no-owner/--no-privileges
    match the dump. Raises CalledProcessError on failure.
    """
    subprocess.run(
        [
            "pg_restore",
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-privileges",
            "--dbname",
            database_url,
            str(dump_path),
        ],
        check=True,
    )


def run_weekly_backup(settings, run_date: date, work_dir: str | Path) -> str:
    """
    Dump the serving database and upload it to R2 under a datestamped key. Returns the object key.

    Uses the session-pooler URL (a real session connection), because pg_dump needs a session, not
    the transaction pooler the app runs on. The dump lands under `backups/` in the history bucket —
    the same R2 account, a separate prefix from the Parquet lake.
    """
    from storage import R2Store  # local import: only the backup path needs boto3

    database_url = settings.require("session_pooler_url")
    local = Path(work_dir) / f"msm-{run_date.isoformat()}.dump"
    dump(database_url, local)

    key = f"backups/msm-{run_date.isoformat()}.dump"
    R2Store.from_settings(settings).put_file(local, key)
    return key
