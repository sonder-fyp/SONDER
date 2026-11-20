"""Teacher-scoped stored evidence (I2-A12) through the real persistent service on PostgreSQL."""

from __future__ import annotations

import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    import psycopg
    from fastapi.testclient import TestClient
    from sonder_api.app import create_app
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.devseed import seed
    from sonder_api.pgstore import PostgresStore
    from sonder_api.stored_evidence import stored_evidence, verify_session
    from sonder_api.store import ServiceError

TOKEN = "t" * 32


class EvidenceTests(ProductDatabaseTestCase):
    with_dev_release = True

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with psycopg.connect(cls.url) as conn:  # a second release reusing the same item ids
            seed(conn, version_code="Maths_v2-U1-dev-second", synthetic_students=0)

    def setUp(self):
        self.store = PostgresStore(self.url, self.release_label)
        self.addCleanup(self.store.close)
        self.teacher = self.user("teacher")
        self.class_id, code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Evidence class')",
                                        (self.teacher,))[0]
        self.student = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (self.student, code))
        self.assignment = self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', 'Rounding check', 'repeat')::text",
                                    (self.teacher, self.class_id, self.release_version))[0][0]

    def begin(self):
        return self.store.create(self.student, StartRequest(unit_id="U1", create_request_id=str(uuid4()),
                                                            assignment_id=self.assignment))

    def answer(self, value, option):
        q = value["question"]
        return self.store.submit(value["session_id"], self.student, AnswerRequest(
            step_index=q["step_index"], item_id=q["item_id"], option_id=option))[0]

    def finish(self, options="DBBA"):
        value = self.begin()
        for option in options:
            value = self.answer(value, option)
        return value["session_id"]

    def correct_label(self, sid, step_index):
        return self.call("SELECT o.label FROM sonder.session_question q JOIN sonder.item_option o ON o.item_id = q.item_id "
                         "WHERE q.session_id = %s AND q.step_index = %s AND o.is_correct", (sid, step_index))[0][0]

    def test_a_class_teacher_reads_the_d1_evidence_with_text_names_and_context(self):
        sid = self.finish()
        ev = self.store.teacher_evidence(sid, self.teacher)
        self.assertEqual(ev["student"], {"display_name": "Test student"})
        self.assertEqual(ev["class"], {"class_id": self.class_id, "name": "Evidence class"})
        self.assertEqual(ev["assignment"], {"assignment_id": self.assignment, "title": "Rounding check"})
        self.assertEqual(ev["outcome"]["outcome"], "diagnosed")
        self.assertEqual([q["item_id"] for q in ev["questions"]], ["T1-005", "T1-006", "T1-007", "T1-009"])
        names = {h["slot"]: h["name"] for h in ev["hypotheses"]}
        self.assertIn("No misconception", names.values())
        self.assertIn("Something else", names.values())
        self.assertTrue(all(name for name in names.values()))
        for question in ev["questions"]:
            self.assertTrue(question["stem"].strip())
            self.assertEqual([o["option_id"] for o in question["options"]], ["A", "B", "C", "D"])
            self.assertEqual(sum(o["is_correct"] for o in question["options"]), 1)
        self.assertTrue(any(link["grade"] in ("S", "T") and link["misconception_id"].startswith("MATH-")
                            for q in ev["questions"] for o in q["options"] for link in o["links"]))

    def test_evidence_is_the_stored_evidence_plus_reading_aids(self):
        sid = self.finish()
        ev = self.store.teacher_evidence(sid, self.teacher)
        with psycopg.connect(self.url) as conn:
            stored = stored_evidence(conn, sid)
            self.assertEqual(verify_session(conn, sid), [])
        for key in ("session_id", "unit_id", "release", "content_version", "params_sha256", "engine_release",
                    "steps", "outcome"):
            self.assertEqual(ev[key], stored[key], key)
        self.assertEqual([{k: h[k] for k in ("slot", "hypothesis_id", "kind", "prior")} for h in ev["hypotheses"]],
                         stored["hypotheses"])
        self.assertEqual([{k: q[k] for k in stored["questions"][0]} for q in ev["questions"]], stored["questions"])

    def test_text_comes_from_the_sessions_own_version(self):
        # The second release has items with the same external ids; joining by id keeps exactly
        # the four options of the pinned item, never eight.
        sid = self.finish()
        ev = self.store.teacher_evidence(sid, self.teacher)
        self.assertEqual(ev["content_version"], self.release_version)
        self.assertTrue(all(len(q["options"]) == 4 for q in ev["questions"]))

    def test_a_none_detected_session(self):
        value = self.begin()
        sid = value["session_id"]
        while value["status"] == "in_progress":
            value = self.answer(value, self.correct_label(sid, value["question"]["step_index"]))
        ev = self.store.teacher_evidence(sid, self.teacher)
        self.assertEqual(ev["outcome"]["outcome"], "none_detected")
        self.assertTrue(all(q["options"][["A", "B", "C", "D"].index(s["option_id"])]["is_correct"]
                            for q, s in zip(ev["questions"], ev["steps"])))

    def test_an_unfinished_session_shows_the_pending_question(self):
        value = self.answer(self.begin(), "D")
        ev = self.store.teacher_evidence(value["session_id"], self.teacher)
        self.assertEqual(ev["outcome"]["outcome"], "in_progress")
        self.assertEqual((len(ev["steps"]), len(ev["questions"])), (1, 2))
        self.assertTrue(ev["questions"][1]["stem"])

    def test_nobody_else_can_read_it(self):
        sid = self.finish()
        departed = self.user("teacher")
        with self.connect() as conn:
            conn.execute("INSERT INTO sonder.class_teacher (class_id, teacher_id) VALUES (%s, %s)", (self.class_id, departed))
            conn.execute("UPDATE sonder.class_teacher SET status = 'departed' WHERE teacher_id = %s", (departed,))
        for actor in (self.user("teacher"), departed, self.student, self.user("admin")):
            with self.subTest(actor=actor), self.assertRaises(ServiceError) as caught:
                self.store.teacher_evidence(sid, actor)
            self.assertEqual((caught.exception.status, caught.exception.code), (404, "session_not_found"))
        for bad in (str(uuid4()), "not-a-uuid"):
            with self.subTest(sid=bad), self.assertRaises(ServiceError):
                self.store.teacher_evidence(bad, self.teacher)

    def test_the_http_endpoint(self):
        sid = self.finish()
        with TestClient(create_app(TOKEN, store=self.store)) as client:
            get = lambda actor, s=sid: client.get(f"/engine/teacher/sessions/{s}/evidence",
                                                  headers={"X-Sonder-Token": TOKEN, "X-Sonder-Actor": actor})
            ok = get(self.teacher)
            self.assertEqual(ok.status_code, 200)
            self.assertEqual(ok.json()["session_id"], sid)
            for actor in (self.user("teacher"), self.student):
                self.assertEqual((get(actor).status_code, get(actor).json()), (404, {"error": {"code": "session_not_found"}}))
            self.assertEqual(client.get(f"/engine/teacher/sessions/{sid}/evidence",
                                        headers={"X-Sonder-Actor": self.teacher}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
