"""Synthetic students driven through the real run loop (spec v2 section 6).

The deterministic table is the same one test_engine_stopping.py checks with a
bare loop; here every session goes through start, next_question and answer.
The other cases are the deterministic evidence behind entries in
sonder_engine/KNOWN_FAULTS.md. All students are synthetic (spec honesty rule).
"""

from __future__ import annotations

import copy
import unittest

from sonder_engine import Outcome, Params, build_pack, replay
from sonder_pack.maths_v2 import load_maths_v2

from engine_students import run_policy, run_student
from test_engine_stopping import EXPECTED, TIED
from test_engine_pack import real_rows


def always_first(item):
    """A student who always picks option A, whatever the question."""
    return 0


class DeterministicStudentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_maths_v2()

    def test_spec_6_1_table_through_the_session(self):
        counts = {}
        longest = 0
        for unit in self.pack.units:
            for hypothesis, (outcome, answers) in EXPECTED[unit.unit_id].items():
                with self.subTest(unit=unit.unit_id, student=hypothesis):
                    state = run_student(unit, Params(), hypothesis)
                    self.assertEqual(state.decision.outcome.value, outcome)
                    self.assertEqual(len(state.steps), answers)
                    if outcome == "diagnosed":
                        self.assertEqual(state.decision.leader, hypothesis)
                    if outcome == "escalated_no_separator":
                        self.assertEqual(state.decision.tied, TIED[unit.unit_id])
                    counts[outcome] = counts.get(outcome, 0) + 1
                    longest = max(longest, len(state.steps))
        self.assertEqual(counts, {"diagnosed": 26, "none_detected": 7,
                                  "escalated_no_separator": 8, "escalated_exhausted": 2})
        self.assertLessEqual(longest, 5)  # spec 6.1: no deterministic student needs more than 5


class KnownFaultEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_maths_v2()

    def test_kf03_a_student_who_always_picks_a_is_often_diagnosed(self):
        # Spec 6.4. Decision D-3 keeps min_support at 2; at 3 the U4 case is no longer diagnosed.
        expected = {
            2: {"U1": ("diagnosed", "MATH-2392", 5), "U2": ("diagnosed", "MATH-61", 4),
                "U3": ("escalated_exhausted", None, 8), "U4": ("diagnosed", "MATH-1416", 4),
                "U5": ("diagnosed", "MATH-952", 4), "U6": ("diagnosed", "MATH-161", 2),
                "U7": ("diagnosed", "MATH-2271", 3)},
            3: {"U1": ("diagnosed", "MATH-2392", 5), "U2": ("diagnosed", "MATH-61", 5),
                "U3": ("escalated_exhausted", None, 8), "U4": ("escalated_exhausted", None, 8),
                "U5": ("diagnosed", "MATH-952", 4), "U6": ("diagnosed", "MATH-161", 3),
                "U7": ("diagnosed", "MATH-2271", 4)},
        }
        for min_support, table in expected.items():
            params = Params(min_support=min_support)
            for unit in self.pack.units:
                with self.subTest(min_support=min_support, unit=unit.unit_id):
                    state = run_policy(unit, params, always_first)
                    outcome, leader, answers = table[unit.unit_id]
                    self.assertEqual((state.decision.outcome.value, len(state.steps)), (outcome, answers))
                    if leader:
                        self.assertEqual(state.decision.leader, leader)

    def test_kf07_a_partial_2039_holder_is_diagnosed_as_1965(self):
        # Applies MATH-2039 only where MATH-1965 predicts the same option; answers 2039-only items correctly.
        def partial_2039(item):
            both = [j for j, links in enumerate(item.links) if "MATH-2039" in links and "MATH-1965" in links]
            return both[0] if both else item.correct_index
        state = run_policy(self.pack.unit("U2"), Params(), partial_2039)
        self.assertEqual([(s.question.item_id, s.option_id) for s in state.steps],
                         [("T2-005", "A"), ("T2-001", "C"), ("T2-002", "C")])
        self.assertEqual((state.decision.outcome, state.decision.leader), (Outcome.DIAGNOSED, "MATH-1965"))

    def test_kf02_keeping_1416_in_u6_refuses_a_student_with_no_misconception(self):
        bank, topics, config = real_rows()
        config = copy.deepcopy(config)
        u6 = next(u for u in config["units"] if u["unit_id"] == "U6")
        del u6["drop_hypotheses"]
        unit = build_pack(bank, topics, config, Params()).unit("U6")
        self.assertIn("MATH-1416", unit.hyps)
        for student in ("NONE", "MATH-1416"):
            with self.subTest(student=student):
                state = run_student(unit, Params(), student)
                self.assertEqual((state.decision.outcome, state.decision.tied),
                                 (Outcome.ESCALATED_NO_SEPARATOR, ("MATH-1416", "MATH-2359", "NONE")))
        # With the drop (the decided unit table), the same NONE student is recognised.
        self.assertIs(run_student(self.pack.unit("U6"), Params(), "NONE").decision.outcome,
                      Outcome.NONE_DETECTED)

    def test_kf12_one_slip_would_hide_a_misconception_without_the_three_answer_rule(self):
        # Spec D1: a MATH-1379 holder answers correctly on the first two items. With
        # min_support_none = 2 the session would end there as none_detected (a miss);
        # the default 3 keeps it open and it ends diagnosed.
        unit = self.pack.unit("U1")
        relaxed = replay(unit, Params(min_support_none=2), ["D", "B"])
        self.assertIs(relaxed.decision.outcome, Outcome.NONE_DETECTED)
        default = replay(unit, Params(), ["D", "B", "B", "A"])
        self.assertEqual((default.decision.outcome, default.decision.leader),
                         (Outcome.DIAGNOSED, "MATH-1379"))


if __name__ == "__main__":
    unittest.main()
