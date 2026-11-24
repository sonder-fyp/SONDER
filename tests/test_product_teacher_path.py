"""The real teacher path on stored records (I2-A15): every outcome, counts, reviews, scope.

Requirements acceptance checks A2, A4, A5, A6 (docs/design/I2_TEACHER_STUDENT_REQUIREMENTS.md section 8),
run on real PostgreSQL through the persistent service and the database functions the routes call.
"""

from __future__ import annotations

import itertools
import unittest
from dataclasses import replace
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    import psycopg
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.devseed import seed
    from sonder_api.pgstore import PostgresStore
    from sonder_api.stored_evidence import verify_session
    from sonder_api.store import ServiceError
    from sonder_engine import Params

SHORT = "Maths_v2-U1-dev-budget2"  # a release whose budget of 2 makes refusals reachable


class TeacherPathTests(ProductDatabaseTestCase):
    with_dev_release = True

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with psycopg.connect(cls.url) as conn:
            cls.short_label = seed(conn, version_code=SHORT, params=replace(Params(), default_budget=2), synthetic_students=0)["release"]
        cls.store = PostgresStore(cls.url, cls.release_label)
        cls.short_store = PostgresStore(cls.url, cls.short_label)

    @classmethod
    def tearDownClass(cls):
        cls.store.close()
        cls.short_store.close()
        super().tearDownClass()

    def setUp(self):
        self.teacher = self.user("teacher")
        self.class_id, self.code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Path class')",
                                             (self.teacher,))[0]

    def student(self):
        sid = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (sid, self.code))
        return sid

    def assign(self, version, title):
        return self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', %s, 'repeat')::text",
                         (self.teacher, self.class_id, version, title))[0][0]

    def play(self, store, student, assignment, choose):
        value = store.create(student, StartRequest(unit_id="U1", create_request_id=str(uuid4()), assignment_id=assignment))
        sid = value["session_id"]
        while value["status"] == "in_progress":
            q = value["question"]
            value, _ = store.submit(sid, student, AnswerRequest(step_index=q["step_index"], item_id=q["item_id"],
                                                                option_id=choose(sid, q["step_index"])))
        return sid

    def correct(self, sid, step):
        return self.call("SELECT o.label FROM sonder.session_question q JOIN sonder.item_option o ON o.item_id = q.item_id "
                         "WHERE q.session_id = %s AND q.step_index = %s AND o.is_correct", (sid, step))[0][0]

    def refusal(self, student, assignment):
        for options in itertools.product("ABCD", repeat=2):
            picks = iter(options)
            sid = self.play(self.short_store, student, assignment, lambda _s, _i: next(picks))
            status = self.call("SELECT status FROM sonder.diagnostic_session WHERE id = %s", (sid,))[0][0]
            if status.startswith("escalated_"):
                return sid
        self.fail("no two-answer sequence refused")

    def test_every_outcome_reads_correctly_and_replays(self):
        main = self.assign(self.release_version, "Rounding")
        short = self.assign(SHORT, "Short rounding")
        d1 = self.play(self.store, self.student(), main, lambda _s, i: "BBAB"[i])  # D1 opens on T1-001 after the link changes.
        none = self.play(self.store, self.student(), main, self.correct)
        refused = self.refusal(self.student(), short)
        expected = {d1: "diagnosed", none: "none_detected"}
        for sid, store in ((d1, self.store), (none, self.store), (refused, self.short_store)):
            with self.subTest(sid=sid):
                ev = store.teacher_evidence(sid, self.teacher)
                self.assertEqual(ev["outcome"]["outcome"], expected.get(sid, ev["outcome"]["outcome"]))
                with psycopg.connect(self.url) as conn:
                    self.assertEqual(verify_session(conn, sid), [])
                self.assertTrue(all(q["stem"] and len(q["options"]) == 4 for q in ev["questions"]))
        refusal = self.short_store.teacher_evidence(refused, self.teacher)["outcome"]
        self.assertTrue(refusal["outcome"].startswith("escalated_"))
        self.assertTrue(refusal["escalation_reason"])
        self.assertGreaterEqual(len(refusal["escalation_candidates"]), 1)

    def test_dashboard_rows_match_the_stored_attempts(self):
        main = self.assign(self.release_version, "Rounding")
        done, going, idle = self.student(), self.student(), self.student()
        finished = self.play(self.store, done, main, lambda _s, i: "BBAB"[i])  # D1 opens on T1-001 after the link changes.
        value = self.store.create(going, StartRequest(unit_id="U1", create_request_id=str(uuid4()), assignment_id=main))
        rows = {r[0]: r[1:] for r in self.call(
            "SELECT student_id::text, state, session_id::text, review_status FROM sonder.class_activity(%s, %s, %s)",
            (self.teacher, self.class_id, main))}
        self.assertEqual(rows[done], ("completed", finished, None))
        self.assertEqual(rows[going], ("in_progress", value["session_id"], None))
        self.assertEqual(rows[idle], ("not_started", None, None))
        stored = self.call("SELECT count(*) FROM sonder.diagnostic_session s JOIN sonder.enrolment e ON e.id = s.enrolment_id "
                           "WHERE e.class_id = %s AND s.assignment_id = %s", (self.class_id, main))[0][0]
        self.assertEqual(sum(1 for r in rows.values() if r[1] is not None), stored)

    def test_reviews_persist_across_a_service_restart_and_never_touch_the_result(self):
        main = self.assign(self.release_version, "Rounding")
        sid = self.play(self.store, self.student(), main, lambda _s, i: "BBAB"[i])  # D1 opens on T1-001 after the link changes.
        before = self.store.teacher_evidence(sid, self.teacher)["outcome"]
        self.call("SELECT sonder.add_session_review(%s, %s, 0, 'follow_up_required', 'Place value', %s)",
                  (self.teacher, sid, str(uuid4())))
        restarted = PostgresStore(self.url, self.release_label)
        try:
            self.assertEqual(restarted.teacher_evidence(sid, self.teacher)["outcome"], before)
        finally:
            restarted.close()
        self.assertEqual(self.call("SELECT revision, status, note FROM sonder.session_reviews(%s, %s)", (self.teacher, sid)),
                         [(1, "follow_up_required", "Place value")])

    def test_other_teachers_and_malicious_ids_get_nothing(self):
        main = self.assign(self.release_version, "Rounding")
        sid = self.play(self.store, self.student(), main, lambda _s, i: "BBAB"[i])  # D1 opens on T1-001 after the link changes.
        other = self.user("teacher")
        with self.assertRaises(ServiceError):
            self.store.teacher_evidence(sid, other)
        self.assertEqual(self.call("SELECT * FROM sonder.class_activity(%s, %s, NULL)", (other, self.class_id)), [])
        self.assertEqual(self.call("SELECT * FROM sonder.session_reviews(%s, %s)", (other, sid)), [])
        with self.assertProductError("session_not_found"):
            self.call("SELECT sonder.add_session_review(%s, %s, 0, 'reviewed', '', %s)", (other, sid, str(uuid4())))
        for bad in ("' OR 1=1 --", "00000000-0000-0000-0000-000000000000", sid.upper() + "x"):
            with self.subTest(bad=bad), self.assertRaises(ServiceError) as caught:
                self.store.teacher_evidence(bad, self.teacher)
            self.assertEqual(caught.exception.code, "session_not_found")


if __name__ == "__main__":
    unittest.main()
