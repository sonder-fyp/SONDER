"""Exact and near likelihood rows under stopping rule R4 (I2-A02).

Supervisor action 3 (16 October 2026): R4 claims that the leader of a tied set C
"can reach at most" p(leader)/p(C). That is exact only when the rows of C are
identical on every remaining item. These cases show where the claim holds, where
it does not, and how twins, the remaining items and the budget interact with R4.

All units here are synthetic or the current Maths_v2 bank at default parameters.
No engine behaviour is changed by this file.
"""

from __future__ import annotations

import unittest
from itertools import combinations, product

import numpy as np

from sonder_engine import (
    Params,
    answer,
    eligible_items,
    likelihood_matrix,
    next_question,
    replay,
    start,
    update_posterior,
)
from sonder_engine.stopping import total_variation
from sonder_pack.maths_v2 import load_maths_v2

from engine_rows import best_ratio, exact_item, make_unit, near_item, reachable_share

HYPS = ("M1", "M2", "NONE", "UNMODELLED")
NEAR = Params(w_stretch=0.95)  # one stretch-graded link sits 0.04 TV from its sound twin


class ReachableShareBoundTests(unittest.TestCase):
    def test_exact_rows_give_a_bound_equal_to_the_current_share(self):
        p = np.array([0.5, 0.4, 0.05, 0.05])
        remaining = [exact_item(f"E{i}") for i in range(6)]
        for answers_left in range(7):
            with self.subTest(answers_left=answers_left):
                self.assertAlmostEqual(reachable_share(p, 0, (0, 1), remaining, answers_left, HYPS, Params()),
                                       0.5 / 0.9, places=15)

    def test_every_best_ratio_is_one_for_exact_rows(self):
        self.assertEqual(best_ratio(exact_item("E"), 0, 1, HYPS, Params()), 1.0)

    def test_near_rows_let_the_bound_grow_with_more_answers(self):
        p = np.array([0.5, 0.4, 0.05, 0.05])
        remaining = [near_item(f"N{i}") for i in range(30)]
        bounds = [reachable_share(p, 0, (0, 1), remaining, k, HYPS, NEAR) for k in range(31)]
        self.assertAlmostEqual(bounds[0], 0.5 / 0.9, places=15)
        self.assertTrue(all(b2 > b1 for b1, b2 in zip(bounds, bounds[1:])))
        self.assertTrue(all(b < 1.0 for b in bounds))

    def test_a_bound_never_falls_below_the_current_share(self):
        # "At most k answers" includes answering nothing, so the bound is never below
        # the current share, whichever member is the lead.
        p = np.array([0.5, 0.4, 0.05, 0.05])
        remaining = [near_item("N1")]
        self.assertGreaterEqual(reachable_share(p, 1, (0, 1), remaining, 1, HYPS, NEAR), 0.4 / 0.9)
        with self.assertRaises(ValueError):
            reachable_share(p, 0, (0, 1), remaining, -1, HYPS, NEAR)


def session_after(unit, params, answers, *, budget=None):
    """Run the real session loop, answering each engine-chosen item with the given options."""

    state = start(unit, params, budget=budget)
    for option in answers:
        state = next_question(state)
        state = answer(state, state.pending.item_id, option)
    return state


def remaining_items(unit, state):
    return eligible_items(unit.engine_items, state.asked_ids)


class RealBankRowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_maths_v2()

    def test_rows_within_tolerance_are_exactly_equal_in_the_current_bank(self):
        # At default parameters every pair of rows is either identical or far apart, so
        # every R4 refusal the current bank can produce is an exact-row refusal, where
        # p(leader)/p(C) is a true ceiling. Link grades or content changes that create
        # near rows make this fail: R4's guarantee must then be revisited (I2-A03).
        params = Params()
        for unit in self.pack.units:
            k = len(unit.hyps) - 2
            for item in unit.engine_items:
                L = likelihood_matrix(item, unit.hyps, params)
                for a, b in combinations(range(k + 1), 2):
                    tv = total_variation(L[a], L[b])
                    with self.subTest(unit=unit.unit_id, item=item.item_id, pair=(unit.hyps[a], unit.hyps[b])):
                        self.assertTrue(tv == 0.0 or tv > params.delta_sep,
                                        f"near rows (TV = {tv:.4f}) now exist; R4's ceiling is not exact for them")

    def test_the_d2_refusal_is_an_exact_row_case(self):
        unit = self.pack.unit("U4")
        state = replay(unit, Params(), ["D", "A"])
        decision = state.decision
        self.assertEqual((decision.rule, decision.tied), ("R4", ("MATH-1514", "MATH-1773")))
        slots = [unit.hyps.index(h) for h in decision.tied]
        for item in remaining_items(unit, state):
            with self.subTest(item=item.item_id):
                L = likelihood_matrix(item, unit.hyps, Params())
                self.assertTrue(np.array_equal(L[slots[0]], L[slots[1]]))


class ExactRowTests(unittest.TestCase):
    """M1 and M2 are linked identically on every item: their odds can never change."""

    @classmethod
    def setUpClass(cls):
        cls.unit = make_unit([exact_item(f"E{i}") for i in range(1, 9)])
        cls.state = session_after(cls.unit, Params(), ["B", "B"])

    def test_two_shared_answers_end_in_r4_with_a_ratio_of_one_half(self):
        decision = self.state.decision
        self.assertEqual((decision.rule, decision.leader, decision.tied, decision.support),
                         ("R4", "M1", ("M1", "M2"), 2))
        self.assertEqual(self.state.posterior[0], self.state.posterior[1])
        self.assertAlmostEqual(decision.ceiling, 0.5, places=15)

    def test_no_answer_sequence_on_the_remaining_items_changes_the_ratio(self):
        remaining = remaining_items(self.unit, self.state)
        start_p = np.array(self.state.posterior)
        for length in (1, 2, 3):
            for options in product(range(4), repeat=length):
                with self.subTest(options=options):
                    p = start_p
                    for item, observed in zip(remaining, options):
                        p = update_posterior(p, likelihood_matrix(item, HYPS, Params()), observed)
                    self.assertAlmostEqual(p[0] / (p[0] + p[1]), self.state.decision.ceiling, places=12)

    def test_the_bound_over_the_whole_budget_equals_the_ratio(self):
        remaining = remaining_items(self.unit, self.state)
        left = self.state.budget - len(self.state.steps)
        bound = reachable_share(np.array(self.state.posterior), 0, (0, 1), remaining, left, HYPS, Params())
        self.assertAlmostEqual(bound, self.state.decision.ceiling, places=15)


if __name__ == "__main__":
    unittest.main()
