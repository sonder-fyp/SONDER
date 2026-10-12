"""Ahmed's pack loader core: diagnostic units from authored rows (spec v2 sections 2 and 4).

``build_pack`` receives rows that a reader has already parsed (``sonder_pack``
reads the files), so this module performs no I/O. It refuses a pack that breaks
a hard rule (V1-V11) and reports every warning (W1-W6 and configured
exclusions) on every load. The dataset itself is never changed: skips, drops and
unplaced labels exist only in the unit table and in the units built here.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from itertools import combinations

from .bayes import check_p1, likelihood_matrix
from .model import NONE, UNMODELLED, Item, Params, validate_hypotheses
from .stopping import total_variation

PACK_FORMAT = 2
# W2: a pair is weakly separable when at most this many item groups separate it (spec v2 section 4).
WEAK_SEPARATION_MAX = 4
# W3: a hypothesis with fewer trigger groups than this cannot gather enough evidence.
MIN_TRIGGER_GROUPS = 3

BANK_COLUMNS = (
    "item_id", "topic", "target", "stem", "option_id", "option_text",
    "is_correct", "misconceptions", "status", "batch",
)
TOPIC_COLUMNS = ("topic", "MisconceptionId", "MisconceptionName")
_CONFIG_KEYS = {"pack_format", "content_version", "subject", "labels", "units"}
_LABEL_KEYS = {"label", "unit", "decision", "reason"}
_UNIT_KEYS = {"unit_id", "name", "topic", "skip_items", "drop_hypotheses"}
_SKIP_KEYS = {"item_id", "decision", "reason"}
_DROP_KEYS = {"misconception_id", "decision", "reason"}


class PackError(ValueError):
    """A hard rule failed; the pack must not be used."""

    def __init__(self, code: str, location: str, detail: str) -> None:
        super().__init__(f"{code} at {location}: {detail}")
        self.code = code
        self.location = location
        self.detail = detail


@dataclass(frozen=True)
class Hypothesis:
    misconception_id: str
    name: str
    home_topic: str
    companion: bool


@dataclass(frozen=True)
class PackItem:
    """An engine Item plus the authored text the numerical Item does not hold."""

    item: Item
    stem: str
    option_texts: tuple[str, str, str, str]
    target_misconception_id: str
    label: str
    batch: str


@dataclass(frozen=True)
class PackIdentity:
    """Names the content a session ran on, for the trace."""

    content_version: str
    source_sha256: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class Unit:
    unit_id: str
    name: str
    hypotheses: tuple[Hypothesis, ...]  # slot order 0..k-1
    items: tuple[PackItem, ...]  # pack order: first appearance in the bank file
    pack: PackIdentity

    @property
    def hyps(self) -> tuple[str, ...]:
        return tuple(h.misconception_id for h in self.hypotheses) + (NONE, UNMODELLED)

    @property
    def engine_items(self) -> tuple[Item, ...]:
        return tuple(pack_item.item for pack_item in self.items)


@dataclass(frozen=True)
class LoadWarning:
    code: str
    unit_id: str | None
    subject: str
    detail: str
    decision: str | None = None


@dataclass(frozen=True)
class Pack:
    pack_format: int
    identity: PackIdentity
    subject: str
    units: tuple[Unit, ...]
    unplaced: tuple[PackItem, ...]
    warnings: tuple[LoadWarning, ...]

    def unit(self, unit_id: str) -> Unit:
        for unit in self.units:
            if unit.unit_id == unit_id:
                return unit
        raise PackError("CONFIG", unit_id, "no such unit in this pack")


# --------------------------------------------------------------------------- small helpers
def _misconception_number(misconception_id: str) -> tuple[int, str]:
    tail = misconception_id.rsplit("-", 1)[-1]
    return (int(tail), misconception_id) if tail.isdigit() else (2**31, misconception_id)


def _group_key(item: Item) -> str:
    return item.twin_group or item.item_id


def _split_links(raw: str, location: str) -> tuple[str, ...]:
    raw = raw.strip()
    if not raw:
        return ()
    parts = tuple(part.strip() for part in raw.split("|"))
    if any(not part for part in parts):
        raise PackError("V8", location, "empty misconception ID in the link list")
    if len(set(parts)) != len(parts):
        raise PackError("V8", location, "an option repeats a misconception ID")
    return parts


def _require(mapping: Mapping[str, object], keys: set[str], allowed: set[str], location: str) -> None:
    missing = sorted(keys - set(mapping))
    unknown = sorted(set(mapping) - allowed)
    if missing or unknown:
        raise PackError("CONFIG", location, f"missing keys {missing}, unknown keys {unknown}")


def _text(value: object, location: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PackError("CONFIG", location, "expected a non-empty string")
    return value


def _entries(value: object, location: str) -> list[Mapping[str, object]]:
    if not isinstance(value, list) or any(not isinstance(entry, Mapping) for entry in value):
        raise PackError("CONFIG", location, "expected a list of objects")
    return value


# --------------------------------------------------------------------------- rows to items
def derive_twin_groups(bank_rows: Sequence[Mapping[str, str]]) -> dict[str, str]:
    """Map each item in a twin group (identical stems, spec 2.2) to its group ID.

    The group ID is the first member's item ID in file order. Items whose stem is
    unique are absent from the result.
    """

    by_stem: dict[str, list[str]] = {}
    for row in bank_rows:
        members = by_stem.setdefault(row["stem"].strip(), [])
        if row["item_id"] not in members:
            members.append(row["item_id"])
    return {item_id: members[0]
            for members in by_stem.values() if len(members) > 1 for item_id in members}


def _check_columns(rows: Sequence[Mapping[str, str]], required: tuple[str, ...], name: str) -> None:
    if not rows:
        raise PackError("CONFIG", name, "no rows")
    missing = sorted(set(required) - set(rows[0]))
    if missing:
        raise PackError("CONFIG", name, f"missing columns {missing}")


def _build_items(bank_rows: Sequence[Mapping[str, str]],
                 warnings: list[LoadWarning]) -> list[PackItem]:
    has_grades = "link_grade" in bank_rows[0]
    grouped: dict[str, list[Mapping[str, str]]] = {}
    for row in bank_rows:
        grouped.setdefault(row["item_id"].strip(), []).append(row)
    unapproved = [item_id for item_id, rows in grouped.items()
                  if any(row["status"] != "approved" for row in rows)]
    for item_id in unapproved:
        warnings.append(LoadWarning("UNAPPROVED_ROW", None, item_id,
                                    "item has a row that is not approved; it is not used"))
    approved_rows = [row for row in bank_rows if row["item_id"].strip() not in unapproved]
    twins = derive_twin_groups(approved_rows)

    items = []
    for item_id, rows in grouped.items():
        if item_id in unapproved:
            continue
        location = f"items.csv:{item_id}"
        if not item_id:
            raise PackError("V6", "items.csv", "empty item_id")
        for field in ("topic", "target", "stem", "batch"):
            if len({row[field] for row in rows}) != 1:
                raise PackError("V6", location, f"rows disagree on {field}; two items may share an ID")
        if len(rows) != 4:
            raise PackError("V1", location, f"expected 4 options, found {len(rows)}")
        rows = sorted(rows, key=lambda row: row["option_id"].strip())
        option_ids = tuple(row["option_id"].strip() for row in rows)
        if len(set(option_ids)) != 4 or any(not o for o in option_ids):
            raise PackError("V3", location, "option IDs must be four distinct non-empty values")
        texts = tuple(row["option_text"].strip() for row in rows)
        if len({text.casefold() for text in texts}) != 4 or any(not text for text in texts):
            raise PackError("V3", location, "option texts must be four distinct non-empty values")
        flags = [row["is_correct"] for row in rows]
        if any(flag not in ("True", "False") for flag in flags) or flags.count("True") != 1:
            raise PackError("V2", location, "exactly one option must be correct (True/False only)")
        correct = flags.index("True")
        links = tuple(_split_links(row["misconceptions"], f"{location}:{row['option_id']}")
                      for row in rows)
        if links[correct]:
            raise PackError("V4", location, "the correct option has misconception links")
        grades = None
        if has_grades:
            grades = tuple(_split_links(row["link_grade"], f"{location}:{row['option_id']}")
                           if row["link_grade"].strip() else () for row in rows)
            for option_links, option_grades in zip(links, grades):
                if len(option_links) != len(option_grades) or set(option_grades) - {"S", "T"}:
                    raise PackError("V8", location, "link_grade must give one S or T per linked ID")
        items.append(PackItem(
            item=Item(item_id, option_ids, correct, links, grades, twins.get(item_id)),
            stem=rows[0]["stem"],
            option_texts=texts,
            target_misconception_id=rows[0]["target"].strip(),
            label=rows[0]["topic"],
            batch=rows[0]["batch"].strip(),
        ))
    return items


# --------------------------------------------------------------------------- unit statistics
def trigger_groups(unit: Unit, misconception_id: str) -> int:
    """Twin-collapsed item groups on which the misconception links at least one option."""

    return len({_group_key(p.item) for p in unit.items
                if any(misconception_id in links for links in p.item.links)})


def separating_items(unit: Unit, a: str, b: str, params: Params) -> tuple[str, ...]:
    """Unit items on which hypotheses ``a`` and ``b`` differ by more than ``delta_sep``."""

    hyps = unit.hyps
    i, j = hyps.index(a), hyps.index(b)
    found = []
    for pack_item in unit.items:
        L = likelihood_matrix(pack_item.item, hyps, params)
        if total_variation(L[i], L[j]) > params.delta_sep:
            found.append(pack_item.item.item_id)
    return tuple(found)


def unit_warnings(unit: Unit, params: Params) -> tuple[LoadWarning, ...]:
    """W1-W5 for one unit, in a fixed order."""

    hyps = unit.hyps
    matrices = [likelihood_matrix(p.item, hyps, params) for p in unit.items]
    found: list[LoadWarning] = []
    # Pairs over misconceptions and NONE; UNMODELLED is never within delta of them.
    for i, j in combinations(range(len(hyps) - 1), 2):
        groups = {_group_key(p.item) for p, L in zip(unit.items, matrices)
                  if total_variation(L[i], L[j]) > params.delta_sep}
        pair = f"{hyps[i]}/{hyps[j]}"
        if not groups:
            found.append(LoadWarning("W1", unit.unit_id, pair,
                                     "structurally inseparable: no unit item separates them"))
        elif len(groups) <= WEAK_SEPARATION_MAX:
            found.append(LoadWarning("W2", unit.unit_id, pair,
                                     f"weakly separable: {len(groups)} separating item group(s)"))
    for h in unit.hypotheses:
        count = trigger_groups(unit, h.misconception_id)
        if count < MIN_TRIGGER_GROUPS:
            found.append(LoadWarning("W3", unit.unit_id, h.misconception_id,
                                     f"{count} trigger group(s); fewer than {MIN_TRIGGER_GROUPS}",
                                     "D-5" if h.companion else None))
    for p in unit.items:
        unlinked = sum(1 for j, links in enumerate(p.item.links)
                       if j != p.item.correct_index and not links)
        if unlinked >= 2:
            found.append(LoadWarning("W4", unit.unit_id, p.item.item_id,
                                     f"{unlinked} wrong options have no linked misconception"))
    for p in unit.items:
        for h in unit.hypotheses:
            if sum(h.misconception_id in links for links in p.item.links) == 3:
                found.append(LoadWarning("W5", unit.unit_id, p.item.item_id,
                                         f"{h.misconception_id} is linked to 3 options"))
    return tuple(found)


# --------------------------------------------------------------------------- the pack
def build_pack(bank_rows: Sequence[Mapping[str, str]],
               topic_rows: Sequence[Mapping[str, str]],
               config: Mapping[str, object],
               params: Params,
               *, source_sha256: Sequence[tuple[str, str]] = ()) -> Pack:
    """Build and check every unit declared in ``config`` (pack format 2)."""

    if not isinstance(params, Params):
        raise TypeError("params must be Params")
    if not isinstance(config, Mapping):
        raise PackError("CONFIG", "unit table", "expected an object")
    _require(config, _CONFIG_KEYS, _CONFIG_KEYS, "unit table")
    if config["pack_format"] != PACK_FORMAT:
        raise PackError("V10", "unit table", f"pack_format must be {PACK_FORMAT}")
    identity = PackIdentity(_text(config["content_version"], "content_version"),
                            tuple((str(name), str(digest)) for name, digest in source_sha256))
    subject = _text(config["subject"], "subject")
    _check_columns(bank_rows, BANK_COLUMNS, "items.csv")
    _check_columns(topic_rows, TOPIC_COLUMNS, "topics.csv")

    catalogue: dict[str, tuple[str, str]] = {}  # misconception -> (topic, name)
    topic_order: dict[str, list[str]] = {}
    for row in topic_rows:
        misconception_id = row["MisconceptionId"].strip()
        if not misconception_id or misconception_id in catalogue:
            raise PackError("V6", "topics.csv", f"empty or repeated misconception ID {misconception_id!r}")
        catalogue[misconception_id] = (row["topic"].strip(), row["MisconceptionName"].strip())
        topic_order.setdefault(row["topic"].strip(), []).append(misconception_id)

    warnings: list[LoadWarning] = []
    items = _build_items(bank_rows, warnings)
    for p in items:
        unknown = sorted({m for links in p.item.links for m in links} - set(catalogue))
        if unknown:
            raise PackError("V5'", f"items.csv:{p.item.item_id}", f"links unknown misconceptions {unknown}")

    unit_entries = _entries(config["units"], "units")
    unit_ids = []
    for entry in unit_entries:
        _require(entry, {"unit_id", "name", "topic"}, _UNIT_KEYS, "units")
        unit_ids.append(_text(entry["unit_id"], "units.unit_id"))
    if len(set(unit_ids)) != len(unit_ids):
        raise PackError("CONFIG", "units", "repeated unit_id")

    label_unit: dict[str, str | None] = {}
    label_decision: dict[str, tuple[str, str]] = {}
    for entry in _entries(config["labels"], "labels"):
        _require(entry, {"label", "unit"}, _LABEL_KEYS, "labels")
        label = _text(entry["label"], "labels.label")
        if label in label_unit:
            raise PackError("CONFIG", label, "label listed twice")
        unit_id = entry["unit"]
        if unit_id is None:
            label_decision[label] = (_text(entry.get("decision"), f"{label}.decision"),
                                     _text(entry.get("reason"), f"{label}.reason"))
        elif unit_id not in unit_ids:
            raise PackError("CONFIG", label, f"maps to undeclared unit {unit_id!r}")
        label_unit[label] = unit_id
    bank_labels = {p.label for p in items}
    unmapped = sorted(bank_labels - set(label_unit))
    if unmapped:
        raise PackError("LABEL", unmapped[0], "items.csv label is not in the unit table")
    unused = sorted(set(label_unit) - bank_labels)
    if unused:
        raise PackError("CONFIG", unused[0], "unit table label matches no approved item")

    units = []
    for entry in unit_entries:
        units.append(_build_unit(entry, items, label_unit, topic_order, catalogue,
                                 identity, params, warnings))

    unplaced = tuple(p for p in items if label_unit[p.label] is None)
    for p in unplaced:
        decision, reason = label_decision[p.label]
        warnings.append(LoadWarning("UNPLACED_ITEM", None, p.item.item_id, reason, decision))

    unit_of = {p.item.item_id: unit.unit_id for unit in units for p in unit.items}
    groups: dict[str, set[str]] = {}
    for p in items:
        if p.item.twin_group is not None and p.item.item_id in unit_of:
            groups.setdefault(p.item.twin_group, set()).add(unit_of[p.item.item_id])
    for group_id, members in groups.items():
        if len(members) > 1:
            warnings.append(LoadWarning(
                "TWIN_CROSS_UNIT", None, group_id,
                f"twin group split across units {sorted(members)}; its items never meet in one session"))
    if "link_grade" not in bank_rows[0]:
        warnings.append(LoadWarning("W6", None, "items.csv",
                                    "no link_grade column; every link is treated as sound (S)", "T-1"))
    return Pack(PACK_FORMAT, identity, subject, tuple(units), unplaced, tuple(warnings))


def _build_unit(entry: Mapping[str, object], items: Sequence[PackItem],
                label_unit: Mapping[str, str | None], topic_order: Mapping[str, list[str]],
                catalogue: Mapping[str, tuple[str, str]], identity: PackIdentity,
                params: Params, warnings: list[LoadWarning]) -> Unit:
    unit_id = str(entry["unit_id"])
    topic = _text(entry["topic"], f"{unit_id}.topic")
    if topic not in topic_order:
        raise PackError("CONFIG", unit_id, f"topic {topic!r} is not in topics.csv")
    members = [p for p in items if label_unit[p.label] == unit_id]
    own = topic_order[topic]
    # Companions come from the label-mapped items before any skip, so they match spec 2.1.
    linked = {m for p in members for links in p.item.links for m in links}
    companions = sorted(linked - set(own), key=_misconception_number)

    member_ids = {p.item.item_id for p in members}
    skipped = set()
    for skip in _entries(entry.get("skip_items", []), f"{unit_id}.skip_items"):
        _require(skip, _SKIP_KEYS, _SKIP_KEYS, f"{unit_id}.skip_items")
        item_id = _text(skip["item_id"], f"{unit_id}.skip_items.item_id")
        if item_id not in member_ids:
            raise PackError("CONFIG", unit_id, f"skip of {item_id}, which is not in this unit")
        skipped.add(item_id)
        warnings.append(LoadWarning("SKIPPED_ITEM", unit_id, item_id,
                                    _text(skip["reason"], f"{item_id}.reason"),
                                    _text(skip["decision"], f"{item_id}.decision")))
    dropped = set()
    for drop in _entries(entry.get("drop_hypotheses", []), f"{unit_id}.drop_hypotheses"):
        _require(drop, _DROP_KEYS, _DROP_KEYS, f"{unit_id}.drop_hypotheses")
        misconception_id = _text(drop["misconception_id"], f"{unit_id}.drop_hypotheses")
        if misconception_id not in own and misconception_id not in companions:
            raise PackError("CONFIG", unit_id, f"drop of {misconception_id}, which is not in this unit")
        dropped.add(misconception_id)
        warnings.append(LoadWarning("DROPPED_HYPOTHESIS", unit_id, misconception_id,
                                    _text(drop["reason"], f"{misconception_id}.reason"),
                                    _text(drop["decision"], f"{misconception_id}.decision")))

    hypotheses = tuple(
        Hypothesis(m, catalogue[m][1], catalogue[m][0], m not in own)
        for m in list(own) + companions if m not in dropped
    )
    unit = Unit(unit_id, _text(entry["name"], f"{unit_id}.name"), hypotheses,
                tuple(p for p in members if p.item.item_id not in skipped), identity)

    if not 1 <= len(hypotheses) <= params.k_max:
        raise PackError("V7", unit_id, f"k = {len(hypotheses)}; must be 1..{params.k_max}")
    validate_hypotheses(unit.hyps, params.k_max)
    declared = set(unit.hyps[:-2])
    for p in unit.items:
        outside = sorted({m for links in p.item.links for m in links} - declared)
        if outside:
            raise PackError("V5'", f"{unit_id}:{p.item.item_id}",
                            f"links misconceptions outside the unit: {outside}")
    groups = len({_group_key(p.item) for p in unit.items})
    if groups < params.default_budget:
        raise PackError("V9", unit_id,
                        f"{groups} item groups; a session needs {params.default_budget}")
    try:
        check_p1(unit.engine_items, unit.hyps, params)
    except ValueError as exc:
        raise PackError("V11", unit_id, str(exc)) from exc
    warnings.extend(unit_warnings(unit, params))
    return unit
