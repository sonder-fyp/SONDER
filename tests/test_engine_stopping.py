"""Checks for the stopping and refusal rules (spec v2 section 3.5).

Synthetic cases test each rule and its exact boundary. Real-bank cases replay
spec section 5 (D1, D2) and section 6.1 (deterministic students) with a minimal
loop built only from the existing selection and update functions; U6 is the unit
after decision D-2 (three items skipped, MATH-1416 dropped).
"""

from __future__ import annotations

import unittest
from dataclasses import fields, replace

import numpy as np

from sonder_engine import Item, Params, likelihood_matrix, prior, update_posterior
from sonder_engine.selection import eligible_items, select_next
from sonder_engine.stopping import (
    Outcome, check_stop, inseparable_set, support, total_variation, triggered_options,
)
from sonder_pack.maths_v2 import load_maths_v2

HYPS = ("M1", "M2", "NONE", "UNMODELLED")


def make_item(item_id, links, correct=0):
    return Item(item_id, ("A", "B", "C", "D"), correct, tuple(tuple(x) for x in links))


SEPARATING = make_item("sep", [(), ("M1",), ("M2",), ()])  # B -> M1, C -> M2, D unlinked
SHARED = make_item("shared", [(), ("M1", "M2"), (), ()])  # M1 and M2 answer identically
UNLINKED = make_item("unlinked", [(), (), (), ()])  # M1, M2 and NONE all predict A


def vec(*values):
    return np.array(values, dtype=np.float64)


def decide(p, history, remaining=(SEPARATING,), best_eig=0.5, budget=8, params=Params()):
    return check_stop(vec(*p), history, list(remaining), best_eig, budget, HYPS, params)


# --------------------------------------------------------------------------- real-bank loop
def run(unit, answer, params=Params()):
    """Select, answer, update and check, until a rule ends the session."""
    hyps, items = unit.hyps, unit.engine_items
    by_id = {item.item_id: item for item in items}
    budget = params.default_budget
    p, history = prior(hyps, params), []

    def step():
        remaining = eligible_items(items, [item.item_id for item, _ in history])
        chosen = select_next(p, remaining, hyps, params) if len(history) < budget else None
        best = chosen.eig if chosen is not None else None
        return check_stop(p, history, remaining, best, budget, hyps, params), chosen

    decision, chosen = step()
    posteriors = []
    while decision.outcome is Outcome.IN_PROGRESS:
        item = by_id[chosen.item_id]
        observed = answer(item)
        p = update_posterior(p, likelihood_matrix(item, hyps, params), observed)
        history.append((item, observed))
        posteriors.append(p)
        decision, chosen = step()
    return decision, history, posteriors


def deterministic(hypothesis):
    """Spec 6.1 student: first option linked to the misconception, else the correct one."""
    def answer(item):
        linked = sorted(triggered_options(item, hypothesis)) if hypothesis != "NONE" else []
        return linked[0] if linked else item.correct_index
    return answer


def scripted(letters):
    return lambda item: item.option_ids.index(letters[item.item_id])


