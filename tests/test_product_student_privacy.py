"""What a student can and cannot reach (I2-A19): only their own, never results or teacher data.

Requirements acceptance checks A6, A8, A9 (docs/design/I2_TEACHER_STUDENT_REQUIREMENTS.md section 8) on real
PostgreSQL. The UI-route halves (forbidden words in every student reply) are in the route tests.
"""

from __future__ import annotations

import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.pgstore import PostgresStore
    from sonder_api.store import ServiceError

FORBIDDEN = ("MATH-", "posterior", "probability", "diagnos", "misconception", "is_correct", "review", "follow_up")


class StudentPrivacyTests(ProductDatabaseTestCase):
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
        class_id, code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Private')", (self.teacher,))[0]
        self.class_id = class_id
        self.me, self.classmate = self.user("student"), self.user("student")
        for s in (self.me, self.classmate):
            self.call("SELECT * FROM sonder.join_class(%s, %s)", (s, code))
        self.assignment = self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', 'Rounding', 'single')::text",
                                    (self.teacher, class_id, self.release_version))[0][0]

    def finish(self, student):
        value = self.store.create(student, StartRequest(unit_id="U1", create_request_id=str(uuid4()), assignment_id=self.assignment))
        for option in "DBBA":
            q = value["question"]
            value, _ = self.store.submit(value["session_id"], student, AnswerRequest(
                step_index=q["step_index"], item_id=q["item_id"], option_id=option))
        return value["session_id"]

    def student_views(self, student):
        return {name: self.call(f"SELECT * FROM sonder.{name}(%s)", (student,))
                for name in ("student_dashboard", "student_history", "student_assignments", "student_classes")}

    def test_student_views_never_contain_results_even_after_a_review(self):
        sid = self.finish(self.me)
        self.call("SELECT sonder.add_session_review(%s, %s, 0, 'follow_up_required', 'Needs MATH-1248 work', %s)",
                  (self.teacher, sid, str(uuid4())))
        text = repr(self.student_views(self.me))
        for word in FORBIDDEN:
            self.assertNotIn(word, text)
        dashboard = self.call("SELECT latest_state, attempts FROM sonder.student_dashboard(%s)", (self.me,))
        self.assertEqual(dashboard, [("submitted", 1)])  # updated after submission; a review adds nothing visible

    def test_a_student_sees_only_their_own_attempts(self):
        mine, theirs = self.finish(self.me), self.finish(self.classmate)
        history = [str(r[0]) for r in self.call("SELECT session_id FROM sonder.student_history(%s)", (self.me,))]
        self.assertEqual(history, [mine])
        self.assertEqual(self.call("SELECT latest_session_id::text FROM sonder.student_dashboard(%s)", (self.me,)), [(mine,)])
        with self.assertRaises(ServiceError) as caught:
            self.store.current(theirs, self.me)
        self.assertEqual(caught.exception.status, 404)

    def test_teacher_data_is_out_of_a_students_reach(self):
        sid = self.finish(self.me)
        self.call("SELECT sonder.add_session_review(%s, %s, 0, 'reviewed', '', %s)", (self.teacher, sid, str(uuid4())))
        self.assertEqual(self.call("SELECT * FROM sonder.class_activity(%s, %s, NULL)", (self.me, self.class_id)), [])
        self.assertEqual(self.call("SELECT * FROM sonder.session_reviews(%s, %s)", (self.me, sid)), [])
        self.assertEqual(self.call("SELECT * FROM sonder.class_roster(%s, %s)", (self.me, self.class_id)), [])
        self.assertEqual(self.call("SELECT * FROM sonder.teacher_classes(%s)", (self.me,)), [])
        with self.assertRaises(ServiceError):
            self.store.teacher_evidence(sid, self.me)

    def test_returning_resumes_and_a_second_attempt_is_refused(self):
        start = StartRequest(unit_id="U1", create_request_id=str(uuid4()), assignment_id=self.assignment)
        first = self.store.create(self.me, start)
        self.assertEqual(self.store.current(first["session_id"], self.me), first)  # Resume = the same pending question
        with self.assertRaises(ServiceError) as caught:
            self.store.create(self.me, StartRequest(unit_id="U1", create_request_id=str(uuid4()), assignment_id=self.assignment))
        self.assertEqual(caught.exception.code, "attempt_in_progress")
        self.assertEqual(self.call("SELECT attempts FROM sonder.student_dashboard(%s)", (self.me,)), [(1,)])


if __name__ == "__main__":
    unittest.main()
