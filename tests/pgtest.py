"""Fresh throwaway PostgreSQL databases for persistence tests; not a test module.

Tests using this need SONDER_TEST_DATABASE_URL (the Docker database from docker-compose.yml).
Without it they are skipped, unless SONDER_REQUIRE_DB_TESTS=1, which turns the skip into a
failure so CI cannot pass by skipping.
"""

from __future__ import annotations

import os
import unittest
from uuid import uuid4

try:
    import psycopg
    from psycopg.conninfo import make_conninfo
    HAVE_PSYCOPG = True
except ModuleNotFoundError:  # the engine CI job does not install the db extra
    HAVE_PSYCOPG = False

ADMIN_URL = os.environ.get("SONDER_TEST_DATABASE_URL", "")
REQUIRED = os.environ.get("SONDER_REQUIRE_DB_TESTS") == "1"


def database_available() -> str | None:
    """None if tests can run, otherwise the reason they cannot."""

    if not HAVE_PSYCOPG:
        return "psycopg is not installed (pip install -e '.[db]')"
    if not ADMIN_URL:
        return "SONDER_TEST_DATABASE_URL is not set"
    return None


class DatabaseTestCase(unittest.TestCase):
    """Each test class gets its own empty database, dropped afterwards."""

    @classmethod
    def setUpClass(cls):
        reason = database_available()
        if reason:
            if REQUIRED:
                raise RuntimeError(f"database tests are required but cannot run: {reason}")
            raise unittest.SkipTest(reason)
        cls.db_name = f"t_{uuid4().hex[:16]}"
        with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
            conn.execute(f'CREATE DATABASE "{cls.db_name}"')
        cls.url = make_conninfo(ADMIN_URL, dbname=cls.db_name)

    @classmethod
    def tearDownClass(cls):
        if getattr(cls, "db_name", None):
            with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
                conn.execute(f'DROP DATABASE IF EXISTS "{cls.db_name}" WITH (FORCE)')