# Spec 6.1 outcomes for U1-U5 and U7; U6 recomputed after D-2 (engine plan section 6.2).
# Each entry: hypothesis -> (outcome, leader or tied set, answers taken).
D, N, S, X = "diagnosed", "none_detected", "escalated_no_separator", "escalated_exhausted"
EXPECTED = {
    "U1": {"MATH-1248": (D, 2), "MATH-1379": (D, 3), "MATH-1988": (D, 3), "MATH-2392": (D, 2),
           "NONE": (N, 3)},
    "U2": {"MATH-61": (D, 3), "MATH-658": (D, 2), "MATH-1715": (D, 2), "MATH-1965": (D, 3),
           "MATH-2039": (D, 2), "NONE": (N, 3)},
    "U3": {"MATH-2138": (D, 3), "MATH-2206": (D, 3), "MATH-1074": (S, 3), "MATH-1651": (S, 3),
           "MATH-2359": (D, 3), "NONE": (N, 3)},
    "U4": {"MATH-126": (D, 3), "MATH-228": (D, 2), "MATH-1416": (D, 3), "MATH-1514": (S, 2),
           "MATH-1773": (S, 2), "MATH-2093": (X, 5), "NONE": (N, 3)},
    "U5": {"MATH-414": (D, 2), "MATH-734": (D, 2), "MATH-952": (D, 3), "MATH-1072": (D, 2),
           "NONE": (N, 3)},
    "U6": {"MATH-1074": (S, 3), "MATH-161": (D, 2), "MATH-767": (D, 2), "MATH-1651": (S, 3),
           "MATH-2359": (X, 4), "NONE": (N, 3)},
    "U7": {"MATH-2359": (D, 2), "MATH-1639": (D, 4), "MATH-2093": (D, 2), "MATH-2271": (D, 3),
           "MATH-1514": (S, 3), "MATH-1715": (D, 2), "MATH-1773": (S, 3), "NONE": (N, 4)},
}
TIED = {"U3": ("MATH-1074", "MATH-1651"), "U4": ("MATH-1514", "MATH-1773"),
        "U6": ("MATH-1074", "MATH-1651"), "U7": ("MATH-1514", "MATH-1773", "NONE")}


# --------------------------------------------------------------------------- support and separation
class SupportTests(unittest.TestCase):
    def test_triggered_options_for_each_kind(self):
        self.assertEqual(triggered_options(SEPARATING, "M1"), {1})
        self.assertEqual(triggered_options(SEPARATING, "M2"), {2})
        self.assertEqual(triggered_options(SEPARATING, "NONE"), {0})
        self.assertEqual(triggered_options(SEPARATING, "UNMODELLED"), {3})
        self.assertEqual(triggered_options(SHARED, "M2"), {1})
        self.assertEqual(triggered_options(UNLINKED, "M1"), frozenset())

    def test_support_counts_each_answer_once_for_a_set(self):
        history = [(SHARED, 1), (SEPARATING, 1), (SEPARATING, 0), (SEPARATING, 3)]
        self.assertEqual(support(history, ["M1"]), 2)
        self.assertEqual(support(history, ["M2"]), 1)
        self.assertEqual(support(history, ["M1", "M2"]), 2)  # SHARED B counted once
        self.assertEqual(support(history, ["NONE"]), 1)
        self.assertEqual(support(history, ["UNMODELLED"]), 1)
        self.assertEqual(support(history, []), 0)

    def test_a_bare_string_is_not_a_group(self):
        with self.assertRaises(ValueError):
            support([(SEPARATING, 1)], "M1")

    def test_separation_threshold_is_strictly_greater_than_delta(self):
        partly = make_item("partly", [(), ("M1", "M2"), ("M2",), ()])  # M1 on B; M2 on B and C
        L = likelihood_matrix(partly, HYPS, Params())
        tv = total_variation(L[0], L[1])
        self.assertAlmostEqual(tv, 0.35, places=12)
        p = vec(0.5, 0.4, 0.05, 0.05)
        _, tied = inseparable_set(p, [partly], HYPS, Params(delta_sep=tv))
        self.assertEqual(tied, (0, 1))  # at delta: not separable
        _, tied = inseparable_set(p, [partly], HYPS, Params(delta_sep=float(np.nextafter(tv, 0))))
        self.assertEqual(tied, (0,))  # just below: separable

    def test_leader_ties_go_to_the_lowest_slot(self):
        lead, tied = inseparable_set(vec(0.45, 0.45, 0.05, 0.05), [SHARED], HYPS, Params())
        self.assertEqual((lead, tied), (0, (0, 1)))


