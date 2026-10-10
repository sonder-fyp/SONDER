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
