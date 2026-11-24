"""Drive the teacher and student product path in a real browser (I2-A19, I2-A15).

The API harness (scripts/check_product_flow.py) checks the routes over HTTP; this one clicks
through the screens. It needs the Next.js app and the Python service running against the same
development database (docs/testing/PRODUCT_PATH_CHECKS.md), and Playwright:

    python -m pip install -e ".[browser-test]"
    python -m playwright install chromium          # or pass --channel msedge / chrome
    python scripts/check_product_browser.py [--ui http://localhost:3000] [--env-file PATH]
                                            [--channel msedge] [--screenshots DIR]

Sign-in details come from an env file (default Sonder-UI-master/.env.harness, gitignored) with
TEACHER_EMAIL, TEACHER_PASSWORD, STUDENT_EMAIL and STUDENT_PASSWORD; they are never printed.
It creates a class named "Browser check <time>", archives it at the end and prints a JSON record.
Exit code 0 means every check passed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import uuid
from pathlib import Path

FORBIDDEN = ("MATH-", "posterior", "probability", "diagnos", "misconception", "is_correct",
             "follow_up", "Follow-up", "Model confidence")
NOTE = "Browser check: talk through this at the next lesson."


class Failure(Exception):
    pass


def read_env(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ui", default="http://localhost:3000")
    parser.add_argument("--env-file", type=Path, default=Path(__file__).resolve().parents[1] / "Sonder-UI-master" / ".env.harness")
    parser.add_argument("--channel", help="browser channel, for example msedge or chrome (default: Playwright's Chromium)")
    parser.add_argument("--screenshots", type=Path, help="also save a screenshot of each screen here")
    args = parser.parse_args(argv)
    try:
        from playwright.sync_api import Error as PlaywrightError, expect, sync_playwright
    except ImportError:
        print('Install the browser extra: python -m pip install -e ".[browser-test]"', file=sys.stderr)
        return 2
    env = read_env(args.env_file) if args.env_file.exists() else {}
    keys = ("TEACHER_EMAIL", "TEACHER_PASSWORD", "STUDENT_EMAIL", "STUDENT_PASSWORD")
    if not all(env.get(k) for k in keys):
        print(f"{args.env_file} needs {', '.join(keys)}.", file=sys.stderr)
        return 2
    ui = args.ui.rstrip("/")
    head = {"Origin": ui, "Content-Type": "application/json"}
    record = {"transport": "real browser (Playwright) on the Next.js app and FastAPI service", "checks": [], "failures": []}
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)

    def require(condition, label):
        if not condition:
            raise Failure(label)
        record["checks"].append(label)

    def visible(page, text):
        return page.locator(f"text={text} >> visible=true").first

    def shot(page, name):
        if args.screenshots:
            page.wait_for_load_state("networkidle")
            page.screenshot(path=str(args.screenshots / f"{name}.png"), full_page=True)

    def student_safe(page, label):
        page.wait_for_load_state("networkidle")
        text = page.inner_text("body")
        found = [word for word in FORBIDDEN if word in text]
        require(not found, f"{label}: no result, probability or review on the page")

    def sign_in(context, email, password):
        page = context.new_page()
        page.goto(f"{ui}/auth/sign-in")
        page.fill("#sign-in-email", email)
        page.fill("#sign-in-password", password)
        page.locator("form button[type=submit]").click()
        page.wait_for_url(re.compile(r"/(teacher|student)(\?.*)?$"), timeout=60000)
        return page

    def answer_current(page):
        option = page.locator("button[aria-label^='A. ']").first
        expect(option).to_be_enabled(timeout=30000)
        option.click()
        page.wait_for_function("() => !document.body.innerText.includes('Saving your answer')", timeout=30000)

    class_id = None
    with sync_playwright() as p:
        browser = p.chromium.launch(**({"channel": args.channel} if args.channel else {}))
        tctx = browser.new_context(viewport={"width": 1280, "height": 860})
        sctx = browser.new_context(viewport={"width": 1280, "height": 860})
        try:
            teacher = sign_in(tctx, env["TEACHER_EMAIL"], env["TEACHER_PASSWORD"])
            student = sign_in(sctx, env["STUDENT_EMAIL"], env["STUDENT_PASSWORD"])
            require(True, "teacher and student sign in through the form")
            room = tctx.request.post(f"{ui}/api/teacher/classes", headers=head,
                                     data={"name": f"Browser check {time.strftime('%Y-%m-%d %H:%M:%S')}"}).json()["class"]
            class_id = room["class_id"]
            unit = tctx.request.get(f"{ui}/api/teacher/units").json()["units"][0]["unit_id"]
            assignment = tctx.request.post(f"{ui}/api/teacher/classes/{class_id}/assignments", headers=head,
                                           data={"unit_id": unit, "title": "Browser check", "attempt_rule": "single"}
                                           ).json()["assignment"]["assignment_id"]
            require(sctx.request.post(f"{ui}/api/student/classes", headers=head,
                                      data={"code": room["join_code"]}).json()["joined"], "student joins with the code")

            # Student: Start, answer one, reload, leave, Resume the same attempt, finish.
            student.goto(f"{ui}/student")
            link = student.locator(f"a[href*='assignment={assignment}'] >> visible=true").first
            expect(link).to_be_visible(timeout=30000)
            require(re.search("start", link.inner_text(), re.I) is not None, "dashboard offers Start")
            shot(student, "browser-01-dashboard-start")
            student_safe(student, "dashboard")
            link.click()
            student.get_by_role("button", name="Begin").click()
            expect(visible(student, "Question 1")).to_be_visible(timeout=30000)
            shot(student, "browser-02-question")
            student_safe(student, "question")
            answer_current(student)
            expect(visible(student, "Question 2")).to_be_visible(timeout=30000)
            stem = student.locator("h2").first.inner_text()
            student.reload()
            expect(visible(student, "Question 2")).to_be_visible(timeout=30000)
            require(student.locator("h2").first.inner_text() == stem, "a reload keeps the same pending question")

            student.goto(f"{ui}/student")
            resume = student.locator(f"a[href*='assignment={assignment}'] >> visible=true").first
            expect(resume).to_be_visible(timeout=30000)
            require(re.search("resume", resume.inner_text(), re.I) is not None,
                    "dashboard offers Resume for the unfinished attempt")
            resume.click()
            begin = student.get_by_role("button", name=re.compile("begin|continue", re.I))
            if begin.count() and begin.first.is_visible():
                begin.first.click()
            expect(visible(student, "Question 2")).to_be_visible(timeout=30000)
            require(student.locator("h2").first.inner_text() == stem, "Resume returns to the same attempt and question")
            for _ in range(10):
                if visible(student, "Check submitted").is_visible():
                    break
                answer_current(student)
            expect(visible(student, "Check submitted")).to_be_visible(timeout=30000)
            shot(student, "browser-03-submitted")
            student_safe(student, "completion")
            require(True, "the check finishes with a neutral completion")

            student.goto(f"{ui}/student")
            expect(visible(student, "Browser check")).to_be_visible(timeout=30000)
            student.wait_for_load_state("networkidle")
            require(student.locator(f"a[href*='assignment={assignment}'] >> visible=true").count() == 0,
                    "a single-attempt assignment offers no Start or Resume once submitted")
            student_safe(student, "dashboard after submitting")
            student.goto(f"{ui}/student/history")
            expect(visible(student, "Browser check")).to_be_visible(timeout=30000)
            require(visible(student, "Attempt 1").is_visible(), "history lists the attempt as Attempt 1")
            shot(student, "browser-04-history")
            student_safe(student, "history")

            # Teacher: queue -> evidence -> review through the form, kept after a reload.
            teacher.goto(f"{ui}/teacher")
            expect(visible(teacher, "Browser check")).to_be_visible(timeout=30000)
            require(True, "teacher queue lists the finished check")
            rows = [r for r in tctx.request.get(f"{ui}/api/teacher/queue").json()["rows"] if r["class_id"] == class_id]
            require(len(rows) == 1, "exactly one queue row for the class")
            session_id = rows[0]["session_id"]
            teacher.goto(f"{ui}/teacher/sessions/{session_id}")
            expect(visible(teacher, "Model confidence")).to_be_visible(timeout=30000)
            require(True, "evidence page shows the confidence sentence")
            shot(teacher, "browser-05-evidence")
            teacher.wait_for_load_state("networkidle")  # the form must be hydrated before typing into it
            follow_up = teacher.get_by_label("Follow-up required")
            follow_up.check()
            expect(follow_up).to_be_checked()
            note = teacher.get_by_label(re.compile("note", re.I))
            note.fill(NOTE)
            expect(note).to_have_value(NOTE)
            teacher.get_by_role("button", name=re.compile("save review", re.I)).click()
            expect(visible(teacher, "Saved.")).to_be_visible(timeout=30000)
            expect(visible(teacher, NOTE)).to_be_visible(timeout=30000)
            teacher.reload()
            expect(visible(teacher, NOTE)).to_be_visible(timeout=30000)
            require(visible(teacher, "revision 1").is_visible(), "the review is saved as revision 1 and kept after a reload")
            shot(teacher, "browser-06-review")

            # Student after the review: still no review, no result; teacher pages refused.
            student.goto(f"{ui}/student")
            student_safe(student, "dashboard after the review")
            student.goto(f"{ui}/teacher/sessions/{session_id}")
            student.wait_for_load_state("networkidle")
            require("Model confidence" not in student.inner_text("body") and NOTE not in student.inner_text("body"),
                    "a student cannot open the teacher evidence page")
        except (Failure, PlaywrightError, KeyError, ValueError, AssertionError) as exc:
            record["failures"].append(f"{type(exc).__name__}: {str(exc).splitlines()[0][:300]}")
            if args.screenshots:  # what each browser showed when the check stopped
                for name, context in (("teacher", tctx), ("student", sctx)):
                    for i, page in enumerate(context.pages):
                        page.screenshot(path=str(args.screenshots / f"failure-{name}-{i}.png"), full_page=True)
        finally:
            if class_id:
                archived = tctx.request.patch(f"{ui}/api/teacher/classes/{class_id}", headers=head, data={"status": "archived"})
                record["cleanup"] = "class archived" if archived.ok else f"archive failed ({archived.status})"
            browser.close()
    print(json.dumps(record, indent=2))
    return 0 if not record["failures"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
