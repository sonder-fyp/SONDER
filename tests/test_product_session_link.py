"""The session -> assignment link and its structural guard (I2-H12, migration 0006) on real PostgreSQL."""

from __future__ import annotations

import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    import psycopg
    from sonder_api.contracts import StartRequest
    from sonder_api.pgstore import PostgresStore


class SessionLinkTests(ProductDatabaseTestCase):
    with_dev_release = True

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.store = PostgresStore(cls.url, cls.release_label)  # registers the engine release row

    @classmethod
    def tearDownClass(cls):
        cls.store.close()
        super().tearDownClass()

    def setUp(self):
        self.teacher = self.user("teacher")
        self.class_id, code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Linked')",
                                        (self.teacher,))[0]
        self.student = self.user("student")
        self.enrolment = self.call("SELECT enrolment_id::text FROM sonder.join_class(%s, %s)", (self.student, code))[0][0]
        self.assignment = self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', 'Rounding')::text",
                                    (self.teacher, self.class_id, self.release_version))[0][0]
        self.ids = self.call(
            "SELECT r.id, (SELECT id FROM sonder.engine_release LIMIT 1), u.id "
            "FROM sonder.response_model r JOIN sonder.content_version cv ON cv.id = r.content_version_id "
            "JOIN sonder.diagnostic_unit u ON u.content_version_id = cv.id AND u.unit_code = 'U1' "
            "WHERE cv.version_code = %s", (self.release_version,))[0]

    def insert_session(self, conn, enrolment, assignment, unit=None):
        model, engine, u1 = self.ids
        conn.execute(
            "INSERT INTO sonder.diagnostic_session (enrolment_id, response_model_id, engine_release_id, unit_id, "
            "question_budget, request_key, assignment_id) VALUES (%s, %s, %s, %s, 8, %s, %s)",
            (enrolment, model, engine, unit or u1, str(uuid4()), assignment))

    def test_a_session_may_carry_an_assignment_of_its_own_class_and_unit(self):
        with self.connect() as conn, conn.transaction(force_rollback=True):
            # Rolled back before COMMIT, so the deferred trace-completeness check never runs.
            self.insert_session(conn, self.enrolment, self.assignment)
            self.assertEqual(conn.execute("SELECT count(*) FROM sonder.diagnostic_session WHERE assignment_id = %s",
                                          (self.assignment,)).fetchone(), (1,))

    def test_an_assignment_of_another_class_is_refused(self):
        other_class, other_code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Other')",
                                            (self.teacher,))[0]
        other_assignment = self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', 'Other')::text",
                                     (self.teacher, other_class, self.release_version))[0][0]
        with self.connect() as conn, conn.transaction(force_rollback=True):
            with self.assertRaisesRegex(psycopg.Error, "enrolment's class and its unit"):
                self.insert_session(conn, self.enrolment, other_assignment)

    def test_an_unknown_assignment_is_refused(self):
        # The BEFORE INSERT guard runs before the foreign key check, so it is the one that refuses.
        with self.connect() as conn, conn.transaction(force_rollback=True):
            with self.assertRaisesRegex(psycopg.Error, "enrolment's class and its unit"):
                self.insert_session(conn, self.enrolment, str(uuid4()))

    def test_sessions_without_an_assignment_still_start_and_the_link_cannot_change_later(self):
        snapshot = self.store.create(self.student, StartRequest(unit_id="U1", create_request_id=str(uuid4())))
        sid = snapshot["session_id"]
        self.assertEqual(self.call("SELECT assignment_id FROM sonder.diagnostic_session WHERE id = %s", (sid,)), [(None,)])
        with self.assertRaisesRegex(psycopg.Error, "Immutable key diagnostic_session.assignment_id"):
            self.call("UPDATE sonder.diagnostic_session SET assignment_id = %s WHERE id = %s", (self.assignment, sid))


if __name__ == "__main__":
    unittest.main()
