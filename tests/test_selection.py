"""Checks for question selection (spec sections 3.4 and the earlier draft's 5.2).

Hand values use only the definitions: entropy in bits and expected information
gain as the mutual information between the hypothesis and the observed option.
The "reference" helpers below are deliberately separate from sonder_engine: pure
Python lists and exact fractions, so they share no code with the module under test.
"""

import csv
import math
import random
import unittest
from collections import defaultdict
from decimal import Decimal, getcontext
from fractions import Fraction
from pathlib import Path

import numpy as np

from sonder_engine import Item, Params, likelihood_matrix, prior, update_posterior
from sonder_engine import selection
from sonder_engine.selection import entropy_bits, expected_information_gain, select_next

HYPS = ("M1", "M2", "NONE", "UNMODELLED")
DATA = Path(__file__).resolve().parents[1] / "data" / "Maths_v2"


def make_item(item_id, links, correct=0):
    """Four options A-D; ``links`` gives the misconception IDs on each option."""
    return Item(item_id, ("A", "B", "C", "D"), correct, tuple(tuple(x) for x in links))


# B -> M1, C -> M2, D unlinked: every state answers differently.
SEPARATING = make_item("sep", [(), ("M1",), ("M2",), ()])
# B -> M1 and M2 together: they answer identically, so M1 vs M2 is not resolved.
SHARED = make_item("shared", [(), ("M1", "M2"), (), ()])
# Same structure as SEPARATING with the wrong options in another order.
SEPARATING_PERMUTED = make_item("sep_permuted", [(), (), ("M2",), ("M1",)])
# Nothing linked: M1, M2 and NONE all predict the correct option.
UNLINKED = make_item("unlinked", [(), (), (), ()])


