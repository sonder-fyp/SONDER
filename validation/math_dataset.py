"""Read-only checks for the authored Maths_v2 CSV files.

Run from the repository root with ``python -m validation.math_dataset``.
This tool does not approve the educational meaning of a question or edit data.
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from math import isfinite
from pathlib import Path


BANK_COLUMNS = (
    "item_id", "topic", "target", "stem", "option_id", "option_text",
    "is_correct", "misconceptions", "status", "batch",
)
TOPIC_COLUMNS = ("topic", "MisconceptionId", "MisconceptionName")
BATCH_COLUMNS = BANK_COLUMNS[:-1]
CONTENT_COLUMNS = BATCH_COLUMNS[:-1]  # Batch rows are drafts; bank rows are approved.


@dataclass(frozen=True)
class Finding:
    kind: str  # error, contract, or warning
    code: str
    location: str
    detail: str


def _read_csv(path: Path, required: tuple[str, ...], findings: list[Finding]) -> list[dict[str, str]]:
    location = path.as_posix()
    if not path.is_file():
        findings.append(Finding("error", "MISSING_FILE", location, "Required CSV is absent."))
        return []
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream, strict=True)
            headers = reader.fieldnames or []
            missing = sorted(set(required) - set(headers))
            if missing or len(headers) != len(set(headers)):
                findings.append(Finding(
                    "error", "CSV_HEADER", location,
                    f"Missing columns: {missing}; duplicate headers: {len(headers) != len(set(headers))}.",
                ))
                return []
            rows: list[dict[str, str]] = []
            for row in reader:
                if None in row or any(value is None for value in row.values()):
                    findings.append(Finding(
                        "error", "CSV_ROW_WIDTH", f"{location}:{reader.line_num}",
                        "Row does not have the header's number of columns.",
                    ))
                    continue
                rows.append(row)
            return rows
    except (OSError, UnicodeError, csv.Error) as exc:
        findings.append(Finding("error", "CSV_READ", location, str(exc)))
        return []


def _links(row: dict[str, str], location: str, findings: list[Finding]) -> list[str]:
    raw = row["misconceptions"].strip()
    if not raw:
        return []
    links = [part.strip() for part in raw.split("|")]
    if any(not part for part in links) or len(links) != len(set(links)):
        findings.append(Finding(
            "error", "INVALID_LINK_LIST", location,
            "Misconception list contains an empty or repeated ID.",
        ))
    return links


def validate_dataset(root: Path, *, guess: float = 0.30) -> list[Finding]:
    """Return structural and spec-v2 P1 findings without changing the dataset.

    The validator does not construct diagnostic units. The pack loader must
    check each item's links against its unit hypothesis set separately.
    """
    if not isinstance(guess, (int, float)) or isinstance(guess, bool) or not isfinite(guess) or not 0 < guess < 1:
        raise ValueError("guess must be finite and strictly between zero and one")
    findings: list[Finding] = []
    bank_path = root / "bank" / "items.csv"
    topics = _read_csv(root / "topics.csv", TOPIC_COLUMNS, findings)
    bank = _read_csv(bank_path, BANK_COLUMNS, findings)
    if not topics and not any(finding.code in {"MISSING_FILE", "CSV_HEADER", "CSV_READ"} and "topics.csv" in finding.location for finding in findings):
        findings.append(Finding("error", "EMPTY_TOPICS", "topics.csv", "No misconception rows."))
    if not bank and not any(finding.code in {"MISSING_FILE", "CSV_HEADER", "CSV_READ"} and "items.csv" in finding.location for finding in findings):
        findings.append(Finding("error", "EMPTY_BANK", "bank/items.csv", "No approved item rows."))
    if not topics or not bank:
        return findings

    known_ids: set[str] = set()
    topic_names: set[str] = set()
    for row in topics:
        misconception_id = row["MisconceptionId"].strip()
        topic = row["topic"].strip()
        if not topic or not misconception_id or not row["MisconceptionName"].strip():
            findings.append(Finding("error", "EMPTY_TOPIC_FIELD", "topics.csv", str(row)))
        if misconception_id in known_ids:
            findings.append(Finding("error", "DUPLICATE_MISCONCEPTION", "topics.csv", misconception_id))
        known_ids.add(misconception_id)
        topic_names.add(topic)

    items: dict[str, list[dict[str, str]]] = {}
    bank_keys: set[tuple[str, str]] = set()
    bank_batches: set[str] = set()
    for row in bank:
        item_id = row["item_id"].strip()
        option_id = row["option_id"].strip()
        location = f"bank/items.csv:{item_id or '?'}:{option_id or '?'}"
        if not item_id or not option_id or not row["stem"].strip() or not row["option_text"].strip():
            findings.append(Finding("error", "EMPTY_ITEM_FIELD", location, "Required item field is empty."))
        items.setdefault(item_id, []).append(row)
        if (item_id, option_id) in bank_keys:
            findings.append(Finding("error", "DUPLICATE_OPTION_ID", location, "Repeated item/option key."))
        bank_keys.add((item_id, option_id))
        if row["is_correct"] not in {"True", "False"}:
            findings.append(Finding("error", "INVALID_BOOLEAN", location, row["is_correct"]))
        if row["status"] != "approved":
            findings.append(Finding("error", "UNAPPROVED_BANK_ROW", location, row["status"]))
        if row["target"] not in known_ids:
            findings.append(Finding("error", "UNKNOWN_TARGET", location, row["target"]))
        links = _links(row, location, findings)
        for linked_id in links:
            if linked_id not in known_ids:
                findings.append(Finding("error", "UNKNOWN_LINK", location, linked_id))
        if row["is_correct"] == "True" and links:
            findings.append(Finding("error", "CORRECT_OPTION_LINKED", location, "Correct option has misconception links."))
        bank_batches.add(row["batch"].strip())

    for item_id, rows in sorted(items.items()):
        location = f"bank/items.csv:{item_id}"
        if len(rows) != 4:
            findings.append(Finding("error", "OPTION_COUNT", location, f"Expected 4 option rows; found {len(rows)}."))
        if sum(row["is_correct"] == "True" for row in rows) != 1:
            findings.append(Finding("error", "CORRECT_COUNT", location, "Expected exactly one correct option."))
        texts = [row["option_text"].strip().casefold() for row in rows]
        if len(set(texts)) != len(texts):
            findings.append(Finding("error", "DUPLICATE_OPTION_TEXT", location, "Option texts repeat."))
        for field in ("topic", "target", "stem", "status", "batch"):
            if len({row[field] for row in rows}) != 1:
                findings.append(Finding("error", "INCONSISTENT_ITEM_FIELD", location, field))
        linked_option_counts: dict[str, int] = {}
        for row in rows:
            for misconception_id in {part.strip() for part in row["misconceptions"].split("|") if part.strip()}:
                linked_option_counts[misconception_id] = linked_option_counts.get(misconception_id, 0) + 1
        for misconception_id, count in sorted(linked_option_counts.items()):
            if count > 3:
                findings.append(Finding(
                    "error", "V11_LINK_CAP", location,
                    f"{misconception_id} links {count} options; V11 allows at most 3.",
                ))
            elif guess >= (4 - count) / 4:
                findings.append(Finding(
                    "contract", "P1_GUESS", location,
                    f"{misconception_id} links {count} options; guess={guess:g} "
                    f"must be < {(4 - count) / 4:g} for this item.",
                ))

    for label in sorted({row["topic"] for row in bank} - topic_names):
        findings.append(Finding(
            "warning", "TOPIC_LABEL_NEEDS_MAPPING", "bank/items.csv",
            f"'{label}' is not an exact topics.csv label; Ahmed's importer needs an explicit mapping.",
        ))

    # Batches document authorship. Approval changes status in the consolidated bank,
    # but the authored question and option content should otherwise match.
    batch_files = sorted((root / "batches").glob("B*_long.csv"))
    batch_by_code: dict[str, Path] = {}
    batch_rows: dict[tuple[str, str], tuple[str, dict[str, str]]] = {}
    for path in batch_files:
        code = path.name.split("_", 1)[0]
        if code in batch_by_code:
            findings.append(Finding("error", "DUPLICATE_BATCH", path.as_posix(), code))
        batch_by_code[code] = path
        for row in _read_csv(path, BATCH_COLUMNS, findings):
            key = (row["item_id"], row["option_id"])
            if key in batch_rows:
                findings.append(Finding("error", "DUPLICATE_BATCH_ROW", path.as_posix(), str(key)))
            batch_rows[key] = (code, row)
            if key not in bank_keys and row["status"] == "approved":
                findings.append(Finding(
                    "error", "APPROVED_ROW_OUTSIDE_BANK", path.as_posix(), str(key),
                ))
    for code in sorted(bank_batches):
        if code not in batch_by_code:
            findings.append(Finding("error", "MISSING_BATCH", "bank/items.csv", code))
    for row in bank:
        key = (row["item_id"], row["option_id"])
        source = batch_rows.get(key)
        if source is None:
            findings.append(Finding("error", "BANK_ROW_NOT_IN_BATCH", "bank/items.csv", str(key)))
            continue
        source_code, authored = source
        if row["batch"] != source_code:
            findings.append(Finding(
                "error", "BANK_SOURCE_MISMATCH", f"bank/items.csv:{key[0]}:{key[1]}",
                f"Bank says {row['batch']}; authored row is in {source_code}.",
            ))
        for field in CONTENT_COLUMNS:
            if row[field] != authored[field]:
                findings.append(Finding(
                    "error", "BANK_BATCH_MISMATCH", f"bank/items.csv:{key[0]}:{key[1]}", field,
                ))
    return sorted(findings, key=lambda x: (x.kind, x.code, x.location, x.detail))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "Maths_v2",
        help="Directory containing topics.csv, bank/items.csv, and batches/",
    )
    parser.add_argument(
        "--strict-contract", action="store_true",
        help="Also fail if the chosen guess violates spec v2 P1 on a bank item.",
    )
    parser.add_argument("--guess", type=float, default=0.30,
                        help="Assumed guess for P1 checks; default 0.30 (not a calibration).")
    args = parser.parse_args()
    try:
        findings = validate_dataset(args.root, guess=args.guess)
    except ValueError as exc:
        parser.error(str(exc))
    for finding in findings:
        print(f"{finding.kind.upper():8} {finding.code:26} {finding.location}: {finding.detail}")
    counts = {kind: sum(finding.kind == kind for finding in findings) for kind in ("error", "contract", "warning")}
    print(f"Structural errors: {counts['error']}; P1 conflicts: {counts['contract']}; warnings: {counts['warning']}.")
    return int(counts["error"] > 0 or (args.strict_contract and counts["contract"] > 0))


if __name__ == "__main__":
    raise SystemExit(main())
