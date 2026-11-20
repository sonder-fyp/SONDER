"""Platform-independent identity of the content an experiment ran on.

``load_maths_v2`` hashes the bytes it reads from disk. With Git's ``core.autocrlf``
(the Windows default) the checked-out files contain CRLF line endings, so the same
committed content hashes differently on Windows and on Linux CI. Experiments
therefore record a line-ending-independent SHA-256: CRLF is converted to LF before
hashing, which reproduces the hash of the committed file on every platform. The
as-loaded hashes are kept beside it and labelled as platform-dependent.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from sonder_engine.pack import Pack
from sonder_pack.maths_v2 import DEFAULT_CONFIG, DEFAULT_ROOT

SOURCES = {
    "bank/items.csv": DEFAULT_ROOT / "bank" / "items.csv",
    "topics.csv": DEFAULT_ROOT / "topics.csv",
    DEFAULT_CONFIG.name: DEFAULT_CONFIG,
}


def lf_sha256(path: Path) -> str:
    """SHA-256 of a text file with every CRLF converted to LF."""

    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def canonical_source_sha256(pack: Pack) -> dict[str, str]:
    """Line-ending-independent hashes of the default Maths_v2 sources behind ``pack``.

    Refuses a pack whose sources are not the default files, so a hash can never be
    attached to content it does not describe.
    """

    loaded = dict(pack.identity.source_sha256)
    if set(loaded) != set(SOURCES):
        raise ValueError(f"pack sources {sorted(loaded)} are not the default Maths_v2 files")
    for name, path in SOURCES.items():
        if hashlib.sha256(path.read_bytes()).hexdigest() != loaded[name]:
            raise ValueError(f"{name} on disk is not the file this pack was loaded from")
    return {name: lf_sha256(path) for name, path in SOURCES.items()}
