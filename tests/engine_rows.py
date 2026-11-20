"""Synthetic units and a reachability bound for the R4 row cases (I2-A02); not a test module.

R4 refuses when no remaining item separates the leader from a tied set C and
p(leader)/p(C) < theta. Membership of C uses a tolerance: total variation <= delta_sep
on every remaining item. When the rows of C are exactly equal, no answer can change
their posterior ratios, so p(leader)/p(C) really is a ceiling. When rows are only
near (0 < TV <= delta_sep), each answer multiplies the odds by a likelihood ratio and
the share can move. ``reachable_share`` bounds how far it can move within a number of
further answers, which is what a correct guarantee has to be about.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from sonder_engine import Item, Params, likelihood_matrix
from sonder_engine.pack import Hypothesis, PackIdentity, PackItem, Unit

OPTIONS = ("A", "B", "C", "D")


def make_item(item_id: str, links, grades=None, *, correct: int = 0, twin_group: str | None = None) -> Item:
    links = tuple(tuple(x) for x in links)
    link_grades = None if grades is None else tuple(tuple(x) for x in grades)
    return Item(item_id, OPTIONS, correct, links, link_grades=link_grades, twin_group=twin_group)


def make_unit(items: Sequence[Item], misconceptions: Sequence[str] = ("M1", "M2"),
              unit_id: str = "X") -> Unit:
    """A pack Unit built directly from engine Items, for the real session loop."""

    hypotheses = tuple(Hypothesis(m, m, "synthetic", False) for m in misconceptions)
    pack_items = tuple(PackItem(item, f"Synthetic item {item.item_id}", ("a", "b", "c", "d"),
                                misconceptions[0], "synthetic", "synthetic") for item in items)
    return Unit(unit_id, "synthetic", hypotheses, pack_items, PackIdentity("synthetic", ()))


def exact_item(item_id: str, *, twin_group: str | None = None) -> Item:
    """B is linked to both M1 and M2 with sound grades: their rows are identical."""

    return make_item(item_id, [(), ("M1", "M2"), (), ()], twin_group=twin_group)


def near_item(item_id: str, *, twin_group: str | None = None) -> Item:
    """B is linked to M1 (sound) and M2 (stretch): with w_stretch near 1 the rows are near."""

    return make_item(item_id, [(), ("M1", "M2"), (), ()], [(), ("S", "T"), (), ()], twin_group=twin_group)


def separating_item(item_id: str, *, twin_group: str | None = None) -> Item:
    """B is linked to M1 only and C to M2 only: the rows differ by a large TV."""

    return make_item(item_id, [(), ("M1",), ("M2",), ()], twin_group=twin_group)


def best_ratio(item: Item, lead: int, other: int, hyps: tuple[str, ...], params: Params) -> float:
    """The largest factor one answer to ``item`` can multiply the odds of lead over other by."""

    L = likelihood_matrix(item, hyps, params)
    return float(max(L[lead] / L[other]))


def reachable_share(p: np.ndarray, lead: int, tied: Sequence[int], remaining: Sequence[Item],
                    answers_left: int, hyps: tuple[str, ...], params: Params) -> float:
    """Upper bound on p(lead)/p(C) after at most ``answers_left`` more answers.

    For each other member j of C, the odds of lead over j can grow by at most the
    product of the ``answers_left`` largest per-item best ratios among the remaining
    items. Bounding each pair separately gives an upper bound on the share (it may
    not be attainable by one answer sequence). With exactly equal rows every ratio
    is 1 and the bound equals the current share.
    """

    if answers_left < 0:
        raise ValueError("answers_left must be non-negative")
    denominator = 1.0
    for j in tied:
        if j == lead:
            continue
        ratios = sorted((best_ratio(item, lead, j, hyps, params) for item in remaining), reverse=True)
        growth = float(np.prod(ratios[:answers_left])) if answers_left else 1.0
        denominator += float(p[j]) / (float(p[lead]) * max(growth, 1.0))
    return 1.0 / denominator
