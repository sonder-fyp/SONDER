"""Who may start which assignment (I2-H12, migration 0007) on real PostgreSQL.

The membership, closed and release checks are called directly here. The attempt rules need real
sessions, so they are exercised through the persistent start in test_product_assignment_store.py.
"""

from __future__ import annotations

import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    from sonder_api.devseed import seed
    import psycopg


class AssignmentStartTestCase(ProductDatabaseTestCase):
    with_dev_release = True
    other_version = "Maths_v2-U1-dev-older"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with psycopg.connect(cls.url) as conn:  # a second frozen release, as after a content update
            seed(conn, version_code=cls.other_version, synthetic_students=0)

    def setUp(self):
        self.teacher = self.user("teacher")
        self.class_id, self.code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Start')",
                                             (self.teacher,))[0]
        self.student = self.user("student")
        self.enrolment = self.call("SELECT enrolment_id::text FROM sonder.join_class(%s, %s)", (self.student, self.code))[0][0]
        self.assignment = self.assign(self.release_version)

    def assign(self, version, rule="single"):
        return self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', 'Rounding', %s)::text",
                         (self.teacher, self.class_id, version, rule))[0][0]

    def version_id(self, code):
        return self.call("SELECT id::text FROM sonder.content_version WHERE version_code = %s", (code,))[0][0]

    def enrolment_of(self, student, assignment):
        return self.call("SELECT enrolment_id::text, unit_code FROM sonder.assignment_enrolment(%s, %s)",
                         (student, assignment))

    def check(self, assignment, version=None, key=None):
        self.call("SELECT sonder.check_assignment_start(%s, %s, %s, %s)",
                  (self.enrolment, assignment, self.version_id(version or self.release_version), key or str(uuid4())))


class MembershipTests(AssignmentStartTestCase):
    def test_a_member_resolves_to_their_enrolment_and_the_unit(self):
        self.assertEqual(self.enrolment_of(self.student, self.assignment), [(self.enrolment, "U1")])

    def test_everyone_else_gets_not_found(self):
        left = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (left, self.code))
        self.call("SELECT sonder.remove_student(%s, %s, %s)", (self.teacher, self.class_id, left))
        for who in (self.user("student"), left, self.teacher, self.user("parent")):
            with self.subTest(who=who), self.assertProductError("assignment_not_found"):
                self.enrolment_of(who, self.assignment)
        with self.assertProductError("assignment_not_found"):
            self.enrolment_of(self.student, str(uuid4()))

    def test_an_archived_class_or_deactivated_student_cannot_start(self):
        self.call("UPDATE sonder.app_user SET status = 'deactivated' WHERE id = %s", (self.student,))
        with self.assertProductError("assignment_not_found"):
            self.enrolment_of(self.student, self.assignment)
        self.call("UPDATE sonder.app_user SET status = 'active' WHERE id = %s", (self.student,))
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (self.teacher, self.class_id))
        with self.assertProductError("assignment_not_found"):
            self.enrolment_of(self.student, self.assignment)

    def test_a_closed_assignment_still_resolves_so_a_retry_can_be_answered(self):
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (self.teacher, self.assignment))
        self.assertEqual(self.enrolment_of(self.student, self.assignment), [(self.enrolment, "U1")])


class StartRuleTests(AssignmentStartTestCase):
    def test_an_open_assignment_of_the_running_release_may_start(self):
        self.check(self.assignment)  # no error

    def test_a_closed_assignment_may_not(self):
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (self.teacher, self.assignment))
        with self.assertProductError("assignment_closed"):
            self.check(self.assignment)

    def test_an_assignment_of_another_release_is_unavailable(self):
        older = self.assign(self.other_version)
        with self.assertProductError("assignment_unavailable"):
            self.check(older)
        self.check(older, self.other_version)  # fine for a service running that release

    def test_the_check_locks_the_students_enrolment_until_the_transaction_ends(self):
        first, second = self.connect(), self.connect()
        try:
            first.execute("BEGIN")
            first.execute("SELECT sonder.check_assignment_start(%s, %s, %s, %s)",
                          (self.enrolment, self.assignment, self.version_id(self.release_version), str(uuid4())))
            second.execute("SET lock_timeout = '300ms'")
            with self.assertRaises(psycopg.errors.LockNotAvailable):
                second.execute("SELECT 1 FROM sonder.enrolment WHERE id = %s FOR UPDATE", (self.enrolment,))
            first.execute("ROLLBACK")
            self.assertEqual(second.execute("SELECT id::text FROM sonder.enrolment WHERE id = %s FOR UPDATE",
                                            (self.enrolment,)).fetchone(), (self.enrolment,))
        finally:
            first.close()
            second.close()


if __name__ == "__main__":
    unittest.main()
