"""Regression tests for the read-only Maths_v2 validator."""

from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from validation.math_dataset import BANK_COLUMNS, BATCH_COLUMNS, TOPIC_COLUMNS, validate_dataset


def write_csv(path: Path, headers: tuple[str, ...], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


class MathDatasetValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.topics = [
            {"topic": "T1 Example", "MisconceptionId": "MATH-1", "MisconceptionName": "First"},
            {"topic": "T1 Example", "MisconceptionId": "MATH-2", "MisconceptionName": "Second"},
        ]
        self.bank = [
            self.option("A", "10", "False", "MATH-1"),
            self.option("B", "20", "True", ""),
            self.option("C", "30", "False", "MATH-2"),
            self.option("D", "40", "False", ""),
        ]
        self.batch = [{key: row[key] for key in BATCH_COLUMNS} for row in self.bank]

    @staticmethod
    def option(option_id: str, text: str, correct: str, links: str) -> dict[str, str]:
        return {
            "item_id": "T1-001", "topic": "T1 Example", "target": "MATH-1",
            "stem": "Choose the correct number.", "option_id": option_id,
            "option_text": text, "is_correct": correct,
            "misconceptions": links, "status": "approved", "batch": "B01",
        }

    def findings(self) -> list:
        write_csv(self.root / "topics.csv", TOPIC_COLUMNS, self.topics)
        write_csv(self.root / "bank" / "items.csv", BANK_COLUMNS, self.bank)
        write_csv(self.root / "batches" / "B01_example_long.csv", BATCH_COLUMNS, self.batch)
        return validate_dataset(self.root)

    def codes(self) -> set[str]:
        return {finding.code for finding in self.findings()}

    def test_valid_bank_and_matching_authored_batch(self) -> None:
        self.assertEqual([], self.findings())

    def test_empty_bank_is_not_reported_as_valid(self) -> None:
        self.bank.clear()
        self.assertIn("EMPTY_BANK", self.codes())

    def test_empty_topic_catalogue_is_not_reported_as_valid(self) -> None:
        self.topics.clear()
        self.assertIn("EMPTY_TOPICS", self.codes())

    def test_correct_answer_cannot_be_linked_to_misconception(self) -> None:
        self.bank[1]["misconceptions"] = "MATH-2"
        self.assertIn("CORRECT_OPTION_LINKED", self.codes())

    def test_missing_option_and_repeated_text_are_detected(self) -> None:
        self.bank.pop()
        self.bank[2]["option_text"] = self.bank[0]["option_text"]
        codes = self.codes()
        self.assertIn("OPTION_COUNT", codes)
        self.assertIn("DUPLICATE_OPTION_TEXT", codes)

    def test_unknown_and_repeated_link_ids_are_detected(self) -> None:
        self.bank[0]["misconceptions"] = "MATH-9|MATH-9"
        codes = self.codes()
        self.assertIn("UNKNOWN_LINK", codes)
        self.assertIn("INVALID_LINK_LIST", codes)

    def test_three_options_linked_to_one_misconception_conflict_with_draft(self) -> None:
        self.bank[2]["misconceptions"] = "MATH-1"
        self.bank[3]["misconceptions"] = "MATH-1"
        self.batch[2]["misconceptions"] = "MATH-1"
        self.batch[3]["misconceptions"] = "MATH-1"
        findings = self.findings()
        self.assertIn("DRAFT_PACK_V11", {finding.code for finding in findings})
        self.assertFalse(any(finding.kind == "error" for finding in findings))

    def test_bank_change_without_matching_batch_change_is_detected(self) -> None:
        self.bank[0]["option_text"] = "Changed answer"
        self.assertIn("BANK_BATCH_MISMATCH", self.codes())

    def test_bank_batch_attribution_must_match_source_file(self) -> None:
        self.bank[0]["batch"] = "B02"
        self.assertIn("BANK_SOURCE_MISMATCH", self.codes())

    def test_approved_batch_row_cannot_be_absent_from_bank(self) -> None:
        extra = dict(self.batch[0], item_id="T1-002", status="approved")
        self.batch.append(extra)
        self.assertIn("APPROVED_ROW_OUTSIDE_BANK", self.codes())

    def test_draft_batch_row_may_be_absent_from_bank(self) -> None:
        extra = dict(self.batch[0], item_id="T1-002", status="draft")
        self.batch.append(extra)
        self.assertEqual([], self.findings())

    def test_topic_label_difference_requires_explicit_import_mapping(self) -> None:
        for row in self.bank:
            row["topic"] = "T1 Alternate label"
        for row in self.batch:
            row["topic"] = "T1 Alternate label"
        self.assertIn("TOPIC_LABEL_NEEDS_MAPPING", self.codes())

    def test_cross_topic_link_needs_pack_decision_under_draft_v5(self) -> None:
        self.topics.append({
            "topic": "T2 Another", "MisconceptionId": "MATH-3",
            "MisconceptionName": "Third",
        })
        self.bank[0]["misconceptions"] = "MATH-3"
        self.batch[0]["misconceptions"] = "MATH-3"
        findings = self.findings()
        self.assertIn("DRAFT_PACK_V5", {finding.code for finding in findings})
        self.assertFalse(any(finding.kind == "error" for finding in findings))

    def test_label_with_too_many_linked_hypotheses_needs_pack_split(self) -> None:
        for number in range(3, 8):
            self.topics.append({
                "topic": "T1 Example", "MisconceptionId": f"MATH-{number}",
                "MisconceptionName": f"Misconception {number}",
            })
        self.bank[0]["misconceptions"] = "MATH-1|MATH-3|MATH-4|MATH-5|MATH-6|MATH-7"
        self.batch[0]["misconceptions"] = self.bank[0]["misconceptions"]
        self.assertIn("DRAFT_PACK_V7", self.codes())


if __name__ == "__main__":
    unittest.main()
