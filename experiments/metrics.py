"""Metrics computed from raw runs only (I2-A09; experiments/PROTOCOL.md section 7).

    python -m experiments.metrics experiments/results/u1u2-tuning

reads ``runs.csv`` and writes ``metrics.csv`` beside it. Every row states its
numerator and denominator. Proportions carry Wilson 95% intervals; the mean number
of questions carries a percentile-bootstrap 95% interval (2,000 resamples, fixed
seed). A group of a single run (a deterministic student under a deterministic
method) gets no interval.

Each run belongs to one truth class, by its reference label (``truth``):
- a misconception (*holder*): exactly one of correct label, wrong label, missed
  (``none_detected``) or refused (R3, R4, or R5 by cause);
- ``NONE``: none detected, false misconception label, or refused;
- empty (no named truth): labelled with a misconception, none detected, or refused,
  plus the distribution of labels. These labels are never counted as correct or wrong.
"""

from __future__ import annotations

import argparse
import csv
import math
import sys
from collections import defaultdict
from collections.abc import Iterable, Sequence
from pathlib import Path

import numpy as np

Z95 = 1.959963984540054
BOOTSTRAP_RESAMPLES = 2000
BOOTSTRAP_SEED = 20261110
GROUP_FIELDS = ("unit_id", "method", "policy", "target", "apply_rate", "slip")
METRIC_FIELDS = GROUP_FIELDS + ("metric", "numerator", "denominator", "value", "ci_low", "ci_high")
POOLED = "*all*"
REFUSAL_KINDS = ("R3", "R4", "R5:budget", "R5:no_items", "R5:eig_floor")


def wilson(successes: int, n: int) -> tuple[float, float]:
    """Wilson score 95% interval for a binomial proportion."""

    if n <= 0 or not 0 <= successes <= n:
        raise ValueError("need 0 <= successes <= n and n > 0")
    p = successes / n
    centre = p + Z95 ** 2 / (2 * n)
    spread = Z95 * math.sqrt(p * (1 - p) / n + Z95 ** 2 / (4 * n * n))
    denominator = 1 + Z95 ** 2 / n
    return max(0.0, (centre - spread) / denominator), min(1.0, (centre + spread) / denominator)


def bootstrap_mean(values: Sequence[float]) -> tuple[float, float]:
    """Percentile-bootstrap 95% interval for a mean, with a fixed resampling seed."""

    data = np.asarray(values, dtype=np.float64)
    if data.size < 2:
        raise ValueError("a bootstrap interval needs at least two values")
    rng = np.random.default_rng(BOOTSTRAP_SEED)
    means = data[rng.integers(0, data.size, size=(BOOTSTRAP_RESAMPLES, data.size))].mean(axis=1)
    low, high = np.percentile(means, [2.5, 97.5])
    return float(low), float(high)


def classify(row: dict[str, str]) -> str:
    """The run's category within its truth class."""

    outcome, truth, predicted = row["outcome"], row["truth"], row["predicted"]
    if outcome == "diagnosed":
        if truth in ("", "NONE"):
            return "labelled" if truth == "" else "false_label"
        return "correct" if predicted == truth else "wrong"
    if outcome == "none_detected":
        return "missed" if truth not in ("", "NONE") else "none_detected"
    if outcome == "escalated_unmodelled":
        return "refused:R3"
    if outcome == "escalated_no_separator":
        return "refused:R4"
    if outcome == "escalated_exhausted":
        return f"refused:R5:{row['exhausted_by']}"
    raise ValueError(f"unexpected outcome {outcome!r}")


def truth_class(truth: str) -> str:
    return "none" if truth == "NONE" else ("no_named_truth" if truth == "" else "holder")


def _fmt(value: float | None) -> str:
    return "" if value is None else f"{value:.6f}"


def _proportion(group: tuple, metric: str, numerator: int, denominator: int) -> dict[str, str]:
    value = numerator / denominator if denominator else None
    low = high = None
    if denominator > 1:
        low, high = wilson(numerator, denominator)
    return dict(zip(METRIC_FIELDS, (*group, metric, str(numerator), str(denominator),
                                    _fmt(value), _fmt(low), _fmt(high))))


def _group_metrics(group: tuple, rows: list[dict[str, str]]) -> list[dict[str, str]]:
    n = len(rows)
    kinds = {truth_class(row["truth"]) for row in rows}
    if len(kinds) != 1:
        raise ValueError(f"group {group} mixes truth classes {sorted(kinds)}")
    kind = kinds.pop()
    categories = [classify(row) for row in rows]
    count = lambda name: sum(1 for c in categories if c == name)
    refused = sum(1 for c in categories if c.startswith("refused:"))
    out = []
    if kind == "holder":
        correct, wrong = count("correct"), count("wrong")
        out.append(_proportion(group, "wrong_diagnosis_rate", wrong, correct + wrong))
        out.append(_proportion(group, "coverage", correct + wrong, n))
        out.append(_proportion(group, "correct_coverage", correct, n))
        out.append(_proportion(group, "missed_rate", count("missed"), n))
    elif kind == "none":
        out.append(_proportion(group, "none_detected_rate", count("none_detected"), n))
        out.append(_proportion(group, "false_label_rate", count("false_label"), n))
    else:
        out.append(_proportion(group, "labelled_rate", count("labelled"), n))
        out.append(_proportion(group, "none_detected_rate", count("none_detected"), n))
        labels = sorted({row["predicted"] for row in rows if row["outcome"] == "diagnosed"})
        for label in labels:
            hits = sum(1 for row in rows if row["outcome"] == "diagnosed" and row["predicted"] == label)
            out.append(_proportion(group, f"label:{label}", hits, n))
    out.append(_proportion(group, "refusal_rate", refused, n))
    for refusal in REFUSAL_KINDS:
        out.append(_proportion(group, f"refusal:{refusal}", count(f"refused:{refusal}"), n))
    used = [int(row["questions_used"]) for row in rows]
    mean = float(np.mean(used))
    low, high = bootstrap_mean(used) if n > 1 else (None, None)
    out.append(dict(zip(METRIC_FIELDS, (*group, "questions_mean", str(sum(used)), str(n),
                                        _fmt(mean), _fmt(low), _fmt(high)))))
    out.append(dict(zip(METRIC_FIELDS, (*group, "questions_median", "", str(n),
                                        _fmt(float(np.median(used))), "", ""))))
    return out


def compute(rows: Iterable[dict[str, str]]) -> list[dict[str, str]]:
    """Metrics per case, and per intermittent apply rate pooled over the unit's misconceptions."""

    groups: dict[tuple, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        key = tuple(row[f] for f in GROUP_FIELDS)
        groups[key].append(row)
        if row["policy"] == "intermittent":
            groups[key[:3] + (POOLED,) + key[4:]].append(row)
    metrics = []
    for key in sorted(groups):
        metrics.extend(_group_metrics(key, groups[key]))
    return metrics


def write_metrics(results: Path) -> list[dict[str, str]]:
    with (results / "runs.csv").open(encoding="utf-8", newline="") as handle:
        metrics = compute(csv.DictReader(handle))
    with (results / "metrics.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=METRIC_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(metrics)
    return metrics


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Compute metrics.csv from a results directory's runs.csv.")
    parser.add_argument("results", type=Path)
    args = parser.parse_args(argv)
    metrics = write_metrics(args.results)
    print(f"{len(metrics)} metric rows written to {args.results / 'metrics.csv'}", file=sys.stderr)


if __name__ == "__main__":
    main()
