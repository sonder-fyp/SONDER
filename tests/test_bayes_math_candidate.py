"""Read-only calculation checks against the current, not-yet-frozen T1 bank.

This adapter belongs to the test. Ahmed's approved pack loader and version
binding are separate work; passing here does not approve content links.
"""

import csv
import unittest
from collections import defaultdict
from fractions import Fraction
from pathlib import Path

import numpy as np

from sonder_engine import Item, Params, check_p1, likelihood_matrix, prior, update_posterior


DATA = Path(__file__).resolve().parents[1] / "data" / "Maths_v2"


def current_t1_candidate():
    with (DATA / "topics.csv").open(newline="", encoding="utf-8-sig") as source:
        hyps = tuple(
            row["MisconceptionId"] for row in csv.DictReader(source)
            if row["topic"] == "T1 Rounding"
        ) + ("NONE", "UNMODELLED")
    rows = defaultdict(list)
    with (DATA / "bank" / "items.csv").open(newline="", encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            if row["topic"] == "T1 Rounding" and row["status"] == "approved":
                rows[row["item_id"]].append(row)
    items = {}
    for item_id, option_rows in rows.items():
        option_rows.sort(key=lambda row: row["option_id"])
        correct = [i for i, row in enumerate(option_rows) if row["is_correct"] == "True"]
        if len(correct) != 1:
            raise ValueError(f"{item_id} has {len(correct)} marked answers")
        items[item_id] = Item(
            item_id=item_id,
            option_ids=tuple(row["option_id"] for row in option_rows),
            correct_index=correct[0],
            links=tuple(tuple(filter(None, row["misconceptions"].split("|"))) for row in option_rows),
        )
    return hyps, items


class CurrentMathCandidateTests(unittest.TestCase):
    def test_all_twenty_t1_items_and_eighty_answer_paths_calculate(self):
        hyps, items = current_t1_candidate()
        self.assertEqual(len(hyps), 6)
        self.assertEqual(len(items), 20)
        starting = prior(hyps, Params())
        for item_id, item in items.items():
            with self.subTest(item_id=item_id):
                L = likelihood_matrix(item, hyps, Params())
                self.assertEqual(L.shape, (6, 4))
                self.assertTrue(np.all(L > 0))
                np.testing.assert_allclose(L.sum(axis=1), 1.0, atol=1e-15)
                for answer in range(4):
                    after = update_posterior(starting, L, answer)
                    self.assertTrue(np.all(np.isfinite(after)))
                    self.assertTrue(np.all(after >= 0))
                    self.assertAlmostEqual(float(after.sum()), 1.0, places=12)

    def test_current_t1_005_matches_independent_fraction_calculation(self):
        hyps, items = current_t1_candidate()
        self.assertEqual(hyps, (
            "MATH-1248", "MATH-1379", "MATH-1988", "MATH-2392", "NONE", "UNMODELLED"
        ))
        item = items["T1-005"]
        self.assertEqual(item.option_ids, ("A", "B", "C", "D"))
        self.assertEqual(item.correct_index, 3)
        self.assertEqual(item.links[1], ("MATH-1248",))
        starting = prior(hyps, Params())
        L = likelihood_matrix(item, hyps, Params())
        # B is 48,600. Hand joint terms sum to 221/1200, so the exact
        # posterior numerators, over denominator 221, are below.
        after_b = update_posterior(starting, L, 1)
        np.testing.assert_allclose(after_b, [147 / 221, 21 / 221, 7 / 221,
                                              21 / 221, 10 / 221, 15 / 221], atol=1e-15)
        # D is the correct 49,000. This is also the draft's checkable case.
        after_d = update_posterior(starting, L, 3)
        np.testing.assert_allclose(after_d, [0.0175, 0.0175, 0.1575,
                                              0.0175, 0.225, 0.0125] / np.float64(0.4475),
                                   atol=1e-15)

    def test_two_manual_t1_answers_update_the_same_posterior(self):
        # This proves repeated calculation. Item choice is manually specified;
        # Harris's selector and Ahmed's stopping rule are not being simulated.
        hyps, items = current_t1_candidate()
        p = prior(hyps, Params())
        p = update_posterior(p, likelihood_matrix(items["T1-005"], hyps, Params()), 1)
        p = update_posterior(p, likelihood_matrix(items["T1-007"], hyps, Params()), 3)
        # Both B on 005 and D on 007 link to MATH-1248. Independent fraction
        # multiplication gives the following numerators over 6685.
        np.testing.assert_allclose(p, [6174 / 6685, 126 / 6685, 14 / 6685,
                                       126 / 6685, 20 / 6685, 225 / 6685], atol=1e-15)

    def test_every_current_bank_item_matches_exact_arithmetic_under_a_valid_rate(self):
        # This is a per-item calculation audit, not an approved unit-pack
        # simulation. The three 3-link items use .24 only for this arithmetic
        # check; it is not a team decision to use .24 in live sessions.
        rows = defaultdict(list)
        with (DATA / "bank" / "items.csv").open(newline="", encoding="utf-8-sig") as source:
            for row in csv.DictReader(source):
                rows[row["item_id"]].append(row)
        self.assertEqual(len(rows), 117)
        needs_d2 = set()
        checked_paths = 0
        for item_id, option_rows in rows.items():
            option_rows.sort(key=lambda row: row["option_id"])
            links = tuple(tuple(filter(None, row["misconceptions"].split("|")))
                          for row in option_rows)
            correct = [i for i, row in enumerate(option_rows) if row["is_correct"] == "True"]
            self.assertEqual(len(correct), 1, item_id)
            item = Item(item_id, tuple(row["option_id"] for row in option_rows),
                        correct[0], links)
            ids = tuple(sorted({m for option in links for m in option}))
            hyps = ids + ("NONE", "UNMODELLED")
            self.assertGreaterEqual(len(ids), 1, item_id)
            three_link = any(sum(m in option for option in links) == 3 for m in ids)
            params = Params(guess=0.24) if three_link else Params()
            if three_link:
                needs_d2.add(item_id)
                with self.assertRaisesRegex(ValueError, f"P1: {item_id}"):
                    check_p1((item,), hyps, Params())
            check_p1((item,), hyps, params)
            p = prior(hyps, params)
            L = likelihood_matrix(item, hyps, params)
            exact_prior = [Fraction(7, 10 * len(ids))] * len(ids)
            exact_prior += [Fraction(1, 4), Fraction(1, 20)]
            for answer in range(4):
                chances = []
                for h in hyps:
                    if h == "UNMODELLED":
                        chance = Fraction(1, 4)
                    else:
                        predicted = ([j for j, option in enumerate(links) if h in option]
                                     if h != "NONE" else [])
                        rate = Fraction(str(params.guess)) if predicted else Fraction(1, 10)
                        if not predicted:
                            predicted = [item.correct_index]
                        chance = ((1 - rate) / len(predicted) if answer in predicted
                                  else rate / (4 - len(predicted)))
                    chances.append(chance)
                joint = [a * b for a, b in zip(exact_prior, chances)]
                evidence = sum(joint)
                with self.subTest(item=item_id, answer=item.option_ids[answer]):
                    np.testing.assert_allclose(
                        L[:, answer], [float(x) for x in chances], rtol=0, atol=3e-16
                    )
                    np.testing.assert_allclose(
                        update_posterior(p, L, answer),
                        [float(x / evidence) for x in joint], rtol=0, atol=3e-16,
                    )
                checked_paths += 1
        self.assertEqual(needs_d2, {"T6-011B", "T6-014B", "T6-016B"})
        self.assertEqual(checked_paths, 468)


if __name__ == "__main__":
    unittest.main()
