"""Synthetic student policies and the experiment harness (I2-A01).

These tests check that the experiment-side students answer exactly as documented
and that the harness drives the real run loop the same way the existing engine
test helpers do. All students are synthetic; nothing here measures accuracy.
"""

from __future__ import annotations

import unittest

import numpy as np

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


def all_items():
    seen = {}
    for unit in PACK.units:
        for item in unit.engine_items:
            seen.setdefault(item.item_id, item)
    return list(seen.values())


def triggered(item: Item, misconception: str) -> list[int]:
    return [j for j, links in enumerate(item.links) if misconception in links]


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


if __name__ == "__main__":
    unittest.main()
