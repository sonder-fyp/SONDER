# Schema tests (Iteration 1)

Run these against the **throwaway Docker PostgreSQL 16** defined in `docker-compose.yml` at the repository root, never against Neon. The container keeps its data in memory and holds only test data; its password is a local placeholder, not a secret.

```sh
# from the repository root
docker compose up -d --wait                                   # start PostgreSQL 16 (port 55432 on localhost)
python docs/db/iteration1/tests/run_schema_tests.py           # all checks; exit 0 only if every check passes
docker compose down -v                                        # discard it
```

The engine package must be importable (`python -m pip install -e .`, or run from the repository root), because the import probe builds units with the engine's loader. CI runs the same three commands in the `db` job on every pull request.

`run_schema_tests.py` creates a fresh database inside the container for each check:

| Check | What it does | Expected result |
|---|---|---|
| Schema script | Applies `sonder_iteration1.sql` to an empty database, then applies it again. | Both runs succeed (the script is re-runnable); its own verification block passes. |
| `behaviour_test.sql` | Builds a small synthetic pack with two diagnostic units and three runs, and tries 75 invalid writes. | 75 `NOTICE: ok …` lines (each a write the schema rejected, with the reason), 9 `NOTICE: PASS …` lines, and no `FAIL` or `ERROR`. |
| `import_probe.py` | Prints SQL that loads the real `data/Maths_v2` bank item by item inside one transaction, declares the seven units **exactly as the engine builds them** (`sonder_pack/maths_v2.py` with the unit table `sonder_pack/maths_v2_units.json`), freezes the pack, tries response models at guess 0.30 and 0.24, then rolls everything back. | All 117 items load and none is rejected; units U1–U7 have k = 4, 5, 5, 6, 4, 5, 7 and 20, 25, 10, 16, 10, 14, 16 items, equal to the engine's; the items in no unit are T6-011B/014B/016B (skipped for U6, decision D-2) and T6-019B/020B/021B (unplaced, D-4); the pack freezes; response models at guess 0.30 and at 0.24 both freeze. Nothing is kept. |

Guess 0.30 freezes because the P1 check at response-model freeze looks only at unit items, and the three 3-option items are not in any unit. Before decision D-2 the probe built the spec's original units (U6 with 17 items, k = 6), and guess 0.30 was refused.

The import probe uses placeholder author and reviewer accounts. It shows that the data fits the schema; it is not the content importer (task T05.07) and does not resolve who authored or reviewed each item.
