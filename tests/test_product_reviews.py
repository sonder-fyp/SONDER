"""Append-only teacher reviews of finished checks (I2-A14, migration 0009) on real PostgreSQL."""

from __future__ import annotations

import threading
import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    import psycopg
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.pgstore import PostgresStore


class ReviewTestCase(ProductDatabaseTestCase):
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
        self.class_id, code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Reviewed')",
                                        (self.teacher,))[0]
        self.student = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (self.student, code))

    def session(self, finish=True):
        value = self.store.create(self.student, StartRequest(unit_id="U1", create_request_id=str(uuid4())))
        for option in ("DBBA" if finish else "D"):
            q = value["question"]
            value, _ = self.store.submit(value["session_id"], self.student, AnswerRequest(
                step_index=q["step_index"], item_id=q["item_id"], option_id=option))
        return value["session_id"]

    def add(self, sid, expected, status="reviewed", note="", key=None, teacher=None):
        return self.call("SELECT sonder.add_session_review(%s, %s, %s, %s, %s, %s)",
                         (teacher or self.teacher, sid, expected, status, note, key or str(uuid4())))[0][0]

    def reviews(self, sid, teacher=None):
        return self.call("SELECT revision, status, note, reviewer_name FROM sonder.session_reviews(%s, %s)",
                         (teacher or self.teacher, sid))


class WriteTests(ReviewTestCase):
    def test_revisions_append_and_keep_who_and_when(self):
        sid = self.session()
        self.assertEqual(self.reviews(sid), [])  # unreviewed = no row
        self.assertEqual(self.add(sid, 0, "follow_up_required", "  Check place value  "), 1)
        self.assertEqual(self.add(sid, 1, "reviewed", "Talked it through"), 2)
        self.assertEqual(self.reviews(sid), [(1, "follow_up_required", "Check place value", "Test teacher"),
                                             (2, "reviewed", "Talked it through", "Test teacher")])
        self.assertEqual(self.call("SELECT count(*) FROM sonder.audit_event WHERE relation_name = 'session_review' "
                                   "AND actor_id = %s", (self.teacher,)), [(2,)])

    def test_a_stale_write_is_a_conflict(self):
        sid = self.session()
        self.add(sid, 0)
        with self.assertProductError("review_conflict"):
            self.add(sid, 0, "follow_up_required")
        with self.assertProductError("review_conflict"):
            self.add(sid, 5)
        self.assertEqual(len(self.reviews(sid)), 1)

    def test_an_identical_retry_returns_the_same_revision(self):
        sid = self.session()
        key = str(uuid4())
        self.assertEqual(self.add(sid, 0, "reviewed", "ok", key), 1)
        self.assertEqual(self.add(sid, 0, "reviewed", "ok", key), 1)  # even though 0 is now stale
        with self.assertProductError("review_conflict"):
            self.add(sid, 1, "follow_up_required", "different", key)
        self.assertEqual(len(self.reviews(sid)), 1)

    def test_input_and_state_checks(self):
        sid = self.session()
        for status in ("approved", "", None):
            with self.subTest(status=status), self.assertProductError("review_status_invalid"):
                self.add(sid, 0, status)
        with self.assertProductError("review_note_invalid"):
            self.add(sid, 0, note="n" * 2001)
        self.assertEqual(self.add(sid, 0, note="n" * 2000), 1)
        with self.assertProductError("session_unfinished"):
            self.add(self.session(finish=False), 0)

    def test_only_a_class_teacher_can_write_or_read(self):
        sid = self.session()
        self.add(sid, 0)
        for outsider in (self.user("teacher"), self.student, self.user("admin")):
            with self.subTest(outsider=outsider):
                with self.assertProductError("session_not_found"):
                    self.add(sid, 1, teacher=outsider)
                self.assertEqual(self.reviews(sid, outsider), [])
        with self.assertProductError("session_not_found"):
            self.add(str(uuid4()), 0)


class IntegrityTests(ReviewTestCase):
    def test_rows_cannot_be_changed_or_removed(self):
        sid = self.session()
        self.add(sid, 0, note="first")
        for sql in ("UPDATE sonder.session_review SET note = 'edited' WHERE session_id = %s",
                    "DELETE FROM sonder.session_review WHERE session_id = %s"):
            with self.subTest(sql=sql), self.assertRaisesRegex(psycopg.Error, "append-only/immutable"):
                self.call(sql, (sid,))

    def test_direct_inserts_are_checked(self):
        sid = self.session()
        insert = ("INSERT INTO sonder.session_review (session_id, revision, status, actor_id, request_key) "
                  "VALUES (%s, %s, 'reviewed', %s, %s)")
        with self.assertRaisesRegex(psycopg.Error, "active teacher of the session's class"):
            self.call(insert, (sid, 1, self.user("teacher"), "k1"))
        with self.assertRaisesRegex(psycopg.Error, "follows the latest one"):
            self.call(insert, (sid, 3, self.teacher, "k2"))
        with self.assertRaisesRegex(psycopg.Error, "Only a finished session"):
            self.call(insert, (self.session(finish=False), 1, self.teacher, "k3"))

    def test_a_review_never_touches_the_engine_result(self):
        sid = self.session()
        before = self.call("SELECT s.status, (SELECT count(*) FROM sonder.diagnosis d WHERE d.session_id = s.id), "
                           "(SELECT count(*) FROM sonder.escalation x WHERE x.session_id = s.id) "
                           "FROM sonder.diagnostic_session s WHERE s.id = %s", (sid,))
        self.add(sid, 0, "follow_up_required")
        self.assertEqual(self.call("SELECT s.status, (SELECT count(*) FROM sonder.diagnosis d WHERE d.session_id = s.id), "
                                   "(SELECT count(*) FROM sonder.escalation x WHERE x.session_id = s.id) "
                                   "FROM sonder.diagnostic_session s WHERE s.id = %s", (sid,)), before)

    def test_two_teachers_writing_at_once_get_one_revision_each_way(self):
        co_teacher = self.user("teacher")
        self.call("INSERT INTO sonder.class_teacher (class_id, teacher_id) VALUES (%s, %s)", (self.class_id, co_teacher))
        sid = self.session()
        first, second = self.connect(), self.connect()
        try:
            first.execute("BEGIN")
            first.execute("SELECT sonder.add_session_review(%s, %s, 0, 'reviewed', '', %s)", (self.teacher, sid, str(uuid4())))
            outcome = {}

            def other():
                try:
                    second.execute("SELECT sonder.add_session_review(%s, %s, 0, 'follow_up_required', '', %s)",
                                   (co_teacher, sid, str(uuid4())))
                    outcome["result"] = "written"
                except psycopg.Error as exc:
                    outcome["result"] = exc.diag.message_primary

            thread = threading.Thread(target=other)
            thread.start()
            thread.join(0.5)
            self.assertTrue(thread.is_alive())  # waits for the first writer's lock
            first.execute("COMMIT")
            thread.join(10)
            self.assertEqual(outcome["result"], "review_conflict")  # both expected revision 0; one wins
        finally:
            first.close()
            second.close()
        self.assertEqual([r[0] for r in self.reviews(sid)], [1])


if __name__ == "__main__":
    unittest.main()