# --------------------------------------------------------------------------- real-bank helpers
def load_unit(topic_labels, misconception_ids):
    """Read-only adapter for these tests: approved bank items, in file order, for some topic labels."""
    rows = defaultdict(list)
    with (DATA / "bank" / "items.csv").open(newline="", encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            if row["topic"] in topic_labels and row["status"] == "approved":
                rows[row["item_id"]].append(row)
    items = []
    for item_id, option_rows in rows.items():
        option_rows.sort(key=lambda row: row["option_id"])
        correct = [i for i, row in enumerate(option_rows) if row["is_correct"] == "True"]
        items.append(Item(
            item_id,
            tuple(row["option_id"] for row in option_rows),
            correct[0],
            tuple(tuple(filter(None, row["misconceptions"].split("|"))) for row in option_rows),
        ))
    return tuple(misconception_ids) + ("NONE", "UNMODELLED"), items


def topic_misconceptions():
    found = defaultdict(list)
    with (DATA / "topics.csv").open(newline="", encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            found[row["topic"]].append(row["MisconceptionId"])
    return found


def real_units():
    """The spec's units U1-U5 (those the current model accepts), as (hypotheses, items)."""
    t = topic_misconceptions()
    spec = {
        "U1": ({"T1 Rounding"}, t["T1 Rounding"]),
        "U2": ({"T2 Fractions, decimals and percentage conversion"},
               t["T2 Fractions, decimals and percentage conversion"]),
        "U3": ({"T3 Percentage of an amount"},
               t["T3 Percentage of an amount"] + ["MATH-1074", "MATH-1651", "MATH-2359"]),
        "U4": ({"T4 Choosing the operation", "T5 cross-concept (operation version)"},
               ["MATH-126", "MATH-228", "MATH-1416", "MATH-1514", "MATH-1773", "MATH-2093"]),
        "U5": ({"T5 Powers and roots"}, t["T5 Powers and roots"]),
    }
    return {name: load_unit(labels, ids) for name, (labels, ids) in spec.items()}


def replay(hyps, items, answers):
    """Select, then apply the student's scripted answer, one step at a time."""
    params = Params()
    p = prior(hyps, params)
    remaining = list(items)
    steps = []
    for letter in answers:
        chosen = select_next(p, remaining, hyps, params)
        item = next(i for i in remaining if i.item_id == chosen.item_id)
        p = update_posterior(p, likelihood_matrix(item, hyps, params), item.option_ids.index(letter))
        steps.append((chosen.item_id, chosen.eig, p))
        remaining.remove(item)
    return steps


# --------------------------------------------------------------------------- independent reference
def reference_rows(item, hyps, slip, guess):
    """Spec 3.1 written from scratch with exact fractions: P(option | hypothesis)."""
    rows = []
    for h in hyps[:-2]:
        predicted = {j for j, links in enumerate(item.links) if h in links}
        miss = guess if predicted else slip
        predicted = predicted or {item.correct_index}
        rows.append([(1 - miss) / len(predicted) if o in predicted else miss / (4 - len(predicted))
                     for o in range(4)])
    rows.append([1 - slip if o == item.correct_index else slip / 3 for o in range(4)])  # NONE
    rows.append([Fraction(1, 4)] * 4)  # UNMODELLED
    return rows


def reference_eig_decimal(p, rows):
    """EIG in bits with 60-digit decimal logarithms, from exact fractions."""
    getcontext().prec = 60
    dec = lambda f: Decimal(f.numerator) / Decimal(f.denominator)
    answer_probability = [sum(p[h] * rows[h][o] for h in range(len(p))) for o in range(4)]
    ln2 = Decimal(2).ln()
    total = Decimal(0)
    for h in range(len(p)):
        for o in range(4):
            if p[h] * rows[h][o] > 0:
                total += dec(p[h] * rows[h][o]) * (dec(rows[h][o] / answer_probability[o]).ln() / ln2)
    return total


def reference_eig_float(p, rows):
    answer_probability = [sum(p[h] * rows[h][o] for h in range(len(p))) for o in range(4)]
    return sum(p[h] * rows[h][o] * math.log2(rows[h][o] / answer_probability[o])
               for h in range(len(p)) for o in range(4) if p[h] * rows[h][o] > 0)


def reference_choice(p, items, hyps, params):
    """Highest rounded EIG, earliest on ties, using only the reference helpers."""
    slip, guess = Fraction(str(params.slip)), Fraction(str(params.guess))
    scored = []
    for position, item in enumerate(items):
        rows = [[float(x) for x in row] for row in reference_rows(item, hyps, slip, guess)]
        scored.append((round(reference_eig_float(list(p), rows), 9), position, item.item_id))
    return [item_id for _, _, item_id in sorted(scored, key=lambda t: (-t[0], t[1]))]


def student_answer(item, believed):
    """A deterministic student: takes the option linked to its misconception, else the correct one."""
    if believed is not None:
        for j, links in enumerate(item.links):
            if believed in links:
                return j
    return item.correct_index


# --------------------------------------------------------------------------- tests
class EntropyTests(unittest.TestCase):
    def test_uniform_over_four_is_two_bits(self):
        self.assertAlmostEqual(entropy_bits(np.full(4, 0.25)), 2.0, places=15)

    def test_certainty_is_zero_bits_and_zero_mass_is_ignored(self):
        self.assertEqual(entropy_bits(np.array([1.0, 0.0, 0.0])), 0.0)

    def test_default_six_state_prior_matches_spec_example(self):
        # Spec D1 gives H = 2.4763 bits for (.175, .175, .175, .175, .25, .05).
        prior_vector = np.array([0.175] * 4 + [0.25, 0.05])
        self.assertAlmostEqual(entropy_bits(prior_vector), 2.4763, places=4)

    def test_rejects_unnormalised_or_invalid_input(self):
        for bad in (np.array([0.5, 0.4]), np.array([1.5, -0.5]), np.array([np.nan, 1.0])):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    entropy_bits(bad)


class ExpectedInformationGainTests(unittest.TestCase):
    def test_answers_that_identify_the_hypothesis_give_one_bit(self):
        p = np.array([0.5, 0.5])
        L = np.array([[1.0, 0.0], [0.0, 1.0]])
        self.assertAlmostEqual(expected_information_gain(p, L), 1.0, places=15)

    def test_identical_rows_cannot_separate_anything(self):
        p = np.array([0.2, 0.3, 0.5])
        L = np.array([[0.7, 0.3]] * 3)
        self.assertEqual(expected_information_gain(p, L), 0.0)

    def test_noisy_two_way_item_matches_hand_value(self):
        # 1 - H(0.9) = 1 - 0.4689956 for two equally likely states answering correctly 90%.
        p = np.array([0.5, 0.5])
        L = np.array([[0.9, 0.1], [0.1, 0.9]])
        self.assertAlmostEqual(expected_information_gain(p, L), 0.5310044, places=7)

    def test_equals_prior_entropy_minus_expected_posterior_entropy(self):
        p = np.array([0.175, 0.175, 0.175, 0.175, 0.25, 0.05])
        L = np.array([
            [0.15, 0.35, 0.35, 0.15],
            [0.10, 0.70, 0.10, 0.10],
            [0.90, 1 / 30, 1 / 30, 1 / 30],
            [0.90, 1 / 30, 1 / 30, 1 / 30],
            [0.90, 1 / 30, 1 / 30, 1 / 30],
            [0.25, 0.25, 0.25, 0.25],
        ])
        answer_probability = p @ L
        expected_posterior_entropy = sum(
            answer_probability[o] * entropy_bits(update_posterior(p, L, o)) for o in range(4)
        )
        self.assertAlmostEqual(
            expected_information_gain(p, L), entropy_bits(p) - expected_posterior_entropy, places=12
        )

    def test_zero_likelihoods_are_allowed_and_result_is_never_negative(self):
        p = np.array([0.6, 0.4])
        L = np.array([[1.0, 0.0, 0.0], [0.0, 0.5, 0.5]])
        self.assertGreaterEqual(expected_information_gain(p, L), 0.0)
        self.assertAlmostEqual(expected_information_gain(p, L), entropy_bits(p), places=12)

    def test_rejects_mismatched_shape_or_rows_that_do_not_sum_to_one(self):
        p = np.array([0.5, 0.5])
        with self.assertRaises(ValueError):
            expected_information_gain(p, np.array([[0.5, 0.5]]))
        with self.assertRaises(ValueError):
            expected_information_gain(p, np.array([[0.5, 0.4], [0.5, 0.5]]))
        with self.assertRaises(ValueError):
            expected_information_gain(p, np.array([[1.5, -0.5], [0.5, 0.5]]))

    def test_tiny_negative_float_noise_is_clamped_but_a_real_negative_is_a_defect(self):
        # Spec 5.2: values in [-1e-12, 0) become 0; anything more negative raises negative_eig.
        self.assertEqual(selection._clamp_eig(-1e-13), 0.0)
        self.assertEqual(selection._clamp_eig(0.25), 0.25)
        with self.assertRaisesRegex(ValueError, "negative_eig"):
            selection._clamp_eig(-1e-9)


class SelectNextTests(unittest.TestCase):
    def setUp(self):
        self.p = prior(HYPS, Params())  # (.35, .35, .25, .05)

    def test_highest_expected_information_gain_wins_in_any_order(self):
        for items in ([SHARED, SEPARATING], [SEPARATING, SHARED]):
            with self.subTest(order=[i.item_id for i in items]):
                self.assertEqual(select_next(self.p, items, HYPS, Params()).item_id, "sep")

    def test_exact_tie_goes_to_the_earliest_item_in_pack_order(self):
        # SEPARATING_PERMUTED has the same EIG as SEPARATING by symmetry.
        first = select_next(self.p, [SEPARATING, SEPARATING_PERMUTED], HYPS, Params())
        second = select_next(self.p, [SEPARATING_PERMUTED, SEPARATING], HYPS, Params())
        self.assertEqual(first.item_id, "sep")
        self.assertEqual(second.item_id, "sep_permuted")

    def test_ranking_lists_every_candidate_best_first_with_ties_in_pack_order(self):
        result = select_next(self.p, [SHARED, SEPARATING_PERMUTED, SEPARATING], HYPS, Params())
        self.assertEqual([item_id for item_id, _ in result.ranking],
                         ["sep_permuted", "sep", "shared"])
        self.assertEqual(result.ranking[0][1], result.eig)
        self.assertGreater(result.ranking[1][1], result.ranking[2][1])
        self.assertEqual(result.ranking[0][1], result.ranking[1][1])

    def test_reports_the_stored_quantities_and_the_runner_up(self):
        result = select_next(self.p, [SHARED, SEPARATING], HYPS, Params())
        self.assertAlmostEqual(result.entropy_before, entropy_bits(self.p), places=12)
        self.assertEqual(result.runner_up_id, "shared")
        self.assertGreater(result.eig, result.runner_up_eig)
        self.assertEqual(result.eig, round(result.eig, 9))

    def test_single_candidate_has_no_runner_up(self):
        result = select_next(self.p, [SEPARATING], HYPS, Params())
        self.assertIsNone(result.runner_up_id)
        self.assertIsNone(result.runner_up_eig)
        self.assertEqual(len(result.ranking), 1)

    def test_no_candidates_returns_none_so_the_caller_can_end_the_session(self):
        self.assertIsNone(select_next(self.p, [], HYPS, Params()))

    def test_an_item_with_zero_gain_is_still_a_valid_candidate(self):
        # Only UNMODELLED (uniform) differs from M1/M2/NONE on an unlinked item, so with no
        # mass on it nothing is separated.
        no_unmodelled = np.array([0.3, 0.3, 0.4, 0.0])
        self.assertEqual(select_next(no_unmodelled, [UNLINKED], HYPS, Params()).eig, 0.0)

    def test_an_unlinked_item_still_gains_information_about_unmodelled(self):
        self.assertGreater(select_next(self.p, [UNLINKED], HYPS, Params()).eig, 0.0)

    def test_rejects_duplicate_ids_and_wrong_posterior_size(self):
        with self.assertRaises(ValueError):
            select_next(self.p, [SEPARATING, SEPARATING], HYPS, Params())
        with self.assertRaises(ValueError):
            select_next(self.p[:-1] / self.p[:-1].sum(), [SEPARATING], HYPS, Params())


class SelectionReasonTests(unittest.TestCase):
    """The reason is teacher-facing text built from the numbers, using the earlier draft's template."""

    def setUp(self):
        self.p = prior(HYPS, Params())  # leaders (UNMODELLED excluded): M1 .35, M2 .35, NONE .25

    def test_first_leader_pair_that_differs_more_than_delta_is_named(self):
        result = select_next(self.p, [SHARED, SEPARATING], HYPS, Params())
        # Rows on `sep`: M1 predicts B, M2 predicts C, total variation 0.6 > 0.05, so pair (1, 2).
        self.assertEqual(
            result.reason,
            "Chosen to separate M1 (p=0.350) from M2 (p=0.350): M1 predicts B; M2 predicts C. "
            f"Expected information gain {result.eig:.3f} bits, best of 2 candidate items; "
            f"next best shared at {result.runner_up_eig:.3f} bits.",
        )

    def test_a_pair_with_identical_rows_is_skipped_for_the_next_pair(self):
        result = select_next(self.p, [SHARED], HYPS, Params())
        # M1 and M2 share option B on `shared` (rows identical), so (1, 2) is skipped.
        # Pair (1, 3) is M1 vs NONE; NONE predicts the correct option A.
        self.assertEqual(
            result.reason,
            "Chosen to separate M1 (p=0.350) from NONE (p=0.250): M1 predicts B; "
            f"NONE predicts A = correct. Expected information gain {result.eig:.3f} bits, "
            "best of 1 candidate items.",
        )

    def test_delta_decides_which_leader_pair_is_named(self):
        # On `sep`: total variation M1 vs M2 is 0.6, M1 vs NONE is 0.8.
        below = select_next(self.p, [SEPARATING], HYPS, Params(), delta=0.5)
        self.assertIn("separate M1 (p=0.350) from M2 (p=0.350)", below.reason)
        above = select_next(self.p, [SEPARATING], HYPS, Params(), delta=0.7)
        self.assertIn("separate M1 (p=0.350) from NONE (p=0.250)", above.reason)
        neither = select_next(self.p, [SEPARATING], HYPS, Params(), delta=0.9)
        self.assertTrue(neither.reason.startswith("Chosen as the most informative remaining item."))

    def test_a_pair_exactly_at_delta_does_not_qualify_but_just_above_does(self):
        L = likelihood_matrix(SEPARATING, HYPS, Params())
        tv = 0.5 * float(np.abs(L[0] - L[1]).sum())  # total variation of M1 vs M2, as computed
        at = select_next(self.p, [SEPARATING], HYPS, Params(), delta=tv)
        self.assertIn("separate M1 (p=0.350) from NONE (p=0.250)", at.reason)  # "> delta", not ">="
        just_below = select_next(self.p, [SEPARATING], HYPS, Params(), delta=float(np.nextafter(tv, 0)))
        self.assertIn("separate M1 (p=0.350) from M2 (p=0.350)", just_below.reason)

    def test_a_predicted_set_with_two_options_lists_both(self):
        two_links = make_item("two", [(), ("M1",), ("M1",), ()])
        reason = select_next(self.p, [two_links], HYPS, Params()).reason
        self.assertIn("M1 predicts B, C;", reason)

    def test_unmodelled_is_never_a_leader(self):
        p = np.array([0.02, 0.03, 0.05, 0.90])  # UNMODELLED dominates but is excluded
        reason = select_next(p, [SEPARATING], HYPS, Params()).reason
        self.assertNotIn("UNMODELLED", reason)
        self.assertIn("separate NONE (p=0.050) from M2 (p=0.030)", reason)

    def test_no_qualifying_pair_gives_the_fallback_sentence(self):
        p = np.array([0.3, 0.3, 0.4, 0.0])  # M1, M2, NONE all predict A on an unlinked item
        result = select_next(p, [UNLINKED], HYPS, Params())
        self.assertEqual(
            result.reason,
            "Chosen as the most informative remaining item. "
            "Expected information gain 0.000 bits, best of 1 candidate items.",
        )

    def test_a_tie_with_the_next_best_item_is_noted(self):
        result = select_next(self.p, [SEPARATING, SEPARATING_PERMUTED], HYPS, Params())
        self.assertTrue(result.reason.endswith(
            f"next best sep_permuted at {result.runner_up_eig:.3f} bits (tie broken by item order)."
        ))

    def test_reason_is_the_same_on_every_call(self):
        reasons = {select_next(self.p, [SHARED, SEPARATING], HYPS, Params()).reason for _ in range(3)}
        self.assertEqual(len(reasons), 1)


class SpecWorkedExampleTests(unittest.TestCase):
    """Expected numbers are copied from docs/ENGINE_SPEC_DRAFT.md section 5 (tables D1 and D2)."""

    def test_d1_t1_rounding_choices_eigs_and_posteriors(self):
        hyps, items = load_unit({"T1 Rounding"}, ["MATH-1248", "MATH-1379", "MATH-1988", "MATH-2392"])
        steps = replay(hyps, items, ["D", "B", "B", "A"])
        self.assertEqual([s[0] for s in steps], ["T1-005", "T1-006", "T1-007", "T1-009"])
        for (_, eig, _), expected in zip(steps, [0.7887, 0.6472, 0.2232, 0.5546]):
            self.assertAlmostEqual(eig, expected, places=4)
        np.testing.assert_allclose(steps[0][2], [.0391, .0391, .3520, .0391, .5028, .0279], atol=5e-5)
        np.testing.assert_allclose(steps[1][2], [.0073, .0655, .0655, .0073, .8416, .0130], atol=5e-5)
        np.testing.assert_allclose(steps[2][2], [.0090, .5674, .0270, .0090, .3474, .0402], atol=5e-5)
        np.testing.assert_allclose(steps[3][2], [.0021, .9423, .0021, .0021, .0275, .0238], atol=5e-5)

    def test_d2_operation_unit_choices_eigs_and_posteriors(self):
        hyps, items = load_unit(
            {"T4 Choosing the operation", "T5 cross-concept (operation version)"},
            ["MATH-126", "MATH-228", "MATH-1416", "MATH-1514", "MATH-1773", "MATH-2093"],
        )
        steps = replay(hyps, items, ["D", "A"])
        self.assertEqual([s[0] for s in steps], ["T4-001", "T5-011"])
        for (_, eig, _), expected in zip(steps, [0.7517, 0.3668]):
            self.assertAlmostEqual(eig, expected, places=4)
        np.testing.assert_allclose(steps[0][2], [.0181, .0542, .0542, .3794, .3794, .0181, .0387, .0581], atol=5e-5)
        np.testing.assert_allclose(steps[1][2], [.0011, .0033, .0033, .4813, .4813, .0011, .0023, .0263], atol=5e-5)


class IndependentRealBankChecks(unittest.TestCase):
    """Cross-checks on the 81 items of units U1-U5 against code that shares nothing with the module."""

    @classmethod
    def setUpClass(cls):
        cls.units = real_units()

    def test_the_five_units_cover_eighty_one_items(self):
        self.assertEqual({n: len(items) for n, (_, items) in self.units.items()},
                         {"U1": 20, "U2": 25, "U3": 10, "U4": 16, "U5": 10})

    def test_eig_matches_exact_arithmetic_for_every_item_at_the_prior_and_after_every_answer(self):
        params = Params()
        slip, guess = Fraction("0.1"), Fraction("0.3")
        checked = 0
        for name, (hyps, items) in self.units.items():
            k = len(hyps) - 2
            start = [(1 - Fraction("0.25") - Fraction("0.05")) / k] * k + [Fraction("0.25"), Fraction("0.05")]
            for item in items:
                rows = reference_rows(item, hyps, slip, guess)
                posteriors = [start]
                for o in range(4):  # the posterior after each possible first answer
                    joint = [start[h] * rows[h][o] for h in range(len(hyps))]
                    posteriors.append([x / sum(joint) for x in joint])
                for post in posteriors:
                    expected = float(reference_eig_decimal(post, rows))
                    actual = expected_information_gain(
                        np.array([float(x) for x in post]), likelihood_matrix(item, hyps, params))
                    self.assertAlmostEqual(actual, expected, places=11, msg=f"{name} {item.item_id}")
                    checked += 1
        self.assertEqual(checked, 81 * 5)

    def test_choice_and_full_ranking_match_a_brute_force_reference_on_random_posteriors(self):
        params = Params()
        generator = random.Random(20261011)
        compared = 0
        for name, (hyps, items) in self.units.items():
            for _ in range(60):
                weights = [generator.expovariate(1.0) ** 2 for _ in hyps]  # uneven, some near zero
                p = np.array(weights) / sum(weights)
                result = select_next(p, items, hyps, params)
                self.assertEqual([i for i, _ in result.ranking],
                                 reference_choice(p, items, hyps, params), msg=name)
                self.assertEqual(result.item_id, result.ranking[0][0])
                compared += 1
        self.assertEqual(compared, 300)

    def test_gain_is_between_zero_and_the_smaller_of_prior_entropy_and_two_bits(self):
        params = Params()
        generator = random.Random(7)
        for name, (hyps, items) in self.units.items():
            for _ in range(20):
                weights = [generator.random() for _ in hyps]
                p = np.array(weights) / sum(weights)
                bound = min(entropy_bits(p), 2.0) + 1e-9
                for item in items:
                    eig = expected_information_gain(p, likelihood_matrix(item, hyps, params))
                    self.assertGreaterEqual(eig, 0.0)
                    self.assertLessEqual(eig, bound, msg=f"{name} {item.item_id}")

    def test_pack_order_only_changes_the_choice_among_exact_ties(self):
        hyps, items = self.units["U1"]
        params, p = Params(), prior(hyps, Params())
        generator = random.Random(3)
        top = select_next(p, items, hyps, params).eig
        for _ in range(25):
            shuffled = items[:]
            generator.shuffle(shuffled)
            result = select_next(p, shuffled, hyps, params)
            self.assertEqual(result.eig, top)  # the best value never depends on order
            tied = [i for i, e in result.ranking if e == top]
            self.assertEqual(result.item_id, tied[0])
            self.assertEqual(tied, [i.item_id for i in shuffled if i.item_id in tied])  # earliest first

    def test_scripted_sessions_are_deterministic_never_repeat_an_item_and_keep_a_valid_trace(self):
        params = Params()
        for name, (hyps, items) in self.units.items():
            for believed in list(hyps[:-2]) + [None]:  # each misconception, then a student with none
                traces = []
                for _ in range(2):
                    p, remaining, trace = prior(hyps, params), list(items), []
                    for _ in range(8):  # the draft's question budget
                        chosen = select_next(p, remaining, hyps, params)
                        item = next(i for i in remaining if i.item_id == chosen.item_id)
                        self.assertAlmostEqual(chosen.entropy_before, entropy_bits(p), places=12)
                        self.assertEqual(chosen.eig, max(e for _, e in chosen.ranking))
                        p = update_posterior(p, likelihood_matrix(item, hyps, params),
                                             student_answer(item, believed))
                        self.assertAlmostEqual(float(p.sum()), 1.0, places=12)
                        remaining.remove(item)
                        trace.append((chosen.item_id, chosen.eig, chosen.reason))
                    traces.append(trace)
                ids = [t[0] for t in traces[0]]
                self.assertEqual(len(set(ids)), 8, msg=f"{name} {believed} repeated an item")
                self.assertEqual(traces[0], traces[1], msg=f"{name} {believed} is not deterministic")


if __name__ == "__main__":
    unittest.main()
