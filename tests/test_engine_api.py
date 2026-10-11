"""Transport parity and failure tests for the optional local API checkpoint."""
import concurrent.futures
import json
import unittest
from unittest.mock import patch
from uuid import uuid4

from sonder_engine import Params, answer, next_question, start
from sonder_engine.trace import trace_of, trace_to_dict
from sonder_pack.maths_v2 import load_maths_v2
from engine_students import deterministic_answer

try:
    from fastapi.testclient import TestClient
    from sonder_api.app import create_app
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.store import InMemoryStore, ServiceError
    API_AVAILABLE = True
except ModuleNotFoundError as exc:
    if exc.name not in {"fastapi", "httpx", "pydantic", "starlette"}:
        raise
    API_AVAILABLE = False


@unittest.skipUnless(API_AVAILABLE, "install approved API/test extras to run HTTP integration tests")
class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.params = Params()
        cls.pack = load_maths_v2(params=cls.params)

    def setUp(self):
        self.store = InMemoryStore(self.pack, self.params)
        self.headers = {"X-Sonder-Token": "t" * 32, "X-Sonder-Owner": "a" * 64}
        self.client = TestClient(create_app("t" * 32, store=self.store))
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def begin(self, unit="U1", nonce=None):
        response = self.client.post("/engine/sessions", headers=self.headers,
                                    json={"unit_id": unit, "create_request_id": nonce or str(uuid4())})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def submit(self, snapshot, option):
        q = snapshot["question"]
        body = {"step_index": q["step_index"], "item_id": q["item_id"], "option_id": option}
        response = self.client.post(f'/engine/sessions/{snapshot["session_id"]}/answers',
                                    headers=self.headers, json=body)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json(), body

    def inspect(self, sid):
        response = self.client.get(f"/engine/sessions/{sid}/trace", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        return response.json()["trace"]

    def safe_snapshot(self, v):
        self.assertEqual(set(v), {"contract_version", "session_id", "unit", "question_budget",
                                  "answered_count", "status", "question"})
        self.assertEqual(set(v["unit"]), {"unit_id", "name"})
        self.assertLessEqual(v["answered_count"], v["question_budget"])
        if v["status"] == "complete":
            self.assertIsNone(v["question"])
        else:
            q = v["question"]
            self.assertEqual(set(q), {"step_index", "item_id", "stem", "options"})
            self.assertEqual(q["step_index"], v["answered_count"])
            self.assertEqual([o["option_id"] for o in q["options"]], list("ABCD"))
            for option in q["options"]:
                self.assertEqual(set(option), {"option_id", "text"})
        self.assertNotIn("MATH-", json.dumps(v))

    def test_d1_and_d2(self):
        for unit, options, ids, outcome, rule in [
            ("U1", "DBBA", ["T1-005", "T1-006", "T1-007", "T1-009"], "diagnosed", "R1"),
            ("U4", "DA", ["T4-001", "T5-011"], "escalated_no_separator", "R4"),
        ]:
            v = self.begin(unit)
            seen = []
            for option in options:
                seen.append(v["question"]["item_id"])
                v, _ = self.submit(v, option)
                self.safe_snapshot(v)
            self.assertEqual(seen, ids)
            self.assertEqual(v["status"], "complete")
            trace = self.inspect(v["session_id"])
            self.assertEqual(trace["outcome"]["outcome"], outcome)
            self.assertEqual(trace["outcome"]["rule"], rule)

    def test_78_policies_exact_http_trace_parity(self):
        cases, rules = 0, set()
        for unit in self.pack.units:
            policies = [(h, lambda item, h=h: deterministic_answer(item, h)) for h in unit.hyps[:-1]]
            policies += [(f"always-{i}", lambda item, i=i: i) for i in range(4)]
            policies += [("unlinked", lambda item: next((i for i, links in enumerate(item.links)
                           if i != item.correct_index and not links), item.correct_index))]
            for name, policy in policies:
                with self.subTest(unit=unit.unit_id, policy=name):
                    v = self.begin(unit.unit_id)
                    direct = start(unit, self.params)
                    if not direct.finished:
                        direct = next_question(direct)
                    self.assertEqual(self.inspect(v["session_id"]), trace_to_dict(trace_of(direct)))
                    seen = set()
                    while not direct.finished:
                        self.safe_snapshot(v)
                        q = v["question"]
                        item = next(i for i in unit.engine_items if i.item_id == q["item_id"])
                        group = item.twin_group or item.item_id
                        self.assertNotIn(group, seen)
                        seen.add(group)
                        option = item.option_ids[policy(item)]
                        v, _ = self.submit(v, option)
                        direct = answer(direct, item.item_id, option)
                        if not direct.finished:
                            direct = next_question(direct)
                        self.assertEqual(self.inspect(v["session_id"]), trace_to_dict(trace_of(direct)))
                    self.safe_snapshot(v)
                    rules.add(direct.decision.rule)
                    cases += 1
        self.assertEqual(cases, 78)
        self.assertEqual(rules, {"R1", "R2", "R3", "R4", "R5"})

    def test_catalogue_and_loader_exclusions(self):
        response = self.client.get("/engine/units", headers=self.headers)
        v = response.json()
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual([u["item_count"] for u in v["units"]], [20, 25, 10, 16, 10, 14, 16])
        self.assertEqual(v["question_budget"], self.params.default_budget)
        self.assertEqual(len(self.pack.warnings), 40)
        self.assertFalse({"T6-011B", "T6-014B", "T6-016B"} & {i.item.item_id for i in self.pack.unit("U6").items})
        self.assertEqual(len(self.store.entries), 0)

    def test_begin_retries_original_response_even_after_answers(self):
        nonce = str(uuid4())
        initial = self.begin(nonce=nonce)
        self.submit(initial, "D")
        self.assertEqual(self.begin(nonce=nonce), initial)
        response = self.client.post("/engine/sessions", headers=self.headers,
                                    json={"unit_id": "U2", "create_request_id": nonce})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(len(self.store.entries), 1)

    def test_old_and_final_answer_retry(self):
        v = self.begin()
        first, first_body = self.submit(v, "D")
        v = first
        for option in "BBA":
            v, final_body = self.submit(v, option)
        path = f'/engine/sessions/{v["session_id"]}/answers'
        for body, expected in [(first_body, first), (final_body, v)]:
            response = self.client.post(path, headers=self.headers, json=body)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), expected)
        conflict = {**first_body, "option_id": "A"}
        self.assertEqual(self.client.post(path, headers=self.headers, json=conflict).status_code, 409)
        self.assertEqual(len(self.inspect(v["session_id"])["steps"]), 4)

    def test_parallel_begin_and_answers(self):
        nonce = str(uuid4())
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            replies = list(pool.map(lambda _: self.begin(nonce=nonce), range(4)))
        self.assertTrue(all(v == replies[0] for v in replies))
        v = replies[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            answers = list(pool.map(lambda _: self.submit(v, "D")[0], range(4)))
        self.assertTrue(all(v == answers[0] for v in answers))
        self.assertEqual(len(self.inspect(v["session_id"])["steps"]), 1)

    def test_competing_answers_accept_exactly_one(self):
        v = self.begin()
        q = v["question"]
        path = f'/engine/sessions/{v["session_id"]}/answers'
        def send(option):
            return self.client.post(path, headers=self.headers, json={"step_index": 0,
                                    "item_id": q["item_id"], "option_id": option}).status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(send, "AD"))
        self.assertEqual(sorted(statuses), [200, 409])
        self.assertEqual(len(self.inspect(v["session_id"])["steps"]), 1)

    def test_invalid_requests_and_errors_do_not_leak_or_mutate(self):
        v = self.begin()
        path = f'/engine/sessions/{v["session_id"]}/answers'
        valid = {"step_index": 0, "item_id": v["question"]["item_id"], "option_id": "D"}
        for body in [{**valid, "step_index": True}, {**valid, "step_index": "0"},
                     {**valid, "posterior": []}, {**valid, "option_id": "E"}, {},
                     {**valid, "step_index": -1}, {**valid, "item_id": 123}]:
            response = self.client.post(path, headers=self.headers, json=body)
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        for body in [{**valid, "step_index": 2}, {**valid, "item_id": "T1-001"}]:
            self.assertEqual(self.client.post(path, headers=self.headers, json=body).status_code, 409)
        for raw in ["{", " " * 4097]:
            self.assertEqual(self.client.post(path, headers=self.headers, content=raw).status_code, 422)
        self.assertEqual(self.client.get(f'/engine/sessions/{v["session_id"]}', headers=self.headers).json(), v)

    def test_token_owner_and_unavailable_sessions(self):
        v = self.begin()
        for headers, status in [({}, 401), ({"X-Sonder-Token": "wrong"}, 401),
                                ({"X-Sonder-Token": "t" * 32}, 404),
                                ({**self.headers, "X-Sonder-Owner": "b" * 64}, 404)]:
            response = self.client.get(f'/engine/sessions/{v["session_id"]}', headers=headers)
            self.assertEqual(response.status_code, status)
            self.assertEqual(set(response.json()), {"error"})
        self.assertEqual(self.client.get("/engine/sessions/guessed", headers=self.headers).status_code, 404)
        self.assertEqual(self.client.get("/engine/health", headers=self.headers).json()["mode"], "in_memory")
        for route in ["/docs", "/redoc", "/openapi.json"]:
            self.assertEqual(self.client.get(route).status_code, 404)

    def test_numeric_and_projection_failure_are_atomic(self):
        v = self.begin()
        sid = v["session_id"]
        trace = self.inspect(sid)
        path = f"/engine/sessions/{sid}/answers"
        body = {"step_index": 0, "item_id": v["question"]["item_id"], "option_id": "D"}
        for target in ["sonder_api.store.answer", "sonder_api.store.snapshot", "sonder_api.store.evidence"]:
            with patch(target, side_effect=FloatingPointError("MATH-secret")):
                response = self.client.post(path, headers=self.headers, json=body)
            self.assertEqual(response.status_code, 500)
            self.assertEqual(response.json(), {"error": {"code": "engine_numeric_error"}})
            self.assertEqual(self.inspect(sid), trace)
            self.assertEqual(self.store.entries[sid].replies, {})
        self.submit(v, "D")

    def test_capacity_expiry_and_bounded_bookkeeping(self):
        now = [0]
        store = InMemoryStore(self.pack, self.params, capacity=1, ttl=10, clock=lambda: now[0])
        req = StartRequest(unit_id="U1", create_request_id=str(uuid4()))
        v = store.create("a" * 64, req)
        with self.assertRaises(ServiceError) as caught:
            store.create("b" * 64, req)
        self.assertEqual(caught.exception.code, "capacity_exceeded")
        now[0] = 9
        store.current(v["session_id"], "a" * 64)
        now[0] = 19
        with self.assertRaises(ServiceError) as caught:
            store.current(v["session_id"], "a" * 64)
        self.assertEqual(caught.exception.status, 410)
        with self.assertRaises(ServiceError) as caught:
            store.current(v["session_id"], "b" * 64)
        self.assertEqual(caught.exception.status, 404)
        self.assertFalse(store.creates)
        for _ in range(4):
            store.create("a" * 64, StartRequest(unit_id="U1", create_request_id=str(uuid4())))
            now[0] += 10
        store._prune()
        self.assertLessEqual(len(store.expired), 1)
        self.assertFalse(store.entries)

    def test_finished_runs_make_room_but_active_runs_are_kept(self):
        now = [0]
        store = InMemoryStore(self.pack, self.params, capacity=2, clock=lambda: now[0])
        owner = "a" * 64
        def run(unit, options):
            v = store.create(owner, StartRequest(unit_id=unit, create_request_id=str(uuid4())))
            for option in options:
                now[0] += 1
                q = v["question"]
                v, _ = store.submit(v["session_id"], owner, AnswerRequest(
                    step_index=q["step_index"], item_id=q["item_id"], option_id=option))
            return v
        first = run("U4", "DA")
        second = run("U4", "DA")
        self.assertEqual((first["status"], second["status"]), ("complete", "complete"))
        active = run("U1", "")
        self.assertEqual(active["status"], "in_progress")
        with self.assertRaises(ServiceError) as caught:
            store.current(first["session_id"], owner)
        self.assertEqual(caught.exception.status, 410)
        self.assertEqual(store.current(second["session_id"], owner), second)
        run("U1", "")
        with self.assertRaises(ServiceError) as caught:
            run("U1", "")
        self.assertEqual(caught.exception.code, "capacity_exceeded")
        self.assertEqual(store.current(active["session_id"], owner)["status"], "in_progress")

    def test_returned_reply_cannot_mutate_cache(self):
        request = StartRequest(unit_id="U1", create_request_id=str(uuid4()))
        v = self.store.create("a" * 64, request)
        v["question"]["stem"] = "corrupted"
        self.assertNotEqual(self.store.create("a" * 64, request)["question"]["stem"], "corrupted")

    def test_read_is_nonadvancing_and_restart_loses_sessions(self):
        v = self.begin()
        sid = v["session_id"]
        before = self.inspect(sid)
        for _ in range(3):
            self.assertEqual(self.client.get(f"/engine/sessions/{sid}", headers=self.headers).json(), v)
        self.assertEqual(self.inspect(sid), before)
        replacement = InMemoryStore(self.pack, self.params)
        with self.assertRaises(ServiceError):
            replacement.current(sid, "a" * 64)

    def test_logging_failure_does_not_duplicate_transition(self):
        self.client.app.state.store = self.store
        with TestClient(create_app("t" * 32, store=self.store, trace=True)) as client:
            v = self.begin()
            body = {"step_index": 0, "item_id": v["question"]["item_id"], "option_id": "D"}
            path = f'/engine/sessions/{v["session_id"]}/answers'
            with patch("sonder_api.app.log.warning", side_effect=RuntimeError("log failed")) as warning:
                first = client.post(path, headers=self.headers, json=body)
                second = client.post(path, headers=self.headers, json=body)
            self.assertEqual(first.status_code, 200)
            self.assertEqual(first.json(), second.json())
            self.assertEqual(warning.call_count, 1)

    def test_startup_loads_once_and_refuses_pack_failure(self):
        with patch("sonder_api.app.load_maths_v2", return_value=self.pack) as loader:
            with TestClient(create_app("t" * 32)) as client:
                for _ in range(2):
                    client.get("/engine/units", headers=self.headers)
            self.assertEqual(loader.call_count, 1)
        with patch("sonder_api.app.load_maths_v2", side_effect=ValueError("bad pack")):
            with self.assertRaises(ValueError):
                with TestClient(create_app("t" * 32)):
                    pass


if __name__ == "__main__":
    unittest.main()
