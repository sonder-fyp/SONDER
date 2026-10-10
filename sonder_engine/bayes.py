"""Ashher's pure Bayesian calculations for one diagnostic topic."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

from .model import Params, validate_hypotheses


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
