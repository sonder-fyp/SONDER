"""The whole class slice on real records: create -> join -> assign -> start -> answer -> resume -> finish (I2-H13).

Class, join and assignment steps call the same database functions the Next.js routes call; the
diagnostic runs over HTTP against the FastAPI app on the PostgreSQL store, with the content version
taken from the service's own health report exactly as POST /api/teacher/classes/[id]/assignments does.
The Neon/BFF version of this flow is scripts/check_class_flow.py (docs/testing/CLASS_ASSIGNMENT_FLOW_CHECKS.md).
"""

from __future__ import annotations

import json
import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    from fastapi.testclient import TestClient
    from sonder_api.app import create_app
    from sonder_api.pgstore import PostgresStore
    from sonder_api.stored_evidence import stored_evidence, verify_session
    import psycopg

TOKEN = "t" * 32
STUDENT_FIELDS = {"contract_version", "session_id", "unit", "question_budget", "answered_count", "status", "question"}


class ClassFlowTests(ProductDatabaseTestCase):
    with_dev_release = True

    def setUp(self):
        self.store = PostgresStore(self.url, self.release_label)
        self.addCleanup(self.store.close)
        self.client = TestClient(create_app(TOKEN, store=self.store))
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def api(self, method, path, actor=None, body=None):
        headers = {"X-Sonder-Token": TOKEN, **({"X-Sonder-Actor": actor} if actor else {})}
        return self.client.request(method, path, headers=headers, json=body)

    def safe(self, response):
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(set(data), STUDENT_FIELDS)
        encoded = json.dumps(data)
        for secret in ("MATH-", "posterior", "outcome", "is_correct"):
            self.assertNotIn(secret, encoded)
        return data

    def test_create_join_assign_start_answer_resume_finish(self):
        teacher, student, classmate = self.user("teacher"), self.user("student"), self.user("student")

        # Teacher creates a class; it teaches Maths and has a join code.
        class_id, code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Grade 8 Blue')", (teacher,))[0]

        # Students join with the code as they might type it.
        typed = f"{code[:5].lower()} {code[5:]}"
        self.assertTrue(self.call("SELECT joined FROM sonder.join_class(%s, %s)", (student, typed))[0][0])
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (classmate, code))
        self.assertEqual({r[0] for r in self.call("SELECT student_id::text FROM sonder.class_roster(%s, %s)", (teacher, class_id))},
                         {student, classmate})

        # Teacher assigns U1 in the release the running service reports.
        release = self.api("GET", "/engine/health").json()["release"]
        version = release.split("/")[0]
        assignment = self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', 'Rounding check', 'single')::text",
                               (teacher, class_id, version))[0][0]
        listed = self.call("SELECT assignment_id::text, title, unit_code FROM sonder.student_assignments(%s)", (student,))
        self.assertEqual(listed, [(assignment, "Rounding check", "U1")])

        # Student starts from the assignment; a retry of the same request is the same start.
        start = {"unit_id": "U1", "create_request_id": str(uuid4()), "assignment_id": assignment}
        first = self.safe(self.api("POST", "/engine/sessions", student, start))
        self.assertEqual(self.safe(self.api("POST", "/engine/sessions", student, start)), first)
        sid = first["session_id"]

        # Answer the D1 worked example; refreshing mid-way shows the same pending question.
        value, items = first, []
        for index, option in enumerate("BBAB"):  # D1 opens on T1-001 after the link changes.
            question = value["question"]
            items.append(question["item_id"])
            value = self.safe(self.api("POST", f"/engine/sessions/{sid}/answers", student,
                                       {"step_index": question["step_index"], "item_id": question["item_id"], "option_id": option}))
            if index == 1:
                self.assertEqual(self.safe(self.api("GET", f"/engine/sessions/{sid}", student)), value)
                # A second start while unfinished is refused; the student resumes instead.
                again = self.api("POST", "/engine/sessions", student, {**start, "create_request_id": str(uuid4())})
                self.assertEqual((again.status_code, again.json()), (409, {"error": {"code": "attempt_in_progress"}}))
        self.assertEqual(items, ["T1-001", "T1-006", "T1-005", "T1-007"])  # T1-001 now wins the opening EIG tie.
        self.assertEqual(value["status"], "complete")

        # The stored session is linked to the assignment and its evidence replays exactly.
        with psycopg.connect(self.url) as conn:
            self.assertEqual(conn.execute("SELECT assignment_id::text, status FROM sonder.diagnostic_session WHERE id = %s",
                                          (sid,)).fetchone(), (assignment, "diagnosed"))
            evidence = stored_evidence(conn, sid)
            self.assertEqual([step["item_id"] for step in evidence["steps"]], items)
            self.assertEqual(verify_session(conn, sid), [])

        # One attempt only; the classmate's own attempt is unaffected.
        done = self.api("POST", "/engine/sessions", student, {**start, "create_request_id": str(uuid4())})
        self.assertEqual((done.status_code, done.json()), (409, {"error": {"code": "attempt_limit_reached"}}))
        classmate_start = {**start, "create_request_id": str(uuid4())}
        self.safe(self.api("POST", "/engine/sessions", classmate, classmate_start))

        # Nobody outside the class sees or starts any of it.
        outsider_teacher, outsider_student = self.user("teacher"), self.user("student")
        self.assertEqual(self.call("SELECT * FROM sonder.class_roster(%s, %s)", (outsider_teacher, class_id)), [])
        self.assertEqual(self.call("SELECT * FROM sonder.class_assignments(%s, %s)", (outsider_teacher, class_id)), [])
        self.assertEqual(self.api("GET", f"/engine/sessions/{sid}", outsider_student).status_code, 404)
        foreign = self.api("POST", "/engine/sessions", outsider_student, {**start, "create_request_id": str(uuid4())})
        self.assertEqual((foreign.status_code, foreign.json()), (404, {"error": {"code": "assignment_not_found"}}))

        # Closing the assignment hides it and stops new starts; archiving hides the class.
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (teacher, assignment))
        self.assertEqual(self.call("SELECT * FROM sonder.student_assignments(%s)", (student,)), [])
        late = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (late, code))
        closed = self.api("POST", "/engine/sessions", late, {**start, "create_request_id": str(uuid4())})
        self.assertEqual((closed.status_code, closed.json()), (409, {"error": {"code": "assignment_closed"}}))
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (teacher, class_id))
        self.assertEqual(self.call("SELECT * FROM sonder.student_classes(%s)", (student,)), [])


if __name__ == "__main__":
    unittest.main()
