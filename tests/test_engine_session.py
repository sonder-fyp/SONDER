"""Checks for the run loop: worked examples, twins, budget, errors and replay.

Expected numbers come from docs/ENGINE_SPEC_DRAFT.md section 5 (D1, D2) and the D4 refusal,
re-measured on the 133-item candidate. U6 is the unit after decision D-2.
"""

from __future__ import annotations

import unittest
from unittest import mock

import numpy as np

from sonder_engine import (
    EngineError, Outcome, Params, answer, build_pack, next_question, replay, start, trace_of, trace_to_dict,
)
from sonder_engine.trace import QuestionRecord
from sonder_pack.maths_v2 import load_maths_v2

from engine_students import answers_of, run_policy, run_student


def by_letters(letters):
    return lambda item: item.option_ids.index(letters[item.item_id])


class WorkedExampleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_maths_v2()

    def test_d1_u1_rounding(self):
        # T1-001 has T1-005's link pattern and wins the EIG tie in pack order.
        # The same student therefore gives the same EIGs and posteriors.
        state = run_policy(self.pack.unit("U1"), Params(),
                           by_letters({"T1-001": "B", "T1-006": "B", "T1-005": "A", "T1-007": "B"}))
        steps = state.steps
        self.assertEqual([s.question.item_id for s in steps], ["T1-001", "T1-006", "T1-005", "T1-007"])
        for step, eig in zip(steps, [0.7887, 0.6472, 0.2232, 0.5546]):
            self.assertAlmostEqual(step.question.expected_ig, eig, places=4)
        expected = [[.0391, .0391, .3520, .0391, .5028, .0279], [.0073, .0655, .0655, .0073, .8416, .0130],
                    [.0090, .5674, .0270, .0090, .3474, .0402], [.0021, .9423, .0021, .0021, .0275, .0238]]
        for step, posterior in zip(steps, expected):
            np.testing.assert_allclose(step.posterior, posterior, atol=5e-5)
        self.assertAlmostEqual(steps[0].question.entropy_before, 2.4763, places=4)
        self.assertIs(steps[1].decision.outcome, Outcome.IN_PROGRESS)  # NONE .8416, support 2 < 3
        self.assertEqual((state.decision.outcome, state.decision.leader, state.decision.support),
                         (Outcome.DIAGNOSED, "MATH-1379", 2))

    def test_d2_u4_diagnosed(self):
        # On the 117-item bank D2 (T4-001 D, T5-011 A) was refused naming 1514 and 1773. B19's T4-011
        # links its "adds" option C to MATH-1514 alone, so the second answer separates them.
        state = run_policy(self.pack.unit("U4"), Params(), by_letters({"T4-001": "D", "T4-011": "C"}))
        self.assertEqual([s.question.item_id for s in state.steps], ["T4-001", "T4-011"])
        for step, eig in zip(state.steps, [0.7517, 0.5489]):
            self.assertAlmostEqual(step.question.expected_ig, eig, places=4)
        np.testing.assert_allclose(state.steps[0].posterior,
                                   [.0181, .0542, .0542, .3794, .3794, .0181, .0387, .0581], atol=5e-5)
        np.testing.assert_allclose(state.steps[1].posterior,
                                   [.0020, .0060, .0060, .8887, .0423, .0020, .0043, .0486], atol=5e-5)
        d = state.decision
        self.assertEqual((d.outcome, d.leader, d.tied, d.support), (Outcome.DIAGNOSED, "MATH-1514", (), 2))

    def test_d4_u4_refusal(self):
        # A refusal that remains (spec section 5 D4): the two items separating 1514 from 1773 were answered
        # without the separating option, so every remaining U4 item gives them identical rows.
        letters = {"T4-001": "D", "T4-011": "B", "T4-012": "C", "T5-013": "B"}
        state = run_policy(self.pack.unit("U4"), Params(), by_letters(letters))
        self.assertEqual([s.question.item_id for s in state.steps], ["T4-001", "T4-011", "T4-012", "T5-013"])
        for step, eig in zip(state.steps, [0.7517, 0.5489, 0.4674, 0.4354]):
            self.assertAlmostEqual(step.question.expected_ig, eig, places=4)
        expected = [[.0181, .0542, .0542, .3794, .3794, .0181, .0387, .0581],
                    [.0085, .0254, .0254, .5328, .1776, .0085, .0181, .2039],
                    [.0223, .0669, .0669, .1561, .4683, .0223, .0478, .1493],
                    [.0015, .0138, .0046, .2246, .6739, .0015, .0033, .0768]]
        for step, posterior in zip(state.steps, expected):
            np.testing.assert_allclose(step.posterior, posterior, atol=5e-5)
        d = state.decision
        self.assertEqual((d.outcome, d.rule, d.leader, d.tied, d.support),
                         (Outcome.ESCALATED_NO_SEPARATOR, "R4", "MATH-1773", ("MATH-1514", "MATH-1773"), 2))
        self.assertAlmostEqual(d.leader_share, 0.75, places=4)
        self.assertEqual(d.reachable_share, d.leader_share)  # identical rows (KF-15)

    def test_answer_notes_quote_the_option_text(self):
        # D1 starts at T1-001 and D4 visits the new separator T4-011.
        state = replay(self.pack.unit("U1"), Params(), ["B", "B", "A"])
        self.assertEqual(state.steps[0].answer_note, "Chose B (3,900), the correct option.")
        self.assertEqual(state.steps[2].answer_note, "Chose A (48,000), linked to MATH-1379.")
        u4 = replay(self.pack.unit("U4"), Params(), ["D", "B"])
        self.assertEqual(u4.steps[0].answer_note, "Chose D (Rs 28), linked to MATH-1514 and MATH-1773.")
        self.assertEqual(u4.steps[1].answer_note,
                         "Chose B (35), a wrong option linked to no misconception: evidence for UNMODELLED.")


class TwinAndBudgetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_maths_v2()

    def test_twin_of_an_asked_item_is_never_offered(self):
        unit = self.pack.unit("U6")
        for hypothesis in unit.hyps[:-1]:
            state = run_student(unit, Params(), hypothesis)
            self.assertEqual(state.steps[0].question.item_id, "T6-010", hypothesis)
            later = {c.item_id for s in state.steps[1:] for c in s.question.candidates}
            self.assertNotIn("T6-010B", later, hypothesis)

    def test_a_b_twin_asked_first_blocks_its_a_twin(self):
        # Synthetic: the twins share a stem; the linked one (B) is asked first.
        def rows(item_id, stem, links):
            return [{"item_id": item_id, "topic": "L1", "target": "M-1", "stem": stem, "option_id": o,
                     "option_text": f"{item_id} {o}", "is_correct": str(o == "A"),
                     "misconceptions": links.get(o, ""), "status": "approved", "batch": "B0"} for o in "ABCD"]
        bank = rows("X-1", "same", {}) + rows("X-1B", "same", {"B": "M-1", "C": "M-2"}) + rows("Y-1", "other", {"B": "M-2"})
        topics = [{"topic": "T", "MisconceptionId": m, "MisconceptionName": m} for m in ("M-1", "M-2")]
        config = {"pack_format": 2, "content_version": "t", "subject": "s",
                  "labels": [{"label": "L1", "unit": "U1"}], "units": [{"unit_id": "U1", "name": "U", "topic": "T"}]}
        unit = build_pack(bank, topics, config, Params(default_budget=2)).unit("U1")
        state = next_question(start(unit, Params()))
        self.assertEqual(state.pending.item_id, "X-1B")
        state = next_question(answer(state, "X-1B", "A"))
        self.assertEqual([c.item_id for c in state.pending.candidates], ["Y-1"])

    def test_never_more_questions_than_the_budget(self):
        state = run_student(self.pack.unit("U1"), Params(), "NONE", budget=2)
        self.assertEqual(len(state.steps), 2)
        self.assertEqual((state.decision.outcome, state.decision.exhausted_by),
                         (Outcome.ESCALATED_EXHAUSTED, "budget"))
        self.assertIsNone(state.pending)
        with self.assertRaises(EngineError) as caught:
            next_question(state)
        self.assertEqual(caught.exception.code, "session_finished")


class ErrorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.unit = load_maths_v2().unit("U1")

    def assertRejected(self, code, state, *args):
        before = trace_to_dict(trace_of(state))
        with self.assertRaises(EngineError) as caught:
            answer(state, *args)
        self.assertEqual(caught.exception.code, code)
        self.assertEqual(trace_to_dict(trace_of(state)), before)  # nothing changed

    def test_each_rejected_answer_leaves_the_state_unchanged(self):
        # T1-001 now wins the opening EIG tie, changing the option text and the D1 replay.
        fresh = start(self.unit, Params())
        self.assertRejected("no_pending_question", fresh, "T1-001", "D")
        pending = next_question(fresh)
        self.assertRejected("not_pending_item", pending, "T1-006", "B")
        self.assertRejected("invalid_option", pending, "T1-001", "E")
        self.assertRejected("invalid_option", pending, "T1-001", "3,900")  # text is not an option ID
        finished = replay(self.unit, Params(), ["B", "B", "A", "B"])
        self.assertTrue(finished.finished)
        self.assertRejected("session_finished", finished, "T1-010", "A")
        with self.assertRaises(EngineError):
            replay(self.unit, Params(), ["B", "B", "A", "B", "A"])

    def test_zero_evidence_is_an_error_not_an_outcome(self):
        pending = next_question(start(self.unit, Params()))
        impossible = np.zeros((len(self.unit.hyps), 4))
        impossible[:, 0] = 1.0  # every hypothesis puts all mass on A; the student answers B
        with mock.patch("sonder_engine.session.likelihood_matrix", return_value=impossible):
            self.assertRejected("zero_evidence", pending, "T1-001", "B")  # T1-001 now wins the opening tie.

    def test_invalid_budget_and_mismatched_parameters(self):
        for budget in (0, -1, True, 2.0):
            with self.assertRaises(EngineError) as caught:
                start(self.unit, Params(), budget=budget)
            self.assertEqual(caught.exception.code, "invalid_budget")
        # A unit holding a 3-option link loads only below guess 0.25; a session at 0.30 is refused.
        bank = [{"item_id": "I", "topic": "L", "target": "M", "stem": "s", "option_id": o, "option_text": o,
                 "is_correct": str(o == "A"), "misconceptions": "" if o == "A" else "M",
                 "status": "approved", "batch": "B"} for o in "ABCD"]
        config = {"pack_format": 2, "content_version": "t", "subject": "s",
                  "labels": [{"label": "L", "unit": "U"}], "units": [{"unit_id": "U", "name": "U", "topic": "T"}]}
        unit = build_pack(bank, [{"topic": "T", "MisconceptionId": "M", "MisconceptionName": "m"}],
                          config, Params(guess=0.24, default_budget=1)).unit("U")
        start(unit, Params(guess=0.24))
        with self.assertRaisesRegex(ValueError, "P1"):
            start(unit, Params())


class ReplayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_maths_v2()

    def test_every_deterministic_student_replays_to_an_identical_trace(self):
        for unit in self.pack.units:
            for hypothesis in unit.hyps[:-1]:
                with self.subTest(unit=unit.unit_id, student=hypothesis):
                    live = run_student(unit, Params(), hypothesis)
                    again = replay(unit, Params(), answers_of(live))
                    self.assertEqual(again, live)  # exact float equality, field by field
                    self.assertEqual(trace_to_dict(trace_of(again)), trace_to_dict(trace_of(live)))

    def test_next_question_is_idempotent_and_states_are_immutable(self):
        unit = self.pack.unit("U2")
        fresh = start(unit, Params())
        first = next_question(fresh)
        self.assertIs(next_question(first), first)
        self.assertIsNone(fresh.pending)
        self.assertIsInstance(first.pending, QuestionRecord)
        after = answer(first, first.pending.item_id, "A")
        self.assertEqual(len(first.steps), 0)
        self.assertEqual(len(after.steps), 1)

    def test_rejects_a_string_of_answers(self):
        with self.assertRaises(ValueError):
            replay(self.pack.unit("U1"), Params(), "DBBA")


if __name__ == "__main__":
    unittest.main()
