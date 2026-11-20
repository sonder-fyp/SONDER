"""Question-selection methods for the equal-budget comparison (I2-A07).

The adaptive path must be the engine's own; the fixed and random methods may change
only which eligible item is presented and its recorded reason. Everything else in a
session (update, stopping, budget, eligibility) stays the engine's.
"""

from __future__ import annotations

import unittest
from collections import Counter
from dataclasses import replace

from experiments.harness import run_session
from experiments.policies import deterministic, random_uniform
from experiments.selection import Adaptive, Fixed, RandomEligible, ask, next_question_with
from sonder_engine import EngineError, Params, answer, eligible_items, next_question, prior, select_next, start
from sonder_pack.maths_v2 import load_maths_v2

PACK = load_maths_v2()


def by_id(unit):
    return {item.item_id: item for item in unit.engine_items}


class AdaptiveEquivalenceTests(unittest.TestCase):
    def test_next_question_with_adaptive_reproduces_the_engine_exactly(self):
        # The same path the engine takes, built from its public pieces, for every
        # deterministic student in every unit.
        params = Params()
        for unit in PACK.units:
            items = by_id(unit)
            for hypothesis in unit.hyps[:-1]:
                with self.subTest(unit=unit.unit_id, student=hypothesis):
                    policy = deterministic(hypothesis)
                    ours = theirs = start(unit, params)
                    while not theirs.finished:
                        theirs = next_question(theirs)
                        ours = next_question_with(ours, Adaptive())
                        self.assertEqual(ours.pending, theirs.pending)
                        item = items[theirs.pending.item_id]
                        option = item.option_ids[policy.answer(item, None)]
                        theirs = answer(theirs, item.item_id, option)
                        ours = answer(ours, item.item_id, option)
                    self.assertEqual((ours.steps, ours.decision), (theirs.steps, theirs.decision))

    def test_ask_uses_the_engine_for_adaptive_and_for_no_method(self):
        state = start(PACK.unit("U1"), Params())
        self.assertEqual(ask(state, None).pending, next_question(state).pending)
        self.assertEqual(ask(state, Adaptive()).pending, next_question(state).pending)


class FixedOrderTests(unittest.TestCase):
    def test_the_order_is_the_eig_ranking_at_the_prior(self):
        for unit in PACK.units:
            with self.subTest(unit=unit.unit_id):
                ranking = select_next(prior(unit.hyps, Params()), unit.engine_items, unit.hyps, Params())
                fixed = Fixed.for_unit(unit, Params())
                self.assertEqual(fixed.order, tuple(item_id for item_id, _ in ranking.ranking))
                self.assertEqual(sorted(fixed.order), sorted(by_id(unit)))

    def test_every_student_gets_the_same_questions_in_the_same_order(self):
        unit = PACK.unit("U1")
        fixed = Fixed.for_unit(unit, Params())
        sequences = []
        for hypothesis in unit.hyps[:-1]:
            state = run_session(unit, Params(), deterministic(hypothesis), method=fixed)
            asked = [step.question.item_id for step in state.steps]
            self.assertEqual(asked, list(fixed.order[:len(asked)]))  # U1 has no twins
            sequences.append(asked)
        self.assertGreater(len({tuple(s) for s in sequences}), 1)  # sessions stop at different points

    def test_ineligible_items_are_skipped(self):
        unit = PACK.unit("U6")  # U6 has twin groups
        fixed = Fixed.for_unit(unit, Params())
        state = run_session(unit, Params(), random_uniform(), 3, method=fixed)
        asked = [step.question.item_id for step in state.steps]
        for n, item_id in enumerate(asked):
            eligible = {i.item_id for i in eligible_items(unit.engine_items, asked[:n])}
            first_eligible = next(i for i in fixed.order if i in eligible)
            self.assertEqual(item_id, first_eligible)

    def test_the_recorded_reason_and_gain_are_the_fixed_choice(self):
        unit = PACK.unit("U2")
        fixed = Fixed.for_unit(unit, Params())
        state = run_session(unit, Params(), random_uniform(), 5, method=fixed)
        for step in state.steps:
            question = step.question
            self.assertTrue(question.selection_reason.startswith("Fixed order: position "))
            self.assertEqual(question.expected_ig, dict((c.item_id, c.eig) for c in question.candidates)[question.item_id])


