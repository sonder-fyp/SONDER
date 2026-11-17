# Engine session API contract, version 2

**Task:** I2-L01 · **Provider:** Ahmed Laiq · **Consumers:** Ahmed's diagnostic client (I2-L11), Ashher's dashboards/evidence (I2-A11–A19), Harris's assignment start linkage (I2-H12)  
**Runnable harness:** `python -m sonder_api.contract_check` (§ Harness)

### 5.1 Parties and trust

- **Browser → Next.js BFF** (`/api/diagnostic/*`): authenticated by the Neon Auth session cookie; role from `sonder.app_user` (`requireApiRole`). Mutations require the configured same origin (`SONDER_UI_ORIGIN`, default `http://localhost:3000`, plus the other loopback name, `localhost` or `127.0.0.1`, on the same port).
- **BFF → Python service** (`/engine/*`, loopback only): `X-Sonder-Token` (≥ 32 characters, constant-time compare) on every request. Session operations also carry `X-Sonder-Actor`: the **application account ID** (`sonder.app_user.id`, lower-case canonical UUID). The service trusts the actor only because the token proves the caller is the BFF. Browsers never reach the Python service and never set the actor.
- **Internal readers** (`/engine/sessions/{id}/trace`, `/engine/latest`): token only, no actor; never proxied to students.

### 5.2 Endpoints

