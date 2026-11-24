# Class and assignment contract

**Tasks:** I2-H09 to I2-H13 (classes, join codes, assignments, assignment starts) · **Provider:** Syed Ashher Majid (took over I2-H09–H13 from Harris by team agreement, 17 Nov 2026) · **Consumers:** the teacher and student dashboards, history and evidence (I2-A11–A19), Ahmed's persistent start (SESSION_CONTRACT §5.5) · **Reviewers:** Ahmed Laiq (class/access), Muhammad Harris Azhar (dashboards)

This is what the class, enrolment and assignment features guarantee to the screens and services that use them. The rules live in the database (migrations `0003`–`0007`) and are tested on PostgreSQL in `tests/test_product_*.py`. The browser reaches them only through the Next.js routes below, which take the account from the session (`withAccess`, [ACCESS_CONTRACT.md](ACCESS_CONTRACT.md)), never from the request.

## Data

| Table | Columns that matter | Rules |
| --- | --- | --- |
| `classroom` (Iteration 1) | `name`, `note`, `join_code`, `grade_level`, `status` active/archived | Created only with an active teacher and the MATH `class_subject` row |
| `class_teacher` (Iteration 1) | `class_id`, `teacher_id`, `status` active/departed | The creator is the class teacher; there are no co-teachers yet |
| `enrolment` (Iteration 1) | `class_id`, `student_id`, `status` active/left, `joined_at` | One row per student and class; removal sets `left`, rejoining sets `active` again |
| `class_assignment` (0005) | `class_id`, `unit_id` → `diagnostic_unit`, `title`, `status` open/closed, `attempt_rule` single/repeat, `created_by`, `created_at` | Unit of a **frozen** content version the class teaches; unit, class, rule and creator are fixed |
| `diagnostic_session.assignment_id` (0006) | nullable link to `class_assignment` | Same class as the enrolment, same unit as the session; fixed once written |

## Teacher routes

All need a signed-in active teacher. Every change also needs the same origin. A class or assignment that is not the teacher's, an unknown id and a malformed id are all **404**, so ids cannot be probed.

| Route | Body | Reply |
| --- | --- | --- |
| `GET /api/teacher/classes` | — | `{classes: TeacherClass[]}`, newest first |
| `POST /api/teacher/classes` | `{name, note?}` | `201 {class: TeacherClass}` |
| `GET /api/teacher/classes/[classId]` | — | `{class: TeacherClass}` |
| `PATCH /api/teacher/classes/[classId]` | `{status: "active" \| "archived"}` | `{class}` |
| `POST /api/teacher/classes/[classId]/join-code` | `{}` | `{class}` with a new code; the old code stops working |
| `GET /api/teacher/classes/[classId]/roster` | — | `{students: [{student_id, display_name, joined_at}]}` (no emails) |
| `DELETE /api/teacher/classes/[classId]/roster/[studentId]` | — | `{removed: true}` |
| `GET /api/teacher/classes/[classId]/assignments` | — | `{assignments: TeacherAssignment[]}`, newest first |
| `POST /api/teacher/classes/[classId]/assignments` | `{unit_id, title, attempt_rule?}` | `201 {assignment: TeacherAssignment}` |
| `PATCH /api/teacher/classes/[classId]/assignments/[assignmentId]` | `{status: "open" \| "closed"}` | `{assignment}` |
| `GET /api/teacher/units` | — | `{units: [{unit_id, name}], question_budget}` from the running diagnostic service |

`TeacherClass` = `{class_id, name, note, join_code, grade_level, status, student_count, created_at}`.
`TeacherAssignment` = `{assignment_id, class_id, title, unit_code, unit_name, version_code, status, attempt_rule, created_at}`.

**Which content version an assignment pins.** `POST .../assignments` asks the running diagnostic service for its release (`GET /engine/health`, label `<version_code>/<model_code>`) and assigns the unit with that code **in that version**. The browser never chooses the version. If the service cannot name a release, the reply is `503 assignments_unavailable`.

## Student routes

All need a signed-in active student.

