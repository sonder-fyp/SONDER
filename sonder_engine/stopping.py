"""Ahmed's stopping and refusal rules (spec v2 section 3.5).

``check_stop`` evaluates rules R1-R5 in order after each answer and returns the
session outcome. Every threshold comes from ``Params``. Nothing here loads data,
keeps session state or chooses items; the run loop supplies the eligible items
and the best expected information gain.
"""

from __future__ import annotations

from collections.abc import Collection, Sequence
from dataclasses import dataclass
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray

from .bayes import likelihood_matrix
from .model import NONE, UNMODELLED, Item, Params, validate_hypotheses


class Outcome(StrEnum):
    """Session status values, as stored in diagnostic_session.status."""

    IN_PROGRESS = "in_progress"
    DIAGNOSED = "diagnosed"
    NONE_DETECTED = "none_detected"
    ESCALATED_NO_SEPARATOR = "escalated_no_separator"
    ESCALATED_EXHAUSTED = "escalated_exhausted"
    ESCALATED_UNMODELLED = "escalated_unmodelled"


@dataclass(frozen=True)
class StopDecision:
    outcome: Outcome
    rule: str | None  # "R1".."R5"; None while in progress
    leader: str  # m* (R1), NONE (R2), UNMODELLED (R3), otherwise the leader over misconceptions and NONE
    tied: tuple[str, ...] = ()  # the inseparable set C for R4, in hypothesis order
    ceiling: float | None = None  # p(leader) / p(C) for R4; derived, never stored
    support: int | None = None  # support of the rule's hypothesis set when it fired
    exhausted_by: str | None = None  # "budget" | "no_items" | "eig_floor" for R5
    detail: str = ""  # generated sentence; becomes escalation.reason for refusals


def total_variation(row_a: NDArray[np.float64], row_b: NDArray[np.float64]) -> float:
    """Half the L1 distance between two answer distributions over the same options.

    Two hypotheses are separable by an item iff this exceeds ``params.delta_sep``.
    """

    a = np.asarray(row_a, dtype=np.float64)
    b = np.asarray(row_b, dtype=np.float64)
    if a.ndim != 1 or a.shape != b.shape or a.size == 0:
        raise ValueError("rows must be non-empty one-dimensional arrays of equal length")
    return 0.5 * float(np.abs(a - b).sum())


def triggered_options(item: Item, hypothesis: str) -> frozenset[int]:
    """Options that count as evidence for a hypothesis (spec 3.5 support).

    A misconception: its linked options. NONE: the correct option. UNMODELLED:
    wrong options with no link. Works on hypothesis names, never indices.
    """

    if hypothesis == NONE:
        return frozenset({item.correct_index})
    if hypothesis == UNMODELLED:
        return frozenset(j for j, links in enumerate(item.links)
                         if j != item.correct_index and not links)
    return frozenset(j for j, links in enumerate(item.links) if hypothesis in links)


def support(history: Sequence[tuple[Item, int]], group: Collection[str]) -> int:
    """Answered steps whose chosen option is triggered by at least one member of ``group``."""

    if isinstance(group, str):
        raise ValueError("group must be a collection of hypothesis names")
    return sum(1 for item, observed in history
               if any(observed in triggered_options(item, h) for h in group))


def _leader(p: NDArray[np.float64], count: int) -> int:
    # Highest probability among the first ``count`` hypotheses; ties go to the lowest slot.
    return max(range(count), key=lambda j: (p[j], -j))


def inseparable_set(p: NDArray[np.float64], remaining: Sequence[Item],
                    hyps: tuple[str, ...], params: Params) -> tuple[int, tuple[int, ...]]:
    """Return (leader index, indices of C) for rule R4.

    The leader is taken over misconceptions and NONE. C holds every hypothesis in
    that range whose answer distribution is within ``delta_sep`` of the leader's on
    every remaining item, so the leader is always in C. With no remaining item, C
    is every hypothesis in the range (nothing can separate them).
    """

    k = len(hyps) - 2
    lead = _leader(p, k + 1)
    rows = [likelihood_matrix(item, hyps, params) for item in remaining]
    tied = tuple(j for j in range(k + 1)
                 if all(total_variation(L[j], L[lead]) <= params.delta_sep for L in rows))
    return lead, tied


