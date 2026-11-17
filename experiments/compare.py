"""Side-by-side comparison of tuning runs for I2-A04 (candidate parameters).

    python -m experiments.compare experiments/results/u1u2-tuning experiments/results/u1u2-tuning-support3 ...

Reads each run's ``metrics.csv`` (never ``runs.csv`` directly, so the numbers are exactly the ones
reported per run) and prints a Markdown table per unit for the adaptive method: the cost side
(correct coverage, missed, wrong diagnosis, refusals, questions for intermittent holders at each
apply rate; false labels for careful NONE students) and the gain side (how often adverse answering
- always-A, random, off-catalogue - is labelled with a misconception). Every cell is
"value (numerator/denominator)".
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

HOLDER_METRICS = ("correct_coverage", "missed_rate", "wrong_diagnosis_rate", "refusal_rate", "questions_mean")
ADVERSE = ("always-A", "random-uniform", "off-catalogue")


def load(run: Path) -> tuple[str, dict, dict[tuple, dict]]:
    """(label, params, metrics keyed by (unit, method, policy, target, apply_rate, metric))."""

    manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8"))
    rows = {}
    with (run / "metrics.csv").open(encoding="utf-8", newline="") as handle:
        for r in csv.DictReader(handle):
            rows[(r["unit_id"], r["method"], r["policy"], r["target"], r["apply_rate"], r["metric"])] = r
    return manifest["experiment"], manifest["params"], rows


def cell(row: dict | None, mean: bool = False) -> str:
    if row is None:
        return "—"
    value = float(row["value"])
    if mean:
        return f"{value:.2f}"
    return f"{value * 100:.1f}% ({row['numerator']}/{row['denominator']})"


def table(runs: list[tuple[str, dict, dict]], unit: str, rates: list[str]) -> list[str]:
    head = "| Measure | " + " | ".join(name for name, _, _ in runs) + " |"
    lines = [head, "|" + " --- |" * (len(runs) + 1)]
    for rate in rates:
        for metric in HOLDER_METRICS:
            key = (unit, "adaptive", "intermittent", "*all*", rate, metric)
            label = f"Holders, apply {rate}: {metric.replace('_', ' ')}"
            lines.append(f"| {label} | " + " | ".join(cell(rows.get(key), metric == "questions_mean") for _, _, rows in runs) + " |")
    key = (unit, "adaptive", "none-with-slip", "", "", "false_label_rate")
    lines.append("| NONE students: false label | " + " | ".join(cell(rows.get(key)) for _, _, rows in runs) + " |")
    for policy in ADVERSE:
        key = (unit, "adaptive", policy, "", "", "labelled_rate")
        lines.append(f"| Adverse {policy}: labelled | " + " | ".join(cell(rows.get(key)) for _, _, rows in runs) + " |")
    return lines


def report(paths: list[Path]) -> str:
    runs = [load(p) for p in paths]
    units = sorted({k[0] for _, _, rows in runs for k in rows})
    rates = sorted({k[4] for _, _, rows in runs for k in rows if k[2] == "intermittent" and k[4]})
    out = ["Parameters per run: " + "; ".join(
        f"{name}: theta {params['theta']}, min_support {params['min_support']}" for name, params, _ in runs), ""]
    for unit in units:
        out += [f"### {unit} (adaptive selection)", ""] + table(runs, unit, rates) + [""]
    return "\n".join(out)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Compare tuning runs side by side (I2-A04).")
    parser.add_argument("runs", nargs="+", type=Path, help="result directories, baseline first")
    print(report(parser.parse_args(argv).runs))


if __name__ == "__main__":
    main()
