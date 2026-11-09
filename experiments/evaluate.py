"""Equal-budget selection comparison runner (I2-A07 to I2-A09; experiments/PROTOCOL.md).

    python -m experiments.evaluate --config experiments/configs/u1u2-tuning.json

Runs every (unit, truth case, selection method, seed) in the configuration through
the real engine and writes ``experiments/results/<name>/``: ``runs.csv`` (one raw
row per run), ``manifest.json`` (code, configuration, content and parameter
identity) and ``metrics.csv``, computed from ``runs.csv`` alone (experiments.metrics).

Configuration (JSON):

    {
      "name": "u1u2-tuning", "protocol_version": 1, "split": "tuning",
      "units": ["U1", "U2"], "methods": ["adaptive", "fixed", "random"],
      "seeds": {"first": 1000, "count": 300},
      "cases": [
        {"policy": "intermittent", "apply_rates": [0.5, 0.7, 0.9], "slip": 0.08},
        {"policy": "none-with-slip", "slip": 0.08},
        {"policy": "always-A"}, {"policy": "random-uniform"}, {"policy": "off-catalogue"},
        {"policy": "partial-holder", "target": "MATH-2039", "companion": "MATH-1965", "units": ["U2"]}
      ]
    }

An intermittent case expands to every misconception of the unit. A deterministic
student (always-A, partial holder) gives the same session for every seed under the
adaptive and fixed methods, so it runs once there (the first seed) and for every
seed under random selection (protocol section 5).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import platform
import sys
from collections.abc import Iterator
from dataclasses import asdict
from pathlib import Path

import numpy as np

from sonder_engine import Params, Unit, __version__
from sonder_engine.pack import Pack
from sonder_pack.maths_v2 import load_maths_v2

from .adverse_baseline import _git, _write_csv
from .content import canonical_source_sha256
from .harness import RESULT_FIELDS, result_row, run_session
from .metrics import write_metrics
from .policies import (
    StudentPolicy,
    always_option,
    intermittent,
    none_student,
    off_catalogue,
    partial_holder,
    random_uniform,
)
from .selection import Adaptive, Fixed, RandomEligible, SelectionMethod

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "experiments" / "results"
PROTOCOL_VERSION = 1
SPLIT_SEEDS = {"tuning": (1000, 1999), "held-out": (2000, 2999)}  # protocol section 5
METHODS = ("adaptive", "fixed", "random")
POLICIES = ("intermittent", "none-with-slip", "always-A", "random-uniform", "off-catalogue", "partial-holder")
EVAL_FIELDS = ("unit_id", "method") + RESULT_FIELDS[1:]


class ConfigError(ValueError):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ConfigError(message)


def _is_rate(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and 0.0 <= value <= 1.0


def validate(config: dict, pack: Pack) -> None:
    """Refuse a configuration that does not follow the protocol."""

    _require(isinstance(config, dict), "the configuration must be a JSON object")
    _require(set(config) == {"name", "protocol_version", "split", "units", "methods", "seeds", "cases"},
             "the configuration needs exactly: name, protocol_version, split, units, methods, seeds, cases")
    _require(isinstance(config["name"], str) and config["name"].replace("-", "").isalnum(),
             "name must contain only letters, digits and hyphens")
    _require(config["protocol_version"] == PROTOCOL_VERSION, f"protocol_version must be {PROTOCOL_VERSION}")
    _require(config["split"] in SPLIT_SEEDS, f"split must be one of {sorted(SPLIT_SEEDS)}")
    units = config["units"]
    _require(isinstance(units, list) and units and len(set(units)) == len(units), "units must be a list")
    known = {unit.unit_id for unit in pack.units}
    _require(all(u in known for u in units), f"unknown unit in {units}")
    methods = config["methods"]
    _require(isinstance(methods, list) and methods and set(methods) <= set(METHODS)
             and len(set(methods)) == len(methods), f"methods must be distinct values from {METHODS}")
    seeds = config["seeds"]
    _require(isinstance(seeds, dict) and set(seeds) == {"first", "count"}, "seeds needs first and count")
    first, count = seeds["first"], seeds["count"]
    _require(all(isinstance(v, int) and not isinstance(v, bool) for v in (first, count)) and count >= 1,
             "seeds.first and seeds.count must be integers, count at least 1")
    low, high = SPLIT_SEEDS[config["split"]]
    _require(low <= first and first + count - 1 <= high,
             f"{config['split']} seeds must lie in {low}-{high} (protocol section 5)")
    cases = config["cases"]
    _require(isinstance(cases, list) and cases, "cases must be a non-empty list")
    for case in cases:
        _require(isinstance(case, dict) and case.get("policy") in POLICIES, f"unknown case {case!r}")
        allowed = {"policy", "units"} | {
            "intermittent": {"apply_rates", "slip"}, "none-with-slip": {"slip"},
            "partial-holder": {"target", "companion"}}.get(case["policy"], set())
        _require(set(case) <= allowed, f"unexpected keys in {case!r}")
        if "units" in case:
            _require(isinstance(case["units"], list) and set(case["units"]) <= set(units),
                     f"case units must be among the configuration's units: {case!r}")
        if case["policy"] == "intermittent":
            rates = case.get("apply_rates")
            _require(isinstance(rates, list) and rates and len(set(rates)) == len(rates)
                     and all(_is_rate(r) for r in rates), "apply_rates must be distinct numbers in [0, 1]")
        if case["policy"] in ("intermittent", "none-with-slip"):
            _require(_is_rate(case.get("slip")), f"{case['policy']} needs a slip in [0, 1]")
        if case["policy"] == "partial-holder":
            _require({"target", "companion"} <= set(case), "a partial-holder case needs target and companion")


def _policies(case: dict, unit: Unit) -> Iterator[StudentPolicy]:
    kind = case["policy"]
    if kind == "intermittent":
        for target in unit.hyps[:-2]:
            for rate in case["apply_rates"]:
                yield intermittent(target, rate, case["slip"])
    elif kind == "none-with-slip":
        yield none_student(case["slip"])
    elif kind == "always-A":
        yield always_option(0)
    elif kind == "random-uniform":
        yield random_uniform()
    elif kind == "off-catalogue":
        yield off_catalogue()
    else:
        for name in (case["target"], case["companion"]):
            if name not in unit.hyps[:-2]:
                raise ConfigError(f"{name} is not a misconception of {unit.unit_id}")
        yield partial_holder(case["target"], case["companion"])


def _method(name: str, unit: Unit, params: Params, seed: int,
            fixed_orders: dict[str, Fixed]) -> SelectionMethod:
    if name == "adaptive":
        return Adaptive()
    if name == "fixed":  # one order per unit, computed once
        return fixed_orders.setdefault(unit.unit_id, Fixed.for_unit(unit, params))
    return RandomEligible(seed)


def plan(config: dict, pack: Pack) -> Iterator[tuple[Unit, str, StudentPolicy, list[int]]]:
    """Every (unit, method, policy, seeds) to run, in a fixed order."""

    first, count = config["seeds"]["first"], config["seeds"]["count"]
    all_seeds = list(range(first, first + count))
    for unit_id in config["units"]:
        unit = pack.unit(unit_id)
        for method in config["methods"]:
            for case in config["cases"]:
                if unit_id not in case.get("units", config["units"]):
                    continue
                for policy in _policies(case, unit):
                    once = not policy.stochastic and method != "random"
                    yield unit, method, policy, all_seeds[:1] if once else all_seeds


def run(config: dict, pack: Pack, params: Params, progress=None) -> list[dict[str, str]]:
    rows = []
    fixed_orders: dict[str, Fixed] = {}
    for unit, method_name, policy, seeds in plan(config, pack):
        for seed in seeds:
            method = _method(method_name, unit, params, seed, fixed_orders)
            state = run_session(unit, params, policy, seed, method=method)
            row = result_row(unit, policy, seed, state)
            rows.append({"unit_id": row["unit_id"], "method": method_name,
                         **{k: row[k] for k in RESULT_FIELDS[1:]}})
        if progress:
            progress(f"{unit.unit_id} {method_name} {policy.name} {policy.target} "
                     f"{policy.apply_rate or ''}: {len(seeds)} runs")
    return rows


def config_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def evaluate(config_path: Path, out: Path | None = None, progress=None) -> dict:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    params = Params()
    pack = load_maths_v2(params=params)
    validate(config, pack)
    commit = _git("rev-parse", "HEAD")
    status = _git("status", "--porcelain", "--untracked-files=no")
    rows = run(config, pack, params, progress)
    out = out or RESULTS / config["name"]
    out.mkdir(parents=True, exist_ok=True)
    _write_csv(out / "runs.csv", EVAL_FIELDS, rows)
    manifest = {
        "experiment": config["name"],
        "split": config["split"],
        "protocol_version": PROTOCOL_VERSION,
        "tasks": ["I2-A07", "I2-A08", "I2-A09"],
        "command": f"python -m experiments.evaluate --config {config_path.as_posix()}",
        "config_sha256": config_sha256(config_path),
        "config": config,
        "git_commit": commit or "unknown",
        "git_tracked_changes": None if status is None else bool(status),
        "engine_version": __version__,
        "content_version": pack.identity.content_version,
        "source_sha256": canonical_source_sha256(pack),
        "params": asdict(params),
        "row_count": len(rows),
        "python": platform.python_version(),
        "numpy": np.__version__,
        "note": ("Synthetic students under assumed parameters; not accuracy on real students. Labels for "
                 "cases without a named truth are adverse-response labels, never correct or wrong diagnoses."),
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    write_metrics(out)  # computed from the runs.csv just written, nothing else
    return manifest


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Equal-budget selection comparison (experiments/PROTOCOL.md).")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, help="output directory (default experiments/results/<name>)")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)
    progress = None if args.quiet else (lambda line: print(line, file=sys.stderr, flush=True))
    try:
        manifest = evaluate(args.config, args.out, progress)
    except ConfigError as error:
        parser.error(str(error))
    print(f"{manifest['row_count']} runs written for {manifest['experiment']}", file=sys.stderr)


if __name__ == "__main__":
    main()
