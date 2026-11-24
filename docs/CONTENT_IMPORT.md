# Content importer

`sonder_db/content_import.py` loads a Maths pack (`data/Maths_v2/bank/items.csv`, `topics.csv` and the unit table
`sonder_pack/maths_v2_units.json`) into the content tables as a **draft candidate** version. Work-division tasks
I2-H14 and I2-H15 (owner: Harris; reviewers: Ahmed for the database side, Ashher for the comparison with accepted content).

## Commands

```
python -m sonder_db.content_import plan                                   # no database: checks the source and prints what would be written
python -m sonder_db.content_import import --author-email ADMIN@EXAMPLE --dry-run   # writes in a transaction, verifies, rolls back
python -m sonder_db.content_import import --author-email ADMIN@EXAMPLE             # imports as a draft candidate
python -m sonder_db.content_import verify                                  # compares the stored version with the files
```

`SONDER_DATABASE_URL` (or `--database-url`) names the database; migrations must already be applied
(`python -m sonder_db.migrate up`). Options: `--root`, `--config` (unit table), `--version-code`.
Exit code 0 = fine, 1 = refused, mismatch or database error, 2 = usage.

## Rules it keeps

* **One transaction.** Everything is written together, the deferred database checks are fired, and the rows are compared with
  the source before commit. A database rejection or a mismatch rolls everything back.
* **Never reviews, approves or freezes.** The content is owner-approved only; the database lets an item be approved only by a
  review from someone who is not its author, and no external Maths expert has reviewed anything. Items stay `draft`, no
  `item_review` row is written, and the version stays `draft`. Freezing, response models and engine parameters need approved items
  and are not part of this tool.
* **Author.** `--author-email` must name an existing account with role admin or teacher (the importer does not create accounts).
  Items are recorded as `authored`, `llm_assisted`, with a note that they were not reviewed by an external expert.
* **Release identity.** `content_version.pack_sha256` is the SHA-256 of `bank/items.csv` with CRLF converted to LF (the same on
  every platform). The hashes of `topics.csv` and the unit table are in the version note.
* **Repeat imports are safe.** Same version code and same hash: the stored rows are verified and nothing is changed. Same version
  code and a different hash, or a frozen version: refused, nothing changed; import under a new `--version-code`.
* **Catalogue rows are append-only** (the database rejects updates of `subject`, `topic` and `misconception`), so a second version
  reuses them and adds its own revisions.
* **Units and twins come from the engine's own loader** (`sonder_pack.maths_v2`), so the database and the engine agree on unit
  membership, hypothesis slots, item order and twin groups.

## What it checks before writing

Four options labelled A to D, exactly one correct, no link on the correct option, at most three links per wrong option, no
duplicate option text, every target and linked misconception and every topic prefix known to `topics.csv`, and consistent
stem/target/batch across the rows of an item. The engine loader then applies its own pack rules.

## Tests

`tests/test_content_import.py`: source checks run anywhere; the import tests need `SONDER_TEST_DATABASE_URL`
(`docker compose up -d --wait`) and run in the CI `persistence` job.
