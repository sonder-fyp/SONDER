"""A student's open assignments with their own latest attempt (I2-A16, migration 0011) on real PostgreSQL."""

from __future__ import annotations

import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.pgstore import PostgresStore

FIELDS = {"assignment_id", "class_id", "class_name", "title", "unit_code", "unit_name", "attempt_rule", "created_at",
          "latest_session_id", "latest_state", "answered", "question_budget", "attempts", "assignment_status"}


class StudentDashboardTests(ProductDatabaseTestCase):
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
        self.class_id, self.code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Mine')", (self.teacher,))[0]
        self.student = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (self.student, self.code))

    def assign(self, title, rule="single", class_id=None):
        return self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', %s, %s)::text",
                         (self.teacher, class_id or self.class_id, self.release_version, title, rule))[0][0]

    def start(self, assignment, student=None):
        return self.store.create(student or self.student,
                                 StartRequest(unit_id="U1", create_request_id=str(uuid4()), assignment_id=assignment))

    def answer(self, value, options, student=None):
        for option in options:
            q = value["question"]
            value, _ = self.store.submit(value["session_id"], student or self.student, AnswerRequest(
                step_index=q["step_index"], item_id=q["item_id"], option_id=option))
        return value

    def rows(self, student=None):
        return {r[0]: r[1:] for r in self.call(
            "SELECT title, latest_state, answered, question_budget, attempts, latest_session_id::text "
            "FROM sonder.student_dashboard(%s)", (student or self.student,))}

    def test_states_follow_the_students_own_latest_attempt(self):
        fresh, going, done = self.assign("Fresh"), self.assign("Going"), self.assign("Done", "repeat")
        going_value = self.answer(self.start(going), "DB")
        done_value = self.answer(self.start(done), "DBBA")
        rows = self.rows()
        self.assertEqual(rows["Fresh"], (None, 0, None, 0, None))
        self.assertEqual(rows["Going"], ("in_progress", 2, 8, 1, going_value["session_id"]))
        self.assertEqual(rows["Done"], ("submitted", 4, 8, 1, done_value["session_id"]))
        second = self.start(done)
        self.assertEqual(self.rows()["Done"], ("in_progress", 0, 8, 2, second["session_id"]))

    def test_only_open_assignments_of_active_classes_and_only_the_students_attempts(self):
        shown, closed = self.assign("Shown"), self.assign("Closed")
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (self.teacher, closed))
        classmate = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (classmate, self.code))
        self.answer(self.start(shown, classmate), "D", classmate)
        self.assertEqual(self.rows(), {"Shown": (None, 0, None, 0, None)})  # the classmate's attempt is not mine
        self.assertEqual(self.rows(classmate)["Shown"][0], "in_progress")
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (self.teacher, self.class_id))
        self.assertEqual(self.rows(), {})

    def test_closed_assignment_stays_while_attempt_in_progress(self):
        going, never = self.assign("Going"), self.assign("Never")
        value = self.answer(self.start(going), "DB")
        for a in (going, never):
            self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (self.teacher, a))
        rows = self.call("SELECT title, latest_state, assignment_status FROM sonder.student_dashboard(%s)", (self.student,))
        self.assertEqual(rows, [("Going", "in_progress", "closed")])
        self.answer(value, "BA")
        self.assertEqual(self.rows(), {})

    def test_rows_carry_no_result_fields(self):
        self.assign("Any")
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT * FROM sonder.student_dashboard(%s)", (self.student,))
            self.assertEqual({c.name for c in cur.description}, FIELDS)


if __name__ == "__main__":
    unittest.main()
