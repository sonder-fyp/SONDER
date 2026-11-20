"""Starting a diagnostic from a class assignment through the real persistent service (I2-H12).

Drives sonder_api.pgstore.PostgresStore (and the HTTP app on top of it) against real PostgreSQL with
Ahmed's frozen U1 development release, so the database rules of 0006/0007 and the service's start
transaction are tested together.
"""

from __future__ import annotations

import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.pgstore import PostgresStore
    from sonder_api.store import ServiceError


class AssignmentStoreTestCase(ProductDatabaseTestCase):
    with_dev_release = True

    def setUp(self):
        self.store = PostgresStore(self.url, self.release_label)
        self.addCleanup(self.store.close)
        self.teacher = self.user("teacher")
        self.class_id, self.code = self.new_class("Grade 8")
        self.student = self.member(self.code)

    def new_class(self, name):
        return self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, %s)", (self.teacher, name))[0]

    def member(self, code):
        student = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (student, code))
        return student

    def assign(self, rule="single", class_id=None):
        return self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', 'Rounding', %s)::text",
                         (self.teacher, class_id or self.class_id, self.release_version, rule))[0][0]

    def begin(self, student, assignment, key=None, unit="U1"):
        return self.store.create(student, StartRequest(unit_id=unit, create_request_id=key or str(uuid4()),
                                                       assignment_id=assignment))

    def finish(self, student, snapshot, options="DBBA"):
        for option in options:
            question = snapshot["question"]
            snapshot, _ = self.store.submit(snapshot["session_id"], student, AnswerRequest(
                step_index=question["step_index"], item_id=question["item_id"], option_id=option))
        self.assertEqual(snapshot["status"], "complete")
        return snapshot

    def refused(self, status, code, operation):
        with self.assertRaises(ServiceError) as caught:
            operation()
        self.assertEqual((caught.exception.status, caught.exception.code), (status, code))

    def linked(self, session_id):
        return self.call("SELECT assignment_id::text FROM sonder.diagnostic_session WHERE id = %s", (session_id,))[0][0]


class StartTests(AssignmentStoreTestCase):
    def test_a_member_starts_an_assignment_and_the_session_records_it(self):
        assignment = self.assign()
        snapshot = self.begin(self.student, assignment)
        self.assertEqual((snapshot["status"], snapshot["unit"]["unit_id"], snapshot["answered_count"]), ("in_progress", "U1", 0))
        self.assertEqual(self.linked(snapshot["session_id"]), assignment)

    def test_an_identical_retry_returns_the_original_start(self):
        assignment = self.assign()
        key = str(uuid4())
        first = self.begin(self.student, assignment, key)
        self.assertEqual(self.begin(self.student, assignment, key), first)
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (self.teacher, assignment))
        self.assertEqual(self.begin(self.student, assignment, key), first)  # still answered after closing
        self.assertEqual(self.call("SELECT count(*) FROM sonder.diagnostic_session WHERE assignment_id = %s",
                                   (assignment,)), [(1,)])

    def test_reusing_a_request_key_for_another_assignment_or_none_is_a_conflict(self):
        assignment, other = self.assign(), self.assign("repeat")
        key = str(uuid4())
        self.begin(self.student, assignment, key)
        self.refused(409, "create_conflict", lambda: self.begin(self.student, other, key))
        self.refused(409, "create_conflict", lambda: self.begin(self.student, None, key))

    def test_the_unit_must_be_the_assignments_unit(self):
        self.refused(404, "assignment_not_found", lambda: self.begin(self.student, self.assign(), unit="U2"))

    def test_non_members_and_unknown_ids_are_not_found(self):
        assignment = self.assign()
        _, other_code = self.new_class("Other")
        for who in (self.user("student"), self.member(other_code)):
            with self.subTest(who=who):
                self.refused(404, "assignment_not_found", lambda: self.begin(who, assignment))
        self.refused(404, "assignment_not_found", lambda: self.begin(self.student, str(uuid4())))

    def test_a_closed_assignment_cannot_be_started(self):
        assignment = self.assign()
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (self.teacher, assignment))
        self.refused(409, "assignment_closed", lambda: self.begin(self.student, assignment))
        self.assertEqual(self.call("SELECT count(*) FROM sonder.diagnostic_session WHERE assignment_id = %s",
                                   (assignment,)), [(0,)])

    def test_a_student_in_two_classes_starts_through_the_assignment(self):
        _, other_code = self.new_class("Second class")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (self.student, other_code))
        # Without an assignment the start cannot tell which class (Ahmed's D9) ...
        self.refused(409, "enrolment_ambiguous", lambda: self.begin(self.student, None))
        # ... with one it can.
        snapshot = self.begin(self.student, self.assign())
        self.assertEqual(snapshot["status"], "in_progress")


class AttemptRuleTests(AssignmentStoreTestCase):
    def test_single_allows_one_attempt_which_is_resumed_not_replaced(self):
        assignment = self.assign("single")
        first = self.begin(self.student, assignment)
        self.refused(409, "attempt_in_progress", lambda: self.begin(self.student, assignment))
        self.finish(self.student, first)
        self.refused(409, "attempt_limit_reached", lambda: self.begin(self.student, assignment))

    def test_repeat_allows_a_new_attempt_once_the_last_is_finished(self):
        assignment = self.assign("repeat")
        first = self.begin(self.student, assignment)
        self.refused(409, "attempt_in_progress", lambda: self.begin(self.student, assignment))
        self.finish(self.student, first)
        second = self.begin(self.student, assignment)
        self.assertNotEqual(second["session_id"], first["session_id"])
        self.assertEqual(self.linked(second["session_id"]), assignment)

    def test_attempts_are_counted_per_student(self):
        assignment = self.assign("single")
        classmate = self.member(self.code)
        self.begin(self.student, assignment)
        self.assertEqual(self.begin(classmate, assignment)["status"], "in_progress")

    def test_a_start_without_the_assignment_does_not_use_it_up(self):
        assignment = self.assign("single")
        plain = self.begin(self.student, None)
        self.finish(self.student, plain)
        self.assertEqual(self.linked(plain["session_id"]), None)
        self.assertEqual(self.begin(self.student, assignment)["status"], "in_progress")


if __name__ == "__main__":
    unittest.main()
