"""Figures generated only from saved results (I2-A10; experiments/PROTOCOL.md).

    python -m experiments.plot experiments/results/u1u2-tuning

reads ``metrics.csv`` and ``manifest.json`` from the results directory and writes
``figures/*.png``, ``figures/*.svg`` and ``figures/figures.md`` (one caption per figure,
with sample sizes and settings). Nothing is recomputed from the engine.

Colour follows the method or outcome, never its rank, in a fixed validated order
(dataviz reference palette, light mode; slots 1-4 pass the adjacent-pair checks and
slots 1-3 pass all pairs). The lighter slots are below 3:1 contrast on the surface, so
every figure carries direct labels and metrics.csv is the table view.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.lines  # noqa: E402
import matplotlib.patches  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.ticker  # noqa: E402

SURFACE = "#fcfcfb"
INK, INK_2, MUTED = "#0b0b0b", "#52514e", "#898781"
GRID, AXIS = "#e1e0d9", "#c3c2b7"
SLOTS = ("#2a78d6", "#eb6834", "#1baf7a", "#eda100")  # blue, orange, aqua, yellow
LABEL_ON = {"#2a78d6": "#ffffff", "#eb6834": "#ffffff", "#1baf7a": "#ffffff", "#eda100": "#0b0b0b"}
METHODS = ("adaptive", "fixed", "random")
METHOD_COLOUR = dict(zip(METHODS, SLOTS))
METHOD_LABEL = {"adaptive": "Adaptive (EIG)", "fixed": "Fixed order", "random": "Random item"}
OUTCOMES = (("correct_coverage", "Correct label"), ("wrong", "Wrong label"),
            ("missed_rate", "Missed (none detected)"), ("refusal_rate", "Refused"))
POOLED = "*all*"

plt.rcParams.update({
    "font.family": "sans-serif", "font.sans-serif": ["Segoe UI", "DejaVu Sans", "Arial"],
    "font.size": 9, "axes.edgecolor": AXIS, "axes.labelcolor": INK_2, "axes.titlecolor": INK,
    "xtick.color": MUTED, "ytick.color": INK_2, "axes.facecolor": SURFACE, "figure.facecolor": SURFACE,
    "savefig.facecolor": SURFACE, "axes.spines.top": False, "axes.spines.right": False,
    "svg.fonttype": "none",
})


def load(results: Path) -> tuple[list[dict[str, str]], dict]:
    with (results / "metrics.csv").open(encoding="utf-8", newline="") as handle:
        metrics = list(csv.DictReader(handle))
    manifest = json.loads((results / "manifest.json").read_text(encoding="utf-8"))
    return metrics, manifest


class Metrics:
    def __init__(self, rows: list[dict[str, str]]):
        self.rows = {(r["unit_id"], r["method"], r["policy"], r["target"], r["apply_rate"], r["slip"],
                      r["metric"]): r for r in rows}

    def get(self, unit, method, policy, metric, target="", apply_rate="", slip=""):
        key = (unit, method, policy, target, apply_rate, slip, metric)
        if key not in self.rows:
            raise KeyError(f"no metric {key}")
        return self.rows[key]

    def find(self, **match):
        return [r for r in self.rows.values() if all(r[k] == v for k, v in match.items())]


def _style(ax, *, xlabel: str, xmax: float = 1.0, percent: bool = True) -> None:
    ax.set_xlim(0, xmax)
    ax.xaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(axis="y", length=0)
    ax.spines["left"].set_visible(False)
    ax.set_xlabel(xlabel)
    if percent:
        ax.xaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=0))


def holder_outcomes(m: Metrics, manifest: dict, out: Path) -> str:
    """Stacked shares of correct / wrong / missed / refused for holders, per rate and method."""

    config = manifest["config"]
    case = next(c for c in config["cases"] if c["policy"] == "intermittent")
    rates = [f"{r:g}" for r in case["apply_rates"]]
    slip = f"{case['slip']:g}"
    units = config["units"]
    fig, axes = plt.subplots(len(units), 1, figsize=(7.2, 2.0 + 1.25 * len(rates) * len(units)), squeeze=False)
    sizes = {}
    for ax, unit in zip(axes[:, 0], units):
        labels, y = [], 0.0
        for rate in rates:
            for method in METHODS:
                row = lambda name: m.get(unit, method, "intermittent", name, POOLED, rate, slip)
                n = int(row("coverage")["denominator"])
                sizes[unit] = n
                shares = {
                    "correct_coverage": float(row("correct_coverage")["value"]),
                    "wrong": float(row("coverage")["value"]) - float(row("correct_coverage")["value"]),
                    "missed_rate": float(row("missed_rate")["value"]),
                    "refusal_rate": float(row("refusal_rate")["value"]),
                }
                left = 0.0
                for (key, _), colour in zip(OUTCOMES, SLOTS):
                    width = shares[key]
                    ax.barh(-y, width, left=left, height=0.72, color=colour, edgecolor=SURFACE, linewidth=1.5)
                    if width >= 0.07:
                        ax.text(left + width / 2, -y, f"{width:.0%}", ha="center", va="center",
                                fontsize=7.5, color=LABEL_ON[colour])
                    left += width
                labels.append((-y, f"{METHOD_LABEL[method]}  ·  apply {rate}"))
                y += 1
            y += 0.45
        ax.set_yticks([p for p, _ in labels], [t for _, t in labels])
        _style(ax, xlabel="Share of misconception-holder runs")
        ax.set_title(f"{unit}: {sizes[unit]:,} runs per bar (every misconception × {config['seeds']['count']} seeds)",
                     loc="left", fontsize=9.5)
    handles = [matplotlib.patches.Patch(color=c, label=label) for (_, label), c in zip(OUTCOMES, SLOTS)]
    fig.legend(handles=handles, loc="upper left", ncol=4, frameon=False, bbox_to_anchor=(0.01, 1.0))
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    name = "holder-outcomes"
    _save(fig, out, name)
    return (f"**{name}** — Outcomes for synthetic students who hold one misconception and apply it with the "
            f"stated probability on triggering items (careful-answer slip {slip}), by unit, apply rate and "
            f"selection method. Shares of holder runs; 'Wrong label' names a different misconception; "
            f"'Missed' ends as none detected; 'Refused' is R3, R4 or R5. Budget {manifest['params']['default_budget']}, "
            f"default assumed parameters, {config['split']} seeds {config['seeds']['first']}–"
            f"{config['seeds']['first'] + config['seeds']['count'] - 1}. Not accuracy on real students.")


def _dots(ax, rows: list[tuple[str, dict | None]], xlabel: str, xmax: float, percent: bool) -> None:
    """One row per (group label, metric row); methods offset within a group."""

    ticks = []
    for g, (group, by_method) in enumerate(rows):
        ticks.append((-g, group))
        for k, method in enumerate(METHODS):
            row = by_method.get(method)
            if row is None or row["value"] == "":
                continue
            y = -g + (1 - k) * 0.24
            value = float(row["value"])
            colour = METHOD_COLOUR[method]
            if row["ci_low"]:
                ax.plot([float(row["ci_low"]), float(row["ci_high"])], [y, y], color=colour, linewidth=2,
                        solid_capstyle="round", clip_on=False)
            ax.plot(value, y, "o", markersize=6, color=colour, markeredgecolor=SURFACE, markeredgewidth=1.5,
                    clip_on=False)
            text = f"{value:.0%}" if percent else f"{value:.1f}"
            if not row["ci_low"]:
                text += " (1 run)"
            # Label beyond the end of the interval, never on top of it; flip left near the edge.
            right = float(row["ci_high"]) if row["ci_high"] else value
            left = float(row["ci_low"]) if row["ci_low"] else value
            if right + xmax * 0.12 <= xmax:
                ax.text(right + xmax * 0.015, y, text, va="center", ha="left", fontsize=7, color=INK_2)
            else:
                ax.text(left - xmax * 0.015, y, text, va="center", ha="right", fontsize=7, color=INK_2)
    ax.set_yticks([p for p, _ in ticks], [t for _, t in ticks])
    ax.set_ylim(-len(rows) + 0.5, 0.5)
    _style(ax, xlabel=xlabel, xmax=xmax, percent=percent)


def _method_legend(fig) -> None:
    handles = [matplotlib.lines.Line2D([], [], marker="o", linestyle="-", color=METHOD_COLOUR[m],
                                       label=METHOD_LABEL[m]) for m in METHODS]
    fig.legend(handles=handles, loc="upper left", ncol=3, frameon=False, bbox_to_anchor=(0.01, 1.0))


def holder_rates(m: Metrics, manifest: dict, out: Path) -> str:
    """Wrong-diagnosis rate and correct coverage, with 95% intervals, side by side (separate axes)."""

    config = manifest["config"]
    case = next(c for c in config["cases"] if c["policy"] == "intermittent")
    slip = f"{case['slip']:g}"
    groups = [(unit, f"{r:g}") for unit in config["units"] for r in case["apply_rates"]]
    fig, axes = plt.subplots(1, 2, figsize=(7.2, 1.2 + 0.55 * len(groups)), sharey=True)
    for ax, metric, title in ((axes[0], "wrong_diagnosis_rate", "Wrong-diagnosis rate (wrong ÷ labelled)"),
                              (axes[1], "correct_coverage", "Correct coverage (correct ÷ holder runs)")):
        rows = [(f"{unit} · apply {rate}",
                 {method: m.get(unit, method, "intermittent", metric, POOLED, rate, slip) for method in METHODS})
                for unit, rate in groups]
        xmax = 1.0 if metric == "correct_coverage" else max(
            0.2, max(float(r["ci_high"] or r["value"] or 0) for _, d in rows for r in d.values()) * 1.25)
        _dots(ax, rows, title, xmax, True)
    _method_legend(fig)
    fig.tight_layout(rect=(0, 0, 1, 0.92))
    name = "holder-rates"
    _save(fig, out, name)
    return (f"**{name}** — For misconception holders (careful-answer slip {slip}), the wrong-diagnosis rate "
            f"(left; denominator = runs given any misconception label) and correct coverage (right; "
            f"denominator = all holder runs), with Wilson 95% intervals, by unit, apply rate and method. "
            f"Each point pools the unit's misconceptions × {config['seeds']['count']} seeds; denominators are "
            f"in metrics.csv. The two panels use separate scales.")


def questions_used(m: Metrics, manifest: dict, out: Path) -> str:
    config = manifest["config"]
    case = next(c for c in config["cases"] if c["policy"] == "intermittent")
    slip = f"{case['slip']:g}"
    groups = []
    for unit in config["units"]:
        for rate in case["apply_rates"]:
            groups.append((f"{unit} · holders, apply {rate:g}", (unit, "intermittent", POOLED, f"{rate:g}", slip)))
        for c in config["cases"]:
            if c["policy"] in ("none-with-slip", "random-uniform", "off-catalogue"):
                label = {"none-with-slip": "no misconception", "random-uniform": "random answering",
                         "off-catalogue": "off-catalogue"}[c["policy"]]
                case_slip = f"{c['slip']:g}" if c["policy"] == "none-with-slip" else ""
                groups.append((f"{unit} · {label}", (unit, c["policy"], "", "", case_slip)))
    rows = []
    for label, (unit, policy, target, rate, s) in groups:
        rows.append((label, {method: m.get(unit, method, policy, "questions_mean", target, rate, s)
                             for method in METHODS}))
    fig, ax = plt.subplots(figsize=(7.2, 1.0 + 0.5 * len(rows)))
    _dots(ax, rows, "Mean questions asked (budget 8), 95% bootstrap interval", 8.0, False)
    _method_legend(fig)
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    name = "questions-used"
    _save(fig, out, name)
    return (f"**{name}** — Mean number of questions asked before the session ended, with percentile-bootstrap "
            f"95% intervals (2,000 resamples), by unit, truth case and method. Every method has the same "
            f"budget ({manifest['params']['default_budget']}) and the same stopping rules; "
            f"{config['seeds']['count']} seeds per case (holders pooled over the unit's misconceptions).")


def adverse_labelling(m: Metrics, manifest: dict, out: Path) -> str:
    config = manifest["config"]
    rows = []
    for unit in config["units"]:
        for c in config["cases"]:
            policy = c["policy"]
            if unit not in c.get("units", config["units"]):
                continue
            if policy in ("random-uniform", "off-catalogue", "always-A"):
                label = {"random-uniform": "random answering", "off-catalogue": "off-catalogue",
                         "always-A": "always A"}[policy]
                rows.append((f"{unit} · {label}", {method: m.get(unit, method, policy, "labelled_rate")
                                                   for method in METHODS}))
            elif policy == "none-with-slip":
                slip = f"{c['slip']:g}"
                rows.append((f"{unit} · no misconception (false label)",
                             {method: m.get(unit, method, policy, "false_label_rate", "", "", slip)
                              for method in METHODS}))
    fig, ax = plt.subplots(figsize=(7.2, 1.0 + 0.5 * len(rows)))
    _dots(ax, rows, "Share of runs given a misconception label", 1.0, True)
    _method_legend(fig)
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    name = "adverse-labelling"
    _save(fig, out, name)
    return (f"**{name}** — How often students without the labelled misconception receive one: answer patterns "
            f"with no named truth (labels are adverse-response labels, not correct or wrong diagnoses) and "
            f"students with no misconception (false labels), with Wilson 95% intervals. Always-A is "
            f"deterministic, so under adaptive and fixed selection it is a single run (no interval); under "
            f"random selection it has {config['seeds']['count']} runs.")


def _save(fig, out: Path, name: str) -> None:
    out.mkdir(parents=True, exist_ok=True)
    fig.savefig(out / f"{name}.png", dpi=200)
    fig.savefig(out / f"{name}.svg", metadata={"Date": None})
    plt.close(fig)


def plot(results: Path) -> list[str]:
    metrics, manifest = load(results)
    m = Metrics(metrics)
    out = results / "figures"
    captions = [holder_outcomes(m, manifest, out), holder_rates(m, manifest, out),
                questions_used(m, manifest, out), adverse_labelling(m, manifest, out)]
    header = (f"# Figures for {manifest['experiment']} ({manifest['split']})\n\n"
              f"Generated by `python -m experiments.plot {results.as_posix()}` from `metrics.csv`; "
              f"runs generated at commit `{manifest['git_commit']}`, configuration SHA-256 "
              f"`{manifest['config_sha256']}`. Synthetic students under assumed parameters.\n\n")
    (out / "figures.md").write_text(header + "\n\n".join(captions) + "\n", encoding="utf-8")
    return captions


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Figures from a results directory (metrics.csv, manifest.json).")
    parser.add_argument("results", type=Path)
    args = parser.parse_args(argv)
    captions = plot(args.results)
    print(f"{len(captions)} figures written to {args.results / 'figures'}", file=sys.stderr)


if __name__ == "__main__":
    main()
