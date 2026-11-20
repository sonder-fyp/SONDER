"""Ahmed's run loop: one diagnostic session as an immutable value.

``start``, ``next_question`` and ``answer`` each return a new ``SessionState``;
the state passed in is never changed, so a rejected answer cannot corrupt a
session. There is no clock, randomness or I/O: the same unit, parameters and
answers always give the same states, so ``replay`` reproduces a session from its
answers alone.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace

import numpy as np

from .bayes import check_p1, likelihood_matrix, prior, update_posterior
from .model import Item, Params
from .pack import PackItem, Unit
from .selection import eligible_items, select_next
from .stopping import Outcome, StopDecision, check_stop, support
from .trace import CandidateRecord, QuestionRecord, StepRecord


class EngineError(ValueError):
    """A request the session cannot accept; the state is unchanged."""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code


@dataclass(frozen=True)
class SessionState:
    unit: Unit
    params: Params
    budget: int
    prior: tuple[float, ...]  # slot order, exact float64 values
    posterior: tuple[float, ...]
    steps: tuple[StepRecord, ...]
    pending: QuestionRecord | None
    decision: StopDecision

    @property
    def finished(self) -> bool:
        return self.decision.outcome is not Outcome.IN_PROGRESS

    @property
    def asked_ids(self) -> tuple[str, ...]:
        return tuple(step.question.item_id for step in self.steps)


def _pack_item(unit: Unit, item_id: str) -> PackItem:
    return next(p for p in unit.items if p.item.item_id == item_id)


def _history(unit: Unit, steps: Sequence[StepRecord]) -> list[tuple[Item, int]]:
    return [(_pack_item(unit, s.question.item_id).item, s.option_index) for s in steps]


def _decide(unit: Unit, params: Params, budget: int, p: np.ndarray,
            history: list[tuple[Item, int]]) -> StopDecision:
    remaining = eligible_items(unit.engine_items, [item.item_id for item, _ in history])
    best = None
    if len(history) < budget and remaining:
        best = select_next(p, remaining, unit.hyps, params).eig
    return check_stop(p, history, remaining, best, budget, unit.hyps, params)


def _answer_note(pack_item: PackItem, observed: int) -> str:
    item = pack_item.item
    chosen = f"Chose {item.option_ids[observed]} ({pack_item.option_texts[observed]})"
    if observed == item.correct_index:
        return f"{chosen}, the correct option."
    links = item.links[observed]
    if not links:
        return f"{chosen}, a wrong option linked to no misconception: evidence for UNMODELLED."
    names = links[0] if len(links) == 1 else ", ".join(links[:-1]) + " and " + links[-1]
    return f"{chosen}, linked to {names}."


def start(unit: Unit, params: Params, *, budget: int | None = None) -> SessionState:
    """Open a session on one unit; no question is pending until ``next_question``."""

    if not isinstance(unit, Unit):
        raise TypeError("unit must be a pack Unit")
    if not isinstance(params, Params):
        raise TypeError("params must be Params")
    budget = params.default_budget if budget is None else budget
    if isinstance(budget, bool) or not isinstance(budget, int) or budget < 1:
        raise EngineError("invalid_budget", "budget must be a positive integer")
    # The unit was checked at load time; re-check P1 with the parameters this session uses.
    check_p1(unit.engine_items, unit.hyps, params)
    p = prior(unit.hyps, params)
    values = tuple(p.tolist())
    return SessionState(unit, params, budget, values, values, (), None,
                        _decide(unit, params, budget, p, []))


def next_question(state: SessionState) -> SessionState:
    """Choose the next question by expected information gain; idempotent while one is pending."""

    if state.finished:
        raise EngineError("session_finished", state.decision.outcome.value)
    if state.pending is not None:
        return state
    unit = state.unit
    remaining = eligible_items(unit.engine_items, state.asked_ids)
    p = np.array(state.posterior, dtype=np.float64)
    chosen = select_next(p, remaining, unit.hyps, state.params)
    if chosen is None:  # unreachable: R5 ends a session with no eligible item
        raise RuntimeError("an in-progress session has no eligible item")
    question = QuestionRecord(
        step_index=len(state.steps),
        item_id=chosen.item_id,
        selection_reason=chosen.reason,
        entropy_before=chosen.entropy_before,
        expected_ig=chosen.eig,
        candidates=tuple(CandidateRecord(rank, item_id, eig)
                         for rank, (item_id, eig) in enumerate(chosen.ranking, start=1)),
    )
    return replace(state, pending=question)


def answer(state: SessionState, item_id: str, option_id: str) -> SessionState:
    """Apply the student's answer to the pending question and check the stopping rules."""

    if state.finished:
        raise EngineError("session_finished", state.decision.outcome.value)
    if state.pending is None:
        raise EngineError("no_pending_question")
    if item_id != state.pending.item_id:
        raise EngineError("not_pending_item", f"{item_id!r} is not the pending {state.pending.item_id}")
    unit, params = state.unit, state.params
    pack_item = _pack_item(unit, item_id)
    item = pack_item.item
    if option_id not in item.option_ids:
        raise EngineError("invalid_option", f"{option_id!r} is not an option of {item_id}")
    observed = item.option_ids.index(option_id)
    p = np.array(state.posterior, dtype=np.float64)
    try:
        p = update_posterior(p, likelihood_matrix(item, unit.hyps, params), observed)
    except FloatingPointError as exc:
        raise EngineError("zero_evidence", str(exc)) from exc
    history = _history(unit, state.steps) + [(item, observed)]
    decision = _decide(unit, params, state.budget, p, history)
    step = StepRecord(
        step_index=len(state.steps),
        question=state.pending,
        option_id=option_id,
        option_index=observed,
        answer_note=_answer_note(pack_item, observed),
        posterior=tuple(p.tolist()),
        support=tuple(support(history, [h]) for h in unit.hyps),
        decision=decision,
    )
    return replace(state, posterior=step.posterior, steps=state.steps + (step,),
                   pending=None, decision=decision)


def replay(unit: Unit, params: Params, answers: Sequence[str], *,
           budget: int | None = None) -> SessionState:
    """Rebuild a session from its option IDs alone; the engine re-chooses every item."""

    if isinstance(answers, str):
        raise ValueError("answers must be a sequence of option IDs")
    state = start(unit, params, budget=budget)
    for option_id in answers:
        state = next_question(state)
        assert state.pending is not None
        state = answer(state, state.pending.item_id, option_id)
    return state

