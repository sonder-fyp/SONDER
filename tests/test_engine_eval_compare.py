"""The I2-A04 comparison table reads each run's metrics.csv and prints exactly those numbers."""

from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from experiments.compare import report

FIELDS = ("unit_id", "method", "policy", "target", "apply_rate", "slip", "metric", "numerator", "denominator",
          "value", "ci_low", "ci_high")


def write_run(root: Path, name: str, theta: float, coverage: tuple[int, int], labelled: tuple[int, int]) -> Path:
    run = root / name
    run.mkdir()
    (run / "manifest.json").write_text(json.dumps({"experiment": name, "params": {"theta": theta, "min_support": 2}}),
                                       encoding="utf-8")
    rows = [
        ("U1", "adaptive", "intermittent", "*all*", "0.7", "0.08", "correct_coverage", *coverage, coverage[0] / coverage[1]),
        ("U1", "adaptive", "intermittent", "*all*", "0.7", "0.08", "questions_mean", "", 10, 3.5),
        ("U1", "adaptive", "random-uniform", "", "", "", "labelled_rate", *labelled, labelled[0] / labelled[1]),
        ("U1", "fixed", "random-uniform", "", "", "", "labelled_rate", 9, 10, 0.9),  # not adaptive: ignored
    ]
    with (run / "metrics.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(FIELDS)
        for r in rows:
            writer.writerow([*r, "", ""])
    return run


class CompareTests(unittest.TestCase):
    def test_runs_side_by_side_with_numerators_and_denominators(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base = write_run(root, "base", 0.8, (8, 10), (5, 10))
            strict = write_run(root, "strict", 0.9, (6, 10), (2, 10))
            text = report([base, strict])
        self.assertIn("base: theta 0.8, min_support 2; strict: theta 0.9, min_support 2", text)
        self.assertIn("| Holders, apply 0.7: correct coverage | 80.0% (8/10) | 60.0% (6/10) |", text)
        self.assertIn("| Holders, apply 0.7: questions mean | 3.50 | 3.50 |", text)
        self.assertIn("| Adverse random-uniform: labelled | 50.0% (5/10) | 20.0% (2/10) |", text)
        self.assertIn("| Adverse always-A: labelled | — | — |", text)  # missing rows are shown, not invented
        self.assertNotIn("90.0%", text)  # fixed-method rows are not mixed in


if __name__ == "__main__":
    unittest.main()
