"""A student's own history of checks (I2-A18, migration 0012) on real PostgreSQL."""

from __future__ import annotations

import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.pgstore import PostgresStore

FIELDS = {"session_id", "unit_code", "unit_name", "class_name", "assignment_id", "assignment_title", "attempt_number",
          "started_at", "ended_at", "state", "answered", "question_budget"}


class HistoryTests(ProductDatabaseTestCase):
    with_dev_release = True

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.store = PostgresStore(cls.url, cls.release_label)

    @classmethod
    def tearDownClass(cls):
        cls.store.close()
        super().tearDownClass()

    def setUp(self):
        self.teacher = self.user("teacher")
        self.class_id, code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'History class')", (self.teacher,))[0]
        self.student, self.other = self.user("student"), self.user("student")
        for s in (self.student, self.other):
            self.call("SELECT * FROM sonder.join_class(%s, %s)", (s, code))
        self.assignment = self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', 'Rounding', 'repeat')::text",
                                    (self.teacher, self.class_id, self.release_version))[0][0]

    def run_check(self, student, assignment, options):
        value = self.store.create(student, StartRequest(unit_id="U1", create_request_id=str(uuid4()), assignment_id=assignment))
        for option in options:
            q = value["question"]
            value, _ = self.store.submit(value["session_id"], student, AnswerRequest(
                step_index=q["step_index"], item_id=q["item_id"], option_id=option))
        return value["session_id"]

    def history(self, student=None):
        return self.call("SELECT session_id::text, assignment_title, attempt_number, state, answered, question_budget, "
                         "ended_at IS NOT NULL FROM sonder.student_history(%s) ORDER BY started_at, session_id",
                         (student or self.student,))

    def test_attempts_are_numbered_per_assignment_and_plain_checks_have_none(self):
        first = self.run_check(self.student, self.assignment, "DBBA")
        second = self.run_check(self.student, self.assignment, "D")
        plain = self.run_check(self.student, None, "")
        self.assertEqual(self.history(), [
            (first, "Rounding", 1, "submitted", 4, 8, True),
            (second, "Rounding", 2, "in_progress", 1, 8, False),
            (plain, None, None, "in_progress", 0, 8, False),
        ])

    def test_only_the_students_own_checks_and_they_stay_after_leaving(self):
        mine = self.run_check(self.student, self.assignment, "DBBA")
        self.run_check(self.other, self.assignment, "D")
        self.assertEqual([r[0] for r in self.history()], [mine])
        self.call("SELECT sonder.remove_student(%s, %s, %s)", (self.teacher, self.class_id, self.student))
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (self.teacher, self.class_id))
        self.assertEqual([r[0] for r in self.history()], [mine])
        self.assertEqual(self.history(self.teacher), [])

    def test_rows_carry_no_result_fields(self):
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT * FROM sonder.student_history(%s)", (self.student,))
            self.assertEqual({c.name for c in cur.description}, FIELDS)


if __name__ == "__main__":
    unittest.main()
