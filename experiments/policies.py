"""Synthetic student response policies (I2-A01, I2-A08).

A policy answers one item: given the engine ``Item`` and a NumPy random generator,
it returns the index (0-3) of the chosen option. Deterministic policies ignore the
generator. The harness seeds a fresh generator for every (run seed, item), so the
same simulated student answers the same item the same way whichever order the
items are asked in.

``truth`` is the reference label the policy was built from: a misconception ID,
``NONE`` for a student with no catalogued misconception, or ``None`` when the policy
has no named truth (always-A, random answering). Diagnoses of a policy without a
named truth are adverse-response labels, never "correct" or "wrong" diagnoses.

The generation rules below are deliberately written out, because a reader must be
able to tell how the answers were produced. They are assumptions about synthetic
students, not estimates from real ones.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np

from sonder_engine import Item
from sonder_engine.model import NONE
from sonder_engine.stopping import triggered_options

OPTION_LETTERS = "ABCD"

Answer = Callable[[Item, np.random.Generator], int]


@dataclass(frozen=True)
class StudentPolicy:
    """A named way of answering items, with the truth it represents."""

    name: str  # stable identifier written to raw results, e.g. "intermittent"
    truth: str | None  # misconception ID, NONE, or None (no named truth)
    answer: Answer = field(repr=False, compare=False)
    stochastic: bool = False
    target: str = ""  # misconception the policy is built around, if any
    apply_rate: float | None = None
    slip: float | None = None
    description: str = ""


def _linked(item: Item, misconception: str) -> list[int]:
    return sorted(triggered_options(item, misconception))


def _wrong(item: Item) -> list[int]:
    return [j for j in range(4) if j != item.correct_index]


def _rate(name: str, value: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0.0 <= value <= 1.0:
        raise ValueError(f"{name} must be a number in [0, 1]")
    return float(value)


def _careful(item: Item, rng: np.random.Generator, slip: float) -> int:
    # Correct with probability 1 - slip, otherwise a uniformly chosen wrong option.
    # The first draw always happens, so the number of draws per item is fixed by
    # the outcome of that draw and the policy stays reproducible.
    if rng.random() < slip:
        return int(rng.choice(_wrong(item)))
    return item.correct_index


def deterministic(hypothesis: str) -> StudentPolicy:
    """Spec v2 6.1 student: always applies the misconception when an item triggers it.

    Chooses the first option linked to the misconception, otherwise the correct
    option; a NONE student always answers correctly. Identical to the rule in
    ``tests/engine_students.deterministic_answer``.
    """

    def answer(item: Item, rng: np.random.Generator) -> int:
        if hypothesis == NONE:
            return item.correct_index
        linked = _linked(item, hypothesis)
        return linked[0] if linked else item.correct_index

    return StudentPolicy("deterministic", hypothesis, answer, target=hypothesis,
                         description="first linked option when triggered, otherwise correct")


def always_option(index: int = 0) -> StudentPolicy:
    """Picks the option in one fixed position on every item (always-A for index 0)."""

    if isinstance(index, bool) or not isinstance(index, int) or not 0 <= index < 4:
        raise ValueError("index must be an option position 0-3")
    letter = OPTION_LETTERS[index]

    def answer(item: Item, rng: np.random.Generator) -> int:
        return index

    return StudentPolicy(f"always-{letter}", None, answer,
                         description=f"chooses option position {letter} on every item")


def partial_holder(target: str, companion: str) -> StudentPolicy:
    """Holds ``target`` but shows it only where ``companion`` predicts the same option.

    On an item where some option is linked to both, chooses the first such option;
    on every other item answers correctly. For target MATH-2039 and companion
    MATH-1965 this is the constructed partial holder of KF-07.
    """

    def answer(item: Item, rng: np.random.Generator) -> int:
        both = [j for j, links in enumerate(item.links) if target in links and companion in links]
        return both[0] if both else item.correct_index

    return StudentPolicy("partial-holder", target, answer, target=target,
                         description=f"applies {target} only where {companion} predicts the same option")


def none_student(slip: float) -> StudentPolicy:
    """No catalogued misconception: correct with probability 1 - slip on every item."""

    slip = _rate("slip", slip)

    def answer(item: Item, rng: np.random.Generator) -> int:
        return _careful(item, rng, slip)

    return StudentPolicy("none-with-slip", NONE, answer, stochastic=True, slip=slip,
                         description="correct, except a uniformly chosen wrong option with probability slip")


def intermittent(target: str, apply_rate: float, slip: float) -> StudentPolicy:
    """Holds ``target`` but applies it only part of the time (spec v2 6.3 generator).

    On an item that triggers ``target``: with probability ``apply_rate`` choose one
    of its linked options uniformly; otherwise answer like a careful student. On
    every other item answer like a careful student. A careful student is correct
    with probability 1 - slip and otherwise picks a uniformly chosen wrong option.
    """

    apply_rate, slip = _rate("apply_rate", apply_rate), _rate("slip", slip)
    if target == NONE:
        raise ValueError("an intermittent student needs a misconception target")

    def answer(item: Item, rng: np.random.Generator) -> int:
        linked = _linked(item, target)
        if linked and rng.random() < apply_rate:
            return int(rng.choice(linked))
        return _careful(item, rng, slip)

    return StudentPolicy("intermittent", target, answer, stochastic=True, target=target,
                         apply_rate=apply_rate, slip=slip,
                         description="applies the misconception with probability apply_rate when triggered")


def random_uniform() -> StudentPolicy:
    """Chooses each of the four options with equal probability on every item."""

    def answer(item: Item, rng: np.random.Generator) -> int:
        return int(rng.integers(4))

    return StudentPolicy("random-uniform", None, answer, stochastic=True,
                         description="uniform over the four options on every item")
