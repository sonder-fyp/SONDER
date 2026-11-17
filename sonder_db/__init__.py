"""Shared database plumbing: connection settings, exact numeric conversion, migrations."""

from __future__ import annotations

import os
from decimal import Decimal

ENV_URL = "SONDER_DATABASE_URL"


def database_url(value: str | None = None) -> str:
    """The PostgreSQL connection string, from the argument or SONDER_DATABASE_URL."""

    url = value or os.environ.get(ENV_URL, "")
    if not url:
        raise RuntimeError(f"{ENV_URL} is not set")
    return url


def num(value: float | int) -> Decimal:
    """A float as the exact decimal PostgreSQL ``numeric`` should store.

    Passing a Python float directly makes PostgreSQL cast float8 to numeric, which
    keeps only 15 significant digits. ``repr`` gives the shortest string that
    round-trips, so ``float(num(x)) == x`` and stored evidence equals the engine's.
    """

    if isinstance(value, bool):
        raise TypeError("booleans are not numeric evidence")
    return Decimal(repr(value))
