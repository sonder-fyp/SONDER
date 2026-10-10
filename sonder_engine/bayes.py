"""Ashher's pure Bayesian calculations for one diagnostic topic."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

from .model import Item, Params, validate_hypotheses


def prior(hyps: tuple[str, ...], params: Params) -> NDArray[np.float64]:
    """Allocate assumed mass to NONE/UNMODELLED and share the rest equally."""

    validate_hypotheses(hyps)
    if not isinstance(params, Params):
        raise TypeError("params must be Params")
    k = len(hyps) - 2
    result = np.empty(len(hyps), dtype=np.float64)
    result[:k] = (1.0 - params.prior_none - params.prior_unmodelled) / k
    result[k] = params.prior_none
    result[k + 1] = params.prior_unmodelled
    return result


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
    validate_hypotheses(hyps)
    if not isinstance(params, Params):
        raise TypeError("params must be Params")
    catalogue = set(hyps[:-2])
    unknown = {m for option_links in item.links for m in option_links} - catalogue
    if unknown:
        raise ValueError(f"item links undeclared misconception IDs: {sorted(unknown)}")

    n = len(item.option_ids)
    result = np.empty((len(hyps), n), dtype=np.float64)
    for row, misconception in enumerate(hyps[:-2]):
        predicted = [j for j, links in enumerate(item.links) if misconception in links]
        off_rate = params.guess if predicted else params.slip
        if not predicted:
            predicted = [item.correct_index]
        result[row, :] = off_rate / (n - len(predicted))
        result[row, predicted] = (1.0 - off_rate) / len(predicted)

    result[-2, :] = params.slip / (n - 1)
    result[-2, item.correct_index] = 1.0 - params.slip
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
