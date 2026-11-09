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

import numpy as np

from sonder_engine import Params

from engine_rows import best_ratio, exact_item, near_item, reachable_share

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


if __name__ == "__main__":
    unittest.main()
