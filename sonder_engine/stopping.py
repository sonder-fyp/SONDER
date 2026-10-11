"""Ahmed's stopping and refusal rules (spec v2 section 3.5).

This first part holds the separation measure that the pack loader shares with
the R4 no-separator rule. Nothing here loads data or keeps session state.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray


def total_variation(row_a: NDArray[np.float64], row_b: NDArray[np.float64]) -> float:
    """Half the L1 distance between two answer distributions over the same options.

    Two hypotheses are separable by an item iff this exceeds ``params.delta_sep``.
    """

    a = np.asarray(row_a, dtype=np.float64)
    b = np.asarray(row_b, dtype=np.float64)
    if a.ndim != 1 or a.shape != b.shape or a.size == 0:
        raise ValueError("rows must be non-empty one-dimensional arrays of equal length")
    return 0.5 * float(np.abs(a - b).sum())
