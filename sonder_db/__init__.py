"""Shared database plumbing: connection settings, exact numeric conversion, migrations."""

from __future__ import annotations

import logging
import os
import re
from decimal import Decimal

ENV_URL = "SONDER_DATABASE_URL"

_URI = re.compile(r"postgres(?:ql)?://[^\s'\"]+", re.IGNORECASE)
_PASSWORD_KV = re.compile(r"(password\s*=\s*)('[^']*'|\S+)", re.IGNORECASE)
_NEON_SECRET = re.compile(r"npg_[A-Za-z0-9]+")


def redact(text: str) -> str:
    """Remove database URLs, password=... pairs and Neon secrets from text meant for logs or a terminal."""

    text = _URI.sub("<database-url>", text)
    text = _PASSWORD_KV.sub(r"\1<redacted>", text)
    return _NEON_SECRET.sub("<redacted>", text)


def describe_error(exc: BaseException) -> str:
    """One safe line for an exception: type, SQLSTATE if any, redacted message."""

    sqlstate = getattr(exc, "sqlstate", None)
    code = f" [{sqlstate}]" if sqlstate else ""
    return f"{type(exc).__name__}{code}: {redact(str(exc))}"


class RedactingFilter(logging.Filter):
    """Redact secrets in log records; psycopg_pool logs connection errors itself."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact(record.getMessage())
        record.args = None
        return True


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
