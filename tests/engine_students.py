"""Synthetic students for engine tests (spec v2 section 6.1); not a test module.

A student is a policy: given an item, the index of the option it chooses. Sessions
are driven through the real run loop (start, next_question, answer).
"""

from __future__ import annotations

from collections.abc import Callable

from sonder_engine import Item, Params, SessionState, answer, next_question, start
from sonder_engine.pack import Unit
from sonder_engine.stopping import triggered_options

Policy = Callable[[Item], int]


def deterministic_answer(item: Item, hypothesis: str) -> int:
    """Spec 6.1: the first option linked to the misconception, else the correct one."""

    if hypothesis == "NONE":
        return item.correct_index
    linked = sorted(triggered_options(item, hypothesis))
    return linked[0] if linked else item.correct_index


def run_policy(unit: Unit, params: Params, policy: Policy, *, budget: int | None = None) -> SessionState:
    state = start(unit, params, budget=budget)
    by_id = {item.item_id: item for item in unit.engine_items}
    while not state.finished:
        state = next_question(state)
        item = by_id[state.pending.item_id]
        state = answer(state, item.item_id, item.option_ids[policy(item)])
    return state


def run_student(unit: Unit, params: Params, hypothesis: str, *, budget: int | None = None) -> SessionState:
    return run_policy(unit, params, lambda item: deterministic_answer(item, hypothesis), budget=budget)


def answers_of(state: SessionState) -> list[str]:
    return [step.option_id for step in state.steps]
