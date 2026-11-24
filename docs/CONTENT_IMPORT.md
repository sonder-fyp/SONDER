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

## Before anything uses an imported version

The database accepts direct edits to the rows of a **draft** version (draft content is meant to be editable), so nothing in
the database itself stops the stored version from drifting away from the files. `verify` is the guard. **Run both of these
before a release is made from an imported version, or any session uses it:**

```
python -m sonder_db.content_import verify                  # the importer's own comparison with the files
python -m validation.import_compare --version-code <code>  # Ashher's independent comparison (its own SQL, no shared code)
```

Both exit with code 1 and name the item and option on any difference (checked by Ashher on 24 November 2026 by changing one option's
text and deleting one link, see `validation/reviews/I2_IMPORTER_2026-11-24_ashher.md`). Re-run them after any manual change to the database and after the content files change. The
independent comparison of the **expert-accepted** version, which cannot be done before the external Maths expert has accepted
one (I2-H07), uses the same command with the accepted version's code.

## From an imported version to a release (not built yet)

The importer produces a **draft content version, not a runnable release**. The live app currently serves the development
release created by `sonder_api/devseed.py`, which is a placeholder (synthetic accounts, one unit, review rows that stand in for
a real review). Turning an imported version into something the app can serve needs these steps, in order. Steps 2 to 5 are not
implemented by this tool; the dev seed shows their shape, and the real interface is to be agreed with Ahmed.

1. **Expert acceptance (I2-H07).** The external Maths expert accepts a specific version of the content. Record which version
   (its `pack_sha256`) was accepted. Without this the content stays a candidate.
2. **Item reviews.** A reviewer who is not the item's author records an `item_review` decision for each accepted item (the
   database allows approval only this way). The importer deliberately writes none.
3. **Freeze the content version.** `content_version.status` moves from `draft` to `frozen`. A frozen version cannot be
   re-imported; later changes go in a new `--version-code`.
4. **Engine parameters and response model.** Record the engine parameters (`engine_params`, identified by their hash) and build
   a response model: the likelihood of each option under each hypothesis, computed by the engine from the frozen content, then
   freeze it. Until it is calibrated on real student answers its source is `prior`, and that must stay visible.
5. **Release.** The version plus its response model is what sessions are started against. Re-run both comparisons above on the
   frozen version first.

Each step needs the previous one. The two comparison commands are the check that the version in the database is the version the
expert saw.

## What it checks before writing

Four options labelled A to D, exactly one correct, no link on the correct option, at most three links per wrong option, no
duplicate option text, every target and linked misconception and every topic prefix known to `topics.csv`, and consistent
stem/target/batch across the rows of an item. The engine loader then applies its own pack rules.

## Tests

`tests/test_content_import.py`: source checks run anywhere; the import tests need `SONDER_TEST_DATABASE_URL`
(`docker compose up -d --wait`) and run in the CI `persistence` job.
