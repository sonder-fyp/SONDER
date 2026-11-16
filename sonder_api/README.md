# Local engine/UI integration

This is a one-worker, in-memory system checkpoint. It calls the unchanged Python engine and Maths_v2 loader. It has no database and uses authenticated application accounts at the BFF. Python restart loses sessions; Next restart preserves sessions while the Python process remains running. The demo role switcher does not provide identity. Keep both services on loopback.

## Run from this checkout

The implementation checkout is `D:\SONDER-engine-ui`. It intentionally excludes the parked DB branch and the separate terminal renderer. Python API packages and frontend dependencies were already available here; no installation was performed. New optional dependency declarations are `.[api,api-test]`; a clean workstation needs these approved extras and the existing UI dependencies before running. Execution from a source checkout is required: the existing engine-only wheel does not package the CSV bank, pack loader or API.

In PowerShell terminal one, generate a local token and put the UI configuration in its ignored `.env.local` file. This overwrites that file only in this dedicated checkout; preserve any existing settings if you have added your own.

```powershell
cd D:\SONDER-engine-ui
$env:SONDER_ENGINE_TOKEN = python -c "import secrets; print(secrets.token_hex(32))"
@"
SONDER_ENGINE_URL=http://127.0.0.1:8000
SONDER_ENGINE_TOKEN=$env:SONDER_ENGINE_TOKEN
SONDER_UI_ORIGIN=http://127.0.0.1:3000
"@ | Set-Content -LiteralPath .\Sonder-UI-master\.env.local -Encoding ascii
python -m sonder_api --store memory --host 127.0.0.1 --port 8000 --trace
```

In terminal two:

```powershell
cd D:\SONDER-engine-ui\Sonder-UI-master
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open **http://127.0.0.1:3000**, choose Student → Start a diagnostic → Mathematics → a real topic → Begin. `http://localhost:3000` also works: the mutation Origin check accepts the configured `127.0.0.1` origin and the same port as `localhost`, and nothing else. Stop each process with Ctrl+C. Never commit `.env.local` or paste its keys into a review report.

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

The browser authenticates to the Next.js BFF using its Neon Auth session. The BFF sends the application account ID as `X-Sonder-Actor` and a shared `X-Sonder-Token` to the loopback engine service. Only internal token-authenticated readers can access traces; student snapshots omit diagnosis, answers and probabilities. See the [session API contract](../docs/api/SESSION_CONTRACT.md) for version 2 endpoints, errors, retries and lifecycle.

Memory mode is explicitly selected with `--store memory`; it loses sessions on restart and is not a database fallback. Capacity defaults to 256 and inactivity TTL to 86400 seconds, configurable with `SONDER_SESSION_CAPACITY` and `SONDER_SESSION_TTL`.
