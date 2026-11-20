# Review: persistent sessions, access and diagnostic client (Ahmed, I2-L01–L16)

**Reviewer:** Syed Ashher Majid · **Author:** Ahmed Laiq · **Date:** 18 November 2026
**Code reviewed:** `dev` at `1ad6348`. That includes PRs #52–#72 (persistence, contract v2, access, client, harness) and #80 (role change).
**Review duty:** work division §7. Persistent service: independent kill/restart, retry, conflict and replay checks. Persistent diagnostic client: refresh/retry/restart, and no leakage to students.

This review is based on building directly on the code, not on reading it alone. Part 1 (I2-H09–H13) and Part 2 (I2-A11–A19) both use the start/answer service, the migration runner, the access helpers, the BFF and the persisted evidence interface.

## 1. Independent checks I ran

| Check | How | Result |
| --- | --- | --- |
| Reproduce the persistent flow end to end | Ran `python scripts/check_persistent_flow.py --release Maths_v2-U1-dev/spec-v2-prior` myself on the Neon development branch, with my own signed-in test student, unchanged | **Pass: 34 checks, 0 failures.** Includes kill and restart of the API mid-run with the state preserved, D1 sequence `T1-005, T1-006, T1-007, T1-009`, stored evidence matching replay, and the development source hash `502895a9…` |
| Identical answer retry adds no evidence | Part of the harness run above, and `tests/test_product_assignment_store.py` | Pass |
| A conflicting answer for an accepted step is refused | Through the real BFF on Neon: answered step 0 with D, then sent A for step 0 | **Pass: `409 answer_conflict`**; the session then finished normally |
| Replay equals stored rows | `verify_session` in the harness, and in my tests on D1, NONE and a refusal (`tests/test_product_teacher_path.py`, budget-2 release) | Pass |
| Identical concurrent starts make one session | `tests/test_product_assignment_concurrency.py` (also with an assignment and the new enrolment lock) | Pass |
| No diagnosis, key or posterior reaches students | The harness's student-safe checks; my forbidden-word checks on every student route; the live product harness (35/35) | Pass |
| Browser refresh/retry | Ahmed's recorded Playwright checklist (17 Nov); Ashher's manual click-through of the screens on 18 Nov | Pass (manual) |

## 2. Issues found while building on it, and what happened

| # | Issue (with input) | Response | Status |
| --- | --- | --- | --- |
| 1 | **No account could become a teacher on a migration-built database.** The Iteration 1 `fixed_keys('id','role','created_at')` trigger on `app_user` made both the admin approval route and `scripts/provision-role.mjs` fail with `Immutable key app_user.role` (found on the Neon branch on 18 Nov). | Ahmed added `0008_app_user_role_change` (#80), which allows audited role changes. | **Resolved** |
| 2 | `scripts/provision-role.mjs` did not start on Node 25: `import { loadEnvConfig } from "@next/env"` fails because `@next/env` is CommonJS. | Fixed in #80 (default import, then destructure). | **Resolved** |
| 3 | `tests/test_persist_migrate.py` listed exactly two migrations, so any new migration broke it. | Changed to follow the manifest in #73 (Ashher). The adopt test now applies only the two hand-built migrations, then checks that later ones still apply. | **Resolved** |
| 4 | Starting from an assignment was impossible: any `assignment_id` returned `404` by design until the assignment schema existed ("PR 10"). | With Ahmed's agreement, Ashher wrote the link and the start rules (#76: migrations 0006/0007, `pgstore.create`). Ahmed's start transaction order and idempotency were kept; the extra check runs after the retry lookup. | **Resolved** |
| 5 | The BFF accepts only service error codes listed in `lib/diagnostic/validation.ts` `ERROR_STATUS`, with the exact status. A new service code otherwise reaches the page as `engine_unavailable`. This is safe by design, but easy to miss: it bit twice (the four assignment codes in #76, `session_not_found` in #82). | Codes added in those PRs. **Suggestion:** note in `SESSION_CONTRACT.md` §5.3 that a new code needs an `ERROR_STATUS` entry. | Open (suggestion) |
| 6 | Opened with `?assignment=`, the diagnostic page still offered "Continue" for *any* unfinished check of the topic, which could resume a different assignment's attempt. | Fixed in #86 (Ashher): with an assignment, the generic lookup is skipped; the dashboard links the exact session. | **Resolved** |
| 7 | Migration numbers clashed once (`0008`), because both of us added migrations in parallel. | Renumbered mine to 0009 (#84), per plan rule D-8. **Suggestion:** say in the PR title when a PR adds a migration. | Process note |

## 3. Things that worked well

- **Start and answer transactions** with request keys behaved exactly as the contract says, including under concurrency and a kill/restart.
- **Stored evidence** (`stored_evidence`, `verify_session`) was easy to build the teacher evidence service on, and replay checks are a strong guarantee.
- **The migration runner's** changed-file refusal and advisory lock made adding six migrations safe on a shared Neon branch.
- **`withAccess` and `requireAccess`** keep identity on the server; every new route used them unchanged.

## 4. Decision

Persistent service and diagnostic client: **accepted for Iteration 2 (G3 evidence)**, with two open suggestions (issues 5 and 7) that need no code change before release. Reproduction recorded in `docs/testing/PERSISTENT_FLOW_CHECKS.md`.
