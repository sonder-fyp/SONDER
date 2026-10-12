"""Ashher's pure Bayesian calculations for one diagnostic unit."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray
from collections.abc import Sequence

from .model import Item, Params, validate_hypotheses


def prior(hyps: tuple[str, ...], params: Params) -> NDArray[np.float64]:
    """Allocate assumed mass to NONE/UNMODELLED and share the rest equally."""

    if not isinstance(params, Params):
        raise TypeError("params must be Params")
    validate_hypotheses(hyps, params.k_max)
    k = len(hyps) - 2
    result = np.empty(len(hyps), dtype=np.float64)
    result[:k] = (1.0 - params.prior_none - params.prior_unmodelled) / k
    result[k] = params.prior_none
    result[k + 1] = params.prior_unmodelled
    return result


def check_p1(items: Sequence[Item], hyps: tuple[str, ...], params: Params) -> None:
    """Refuse a unit whose guess makes a predicted option no likelier than an outsider.

    The structural Item contract allows three linked wrong answers. Whether a
    response model can use one depends on its parameter set (spec v2 P1).
    Run this over the unit at model freeze; likelihood_matrix also calls it for
    its individual item so a direct caller cannot bypass the rule.
    """

    if not isinstance(params, Params):
        raise TypeError("params must be Params")
    validate_hypotheses(hyps, params.k_max)
    catalogue = set(hyps[:-2])
    for item in items:
        if not isinstance(item, Item):
            raise TypeError("items must contain Item values")
        unknown = {m for links in item.links for m in links} - catalogue
        if unknown:
            raise ValueError(f"{item.item_id} links undeclared misconception IDs: {sorted(unknown)}")
        for misconception in hyps[:-2]:
            size = sum(misconception in links for links in item.links)
            if size and params.guess >= (4 - size) / 4:
                raise ValueError(
                    f"P1: {item.item_id} links {misconception} to {size} options; "
                    f"guess must be < {(4 - size) / 4:g}, got {params.guess:g}"
                )


def likelihood_matrix(
    item: Item, hyps: tuple[str, ...], params: Params
) -> NDArray[np.float64]:
    """Return P(option | hypothesis, item) in hypothesis/option order.

    Linked wrong options form a misconception's predicted set. A misconception
    with no link on this item predicts the correct option, exactly as NONE does.
    UNMODELLED predicts every option uniformly. A shared wrong option receives
    full predicted mass in each linked hypothesis row; it is not divided
    between those hypotheses.
    """

    if not isinstance(item, Item):
        raise TypeError("item must be Item")
    check_p1((item,), hyps, params)

    n = len(item.option_ids)
    result = np.empty((len(hyps), n), dtype=np.float64)
    none_row = np.full(n, params.slip / (n - 1), dtype=np.float64)
    none_row[item.correct_index] = 1.0 - params.slip
    assert item.link_grades is not None  # Item fills missing grades with S.
    for row, misconception in enumerate(hyps[:-2]):
        predicted = [j for j, links in enumerate(item.links) if misconception in links]
        if not predicted:
            result[row, :] = none_row
            continue
        off_rate = params.guess
        grades = [item.link_grades[j][item.links[j].index(misconception)] for j in predicted]
        weight = min(params.w_sound if grade == "S" else params.w_stretch for grade in grades)
        result[row, :] = off_rate / (n - len(predicted))
        result[row, predicted] = (1.0 - off_rate) / len(predicted)
        if weight != 1.0:
            result[row, :] = weight * result[row, :] + (1.0 - weight) * none_row

    result[-2, :] = none_row
    result[-1, :] = 1.0 / n
    return result


def update_posterior(
    p: NDArray[np.float64], L: NDArray[np.float64], observed: int
) -> NDArray[np.float64]:
    """Apply one Bayes update for the zero-based observed option.

    Inputs must already be normalized float64 distributions. Zero entries are
    allowed in externally supplied vectors/matrices so impossible evidence is
    detected explicitly; likelihood_matrix itself always produces positive
    entries. The function never rounds or mutates its inputs.
    """

    if not isinstance(p, np.ndarray) or p.dtype != np.float64 or p.ndim != 1:
        raise ValueError("p must be a one-dimensional float64 array")
    if not isinstance(L, np.ndarray) or L.dtype != np.float64 or L.ndim != 2:
        raise ValueError("L must be a two-dimensional float64 array")
    if p.size == 0 or L.shape[0] != p.size or L.shape[1] == 0:
        raise ValueError("posterior input shapes do not match")
    if isinstance(observed, (bool, np.bool_)) or not isinstance(observed, (int, np.integer)):
        raise ValueError("invalid_option")
    if not 0 <= observed < L.shape[1]:
        raise ValueError("invalid_option")
    if not np.all(np.isfinite(p)) or np.any(p < 0):
        raise ValueError("p must contain finite nonnegative probabilities")
    if not np.all(np.isfinite(L)) or np.any(L < 0):
        raise ValueError("L must contain finite nonnegative probabilities")
    if not np.isclose(np.sum(p), 1.0, rtol=0, atol=1e-12):
        raise ValueError("p must sum to one")
    if not np.all(np.isclose(np.sum(L, axis=1), 1.0, rtol=0, atol=1e-12)):
        raise ValueError("each L row must sum to one")

    joint = p * L[:, observed]
    evidence = float(np.sum(joint, dtype=np.float64))
    if not np.isfinite(evidence) or evidence < 1e-300:
        raise FloatingPointError("zero_evidence")
    return joint / evidence
