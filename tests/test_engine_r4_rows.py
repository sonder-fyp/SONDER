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
    prior,
    replay,
    start,
    update_posterior,
)
from sonder_engine.selection import select_next
from sonder_engine.stopping import check_stop, inseparable_set, total_variation
from sonder_engine.stopping import reachable_share as engine_reachable_share
from sonder_pack.maths_v2 import load_maths_v2

from engine_rows import (
    best_ratio,
    exact_item,
    make_unit,
    near_item,
    reachable_share,
    separating_item,
)

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


class EngineReachableShareTests(unittest.TestCase):
    """sonder_engine.stopping.reachable_share against the independent helper in engine_rows."""

    POSTERIORS = ([0.5, 0.4, 0.05, 0.05], [0.3, 0.6, 0.05, 0.05], [0.45, 0.45, 0.06, 0.04])

    def test_it_agrees_with_the_independent_bound_when_no_items_are_twins(self):
        for params, items in ((NEAR, [near_item(f"N{i}") for i in range(8)]),
                              (Params(), [exact_item(f"E{i}") for i in range(8)]),
                              (Params(), [near_item("N"), separating_item("S"), exact_item("E")])):
            for values in self.POSTERIORS:
                p = np.array(values)
                for member in (0, 1):
                    for left in range(9):
                        with self.subTest(items=items[0].item_id, p=values, member=member, left=left):
                            self.assertAlmostEqual(
                                engine_reachable_share(p, member, (0, 1), items, left, HYPS, params),
                                reachable_share(p, member, (0, 1), items, left, HYPS, params), places=13)

    def test_for_exact_rows_it_is_exactly_the_current_share(self):
        p = np.array([0.47, 0.41, 0.07, 0.05])
        items = [exact_item(f"E{i}") for i in range(6)]
        for left in range(7):
            self.assertEqual(engine_reachable_share(p, 0, (0, 1), items, left, HYPS, Params()),
                             float(p[0]) / float(p[[0, 1]].sum()))

    def test_items_of_one_twin_group_count_once(self):
        p = np.array([0.5, 0.4, 0.05, 0.05])
        twins = [near_item("N1", twin_group="g"), near_item("N2", twin_group="g")]
        engine = engine_reachable_share(p, 0, (0, 1), twins, 2, HYPS, NEAR)
        one_answer = reachable_share(p, 0, (0, 1), twins[:1], 1, HYPS, NEAR)
        ignoring_twins = reachable_share(p, 0, (0, 1), twins, 2, HYPS, NEAR)
        self.assertAlmostEqual(engine, one_answer, places=15)
        self.assertLess(engine, ignoring_twins)

    def test_it_refuses_invalid_requests(self):
        p = np.array([0.5, 0.4, 0.05, 0.05])
        with self.assertRaises(ValueError):
            engine_reachable_share(p, 2, (0, 1), [near_item("N")], 1, HYPS, NEAR)
        for bad in (-1, True, 1.0):
            with self.subTest(answers_left=bad), self.assertRaises(ValueError):
                engine_reachable_share(p, 0, (0, 1), [near_item("N")], bad, HYPS, NEAR)


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
        self.assertAlmostEqual(decision.leader_share, 0.5, places=15)

    def test_no_answer_sequence_on_the_remaining_items_changes_the_ratio(self):
        remaining = remaining_items(self.unit, self.state)
        start_p = np.array(self.state.posterior)
        for length in (1, 2, 3):
            for options in product(range(4), repeat=length):
                with self.subTest(options=options):
                    p = start_p
                    for item, observed in zip(remaining, options):
                        p = update_posterior(p, likelihood_matrix(item, HYPS, Params()), observed)
                    self.assertAlmostEqual(p[0] / (p[0] + p[1]), self.state.decision.leader_share, places=12)

    def test_the_bound_over_the_whole_budget_equals_the_ratio(self):
        remaining = remaining_items(self.unit, self.state)
        left = self.state.budget - len(self.state.steps)
        bound = reachable_share(np.array(self.state.posterior), 0, (0, 1), remaining, left, HYPS, Params())
        self.assertAlmostEqual(bound, self.state.decision.leader_share, places=15)