# --------------------------------------------------------------------------- each rule
class RuleTests(unittest.TestCase):
    def test_r1_needs_probability_and_support(self):
        two = [(SEPARATING, 1), (SEPARATING, 1)]
        d = decide((0.85, 0.05, 0.05, 0.05), two)
        self.assertEqual((d.outcome, d.rule, d.leader, d.support), (Outcome.DIAGNOSED, "R1", "M1", 2))
        self.assertIs(decide((0.85, 0.05, 0.05, 0.05), two[:1]).outcome, Outcome.IN_PROGRESS)
        self.assertIs(decide((0.79, 0.11, 0.05, 0.05), two).outcome, Outcome.IN_PROGRESS)

    def test_min_support_comes_only_from_params(self):
        # Decision D-3: the same history diagnoses at 2 and not at 3, with no code change.
        two = [(SEPARATING, 1), (SEPARATING, 1)]
        self.assertIs(decide((0.85, 0.05, 0.05, 0.05), two).outcome, Outcome.DIAGNOSED)
        self.assertIs(decide((0.85, 0.05, 0.05, 0.05), two, params=Params(min_support=3)).outcome,
                      Outcome.IN_PROGRESS)

    def test_r2_needs_min_support_none_correct_answers(self):
        correct = [(SEPARATING, 0)] * 3
        d = decide((0.05, 0.05, 0.85, 0.05), correct)
        self.assertEqual((d.outcome, d.rule, d.leader, d.support), (Outcome.NONE_DETECTED, "R2", "NONE", 3))
        self.assertIs(decide((0.05, 0.05, 0.85, 0.05), correct[:2]).outcome, Outcome.IN_PROGRESS)

    def test_r3_unmodelled(self):
        unlinked = [(SEPARATING, 3), (SEPARATING, 3)]
        d = decide((0.15, 0.15, 0.1, 0.6), unlinked)
        self.assertEqual((d.outcome, d.rule, d.leader, d.support),
                         (Outcome.ESCALATED_UNMODELLED, "R3", "UNMODELLED", 2))
        self.assertIs(decide((0.15, 0.15, 0.1, 0.6), unlinked[:1]).outcome, Outcome.IN_PROGRESS)
        self.assertIs(decide((0.16, 0.16, 0.18, 0.5 - 1e-9), unlinked).outcome, Outcome.IN_PROGRESS)

    def test_r4_names_the_tied_set_and_its_ceiling(self):
        d = decide((0.45, 0.45, 0.05, 0.05), [(SHARED, 1), (SHARED, 1)], remaining=[SHARED])
        self.assertEqual((d.outcome, d.rule, d.leader, d.tied, d.support),
                         (Outcome.ESCALATED_NO_SEPARATOR, "R4", "M1", ("M1", "M2"), 2))
        self.assertAlmostEqual(d.ceiling, 0.5, places=15)
        self.assertEqual(d.detail, "R4: no remaining item separates M1 and M2 (together p = 0.900); "
                                   "the most M1 can reach is 0.500, below theta = 0.80.")

    def test_r4_can_tie_a_misconception_set_with_none(self):
        # On an unlinked item M1, M2 and NONE all predict the correct answer (the U7 1514 case).
        correct = [(UNLINKED, 0), (UNLINKED, 0)]
        d = decide((0.3, 0.3, 0.3, 0.1), correct, remaining=[UNLINKED])
        self.assertEqual((d.outcome, d.tied), (Outcome.ESCALATED_NO_SEPARATOR, ("M1", "M2", "NONE")))
        self.assertAlmostEqual(d.ceiling, 1 / 3, places=15)

    def test_r4_needs_mass_ceiling_below_theta_and_support(self):
        shared = [(SHARED, 1), (SHARED, 1)]
        self.assertIs(decide((0.4, 0.35, 0.2, 0.05), shared, remaining=[SHARED]).outcome,
                      Outcome.IN_PROGRESS)  # p(C) = 0.75 < theta
        self.assertIs(decide((0.45, 0.45, 0.05, 0.05), shared[:1], remaining=[SHARED]).outcome,
                      Outcome.IN_PROGRESS)  # support 1
        self.assertIs(decide((0.45, 0.45, 0.05, 0.05), shared, remaining=[SEPARATING]).outcome,
                      Outcome.IN_PROGRESS)  # a remaining item separates them

    def test_r4_needs_a_remaining_item(self):
        d = decide((0.45, 0.45, 0.05, 0.05), [(SHARED, 1), (SHARED, 1)], remaining=[], best_eig=None)
        self.assertEqual((d.outcome, d.exhausted_by), (Outcome.ESCALATED_EXHAUSTED, "no_items"))

    def test_r5_three_causes(self):
        p = (0.3, 0.3, 0.3, 0.1)
        one = [(SEPARATING, 0)]
        d = decide(p, one, budget=1, best_eig=None)
        self.assertEqual((d.rule, d.exhausted_by, d.leader), ("R5", "budget", "M1"))
        self.assertEqual(d.detail, "R5 budget: 1 of 1 questions used without a decision.")
        self.assertEqual(decide(p, one, remaining=[], best_eig=None).exhausted_by, "no_items")
        self.assertEqual(decide(p, one, best_eig=0.0099).exhausted_by, "eig_floor")
        self.assertIs(decide(p, one, best_eig=0.01).outcome, Outcome.IN_PROGRESS)  # floor is strict

    def test_rules_apply_in_order(self):
        two = [(SEPARATING, 1), (SEPARATING, 1)]
        self.assertEqual(decide((0.85, 0.05, 0.05, 0.05), two, budget=2, best_eig=None).rule, "R1")
        correct = [(SEPARATING, 0)] * 3
        self.assertEqual(decide((0.05, 0.05, 0.85, 0.05), correct, budget=3, best_eig=None).rule, "R2")
        # R4 looks at the remaining items even when the budget is spent (spec 3.5).
        d = decide((0.45, 0.45, 0.05, 0.05), [(SHARED, 1), (SHARED, 1)], remaining=[SHARED],
                   budget=2, best_eig=None)
        self.assertEqual(d.rule, "R4")

    def test_in_progress_reports_the_leader(self):
        d = decide((0.2, 0.3, 0.4, 0.1), [(SEPARATING, 0)])
        self.assertEqual((d.outcome, d.rule, d.leader), (Outcome.IN_PROGRESS, None, "NONE"))

    def test_input_checks(self):
        with self.assertRaises(ValueError):
            decide((0.3, 0.3, 0.3, 0.1), [(SEPARATING, 0)], best_eig=None)  # floor would be skipped
        with self.assertRaises(ValueError):
            check_stop(vec(0.5, 0.5), [], [SEPARATING], 0.5, 8, HYPS, Params())
        with self.assertRaises(ValueError):
            decide((0.3, 0.3, 0.3, 0.1), [(SEPARATING, 4)])
        with self.assertRaises(ValueError):
            decide((0.3, 0.3, 0.3, 0.1), [], budget=0)

    def test_outcome_values_match_the_session_status_column(self):
        self.assertEqual({o.value for o in Outcome}, {
            "in_progress", "diagnosed", "none_detected", "escalated_no_separator",
            "escalated_exhausted", "escalated_unmodelled"})


