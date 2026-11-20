"""Load the Maths_v2 bank into diagnostic units (read-only).

Run from the repository root with ``python -m sonder_pack.maths_v2`` to print
the units, the source hashes and every load warning. Nothing is written.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
from pathlib import Path

from sonder_engine.model import Params
from sonder_engine.pack import Pack, PackError, build_pack

DEFAULT_ROOT = Path(__file__).resolve().parents[1] / "data" / "Maths_v2"
DEFAULT_CONFIG = Path(__file__).resolve().with_name("maths_v2_units.json")


def _read_text(path: Path) -> tuple[str, str]:
    """Return (text, SHA-256 of the exact bytes read)."""

    try:
        data = path.read_bytes()
    except OSError as exc:
        raise PackError("CONFIG", path.as_posix(), f"cannot read file: {exc}") from exc
    try:
        return data.decode("utf-8-sig"), hashlib.sha256(data).hexdigest()
    except UnicodeDecodeError as exc:
        raise PackError("CONFIG", path.as_posix(), f"not UTF-8: {exc}") from exc


def _parse_csv(text: str, location: str) -> list[dict[str, str]]:
    rows = []
    try:
        reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
        for row in reader:
            if None in row or any(value is None for value in row.values()):
                raise PackError("CONFIG", f"{location}:{reader.line_num}",
                                "row does not have the header's number of columns")
            rows.append(row)
    except csv.Error as exc:
        raise PackError("CONFIG", location, str(exc)) from exc
    return rows


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    return _parse_csv(_read_text(path)[0], path.as_posix())


def load_maths_v2(root: Path = DEFAULT_ROOT, config_path: Path = DEFAULT_CONFIG,
                  params: Params | None = None) -> Pack:
    """Read items.csv, topics.csv and the unit table once each, then build the pack."""

    bank_text, bank_sha = _read_text(root / "bank" / "items.csv")
    topics_text, topics_sha = _read_text(root / "topics.csv")
    config_text, config_sha = _read_text(config_path)
    try:
        config = json.loads(config_text)
    except json.JSONDecodeError as exc:
        raise PackError("CONFIG", config_path.as_posix(), f"invalid JSON: {exc}") from exc
    return build_pack(
        _parse_csv(bank_text, "bank/items.csv"),
        _parse_csv(topics_text, "topics.csv"),
        config,
        Params() if params is None else params,
        source_sha256=(("bank/items.csv", bank_sha), ("topics.csv", topics_sha),
                       (config_path.name, config_sha)),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT,
                        help="Directory containing topics.csv and bank/items.csv")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG,
                        help="Unit table (JSON)")
    args = parser.parse_args()
    try:
        pack = load_maths_v2(args.root, args.config)
    except PackError as exc:
        print(f"PACK REFUSED {exc}", file=sys.stderr)
        return 1
    print(f"{pack.identity.content_version} (pack format {pack.pack_format})")
    for name, digest in pack.identity.source_sha256:
        print(f"  sha256 {digest}  {name}")
    for unit in pack.units:
        groups = len({p.item.twin_group or p.item.item_id for p in unit.items})
        print(f"{unit.unit_id} {unit.name}: {len(unit.items)} items, {groups} groups, "
              f"k = {len(unit.hypotheses)}: {', '.join(unit.hyps[:-2])}")
    print(f"Unplaced: {', '.join(p.item.item_id for p in pack.unplaced) or 'none'}")
    for w in pack.warnings:
        where = w.unit_id or "pack"
        decision = f" [{w.decision}]" if w.decision else ""
        print(f"WARNING {w.code:18} {where:4} {w.subject}: {w.detail}{decision}")
    print(f"{len(pack.units)} units; {len(pack.warnings)} warnings.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
