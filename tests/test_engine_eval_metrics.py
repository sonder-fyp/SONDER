"""Metrics computed from raw runs only (I2-A09; experiments/PROTOCOL.md section 7)."""

from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from experiments.evaluate import evaluate
from experiments.metrics import (
    POOLED,
    bootstrap_mean,
    classify,
    compute,
    wilson,
    write_metrics,
)


def run(truth="MATH-1", outcome="diagnosed", predicted="MATH-1", exhausted_by="", questions="4",
        policy="intermittent", target="MATH-1", apply_rate="0.7", method="adaptive", unit="U1"):
    return {"unit_id": unit, "method": method, "policy": policy, "target": target,
            "apply_rate": apply_rate, "slip": "0.08", "truth": truth, "seed": "1000",
            "questions_used": questions, "items": "", "answers": "", "outcome": outcome, "rule": "",
            "predicted": predicted, "leader": "", "leader_probability": "", "tied": "",
            "exhausted_by": exhausted_by}


def metric(rows, name, target="MATH-1"):
    found = [m for m in rows if m["metric"] == name and m["target"] == target]
    assert len(found) == 1, (name, target, found)
    return found[0]


class WilsonTests(unittest.TestCase):
    def test_reference_values(self):
        # Standard Wilson score intervals (z = 1.96).
        for (s, n), (low, high) in {(5, 10): (0.236593, 0.763407), (0, 10): (0.0, 0.277533),
                                    (10, 10): (0.722467, 1.0)}.items():
            with self.subTest(successes=s, n=n):
                got = wilson(s, n)
                self.assertAlmostEqual(got[0], low, places=6)
                self.assertAlmostEqual(got[1], high, places=6)

    def test_half_width_at_300_runs_is_about_5_7_points(self):
        low, high = wilson(150, 300)
        self.assertAlmostEqual((high - low) / 2, 0.0561, places=3)  # protocol section 5

    def test_invalid_counts_are_refused(self):
        for s, n in ((1, 0), (-1, 5), (6, 5)):
            with self.subTest(successes=s, n=n), self.assertRaises(ValueError):
                wilson(s, n)


class BootstrapTests(unittest.TestCase):
    def test_it_is_reproducible_and_contains_the_mean(self):
        values = [2, 3, 3, 4, 8, 8, 5, 4]
        first, second = bootstrap_mean(values), bootstrap_mean(values)
        self.assertEqual(first, second)
        self.assertLess(first[0], sum(values) / len(values))
        self.assertGreater(first[1], sum(values) / len(values))

    def test_constant_values_give_a_degenerate_interval(self):
        self.assertEqual(bootstrap_mean([5, 5, 5]), (5.0, 5.0))

    def test_a_single_value_is_refused(self):
        with self.assertRaises(ValueError):
            bootstrap_mean([4])


class ClassificationTests(unittest.TestCase):
    def test_every_category(self):
        cases = {
            ("MATH-1", "diagnosed", "MATH-1", ""): "correct",
            ("MATH-1", "diagnosed", "MATH-2", ""): "wrong",
            ("MATH-1", "none_detected", "NONE", ""): "missed",
            ("NONE", "none_detected", "NONE", ""): "none_detected",
            ("NONE", "diagnosed", "MATH-2", ""): "false_label",
            ("", "diagnosed", "MATH-2", ""): "labelled",
            ("", "none_detected", "NONE", ""): "none_detected",
            ("MATH-1", "escalated_unmodelled", "", ""): "refused:R3",
            ("MATH-1", "escalated_no_separator", "", ""): "refused:R4",
            ("MATH-1", "escalated_exhausted", "", "budget"): "refused:R5:budget",
            ("", "escalated_exhausted", "", "eig_floor"): "refused:R5:eig_floor",
        }
        for (truth, outcome, predicted, by), expected in cases.items():
            with self.subTest(truth=truth, outcome=outcome, predicted=predicted):
                self.assertEqual(classify(run(truth, outcome, predicted, by)), expected)

    def test_an_unknown_outcome_is_refused(self):
        with self.assertRaises(ValueError):
            classify(run(outcome="in_progress"))


