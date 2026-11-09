"""Retained adverse cases, synthetic student policies and the experiment harness (I2-A01).

The adverse outcomes are pinned together with the content hashes and parameters
they were recorded with. The policy and harness tests check that the
experiment-side students answer exactly as documented and that the harness drives
the real run loop the same way the existing engine test helpers do. All students
are synthetic; nothing here measures accuracy.
"""

from __future__ import annotations

import csv
import json
import tempfile
import unittest
from collections import Counter
from pathlib import Path

import numpy as np

from experiments.adverse_baseline import cases, write_baseline
from experiments.harness import item_rng, predicted_label, result_row, run_session, RESULT_FIELDS
from experiments.policies import (
    always_option,
    deterministic,
    intermittent,
    none_student,
    partial_holder,
    random_uniform,
)
from sonder_engine import Item, Outcome, Params
from sonder_pack.maths_v2 import load_maths_v2

from engine_students import deterministic_answer, run_policy, run_student

PACK = load_maths_v2()
RNG = np.random.default_rng(0)  # never used by deterministic policies

# The content and parameters the retained adverse outcomes below were recorded with.
# A content or parameter change must fail here first, so that its effect on the
# adverse cases is reviewed instead of silently absorbed.
PINNED_CONTENT = {
    "content_version": "Maths_v2",
    "bank/items.csv": "af0f75846c763bdc19ee1760ba22e1f4426b27c52ef5933a616f53cd0583b45a",
    "topics.csv": "7d88223803beb462501eb9fa1cb882dd4a44c841324c616bb6de36494d765972",
    "maths_v2_units.json": "61cfff3884738a2fac2621a3443e64455d1104870b2c462c999bf684e4af3e62",
}
PINNED_PARAMS = {
    "slip": 0.10, "guess": 0.30, "prior_none": 0.25, "prior_unmodelled": 0.05,
    "theta": 0.80, "theta_unmodelled": 0.50, "min_support": 2, "min_support_none": 3,
    "delta_sep": 0.05, "eig_floor": 0.01, "default_budget": 8, "k_max": 8,
    "w_sound": 1.0, "w_stretch": 0.5,
}
REBASELINE = ("Content or default parameters changed. Rerun `python -m experiments.adverse_baseline`, "
              "review every changed adverse outcome, update experiments/ADVERSE_CASES.md and these pins "
              "in the same pull request.")

# Retained adverse outcomes (supervisor action 2). Always-A has no named truth: its
# diagnoses are adverse-response labels. The partial MATH-2039 holder's MATH-1965
# label is a wrong diagnosis (KF-07). (outcome, predicted label, questions used)
ALWAYS_A = {
    "U1": ("diagnosed", "MATH-2392", 5), "U2": ("diagnosed", "MATH-61", 4),
    "U3": ("escalated_exhausted", "", 8), "U4": ("diagnosed", "MATH-1416", 4),
    "U5": ("diagnosed", "MATH-952", 4), "U6": ("diagnosed", "MATH-161", 2),
    "U7": ("diagnosed", "MATH-2271", 3),
}
PARTIAL_2039_IN_U2 = ("diagnosed", "MATH-1965", 3)


def all_items():
    seen = {}
    for unit in PACK.units:
        for item in unit.engine_items:
            seen.setdefault(item.item_id, item)
    return list(seen.values())


def triggered(item: Item, misconception: str) -> list[int]:
    return [j for j, links in enumerate(item.links) if misconception in links]


class PinnedAdverseCaseTests(unittest.TestCase):
    def test_content_identity_is_the_recorded_one(self):
        identity = {"content_version": PACK.identity.content_version, **dict(PACK.identity.source_sha256)}
        self.assertEqual(identity, PINNED_CONTENT, REBASELINE)

    def test_default_parameters_are_the_recorded_ones(self):
        params = Params()
        self.assertEqual({name: getattr(params, name) for name in PINNED_PARAMS}, PINNED_PARAMS, REBASELINE)

    def test_always_a_outcomes_are_retained(self):
        for unit in PACK.units:
            with self.subTest(unit=unit.unit_id):
                state = run_session(unit, Params(), always_option(0))
                observed = (state.decision.outcome.value, predicted_label(state), len(state.steps))
                self.assertEqual(observed, ALWAYS_A[unit.unit_id], REBASELINE)

    def test_partial_2039_holder_is_still_labelled_1965(self):
        state = run_session(PACK.unit("U2"), Params(), partial_holder("MATH-2039", "MATH-1965"))
        observed = (state.decision.outcome.value, predicted_label(state), len(state.steps))
        self.assertEqual(observed, PARTIAL_2039_IN_U2, REBASELINE)
        self.assertNotEqual(predicted_label(state), "MATH-2039")  # the truth is not recovered


