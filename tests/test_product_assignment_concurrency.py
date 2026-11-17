"""Simultaneous assignment starts and the HTTP contract on top of the persistent service (I2-H12)."""

from __future__ import annotations

import concurrent.futures
import unittest
from uuid import uuid4

from product_db import HAVE_PSYCOPG
from test_product_assignment_store import AssignmentStoreTestCase

if HAVE_PSYCOPG:
    from fastapi.testclient import TestClient
    from sonder_api.app import create_app
    from sonder_api.store import ServiceError


class ConcurrencyTests(AssignmentStoreTestCase):
    def run_together(self, *calls):
        with concurrent.futures.ThreadPoolExecutor(len(calls)) as pool:
            futures = [pool.submit(call) for call in calls]
            results = []
            for future in futures:
                try:
                    results.append(future.result(timeout=30))
                except ServiceError as exc:
                    results.append((exc.status, exc.code))
        return results

    def test_simultaneous_different_starts_make_one_attempt(self):
        assignment = self.assign("single")
        results = self.run_together(*(lambda: self.begin(self.student, assignment) for _ in range(4)))
        started = [r for r in results if isinstance(r, dict)]
        self.assertEqual(len(started), 1, results)
        self.assertEqual(sorted(r for r in results if not isinstance(r, dict)), [(409, "attempt_in_progress")] * 3)
        self.assertEqual(self.call("SELECT count(*) FROM sonder.diagnostic_session WHERE assignment_id = %s",
                                   (assignment,)), [(1,)])

    def test_simultaneous_identical_starts_share_one_session(self):
        assignment = self.assign("single")
        key = str(uuid4())
        results = self.run_together(*(lambda: self.begin(self.student, assignment, key) for _ in range(4)))
        self.assertTrue(all(isinstance(r, dict) for r in results), results)
        self.assertEqual(len({r["session_id"] for r in results}), 1)


class HttpTests(AssignmentStoreTestCase):
    def test_the_http_start_carries_the_assignment_and_its_errors(self):
        token = "t" * 32
        client = TestClient(create_app(token, store=self.store))
        client.__enter__()  # runs the app's startup, which attaches the store
        self.addCleanup(client.__exit__, None, None, None)
        headers = {"X-Sonder-Token": token, "X-Sonder-Actor": self.student}
        assignment = self.assign("single")
        body = {"unit_id": "U1", "create_request_id": str(uuid4()), "assignment_id": assignment}
        started = client.post("/engine/sessions", json=body, headers=headers)
        self.assertEqual(started.status_code, 200, started.text)
        self.assertEqual(self.linked(started.json()["session_id"]), assignment)
        again = client.post("/engine/sessions", json={**body, "create_request_id": str(uuid4())}, headers=headers)
        self.assertEqual((again.status_code, again.json()), (409, {"error": {"code": "attempt_in_progress"}}))
        outsider = client.post("/engine/sessions", json={**body, "create_request_id": str(uuid4())},
                               headers={**headers, "X-Sonder-Actor": self.user("student")})
        self.assertEqual((outsider.status_code, outsider.json()), (404, {"error": {"code": "assignment_not_found"}}))


if __name__ == "__main__":
    unittest.main()
