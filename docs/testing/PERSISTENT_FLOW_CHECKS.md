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
| Not yet run | — | — | Not yet executed | Not yet executed | Requires a signed-in enrolled student and Neon development branch. |
