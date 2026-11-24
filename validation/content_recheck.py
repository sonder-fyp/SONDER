"""Read-only recheck of a Maths_v2 content change (Ashher's G1 review, I2-A05).

Run from the repository root:

    python -m validation.content_recheck                 # compare with origin/dev
    python -m validation.content_recheck --base 7ff9978  # compare with any commit

It prints three things, so a reviewer can rerun the counts in
validation/reviews/I2_CONTENT_2026-11-24_ashher.md:

1. the inventory change against the base commit (items added, removed and
   changed, by kind of change, and every changed option link);
2. whether the approved batch files equal the bank cell by cell (``status`` and
   ``batch`` excluded; B09 is a draft and not in the bank);
3. per unit, as the engine loads it: items, twin groups, k, the hypothesis with
   the fewest trigger groups, and every pair separated by four or fewer groups.

It changes nothing and approves nothing. Item meaning and link soundness still
need a human reviewer and the external expert.
"""

from __future__ import annotations

import argparse
import csv
import io
import subprocess
import sys
from collections import defaultdict
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "Maths_v2"
BANK = "data/Maths_v2/bank/items.csv"
FIELDS = (("stem", "stem"), ("option_text", "options"), ("misconceptions", "links"),
          ("is_correct", "correct"), ("target", "target"), ("topic", "topic"))


def _by_item(rows) -> dict[str, dict[str, dict[str, str]]]:
    items: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    for row in rows:
        items[row["item_id"]][row["option_id"]] = row
    return items


def bank_at(ref: str) -> dict[str, dict[str, dict[str, str]]]:
    text = subprocess.run(["git", "show", f"{ref}:{BANK}"], cwd=ROOT, check=True,
                          capture_output=True, text=True, encoding="utf-8").stdout
    return _by_item(csv.DictReader(io.StringIO(text.lstrip("﻿"))))


def bank_now() -> dict[str, dict[str, dict[str, str]]]:
    with (DATA / "bank" / "items.csv").open(encoding="utf-8-sig", newline="") as handle:
        return _by_item(csv.DictReader(handle))


def inventory(old, new) -> list[str]:
    lines = []
    added, removed = sorted(set(new) - set(old)), sorted(set(old) - set(new))
    lines.append(f"added {len(added)}: {' '.join(added)}")
    lines.append(f"removed {len(removed)}: {' '.join(removed)}")
    kinds: dict[tuple[str, ...], list[str]] = defaultdict(list)
    links = []
    for item_id in sorted(set(old) & set(new)):
        before, after = old[item_id], new[item_id]
        changed = tuple(name for column, name in FIELDS
                        if any(before[o].get(column) != after[o].get(column) for o in after))
        if changed:
            kinds[changed].append(item_id)
        for option in sorted(after):
            if before[option]["misconceptions"] != after[option]["misconceptions"]:
                links.append(f"  {item_id} {option}: '{before[option]['misconceptions']}' -> "
                             f"'{after[option]['misconceptions']}'")
    lines.append(f"changed {sum(len(v) for v in kinds.values())}")
    for kind, ids in sorted(kinds.items()):
        lines.append(f"  {' + '.join(kind)} ({len(ids)}): {' '.join(ids)}")
    lines.append(f"changed option links on kept items: {len(links)}")
    lines.extend(links)
    return lines


def batches_equal_bank(bank) -> list[str]:
    batch: dict[tuple[str, str], dict[str, str]] = {}
    files = sorted(p for p in (DATA / "batches").glob("B*_long.csv") if not p.name.startswith("B09"))
    for path in files:
        with path.open(encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                batch[(row["item_id"], row["option_id"])] = row
    rows = {(i, o): r for i, options in bank.items() for o, r in options.items()}
    columns = [c for c in next(iter(rows.values())) if c not in ("status", "batch")]
    missing = sorted(set(rows) - set(batch))
    extra = sorted(set(batch) - set(rows))
    diffs = [(key, c) for key in set(rows) & set(batch) for c in columns if rows[key][c] != batch[key].get(c)]
    return [f"batch files {len(files)}; bank rows {len(rows)}; batch rows {len(batch)}; "
            f"missing {len(missing)}; extra {len(extra)}; differing cells {len(diffs)} "
            f"of {len(rows) * len(columns)}"]


def unit_counts() -> list[str]:
    from sonder_engine import Params, likelihood_matrix
    from sonder_engine.stopping import total_variation
    from sonder_pack.maths_v2 import load_maths_v2

    params, lines = Params(), []
    for unit in load_maths_v2().units:
        groups: dict[str, list] = defaultdict(list)
        for item in unit.engine_items:
            groups[item.twin_group or item.item_id].append(item)
        k = len(unit.hyps) - 2
        triggers = {h: sum(any(h in links for item in g for links in item.links) for g in groups.values())
                    for h in unit.hyps[:k]}
        rows = {item.item_id: likelihood_matrix(item, unit.hyps, params) for item in unit.engine_items}
        weak = []
        for a, b in combinations(range(k + 1), 2):
            n = sum(any(total_variation(rows[i.item_id][a], rows[i.item_id][b]) > params.delta_sep for i in g)
                    for g in groups.values())
            if n <= 4:
                weak.append(f"{unit.hyps[a]}/{unit.hyps[b]} {n}")
        fewest = min(triggers, key=triggers.get)
        lines.append(f"{unit.unit_id}: items {len(unit.engine_items)}, groups {len(groups)}, k {k}, "
                     f"fewest trigger groups {fewest} {triggers[fewest]}, "
                     f"pairs with <= 4 separating groups: {', '.join(weak) or 'none'}")
    return lines


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Read-only recheck of a Maths_v2 content change.")
    parser.add_argument("--base", default="origin/dev", help="commit to compare the bank with")
    args = parser.parse_args(argv)
    new = bank_now()
    print(f"== inventory against {args.base}")
    print("\n".join(inventory(bank_at(args.base), new)))
    print("== batch files against the bank")
    print("\n".join(batches_equal_bank(new)))
    print("== units as the engine loads them")
    print("\n".join(unit_counts()))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
