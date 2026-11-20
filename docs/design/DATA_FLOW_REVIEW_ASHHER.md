# Data-flow technical review — Ashher

**Date:** 12 Oct 2026

**Reviewed artefact:** `docs/design/DATA_FLOW.md` (Harris's T04.04 document)

**Review result:** Technical consistency review completed and corrections made locally. Harris's acceptance of the revised document and the separate Maths content sign-off remain open. No live database integration is claimed.

## What I checked

| Boundary | Evidence checked | Result |
|---|---|---|
| Maths bank to unit pack | `data/Maths_v2`, `validation/math_dataset.py`, `sonder_pack/maths_v2.py`, `sonder_engine/pack.py`, unit configuration | The bank has 117 items; the read-only loader builds U1–U7, excludes the three D-2 items from U6, drops MATH-1416 from U6 and leaves three D-4 items unplaced. It does not rewrite the CSV. |
| Browser to engine and back | `Sonder-UI-master/lib/diagnostic/routes.ts`, `server.ts`; `sonder_api/app.py`, `store.py`, `student_view.py`; `sonder_engine/session.py` | The live local flow uses same-origin Next.js routes, FastAPI and a one-process memory store. The pure engine returns the next item or one of five terminal outcomes. The student projection never returns posterior or diagnosis. |
| Planned persistence | `docs/db/iteration1/sonder_iteration1.sql` revision 3 and `tests/import_probe.py` | The SQL defines item review, pack/model freeze and session/trace tables. The import probe runs in a transaction ending with `ROLLBACK`. The Mid-1 UI does not write these tables. |
| State and failure behavior | `sonder_engine/stopping.py`, `session.py`, `sonder_api/store.py`, `tests/test_engine_session.py`, `tests/test_engine_stopping.py`, `tests/test_engine_api.py` | R1–R5, immutable error handling, idempotent API replies and memory-loss limits match `STATE_MACHINE_ITERATION_1.md`. Database `abandoned` is not emitted by the current engine/API. |

## Corrections made in the data-flow document

1. Added the **implemented Mid-1 flow** before the planned database diagrams. The original document described database writes as though they were live and said the run loop was not built; both statements were stale.
2. Marked the existing PNG data-flow diagrams as **database-design illustrations**. Their PostgreSQL persistence path, independent review and teacher reading of a trace are not current UI capabilities.
3. Replaced the old open D-2 choice with the implemented decision: keep `guess=0.30`, skip three U6 items in the unit loader and drop MATH-1416 from U6. The 0.24 response-model probe is a tested alternative, not the live setting.
4. Clarified that a zero-exit structural validator run can still report P1 conflicts; `--strict-contract` is the failing gate.
5. Clarified that Harris's CSV approval does not establish the SQL rule requiring an active teacher/admin reviewer different from an item's author. That attribution is unresolved for a real import.
6. Corrected the planned database path: uniqueness prevents duplicate stored steps, but a future API must implement returning the old reply; the current in-memory API already caches accepted replies.
7. Moved `abandoned` outside R1–R5. The SQL permits it, but the current engine/API has no transition that produces it.

## Reproduction and limits

- `python -B -m validation.math_dataset`: **0 structural errors, 3 P1 conflicts, 6 topic-label warnings**.
- `python -B -m validation.math_dataset --strict-contract`: exits **1** on those P1 conflicts, as the proposed release gate should.
- `python -B -m sonder_pack.maths_v2`: **7 units and 40 loader warnings**, including the three D-2 skips, MATH-1416 drop and three D-4 unplaced items.
- With `PYTHONPATH=tests`, `python -B -m unittest tests.test_engine_session tests.test_engine_stopping tests.test_engine_api -q`: **50 tests passed**.
- This review compared the document to the repository and executed the local code/tests. It did not perform a teacher-facing usability review, approve Harris's disputed misconception links, or run a live PostgreSQL import. The existing PNG diagrams remain historical illustrations of the planned schema and should be labelled that way if placed in a report.

**Next owner action:** Harris should accept or comment on the corrected data-flow text. The team should separately decide which planned database diagram belongs in the Mid-1 report and label its implementation status.
