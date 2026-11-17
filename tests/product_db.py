"""Shared set-up for the class/assignment database tests (tests/test_product_*.py); not a test module.

Each test class gets a fresh database (pgtest.DatabaseTestCase) with every migration in
db/migrations/manifest.json applied. Helpers create accounts and the MATH subject directly,
the way the application and the development seed do.
"""

from __future__ import annotations

from contextlib import contextmanager
from uuid import uuid4

from pgtest import DatabaseTestCase, HAVE_PSYCOPG

if HAVE_PSYCOPG:
    import psycopg
    from sonder_db.migrate import up


class ProductDatabaseTestCase(DatabaseTestCase):
    with_math_subject = True

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        up(cls.url)
        if cls.with_math_subject:
            with psycopg.connect(cls.url) as conn:
                conn.execute("INSERT INTO sonder.subject (code, name) VALUES ('MATH', 'Mathematics')")

    def connect(self):
        return psycopg.connect(self.url, autocommit=True)

    def user(self, role: str, *, active: bool = True) -> str:
        """Insert an onboarded account with this role and return its id."""

        with self.connect() as conn:
            uid = conn.execute(
                "INSERT INTO sonder.app_user (email, role, display_name, auth_onboarding_complete) "
                "VALUES (%s, %s, %s, true) RETURNING id::text",
                (f"{role}-{uuid4().hex[:12]}@sonder.invalid", role, f"Test {role}")).fetchone()[0]
            if not active:
                conn.execute("UPDATE sonder.app_user SET status = 'deactivated' WHERE id = %s", (uid,))
        return uid

    def call(self, sql: str, params: tuple = ()):
        with self.connect() as conn:
            return conn.execute(sql, params).fetchall()

    @contextmanager
    def assertProductError(self, code: str):
        """The block must fail with SQLSTATE SN001 and exactly this machine code."""

        with self.assertRaises(psycopg.Error) as caught:
            yield
        self.assertEqual(caught.exception.sqlstate, "SN001", caught.exception)
        self.assertEqual(caught.exception.diag.message_primary, code)
