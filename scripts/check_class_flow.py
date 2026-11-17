"""Exercise create -> join -> assign -> start -> finish through the real Next.js BFF (I2-H13).

Uses a development database only (see docs/testing/CLASS_ASSIGNMENT_FLOW_CHECKS.md). The Next.js UI and
the Python API must already be running against the same database. Signed-in browser cookies come from
environment variables and are never printed:

    SONDER_HARNESS_TEACHER_COOKIE        a signed-in teacher (required)
    SONDER_HARNESS_COOKIE                a signed-in student (required)
    SONDER_HARNESS_OTHER_TEACHER_COOKIE  another teacher (optional: cross-teacher denial)
    SONDER_HARNESS_OTHER_COOKIE          another student (optional: cross-student denial)
    SONDER_DATABASE_URL                  the same database (required: stored link and replay check)

    python scripts/check_class_flow.py [--ui http://localhost:3000]

It creates a class named "Harness class <time>", archives it at the end, and prints a JSON record.
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
import psycopg

from sonder_api.stored_evidence import verify_session


class FlowFailure(Exception):
    pass


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ui", default="http://localhost:3000")
    args = parser.parse_args(argv)
    env = {name: os.environ.get(name, "") for name in (
        "SONDER_HARNESS_TEACHER_COOKIE", "SONDER_HARNESS_COOKIE", "SONDER_HARNESS_OTHER_TEACHER_COOKIE",
        "SONDER_HARNESS_OTHER_COOKIE", "SONDER_DATABASE_URL")}
    if not (env["SONDER_HARNESS_TEACHER_COOKIE"] and env["SONDER_HARNESS_COOKIE"] and env["SONDER_DATABASE_URL"]):
        print("Set SONDER_HARNESS_TEACHER_COOKIE, SONDER_HARNESS_COOKIE and SONDER_DATABASE_URL.", file=sys.stderr)
        return 2

    ui = args.ui.rstrip("/")
    record = {"transport": "real Next BFF + FastAPI over HTTP; not browser automation", "class_id": None,
              "assignment_id": None, "session_id": None, "items": [], "checks": [], "failures": []}

    def require(condition, label):
        if not condition:
            raise FlowFailure(label)
        record["checks"].append(label)

    def call(cookie, method, path, body=None):
        return httpx.request(method, ui + path, headers={"Cookie": cookie, "Origin": ui}, json=body, timeout=30)

    teacher = lambda *a, **k: call(env["SONDER_HARNESS_TEACHER_COOKIE"], *a, **k)
    student = lambda *a, **k: call(env["SONDER_HARNESS_COOKIE"], *a, **k)

    def code_of(response):
        try:
            return response.json().get("error", {}).get("code")
        except ValueError:
            return None

    class_id = None
    try:
        # 1. The teacher creates a class.
        created = teacher("POST", "/api/teacher/classes", {"name": f"Harness class {time.strftime('%Y-%m-%d %H:%M:%S')}"})
        require(created.status_code == 201, "teacher creates a class")
        room = created.json()["class"]
        class_id = record["class_id"] = room["class_id"]
        require(teacher("GET", f"/api/teacher/classes/{class_id}").status_code == 200, "teacher reads the class")

        # 2. The student joins with the code as typed, twice.
        typed = f"{room['join_code'][:5].lower()} {room['join_code'][5:]}"
        joined = student("POST", "/api/student/classes", {"code": typed})
        require(joined.status_code == 200 and joined.json()["joined"] is True, "student joins with a typed code")
        require(student("POST", "/api/student/classes", {"code": room["join_code"]}).json()["joined"] is False,
                "joining again changes nothing")
        roster = teacher("GET", f"/api/teacher/classes/{class_id}/roster")
        require(roster.status_code == 200 and len(roster.json()["students"]) == 1, "roster shows the student")
        require(student("POST", "/api/student/classes", {"code": "WRONGCODE2"}).status_code == 422, "wrong code refused")

        # 3. The teacher assigns U1 from the units the running service offers.
        units = teacher("GET", "/api/teacher/units")
        require(units.status_code == 200 and any(u["unit_id"] == "U1" for u in units.json()["units"]), "U1 offered to teachers")
        assigned = teacher("POST", f"/api/teacher/classes/{class_id}/assignments",
                           {"unit_id": "U1", "title": "Harness rounding check", "attempt_rule": "single"})
        require(assigned.status_code == 201, "teacher assigns U1")
        assignment = record["assignment_id"] = assigned.json()["assignment"]["assignment_id"]
        listed = student("GET", "/api/student/assignments")
        require(listed.status_code == 200 and any(a["assignment_id"] == assignment for a in listed.json()["assignments"]),
                "student sees the assignment")

        # 4. The student starts from the assignment, retries, answers, refreshes and finishes.
        start = {"unit_id": "U1", "create_request_id": str(uuid4()), "assignment_id": assignment}
        first = student("POST", "/api/diagnostic/sessions", start)
        require(first.status_code == 200, "student starts the assignment")
        value = first.json()
        sid = record["session_id"] = value["session_id"]
        require(student("POST", "/api/diagnostic/sessions", start).json() == value, "identical start retry")
        for index, option in enumerate("DBBA"):
            question = value["question"]
            record["items"].append(question["item_id"])
            reply = student("POST", f"/api/diagnostic/sessions/{sid}/answers",
                            {"step_index": question["step_index"], "item_id": question["item_id"], "option_id": option})
            require(reply.status_code == 200, f"answer {index}")
            value = reply.json()
            if index == 0:
                require(student("GET", f"/api/diagnostic/sessions/{sid}").json() == value, "refresh keeps the pending question")
                again = student("POST", "/api/diagnostic/sessions", {**start, "create_request_id": str(uuid4())})
                require(again.status_code == 409 and code_of(again) == "attempt_in_progress", "second start while unfinished refused")
        require(value["status"] == "complete", "neutral completion")
        encoded = json.dumps(value)
        require("MATH-" not in encoded and "posterior" not in encoded and "outcome" not in encoded, "completion is student-safe")
        done = student("POST", "/api/diagnostic/sessions", {**start, "create_request_id": str(uuid4())})
        require(done.status_code == 409 and code_of(done) == "attempt_limit_reached", "one attempt only")

        # 5. The stored session is linked to the assignment and replays exactly.
        with psycopg.connect(env["SONDER_DATABASE_URL"]) as conn:
            row = conn.execute("SELECT assignment_id::text FROM sonder.diagnostic_session WHERE id = %s", (sid,)).fetchone()
            require(row is not None and row[0] == assignment, "stored session is linked to the assignment")
            require(verify_session(conn, sid) == [], "stored evidence matches replay")

        # 6. Other accounts see nothing (optional).
        if env["SONDER_HARNESS_OTHER_TEACHER_COOKIE"]:
            other = call(env["SONDER_HARNESS_OTHER_TEACHER_COOKIE"], "GET", f"/api/teacher/classes/{class_id}")
            require(other.status_code == 404, "another teacher cannot open the class")
        if env["SONDER_HARNESS_OTHER_COOKIE"]:
            other = call(env["SONDER_HARNESS_OTHER_COOKIE"], "POST", "/api/diagnostic/sessions",
                         {**start, "create_request_id": str(uuid4())})
            require(other.status_code == 404 and code_of(other) == "assignment_not_found",
                    "another student cannot start the assignment")

        # 7. Closing stops new starts; archiving hides the class (and is the clean-up).
        closed = teacher("PATCH", f"/api/teacher/classes/{class_id}/assignments/{assignment}", {"status": "closed"})
        require(closed.status_code == 200, "teacher closes the assignment")
        late = student("POST", "/api/diagnostic/sessions", {**start, "create_request_id": str(uuid4())})
        require(late.status_code == 409 and code_of(late) == "assignment_closed", "closed assignment cannot start")
    except (FlowFailure, httpx.HTTPError, psycopg.Error, KeyError, ValueError) as exc:
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