class PolicyTests(unittest.TestCase):
    def test_deterministic_matches_the_engine_test_student_on_every_item(self):
        for unit in PACK.units:
            for hypothesis in unit.hyps[:-1]:  # every misconception and NONE
                policy = deterministic(hypothesis)
                self.assertEqual(policy.truth, hypothesis)
                for item in unit.engine_items:
                    with self.subTest(unit=unit.unit_id, student=hypothesis, item=item.item_id):
                        self.assertEqual(policy.answer(item, RNG), deterministic_answer(item, hypothesis))

    def test_always_a_has_no_named_truth_and_picks_position_zero(self):
        policy = always_option(0)
        self.assertEqual((policy.name, policy.truth), ("always-A", None))
        self.assertTrue(all(policy.answer(item, RNG) == 0 for item in all_items()))
        for bad in (-1, 4, True, 1.0):
            with self.subTest(index=bad), self.assertRaises(ValueError):
                always_option(bad)

    def test_partial_holder_applies_the_target_only_where_the_companion_agrees(self):
        policy = partial_holder("MATH-2039", "MATH-1965")
        self.assertEqual(policy.truth, "MATH-2039")
        for item in PACK.unit("U2").engine_items:
            with self.subTest(item=item.item_id):
                choice = policy.answer(item, RNG)
                shared = [j for j in triggered(item, "MATH-2039") if j in triggered(item, "MATH-1965")]
                self.assertEqual(choice, shared[0] if shared else item.correct_index)

    def test_none_student_without_slip_is_always_correct(self):
        policy = none_student(0.0)
        self.assertEqual(policy.truth, "NONE")
        for seed, item in enumerate(all_items()):
            self.assertEqual(policy.answer(item, item_rng(seed, item.item_id)), item.correct_index)

    def test_none_student_slips_to_a_wrong_option_at_about_the_stated_rate(self):
        policy = none_student(0.08)
        item = PACK.unit("U1").engine_items[0]
        choices = [policy.answer(item, item_rng(seed, item.item_id)) for seed in range(4000)]
        wrong = sum(choice != item.correct_index for choice in choices)
        self.assertTrue(0.065 <= wrong / 4000 <= 0.095, wrong)  # fixed seeds: not flaky

    def test_intermittent_extremes_reduce_to_simple_students(self):
        for unit in (PACK.unit("U1"), PACK.unit("U2")):
            for target in unit.hyps[:-2]:
                always = intermittent(target, 1.0, 0.0)
                never = intermittent(target, 0.0, 0.0)
                for item in unit.engine_items:
                    with self.subTest(unit=unit.unit_id, target=target, item=item.item_id):
                        linked = triggered(item, target)
                        rng = item_rng(7, item.item_id)
                        self.assertIn(always.answer(item, rng), linked or [item.correct_index])
                        self.assertEqual(never.answer(item, item_rng(7, item.item_id)), item.correct_index)

    def test_intermittent_applies_the_misconception_at_about_the_stated_rate(self):
        item = next(i for i in PACK.unit("U1").engine_items if triggered(i, "MATH-1379"))
        policy = intermittent("MATH-1379", 0.7, 0.0)
        hits = sum(policy.answer(item, item_rng(seed, item.item_id)) in triggered(item, "MATH-1379")
                   for seed in range(4000))
        self.assertTrue(0.67 <= hits / 4000 <= 0.73, hits)

    def test_random_uniform_uses_all_four_options_evenly(self):
        policy = random_uniform()
        self.assertIsNone(policy.truth)
        item = PACK.unit("U4").engine_items[0]
        counts = np.bincount([policy.answer(item, item_rng(seed, item.item_id)) for seed in range(4000)],
                             minlength=4)
        self.assertTrue(all(900 <= c <= 1100 for c in counts), counts)

    def test_rates_outside_zero_to_one_are_refused(self):
        for bad in (-0.1, 1.5, float("nan"), True, "0.5"):
            with self.subTest(rate=bad):
                with self.assertRaises(ValueError):
                    none_student(bad)
                with self.assertRaises(ValueError):
                    intermittent("MATH-1379", bad, 0.0)
        with self.assertRaises(ValueError):
            intermittent("NONE", 0.5, 0.0)


