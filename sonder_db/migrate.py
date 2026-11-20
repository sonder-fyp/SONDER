"""Apply the ordered SQL migrations in db/migrations/manifest.json exactly once each.

    python -m sonder_db.migrate status
    python -m sonder_db.migrate up
    python -m sonder_db.migrate adopt 0001_iteration1_schema 0002_auth_rbac

Applied files are recorded in ``sonder_meta.schema_migration`` with the SHA-256 of
their content (line endings normalised to LF). ``up`` refuses to continue if a
recorded file has changed since it was applied. ``adopt`` records migrations that
were applied by hand before this runner existed, without running them.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import psycopg

from . import database_url, describe_error

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "db" / "migrations" / "manifest.json"
LOCK_KEY = 727001  # pg_advisory_lock key shared by every runner

BOOTSTRAP = """
CREATE SCHEMA IF NOT EXISTS sonder_meta;
CREATE TABLE IF NOT EXISTS sonder_meta.schema_migration (
  name text PRIMARY KEY,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now(),
  adopted boolean NOT NULL DEFAULT false
);
"""


class MigrationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Migration:
    name: str
    path: Path
    wraps_own_transaction: bool

    @property
    def sql(self) -> str:
        return self.path.read_bytes().decode("utf-8-sig").replace("\r\n", "\n")

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.sql.encode("utf-8")).hexdigest()


def load_manifest(manifest: Path = MANIFEST, root: Path = ROOT) -> list[Migration]:
    entries = json.loads(manifest.read_text(encoding="utf-8"))["migrations"]
    found = [Migration(e["name"], root / e["path"], bool(e.get("wraps_own_transaction", False)))
             for e in entries]
    names = [m.name for m in found]
    if len(set(names)) != len(names) or names != sorted(names):
        raise MigrationError("manifest names must be unique and in ascending order")
    for m in found:
        if not m.path.is_file():
            raise MigrationError(f"{m.name}: file {m.path} does not exist")
    return found


def _recorded(conn: psycopg.Connection) -> dict[str, str]:
    return dict(conn.execute("SELECT name, sha256 FROM sonder_meta.schema_migration").fetchall())


def _check(migrations: list[Migration], recorded: dict[str, str]) -> list[Migration]:
    """Return the migrations still to apply; refuse changed, unknown or out-of-order records."""

    known = {m.name for m in migrations}
    unknown = sorted(set(recorded) - known)
    if unknown:
        raise MigrationError(f"database records migrations missing from the manifest: {unknown}")
    pending: list[Migration] = []
    for m in migrations:
        if m.name in recorded:
            if pending:
                raise MigrationError(f"{m.name} is applied but earlier {pending[0].name} is not")
            if recorded[m.name] != m.sha256:
                raise MigrationError(f"{m.name} changed after it was applied; write a new migration instead")
        else:
            pending.append(m)
    return pending


def up(url: str, migrations: list[Migration] | None = None) -> list[str]:
    """Apply every pending migration in order and return their names."""

    migrations = load_manifest() if migrations is None else migrations
    applied: list[str] = []
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute(BOOTSTRAP)
        conn.execute("SELECT pg_advisory_lock(%s)", (LOCK_KEY,))
        try:
            for m in _check(migrations, _recorded(conn)):
                record = ("INSERT INTO sonder_meta.schema_migration (name, sha256) VALUES (%s, %s)",
                          (m.name, m.sha256))
                if m.wraps_own_transaction:
                    conn.execute(m.sql)  # the file has its own BEGIN/COMMIT and is re-runnable
                    conn.execute(*record)
                else:
                    with conn.transaction():
                        conn.execute(m.sql)
                        conn.execute(*record)
                applied.append(m.name)
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", (LOCK_KEY,))
    return applied


def adopt(url: str, names: list[str], migrations: list[Migration] | None = None) -> list[str]:
    """Record already-applied migrations without running them (hand-built databases)."""

    migrations = load_manifest() if migrations is None else migrations
    by_name = {m.name: m for m in migrations}
    missing = [n for n in names if n not in by_name]
    if missing:
        raise MigrationError(f"not in the manifest: {missing}")
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute(BOOTSTRAP)
        if conn.execute("SELECT to_regclass('sonder.app_user')").fetchone()[0] is None:
            raise MigrationError("adopt needs an existing sonder schema; use 'up' on an empty database")
        with conn.transaction():
            for name in names:
                conn.execute(
                    "INSERT INTO sonder_meta.schema_migration (name, sha256, adopted) VALUES (%s, %s, true) "
                    "ON CONFLICT (name) DO NOTHING", (name, by_name[name].sha256))
            _check(migrations, _recorded(conn))
    return names


def status(url: str, migrations: list[Migration] | None = None) -> list[tuple[str, str]]:
    migrations = load_manifest() if migrations is None else migrations
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute(BOOTSTRAP)
        recorded = _recorded(conn)
    rows = []
    for m in migrations:
        if m.name not in recorded:
            rows.append((m.name, "pending"))
        elif recorded[m.name] != m.sha256:
            rows.append((m.name, "CHANGED"))
        else:
            rows.append((m.name, "applied"))
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["up", "status", "adopt"])
    parser.add_argument("names", nargs="*", help="migration names (adopt only)")
    parser.add_argument("--database-url", default=None, help="defaults to SONDER_DATABASE_URL")
    args = parser.parse_args(argv)
    try:
        url = database_url(args.database_url)
        if args.command == "up":
            applied = up(url)
            print("applied: " + (", ".join(applied) if applied else "nothing (up to date)"))
        elif args.command == "adopt":
            if not args.names:
                parser.error("adopt needs at least one migration name")
            print("adopted: " + ", ".join(adopt(url, args.names)))
        else:
            for name, state in status(url):
                print(f"{state:8} {name}")
    except (MigrationError, RuntimeError, psycopg.Error) as exc:
        print(f"MIGRATION FAILED: {describe_error(exc)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
