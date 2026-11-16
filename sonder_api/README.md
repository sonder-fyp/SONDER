# Engine service

See [setup](../docs/SETUP.md) for installation, migrations, the development candidate, persistent mode and verification. See the [persistent flow checks](../docs/testing/PERSISTENT_FLOW_CHECKS.md) for the HTTP harness and manual browser checklist.

Memory mode is an explicit developer mode: `python -m sonder_api --store memory`. It loses sessions on service restart and is never an automatic database fallback.
