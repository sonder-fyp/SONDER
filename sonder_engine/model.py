"""Input types shared by the diagnostic calculation owners.

An adapter builds these immutable values from an approved content pack and
keeps option IDs in presentation order. This package performs no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite

NONE = "NONE"
UNMODELLED = "UNMODELLED"
MAX_MISCONCEPTIONS = 8
# Keeps off-option likelihoods and eight-step posterior traces representable
# in float64. Values below this are not meaningful uncalibrated assumptions.
MIN_PARAMETER_RATE = 1e-12


def _rate(name: str, value: float, *, ceiling: float = 1.0) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a finite number")
    if not isfinite(value) or not MIN_PARAMETER_RATE <= value < ceiling:
        raise ValueError(
            f"{name} must be finite and in [{MIN_PARAMETER_RATE}, {ceiling})"
        )


@dataclass(frozen=True)
class Params:
    """Assumed response parameters, not estimates from student answers."""

    slip: float = 0.10
    guess: float = 0.30
    prior_none: float = 0.25
    prior_unmodelled: float = 0.05
    theta: float = 0.80
    theta_unmodelled: float = 0.50
    min_support: int = 2
    min_support_none: int = 3
    delta_sep: float = 0.05
    eig_floor: float = 0.01
    default_budget: int = 8
    k_max: int = MAX_MISCONCEPTIONS
    w_sound: float = 1.0
    w_stretch: float = 0.5

    def __post_init__(self) -> None:
        _rate("slip", self.slip, ceiling=0.5)
        # The item-dependent P1 check supplies the tighter ceiling for each
        # predicted-set size. A rate below one is valid before a pack is known.
        _rate("guess", self.guess)
        _rate("prior_none", self.prior_none)
        _rate("prior_unmodelled", self.prior_unmodelled)
        if self.prior_none + self.prior_unmodelled >= 1.0:
            raise ValueError("reserved prior masses must sum to less than one")
        _rate("theta", self.theta)
        if self.theta <= 0.5:
            raise ValueError("theta must be greater than 0.5")
        _rate("theta_unmodelled", self.theta_unmodelled)
        if self.theta + self.theta_unmodelled <= 1.0:
            raise ValueError("theta + theta_unmodelled must exceed one")
        for name in ("min_support", "min_support_none", "default_budget", "k_max"):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int) or value < 1:
                raise ValueError(f"{name} must be a positive integer")
        if self.min_support_none < self.min_support:
            raise ValueError("min_support_none must be at least min_support")
        if self.k_max > MAX_MISCONCEPTIONS:
            raise ValueError(f"k_max cannot exceed {MAX_MISCONCEPTIONS}")
        for name, ceiling in (("delta_sep", 0.5), ("eig_floor", float("inf"))):
            value = getattr(self, name)
            if (isinstance(value, bool) or not isinstance(value, (int, float))
                    or not isfinite(value) or not 0 <= value < ceiling):
                raise ValueError(f"{name} must be finite and in [0, {ceiling})")
        for name in ("w_sound", "w_stretch"):
            value = getattr(self, name)
            if (isinstance(value, bool) or not isinstance(value, (int, float))
                    or not isfinite(value) or not 0 <= value <= 1.0
                    or (name == "w_sound" and value == 0)):
                raise ValueError(f"{name} must be finite and in [0, 1], with w_sound > 0")
        if self.w_stretch > self.w_sound:
            raise ValueError("w_stretch cannot exceed w_sound")


@dataclass(frozen=True)
class Item:
    """Four-option Q-matrix input; text and authoring target stay in the pack."""

    item_id: str
    option_ids: tuple[str, str, str, str]
    correct_index: int
    links: tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...], tuple[str, ...]]
    # One S/T grade per linked ID in links, in the same order. Missing grades
    # mean S. Parameters turn grades into weights at calculation time, so a
    # parameter change does not require rebuilding the content item.
    link_grades: tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...], tuple[str, ...]] | None = None

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
        if any(count > 3 for count in counts.values()):
            raise ValueError("a misconception cannot link to more than three options")
        if self.link_grades is None:
            object.__setattr__(self, "link_grades", tuple(
                tuple("S" for _ in option_links) for option_links in self.links
            ))
        if not isinstance(self.link_grades, tuple) or len(self.link_grades) != 4:
            raise ValueError("link_grades must match the four options")
        for option_links, option_grades in zip(self.links, self.link_grades):
            if not isinstance(option_grades, tuple) or len(option_grades) != len(option_links):
                raise ValueError("link_grades must match each option's linked IDs")
            if any(grade not in ("S", "T") for grade in option_grades):
                raise ValueError("link_grades may contain only S or T")


def validate_hypotheses(
    hyps: tuple[str, ...], max_misconceptions: int = MAX_MISCONCEPTIONS
) -> tuple[str, ...]:
    """Require the agreed order: misconception IDs, NONE, UNMODELLED."""

    if not isinstance(hyps, tuple):
        raise ValueError("hypotheses must be an ordered tuple")
    if (isinstance(max_misconceptions, bool) or not isinstance(max_misconceptions, int)
            or not 1 <= max_misconceptions <= MAX_MISCONCEPTIONS):
        raise ValueError("max_misconceptions must be between one and eight")
    if not 1 <= len(hyps) - 2 <= max_misconceptions:
        raise ValueError(f"the unit needs one to {max_misconceptions} misconception hypotheses")
    if hyps[-2:] != (NONE, UNMODELLED):
        raise ValueError("hypotheses must end with NONE, UNMODELLED")
    if any(not isinstance(h, str) or not h.strip() for h in hyps):
        raise ValueError("hypothesis IDs must be nonempty strings")
    if len(set(hyps)) != len(hyps):
        raise ValueError("hypothesis IDs must be unique")
    return hyps