def _names(names: Sequence[str]) -> str:
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def check_stop(p: NDArray[np.float64], history: Sequence[tuple[Item, int]],
               remaining: Sequence[Item], best_eig: float | None,
               budget: int, hyps: tuple[str, ...], params: Params) -> StopDecision:
    """Apply R1-R5 in order (spec 3.5) to the posterior after the latest answer.

    ``history`` is every answered (item, option index) pair. ``remaining`` is the
    eligible items (unasked, no twin of an asked item), not cut by the budget.
    ``best_eig`` is the highest rounded EIG among ``remaining``; it may be None
    only when the budget is spent or nothing remains.
    """

    if not isinstance(params, Params):
        raise TypeError("params must be Params")
    validate_hypotheses(hyps, params.k_max)
    if not isinstance(p, np.ndarray) or p.dtype != np.float64 or p.shape != (len(hyps),):
        raise ValueError("p must be a float64 vector aligned with the hypotheses")
    if isinstance(budget, bool) or not isinstance(budget, int) or budget < 1:
        raise ValueError("budget must be a positive integer")
    for item, observed in history:
        if not isinstance(item, Item) or isinstance(observed, bool) or not 0 <= observed < 4:
            raise ValueError("history must hold (Item, option index) pairs")

    k = len(hyps) - 2
    theta = params.theta

    best = _leader(p, k)  # R1: diagnosed
    held = support(history, [hyps[best]])
    if p[best] >= theta and held >= params.min_support:
        return StopDecision(
            Outcome.DIAGNOSED, "R1", hyps[best], support=held,
            detail=(f"R1: {hyps[best]} at p = {p[best]:.3f} with {held} supporting answers "
                    f"(theta = {theta:.2f}, min_support = {params.min_support})."))

    held = support(history, [NONE])  # R2: none detected
    if p[k] >= theta and held >= params.min_support_none:
        return StopDecision(
            Outcome.NONE_DETECTED, "R2", NONE, support=held,
            detail=(f"R2: NONE at p = {p[k]:.3f} with {held} correct answers "
                    f"(theta = {theta:.2f}, min_support_none = {params.min_support_none})."))

    held = support(history, [UNMODELLED])  # R3: off-catalogue answers
    if p[k + 1] >= params.theta_unmodelled and held >= params.min_support:
        return StopDecision(
            Outcome.ESCALATED_UNMODELLED, "R3", UNMODELLED, support=held,
            detail=(f"R3: UNMODELLED at p = {p[k + 1]:.3f} with {held} answers on wrong options "
                    f"that link no misconception (theta_unmodelled = {params.theta_unmodelled:.2f})."))

    lead = _leader(p, k + 1)
    if remaining:  # R4: no remaining item can separate the leader from its tied set
        lead, tied = inseparable_set(p, remaining, hyps, params)
        mass = float(p[list(tied)].sum())
        if len(tied) >= 2 and mass >= theta:
            ceiling = float(p[lead]) / mass
            held = support(history, [hyps[j] for j in tied])
            if ceiling < theta and held >= params.min_support:
                names = tuple(hyps[j] for j in tied)
                return StopDecision(
                    Outcome.ESCALATED_NO_SEPARATOR, "R4", hyps[lead], names, ceiling, held,
                    detail=(f"R4: no remaining item separates {_names(names)} (together p = "
                            f"{mass:.3f}); the most {hyps[lead]} can reach is {ceiling:.3f}, "
                            f"below theta = {theta:.2f}."))

    answered = len(history)  # R5: exhausted
    if answered >= budget:
        return StopDecision(
            Outcome.ESCALATED_EXHAUSTED, "R5", hyps[lead], exhausted_by="budget",
            detail=f"R5 budget: {answered} of {budget} questions used without a decision.")
    if not remaining:
        return StopDecision(
            Outcome.ESCALATED_EXHAUSTED, "R5", hyps[lead], exhausted_by="no_items",
            detail="R5 no items: no eligible item remains in the unit.")
    if best_eig is None:
        raise ValueError("best_eig is required while the budget and the items last")
    if best_eig < params.eig_floor:
        return StopDecision(
            Outcome.ESCALATED_EXHAUSTED, "R5", hyps[lead], exhausted_by="eig_floor",
            detail=(f"R5 information: the best remaining item gains {best_eig:.4f} bits, "
                    f"below eig_floor = {params.eig_floor:g}."))
    return StopDecision(Outcome.IN_PROGRESS, None, hyps[lead])
