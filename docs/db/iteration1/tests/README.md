# Schema tests (Iteration 1)

Run these against a **throwaway local** PostgreSQL 16+ database, never against Neon `main`.
Both expect the schema script to have been applied to an empty database first.

| File | What it does | Expected result |
|---|---|---|
| `behaviour_test.sql` | Builds a small synthetic pack with two diagnostic units and three runs, and tries 75 invalid writes. | 75 `NOTICE: ok …` lines (each a write the schema rejected, with the reason), 9 `NOTICE: PASS …` lines, and no `FAIL` or `ERROR`. |
| `import_probe.py` | Prints SQL that loads the real `data/Maths_v2` bank item by item inside one transaction, declares the seven spec v2 units, freezes the pack, tries response models at guess 0.30 and 0.24, then rolls everything back. | All 117 items load; units U1–U7 have k = 4, 5, 5, 6, 4, 6, 7 and 20, 25, 10, 16, 10, 17, 16 items; T6-019B/020B/021B are in no unit; the pack freezes; guess 0.30 is refused by P1 and guess 0.24 freezes. Nothing is kept. |

```sh
# Throwaway database (example: Docker)
docker run -d --name sonder-pg16 -e POSTGRES_PASSWORD=local postgres:16
docker exec sonder-pg16 psql -U postgres -c "CREATE DATABASE bt"
docker exec -i sonder-pg16 psql -X -v ON_ERROR_STOP=1 -U postgres -d bt < docs/db/iteration1/sonder_iteration1.sql

# Behaviour test
docker exec -i sonder-pg16 psql -X -q -U postgres -d bt < docs/db/iteration1/tests/behaviour_test.sql

# Import probe (needs only Python 3; use a fresh database built by the schema script)
docker exec sonder-pg16 psql -U postgres -c "CREATE DATABASE ip"
docker exec -i sonder-pg16 psql -X -v ON_ERROR_STOP=1 -U postgres -d ip < docs/db/iteration1/sonder_iteration1.sql
python docs/db/iteration1/tests/import_probe.py data/Maths_v2 | docker exec -i sonder-pg16 psql -X -q -U postgres -d ip

docker rm -f sonder-pg16
```

The import probe uses placeholder author and reviewer accounts. It shows that the data fits the schema; it is not the content importer (task T05.07) and does not resolve who authored or reviewed each item.