class NearRowTests(unittest.TestCase):
    """M2's link on every item is stretch-graded; with w_stretch 0.95 its row is 0.04 TV from M1's."""

    @classmethod
    def setUpClass(cls):
        cls.unit = make_unit([near_item(f"N{i}") for i in range(1, 9)])
        cls.state = session_after(cls.unit, NEAR, ["B", "B"])

    def test_the_rows_differ_but_r4_groups_them(self):
        L = likelihood_matrix(near_item("N"), HYPS, NEAR)
        self.assertFalse(np.array_equal(L[0], L[1]))
        self.assertAlmostEqual(total_variation(L[0], L[1]), 0.04, places=12)
        lead, tied = inseparable_set(np.array(self.state.posterior), remaining_items(self.unit, self.state),
                                     HYPS, NEAR)
        self.assertEqual((lead, tied), (0, (0, 1)))

    def test_r4_refuses_after_two_answers_and_states_a_ceiling(self):
        decision = self.state.decision
        self.assertEqual((decision.rule, decision.leader, decision.tied, len(self.state.steps)),
                         ("R4", "M1", ("M1", "M2"), 2))
        self.assertAlmostEqual(decision.leader_share, 0.5243757431629014, places=12)
        self.assertIn("the most M1 can reach is 0.524", decision.detail)

    def test_one_more_answer_takes_the_leader_past_the_stated_ceiling(self):
        item = remaining_items(self.unit, self.state)[0]
        p = update_posterior(np.array(self.state.posterior), likelihood_matrix(item, HYPS, NEAR), 1)
        self.assertGreater(p[0] / (p[0] + p[1]), self.state.decision.leader_share + 0.01)

    def test_within_the_default_budget_the_leader_still_cannot_reach_theta(self):
        # The claim is false, but at budget 8 the refusal decision itself is consistent:
        # six more answers can lift p(M1)/p(C) to at most 0.596.
        remaining = remaining_items(self.unit, self.state)
        left = self.state.budget - len(self.state.steps)
        bound = reachable_share(np.array(self.state.posterior), 0, (0, 1), remaining, left, HYPS, NEAR)
        p = np.array(self.state.posterior)
        for item in remaining[:left]:  # B on every remaining item is the best path for M1
            p = update_posterior(p, likelihood_matrix(item, HYPS, NEAR), 1)
        self.assertAlmostEqual(p[0] / (p[0] + p[1]), bound, places=12)
        self.assertLess(bound, NEAR.theta)
        self.assertAlmostEqual(bound, 0.5964, places=4)

    def test_without_r4_the_default_eig_floor_would_end_the_session_one_answer_later(self):
        remaining = remaining_items(self.unit, self.state)
        p = np.array(self.state.posterior)
        at_refusal = select_next(p, remaining, HYPS, NEAR).eig
        self.assertGreaterEqual(at_refusal, NEAR.eig_floor)  # 0.0101: R5 would not stop here
        p = update_posterior(p, likelihood_matrix(remaining[0], HYPS, NEAR), 1)
        after_one_more = select_next(p, remaining[1:], HYPS, NEAR).eig
        self.assertLess(after_one_more, NEAR.eig_floor)  # 0.0048: R5 (EIG floor) would stop here


class NearRowDecisionChangeTests(unittest.TestCase):
    """With more items, a larger budget and a lower EIG floor, R4 alone blocks a reachable diagnosis."""

    PARAMS = Params(w_stretch=0.95, eig_floor=0.001)
    BUDGET = 40

    @classmethod
    def setUpClass(cls):
        cls.unit = make_unit([near_item(f"N{i:02d}") for i in range(1, 41)])
        cls.state = session_after(cls.unit, cls.PARAMS, ["B", "B"], budget=cls.BUDGET)

    def test_r4_refuses_at_the_same_point(self):
        self.assertEqual((self.state.decision.rule, len(self.state.steps)), ("R4", 2))

    def test_the_bound_over_the_remaining_budget_exceeds_theta(self):
        remaining = remaining_items(self.unit, self.state)
        bound = reachable_share(np.array(self.state.posterior), 0, (0, 1), remaining,
                                self.BUDGET - len(self.state.steps), HYPS, self.PARAMS)
        self.assertGreater(bound, self.PARAMS.theta)

    def test_only_r4_stops_the_session_until_m1_is_diagnosed_at_answer_29(self):
        by_id = {item.item_id: item for item in self.unit.engine_items}
        history = [(by_id[step.question.item_id], step.option_index) for step in self.state.steps]
        p = np.array(self.state.posterior)
        for item in remaining_items(self.unit, self.state):
            p = update_posterior(p, likelihood_matrix(item, HYPS, self.PARAMS), 1)
            history.append((item, 1))
            remaining = eligible_items(self.unit.engine_items, [it.item_id for it, _ in history])
            best = select_next(p, remaining, HYPS, self.PARAMS).eig
            decision = check_stop(p, history, remaining, best, self.BUDGET, HYPS, self.PARAMS)
            if decision.rule != "R4":
                break
            with self.subTest(answers=len(history)):
                # R1-R3 did not fire (they come first) and R5 would not: budget, items and EIG remain.
                self.assertLess(len(history), self.BUDGET)
                self.assertGreaterEqual(best, self.PARAMS.eig_floor)
        self.assertEqual((decision.rule, decision.leader, len(history)), ("R1", "M1", 29))
        self.assertAlmostEqual(p[0], 0.8045, places=4)


