"""Drive one synthetic student through the real engine run loop (I2-A01).

By default the engine chooses every question (start, next_question, answer); the
evaluation can substitute a fixed or random selection method (experiments.selection).
The policy only answers. A run is fully determined by the unit, the parameters, the
selection method, the policy and the seed, so a raw result row can always be regenerated.
"""

from __future__ import annotations

import zlib

import numpy as np

from sonder_engine import Outcome, Params, SessionState, Unit, answer, start

from .policies import StudentPolicy
from .selection import SelectionMethod, ask

RESULT_FIELDS = (
    "unit_id", "policy", "target", "apply_rate", "slip", "truth", "seed",
    "questions_used", "items", "answers", "outcome", "rule", "predicted",
    "leader", "leader_probability", "tied", "exhausted_by",
)


def item_rng(seed: int, item_id: str) -> np.random.Generator:
    """The generator a policy uses for one item in one run.

    Keyed by (seed, item) rather than by question position, so a student's answer
    to an item does not depend on when the item is asked (common random numbers
    across question-selection methods).
    """

    if isinstance(seed, bool) or not isinstance(seed, int) or seed < 0:
        raise ValueError("seed must be a non-negative integer")
    return np.random.default_rng([seed, zlib.crc32(item_id.encode("utf-8"))])


def run_session(unit: Unit, params: Params, policy: StudentPolicy, seed: int = 0, *,
                budget: int | None = None, method: SelectionMethod | None = None) -> SessionState:
    """Run one session to its terminal outcome.

    Without ``method`` (or with ``Adaptive``) the engine's own ``next_question``
    chooses every item; another method chooses through ``next_question_with``.
    """

    state = start(unit, params, budget=budget)
    by_id = {item.item_id: item for item in unit.engine_items}
    while not state.finished:
        state = ask(state, method)
        item = by_id[state.pending.item_id]
        choice = policy.answer(item, item_rng(seed, item.item_id))
        if isinstance(choice, bool) or not isinstance(choice, int) or not 0 <= choice < 4:
            raise ValueError(f"policy {policy.name} returned {choice!r} for {item.item_id}")
        state = answer(state, item.item_id, item.option_ids[choice])
    return state


def predicted_label(state: SessionState) -> str:
    """The label a finished session reports: a misconception, NONE, or '' for a refusal."""

    decision = state.decision
    if decision.outcome is Outcome.DIAGNOSED:
        return decision.leader
    if decision.outcome is Outcome.NONE_DETECTED:
        return "NONE"
    return ""


def result_row(unit: Unit, policy: StudentPolicy, seed: int, state: SessionState) -> dict[str, str]:
    """One raw result row; every value is a string so the CSV round-trips exactly."""

    decision = state.decision
    slot = unit.hyps.index(decision.leader)
    return {
        "unit_id": unit.unit_id,
        "policy": policy.name,
        "target": policy.target,
        "apply_rate": "" if policy.apply_rate is None else f"{policy.apply_rate:g}",
        "slip": "" if policy.slip is None else f"{policy.slip:g}",
        "truth": policy.truth or "",
        "seed": str(seed),
        "questions_used": str(len(state.steps)),
        "items": "|".join(step.question.item_id for step in state.steps),
        "answers": "|".join(step.option_id for step in state.steps),
        "outcome": decision.outcome.value,
        "rule": decision.rule or "",
        "predicted": predicted_label(state),
        "leader": decision.leader,
        "leader_probability": f"{state.posterior[slot]:.10f}",
        "tied": "|".join(decision.tied),
        "exhausted_by": decision.exhausted_by or "",
    }
