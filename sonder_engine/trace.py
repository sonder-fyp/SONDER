"""Ahmed's evidence trail (T06.06): one plain record per step, held in memory.

Each field is named after the Iteration 1 schema column it will be stored in
(``docs/db/iteration1/sonder_iteration1.sql``); nothing is stored here. Texts
are templates filled from the computation, never free text.
"""

from __future__ import annotations

from dataclasses import dataclass, fields, is_dataclass
from enum import Enum
from typing import TYPE_CHECKING

from ._version import __version__
from .model import NONE, UNMODELLED, Params
from .stopping import Outcome, StopDecision

if TYPE_CHECKING:
    from .session import SessionState


@dataclass(frozen=True)
class HypothesisRecord:  # -> session_hypothesis
    slot: int  # 0..k-1 misconceptions, k = NONE, k+1 = UNMODELLED
    hypothesis_id: str
    kind: str  # hypothesis.kind: "misconception" | "none" | "unmodelled"
    prior: float  # prior_probability


@dataclass(frozen=True)
class CandidateRecord:  # -> question_candidate
    rank: int  # 1 = the presented item
    item_id: str
    eig: float  # rounded to 9 decimals, as select_next compares


@dataclass(frozen=True)
class QuestionRecord:  # -> session_question
    step_index: int
    item_id: str
    selection_reason: str
    entropy_before: float
    expected_ig: float  # equals the rank-1 candidate's eig
    candidates: tuple[CandidateRecord, ...]


@dataclass(frozen=True)
class StepRecord:  # -> session_step and step_posterior
    step_index: int
    question: QuestionRecord  # session_step.session_question_id
    option_id: str  # -> session_step.answer_option_id (label A-D)
    option_index: int
    answer_note: str
    posterior: tuple[float, ...]  # step_posterior.probability per slot, unrounded
    support: tuple[int, ...]  # per slot; the step_support view (derived, not stored)
    decision: StopDecision  # outcome after this answer


@dataclass(frozen=True)
class OutcomeRecord:  # -> diagnostic_session.status and the diagnosis/escalation rows
    outcome: Outcome
    rule: str | None
    diagnosis_candidates: tuple[tuple[int, int], ...]  # (rank, slot) -> diagnosis_candidate
    escalation_reason: str | None  # -> escalation.reason
    escalation_leader_slot: int | None  # -> escalation.leader_session_hypothesis_id
    escalation_candidates: tuple[tuple[int, int], ...]  # (rank, slot) -> escalation_candidate
    ceiling: float | None  # derived from the last posterior, never stored


@dataclass(frozen=True)
class Trace:
    content_version: str
    source_sha256: tuple[tuple[str, str], ...]
    engine_version: str
    unit_id: str  # -> diagnostic_session.unit_id
    question_budget: int  # -> diagnostic_session.question_budget
    params: tuple[tuple[str, float | int], ...]  # every Params field (later an engine_params row)
    hypotheses: tuple[HypothesisRecord, ...]
    steps: tuple[StepRecord, ...]
    pending: QuestionRecord | None
    outcome: OutcomeRecord


def _kind(hypothesis: str) -> str:
    return {NONE: "none", UNMODELLED: "unmodelled"}.get(hypothesis, "misconception")


def _by_probability(posterior: tuple[float, ...], slots) -> list[int]:
    # Most probable first; equal probabilities in slot order.
    return sorted(slots, key=lambda s: (-posterior[s], s))


def _outcome(decision: StopDecision, hyps: tuple[str, ...],
             posterior: tuple[float, ...]) -> OutcomeRecord:
    k = len(hyps) - 2
    leader = hyps.index(decision.leader)
    explained = range(k + 1)  # misconceptions and NONE
    diagnosis: tuple[tuple[int, int], ...] = ()
    escalation: tuple[tuple[int, int], ...] = ()
    leader_slot = None
    if decision.outcome is Outcome.DIAGNOSED:
        runner_up = _by_probability(posterior, [s for s in explained if s != leader])[0]
        diagnosis = ((1, leader), (2, runner_up))
    elif decision.outcome is Outcome.ESCALATED_NO_SEPARATOR:
        tied = _by_probability(posterior, [hyps.index(h) for h in decision.tied])
        escalation = tuple((rank, slot) for rank, slot in enumerate(tied, start=1))
        leader_slot = leader
    elif decision.outcome is Outcome.ESCALATED_EXHAUSTED:
        runner_up = _by_probability(posterior, [s for s in explained if s != leader])[0]
        escalation = ((1, leader), (2, runner_up))
        leader_slot = leader
    elif decision.outcome is Outcome.ESCALATED_UNMODELLED:
        escalation = ((1, leader),)
        leader_slot = leader
    refused = decision.outcome.value.startswith("escalated_")
    return OutcomeRecord(decision.outcome, decision.rule, diagnosis,
                         decision.detail if refused else None, leader_slot, escalation,
                         decision.ceiling)


def trace_of(state: SessionState) -> Trace:
    """The full evidence trail of a session, from its state alone."""

    unit, hyps = state.unit, state.unit.hyps
    return Trace(
        content_version=unit.pack.content_version,
        source_sha256=unit.pack.source_sha256,
        engine_version=__version__,
        unit_id=unit.unit_id,
        question_budget=state.budget,
        params=tuple((f.name, getattr(state.params, f.name)) for f in fields(Params)),
        hypotheses=tuple(HypothesisRecord(slot, h, _kind(h), state.prior[slot])
                         for slot, h in enumerate(hyps)),
        steps=state.steps,
        pending=state.pending,
        outcome=_outcome(state.decision, hyps, state.posterior),
    )


def _plain(value: object) -> object:
    if is_dataclass(value) and not isinstance(value, type):
        return {f.name: _plain(getattr(value, f.name)) for f in fields(value)}
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (tuple, list)):
        return [_plain(v) for v in value]
    return value


def trace_to_dict(trace: Trace) -> dict[str, object]:
    """JSON-safe form of a trace; floats keep their full value (json round-trips them exactly)."""

    result = _plain(trace)
    assert isinstance(result, dict)
    return result
