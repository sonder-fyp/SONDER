"""Draw the scripted sessions from tests/test_selection.py.

Same loop as ``test_scripted_sessions_are_deterministic...``: for each unit U1-U5 and each
simulated student (one per misconception, plus one with none), ask 8 questions, answering
with ``student_answer``. One PNG per unit goes to ``validation/out/`` (git-ignored).

Run from the repo root:  python validation/plot_scripted_sessions.py [U1 U3 ...]
"""

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sonder_engine import Params, likelihood_matrix, prior, update_posterior  # noqa: E402
from sonder_engine.selection import entropy_bits, select_next  # noqa: E402
from tests.test_selection import real_units, student_answer  # noqa: E402

OUT = ROOT / "validation" / "out"
QUESTIONS = 8


def run_session(hyps, items, believed, params):
    """Returns the posterior after each step (index 0 = prior) and the pick made at each step."""
    p, remaining = prior(hyps, params), list(items)
    posteriors, picks = [p], []
    for _ in range(QUESTIONS):
        chosen = select_next(p, remaining, hyps, params)
        item = next(i for i in remaining if i.item_id == chosen.item_id)
        answer = student_answer(item, believed)
        p = update_posterior(p, likelihood_matrix(item, hyps, params), answer)
        picks.append((chosen.item_id, chosen.eig, item.option_ids[answer], answer == item.correct_index))
        posteriors.append(p)
        remaining.remove(item)
    return np.array(posteriors), picks


def draw_unit(name, hyps, items, params):
    students = list(hyps[:-2]) + [None]
    fig, axes = plt.subplots(len(students), 2, figsize=(14, 2.6 * len(students)),
                             gridspec_kw={"width_ratios": [3, 2]}, squeeze=False)
    for (heat, bars), believed in zip(axes, students):
        posteriors, picks = run_session(hyps, items, believed, params)

        image = heat.imshow(posteriors.T, vmin=0, vmax=1, cmap="viridis", aspect="auto")
        heat.set_yticks(range(len(hyps)), hyps, fontsize=7)
        heat.set_xticks(range(QUESTIONS + 1),
                        ["prior"] + [f"{i}\n{e:.2f}b" for i, e, _, _ in picks], fontsize=7)
        for h in range(len(hyps)):
            for s in range(QUESTIONS + 1):
                v = posteriors[s, h]
                if v >= 0.05:
                    heat.text(s, h, f"{v:.2f}", ha="center", va="center", fontsize=6,
                              color="white" if v < 0.6 else "black")
        who = f"student believes {believed}" if believed else "student has no misconception"
        heat.set_title(f"{name}: {who}  (posterior after each answer)", fontsize=9, loc="left")
        fig.colorbar(image, ax=heat, fraction=0.025, pad=0.01)

        eigs = [e for _, e, _, _ in picks]
        colors = ["tab:green" if ok else "tab:red" for *_, ok in picks]
        bars.bar(range(1, QUESTIONS + 1), eigs, color=colors)
        bars.plot(range(QUESTIONS + 1), [entropy_bits(p) for p in posteriors], "k.-", lw=1,
                  label="entropy (bits)")
        for step, (_, e, letter, _) in enumerate(picks, 1):
            bars.text(step, e, letter, ha="center", va="bottom", fontsize=7)
        bars.set_xticks(range(QUESTIONS + 1), ["0"] + [str(i) for i in range(1, QUESTIONS + 1)], fontsize=7)
        bars.set_xlabel("question", fontsize=7)
        bars.set_ylabel("bits", fontsize=7)
        bars.set_title("expected gain of the pick (letter = answer; green correct, red wrong)",
                       fontsize=8, loc="left")
        bars.legend(fontsize=7)
    fig.tight_layout()
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"scripted_sessions_{name}.png"
    fig.savefig(path, dpi=130)
    plt.close(fig)
    return path


def main():
    units, wanted, params = real_units(), set(sys.argv[1:]), Params()
    for name, (hyps, items) in units.items():
        if not wanted or name in wanted:
            print(draw_unit(name, hyps, items, params))


if __name__ == "__main__":
    main()
