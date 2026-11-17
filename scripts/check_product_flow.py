"""Exercise the teacher and student product path through the real Next.js BFF (I2-A15, I2-A19).

Uses a development database only (docs/testing/PRODUCT_PATH_CHECKS.md). The UI and the Python API must
already run against the same database. Cookies come from environment variables and are never printed:

    SONDER_HARNESS_TEACHER_COOKIE        a signed-in teacher (required)
    SONDER_HARNESS_COOKIE                a signed-in student (required)
    SONDER_HARNESS_OTHER_TEACHER_COOKIE  another teacher (optional: cross-teacher denial)
    SONDER_HARNESS_OTHER_COOKIE          another student (optional: cross-student denial)

    python scripts/check_product_flow.py [--ui http://localhost:3000]

It creates a class named "Product check <time>", archives it at the end and prints a JSON record.
Exit code 0 means every check passed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from uuid import uuid4

import httpx

FORBIDDEN = ("MATH-", "posterior", "probability", "diagnos", "misconception", "is_correct", "review", "follow_up")


class FlowFailure(Exception):
    pass


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ui", default="http://localhost:3000")
    args = parser.parse_args(argv)
    env = {k: os.environ.get(k, "") for k in ("SONDER_HARNESS_TEACHER_COOKIE", "SONDER_HARNESS_COOKIE",
                                              "SONDER_HARNESS_OTHER_TEACHER_COOKIE", "SONDER_HARNESS_OTHER_COOKIE")}
    if not (env["SONDER_HARNESS_TEACHER_COOKIE"] and env["SONDER_HARNESS_COOKIE"]):
        print("Set SONDER_HARNESS_TEACHER_COOKIE and SONDER_HARNESS_COOKIE.", file=sys.stderr)
        return 2
    ui = args.ui.rstrip("/")
    record = {"transport": "real Next BFF + FastAPI over HTTP; not browser automation", "checks": [], "failures": []}

    def require(condition, label):
        if not condition:
            raise FlowFailure(label)
        record["checks"].append(label)

    def call(cookie, method, path, body=None):
        return httpx.request(method, ui + path, headers={"Cookie": cookie, "Origin": ui}, json=body, timeout=60)

    teacher = lambda *a: call(env["SONDER_HARNESS_TEACHER_COOKIE"], *a)
    student = lambda *a: call(env["SONDER_HARNESS_COOKIE"], *a)
    code_of = lambda r: (r.json().get("error") or {}).get("code") if r.headers.get("content-type", "").startswith("application/json") else None

    def safe(response, label):
        require(response.status_code == 200, f"{label}: 200")
        text = response.text
        require(not any(word in text for word in FORBIDDEN), f"{label}: no result or review words")
        return response.json()

    class_id = None
    try:
        room = teacher("POST", "/api/teacher/classes", {"name": f"Product check {time.strftime('%Y-%m-%d %H:%M:%S')}"}).json()["class"]
        class_id = room["class_id"]
        require(student("POST", "/api/student/classes", {"code": room["join_code"]}).json()["joined"], "student joins")
        assignment = teacher("POST", f"/api/teacher/classes/{class_id}/assignments",
                             {"unit_id": "U1", "title": "Product check", "attempt_rule": "single"}).json()["assignment"]["assignment_id"]

        # Student dashboard: Start -> Resume -> Done, never a second attempt.
        card = lambda: next(c for c in safe(student("GET", "/api/student/dashboard"), "student dashboard")["assignments"]
                            if c["assignment_id"] == assignment)
        require(card()["latest_state"] is None, "dashboard offers Start")
        start = {"unit_id": "U1", "create_request_id": str(uuid4()), "assignment_id": assignment}
        value = student("POST", "/api/diagnostic/sessions", start).json()
        sid = value["session_id"]
        require(student("POST", "/api/diagnostic/sessions", start).json()["session_id"] == sid, "double start makes one attempt")
        q = value["question"]
        value = student("POST", f"/api/diagnostic/sessions/{sid}/answers",
                        {"step_index": q["step_index"], "item_id": q["item_id"], "option_id": "D"}).json()
        require(card()["latest_state"] == "in_progress" and card()["latest_session_id"] == sid, "dashboard offers Resume of the same attempt")
        again = student("POST", "/api/diagnostic/sessions", {**start, "create_request_id": str(uuid4())})
        require(again.status_code == 409 and code_of(again) == "attempt_in_progress", "a second attempt is refused")

        # Teacher: activity mid-way, evidence of an unfinished check, review refused until finished.
        rows = teacher("GET", f"/api/teacher/classes/{class_id}/activity").json()["rows"]
        require(len(rows) == 1 and rows[0]["state"] == "in_progress" and rows[0]["answered"] == 1, "activity shows in progress")
        unfinished = teacher("GET", f"/api/teacher/sessions/{sid}/evidence").json()["evidence"]
        require(unfinished["outcome"]["outcome"] == "in_progress" and len(unfinished["questions"]) == 2, "evidence of an unfinished check")
        early = teacher("POST", f"/api/teacher/sessions/{sid}/reviews",
                        {"expected_revision": 0, "status": "reviewed", "note": "", "request_key": str(uuid4())})
        require(early.status_code == 409 and code_of(early) == "session_unfinished", "unfinished check cannot be reviewed")

        for option in "BBA":
            q = value["question"]
            value = student("POST", f"/api/diagnostic/sessions/{sid}/answers",
                            {"step_index": q["step_index"], "item_id": q["item_id"], "option_id": option}).json()
        require(value["status"] == "complete", "student finishes")
        require(card()["latest_state"] == "submitted", "dashboard shows Done")
        history = safe(student("GET", "/api/student/history"), "student history")["history"]
        require(any(h["session_id"] == sid and h["attempt_number"] == 1 for h in history), "history lists the attempt")

        evidence = teacher("GET", f"/api/teacher/sessions/{sid}/evidence").json()["evidence"]
        require(evidence["outcome"]["outcome"] == "diagnosed" and [x["item_id"] for x in evidence["steps"]] ==
                ["T1-005", "T1-006", "T1-007", "T1-009"], "evidence of the finished D1 check")
        rows = teacher("GET", f"/api/teacher/classes/{class_id}/activity").json()["rows"]
        require(rows[0]["state"] == "completed" and rows[0]["review_status"] is None, "activity: completed, needs review")

        key = str(uuid4())
        body = {"expected_revision": 0, "status": "follow_up_required", "note": "Product check", "request_key": key}
        saved = teacher("POST", f"/api/teacher/sessions/{sid}/reviews", body)
        require(saved.status_code == 201 and [r["revision"] for r in saved.json()["reviews"]] == [1], "review saved")
        require(len(teacher("POST", f"/api/teacher/sessions/{sid}/reviews", body).json()["reviews"]) == 1, "identical review retry")
        stale = teacher("POST", f"/api/teacher/sessions/{sid}/reviews", {**body, "request_key": str(uuid4())})
        require(stale.status_code == 409 and code_of(stale) == "review_conflict", "stale review refused")
        rows = teacher("GET", f"/api/teacher/classes/{class_id}/activity").json()["rows"]
        require(rows[0]["review_status"] == "follow_up_required", "activity: follow-up required")
        require(teacher("GET", f"/api/teacher/sessions/{sid}/evidence").json()["evidence"]["outcome"] == evidence["outcome"],
                "review leaves the result unchanged")
        safe(student("GET", "/api/student/dashboard"), "student dashboard after review")

        # Access boundaries.
        for path in (f"/api/teacher/sessions/{sid}/evidence", f"/api/teacher/sessions/{sid}/reviews",
                     f"/api/teacher/classes/{class_id}/activity"):
            require(student("GET", path).status_code == 403, f"student refused {path.split('/')[3]} route")
        for bad in ("not-a-uuid", "00000000-0000-4000-8000-000000000000"):
            require(teacher("GET", f"/api/teacher/sessions/{bad}/evidence").status_code == 404, f"unknown session id {bad[:8]} is 404")
        if env["SONDER_HARNESS_OTHER_TEACHER_COOKIE"]:
            other = env["SONDER_HARNESS_OTHER_TEACHER_COOKIE"]
            require(call(other, "GET", f"/api/teacher/sessions/{sid}/evidence").status_code == 404, "another teacher: evidence 404")
            require(call(other, "GET", f"/api/teacher/classes/{class_id}/activity").status_code == 404, "another teacher: activity 404")
        if env["SONDER_HARNESS_OTHER_COOKIE"]:
            require(call(env["SONDER_HARNESS_OTHER_COOKIE"], "GET", f"/api/diagnostic/sessions/{sid}").status_code == 404,
                    "another student cannot open the attempt")
    except (FlowFailure, httpx.HTTPError, KeyError, ValueError, StopIteration) as exc:
        record["failures"].append(f"{type(exc).__name__}: {exc}")
    finally:
        if class_id:
            try:
                archived = teacher("PATCH", f"/api/teacher/classes/{class_id}", {"status": "archived"})
                record["cleanup"] = "class archived" if archived.status_code == 200 else f"archive failed ({archived.status_code})"
            except httpx.HTTPError as exc:
                record["cleanup"] = f"archive failed ({type(exc).__name__})"
    print(json.dumps(record, indent=2))
    return 0 if not record["failures"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
