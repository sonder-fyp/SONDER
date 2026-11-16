import json
import tempfile
import unittest
from pathlib import Path

from pgtest import DatabaseTestCase, HAVE_PSYCOPG

if HAVE_PSYCOPG:
    import psycopg
    from sonder_db.migrate import MigrationError, adopt, load_manifest, status, up


def temporary_migration(root, name, sql):
    path = root / f"{name}.sql"
    path.write_text(sql, encoding="utf-8")
    manifest = root / "manifest.json"
    manifest.write_text(json.dumps({"migrations": [{"name": name, "path": path.name}]}), encoding="utf-8")
    return path, load_manifest(manifest, root)


@unittest.skipUnless(HAVE_PSYCOPG, "psycopg is not installed")
class ManifestTests(unittest.TestCase):
    def test_manifest_paths_exist_and_order(self):
        names = [migration.name for migration in load_manifest()]
        self.assertEqual(names, sorted(names))


class MigrateTests(DatabaseTestCase):
    def test_up_applies_all_then_nothing(self):
        expected = ["0001_iteration1_schema", "0002_auth_rbac"]
        self.assertEqual(up(self.url), expected)
        self.assertEqual(up(self.url), [])
        self.assertEqual(status(self.url), [(name, "applied") for name in expected])
        with psycopg.connect(self.url) as conn:
            self.assertTrue(conn.execute("SELECT to_regclass('sonder.diagnostic_session')").fetchone()[0])
            self.assertTrue(conn.execute("SELECT to_regclass('sonder.auth_role_request')").fetchone()[0])



class AdoptMigrationTests(DatabaseTestCase):
    def test_adopt_records_without_running(self):
        up(self.url)
        with psycopg.connect(self.url) as conn:
            conn.execute("DELETE FROM sonder_meta.schema_migration")
        names = ["0001_iteration1_schema", "0002_auth_rbac"]
        self.assertEqual(adopt(self.url, names), names)
        self.assertEqual(up(self.url), [])


class ChangedMigrationTests(DatabaseTestCase):
    def test_changed_applied_file_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path, migrations = temporary_migration(root, "0001_x", "CREATE TABLE IF NOT EXISTS public.mig_probe (id int);")
            self.assertEqual(up(self.url, migrations), ["0001_x"])
            path.write_text(path.read_text(encoding="utf-8") + "\n-- changed\n", encoding="utf-8")
            with self.assertRaisesRegex(MigrationError, "changed after it was applied"):
                up(self.url, migrations)


class FailedMigrationTests(DatabaseTestCase):
    def test_failed_migration_rolls_back_and_is_not_recorded(self):
        with tempfile.TemporaryDirectory() as directory:
            _, migrations = temporary_migration(Path(directory), "0001_bad", "CREATE TABLE public.half (id int); SELECT 1/0;")
            with self.assertRaises(psycopg.Error):
                up(self.url, migrations)
            with psycopg.connect(self.url) as conn:
                self.assertIsNone(conn.execute("SELECT to_regclass('public.half')").fetchone()[0])
            self.assertEqual(status(self.url, migrations), [("0001_bad", "pending")])


class EmptyDatabaseTests(DatabaseTestCase):
    def test_adopt_refuses_empty_database(self):
        with self.assertRaises(MigrationError):
            adopt(self.url, ["0001_iteration1_schema", "0002_auth_rbac"])
