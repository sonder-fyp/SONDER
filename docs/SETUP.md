# Setup and reproducible checks

## 1. Prerequisites

Use Python 3.12 with pip (or Docker), Node 22 (see `Sonder-UI-master/.nvmrc`), and Docker with Compose for database tests. The test database is throwaway PostgreSQL 16 on `127.0.0.1:55432`.

## 2. Install

From the repository root:

```sh
python -m pip install -e '.[api,api-test,db]'
cd Sonder-UI-master && npm ci
```

## 3. Tests without a cloud service

From the repository root, then from the UI directory as shown:

```sh
docker compose up -d --wait
SONDER_TEST_DATABASE_URL=postgresql://sonder:local-test-only@127.0.0.1:55432/sonder_test python -m unittest discover -s tests -v
python docs/db/iteration1/tests/run_schema_tests.py
cd Sonder-UI-master
npm test && npm run lint && npm run build
cd ..
docker compose down -v
```

Persistence tests skip if `SONDER_TEST_DATABASE_URL` is unset; API tests skip without the `api` and `api-test` extras. Set `SONDER_REQUIRE_DB_TESTS=1` to make a missing database dependency or URL fail instead of skip.

## 4. Integrated development app

A Neon development branch is needed for Neon Auth and the UI `DATABASE_URL`. Copy the root and UI `.env.example` files to ignored `.env` and `.env.local` files and fill in your own values. Load the root environment in the service shell; never commit the filled files.

Run `python -m sonder_db.migrate status`. If the branch was already built by hand with the Iteration 1 schema and auth migration, run `python -m sonder_db.migrate adopt 0001_iteration1_schema 0002_auth_rbac` once; otherwise run `python -m sonder_db.migrate up` on an empty development database.

Until Harris's content importer (I2-H14) is available, run `SONDER_ALLOW_DEV_SEED=true python -m sonder_api.devseed`. Its content is a **development candidate**. After the importer lands, use Harris's documented import command and release name. For local development only, set `NEXT_PUBLIC_SONDER_DEV_SKIP_EMAIL_OTP=true` in `Sonder-UI-master/.env.local` so the email-code screen accepts any code (`lib/auth/devVerification.ts`; ignored in production builds). Remove the flag and the file before real users sign up. To create the first administrator, sign up and onboard an account as a student, then from `Sonder-UI-master/` with `.env.local` loaded run `SONDER_ALLOW_ROLE_PROVISIONING=true node scripts/provision-role.mjs <email> admin --confirm` (Node 20 or newer); provisioning also withdraws the account's pending access request. Provision demo accounts as described in [the access contract](api/ACCESS_CONTRACT.md#demo-accounts), then enrol the student with `SONDER_ALLOW_DEV_SEED=true python -m sonder_api.devseed --enrol-email <email>`.

## 5. Run

In separate terminals:

```sh
python -m sonder_api --store postgres --release "$SONDER_RELEASE"
cd Sonder-UI-master && npm run dev -- --port 3000
```

Memory mode is explicitly selected with `--store memory`; it loses sessions on service restart and is not a database fallback.

## 6. Verify

Run `python -m sonder_api.contract_check --base-url http://127.0.0.1:8000 --actor <student-a-id> --actor <student-b-id> --unit U1` with `SONDER_ENGINE_TOKEN` set. Run `python -m sonder_api.stored_evidence --all` to verify persisted evidence. See the [persistent flow harness and browser checklist](testing/PERSISTENT_FLOW_CHECKS.md) for the signed-in BFF path and restart check.

## 7. Troubleshooting

- `INVALID_ORIGIN`: open `http://localhost:3000`, or add the origin to the Neon Auth trusted domains; see the UI README.
- "We could not load diagnostics" or a BFF 503: the Next server cannot reach `SONDER_ENGINE_URL`. The URL is resolved from where Next runs. If Next runs in a container, `127.0.0.1` is the container itself: run the API in the same network namespace (`docker run --network container:<ui-container> ...`) or point `SONDER_ENGINE_URL` at an address the container can reach. Check with `curl -H "X-Sonder-Token: ..." $SONDER_ENGINE_URL/engine/health` from the same place Next runs.
- `invalid connection option "'postgresql://...`: the value is quoted, and `docker --env-file` keeps the quotes. Remove the quotes, or load the file with `set -a; . ./.env; set +a`.
- "Can't resolve 'shadcn/tailwind.css'" after reinstalling packages: stop `npm run dev`, delete `Sonder-UI-master/.next/dev`, then start it again. Never run `npm ci` while the dev server is running.
- `enrolment_required`: sign in as a student enrolled in an active Maths class, or enrol the development account as above.
- API exits at startup: check `SONDER_DATABASE_URL`, migrations, explicit `--store`, and the frozen release label.
- `replay_mismatch`: saved evidence disagrees with replay; preserve it and use the stored evidence verifier rather than creating a replacement attempt.