class RandomSelectionTests(unittest.TestCase):
    def test_the_same_seed_chooses_the_same_items(self):
        unit = PACK.unit("U1")
        first = run_session(unit, Params(), random_uniform(), 7, method=RandomEligible(7))
        second = run_session(unit, Params(), random_uniform(), 7, method=RandomEligible(7))
        self.assertEqual(first.steps, second.steps)

    def test_the_choice_depends_on_the_seed_not_on_the_student(self):
        unit = PACK.unit("U1")
        firsts = set()
        for hypothesis in unit.hyps[:-1]:
            state = run_session(unit, Params(), deterministic(hypothesis), method=RandomEligible(11))
            firsts.add(state.steps[0].question.item_id)
        self.assertEqual(len(firsts), 1)
        other = run_session(unit, Params(), deterministic("NONE"), method=RandomEligible(12))
        self.assertNotEqual(other.steps[0].question.item_id, firsts.pop())

    def test_the_first_choice_is_spread_evenly_over_the_unit(self):
        unit = PACK.unit("U1")
        state = start(unit, Params())
        counts = Counter(next_question_with(state, RandomEligible(seed)).pending.item_id for seed in range(4000))
        self.assertEqual(set(counts), set(by_id(unit)))
        self.assertTrue(all(150 <= n <= 250 for n in counts.values()), counts)  # 200 expected each

    def test_every_choice_is_eligible_and_recorded_truthfully(self):
        for unit in (PACK.unit("U4"), PACK.unit("U6")):
            for seed in range(30):
                state = run_session(unit, Params(), random_uniform(), seed, method=RandomEligible(seed))
                asked = [step.question.item_id for step in state.steps]
                for n, step in enumerate(state.steps):
                    with self.subTest(unit=unit.unit_id, seed=seed, step=n):
                        eligible = {i.item_id for i in eligible_items(unit.engine_items, asked[:n])}
                        self.assertIn(step.question.item_id, eligible)
                        self.assertTrue(step.question.selection_reason.startswith("Random choice among "))

    def test_a_negative_seed_is_refused(self):
        for bad in (-1, True, 1.5):
            with self.subTest(seed=bad), self.assertRaises(ValueError):
                RandomEligible(bad)


class SharedBehaviourTests(unittest.TestCase):
    def test_every_method_respects_the_budget_and_ends_with_an_engine_decision(self):
        unit = PACK.unit("U2")
        for method in (None, Fixed.for_unit(unit, Params()), RandomEligible(4)):
            for seed in range(20):
                state = run_session(unit, Params(), random_uniform(), seed, method=method)
                with self.subTest(method=getattr(method, "name", "adaptive"), seed=seed):
                    self.assertTrue(state.finished)
                    self.assertLessEqual(len(state.steps), state.budget)

    def test_a_pending_question_is_kept_and_a_finished_session_is_refused(self):
        unit = PACK.unit("U1")
        pending = next_question_with(start(unit, Params()), RandomEligible(1))
        self.assertIs(next_question_with(pending, RandomEligible(2)), pending)
        finished = run_session(unit, Params(), deterministic("MATH-1379"), method=Fixed.for_unit(unit, Params()))
        with self.assertRaises(EngineError):
            next_question_with(finished, RandomEligible(1))

    def test_a_method_cannot_present_an_ineligible_item(self):
        class Asked(Adaptive):
            name = "broken"

            def choose(self, state, eligible, ranking):
                return "T9-999", "not an item of this unit"

        with self.assertRaises(ValueError):
            next_question_with(start(PACK.unit("U1"), Params()), Asked())

    def test_the_session_state_is_otherwise_unchanged(self):
        state = start(PACK.unit("U1"), Params())
        chosen = next_question_with(state, RandomEligible(9))
        self.assertEqual(replace(chosen, pending=None), state)


if __name__ == "__main__":
    unittest.main()
