"""Harris's pure question-selection calculations (spec section 3.4 and the earlier draft's 5.2).

Entropy and expected information gain are in bits. Nothing here loads data,
keeps session state, or decides when a session stops.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from .bayes import likelihood_matrix
from .model import Item, Params, validate_hypotheses

# EIG is rounded to this many decimals before items are compared, so float
# noise cannot reorder items that are mathematically tied.
EIG_DECIMALS = 9
# Float noise may push EIG slightly below zero; more than this is a defect.
NEGATIVE_EIG_TOLERANCE = 1e-12
# Separation threshold used to choose the pair named in the reason (spec 3.6).
DEFAULT_DELTA = 0.05
# The reason names a pair among this many most probable hypotheses.
LEADER_COUNT = 3


def _check_distribution(p: NDArray[np.float64]) -> None:
    if not isinstance(p, np.ndarray) or p.dtype != np.float64 or p.ndim != 1 or p.size == 0:
        raise ValueError("p must be a non-empty one-dimensional float64 array")
    if not np.all(np.isfinite(p)) or np.any(p < 0):
        raise ValueError("p must contain finite nonnegative probabilities")
    if not np.isclose(np.sum(p), 1.0, rtol=0, atol=1e-12):
        raise ValueError("p must sum to one")


def _clamp_eig(value: float) -> float:
    """Clamp float noise in [-1e-12, 0) to zero; a larger negative value is a defect."""

    if value < -NEGATIVE_EIG_TOLERANCE:
        raise ValueError("negative_eig")
    return max(0.0, value)


def entropy_bits(p: NDArray[np.float64]) -> float:
    """Shannon entropy of a normalised distribution, with 0 log 0 taken as 0."""

    _check_distribution(p)
    nonzero = p[p > 0]
    return float(max(0.0, -np.sum(nonzero * np.log2(nonzero))))


def expected_information_gain(p: NDArray[np.float64], L: NDArray[np.float64]) -> float:
    """Mutual information (bits) between the hypothesis and the answer.

    EIG = sum_h sum_o p(h) P(o|h) log2( P(o|h) / P(o) ), where P(o) is the
    probability of answer o under the current posterior ``p``. It equals the
    expected drop in entropy from asking the item, and is never negative.
    """

    _check_distribution(p)
    if not isinstance(L, np.ndarray) or L.dtype != np.float64 or L.ndim != 2:
        raise ValueError("L must be a two-dimensional float64 array")
    if L.shape[0] != p.size or L.shape[1] == 0:
        raise ValueError("likelihood shape does not match the posterior")
    if not np.all(np.isfinite(L)) or np.any(L < 0):
        raise ValueError("L must contain finite nonnegative probabilities")
    if not np.all(np.isclose(np.sum(L, axis=1), 1.0, rtol=0, atol=1e-12)):
        raise ValueError("each L row must sum to one")

    joint = p[:, None] * L
    answer_probability = joint.sum(axis=0)
    mask = joint > 0
    ratio = np.where(mask, L / np.where(answer_probability > 0, answer_probability, 1.0), 1.0)
    return _clamp_eig(float(np.sum(np.where(mask, joint * np.log2(ratio), 0.0))))


@dataclass(frozen=True)
class Selection:
    """The chosen item and the quantities the run loop stores for the trace."""

    item_id: str
    eig: float  # stored as session_question.expected_ig
    entropy_before: float  # stored as session_question.entropy_before
    ranking: tuple[tuple[str, float], ...]  # every candidate (item_id, eig), best first
    reason: str  # stored as session_question.selection_reason (teacher-facing)

    @property
    def runner_up_id(self) -> str | None:
        return self.ranking[1][0] if len(self.ranking) > 1 else None

    @property
    def runner_up_eig(self) -> float | None:
        return self.ranking[1][1] if len(self.ranking) > 1 else None


def _predicted_options(hypothesis: str, item: Item) -> str:
    """Options a hypothesis predicts: its linked options if triggered, else the correct one."""

    linked = [j for j, links in enumerate(item.links) if hypothesis in links]
    chosen = linked or [item.correct_index]
    return ", ".join(
        item.option_ids[j] + (" = correct" if j == item.correct_index else "") for j in chosen
    )


def _reason(
    p: NDArray[np.float64],
    hyps: tuple[str, ...],
    item: Item,
    L: NDArray[np.float64],
    ranking: tuple[tuple[str, float], ...],
    delta: float,
) -> str:
    # Top three hypotheses by probability, UNMODELLED excluded; ties by hypothesis order.
    leaders = sorted(range(len(hyps) - 1), key=lambda h: (-p[h], h))[:LEADER_COUNT]
    pairs = [(leaders[i], leaders[j]) for i in range(len(leaders)) for j in range(i + 1, len(leaders))]
    pair = next(
        ((a, b) for a, b in pairs if 0.5 * float(np.abs(L[a] - L[b]).sum()) > delta), None
    )
    gain = f"Expected information gain {ranking[0][1]:.3f} bits, best of {len(ranking)} candidate items"
    if len(ranking) > 1:
        tie = " (tie broken by item order)" if ranking[1][1] == ranking[0][1] else ""
        gain += f"; next best {ranking[1][0]} at {ranking[1][1]:.3f} bits{tie}"
    if pair is None:
        return f"Chosen as the most informative remaining item. {gain}."
    a, b = pair
    return (
        f"Chosen to separate {hyps[a]} (p={p[a]:.3f}) from {hyps[b]} (p={p[b]:.3f}): "
        f"{hyps[a]} predicts {_predicted_options(hyps[a], item)}; "
        f"{hyps[b]} predicts {_predicted_options(hyps[b], item)}. {gain}."
    )


def select_next(
    p: NDArray[np.float64],
    items: Sequence[Item],
    hyps: tuple[str, ...],
    params: Params,
    *,
    delta: float = DEFAULT_DELTA,
) -> Selection | None:
    """Pick the eligible item with the highest expected information gain.

    ``items`` must already be the eligible items (unused, twin partners removed,
    and empty once the question budget is spent) in pack order; deciding
    eligibility, the EIG floor and when to stop belongs to the run loop. EIG is
    rounded to nine decimals before comparison and an exact tie goes to the
    earliest item in ``items``, so the choice is deterministic. Returns ``None``
    when there is nothing to select.
    """

    validate_hypotheses(hyps)
    _check_distribution(p)
    if p.size != len(hyps):
        raise ValueError("posterior size does not match the hypotheses")
    if len(items) == 0:
        return None
    ids = [item.item_id for item in items]
    if len(set(ids)) != len(ids):
        raise ValueError("eligible item IDs must be unique")

    matrices = [likelihood_matrix(item, hyps, params) for item in items]
    gains = [round(expected_information_gain(p, L), EIG_DECIMALS) for L in matrices]
    order = sorted(range(len(items)), key=lambda i: (-gains[i], i))
    ranking = tuple((ids[i], gains[i]) for i in order)
    best = order[0]
    return Selection(
        item_id=ids[best],
        eig=gains[best],
        entropy_before=entropy_bits(p),
        ranking=ranking,
        reason=_reason(p, hyps, items[best], matrices[best], ranking, delta),
    )