| Method and path | Headers | Body / query | Success |
|---|---|---|---|
| `GET /engine/health` | token | — | `{"contract_version":2,"mode":"postgres"\|"in_memory","ready":true,"release":"<label>"\|null,"engine_release":"<code>"\|null}` |
| `GET /engine/units` | token | — | `{"contract_version":2,"subject":str,"question_budget":int,"units":[{"unit_id","name","item_count"}]}` |
| `POST /engine/sessions` | token, actor | `{"unit_id":str≤32,"create_request_id":UUIDv4,"assignment_id"?:UUID\|null}` | Snapshot |
| `GET /engine/sessions` | token, actor | query `status=in_progress\|complete` (optional), `unit_id` (optional) | `{"contract_version":2,"sessions":[SessionSummary]}` newest first, at most 50 |
| `GET /engine/sessions/{id}` | token, actor | — | Snapshot (never advances) |
| `POST /engine/sessions/{id}/answers` | token, actor | `{"step_index":int 0..1000,"item_id":str≤64,"option_id":"A"\|"B"\|"C"\|"D"}` | Snapshot |
| `GET /engine/sessions/{id}/trace` | token | — | `{"trace":Trace,"hypothesis_names":{id:name}}` |
| `GET /engine/latest` | token | — | `{"session_id","finished_seq","unit":{...},"trace","hypothesis_names"}` (teacher demo notice; kept from PR #44) |

Request bodies are strict: unknown fields, type coercion (`"0"` for `0`, `true` for `0`), and bodies over 4096 bytes → `422 invalid_request`. Every response has `Cache-Control: no-store`. `/docs`, `/redoc`, `/openapi.json` are disabled.

**Snapshot** (student-safe; exactly these keys):
```json
{"contract_version":2,"session_id":"<uuid4>","unit":{"unit_id":"U1","name":"Rounding"},
 "question_budget":8,"answered_count":0,"status":"in_progress",
 "question":{"step_index":0,"item_id":"T1-005","stem":"…","options":[{"option_id":"A","text":"…"},…]}}
```
When `status` is `"complete"`, `question` is `null`. A snapshot **never** contains the diagnosis, outcome, rule, posterior, support, correct option, misconception IDs, or candidate ranking.

**SessionSummary** (student-safe; for resume lookup and Ashher's dashboards): `{"session_id","unit":{"unit_id","name"},"status":"in_progress"|"complete","answered_count","question_budget","started_at":ISO-8601|null,"ended_at":ISO-8601|null}`. In memory mode the timestamps are `null`. History/dashboard aggregation APIs are Ashher's (I2-A16/A18); this list is the session-command contract's minimal lookup.

### 5.3 Errors

Body is always `{"error":{"code":"<code>"}}`; no detail text.

| Code | HTTP | Meaning | Client should |
|---|---|---|---|
| `invalid_request` | 422 | malformed/oversized/extra-field body or query | fix the request |
| `internal_unauthorized` | 401 | wrong/missing service token | configuration error |
| `session_unavailable` | 404 | no such session for this actor (also malformed IDs, other student's session) | start a fresh check |
| `unit_not_found` | 404 | unit not in the active release | — |
| `assignment_not_found` | 404 | assignment unknown/closed/not the student's (always, until PR 10) | — |
| `session_expired` | 410 | memory mode only: TTL elapsed | start a fresh check |
| `enrolment_required` | 403 | student has no active enrolment in a class teaching the subject | ask teacher for a class |
| `enrolment_ambiguous` | 409 | several such enrolments and no assignment given | open from an assignment |
| `create_conflict` | 409 | `create_request_id` reused with another unit | new request ID |
| `answer_conflict` | 409 | different answer for an already accepted step | reload state |
| `step_conflict` | 409 | `step_index` is not the next step | reload state |
| `item_conflict` | 409 | `item_id` is not the pending question | reload state |
| `session_finished` | 409 | answer after completion | reload state |
| `capacity_exceeded` | 503 | memory mode only | retry later |
| `storage_unavailable` | 503 | database unreachable / pool exhausted | retry later |
| `storage_error` | 500 | database rejected a write (constraint/trigger) | retry once; report |
| `replay_mismatch` | 500 | stored evidence disagrees with replay | cannot continue; report |
| `engine_numeric_error` | 500 | unexpected exception | retry once; report |

BFF-only codes (browser ↔ BFF): `authentication_required` 401, `role_required` 403, `invalid_origin` 403, `engine_unavailable` 503, `engine_timeout` 504.

### 5.4 Idempotency and lifecycle

- Start key: `(student's enrolment, create_request_id)`. Identical retry (any time, even after answers) → the original first-question snapshot. Concurrent identical starts create one session.
- Answer key: `(session_id, step_index)`. Identical retry of an accepted step → that step's original reply. Concurrent different answers for one step → exactly one accepted.
- Client recovery rule: after a lost answer response, `GET` the session first; resend the identical payload only if that question is still pending.
- Internal outcome statuses (stored in `diagnostic_session.status`): `in_progress`, `diagnosed`, `none_detected`, `escalated_no_separator`, `escalated_exhausted`, `escalated_unmodelled` (`abandoned` exists in the schema but has no transition). Student-facing status collapses all terminal ones to `complete`.
- Retention: PostgreSQL mode keeps sessions indefinitely (no expiry); a retention/deletion policy is a later decision recorded in the contract as open. Loss on restart does not occur. Memory mode keeps the old TTL/capacity behaviour.
- Version pinning: each session stores its response model (content version + engine params) and engine release; replies and evidence always come from those.

### 5.5 Assignment linkage (requested from Harris, I2-H12)

Ahmed's start service needs from Harris's assignment schema: a table (name to be chosen by Harris, suggested `sonder.class_assignment`) with `id uuid`, `class_id → classroom`, `unit_id → diagnostic_unit` (which pins the content version), an availability status, and the repeat-attempt rule. Ahmed's migration (PR 10) then adds `diagnostic_session.assignment_id uuid NULL REFERENCES <that table>` and a guard that the assignment's class equals the enrolment's class and its unit equals the session unit. Until then `assignment_id` must be null/omitted.

## Harness

Run `SONDER_ENGINE_TOKEN=… python -m sonder_api.contract_check --base-url http://127.0.0.1:8000 --actor <student A app_user.id> --actor <student B app_user.id> --unit U1`. Both actors must be able to start on that unit. The harness checks access, projections, idempotency, errors and completion against a running service.

## Changes from v1

The application account `X-Sonder-Actor` replaces the owner HMAC and per-run cookie. Version 2 adds a session list, new error codes and the optional `assignment_id` request field.

## Examples

See [health](examples/health.json), [units](examples/units.json), [start request](examples/start.request.json), [start response](examples/start.response.json), [answer request](examples/answer.request.json), [answer response](examples/answer.response.json), [completion](examples/complete.response.json), [sessions](examples/sessions.response.json), and [answer conflict](examples/error.answer_conflict.json).

## Persisted evidence

Internal consumers can read rows and verify replay through the [persisted evidence interface](PERSISTED_EVIDENCE.md). Class-scope authorization is the consumer's responsibility.

## Failure behaviour

PostgreSQL mode fails startup when the database or configured release is unavailable; it never falls back to memory. During an outage the service returns `503 storage_unavailable`; a dropped connection can cause the first request after connection loss to return 503 before the pool recovers. Each answer is atomic: the step, posterior and next question or outcome commit together. After a lost reply, read the current session and resend the identical answer only if that question is still pending. A row lock serialises concurrent requests even across service processes.

PostgreSQL sessions are retained indefinitely pending a retention policy. Memory mode alone uses a TTL and capacity limit and loses sessions on restart.

## Student client states

| Phase | Meaning | Student sees |
| --- | --- | --- |
| `loading_metadata` | Loading unit and any unfinished session | Loading message |
| `intro` | Ready to begin or resume | Topic and Begin, or unfinished count and Continue |
| `starting` | Start request in flight | Loading message |
| `question` | Pending question | Question and answer choices |
| `submitting` | Answer in flight | Selected choice and progress message |
| `recovering` | Checking authoritative state after a failure | Recovery message or a safe error with Retry when appropriate |
| `complete` | Session finished | Neutral teacher-review message |
| `unavailable` | Request cannot currently proceed | Safe error and available next steps |

## Statuses for dashboards

Only `in_progress`, `complete`, and `answered_count` are student-safe progress values. Review status comes from Ashher's I2-A14; a session status is not a diagnosis or review decision.
