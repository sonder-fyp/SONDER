# Database migrations

`manifest.json` lists every migration in order. A migration is either a file in this folder
or, for the two Iteration 1 files, the existing script at its original path. Run them with:

    python -m sonder_db.migrate status
    python -m sonder_db.migrate up

`SONDER_DATABASE_URL` names the database. Applied migrations are recorded in
`sonder_meta.schema_migration` with the SHA-256 of their content (line endings normalised);
`up` refuses to run if an applied file has changed. Never edit an applied migration: add a new
numbered file and a manifest entry.

A database built by hand before this runner existed (for example a Neon development branch that
already has the Iteration 1 schema and `001-auth-rbac.sql`) is recorded once, without running
anything, with:

    python -m sonder_db.migrate adopt 0001_iteration1_schema 0002_auth_rbac

Feature owners write and test their own migrations (work division §6.1); this runner only
executes them.
