"""Teacher dashboard rows: one per (student, assignment) (I2-A11, migration 0010) on real PostgreSQL."""

from __future__ import annotations

import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.pgstore import PostgresStore


class ActivityTests(ProductDatabaseTestCase):
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
        self.class_id, self.code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Activity')",
                                             (self.teacher,))[0]

    def student(self, name=None):
        sid = self.user("student")
        if name:
            self.call("UPDATE sonder.app_user SET display_name = %s WHERE id = %s", (name, sid))
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (sid, self.code))
        return sid

    def assign(self, title, rule="repeat"):
        return self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', %s, %s)::text",
                         (self.teacher, self.class_id, self.release_version, title, rule))[0][0]

    def start(self, student, assignment):
        return self.store.create(student, StartRequest(unit_id="U1", create_request_id=str(uuid4()), assignment_id=assignment))

    def answer(self, student, value, options):
        for option in options:
            q = value["question"]
            value, _ = self.store.submit(value["session_id"], student, AnswerRequest(
                step_index=q["step_index"], item_id=q["item_id"], option_id=option))
        return value

    def rows(self, assignment=None, teacher=None):
        return self.call("SELECT student_name, assignment_title, state, answered, attempts, review_status, "
                         "session_id::text, last_activity IS NOT NULL "
                         "FROM sonder.class_activity(%s, %s, %s) ORDER BY student_name, assignment_title",
                         (teacher or self.teacher, self.class_id, assignment))

    def test_each_student_and_open_assignment_has_one_row_with_its_state(self):
        ana, ben, cai = self.student("Ana"), self.student("Ben"), self.student("Cai")
        rounding, conversion = self.assign("Rounding"), self.assign("Conversion")
        self.answer(ana, self.start(ana, rounding), "D")               # in progress, 1 answered
        done = self.answer(ben, self.start(ben, rounding), "DBBA")     # completed
        rows = self.rows()
        self.assertEqual(len(rows), 6)  # 3 students x 2 open assignments
        by = {(r[0], r[1]): r for r in rows}
        self.assertEqual(by[("Ana", "Rounding")][2:6], ("in_progress", 1, 1, None))
        self.assertEqual(by[("Ben", "Rounding")][2:6], ("completed", 4, 1, None))
        self.assertEqual(by[("Ben", "Rounding")][6], done["session_id"])
        self.assertEqual(by[("Cai", "Rounding")][2:8], ("not_started", 0, 0, None, None, False))
        self.assertTrue(all(r[2] == "not_started" for r in rows if r[1] == "Conversion"))
        self.assertTrue(by[("Ana", "Rounding")][7] and by[("Ben", "Rounding")][7])

    def test_the_latest_attempt_and_its_latest_review_count(self):
        ana = self.student("Ana")
        rounding = self.assign("Rounding", "repeat")
        first = self.answer(ana, self.start(ana, rounding), "DBBA")
        self.call("SELECT sonder.add_session_review(%s, %s, 0, 'follow_up_required', '', %s)",
                  (self.teacher, first["session_id"], str(uuid4())))
        self.assertEqual(self.rows()[0][2:6], ("completed", 4, 1, "follow_up_required"))
        self.call("SELECT sonder.add_session_review(%s, %s, 1, 'reviewed', '', %s)",
                  (self.teacher, first["session_id"], str(uuid4())))
        self.assertEqual(self.rows()[0][5], "reviewed")
        second = self.start(ana, rounding)  # a new attempt: the row follows it, unreviewed
        self.assertEqual(self.rows()[0][2:7], ("in_progress", 0, 2, None, second["session_id"]))

    def test_filters_closed_assignments_left_students_and_plain_starts(self):
        ana, ben = self.student("Ana"), self.student("Ben")
        open_one, closed_one = self.assign("Open"), self.assign("Closed")
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (self.teacher, closed_one))
        self.call("SELECT sonder.remove_student(%s, %s, %s)", (self.teacher, self.class_id, ben))
        self.store.create(ana, StartRequest(unit_id="U1", create_request_id=str(uuid4())))  # no assignment
        self.assertEqual([(r[0], r[1], r[2]) for r in self.rows()], [("Ana", "Open", "not_started")])
        self.assertEqual([(r[0], r[1]) for r in self.rows(closed_one)], [("Ana", "Closed")])  # asked for explicitly

    def test_only_the_class_teacher_sees_rows(self):
        self.student("Ana")
        self.assign("Rounding")
        self.assertEqual(len(self.rows()), 1)
        for outsider in (self.user("teacher"), self.user("student")):
            with self.subTest(outsider=outsider):
                self.assertEqual(self.rows(teacher=outsider), [])


if __name__ == "__main__":
    unittest.main()