# --------------------------------------------------------------------------- real bank
class RealBankTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_maths_v2()

    def test_d1_none_blocked_by_support_then_1379_diagnosed(self):
        unit = self.pack.unit("U1")
        letters = {"T1-005": "D", "T1-006": "B", "T1-007": "B", "T1-009": "A"}
        decision, history, posteriors = run(unit, scripted(letters))
        self.assertEqual([item.item_id for item, _ in history], ["T1-005", "T1-006", "T1-007", "T1-009"])
        self.assertEqual((decision.outcome, decision.leader, decision.support),
                         (Outcome.DIAGNOSED, "MATH-1379", 2))
        self.assertAlmostEqual(float(posteriors[-1][1]), 0.9423, places=4)
        # After step 1, p(NONE) = .8416 but only 2 correct answers back it (min_support_none = 3).
        self.assertAlmostEqual(float(posteriors[1][4]), 0.8416, places=4)
        R = eligible_items(unit.engine_items, ["T1-005", "T1-006"])
        at_step_1 = check_stop(posteriors[1], history[:2], R, 0.5, 8, unit.hyps, Params())
        self.assertIs(at_step_1.outcome, Outcome.IN_PROGRESS)
        relaxed = check_stop(posteriors[1], history[:2], R, 0.5, 8, unit.hyps, Params(min_support_none=2))
        self.assertIs(relaxed.outcome, Outcome.NONE_DETECTED)

    def test_d2_1514_refused_naming_both(self):
        decision, history, posteriors = run(self.pack.unit("U4"), scripted({"T4-001": "D", "T5-011": "A"}))
        self.assertEqual([item.item_id for item, _ in history], ["T4-001", "T5-011"])
        self.assertEqual((decision.outcome, decision.leader, decision.tied, decision.support),
                         (Outcome.ESCALATED_NO_SEPARATOR, "MATH-1514", ("MATH-1514", "MATH-1773"), 2))
        self.assertAlmostEqual(float(posteriors[-1][3] + posteriors[-1][4]), 0.9626, places=4)
        self.assertAlmostEqual(decision.ceiling, 0.5, places=12)

    def test_deterministic_students_spec_6_1(self):
        counts = {}
        for unit in self.pack.units:
            expected = EXPECTED[unit.unit_id]
            self.assertEqual(set(expected), set(unit.hyps[:-1]), unit.unit_id)
            for hypothesis, (outcome, answers) in expected.items():
                with self.subTest(unit=unit.unit_id, student=hypothesis):
                    decision, history, _ = run(unit, deterministic(hypothesis))
                    self.assertEqual(decision.outcome.value, outcome)
                    self.assertEqual(len(history), answers)
                    if outcome == D:
                        self.assertEqual(decision.leader, hypothesis)  # never a wrong diagnosis
                    if outcome == S:
                        self.assertEqual(decision.tied, TIED[unit.unit_id])
                    counts[outcome] = counts.get(outcome, 0) + 1
        # 43 students: spec 6.1's 44 less the U6 MATH-1416 student (engine plan section 6.3).
        self.assertEqual(counts, {D: 26, N: 7, S: 8, X: 2})

    def test_sensitivity_of_deterministic_outcomes_spec_6_2(self):
        base = Params()
        students = [(unit, h) for unit in self.pack.units for h in unit.hyps[:-1]]
        floats = [f.name for f in fields(Params) if isinstance(getattr(base, f.name), float)
                  and f.name not in ("w_sound", "w_stretch")]
        self.assertEqual(len(floats), 8)  # 16 variants
        baseline = {(u.unit_id, h): run(u, deterministic(h))[0].outcome for u, h in students}
        changes = set()
        for name in floats:
            for factor in (0.8, 1.2):
                params = replace(base, **{name: getattr(base, name) * factor})
                for unit, h in students:
                    outcome = run(unit, deterministic(h), params)[0].outcome
                    if outcome is not baseline[(unit.unit_id, h)]:
                        changes.add((name, factor, unit.unit_id, h, outcome.value))
        # Spec 6.2 found 6 changes, all from theta; the theta 0.64 change (1416 in U6) no
        # longer exists because MATH-1416 is not a U6 hypothesis after decision D-2.
        self.assertEqual(changes, {
            ("theta", 1.2, "U4", "NONE", S), ("theta", 1.2, "U4", "MATH-2093", S),
            ("theta", 1.2, "U6", "NONE", S), ("theta", 1.2, "U6", "MATH-2359", S),
            ("theta", 1.2, "U7", "NONE", S),
        })


if __name__ == "__main__":
    unittest.main()
