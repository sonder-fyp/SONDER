# Review: content importer and release identity (Harris, I2-H14, I2-H15)

**Reviewer:** Syed Ashher Majid · **Author:** Muhammad Harris · **Date:** 24 November 2026
**Code reviewed:** branch `harris/content-importer` at `eb1bd95` ("import work completed"): `sonder_db/content_import.py`, `tests/test_content_import.py`, `docs/CONTENT_IMPORT.md` and one CI step. No pull request was open when this was written.
**Content imported:** the Maths_v2 candidate of 20 November 2026 (`items.csv` LF SHA-256 `b168a664…ff73`).
**Review duty:** work division §3 (H3): Ahmed reviews the database and version side; I compare the imported content with the accepted source. **No expert-accepted version exists yet**, so this compares the import with the candidate. The same comparison must be repeated on the accepted version (§5).

Everything ran on a throwaway local PostgreSQL 16 (`docker compose`), never on Neon.

## 1. Checks I ran

| Check | How | Result |
| --- | --- | --- |
| Harris's own tests | `SONDER_REQUIRE_DB_TESTS=1 python -m unittest discover -s tests -p test_content_import.py` on a fresh database | 23 tests pass |
| The commands as documented | Fresh database, migrations up, an admin account; then `plan`, `import --dry-run`, `import`, `verify`, and `import` again | The dry run rolls back; the import writes a **draft** version with hash `b168a664…`; `verify` matches; a repeat import reports "unchanged" |
| **Independent comparison** | `python -m validation.import_compare` (my own SQL, sharing no code with the importer), run on the imported database | **25 checks pass, 0 fail** (§2) |
| Does `verify` catch tampering? | I changed T1-001 A's text to `3,801` in the database, then deleted T1-001 C's link, and ran `verify` after each | Both reported as `MISMATCH`, naming the item and option, with **exit code 1** |
| Does my comparison catch tampering? | Same tampered database | Fails, naming exactly T1-001 A and T1-001 C; exit code 1 |
| Current schema | His branch predates migration 0013, so I applied 0001–0013 from the current branch to a fresh database and ran his importer on it | Imports and verifies |
| Merge | `git merge-tree` against PR #92 and PR #99 as they are now | Merges cleanly onto both |
| Code read | Transaction handling, SQL construction, author check | One transaction with `SET CONSTRAINTS ALL IMMEDIATE` before the verify-then-commit. Every value is a bound parameter; the only f-string SQL inserts constant table and column names from the module. The author must be an existing admin or teacher (case-insensitive e-mail); the importer creates no accounts |

## 2. What the independent comparison checked

Against `bank/items.csv` and the engine's own loader (`sonder_pack.maths_v2`):

- `pack_sha256` equals the LF SHA-256 of `items.csv`: the same identity the experiments and the adverse baseline record, so database, engine and results name one version;
- the version and all 133 items are `draft`; every item is marked LLM-assisted; no item has a review row (nothing is approved or frozen, as the doc says);
- the same 133 item IDs; every stem, batch and target;
- all 532 option texts, correct flags and sets of linked misconceptions;
- every link graded `S` (the source has no grade column, spec T-1);
- twin-group membership agrees with the engine for every placed item;
- for each of U1–U7, the items in the engine's pack order and the hypotheses in the engine's slot order. Both matter for replay: EIG ties go to the earlier item, and posteriors are stored by slot.

## 3. Issues and suggestions

| # | Finding | Suggested action | Owner |
| --- | --- | --- | --- |
| 1 | The branch is based on Harris's #92 head of 20 November (`37d1bb3`), before my re-pinned tests and the latest `dev`, and no PR is open. | Open a PR after #92 merges, based on `dev`. It merges cleanly today. | Harris |
| 2 | The only commit message is "import work completed". | Describe the change in the PR (commands, rules, tests), as CONTRIBUTING asks. | Harris |
| 3 | The database accepts direct edits to imported draft rows (by design: draft content is editable), so `verify` is the only guard that the stored version still equals the files. | Run `verify` (and `validation.import_compare`) before any release or session uses an imported version, and say so in `CONTENT_IMPORT.md`. | Harris |
| 4 | The import creates a content version, not a runnable release: the live app still runs the development release created by `sonder_api/devseed.py`. The doc says freezing, response models and engine parameters are out of scope, which is correct while items are unreviewed. | State in `CONTENT_IMPORT.md` how a release is made from an imported version once the expert approves it (this is the step that turns G1 into something the app can serve). | Harris with Ahmed |
| 5 | Ahmed's database-side review (repeat and rollback behaviour, frozen-version rules) is still to do. | — | Ahmed |

None of these blocks merging the importer as a tool for candidate content.

## 4. Decision

**Accepted** as the content importer for candidate content. It imports exactly what the files say, my own comparison agrees with its `verify`, both catch tampering, and it never approves, reviews or freezes anything. Open the PR after #92, with issues 1–3 addressed.

## 5. Still outstanding

- **The comparison with accepted content** (my duty in H3) cannot be done until the external Maths expert accepts a version (I2-H07). When that version is imported, rerun:
  `python -m validation.import_compare --version-code <accepted code>`
  and add the result to this record.
