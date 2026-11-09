"""The equal-budget comparison runner follows experiments/PROTOCOL.md (I2-A07 to I2-A09)."""

from __future__ import annotations

import copy
import csv
import json
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from experiments.evaluate import EVAL_FIELDS, ConfigError, config_sha256, evaluate, plan, validate
from experiments.content import canonical_source_sha256
from sonder_pack.maths_v2 import load_maths_v2

ROOT = Path(__file__).resolve().parents[1]
PACK = load_maths_v2()
SMALL = {
    "name": "small-check", "protocol_version": 1, "split": "tuning",
    "units": ["U1", "U2"], "methods": ["adaptive", "fixed", "random"],
    "seeds": {"first": 1000, "count": 3},
    "cases": [
        {"policy": "intermittent", "apply_rates": [0.7], "slip": 0.08},
        {"policy": "none-with-slip", "slip": 0.08},
        {"policy": "always-A"},
        {"policy": "random-uniform"},
        {"policy": "off-catalogue"},
        {"policy": "partial-holder", "target": "MATH-2039", "companion": "MATH-1965", "units": ["U2"]},
    ],
}


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


class ShippedConfigTests(unittest.TestCase):
    def test_the_tuning_and_held_out_configurations_follow_the_protocol(self):
        for name, split, first in (("u1u2-tuning", "tuning", 1000), ("u1u2-heldout", "held-out", 2000)):
            with self.subTest(config=name):
                config = json.loads((ROOT / "experiments" / "configs" / f"{name}.json").read_text(encoding="utf-8"))
                validate(config, PACK)
                self.assertEqual((config["name"], config["split"], config["seeds"]),
                                 (name, split, {"first": first, "count": 300}))
                self.assertEqual(config["units"], ["U1", "U2"])
                self.assertEqual(config["methods"], ["adaptive", "fixed", "random"])

    def test_held_out_generation_differs_from_tuning(self):
        load = lambda n: json.loads((ROOT / "experiments" / "configs" / f"{n}.json").read_text(encoding="utf-8"))
        tuning, held_out = load("u1u2-tuning"), load("u1u2-heldout")
        rates = lambda c: next(x["apply_rates"] for x in c["cases"] if x["policy"] == "intermittent")
        slips = lambda c: {x["slip"] for x in c["cases"] if "slip" in x}
        self.assertFalse(set(rates(tuning)) & set(rates(held_out)))
        self.assertFalse(slips(tuning) & slips(held_out))


class SmallRunTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name)
        cls.config_path = root / "small.json"
        cls.config_path.write_text(json.dumps(SMALL), encoding="utf-8")
        cls.manifest = evaluate(cls.config_path, root / "first")
        evaluate(cls.config_path, root / "second")
        cls.first, cls.second = root / "first", root / "second"
        cls.rows = read_rows(cls.first / "runs.csv")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_the_same_configuration_writes_identical_runs(self):
        self.assertEqual((self.first / "runs.csv").read_bytes(), (self.second / "runs.csv").read_bytes())

    def test_columns_and_row_count(self):
        with (self.first / "runs.csv").open(encoding="utf-8", newline="") as handle:
            self.assertEqual(tuple(next(csv.reader(handle))), EVAL_FIELDS)
        self.assertEqual(len(self.rows), self.manifest["row_count"])
        expected = sum(len(seeds) for _, _, _, seeds in plan(SMALL, PACK))
        self.assertEqual(len(self.rows), expected)

    def test_deterministic_students_run_once_except_under_random_selection(self):
        counts = Counter((r["unit_id"], r["method"], r["policy"]) for r in self.rows
                         if r["policy"] in ("always-A", "partial-holder"))
        for (unit, method, policy), n in counts.items():
            with self.subTest(unit=unit, method=method, policy=policy):
                self.assertEqual(n, 3 if method == "random" else 1)
        self.assertEqual({k[0] for k in counts if k[2] == "partial-holder"}, {"U2"})

    def test_stochastic_cases_run_every_seed_for_every_method_and_misconception(self):
        intermittent = Counter((r["unit_id"], r["method"], r["target"]) for r in self.rows
                               if r["policy"] == "intermittent")
        self.assertEqual(set(intermittent.values()), {3})
        self.assertEqual(len(intermittent), (4 + 5) * 3)  # U1 and U2 misconceptions, three methods

    def test_a_student_answers_an_item_the_same_way_under_every_method(self):
        answers: dict[tuple, str] = {}
        for row in self.rows:
            if row["policy"] != "intermittent":
                continue
            for item, option in zip(row["items"].split("|"), row["answers"].split("|")):
                key = (row["unit_id"], row["target"], row["apply_rate"], row["seed"], item)
                self.assertEqual(answers.setdefault(key, option), option, key)

    def test_the_manifest_identifies_configuration_content_and_code(self):
        self.assertEqual(self.manifest["config_sha256"], config_sha256(self.config_path))
        self.assertEqual(self.manifest["config"], SMALL)
        self.assertEqual(self.manifest["split"], "tuning")
        self.assertEqual(self.manifest["source_sha256"], canonical_source_sha256(PACK))
        self.assertIn("not accuracy on real students", self.manifest["note"])


class ValidationTests(unittest.TestCase):
    def refused(self, change):
        config = copy.deepcopy(SMALL)
        change(config)
        with self.assertRaises(ConfigError):
            validate(config, PACK)

    def test_seeds_must_stay_in_the_split_range(self):
        self.refused(lambda c: c["seeds"].update(first=2000))  # held-out seeds in a tuning run
        self.refused(lambda c: c["seeds"].update(first=1999, count=2))
        self.refused(lambda c: c.update(split="held-out"))  # tuning seeds in a held-out run
        self.refused(lambda c: c["seeds"].update(first=10))  # adverse-baseline seeds

    def test_unknown_or_malformed_entries_are_refused(self):
        self.refused(lambda c: c.update(methods=["adaptive", "greedy"]))
        self.refused(lambda c: c.update(units=["U9"]))
        self.refused(lambda c: c["cases"].append({"policy": "lucky-guess"}))
        self.refused(lambda c: c["cases"][0].update(apply_rates=[1.5]))
        self.refused(lambda c: c["cases"][1].update(slip=-0.1))
        self.refused(lambda c: c["cases"][2].update(slip=0.1))  # always-A takes no slip
        self.refused(lambda c: c.update(extra=True))
        self.refused(lambda c: c.update(protocol_version=2))
        self.refused(lambda c: c.update(name="bad/name"))

    def test_the_small_configuration_itself_is_valid(self):
        validate(copy.deepcopy(SMALL), PACK)


if __name__ == "__main__":
    unittest.main()
