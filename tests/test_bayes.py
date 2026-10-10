"""Independent arithmetic checks for the pure diagnostic calculations."""

import unittest

import numpy as np

from sonder_engine import Item, Params, likelihood_matrix, prior, validate_hypotheses


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


class LikelihoodTests(unittest.TestCase):
    def test_shared_and_two_option_links_have_independent_hand_rows(self):
        item = Item("Q1", ("A", "B", "C", "D"), 0,
                    ((), ("M1", "M2"), ("M1",), ()))
        hyps = ("M1", "M2", "M3", "NONE", "UNMODELLED")
        actual = likelihood_matrix(item, hyps, Params())
        expected = np.array([
            [0.15, 0.35, 0.35, 0.15],  # M1: two predicted options
            [0.10, 0.70, 0.10, 0.10],  # M2: same B, full predicted mass
            [0.90, 1 / 30, 1 / 30, 1 / 30],  # M3 not triggered
            [0.90, 1 / 30, 1 / 30, 1 / 30],  # NONE
            [0.25, 0.25, 0.25, 0.25],  # UNMODELLED
        ], dtype=np.float64)
        np.testing.assert_allclose(actual, expected, rtol=0, atol=1e-15)
        self.assertEqual(actual.dtype, np.float64)
        np.testing.assert_allclose(actual.sum(axis=1), 1.0, rtol=0, atol=1e-15)
        self.assertTrue(np.all(actual > 0))

    def test_unlinked_wrong_option_has_only_off_prediction_mass(self):
        item = Item("Q2", ("A", "B", "C", "D"), 0,
                    ((), ("M1",), (), ()))
        actual = likelihood_matrix(item, ("M1", "NONE", "UNMODELLED"), Params())
        np.testing.assert_allclose(actual[:, 3], [0.10, 1 / 30, 0.25], atol=1e-15)

    def test_unknown_link_is_not_silently_ignored(self):
        item = Item("Q3", ("A", "B", "C", "D"), 0,
                    ((), ("MISSING",), (), ()))
        with self.assertRaisesRegex(ValueError, "undeclared"):
            likelihood_matrix(item, ("M1", "NONE", "UNMODELLED"), Params())

    def test_three_predicted_options_are_rejected_by_item_contract(self):
        # With guess=.30, three predicted answers would each get .70/3,
        # less than the unpredicted answer's .30. Draft V11 excludes this.
        with self.assertRaises(ValueError):
            Item("Q4", ("A", "B", "C", "D"), 0,
                 ((), ("M1",), ("M1",), ("M1",)))


if __name__ == "__main__":
    unittest.main()
