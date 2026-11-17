# Class and assignment flow checks

How to show that the class slice works on real records: a teacher creates a class, a student joins with its code, the teacher assigns a Maths unit, and the student starts, resumes and finishes it (I2-H09–H13). The contract being checked is [CLASS_ASSIGNMENT_CONTRACT.md](../api/CLASS_ASSIGNMENT_CONTRACT.md).

There are two checks. They complement each other.

| Check | What is real | Where it runs |
| --- | --- | --- |
| Automated database and HTTP checks (`tests/test_product_*.py`) | PostgreSQL 16 with every migration, Ahmed's frozen U1 development release, the persistent service over HTTP | Locally with Docker, and in CI (`persistence` job) |
| Live BFF harness (`scripts/check_class_flow.py`) plus the browser checklist | The Next.js routes, Neon Auth sign-in, the Neon development branch | Locally, by a team member with signed-in accounts |

The Next.js routes use the Neon serverless driver, which cannot reach a local Docker database. That is why the BFF half of the flow runs only against a Neon development branch.

## 1. Automated checks

From the repository root, with Docker running:

```sh
docker compose up -d --wait
SONDER_TEST_DATABASE_URL=postgresql://sonder:local-test-only@127.0.0.1:55432/sonder_test \
SONDER_REQUIRE_DB_TESTS=1 python -m unittest discover -s tests -p 'test_product_*.py' -v
docker compose down -v
```

`test_product_class_flow.py` is the whole story in one test: create, join (typed code), assign in the running release, start, retry, answer D1, refresh, second start refused, stored link and replay, one attempt only, outsiders denied, close, archive. The other files test each rule on its own.

## 2. Live BFF harness

Use a **development** Neon branch, never one with real records.

1. Configure the UI's `DATABASE_URL` and the Python service's `SONDER_DATABASE_URL` for that branch. Apply the migrations with `python -m sonder_db.migrate up` (adopt 0001/0002 first on a hand-built branch; see `db/migrations/README.md`).
2. Load the development release: `SONDER_ALLOW_DEV_SEED=true python -m sonder_api.devseed`.
3. Accounts:
   - A teacher: sign up, then `SONDER_ALLOW_ROLE_PROVISIONING=true node scripts/provision-role.mjs <email> teacher --confirm` from `Sonder-UI-master/`.
   - A student: sign up and complete onboarding. The student does **not** need the dev-seed class; the harness creates its own.
   - Optional: a second teacher and a second student, for the denial checks.
4. Start the API: `python -m sonder_api --store postgres --release Maths_v2-U1-dev/spec-v2-prior`. Start the UI on `http://localhost:3000`.
5. Sign in as each account in its own browser profile. Copy the full `Cookie` request header into private environment variables: `SONDER_HARNESS_TEACHER_COOKIE`, `SONDER_HARNESS_COOKIE`, and optionally `SONDER_HARNESS_OTHER_TEACHER_COOKIE` and `SONDER_HARNESS_OTHER_COOKIE`. Never commit them or paste them into a PR.
6. Run `python scripts/check_class_flow.py`. It prints a JSON record and exits 0 when every check passed. It archives its own class at the end.

## 3. Browser checklist

Record the date, commit, tester and result. Do not record credentials or cookies.

1. As the teacher, open **Classes**, create a class, and see the join code on its page.
2. As the student, open **Classes**, enter the code in lower case with a space, and see the class listed with the teacher's name. Enter it again and see "already in".
3. Enter a wrong code: "does not match an open class".
4. As the teacher, refresh the class page: the student is in **Students**. Assign the topic with "One attempt".
5. As the student, open `/student/diagnostic/U1?assignment=<id>` (the assignment id is in the teacher's network response, until the student dashboard lists assignments in I2-A16). Begin, answer two questions and refresh: the same question is shown.
6. Finish the check. Starting again shows "You have already done this assignment".
7. As the teacher, close the assignment. A second student who joins afterwards and opens the same link sees "Your teacher has closed this assignment".
8. Issue a new code: the old one is refused and the new one works. Remove a student: they disappear from **Students**. Archive the class: the join code is hidden and the student's **Classes** page no longer lists it.
9. As another teacher, open the first teacher's class URL: "Class not found".

## Results

| Date | Commit | Tester | Automated checks | Live harness | Browser checklist | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-18 | `e5440c3` (branch `ashher/i2-class-slice-checks`) | Ashher (run with Claude Code) | Pass: 60 product tests on PostgreSQL 16 with the U1 development release; Ahmed's 68 `test_persist_*` and 24 `test_engine_api` tests also pass | Not run yet | Not run yet | This machine has no Neon development branch or signed-in accounts configured (`Sonder-UI-master/.env.local` has no `DATABASE_URL`), so sections 2 and 3 are pending. Add a row when they are run. |
