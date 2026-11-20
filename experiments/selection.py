"""Question-selection methods for the equal-budget comparison (I2-A07, protocol section 3).

Production sessions always choose by expected information gain (``next_question``).
The comparison also needs a fixed non-adaptive order and a random choice, with
everything else identical: the same prior, update, eligibility rule, stopping rules
and budget. ``next_question_with`` builds the pending question from the engine's own
public pieces and differs from ``next_question`` only in which eligible item is
presented and the reason recorded for it.

The engine is deliberately not changed. Its trace maps to ``session_question`` and
``question_candidate``, where rank 1 is the presented item; a fixed or random choice
breaks that, so these sessions are experiment-only and never persisted. Their
recorded reason names the method truthfully, and the candidate list keeps the EIG
ranking for reference.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace

import numpy as np

from sonder_engine import (
    EngineError,
    Item,
    Params,
    Selection,
    SessionState,
    Unit,
    eligible_items,
    next_question,
    prior,
    select_next,
)
from sonder_engine.trace import CandidateRecord, QuestionRecord

# Separates the selection generator from the student's answer generator, which is
# seeded by [seed, crc32(item_id)] (harness.item_rng).
SELECTION_STREAM = 0x5E1EC7


class SelectionMethod:
    """Chooses one eligible item; ``name`` is written to the raw results."""

    name = ""

    def choose(self, state: SessionState, eligible: Sequence[Item], ranking: Selection) -> tuple[str, str]:
        """Return (item_id, reason) for an item in ``eligible``."""

        raise NotImplementedError


class Adaptive(SelectionMethod):
    """The engine's own choice: highest EIG, ties to the earliest item in pack order."""

    name = "adaptive"

    def choose(self, state, eligible, ranking):
        return ranking.item_id, ranking.reason


@dataclass(frozen=True)
class Fixed(SelectionMethod):
    """A non-adaptive order: items ranked once by EIG at the prior, ties in pack order.

    Each question is the first item in that order that is still eligible, whatever
    the student has answered.
    """

    order: tuple[str, ...]
    name = "fixed"

    @classmethod
    def for_unit(cls, unit: Unit, params: Params) -> Fixed:
        ranking = select_next(prior(unit.hyps, params), unit.engine_items, unit.hyps, params)
        return cls(tuple(item_id for item_id, _ in ranking.ranking))

    def choose(self, state, eligible, ranking):
        ids = {item.item_id for item in eligible}
        position, item_id = next((n, i) for n, i in enumerate(self.order, start=1) if i in ids)
        eig = dict(ranking.ranking)[item_id]
        return item_id, (f"Fixed order: position {position} of {len(self.order)} (items ranked once by "
                         f"expected information gain at the prior). Current expected information gain "
                         f"{eig:.3f} bits; the adaptive choice would be {ranking.item_id} at {ranking.eig:.3f} bits.")


@dataclass(frozen=True)
class RandomEligible(SelectionMethod):
    """A uniformly random eligible item, seeded by (run seed, question position)."""

    seed: int
    name = "random"

    def __post_init__(self) -> None:
        if isinstance(self.seed, bool) or not isinstance(self.seed, int) or self.seed < 0:
            raise ValueError("seed must be a non-negative integer")

    def choose(self, state, eligible, ranking):
        rng = np.random.default_rng([self.seed, SELECTION_STREAM, len(state.steps)])
        item_id = eligible[int(rng.integers(len(eligible)))].item_id
        eig = dict(ranking.ranking)[item_id]
        return item_id, (f"Random choice among {len(eligible)} eligible items. Current expected information "
                         f"gain {eig:.3f} bits; the adaptive choice would be {ranking.item_id} at "
                         f"{ranking.eig:.3f} bits.")


def next_question_with(state: SessionState, method: SelectionMethod) -> SessionState:
    """``next_question`` with the presented item chosen by ``method``.

    Same preconditions and errors as the engine: a finished session raises
    ``session_finished`` and a pending question is returned unchanged.
    """

    if state.finished:
        raise EngineError("session_finished", state.decision.outcome.value)
    if state.pending is not None:
        return state
    unit = state.unit
    eligible = eligible_items(unit.engine_items, state.asked_ids)
    ranking = select_next(np.array(state.posterior, dtype=np.float64), eligible, unit.hyps, state.params)
    if ranking is None:  # unreachable: R5 ends a session with no eligible item
        raise RuntimeError("an in-progress session has no eligible item")
    item_id, reason = method.choose(state, eligible, ranking)
    gains = dict(ranking.ranking)
    if item_id not in gains:
        raise ValueError(f"{method.name} chose {item_id!r}, which is not eligible")
    question = QuestionRecord(
        step_index=len(state.steps),
        item_id=item_id,
        selection_reason=reason,
        entropy_before=ranking.entropy_before,
        expected_ig=gains[item_id],
        candidates=tuple(CandidateRecord(rank, candidate, eig)
                         for rank, (candidate, eig) in enumerate(ranking.ranking, start=1)),
    )
    return replace(state, pending=question)


def ask(state: SessionState, method: SelectionMethod | None) -> SessionState:
    """The next question: the engine's own ``next_question`` for adaptive or no method."""

    if method is None or isinstance(method, Adaptive):
        return next_question(state)
    return next_question_with(state, method)