class HarnessTests(unittest.TestCase):
    def test_item_rng_depends_on_seed_and_item_only(self):
        self.assertEqual(item_rng(3, "T1-005").random(5).tolist(), item_rng(3, "T1-005").random(5).tolist())
        self.assertNotEqual(item_rng(3, "T1-005").random(), item_rng(4, "T1-005").random())
        self.assertNotEqual(item_rng(3, "T1-005").random(), item_rng(3, "T1-006").random())
        for bad in (-1, 1.5, True, "1"):
            with self.subTest(seed=bad), self.assertRaises(ValueError):
                item_rng(bad, "T1-005")

    def test_deterministic_students_match_the_existing_engine_harness(self):
        params = Params()
        for unit in PACK.units:
            for hypothesis in unit.hyps[:-1]:
                with self.subTest(unit=unit.unit_id, student=hypothesis):
                    ours = run_session(unit, params, deterministic(hypothesis))
                    theirs = run_student(unit, params, hypothesis)
                    self.assertEqual(ours.steps, theirs.steps)
                    self.assertEqual(ours.decision, theirs.decision)

    def test_always_a_matches_the_existing_engine_harness(self):
        for unit in PACK.units:
            with self.subTest(unit=unit.unit_id):
                ours = run_session(unit, Params(), always_option(0))
                theirs = run_policy(unit, Params(), lambda item: 0)
                self.assertEqual((ours.steps, ours.decision), (theirs.steps, theirs.decision))

    def test_a_seeded_run_is_reproducible(self):
        unit = PACK.unit("U1")
        first = run_session(unit, Params(), random_uniform(), 11)
        second = run_session(unit, Params(), random_uniform(), 11)
        self.assertEqual((first.steps, first.decision), (second.steps, second.decision))

    def test_a_policy_must_return_an_option_index(self):
        bad = always_option(0)
        object.__setattr__(bad, "answer", lambda item, rng: 4)
        with self.assertRaises(ValueError):
            run_session(PACK.unit("U1"), Params(), bad)

    def test_result_row_records_the_run_without_rounding_the_answers(self):
        unit = PACK.unit("U1")
        state = run_session(unit, Params(), deterministic("MATH-1379"))
        row = result_row(unit, deterministic("MATH-1379"), 0, state)
        self.assertEqual(tuple(row), RESULT_FIELDS)
        self.assertTrue(all(isinstance(value, str) for value in row.values()))
        self.assertEqual(row["outcome"], state.decision.outcome.value)
        self.assertEqual(row["items"].split("|"), [s.question.item_id for s in state.steps])
        self.assertEqual(row["predicted"], predicted_label(state))
        self.assertIs(state.decision.outcome, Outcome.DIAGNOSED)
        self.assertEqual(row["predicted"], "MATH-1379")


class AdverseBaselineCommandTests(unittest.TestCase):
    """A small run of the baseline command; the frozen output uses the defaults."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.first = Path(cls.tmp.name) / "first"
        cls.second = Path(cls.tmp.name) / "second"
        cls.record = write_baseline(cls.first, 2, 1)
        write_baseline(cls.second, 2, 1)
        with (cls.first / "runs.csv").open(encoding="utf-8", newline="") as handle:
            cls.rows = list(csv.DictReader(handle))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_the_same_command_writes_identical_raw_results(self):
        for name in ("runs.csv", "summary.csv"):
            with self.subTest(file=name):
                self.assertEqual((self.first / name).read_bytes(), (self.second / name).read_bytes())

    def test_every_case_is_present(self):
        per_policy = Counter(row["policy"] for row in self.rows)
        self.assertEqual(per_policy["deterministic"], 43)  # spec v2 6.1
        self.assertEqual(per_policy["always-A"], 7)
        self.assertEqual(per_policy["partial-holder"], 1)
        self.assertEqual(per_policy["none-with-slip"], 7 * 2)
        self.assertEqual(per_policy["random-uniform"], 7 * 2)
        u1_u2 = len(PACK.unit("U1").hyps) - 2 + len(PACK.unit("U2").hyps) - 2
        self.assertEqual(per_policy["intermittent"], u1_u2 * 3 * 1)
        self.assertEqual(len(self.rows), self.record["row_count"])

    def test_raw_rows_agree_with_the_pinned_cases(self):
        always = {row["unit_id"]: (row["outcome"], row["predicted"], int(row["questions_used"]))
                  for row in self.rows if row["policy"] == "always-A"}
        self.assertEqual(always, ALWAYS_A)
        partial = next(row for row in self.rows if row["policy"] == "partial-holder")
        self.assertEqual((partial["outcome"], partial["predicted"], int(partial["questions_used"])),
                         PARTIAL_2039_IN_U2)

    def test_summary_counts_every_run_once(self):
        with (self.first / "summary.csv").open(encoding="utf-8", newline="") as handle:
            total = sum(int(row["runs"]) for row in csv.DictReader(handle))
        self.assertEqual(total, len(self.rows))

    def test_manifest_names_code_content_and_parameters(self):
        manifest = json.loads((self.first / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["source_sha256"], {k: v for k, v in PINNED_CONTENT.items()
                                                     if k != "content_version"})
        self.assertEqual(manifest["content_version"], PINNED_CONTENT["content_version"])
        self.assertEqual({k: manifest["params"][k] for k in PINNED_PARAMS}, PINNED_PARAMS)
        self.assertEqual(manifest["seeds"]["reserved_for_protocol"],
                         {"tuning": [1000, 1999], "held_out": [2000, 2999]})
        self.assertIn("not diagnostic accuracy", manifest["note"])

    def test_seed_counts_are_bounded_below_the_reserved_ranges(self):
        for runs, intermittent_runs in ((0, 1), (1, 0), (1001, 1), (1, 1001), (True, 1)):
            with self.subTest(runs=runs, intermittent_runs=intermittent_runs):
                with self.assertRaises(ValueError):
                    list(cases(PACK, runs, intermittent_runs))


if __name__ == "__main__":
    unittest.main()
