# Teacher and student product requirements (Iteration 2)

**Task:** I2-D04 · **Owner:** Syed Ashher Majid · **Features:** teacher dashboard (F07, I2-A11), evidence read service and screen (F08, I2-A12–A13), review and follow-up tracking (F09, I2-A14), student dashboard and start/resume (F04, I2-A16–A17), history (F06, I2-A18); verification I2-A15, I2-A19 · **Reviewers:** Muhammad Harris Azhar (dashboards, evidence behaviour), Ahmed Laiq (access, review writes, history)

These are the rules every Part 2 screen and API is built and checked against. They build on the [class and assignment contract](../api/CLASS_ASSIGNMENT_CONTRACT.md), the [session contract](../api/SESSION_CONTRACT.md), the [access contract](../api/ACCESS_CONTRACT.md) and the [persisted evidence interface](../api/PERSISTED_EVIDENCE.md).

## 1. Rules that apply everywhere

1. **Identity comes from the session.** Every route takes the account from `withAccess`. A body or query field never chooses whose data is shown.
2. **Out of scope is "not found".** A class, session, assignment or student the caller may not see, an unknown id and a malformed id all return **404** with one code (`class_not_found`, `session_not_found`, `assignment_not_found`). A 403 is only for the wrong role.
3. **Teacher scope.** A teacher sees a session only if they are an **active class teacher** of the class of the session's enrolment. Departed teachers lose access.
4. **Stored records only.** Screens show what is stored in PostgreSQL. No fixture records, browser-local fallbacks or simulated results appear on a live route.
5. **No invented measures.** No mastery, score, grade, percentage correct or "learning progress" is derived from diagnostic confidence.
6. **Model confidence is not accuracy.** Wherever a probability is shown, the screen says: *"Model confidence under assumed parameters — not measured accuracy."*
7. **Reviewed is not released.** A teacher review records that a teacher looked and whether follow-up is needed. It never changes the engine's result, is never shown to the student as a verdict, and is labelled *"Reviewed is not approval for release."* Approving, correcting or releasing a diagnosis to a student is G5 and is not built in Iteration 2.

## 2. What a student may and may not see

Student responses are rebuilt field by field (as `student_view.py` and the class routes already do).

| Allowed | Never |
| --- | --- |
| Class name, teacher names, assignment title, unit name and code | Posteriors, probabilities, support counts |
| Attempt status: not started, in progress (answered n of budget), submitted | Diagnosis, misconception codes or names (`MATH-…`), refusal rule, tied set |
| Start and end dates, attempt number | Correct options, option-to-misconception mappings |
| Whether a teacher has looked at it (only the neutral flag in §5, if enabled) | Review status, review notes, other students' data |

Every student API test serialises the response and fails on any forbidden key or on the substrings `MATH-`, `posterior`, `probability`, `diagnos`, `misconception`, `is_correct`.

## 3. Teacher dashboard counts (I2-A11)

For a class, optionally one assignment. Each count has exactly one definition, shown as a tooltip.

| Count | Definition |
| --- | --- |
| **Students** | active enrolments in the class |
| **Assigned** | active enrolments × open assignments (or the selected assignment) |
| **Not started** | assigned pairs with no session linked to that assignment |
| **In progress** | pairs whose latest linked session is `in_progress` |
| **Completed** | pairs whose latest linked session has any finished status |
| **Needs review** | completed pairs whose latest session has no review |
| **Follow-up required** | pairs whose latest session's latest review is `follow_up_required` |

"Latest" means latest by `started_at`, then id. Counts are computed from the same rows the activity table lists, so a test can check that the counts equal the rows for every filter. Only sessions started from an assignment count; plain starts (no `assignment_id`, the retired self-start path) are listed as "Other checks" on the class page (`sonder.class_other_checks`), read-only.

## 4. Evidence screen (I2-A12, I2-A13)

The evidence of one session, for its class teacher. Contents:

- Header: student display name, class, assignment title (if any), unit, dates, status. Pinned release, content version, parameter hash and engine release.
- Hypotheses in slot order: name (misconception name, "No misconception" or "Something else"), kind, prior.
- For each question, in order:
  - the stem and the four options **from the session's pinned content version**;
  - which option the student chose, and what each option is linked to;
  - why the question was chosen (selection reason, expected information gain, runner-up candidates);
  - the probability of each hypothesis after the answer, and its support.
- Outcome: diagnosed (with candidates), none detected, or a refusal with its rule and tied set, in plain words.
- The confidence sentence from §1.6.

**Immutability:** the page shows stored evidence only. A newer content version or catalogue change never changes an old session's page; a test creates a second release and checks the old session still shows its own text.

## 5. Review and follow-up (I2-A14)

- States: **unreviewed** (no row), **reviewed**, **follow-up required**. A note of at most 2000 characters is optional.
- Each change appends a **new revision**; nothing is updated or deleted. Who and when are kept.
- A write names the revision it expects. If someone else wrote in between, it is refused (`409 review_conflict`). An identical retry with the same request key returns the same revision.
- Only finished sessions can be reviewed; only by their class teacher.
- Students do not see review status or notes. A neutral "Your teacher has looked at this" flag is allowed but **off by default** (decision D-7; switch on only with team agreement).

**Teacher home queue** (`sonder.teacher_queue`, migration 0013): finished checks waiting for the teacher across all their active classes: the latest attempt of each (student, assignment), for open and closed assignments, plus checks started without an assignment, whose latest review is missing ("Needs review") or `follow_up_required` ("Follow-up required"). Only active classes and active enrolments count; in-progress work is not listed. An evidence page lists every attempt at the assignment (`sonder.session_attempts`).

## 6. Student dashboard, start and resume (I2-A16, I2-A17)

- Lists the student's classes and each open assignment with one action:
  - **Start**: no attempt yet, or `repeat` and the last attempt is finished;
  - **Resume**: an attempt is in progress (goes to that session, never creates a new one);
  - **Done**: `single` and attempted (no action).
- Start only from an assignment (a start without one is refused, `assignment_required`). A closed assignment with an in-progress attempt stays listed with Resume.
- Start uses Ahmed's start contract with `assignment_id` and a fresh `create_request_id`; a double click cannot create two attempts (one request key per click, and the database lock).
- Errors are explained without exposing teacher data: closed, no longer offered, already in progress, already done, service down.

## 7. History (I2-A18)

- The student's own attempts: unit, assignment (if any), class, started/ended dates, answered n of budget, status (in progress / submitted), and "Attempt k" per assignment.
- An unfinished attempt has a Resume link. Another student's attempt is 404.
- No scores, percentages or diagnosis.

## 8. Acceptance checks

| # | Check | Feature |
| --- | --- | --- |
| A1 | Dashboard counts equal the activity rows for each filter, on real records | A11, A15 |
| A2 | Another teacher, a departed teacher, a student and malformed ids get 404/403 on every teacher route | A11–A15 |
| A3 | Evidence page shows the pinned version's text after a newer version exists | A12, A13 |
| A4 | Evidence for D1 (diagnosed), NONE and a refusal reads correctly and matches `verify_session` | A12, A15 |
| A5 | Review revisions append; stale writes are refused; identical retries return the same revision; reviews survive a service restart | A14, A15 |
| A6 | Reviews never change `diagnosis`/`escalation` and never reach student responses | A14, A19 |
| A7 | Student dashboard shows Start / Resume / Done correctly for single and repeat assignments | A16, A17 |
| A8 | Double start makes one attempt; Resume returns the same session | A17, A19 |
| A9 | History lists only the student's own attempts with correct attempt numbers; no forbidden fields | A18, A19 |
| A10 | Loading, empty and error states exist on every new screen | all |
