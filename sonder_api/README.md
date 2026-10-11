# Local engine/UI integration

This is a one-worker, in-memory system checkpoint. It calls the unchanged Python engine and Maths_v2 loader. It has no database or real student authentication. Python restart loses sessions; Next restart preserves sessions when its keys are unchanged. The demo role switcher does not provide identity. Keep both services on loopback.

## Run from this checkout

The implementation checkout is `D:\SONDER-engine-ui`. It intentionally excludes the parked DB branch and the separate terminal renderer. Python API packages and frontend dependencies were already available here; no installation was performed. New optional dependency declarations are `.[api,api-test]`; a clean workstation needs these approved extras and the existing UI dependencies before running. Execution from a source checkout is required: the existing engine-only wheel does not package the CSV bank, pack loader or API.

In PowerShell terminal one, generate two local keys and put the UI configuration in its ignored `.env.local` file. This overwrites that file only in this dedicated checkout; preserve any existing settings if you have added your own.

```powershell
cd D:\SONDER-engine-ui
$env:SONDER_ENGINE_TOKEN = python -c "import secrets; print(secrets.token_hex(32))"
$cookieKey = python -c "import secrets; print(secrets.token_hex(32))"
@"
SONDER_ENGINE_URL=http://127.0.0.1:8000
SONDER_ENGINE_TOKEN=$env:SONDER_ENGINE_TOKEN
SONDER_COOKIE_KEY=$cookieKey
SONDER_UI_ORIGIN=http://127.0.0.1:3000
"@ | Set-Content -LiteralPath .\Sonder-UI-master\.env.local -Encoding ascii
python -m sonder_api --host 127.0.0.1 --port 8000 --trace
```

In terminal two:

```powershell
cd D:\SONDER-engine-ui\Sonder-UI-master
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open **http://127.0.0.1:3000**, choose Student → Start a diagnostic → Mathematics → a real topic → Begin. `http://localhost:3000` also works: the mutation Origin check accepts the configured `127.0.0.1` origin and the same port as `localhost`, and nothing else. Stop each process with Ctrl+C. Never commit `.env.local` or paste its keys into a review report. Do not regenerate keys while preserving an API process and expecting old cookies to remain valid.

## Evidence and tests

The browser URL contains a session locator after Begin. To inspect it in another PowerShell window, load only the token from local configuration:

```powershell
cd D:\SONDER-engine-ui
$env:SONDER_ENGINE_TOKEN = ((Get-Content .\Sonder-UI-master\.env.local | Where-Object { $_ -like 'SONDER_ENGINE_TOKEN=*' }) -split '=',2)[1]
python -m sonder_api.inspect_session <session-id>
python scripts/check_engine_ui.py --all-policies
python -m unittest discover -s tests -v
cd Sonder-UI-master
npm test
npm run lint
npm run build
```

The HTTP script requires both servers; ordinary Python/Vitest tests do not. Production build requires neither server nor keys. The HTTP script verifies D1/D2, 78 policies, exact full engine traces, original response retries, ownership, parallel Begin before cookies and the absence of a student trace proxy. It does not claim browser acceptance.

For D1 choose U1 and D/B/B/A. Expected items: T1-005, T1-006, T1-007, T1-009. Internal result: diagnosed/R1. For D2 choose U4 and D/A. Items: T4-001, T5-011. Internal result: no separator/R4. Both pages show the same neutral completion.

## Request boundary

Browser endpoints are `/api/diagnostic/units`, `/sessions`, `/sessions/{id}`, and `/sessions/{id}/answers`. Python endpoints use `/engine/units`, `/sessions`, `/sessions/{id}`, `/sessions/{id}/answers`, `/sessions/{id}/trace` and `/health`. Every internal endpoint requires `X-Sonder-Token`; session operations also require a verified owner. Only the internal trace endpoint exposes diagnostic evidence.

Begin takes `{unit_id, create_request_id}` (UUID v4). This nonce is a sensitive bootstrap capability; identical retries recover the same start reply even before Set-Cookie. The BFF derives its owner with HMAC, then sets a signed HttpOnly SameSite per-run cookie scoped to that run's API path. Different runs have separate cookies. This deliberately is not login or enrolment authorization.

Answer takes `{step_index, item_id, option_id}`. Extra/coerced fields are rejected. Accepted steps cache their original transition response, including final answers; conflicting retries return 409. All store operations are locked; numerical and projection work completes before publication. Student success/error responses are explicitly projected again at the BFF. No trace, correct answer, hypothesis, posterior or stopping outcome is included.

Lost answer responses retain the original payload. Retry first reads the authoritative session and resends the identical answer only if that question is still pending. Navigating away does not abandon a run. Run again returns to intro; only a later Begin starts a distinct run.

Defaults: capacity 256 sessions, inactivity TTL 86400 seconds; configure the API with `SONDER_SESSION_CAPACITY` / `SONDER_SESSION_TTL`. When the store is full, the least recently used finished run is removed to make room (its owner then sees an expired check); active runs are never evicted, and Begin is refused only when every slot holds an active run. Expiry caches and replay caches are bounded with the session lifetime. Cookie lifetime is 24 hours and renewed on successful reads/transitions; use the default TTL for ordinary testing. This mode is explicitly separate from any future Neon store and must never be an automatic database fallback.
