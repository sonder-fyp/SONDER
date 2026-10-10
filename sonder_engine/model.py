"""Input types shared by the diagnostic calculation owners.

An adapter builds these immutable values from an approved content pack and
keeps option IDs in presentation order. This package performs no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite

NONE = "NONE"
UNMODELLED = "UNMODELLED"
MAX_MISCONCEPTIONS = 6


def _rate(name: str, value: float, *, ceiling: float = 1.0) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a finite number")
    if not isfinite(value) or not 0.0 < value < ceiling:
        raise ValueError(f"{name} must be finite and strictly between 0 and {ceiling}")


@dataclass(frozen=True)
class Params:
    """Assumed response parameters, not estimates from student answers."""

    slip: float = 0.10
    guess: float = 0.30
    prior_none: float = 0.25
    prior_unmodelled: float = 0.05

    def __post_init__(self) -> None:
        _rate("slip", self.slip, ceiling=0.5)
        _rate("guess", self.guess, ceiling=0.5)
        _rate("prior_none", self.prior_none)
        _rate("prior_unmodelled", self.prior_unmodelled)
        if self.prior_none + self.prior_unmodelled >= 1.0:
            raise ValueError("reserved prior masses must sum to less than one")


@dataclass(frozen=True)
class Item:
    """Four-option Q-matrix input; text and authoring target stay in the pack."""

    item_id: str
    option_ids: tuple[str, str, str, str]
    correct_index: int
    links: tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...], tuple[str, ...]]

    def __post_init__(self) -> None:
        if not isinstance(self.item_id, str) or not self.item_id.strip():
            raise ValueError("item_id must be nonempty")
        if not isinstance(self.option_ids, tuple) or len(self.option_ids) != 4:
            raise ValueError("item must have exactly four ordered option IDs")
        if any(not isinstance(o, str) or not o.strip() for o in self.option_ids):
            raise ValueError("option IDs must be nonempty strings")
        if len(set(self.option_ids)) != 4:
            raise ValueError("option IDs must be unique")
        if isinstance(self.correct_index, bool) or not isinstance(self.correct_index, int):
            raise ValueError("correct_index must be an integer option index")
        if not 0 <= self.correct_index < 4:
            raise ValueError("correct_index is out of range")
        if not isinstance(self.links, tuple) or len(self.links) != 4:
            raise ValueError("links must match the four options")
        counts: dict[str, int] = {}
        for option_links in self.links:
            if not isinstance(option_links, tuple):
                raise ValueError("each option's links must be an immutable tuple")
            if any(not isinstance(m, str) or not m.strip() for m in option_links):
                raise ValueError("linked misconception IDs must be nonempty strings")
            if len(set(option_links)) != len(option_links):
                raise ValueError("an option cannot repeat a misconception ID")
            for m in option_links:
                if m in (NONE, UNMODELLED):
                    raise ValueError("reserved hypotheses cannot be option links")
                counts[m] = counts.get(m, 0) + 1
        if self.links[self.correct_index]:
            raise ValueError("correct option cannot link to a misconception")
        if any(count > 2 for count in counts.values()):
            raise ValueError("a misconception cannot link to more than two options")


def validate_hypotheses(hyps: tuple[str, ...]) -> tuple[str, ...]:
    """Require the agreed order: misconception IDs, NONE, UNMODELLED."""

    if not isinstance(hyps, tuple):
        raise ValueError("hypotheses must be an ordered tuple")
    if not 1 <= len(hyps) - 2 <= MAX_MISCONCEPTIONS:
        raise ValueError("the pack needs one to six misconception hypotheses")
    if hyps[-2:] != (NONE, UNMODELLED):
        raise ValueError("hypotheses must end with NONE, UNMODELLED")
    if any(not isinstance(h, str) or not h.strip() for h in hyps):
        raise ValueError("hypothesis IDs must be nonempty strings")
    if len(set(hyps)) != len(hyps):
        raise ValueError("hypothesis IDs must be unique")
    return hyps
