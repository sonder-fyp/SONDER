"""Run the Iteration 1 schema tests against the throwaway Docker PostgreSQL.

From the repository root:

    docker compose up -d --wait
    python docs/db/iteration1/tests/run_schema_tests.py
    docker compose down -v

Each check gets a fresh database inside the container (never Neon):
1. the schema script applies cleanly, and a second run of it succeeds (it claims to be re-runnable);
2. behaviour_test.sql: 75 rejected writes ("NOTICE:  ok"), 9 passes, no FAIL and no ERROR;
3. import_probe.py: all 117 items load, none is rejected, the pack freezes, response models
   freeze at guess 0.30 and 0.24, and the database's units equal the engine's units
   (sonder_pack/maths_v2.py), including which items are in no unit.
Exit status 0 only if every check passes.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
from sonder_pack.maths_v2 import load_maths_v2  # noqa: E402

HERE = ROOT / "docs" / "db" / "iteration1"
SCHEMA = HERE / "sonder_iteration1.sql"
PSQL = ["docker", "compose", "exec", "-T", "postgres", "psql", "-X", "-U", "sonder"]


def psql(database: str, sql: bytes, *extra: str) -> tuple[int, str]:
    result = subprocess.run(PSQL + list(extra) + ["-d", database], input=sql, capture_output=True, cwd=ROOT)
    return result.returncode, (result.stdout + result.stderr).decode("utf-8", errors="replace")


def fresh(database: str) -> None:
    code, out = psql("sonder_test", f"DROP DATABASE IF EXISTS {database}; CREATE DATABASE {database};".encode(), "-q")
    if code:
        raise SystemExit(f"cannot create database {database}:\n{out}")


def apply_schema(database: str) -> tuple[int, str]:
    return psql(database, SCHEMA.read_bytes(), "-q", "-v", "ON_ERROR_STOP=1")


class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []

    def check(self, ok: bool, label: str, detail: str = "") -> None:
        print(f"  {'PASS' if ok else 'FAIL'}  {label}" + (f": {detail}" if detail and not ok else ""))
        if not ok:
            self.failures.append(label)


def section(output: str, title: str) -> str:
    """Text after an '== title' echo line, up to the next '==' line."""
    start = output.index(f"== {title}")
    rest = output[start:].split("\n", 1)[1]
    end = rest.find("\n== ")
    return rest if end < 0 else rest[:end]


def main() -> int:
    report = Report()

    print("1. Schema script")
    fresh("schema_check")
    code, out = apply_schema("schema_check")
    report.check(code == 0 and "ERROR" not in out, "applies to an empty database", out[-800:])
    code, out = apply_schema("schema_check")
    report.check(code == 0 and "ERROR" not in out, "re-running it succeeds", out[-800:])

    print("2. Behaviour test")
    fresh("behaviour")
    apply_schema("behaviour")
    code, out = psql("behaviour", (HERE / "tests" / "behaviour_test.sql").read_bytes(), "-q")
    rejected = len(re.findall(r"^NOTICE:  ok\b", out, re.M))
    passed = len(re.findall(r"^NOTICE:  PASS\b", out, re.M))
    report.check(rejected == 75, "75 invalid writes rejected", f"found {rejected}")
    report.check(passed == 9, "9 PASS checks", f"found {passed}")
    report.check(not re.search(r"^NOTICE:  FAIL", out, re.M), "no FAIL lines")
    report.check(code == 0 and "ERROR" not in out, "no ERROR", out[-800:])

    print("3. Import probe (real data/Maths_v2 bank, rolled back)")
    fresh("probe")
    apply_schema("probe")
    probe = subprocess.run([sys.executable, str(HERE / "tests" / "import_probe.py"), str(ROOT / "data" / "Maths_v2")],
                           capture_output=True, cwd=ROOT)
    report.check(probe.returncode == 0, "probe script runs", probe.stderr.decode(errors="replace")[-800:])
    code, out = psql("probe", probe.stdout, "-q")
    report.check(code == 0 and "ERROR" not in out, "probe SQL runs without error", out[-800:])
    report.check("FREEZE: pack froze successfully" in out, "pack freezes")
    for model in ("spec-default-guess-0.30", "guess-0.24"):
        report.check(f"RESPONSE MODEL {model}: froze" in out, f"response model {model} freezes")
    loaded = re.search(r"items \| options .*\n-[-+]*\n\s*(\d+)\s*\|\s*(\d+)\s*\|", out)
    report.check(bool(loaded) and loaded.groups() == ("117", "468"), "117 items and 468 options load",
                 loaded.groups() if loaded else "table not found")
    report.check("(0 rows)" in section(out, "rejected items and reasons"), "no item rejected")

    pack = load_maths_v2()
    database_units = {m[0]: (int(m[1]), int(m[2])) for m in re.findall(
        r"^\s*(U\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*$", section(out, "units: k (hypotheses) and items"), re.M)}
    engine_units = {u.unit_id: (len(u.hypotheses), len(u.items)) for u in pack.units}
    report.check(database_units == engine_units, "database units equal the engine's units (k, items)",
                 f"database {database_units} vs engine {engine_units}")
    placed = {p.item.item_id for u in pack.units for p in u.items}
    in_no_unit = re.findall(r"^\s*(T\d-\d{3}[AB]?)\s*$", section(out, "items in no unit"), re.M)
    expected = sorted({w.subject for w in pack.warnings if w.code in ("SKIPPED_ITEM", "UNPLACED_ITEM")})
    report.check(sorted(in_no_unit) == expected and not placed & set(in_no_unit),
                 "items in no unit are the engine's skipped and unplaced items", f"{in_no_unit} vs {expected}")

    print()
    if report.failures:
        print(f"{len(report.failures)} check(s) failed: {', '.join(report.failures)}")
        return 1
    print("All schema checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