class ComputeTests(unittest.TestCase):
    def test_holder_metrics_and_denominators(self):
        rows = [run(), run(), run(predicted="MATH-2"), run(outcome="none_detected", predicted="NONE"),
                run(outcome="escalated_no_separator", predicted=""),
                run(outcome="escalated_exhausted", predicted="", exhausted_by="eig_floor", questions="8")]
        metrics = compute(rows)
        expect = {"wrong_diagnosis_rate": (1, 3), "coverage": (3, 6), "correct_coverage": (2, 6),
                  "missed_rate": (1, 6), "refusal_rate": (2, 6), "refusal:R4": (1, 6),
                  "refusal:R5:eig_floor": (1, 6), "refusal:R3": (0, 6)}
        for name, (num, den) in expect.items():
            with self.subTest(metric=name):
                m = metric(metrics, name)
                self.assertEqual((int(m["numerator"]), int(m["denominator"])), (num, den))
                self.assertAlmostEqual(float(m["value"]), num / den, places=6)
                low, high = wilson(num, den)
                self.assertAlmostEqual(float(m["ci_low"]), low, places=6)
                self.assertAlmostEqual(float(m["ci_high"]), high, places=6)
        mean = metric(metrics, "questions_mean")
        self.assertEqual((mean["numerator"], mean["denominator"]), ("28", "6"))
        self.assertAlmostEqual(float(mean["value"]), 28 / 6, places=6)
        self.assertEqual(metric(metrics, "questions_median")["value"], "4.000000")

    def test_none_and_no_named_truth_classes_are_never_scored_as_correct(self):
        none_rows = [run(truth="NONE", policy="none-with-slip", target="", outcome="none_detected",
                         predicted="NONE"),
                     run(truth="NONE", policy="none-with-slip", target="", predicted="MATH-2")]
        adverse = [run(truth="", policy="random-uniform", target="", predicted="MATH-2"),
                   run(truth="", policy="random-uniform", target="", predicted="MATH-2"),
                   run(truth="", policy="random-uniform", target="", predicted="MATH-3"),
                   run(truth="", policy="random-uniform", target="", outcome="none_detected", predicted="NONE")]
        metrics = compute(none_rows + adverse)
        names = {m["metric"] for m in metrics}
        self.assertNotIn("correct_coverage", names)
        self.assertNotIn("wrong_diagnosis_rate", names)
        nonef = [m for m in metrics if m["policy"] == "none-with-slip"]
        self.assertEqual(metric(nonef, "false_label_rate", "")["numerator"], "1")
        adv = [m for m in metrics if m["policy"] == "random-uniform"]
        self.assertEqual((metric(adv, "labelled_rate", "")["numerator"],
                          metric(adv, "label:MATH-2", "")["numerator"],
                          metric(adv, "label:MATH-3", "")["numerator"]), ("3", "2", "1"))

    def test_pooled_intermittent_groups_add_up_the_misconceptions(self):
        rows = [run(target="MATH-1", truth="MATH-1"), run(target="MATH-1", truth="MATH-1", predicted="MATH-2"),
                run(target="MATH-2", truth="MATH-2", predicted="MATH-2"),
                run(target="MATH-2", truth="MATH-2", outcome="none_detected", predicted="NONE")]
        metrics = compute(rows)
        pooled = metric(metrics, "coverage", POOLED)
        self.assertEqual((pooled["numerator"], pooled["denominator"]), ("3", "4"))
        self.assertEqual(metric(metrics, "wrong_diagnosis_rate", POOLED)["numerator"], "1")

    def test_a_single_run_gets_no_interval(self):
        metrics = compute([run(policy="always-A", target="", truth="", predicted="MATH-2")])
        for m in metrics:
            with self.subTest(metric=m["metric"]):
                self.assertEqual((m["ci_low"], m["ci_high"]), ("", ""))

    def test_a_group_mixing_truth_classes_is_refused(self):
        with self.assertRaises(ValueError):
            compute([run(truth="MATH-1"), run(truth="NONE")])


class FromRunsOnlyTests(unittest.TestCase):
    def test_the_runner_writes_metrics_that_recompute_from_runs_csv(self):
        config = {"name": "metric-check", "protocol_version": 1, "split": "tuning", "units": ["U1"],
                  "methods": ["adaptive", "random"], "seeds": {"first": 1000, "count": 4},
                  "cases": [{"policy": "intermittent", "apply_rates": [0.7], "slip": 0.08},
                            {"policy": "random-uniform"}]}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "c.json"
            path.write_text(json.dumps(config), encoding="utf-8")
            evaluate(path, Path(tmp) / "out")
            written = (Path(tmp) / "out" / "metrics.csv").read_bytes()
            write_metrics(Path(tmp) / "out")
            self.assertEqual((Path(tmp) / "out" / "metrics.csv").read_bytes(), written)
            with (Path(tmp) / "out" / "metrics.csv").open(encoding="utf-8", newline="") as handle:
                rows = list(csv.DictReader(handle))
            self.assertTrue(rows)
            self.assertTrue(all(m["denominator"] for m in rows))


if __name__ == "__main__":
    unittest.main()