def decide_after(items, asked, options, budget=8, params=Params()):
    """Posterior and stopping decision after answering ``asked`` items with ``options``."""

    p = prior(HYPS, params)
    history = []
    for item, observed in zip(asked, options):
        p = update_posterior(p, likelihood_matrix(item, HYPS, params), observed)
        history.append((item, observed))
    remaining = eligible_items(items, [item.item_id for item in asked])
    best = select_next(p, remaining, HYPS, params).eig if remaining and len(history) < budget else None
    return p, remaining, check_stop(p, history, remaining, best, budget, HYPS, params)


class InteractionTests(unittest.TestCase):
    """C is computed over the remaining eligible items only, not over the budget."""

    def test_a_separator_excluded_as_a_twin_makes_the_pair_inseparable_in_this_session(self):
        shared = [exact_item("X1", twin_group="g"), exact_item("X2"), exact_item("X3")]
        twinned = shared + [separating_item("Y", twin_group="g")]  # Y repeats X1's stem
        untwinned = shared + [separating_item("Y")]
        _, remaining, decision = decide_after(twinned, shared[:2], [1, 1])
        self.assertNotIn("Y", [item.item_id for item in remaining])
        self.assertEqual((decision.rule, decision.tied), ("R4", ("M1", "M2")))
        _, remaining, decision = decide_after(untwinned, shared[:2], [1, 1])
        self.assertIn("Y", [item.item_id for item in remaining])
        self.assertIsNone(decision.rule)  # the separator can still be asked

    def test_the_tied_set_grows_as_separating_items_are_used(self):
        separator, shared = separating_item("Y"), [exact_item(f"X{i}") for i in range(1, 4)]
        p = prior(HYPS, Params())
        for item in shared[:2]:
            p = update_posterior(p, likelihood_matrix(item, HYPS, Params()), 1)
        self.assertEqual(inseparable_set(p, [separator, shared[2]], HYPS, Params()), (0, (0,)))
        self.assertEqual(inseparable_set(p, [shared[2]], HYPS, Params()), (0, (0, 1)))

    def test_with_the_budget_spent_an_exact_pair_still_ends_in_r4(self):
        shared = [exact_item(f"X{i}") for i in range(1, 4)]
        _, _, decision = decide_after(shared, shared[:2], [1, 1], budget=2)
        self.assertEqual((decision.rule, decision.tied), ("R4", ("M1", "M2")))

    def test_with_the_budget_spent_a_pair_whose_only_separator_is_unasked_ends_in_r5(self):
        # The separator cannot be asked any more, so within this session M1 and M2 can
        # no longer be told apart, but R4 does not look at the budget: the outcome is
        # R5 (budget) and no tied set is named. A budget-aware R4 would name {M1, M2}.
        shared = [exact_item("X1"), exact_item("X2")]
        items = shared + [separating_item("Y")]
        p, remaining, decision = decide_after(items, shared, [1, 1], budget=2)
        self.assertEqual((decision.rule, decision.exhausted_by, decision.tied), ("R5", "budget", ()))
        bound = reachable_share(p, 0, (0, 1), remaining, 0, HYPS, Params())
        self.assertLess(bound, Params().theta)


if __name__ == "__main__":
    unittest.main()
