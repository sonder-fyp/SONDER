"""Independent arithmetic checks for the pure diagnostic calculations."""

import unittest

import numpy as np

from sonder_engine import Item, Params, prior, validate_hypotheses


class ContractAndPriorTests(unittest.TestCase):
    def test_four_misconceptions_match_hand_computed_prior(self):
        hyps = ("M1", "M2", "M3", "M4", "NONE", "UNMODELLED")
        actual = prior(hyps, Params())
        np.testing.assert_array_equal(actual, [0.175] * 4 + [0.25, 0.05])
        self.assertEqual(actual.dtype, np.float64)
        self.assertAlmostEqual(float(actual.sum()), 1.0, places=15)

    def test_alternative_assumed_prior_is_explicit_and_normalized(self):
        hyps = ("M1", "M2", "NONE", "UNMODELLED")
        actual = prior(hyps, Params(prior_none=0.20, prior_unmodelled=0.10))
        np.testing.assert_allclose(actual, [0.35, 0.35, 0.20, 0.10], atol=1e-15)

    def test_hypothesis_order_and_range_are_checked(self):
        for bad in [("NONE", "M1", "UNMODELLED"), ("M1", "NONE", "NONE"),
                    ("NONE", "UNMODELLED"), tuple(f"M{x}" for x in range(7)) + ("NONE", "UNMODELLED")]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                validate_hypotheses(bad)

    def test_invalid_assumptions_are_rejected(self):
        for kwargs in ({"slip": 0.0}, {"guess": 0.5}, {"prior_none": float("nan")},
                       {"prior_unmodelled": float("inf")},
                       {"prior_none": 0.80, "prior_unmodelled": 0.25}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                Params(**kwargs)

    def test_item_rejects_invalid_mapping(self):
        good = Item("Q1", ("A", "B", "C", "D"), 0, ((), ("M1",), (), ()))
        self.assertEqual(good.links[1], ("M1",))
        with self.assertRaises(ValueError):
            Item("Q1", ("A", "B", "C", "D"), 0, (("M1",), (), (), ()))
        with self.assertRaises(ValueError):
            Item("Q1", ("A", "B", "C", "D"), 0, ((), ("M1",), ("M1",), ("M1",)))


if __name__ == "__main__":
    unittest.main()
