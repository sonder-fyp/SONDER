"""Independent comparison of an imported content version with its source files (I2-H15 review, Ashher).

The work division asks Ashher to compare imported content with the accepted source. This command does
that with its own SQL; it does not call the importer's ``verify`` and shares no code with it, so a fault
in one is not hidden by the other. Read-only: it never writes to the database.

    python -m validation.import_compare [--database-url URL] [--root data/Maths_v2] [--version-code Maths_v2]

``SONDER_DATABASE_URL`` is used when ``--database-url`` is not given. Use a development or throwaway
database. Exit code 0 means every check passed, 1 that something differs, 2 a usage or connection problem.

Checks: the version's ``pack_sha256`` equals the LF SHA-256 of ``bank/items.csv``; the version and every
item are still ``draft``, every item is marked LLM-assisted, and no item has a review row; the same item
IDs; every stem, batch and target; every option text, correct flag and set of linked misconceptions; every
link graded S (the source has no grade column); twin-group membership; and, per unit, the item order and
the hypothesis slot order that the engine's own loader produces.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import os
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def source_items(root: Path) -> dict[str, dict[str, dict[str, str]]]:
    items: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    with (root / "bank" / "items.csv").open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            items[row["item_id"]][row["option_id"]] = row
    return items


def links(text: str) -> str:
    return "|".join(sorted(m for m in text.split("|") if m))


def compare(conn, root: Path, version_code: str) -> tuple[list[str], list[str]]:
    from sonder_pack.maths_v2 import load_maths_v2

    passed: list[str] = []
    problems: list[str] = []

    def check(condition: bool, label: str) -> None:
        (passed if condition else problems).append(label)

    src = source_items(root)
    lf = hashlib.sha256((root / "bank" / "items.csv").read_bytes().replace(b"\r\n", b"\n")).hexdigest()
    conn.execute("SET search_path = sonder, public")
    version = conn.execute("SELECT id, pack_sha256, status FROM content_version WHERE version_code = %s",
                           (version_code,)).fetchone()
    if version is None:
        return passed, [f"no content version {version_code!r}"]
    vid, sha, status = version
    check(sha == lf, "pack_sha256 equals the LF SHA-256 of bank/items.csv")
    check(status == "draft", f"the version is draft (found {status})")

    items = conn.execute("""
        SELECT i.id, i.external_id, i.stem, i.batch, m.external_id, i.review_status, i.llm_assisted, i.twin_group
        FROM item i JOIN topic_revision tr ON tr.id = i.topic_revision_id
        JOIN misconception_revision mr ON mr.id = i.target_misconception_revision_id
        JOIN misconception m ON m.id = mr.misconception_id
        WHERE tr.content_version_id = %s""", (vid,)).fetchall()
    stored = {row[1]: row for row in items}
    check(set(stored) == set(src), f"the same {len(src)} item IDs ({len(stored)} stored)")
    common = set(stored) & set(src)
    check(all(stored[i][2] == src[i]["A"]["stem"] and stored[i][3] == src[i]["A"]["batch"]
              and stored[i][4] == src[i]["A"]["target"] for i in common), "every stem, batch and target")
    check(all(row[5] == "draft" for row in items), "every item is draft")
    check(all(row[6] for row in items), "every item is marked LLM-assisted")
    item_ids = [row[0] for row in items]
    reviews = conn.execute("SELECT count(*) FROM item_review WHERE item_id = ANY(%s)", (item_ids,)).fetchone()[0]
    check(reviews == 0, f"no item has a review row ({reviews})")

    options = conn.execute("""
        SELECT i.external_id, o.label, o.option_text, o.is_correct,
               coalesce(string_agg(m.external_id, '|' ORDER BY m.external_id), ''),
               coalesce(string_agg(DISTINCT om.link_grade, ''), '')
        FROM item_option o JOIN item i ON i.id = o.item_id
        LEFT JOIN option_misconception om ON om.option_id = o.id
        LEFT JOIN misconception_revision mr ON mr.id = om.misconception_revision_id
        LEFT JOIN misconception m ON m.id = mr.misconception_id
        WHERE i.id = ANY(%s)
        GROUP BY i.external_id, o.label, o.option_text, o.is_correct""", (item_ids,)).fetchall()
    expected_rows = sum(len(opts) for opts in src.values())
    check(len(options) == expected_rows, f"{expected_rows} option rows ({len(options)} stored)")
    differing = [f"{i} {label}" for i, label, text, correct, linked, _ in options
                 if i in src and (text != src[i][label]["option_text"]
                                  or correct != (src[i][label]["is_correct"] == "True")
                                  or linked != links(src[i][label]["misconceptions"]))]
    check(not differing, "every option text, correct flag and linked set"
          + (f" (differ: {', '.join(differing[:5])})" if differing else ""))
    check(all(grade in ("", "S") for *_, grade in options), "every link graded S")

    pack = load_maths_v2()
    engine_twins = {item.item_id: item.twin_group for unit in pack.units for item in unit.engine_items}
    check(all((stored[i][7] is None) == (group is None) for i, group in engine_twins.items() if i in stored),
          "twin-group membership agrees with the engine for every placed item")
    for unit in pack.units:
        order = conn.execute("""
            SELECT i.external_id FROM unit_item ui JOIN diagnostic_unit du ON du.id = ui.unit_id
            JOIN item i ON i.id = ui.item_id
            WHERE du.content_version_id = %s AND du.unit_code = %s ORDER BY ui.position""",
                             (vid, unit.unit_id)).fetchall()
        check([r[0] for r in order] == [item.item_id for item in unit.engine_items],
              f"{unit.unit_id}: items in the engine's pack order")
        slots = conn.execute("""
            SELECT m.external_id FROM unit_hypothesis uh JOIN diagnostic_unit du ON du.id = uh.unit_id
            JOIN hypothesis h ON h.id = uh.hypothesis_id
            JOIN misconception_revision mr ON mr.id = h.misconception_revision_id
            JOIN misconception m ON m.id = mr.misconception_id
            WHERE du.content_version_id = %s AND du.unit_code = %s ORDER BY uh.slot""",
                             (vid, unit.unit_id)).fetchall()
        check(tuple(r[0] for r in slots) == tuple(unit.hyps[:-2]), f"{unit.unit_id}: hypotheses in the engine's slot order")
    return passed, problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database-url", default=os.environ.get("SONDER_DATABASE_URL", ""))
    parser.add_argument("--root", type=Path, default=ROOT / "data" / "Maths_v2")
    parser.add_argument("--version-code", default="Maths_v2")
    args = parser.parse_args(argv)
    if not args.database_url:
        print("Give --database-url or set SONDER_DATABASE_URL.", file=sys.stderr)
        return 2
    try:
        import psycopg
        with psycopg.connect(args.database_url) as conn:
            passed, problems = compare(conn, args.root, args.version_code)
    except Exception as exc:  # connection or schema problem: never print the URL
        print(f"could not compare: {type(exc).__name__}: {str(exc).splitlines()[0][:200]}", file=sys.stderr)
        return 2
    for label in passed:
        print(f"PASS  {label}")
    for label in problems:
        print(f"FAIL  {label}")
    print(f"{len(passed)} checks passed, {len(problems)} failed")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
