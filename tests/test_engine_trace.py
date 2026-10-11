"""Checks that every trace fits the Iteration 1 schema (docs/db/iteration1/sonder_iteration1.sql).

No database is used: each constraint and trigger rule that a stored trace must
pass is restated here in Python and applied to every deterministic student of
every unit, plus refusal cases.
"""

from __future__ import annotations

import json
import unittest

from sonder_engine import Outcome, Params, next_question, replay, trace_of, trace_to_dict, __version__
from sonder_engine.pack import Unit
from sonder_engine.trace import Trace
from sonder_pack.maths_v2 import load_maths_v2

from engine_students import run_policy, run_student

TOLERANCE = 1e-9  # the schema's numeric tolerance for sums and EIG equality


def view_support(unit: Unit, trace: Trace, step_index: int, slot: int) -> int:
    """The step_support view's CASE logic, written from the SQL, not from the engine."""
    hypothesis = trace.hypotheses[slot]
    items = {p.item.item_id: p.item for p in unit.items}
    count = 0
    for step in trace.steps[: step_index + 1]:
        item = items[step.question.item_id]
        links = item.links[step.option_index]
        correct = step.option_index == item.correct_index
        if hypothesis.kind == "misconception":
            count += hypothesis.hypothesis_id in links
        elif hypothesis.kind == "none":
            count += correct
        else:
            count += not correct and not links
    return count


class SchemaFit:
    """Mixin: assert a trace satisfies the schema's rules for a stored session."""

    def assertFitsSchema(self, unit: Unit, trace: Trace, params: Params):
        hyps = trace.hypotheses
        k = len(hyps) - 2
        # session_hypothesis: slots 0..n-1; NONE = k, UNMODELLED = k+1; unit order; priors.
        self.assertEqual([h.slot for h in hyps], list(range(len(hyps))))
        self.assertEqual([h.hypothesis_id for h in hyps], list(unit.hyps))
        self.assertEqual((hyps[k].kind, hyps[k + 1].kind), ("none", "unmodelled"))
        self.assertTrue(all(h.kind == "misconception" for h in hyps[:k]))
        self.assertLessEqual(abs(sum(h.prior for h in hyps) - 1), TOLERANCE)
        self.assertLessEqual(abs(hyps[k].prior - params.prior_none), TOLERANCE)
        self.assertLessEqual(abs(hyps[k + 1].prior - params.prior_unmodelled), TOLERANCE)

        position = {p.item.item_id: i for i, p in enumerate(unit.items)}  # unit_item.position
        twin = {p.item.item_id: p.item.twin_group for p in unit.items}
        questions = [s.question for s in trace.steps] + ([trace.pending] if trace.pending else [])
        shown: list[str] = []
        for index, q in enumerate(questions):
            # session_question: next index, within the budget, an item of the unit, never repeated.
            self.assertEqual(q.step_index, index)
            self.assertLess(q.step_index, trace.question_budget)
            self.assertIn(q.item_id, position)
            self.assertNotIn(q.item_id, shown)
            self.assertGreaterEqual(q.entropy_before, 0)
            self.assertGreaterEqual(q.expected_ig, 0)
            self.assertTrue(q.selection_reason.strip())
            # question_candidate: ranks 1..n, rank 1 is the presented item with its expected_ig,
            # non-increasing EIG, exact ties in pack position order, no earlier item or its twin.
            ranks = [c.rank for c in q.candidates]
            self.assertEqual(ranks, list(range(1, len(ranks) + 1)))
            self.assertEqual(q.candidates[0].item_id, q.item_id)
            self.assertLessEqual(abs(q.candidates[0].eig - q.expected_ig), TOLERANCE)
            for a, b in zip(q.candidates, q.candidates[1:]):
                self.assertLessEqual(b.eig, a.eig + TOLERANCE)
                if a.eig == b.eig:
                    self.assertLess(position[a.item_id], position[b.item_id])
            blocked = set(shown) | {i for i in position if twin[i] is not None
                                    and twin[i] in {twin[s] for s in shown}}
            self.assertFalse({c.item_id for c in q.candidates} & blocked)
            self.assertTrue(all(c.eig >= 0 for c in q.candidates))
            shown.append(q.item_id)

        items = {p.item.item_id: p.item for p in unit.items}
        for step in trace.steps:
            # session_step: the answer is an option of the presented item; note never blank.
            self.assertIn(step.option_id, items[step.question.item_id].option_ids)
            self.assertTrue(step.answer_note.strip())
            # step_posterior: one value per hypothesis, each in [0, 1], summing to 1.
            self.assertEqual(len(step.posterior), len(hyps))
            self.assertTrue(all(0 <= v <= 1 for v in step.posterior))
            self.assertLessEqual(abs(sum(step.posterior) - 1), TOLERANCE)
            # step_support view.
            self.assertEqual(list(step.support),
                             [view_support(unit, trace, step.step_index, s) for s in range(len(hyps))])

        o = trace.outcome
        if o.outcome is not Outcome.IN_PROGRESS:
            self.assertIsNone(trace.pending)  # a finished session has no unanswered question
        if o.outcome is Outcome.DIAGNOSED:
            self.assertEqual([r for r, _ in o.diagnosis_candidates], [1, 2])
            self.assertEqual(hyps[dict(o.diagnosis_candidates)[1]].kind, "misconception")
            self.assertEqual(len({s for _, s in o.diagnosis_candidates}), 2)
        else:
            self.assertEqual(o.diagnosis_candidates, ())
        if o.outcome.value.startswith("escalated_"):
            self.assertTrue(o.escalation_reason and o.escalation_reason.strip())
            self.assertIn(o.escalation_leader_slot, range(len(hyps)))
            ranks = [r for r, _ in o.escalation_candidates]
            self.assertEqual(ranks, list(range(1, len(ranks) + 1)))
            self.assertIn(o.escalation_leader_slot, [s for _, s in o.escalation_candidates])
            self.assertEqual(len({s for _, s in o.escalation_candidates}), len(ranks))
            if o.outcome is Outcome.ESCALATED_NO_SEPARATOR:
                self.assertGreaterEqual(len(ranks), 2)
        else:
            self.assertIsNone(o.escalation_reason)
            self.assertIsNone(o.escalation_leader_slot)
            self.assertEqual(o.escalation_candidates, ())


