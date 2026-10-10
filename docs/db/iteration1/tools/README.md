# Schema tooling (Iteration 1)

These scripts regenerate the derived files from `../sonder_iteration1.sql`, which is authoritative.
Run them after every schema change, against a throwaway local PostgreSQL 16+ (never Neon).

```sh
# 1. Build the schema in a throwaway database (example: Docker postgres:16)
docker run -d --name sonder-pg16 -e POSTGRES_PASSWORD=local postgres:16
docker exec sonder-pg16 psql -U postgres -c "CREATE DATABASE fresh"
docker exec -i sonder-pg16 psql -X -v ON_ERROR_STOP=1 -U postgres -d fresh < docs/db/iteration1/sonder_iteration1.sql

# 2. Extract the catalogue as JSON
docker exec -i sonder-pg16 psql -X -tA -U postgres -d fresh < docs/db/iteration1/tools/catalog.sql > catalog.json

# 3. Regenerate DBML, PDF and the plan appendix (needs Python with reportlab)
python docs/db/iteration1/tools/generate.py catalog.json docs/db/iteration1/sonder_iteration1.sql \
       docs/db/iteration1 docs/db/iteration1/DB_SCHEMA_PLAN_ITERATION_1.md

# 4. Check the DBML parses (needs @dbml/core installed outside the repo; see check_dbml.js)
NODE_PATH=/path/to/node_modules node docs/db/iteration1/tools/check_dbml.js docs/db/iteration1/sonder_iteration1.dbml
```

| File | Purpose |
|---|---|
| `catalog.sql` | Reads tables, columns, constraints, indexes and triggers of schema `sonder` as one JSON document. |
| `generate.py` | Writes `sonder_iteration1.dbml`, `sonder_iteration1_tables.pdf` and the plan's Appendix A (between the APPENDIX markers). |
| `check_dbml.js` | Parses the DBML with `@dbml/core` and exports it to SQL as a syntax check. |

Behaviour tests live in `../tests/` (see its README).
