"""Independent arithmetic checks for the pure diagnostic calculations."""

import unittest

import numpy as np

from sonder_engine import (
    Item, Params, check_p1, likelihood_matrix, prior, update_posterior,
    validate_hypotheses,
)


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
                    ("NONE", "UNMODELLED"), tuple(f"M{x}" for x in range(9)) + ("NONE", "UNMODELLED")]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                validate_hypotheses(bad)

    def test_seven_and_eight_misconception_units_have_valid_priors(self):
        for k in (7, 8):
            with self.subTest(k=k):
                hyps = tuple(f"M{x}" for x in range(k)) + ("NONE", "UNMODELLED")
                np.testing.assert_allclose(prior(hyps, Params()), [0.70 / k] * k + [0.25, 0.05])
        with self.assertRaisesRegex(ValueError, "one to 6"):
            prior(tuple(f"M{x}" for x in range(7)) + ("NONE", "UNMODELLED"), Params(k_max=6))

    def test_invalid_assumptions_are_rejected(self):
        for kwargs in ({"slip": 0.0}, {"guess": 1.0}, {"prior_none": float("nan")},
                       {"prior_unmodelled": float("inf")},
                       {"slip": np.nextafter(0.0, 1.0)},
                       {"guess": np.nextafter(0.0, 1.0)},
                       {"prior_unmodelled": np.nextafter(0.0, 1.0)},
                       {"prior_none": 0.80, "prior_unmodelled": 0.25},
                       {"theta": 0.5}, {"theta": 0.6, "theta_unmodelled": 0.4},
                       {"min_support": 0}, {"min_support": True},
                       {"min_support": 4, "min_support_none": 3},
                       {"delta_sep": 0.5}, {"eig_floor": -0.01},
                       {"default_budget": 0}, {"k_max": 9}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                Params(**kwargs)

    def test_smallest_accepted_assumptions_stay_representable(self):
        params = Params(slip=1e-12, guess=1e-12,
                        prior_none=1e-12, prior_unmodelled=1e-12)
        hyps = ("M1", "NONE", "UNMODELLED")
        item = Item("Q", ("A", "B", "C", "D"), 0, ((), ("M1",), (), ()))
        p = prior(hyps, params)
        L = likelihood_matrix(item, hyps, params)
        self.assertTrue(np.all(p > 0))
        self.assertTrue(np.all(L > 0))
        self.assertAlmostEqual(float(p.sum()), 1.0, places=12)
        np.testing.assert_allclose(L.sum(axis=1), 1.0, atol=1e-12)

    def test_item_rejects_invalid_mapping(self):
        good = Item("Q1", ("A", "B", "C", "D"), 0, ((), ("M1",), (), ()))
        self.assertEqual(good.links[1], ("M1",))
        with self.assertRaises(ValueError):
            Item("Q1", ("A", "B", "C", "D"), 0, (("M1",), (), (), ()))
        three_link = Item("Q1", ("A", "B", "C", "D"), 0,
                          ((), ("M1",), ("M1",), ("M1",)))
        self.assertEqual(sum("M1" in links for links in three_link.links), 3)


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

    def test_p1_checks_each_predicted_set_size_at_the_strict_boundary(self):
        hyps = ("M1", "NONE", "UNMODELLED")
        one = Item("one", ("A", "B", "C", "D"), 0, ((), ("M1",), (), ()))
        two = Item("two", ("A", "B", "C", "D"), 0, ((), ("M1",), ("M1",), ()))
        three = Item("three", ("A", "B", "C", "D"), 0,
                     ((), ("M1",), ("M1",), ("M1",)))
        for item, accepted, boundary in ((one, 0.74, 0.75),
                                         (two, 0.49, 0.50),
                                         (three, 0.24, 0.25)):
            with self.subTest(item=item.item_id):
                check_p1((item,), hyps, Params(guess=accepted))
                L = likelihood_matrix(item, hyps, Params(guess=accepted))
                self.assertGreater(L[0, 1], L[0, 0])
                with self.assertRaisesRegex(ValueError, f"{item.item_id}.*M1"):
                    check_p1((item,), hyps, Params(guess=boundary))
        with self.assertRaisesRegex(ValueError, "three.*M1.*< 0.25"):
            likelihood_matrix(three, hyps, Params())


class PosteriorTests(unittest.TestCase):
    def test_independent_hand_calculation_and_no_mutation(self):
        # Synthetic item: answer D yields the explicit joint terms below.
        p = np.array([0.175, 0.175, 0.175, 0.175, 0.25, 0.05], dtype=np.float64)
        L = np.array([
            [0.7, 0.1, 0.1, 0.1],
            [0.7, 0.1, 0.1, 0.1],
            [1 / 30, 1 / 30, 1 / 30, 0.9],
            [0.7, 0.1, 0.1, 0.1],
            [1 / 30, 1 / 30, 1 / 30, 0.9],
            [0.25, 0.25, 0.25, 0.25],
        ], dtype=np.float64)
        p_before, L_before = p.copy(), L.copy()
        # By hand: joint=(.0175,.0175,.1575,.0175,.225,.0125), z=.4475.
        expected = np.array([0.0175, 0.0175, 0.1575, 0.0175, 0.225, 0.0125]) / 0.4475
        actual = update_posterior(p, L, 3)
        np.testing.assert_allclose(actual, expected, rtol=0, atol=1e-15)
        self.assertAlmostEqual(float(actual.sum()), 1.0, places=15)
        np.testing.assert_array_equal(p, p_before)
        np.testing.assert_array_equal(L, L_before)
        np.testing.assert_array_equal(update_posterior(p, L, 3), actual)

    def test_unlinked_answer_increases_unmodelled_mass(self):
        item = Item("Q", ("A", "B", "C", "D"), 0,
                    ((), ("M1",), ("M2",), ()))
        hyps = ("M1", "M2", "NONE", "UNMODELLED")
        p = prior(hyps, Params())
        after = update_posterior(p, likelihood_matrix(item, hyps, Params()), 3)
        self.assertGreater(float(after[-1]), float(p[-1]))
        self.assertAlmostEqual(float(after.sum()), 1.0, places=15)

    def test_invalid_option_and_shapes_fail_clearly(self):
        p = np.array([0.5, 0.5], dtype=np.float64)
        L = np.array([[0.5, 0.5], [0.5, 0.5]], dtype=np.float64)
        for bad in (-1, 2, True, 0.5):
            with self.subTest(bad=bad), self.assertRaisesRegex(ValueError, "invalid_option"):
                update_posterior(p, L, bad)
        with self.assertRaises(ValueError):
            update_posterior(p, L[:1], 0)
        with self.assertRaises(ValueError):
            update_posterior(p.astype(np.float32), L, 0)

    def test_invalid_probability_inputs_fail_clearly(self):
        p = np.array([0.5, 0.5], dtype=np.float64)
        L = np.array([[0.5, 0.5], [0.5, 0.5]], dtype=np.float64)
        for bad_p in ([0.7, 0.7], [float("nan"), 0.5], [-0.5, 1.5]):
            with self.subTest(p=bad_p), self.assertRaises(ValueError):
                update_posterior(np.array(bad_p, dtype=np.float64), L, 0)
        for bad_L in ([[0.4, 0.4], [0.5, 0.5]],
                      [[float("inf"), 0.5], [0.5, 0.5]],
                      [[-0.5, 1.5], [0.5, 0.5]]):
            with self.subTest(L=bad_L), self.assertRaises(ValueError):
                update_posterior(p, np.array(bad_L, dtype=np.float64), 0)

    def test_zero_evidence_is_hard_error(self):
        p = np.array([0.5, 0.5], dtype=np.float64)
        L = np.array([[0.0, 1.0], [0.0, 1.0]], dtype=np.float64)
        with self.assertRaisesRegex(FloatingPointError, "zero_evidence"):
            update_posterior(p, L, 0)


if __name__ == "__main__":
    unittest.main()