class TraceSchemaTests(SchemaFit, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_maths_v2()

    def test_every_deterministic_student_trace_fits_the_schema(self):
        for unit in self.pack.units:
            for hypothesis in unit.hyps[:-1]:
                with self.subTest(unit=unit.unit_id, student=hypothesis):
                    state = run_student(unit, Params(), hypothesis)
                    self.assertFitsSchema(unit, trace_of(state), Params())

    def test_exhausted_unmodelled_and_in_progress_traces_fit_the_schema(self):
        u1, u7 = self.pack.unit("U1"), self.pack.unit("U7")
        exhausted = run_student(u1, Params(), "NONE", budget=2)
        # Picks a wrong option that links no misconception where one exists, else the correct one.
        unlinked = run_policy(u7, Params(), lambda item: next(
            (j for j, links in enumerate(item.links) if j != item.correct_index and not links),
            item.correct_index))
        pending = next_question(replay(u1, Params(), ["D"]))
        cases = [(u1, exhausted, Outcome.ESCALATED_EXHAUSTED), (u7, unlinked, Outcome.ESCALATED_UNMODELLED),
                 (u1, pending, Outcome.IN_PROGRESS)]
        for unit, state, outcome in cases:
            with self.subTest(outcome=outcome.value):
                self.assertIs(state.decision.outcome, outcome)
                self.assertFitsSchema(unit, trace_of(state), Params())

    def test_outcome_candidates(self):
        u1, u4 = self.pack.unit("U1"), self.pack.unit("U4")
        diagnosed = trace_of(replay(u1, Params(), ["D", "B", "B", "A"])).outcome
        self.assertEqual(diagnosed.diagnosis_candidates, ((1, 1), (2, 4)))  # MATH-1379, then NONE
        refused = trace_of(replay(u4, Params(), ["D", "A"])).outcome
        self.assertEqual((refused.escalation_leader_slot, refused.escalation_candidates),
                         (3, ((1, 3), (2, 4))))  # MATH-1514 leads, MATH-1773 tied
        self.assertAlmostEqual(refused.ceiling, 0.5, places=12)
        self.assertTrue(refused.escalation_reason.startswith("R4: "))
        exhausted = trace_of(run_student(u1, Params(), "NONE", budget=2)).outcome
        self.assertEqual(len(exhausted.escalation_candidates), 2)
        self.assertEqual(exhausted.escalation_candidates[0], (1, exhausted.escalation_leader_slot))
        self.assertTrue(exhausted.escalation_reason.startswith("R5 budget: "))

    def test_header_names_content_engine_and_parameters(self):
        trace = trace_of(replay(self.pack.unit("U1"), Params(), ["D"]))
        self.assertEqual(trace.content_version, "Maths_v2")
        self.assertEqual([name for name, _ in trace.source_sha256],
                         ["bank/items.csv", "topics.csv", "maths_v2_units.json"])
        self.assertEqual(trace.engine_version, __version__)
        self.assertEqual(dict(trace.params)["min_support"], 2)
        self.assertEqual((trace.unit_id, trace.question_budget), ("U1", 8))

    def test_json_round_trip_keeps_every_value(self):
        trace = trace_to_dict(trace_of(replay(self.pack.unit("U4"), Params(), ["D", "A"])))
        self.assertEqual(json.loads(json.dumps(trace)), trace)
        self.assertEqual(trace["outcome"]["outcome"], "escalated_no_separator")
        self.assertIsInstance(trace["steps"][0]["posterior"][0], float)


if __name__ == "__main__":
    unittest.main()
