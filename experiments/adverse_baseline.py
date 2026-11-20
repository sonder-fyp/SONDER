"""Seeded adverse-case baseline (I2-A01).

Runs every retained adverse case through the real engine and writes the raw
result of each run, a count summary and a manifest naming the exact code, content
and parameters used:

    python -m experiments.adverse_baseline                  # writes experiments/results/adverse-baseline/
    python -m experiments.adverse_baseline --out DIR --runs 20 --intermittent-runs 10

Cases (all synthetic students, default assumed parameters, question budget 8):

* every deterministic student of spec v2 6.1 (each misconception and NONE, every unit);
* always-A in every unit (no named truth);
* the partial MATH-2039 holder in U2 (truth MATH-2039; KF-07);
* a no-misconception student with slip 0.08 in every unit (``--runs`` seeds);
* a uniformly random answerer in every unit (``--runs`` seeds; no named truth);
* intermittent holders of every U1 and U2 misconception applying it 50%, 70% or 90%
  of the time with slip 0.08 (``--intermittent-runs`` seeds).

Baseline seeds start at 0 and stay below 1000. Seeds 1000-1999 and 2000-2999 are
reserved for the evaluation protocol's tuning and held-out runs (I2-A06), so this
baseline can never leak into either. This is a record of current behaviour, not an
accuracy measurement and not a comparison of question-selection methods.
"""

from __future__ import annotations

import argparse
import csv
import json
import platform
import subprocess
import sys
from collections import Counter
from collections.abc import Iterator
from dataclasses import asdict
from pathlib import Path

import numpy as np

from sonder_engine import Params, Unit, __version__
from sonder_engine.pack import Pack
from sonder_pack.maths_v2 import load_maths_v2

from .content import canonical_source_sha256
from .harness import RESULT_FIELDS, result_row, run_session
from .policies import (
    StudentPolicy,
    always_option,
    deterministic,
    intermittent,
    none_student,
    partial_holder,
    random_uniform,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "experiments" / "results" / "adverse-baseline"
SLIP = 0.08
APPLY_RATES = (0.5, 0.7, 0.9)
INTERMITTENT_UNITS = ("U1", "U2")
MAX_BASELINE_SEEDS = 1000
SUMMARY_FIELDS = ("unit_id", "policy", "target", "apply_rate", "slip", "truth",
                  "outcome", "predicted", "runs")


def cases(pack: Pack, runs: int, intermittent_runs: int) -> Iterator[tuple[Unit, StudentPolicy, range]]:
    """Every (unit, policy, seeds) case, in a fixed order."""

    for count, name in ((runs, "runs"), (intermittent_runs, "intermittent_runs")):
        if isinstance(count, bool) or not isinstance(count, int) or not 1 <= count <= MAX_BASELINE_SEEDS:
            raise ValueError(f"{name} must be an integer from 1 to {MAX_BASELINE_SEEDS}")
    one = range(1)
    for unit in pack.units:
        for hypothesis in unit.hyps[:-1]:
            yield unit, deterministic(hypothesis), one
    for unit in pack.units:
        yield unit, always_option(0), one
    yield pack.unit("U2"), partial_holder("MATH-2039", "MATH-1965"), one
    for unit in pack.units:
        yield unit, none_student(SLIP), range(runs)
    for unit in pack.units:
        yield unit, random_uniform(), range(runs)
    for unit_id in INTERMITTENT_UNITS:
        unit = pack.unit(unit_id)
        for target in unit.hyps[:-2]:
            for rate in APPLY_RATES:
                yield unit, intermittent(target, rate, SLIP), range(intermittent_runs)


def run_cases(pack: Pack, params: Params, runs: int, intermittent_runs: int) -> list[dict[str, str]]:
    rows = []
    for unit, policy, seeds in cases(pack, runs, intermittent_runs):
        for seed in seeds:
            rows.append(result_row(unit, policy, seed, run_session(unit, params, policy, seed)))
    return rows


def summarise(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """Run counts per case, outcome and reported label."""

    keys = SUMMARY_FIELDS[:-1]
    counts = Counter(tuple(row[k] for k in keys) for row in rows)
    return [dict(zip(SUMMARY_FIELDS, (*key, str(n)))) for key, n in sorted(counts.items())]


def _git(*args: str) -> str | None:
    try:
        done = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return done.stdout.strip()


def manifest(pack: Pack, params: Params, runs: int, intermittent_runs: int,
             row_count: int, commit: str | None, dirty: bool | None) -> dict:
    """Run record. ``source_sha256`` is line-ending independent (see experiments.content)."""

    return {
        "experiment": "adverse-baseline",
        "task": "I2-A01",
        "command": ("python -m experiments.adverse_baseline "
                    f"--runs {runs} --intermittent-runs {intermittent_runs}"),
        "git_commit": commit or "unknown",
        "git_tracked_changes": dirty,
        "engine_version": __version__,
        "content_version": pack.identity.content_version,
        "source_sha256": canonical_source_sha256(pack),
        "source_sha256_as_loaded": dict(pack.identity.source_sha256),
        "source_sha256_note": ("source_sha256 hashes each file with CRLF converted to LF, which equals the "
                               "committed file on every platform. source_sha256_as_loaded is what the pack "
                               "loader hashed on this machine and differs on a CRLF (Windows) checkout."),
        "params": asdict(params),
        "question_budget": params.default_budget,
        "seeds": {
            "deterministic_cases": [0],
            "none_with_slip_and_random": [0, runs - 1],
            "intermittent": [0, intermittent_runs - 1],
            "reserved_for_protocol": {"tuning": [1000, 1999], "held_out": [2000, 2999]},
        },
        "generation": {"slip": SLIP, "apply_rates": list(APPLY_RATES),
                       "intermittent_units": list(INTERMITTENT_UNITS)},
        "row_count": row_count,
        "python": platform.python_version(),
        "numpy": np.__version__,
        "note": ("Synthetic students under assumed parameters. Describes current engine behaviour; "
                 "it is not diagnostic accuracy on real students. Policies without a named truth "
                 "(always-A, random-uniform) produce adverse-response labels, not correct or wrong diagnoses."),
    }


def _write_csv(path: Path, fields: tuple[str, ...], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_baseline(out: Path, runs: int, intermittent_runs: int) -> dict:
    commit = _git("rev-parse", "HEAD")
    status = _git("status", "--porcelain", "--untracked-files=no")
    dirty = None if status is None else bool(status)
    params = Params()
    pack = load_maths_v2(params=params)
    rows = run_cases(pack, params, runs, intermittent_runs)
    out.mkdir(parents=True, exist_ok=True)
    _write_csv(out / "runs.csv", RESULT_FIELDS, rows)
    _write_csv(out / "summary.csv", SUMMARY_FIELDS, summarise(rows))
    record = manifest(pack, params, runs, intermittent_runs, len(rows), commit, dirty)
    (out / "manifest.json").write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return record


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Seeded adverse-case baseline (I2-A01).")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--runs", type=int, default=200,
                        help="seeds per unit for the slip and random students")
    parser.add_argument("--intermittent-runs", type=int, default=100,
                        help="seeds per (misconception, apply rate) for intermittent holders")
    args = parser.parse_args(argv)
    try:
        record = write_baseline(args.out, args.runs, args.intermittent_runs)
    except ValueError as error:
        parser.error(str(error))
    print(f"{record['row_count']} runs written to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