| Route | Body | Reply |
| --- | --- | --- |
| `GET /api/student/classes` | — | `{classes: [{class_id, name, grade_level, teacher_names, joined_at}]}` (no join code) |
| `POST /api/student/classes` | `{code}` | `{class, joined}`; `joined: false` when already a member |
| `GET /api/student/assignments` | — | `{assignments: [{assignment_id, class_id, class_name, title, unit_code, unit_name, attempt_rule, created_at}]}`, open assignments of active classes only |

The student dashboard (`GET /api/student/dashboard`) also returns `assignment_status` (`open` or `closed`). A closed assignment stays listed, with Resume, while the student's latest attempt at it is in progress (answering stays possible after closing; only starting is refused); otherwise only open assignments are listed (migration 0013).

Student replies are rebuilt field by field. They never contain items, options, correct answers, posteriors, diagnoses or another student's data.

**Join codes.** A code is 10 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Case, spaces and hyphens are ignored when typed. An unknown code and an archived class's code both give `422 join_code_invalid`. There is no rate limit; a code has 32^10 possibilities.

## Starting an assignment

The student opens an assignment from **Your assignments** on `/student` or from the class page `/student/classes/[classId]`; both lead to `/student/diagnostic/[unitId]?assignment=<assignment_id>`, which starts through Ahmed's client with `assignment_id`. In PostgreSQL mode the start:

1. resolves the student's active enrolment in the assignment's active class (`sonder.assignment_enrolment`); the unit must be the assignment's unit; otherwise `404 assignment_not_found`;
2. answers an identical retry (same `create_request_id`) with its original reply, even if the assignment has closed since; the same key for another assignment, or without one, is `409 create_conflict`;
3. applies `sonder.check_assignment_start`, which locks the student's enrolment until the start commits:
   - `409 assignment_closed`: the teacher closed it;
   - `409 assignment_unavailable`: its unit is not in the release the service runs (for example after a content update);
   - `409 attempt_in_progress`: an unfinished attempt exists; resume it;
   - `409 attempt_limit_reached`: `single`, and the student has already attempted it;
4. stores `assignment_id` on the new session.

**Attempt rule.** `single` (default): one attempt per student; an unfinished one is resumed, never replaced. `repeat`: a new attempt may start once the last one is finished. A finished attempt is any status other than `in_progress`. A start without an assignment does not use up an assignment's attempt.

A start without `assignment_id` is refused at the browser boundary with `422 assignment_required` (product decision, 18 Nov 2026: every check belongs to an assignment). The service still accepts one for its contract harness and internal tools, with the D9 behaviour (`409 enrolment_ambiguous` for a student in two Maths classes).

## Errors

Every failure is `{"error": {"code": "<code>"}}`.

| Code | Status | When |
| --- | --- | --- |
| `invalid_request` | 422 | body is not a JSON object |
| `class_name_invalid`, `class_note_invalid` | 422 | name 1–80 characters, note at most 500, after trimming |
| `class_status_invalid`, `assignment_status_invalid` | 422 | status not one of the allowed values |
| `assignment_title_invalid`, `attempt_rule_invalid` | 422 | title 1–120 characters; rule `single` or `repeat` |
| `unit_not_found` | 422 | that unit code is not in the running release (or not one the class teaches) |
| `join_code_invalid` | 422 | unknown code or archived class |
| `class_archived` | 409 | assigning work to an archived class |
| `class_not_found`, `student_not_found`, `assignment_not_found` | 404 | not the caller's, unknown or malformed |
| `teacher_required`, `student_required` | 403 | the account lost its role or was deactivated during the request |
| `subject_missing` | 503 | the MATH subject row is missing (no content loaded yet) |
| `join_code_unavailable` | 503 | five code collisions in a row (practically never) |
| `assignments_unavailable`, `engine_unavailable`, `engine_timeout` | 503/504 | the diagnostic service cannot be reached or names no release |
| `authentication_required`, `role_required`, `invalid_origin`, `service_unavailable` | 401/403/403/503 | from the access layer |

## Limits

- No co-teachers, no rate limit on joining, no due dates or grades.
- Removing a student or archiving a class stops new starts in that class, but does not end an attempt already in progress.
- `abandoned` has no transition yet; if it gains one, an abandoned attempt counts as used under `single`.
- The memory-mode service has no classes and refuses any `assignment_id`.
