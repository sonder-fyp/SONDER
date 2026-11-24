"""Content importer: source checks (no database) and the real import against PostgreSQL.

The database tests need SONDER_TEST_DATABASE_URL (docker compose up -d --wait) and are skipped without it.
Counts are read from the source files, never written into the tests, so they follow the dataset.
"""

import csv
import io
import shutil
import tempfile
import unittest
from pathlib import Path

from pgtest import DatabaseTestCase, HAVE_PSYCOPG

from sonder_db.content_import import ImportRefused, check_rows, describe, lf_sha256, read_source
from sonder_engine.pack import derive_twin_groups

ROOT = Path(__file__).resolve().parents[1] / "data" / "Maths_v2"


def bank_rows(root=ROOT):
    return list(csv.DictReader(io.StringIO((root / "bank" / "items.csv").read_text(encoding="utf-8-sig"), newline="")))


def topic_rows(root=ROOT):
    return list(csv.DictReader(io.StringIO((root / "topics.csv").read_text(encoding="utf-8-sig"), newline="")))


class SourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = read_source(ROOT)
        cls.rows = bank_rows()

    def test_counts_follow_the_files(self):
        items = {r["item_id"] for r in self.rows}
        self.assertEqual(len(self.source.items), len(items))
        self.assertEqual(sum(len(i.options) for i in self.source.items), len(self.rows))
        self.assertTrue(all(len(i.options) == 4 for i in self.source.items))
        self.assertEqual(len(self.source.misconceptions), len(topic_rows()))
        self.assertEqual(sum(len(o.links) for i in self.source.items for o in i.options),
                         sum(len([m for m in r["misconceptions"].split("|") if m]) for r in self.rows))

    def test_every_item_has_one_correct_option_without_links(self):
        for item in self.source.items:
            self.assertEqual(sum(o.correct for o in item.options), 1, item.item_id)
            self.assertTrue(all(not o.links for o in item.options if o.correct), item.item_id)

    def test_twin_groups_are_the_engines(self):
        self.assertEqual(self.source.twin_groups, derive_twin_groups(self.rows))

    def test_units_come_from_the_engine_loader(self):
        ids = {i.item_id for i in self.source.items}
        placed = {i for u in self.source.units for i in u.items}
        self.assertTrue(placed <= ids)
        self.assertEqual(set(self.source.unplaced) & placed, set())
        for unit in self.source.units:
            self.assertEqual(len(set(unit.items)), len(unit.items))
            self.assertEqual(len(set(unit.hypotheses)), len(unit.hypotheses))

    def test_release_identity_is_line_ending_independent(self):
        raw = (ROOT / "bank" / "items.csv").read_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            lf = Path(tmp) / "lf.csv"
            lf.write_bytes(raw.replace(b"\r\n", b"\n"))
            crlf = Path(tmp) / "crlf.csv"
            crlf.write_bytes(raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
            self.assertEqual(lf_sha256(lf), lf_sha256(crlf))
            self.assertEqual(lf_sha256(lf), self.source.pack_sha256)

    def test_plan_mentions_the_hash_and_the_candidate_status(self):
        text = describe(self.source)
        self.assertIn(self.source.pack_sha256, text)
        self.assertIn("never frozen", text)


class CheckRowsTests(unittest.TestCase):
    """The importer refuses what the database would refuse, with a message that names the item."""

    def setUp(self):
        self.bank = [dict(r) for r in bank_rows()]
        self.topics = topic_rows()

    def item(self, item_id):
        return [r for r in self.bank if r["item_id"] == item_id]

    def test_real_source_has_no_problems(self):
        self.assertEqual(check_rows(self.bank, self.topics), [])

    def test_two_correct_options(self):
        rows = self.item(self.bank[0]["item_id"])
        wrong = next(r for r in rows if r["is_correct"] != "True")
        wrong["is_correct"] = "True"
        self.assertTrue(any("exactly one correct" in p for p in check_rows(self.bank, self.topics)))

    def test_link_on_the_correct_option(self):
        rows = self.item(self.bank[0]["item_id"])
        next(r for r in rows if r["is_correct"] == "True")["misconceptions"] = self.topics[0]["MisconceptionId"]
        self.assertTrue(any("correct option has links" in p for p in check_rows(self.bank, self.topics)))

    def test_unknown_misconception(self):
        rows = self.item(self.bank[0]["item_id"])
        next(r for r in rows if r["is_correct"] != "True")["misconceptions"] = "MATH-999999"
        self.assertTrue(any("unknown misconception MATH-999999" in p for p in check_rows(self.bank, self.topics)))

    def test_unknown_target(self):
        for r in self.item(self.bank[0]["item_id"]):
            r["target"] = "MATH-999999"
        self.assertTrue(any("target MATH-999999" in p for p in check_rows(self.bank, self.topics)))

    def test_unknown_topic_prefix(self):
        for r in self.item(self.bank[0]["item_id"]):
            r["item_id"] = "T9-001"
        self.assertTrue(any("T9" in p for p in check_rows(self.bank, self.topics)))

    def test_missing_option(self):
        first = self.bank[0]["item_id"]
        self.bank = [r for r in self.bank if not (r["item_id"] == first and r["option_id"] == "D")]
        self.assertTrue(any("exactly A, B, C, D" in p for p in check_rows(self.bank, self.topics)))

    def test_duplicate_option_text(self):
        rows = self.item(self.bank[0]["item_id"])
        rows[1]["option_text"] = rows[0]["option_text"]
        self.assertTrue(any("same text" in p for p in check_rows(self.bank, self.topics)))

    def test_read_source_reports_every_problem(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "bank").mkdir()
            shutil.copy(ROOT / "topics.csv", root / "topics.csv")
            rows = self.bank
            next(r for r in rows if r["is_correct"] != "True")["misconceptions"] = "MATH-999999"
            with open(root / "bank" / "items.csv", "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\r\n")
                writer.writeheader()
                writer.writerows(rows)
            with self.assertRaises(ImportRefused) as ctx:
                read_source(root)
            self.assertIn("MATH-999999", str(ctx.exception))


if HAVE_PSYCOPG:
    import psycopg

    from sonder_db.content_import import import_content, verify_content
    from sonder_db.migrate import up


    class ImportDatabaseTests(DatabaseTestCase):
        @classmethod
        def setUpClass(cls):
            super().setUpClass()
            up(cls.url)
            cls.source = read_source(ROOT)
            with psycopg.connect(cls.url) as conn:
                cls.admin = "importer-admin@example.test"
                conn.execute("INSERT INTO sonder.app_user (email, display_name, role) VALUES (%s, 'Importer admin', 'admin')", (cls.admin,))
                conn.execute("INSERT INTO sonder.app_user (email, display_name, role) VALUES ('student@example.test', 'Student', 'student')")

        def count(self, sql, *params):
            with psycopg.connect(self.url) as conn:
                return conn.execute(sql, params).fetchone()[0]

        def test_import_writes_the_source_and_verifies(self):
            code = "import-main"
            outcome, _ = import_content(self.url, self.source, self.admin, version_code=code)
            self.assertEqual(outcome, "imported")
            self.assertEqual(verify_content(self.url, self.source, code), [])
            cv = "SELECT c.id FROM sonder.content_version c WHERE c.version_code = %s"
            self.assertEqual(self.count(f"SELECT count(*) FROM sonder.item i JOIN sonder.topic_revision t ON t.id = i.topic_revision_id WHERE t.content_version_id = ({cv})", code),
                             len(self.source.items))
            self.assertEqual(self.count(f"SELECT count(*) FROM sonder.diagnostic_unit WHERE content_version_id = ({cv})", code), len(self.source.units))
            self.assertEqual(self.count("SELECT status FROM sonder.content_version WHERE version_code = %s", code), "draft")
            self.assertEqual(self.count("SELECT pack_sha256 FROM sonder.content_version WHERE version_code = %s", code), self.source.pack_sha256)

        def test_no_review_is_recorded_and_items_stay_draft(self):
            code = "import-no-review"
            import_content(self.url, self.source, self.admin, version_code=code)
            self.assertEqual(self.count("SELECT count(*) FROM sonder.item_review"), 0)
            self.assertEqual(self.count(
                "SELECT count(*) FROM sonder.item i JOIN sonder.topic_revision t ON t.id = i.topic_revision_id "
                "JOIN sonder.content_version c ON c.id = t.content_version_id WHERE c.version_code = %s AND i.review_status <> 'draft'", code), 0)

        def test_repeat_import_changes_nothing(self):
            code = "import-repeat"
            import_content(self.url, self.source, self.admin, version_code=code)
            before = self.count("SELECT count(*) FROM sonder.item")
            outcome, _ = import_content(self.url, self.source, self.admin, version_code=code)
            self.assertEqual(outcome, "unchanged")
            self.assertEqual(self.count("SELECT count(*) FROM sonder.item"), before)

        def test_dry_run_keeps_nothing(self):
            code = "import-dry"
            outcome, _ = import_content(self.url, self.source, self.admin, version_code=code, dry_run=True)
            self.assertEqual(outcome, "dry-run ok")
            self.assertEqual(self.count("SELECT count(*) FROM sonder.content_version WHERE version_code = %s", code), 0)

        def test_a_changed_source_is_refused_under_the_same_version_code(self):
            code = "import-changed"
            import_content(self.url, self.source, self.admin, version_code=code)
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                shutil.copytree(ROOT, root / "Maths_v2", ignore=shutil.ignore_patterns("batches"))
                path = root / "Maths_v2" / "bank" / "items.csv"
                rows = bank_rows(root / "Maths_v2")
                for r in rows:  # change the stem of the first item in all four of its rows
                    if r["item_id"] == rows[0]["item_id"]:
                        r["stem"] += " (changed)"
                with open(path, "w", encoding="utf-8", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\r\n")
                    writer.writeheader()
                    writer.writerows(rows)
                changed = read_source(root / "Maths_v2")
            self.assertNotEqual(changed.pack_sha256, self.source.pack_sha256)
            with self.assertRaises(ImportRefused):
                import_content(self.url, changed, self.admin, version_code=code)
            self.assertEqual(verify_content(self.url, self.source, code), [])  # the stored version is untouched

        def test_verify_finds_a_difference(self):
            code = "import-tampered"
            import_content(self.url, self.source, self.admin, version_code=code)
            with psycopg.connect(self.url) as conn:
                conn.execute("UPDATE sonder.item SET stem = stem || ' (edited)' WHERE external_id = %s AND topic_revision_id IN "
                             "(SELECT t.id FROM sonder.topic_revision t JOIN sonder.content_version c ON c.id = t.content_version_id WHERE c.version_code = %s)",
                             (self.source.items[0].item_id, code))
            diffs = verify_content(self.url, self.source, code)
            self.assertTrue(any(self.source.items[0].item_id in d for d in diffs), diffs)

        def test_the_author_must_be_an_existing_admin_or_teacher(self):
            with self.assertRaises(ImportRefused):
                import_content(self.url, self.source, "nobody@example.test", version_code="import-no-author")
            with self.assertRaises(ImportRefused):
                import_content(self.url, self.source, "student@example.test", version_code="import-student")
            self.assertEqual(self.count("SELECT count(*) FROM sonder.content_version WHERE version_code IN ('import-no-author','import-student')"), 0)

        def test_a_second_version_reuses_the_catalogue(self):
            import_content(self.url, self.source, self.admin, version_code="import-v-a")
            import_content(self.url, self.source, self.admin, version_code="import-v-b")
            self.assertEqual(self.count("SELECT count(*) FROM sonder.misconception"), len(self.source.misconceptions))
            self.assertEqual(verify_content(self.url, self.source, "import-v-a"), [])
            self.assertEqual(verify_content(self.url, self.source, "import-v-b"), [])


if __name__ == "__main__":
    unittest.main()
