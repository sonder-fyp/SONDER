# Teacher and student product path checks

How to show that the teacher and student features of Iteration 2 work on real records (I2-A15, I2-A19), against the [requirements and acceptance checks](../design/I2_TEACHER_STUDENT_REQUIREMENTS.md). Covered features:
- the teacher dashboard (I2-A11)
- evidence (I2-A12–A13)
- reviews (I2-A14)
- the student dashboard, start and resume (I2-A16–A17)
- history (I2-A18)

The class and assignment checks are in [CLASS_ASSIGNMENT_FLOW_CHECKS.md](CLASS_ASSIGNMENT_FLOW_CHECKS.md).

| Check | What is real | Where |
| --- | --- | --- |
| Database and service tests (`tests/test_product_*.py`) | PostgreSQL 16 with every migration, Ahmed's U1 development release (and a budget-2 release for refusals), the persistent service | Docker locally, and CI (`persistence` job) |
| Route and component tests (`npm test`) | The Next.js routes and screens with the database and service mocked | Locally and CI (`ci` job) |
| Live BFF harness (`scripts/check_product_flow.py`) | The Next.js routes, Neon Auth, the Neon development branch, the Python service | Locally, with signed-in accounts |

## Acceptance checks and where each is shown

| # | Check | Shown by |
| --- | --- | --- |
| A1 | Dashboard counts equal the activity rows for each filter | `lib/teacher/activity.test.ts` (same test for counts and filter); `test_product_teacher_path.py` (rows equal stored attempts) |
| A2 | Other teachers, students and malformed ids get 404/403 on teacher routes | `test_product_teacher_path.py`, `test_product_student_privacy.py`, route tests, live harness |
| A3 | Evidence shows the pinned version's text after a newer version exists | `test_product_evidence.py` |
| A4 | Diagnosed, NONE and refusal evidence reads correctly and replays | `test_product_teacher_path.py` |
| A5 | Reviews append; stale writes refused; identical retries; survive a service restart | `test_product_reviews.py`, `test_product_teacher_path.py`, live harness |
| A6 | Reviews never change the result and never reach students | `test_product_reviews.py`, `test_product_student_privacy.py`, live harness |
| A7 | Start / Resume / Done for single and repeat assignments | `lib/student/dashboard.test.ts`, `test_product_student_dashboard.py`, live harness |
| A8 | Double start makes one attempt; Resume returns the same session | `test_product_assignment_concurrency.py`, `test_product_student_privacy.py`, live harness |
| A9 | History shows only own attempts with attempt numbers; no forbidden fields | `test_product_history.py`, `test_product_student_privacy.py`, history route test |
| A11 | Teacher home queue lists finished latest attempts (open and closed assignments, assignment-less checks); review removes, follow-up keeps | `test_product_flow_queue.py`, `lib/teacher/queue.test.ts`, `components/teacher/TeacherQueue.test.tsx`, queue route test |
| A12 | "Other checks" lists a class's assignment-less sessions, read-only | `test_product_flow_other_checks.py`, `OtherChecks.test.tsx`, other-checks route test |
| A13 | A teacher can open every attempt at a repeat assignment | `test_product_flow_attempts.py`, `AttemptList.test.tsx`, attempts route test |
| A14 | A closed assignment stays resumable while an attempt is in progress | `test_product_student_dashboard.py`, `lib/student/dashboard.test.ts`, `StudentAssignments.test.tsx` |
| A15 | A start without an assignment is refused (`assignment_required`); the page redirects to `/student` | `lib/diagnostic/routes.test.ts`, `app/student/diagnostic/[unitId]/page.test.tsx`, `app/student/start/page.test.tsx` |
| A10 | Loading, empty and error states on every new screen | Component tests of each screen |

## Running the live harness

Use the same development set-up as the class flow check (section 2 of [CLASS_ASSIGNMENT_FLOW_CHECKS.md](CLASS_ASSIGNMENT_FLOW_CHECKS.md)): migrations applied, the development release loaded, a teacher and a student account, and the UI and API running. Then:

```sh
SONDER_HARNESS_TEACHER_COOKIE='…' SONDER_HARNESS_COOKIE='…' python scripts/check_product_flow.py
```

Optional `SONDER_HARNESS_OTHER_TEACHER_COOKIE` and `SONDER_HARNESS_OTHER_COOKIE` add cross-account denial. The harness archives the class it creates.

## Results

| Date | Commit | Tester | Automated | Live harness | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-11-18 | branch `ashher/i2-product-path-checks` (on `dev` after #86) | Ashher (run with Claude Code) | Pass: all `tests/test_product_*.py` on PostgreSQL 16 and `npm test` | **Pass: 35 checks, 0 failures** | See the record below. No second teacher or student cookie, so the optional cross-account checks did not run; cross-account denial is covered by the automated tests. |

## Recorded run: 18 November 2026

Environment: the Neon development branch with migrations 0001–0012, release `Maths_v2-U1-dev/spec-v2-prior`, the Python service with `--store postgres`, and the Next.js dev server on `http://localhost:3000`. It used the test teacher and student accounts. No credentials or cookies are recorded.

All 35 checks passed:
- **Student dashboard:** Start, one attempt from a double start, Resume of the same attempt, a second attempt refused.
- **Teacher, during the check:** activity in progress; evidence of the unfinished check; a review refused while unfinished.
- **After finishing:** the student finishes; the dashboard shows Done; history lists attempt 1; evidence of the finished D1 check (`T1-005`, `T1-006`, `T1-007`, `T1-009`); activity completed and needs review.
- **Review:** saved; identical retry; stale review refused; activity now follow-up required; the result unchanged.
- **Privacy:** every student reply is free of result and review words (dashboard four times, history once, dashboard after the review).
- **Access:** the student is refused from the evidence, review and activity routes; unknown and malformed session ids are 404.
- **Clean-up:** class archived.

Each step was also tried manually through the same routes on the same branch while it was built: evidence, reviews (including a stale write refused with `review_conflict`), class activity, the student dashboard and history.

## Manual browser check

On 18 November 2026 Ashher clicked through the teacher and student screens in a browser on the Neon development branch and reported that they looked and behaved normally. This is a manual check, recorded as reported; it is not scripted.

## Not covered here

- **Scripted browser automation** is not part of these checks. The screens are covered by component tests, the API path by the live harness, and the screens by the manual check above. The student browser script that was held back before login existed (`git stash`, "PR-0 browser check held…") was not updated for sign-in.

The demo teacher popup and `/engine/latest` (from PR #44) were retired with Ahmed's agreement; teachers use the class-scoped evidence page.
