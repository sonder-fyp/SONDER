"""Exercise both running servers over real HTTP; not a browser click-through.

Run from the checkout: python scripts/check_engine_ui.py [--all-policies]
Requires SONDER_ENGINE_TOKEN. Does not start services, install or modify data.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from http.cookiejar import CookieJar
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener, urlopen
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sonder_engine import Params, answer, next_question, start
from sonder_engine.trace import trace_of, trace_to_dict
from sonder_engine.stopping import triggered_options
from sonder_pack.maths_v2 import load_maths_v2

UI = "http://127.0.0.1:3000"
API = "http://127.0.0.1:8000"


class BrowserTransport:
    def __init__(self):
        self.jar = CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.jar))

    def call(self, path, body=None, expected=200, headers=None):
        request = Request(UI + path, data=None if body is None else json.dumps(body).encode(),
                          headers={"Content-Type": "application/json", "Origin": UI, **(headers or {})})
        try:
            response = self.opener.open(request, timeout=60)
        except HTTPError as exc:
            response = exc
        with response:
            assert response.status == expected, (path, response.status, response.read())
            value = json.load(response)
            assert response.headers.get("Cache-Control") == "no-store"
            return value


def trace(sid):
    request = Request(f"{API}/engine/sessions/{sid}/trace",
                      headers={"X-Sonder-Token": os.environ["SONDER_ENGINE_TOKEN"]})
    with urlopen(request, timeout=30) as response:
        return json.load(response)["trace"]


def safe(v):
    assert set(v) == {"contract_version", "session_id", "unit", "question_budget", "answered_count", "status", "question"}
    assert set(v["unit"]) == {"unit_id", "name"}
    assert "MATH-" not in json.dumps(v)
    if v["question"]:
        assert set(v["question"]) == {"step_index", "item_id", "stem", "options"}
        assert all(set(o) == {"option_id", "text"} for o in v["question"]["options"])


def run(browser, unit, params, policy):
    nonce = str(uuid4())
    initial = browser.call("/api/diagnostic/sessions", {"unit_id": unit.unit_id, "create_request_id": nonce})
    v, state, items = initial, start(unit, params), []
    if not state.finished:
        state = next_question(state)
    assert trace(v["session_id"]) == trace_to_dict(trace_of(state))
    first_reply = first_payload = final_payload = None
    while not state.finished:
        safe(v)
        q = v["question"]
        item = next(i for i in unit.engine_items if i.item_id == q["item_id"])
        items.append(item.item_id)
        payload = {"step_index": q["step_index"], "item_id": item.item_id, "option_id": item.option_ids[policy(item)]}
        final_payload = payload
        v = browser.call(f'/api/diagnostic/sessions/{v["session_id"]}/answers', payload)
        if first_payload is None:
            first_payload, first_reply = payload, v
        state = answer(state, item.item_id, payload["option_id"])
        if not state.finished:
            state = next_question(state)
        assert trace(v["session_id"]) == trace_to_dict(trace_of(state))
    safe(v)
    sid = v["session_id"]
    assert browser.call(f"/api/diagnostic/sessions/{sid}") == v
    assert browser.call(f"/api/diagnostic/sessions/{sid}/answers", first_payload) == first_reply
    assert browser.call(f"/api/diagnostic/sessions/{sid}/answers", final_payload) == v
    assert browser.call("/api/diagnostic/sessions", {"unit_id": unit.unit_id, "create_request_id": nonce}) == initial
    assert len(trace(sid)["steps"]) == len(items)
    BrowserTransport().call(f"/api/diagnostic/sessions/{sid}", expected=404)
    return {"unit": unit.unit_id, "items": items, "rule": state.decision.rule, "outcome": state.decision.outcome.value}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all-policies", action="store_true")
    args = parser.parse_args()
    if not os.environ.get("SONDER_ENGINE_TOKEN"):
        parser.error("SONDER_ENGINE_TOKEN must match the running API")
    pack, params = load_maths_v2(), Params()
    browser = BrowserTransport()
    catalogue = browser.call("/api/diagnostic/units")
    assert [u["item_count"] for u in catalogue["units"]] == [20, 25, 10, 16, 10, 14, 16]
    results = []
    for unit, options in [("U1", "DBBA"), ("U4", "DA")]:
        iterator = iter(options)
        result = run(browser, pack.unit(unit), params, lambda item: item.option_ids.index(next(iterator)))
        results.append(result)
    assert results[0]["items"] == ["T1-005", "T1-006", "T1-007", "T1-009"]
    assert results[1]["items"] == ["T4-001", "T5-011"]
    for unit in pack.units:
        policies = [(h, lambda item, h=h: min(triggered_options(item, h), default=item.correct_index)) for h in unit.hyps[:-1]]
        policies += [(f"always-{i}", lambda item, i=i: i) for i in range(4)]
        policies += [("unlinked", lambda item: next((i for i, links in enumerate(item.links)
                       if i != item.correct_index and not links), item.correct_index))]
        for name, policy in (policies if args.all_policies else policies[-5:-4]):
            results.append({"policy": name, **run(browser, unit, params, policy)})
    nonce = str(uuid4())
    def parallel_begin(_):
        caller = BrowserTransport()
        v = caller.call("/api/diagnostic/sessions", {"unit_id": "U1", "create_request_id": nonce})
        return v, [(c.name, c.value, c.path) for c in caller.jar]
    with ThreadPoolExecutor(max_workers=4) as pool:
        replies = list(pool.map(parallel_begin, range(4)))
    assert all(reply == replies[0] for reply in replies)
    try:
        urlopen(UI + f'/api/diagnostic/sessions/{replies[0][0]["session_id"]}/trace', timeout=60)
        raise AssertionError("Trace route must not exist")
    except HTTPError as exc:
        assert exc.code == 404
    print(json.dumps({"transport": "real Next BFF + FastAPI HTTP; not browser automation",
                      "runs": len(results), "parallel_begin": "passed", "results": results}, indent=2))


if __name__ == "__main__":
    main()
