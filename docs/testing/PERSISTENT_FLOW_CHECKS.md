# Persistent flow checks

The harness uses the real Next.js BFF and FastAPI over HTTP. It is not browser automation. Use a **development database**, never one holding real records. The U1 seed is a development candidate.

## Prerequisites and command

1. Configure a Neon development branch for both the UI's `DATABASE_URL` and the Python service's `SONDER_DATABASE_URL`. Apply migrations with `python -m sonder_db.migrate up`, or adopt the existing Iteration 1 and auth migrations first as described in `db/migrations/README.md`.
2. Enable and run the development seed, then enrol the existing onboarded student with `SONDER_ALLOW_DEV_SEED=true python -m sonder_api.devseed --enrol-email <student-email>`. Configure the UI in its ignored `.env.local` and start it on `http://localhost:3000` (the origin Neon Auth trusts by default).
3. Sign in as that student. Copy the complete `Cookie` request-header value from browser developer tools into `SONDER_HARNESS_COOKIE` in a private terminal. Optionally set `SONDER_HARNESS_OTHER_COOKIE` to a second signed-in student's full cookie to check cross-student access. Never commit or paste these cookies in a PR.
4. Stop any Python API process on port 8000. With `SONDER_DATABASE_URL`, `SONDER_ENGINE_TOKEN`, and `SONDER_HARNESS_COOKIE` set, run from the repository root:

   ```sh
   python scripts/check_persistent_flow.py --release Maths_v2-U1-dev/spec-v2-prior
   ```

The harness starts and owns the API process, checks start and answer retries, refresh, SIGKILL and restart, D1 completion, row evidence, replay, student-safe responses and the development candidate source hash. It requires no unfinished U1 run for the student; finish or abandon an existing one first. It prints a JSON record and exits 0 on success. The optional second cookie adds cross-student denial. It never prints cookies.

## Manual browser checklist

Record date, commit, tester and result for each run; do not record credentials or cookies.

1. Sign in as an enrolled student; open `/student/diagnostic/U1`, Begin and answer two questions.
2. Refresh: the same pending question appears.
3. Navigate to `/student`, return to `/student/diagnostic/U1` without `?session=`, and select Continue: the same question appears.
4. Stop the Python service, select an option, and check the save error and Retry. Restart the service and Retry: the answer is accepted once. Check the step count with `python -m sonder_api.stored_evidence --session <id>`.
5. Double-click an option quickly: one step is stored.
6. Finish: completion is neutral; page source and network responses contain no `MATH-`, outcome or probabilities.
7. Sign out and reload the run URL: the sign-in page appears and the API returns 401.
8. Sign in as a second student and open the first student's run URL: the check is unavailable.

| Date | Commit | Tester | HTTP harness | Browser checklist | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-11-17 | `fb7d044` (tip of #62; includes #52 to #62) | Ahmed signed in; Claude drove the browser (Playwright) | Not run (needs a copied session cookie) | Partly run: see the record below | Neon development branch, release `Maths_v2-U1-dev/spec-v2-prior`, engine `0.1.0+fbe0204a623d` |

## Recorded run: 17 November 2026

Environment: Neon development branch (about 0.4 s round trip from the test machine), Python service with `--store postgres`, Next.js dev server on `http://localhost:3000`, Chrome. The service and UI ran from commit `fb7d044`, so this run does **not** include the follow-up fixes in #63 to #69. Two students were enrolled in the development class with `devseed --enrol-email`. No credentials or cookies are recorded here.

| # | Checklist item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Enrolled student begins U1 and answers two questions | Pass | Items T1-005, T1-006 shown for answers D, B |
| 2 | Refresh keeps the pending question | Pass | Reload on `?session=<id>` after one answer resumed at question 2 |
| 3 | Leave, return without `?session=`, select Continue | Not run | |
| 4 | Service stopped during a save: error and Retry | Partly | The service was restarted twice between answers and the next answer was accepted each time (question 3 was T1-007). The error and Retry screen was not exercised. |
| 5 | Double-click stores one step | Not run | Duplicate and conflicting answers were checked at the service level only (identical reply; `409 answer_conflict`) |
| 6 | Finish is neutral | Partly | Completion screen shows no outcome or score. Page source and network responses were not inspected for `MATH-` or probabilities. |
| 7 | Sign out, reload the run URL | Not run | |
| 8 | Second student opens the first student's run URL | Pass | `GET /api/diagnostic/sessions/<id>` returned 404 and the page said "This check is unavailable"; no question content was shown |

Additional checks made in the same run:

- **Full diagnostic:** answers D, B, B, A gave T1-005, T1-006, T1-007, T1-009 and a finished session after 4 answers (status `diagnosed`).
- **Budget:** answers A, C, A, C, A, C, A, C went to the full 8 questions and finished as `escalated_exhausted`. This sequence was found with the in-memory service before the browser run.
- **Run again:** returns to the intro screen; Begin creates a new session and the earlier one stays finished.
- **Stored evidence:** `python -m sonder_api.stored_evidence --all` reported 5 checked, 5 matching, 0 mismatched.
- **Not run:** the HTTP harness `scripts/check_persistent_flow.py`, which needs the signed-in student's `Cookie` header.

Problems found during the run (each has its own pull request):

| Finding | Pull request |
| --- | --- |
| Database URL and password printed in a migration error message | #63 |
| `127.0.0.1` rejected by Neon Auth, with a misleading "check your details" message | #64 |
| Reads cost 4 to 5 round trips; answers still cost about 11 | #65 |
| Landing page `THREE.Clock` deprecation warning | #66 |
| Errors thrown by the Neon client were not classified; theme view-transition rejection shown as a Next.js issue | #67 |
| Editable address on the one-time-code page | #68 |
| Unverified user could not sign out | #69 |
| Dev server served a stale compiled file after files changed on disk (`answersSaved is not defined`); fixed by clearing `.next/dev` and restarting. This is a local development issue, not a product defect. | Troubleshooting entry in `docs/SETUP.md` (#64) |
