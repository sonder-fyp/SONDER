import os
import subprocess
import sys
import unittest
from pathlib import Path

from sonder_db import describe_error, redact

try:
    import psycopg
    HAVE_PSYCOPG = True
except ModuleNotFoundError:
    HAVE_PSYCOPG = False

ROOT = Path(__file__).resolve().parent.parent
LEAKED = ('invalid connection option "\'postgresql://u:npg_FAKE123@ep-x-pooler.c-9.us-east-2.aws.neon.tech'
          '/neondb?sslmode"')


class RedactTests(unittest.TestCase):
    def test_leaked_shape_has_no_secret_or_url(self):
        out = redact(LEAKED)
        self.assertNotIn("npg_FAKE123", out)
        self.assertNotIn("postgresql://", out)

    def test_password_pair(self):
        self.assertNotIn("s3cret", redact("host=h password=s3cret dbname=d"))

    def test_quoted_password_pair(self):
        self.assertNotIn("a b c", redact("password='a b c'"))

    def test_bare_neon_secret(self):
        self.assertNotIn("npg_FAKE123", redact("token npg_FAKE123 rejected"))

    def test_plain_message_is_unchanged(self):
        self.assertEqual(redact("connection refused on port 5432"), "connection refused on port 5432")

    @unittest.skipUnless(HAVE_PSYCOPG, "psycopg is not installed")
    def test_describe_error_of_operational_error(self):
        out = describe_error(psycopg.OperationalError(LEAKED))
        self.assertTrue(out.startswith("OperationalError"))
        self.assertNotIn("npg_FAKE123", out)
        self.assertNotIn("postgresql://", out)


@unittest.skipUnless(HAVE_PSYCOPG, "psycopg is not installed")
class CliTests(unittest.TestCase):
    """A quoted, therefore invalid, URL is the real way the password leaked."""

    def run_cli(self, *args, **extra_env):
        env = {k: v for k, v in os.environ.items() if k != "SONDER_DATABASE_URL"}
        env["SONDER_DATABASE_URL"] = "'postgresql://u:npg_FAKE123@127.0.0.1:1/x'"
        env.update(extra_env)
        return subprocess.run([sys.executable, *args], cwd=ROOT, env=env, capture_output=True, text=True, timeout=60)

    def assert_failed_safely(self, result):
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("npg_FAKE123", result.stderr)
        self.assertNotIn("npg_FAKE123", result.stdout)

    def test_migrate_status(self):
        result = self.run_cli("-m", "sonder_db.migrate", "status")
        self.assert_failed_safely(result)
        self.assertIn("MIGRATION FAILED", result.stderr)

    def test_devseed(self):
        result = self.run_cli("-m", "sonder_api.devseed", SONDER_ALLOW_DEV_SEED="true")
        self.assert_failed_safely(result)
        self.assertIn("DEV SEED FAILED", result.stderr)

    def test_stored_evidence(self):
        result = self.run_cli("-m", "sonder_api.stored_evidence", "--all")
        self.assert_failed_safely(result)

    def test_api_startup(self):
        result = self.run_cli("-m", "sonder_api", "--store", "postgres", "--release", "x",
                              SONDER_ENGINE_TOKEN="t" * 40)
        self.assert_failed_safely(result)


if __name__ == "__main__":
    unittest.main()
