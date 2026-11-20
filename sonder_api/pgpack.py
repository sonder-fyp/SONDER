"""Read a frozen release from PostgreSQL into the engine's own types (I2-L02).

A release is one frozen ``response_model`` row: it pins the content version, the
parameter set and, through the content version, every unit, hypothesis slot, item
position, link and link grade. The engine calculates from these values exactly as it
does from the CSV loader; nothing here calculates.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, fields
from pathlib import Path

import psycopg

import sonder_engine
from sonder_engine.model import NONE, UNMODELLED, Item, Params
from sonder_engine.pack import Hypothesis, PackIdentity, PackItem, Unit

SELECTION_POLICY = "eig-max; exact ties to the lower pack position"
_INTEGER_PARAMS = {"min_support", "min_support_none", "default_budget", "k_max"}


class ReleaseError(RuntimeError):
    """The configured release is missing, not frozen, or not usable by the engine."""


@dataclass(frozen=True)
class Release:
    response_model_id: str
    content_version_id: str
    subject_id: str
    subject_name: str
    version_code: str
    model_code: str
    pack_sha256: str
    params_version: str
    params_sha256: str
    params: Params

    @property
    def label(self) -> str:
        return f"{self.version_code}/{self.model_code}"


@dataclass(frozen=True)
class UnitIndex:
    """Database IDs for one unit of one release, keyed the way the engine names things."""

    unit_row_id: str
    hypothesis_ids: tuple[str, ...]  # slot order, including NONE and UNMODELLED
    item_ids: dict[str, str]  # item external ID -> item.id
    option_ids: dict[tuple[str, str], str]  # (item external ID, option label) -> item_option.id


_RELEASE_SQL = """
SELECT r.id, r.content_version_id, c.subject_id, s.name, c.version_code, r.model_code, c.pack_sha256,
       p.params_version, p.params_sha256, {columns}
FROM sonder.response_model r
JOIN sonder.content_version c ON c.id = r.content_version_id
JOIN sonder.subject s ON s.id = c.subject_id
JOIN sonder.engine_params p ON p.id = r.engine_params_id
WHERE r.status = 'frozen' AND c.status = 'frozen' AND {where}
"""


def _release(row: tuple) -> Release:
    names = [f.name for f in fields(Params)]
    values = {name: (int(value) if name in _INTEGER_PARAMS else float(value))
              for name, value in zip(names, row[9:])}
    return Release(str(row[0]), str(row[1]), str(row[2]), row[3], row[4], row[5], row[6], row[7], row[8],
                   Params(**values))


def _release_sql(where: str) -> str:
    return _RELEASE_SQL.format(columns=", ".join(f"p.{f.name}" for f in fields(Params)), where=where)


def load_release(conn: psycopg.Connection, label: str) -> Release:
    """The frozen release named ``<version_code>/<model_code>``."""

    version_code, separator, model_code = label.partition("/")
    if not separator or not version_code or not model_code:
        raise ReleaseError("a release is named <version_code>/<model_code>")
    rows = conn.execute(_release_sql("c.version_code = %s AND r.model_code = %s"),
                        (version_code, model_code)).fetchall()
    if len(rows) != 1:
        raise ReleaseError(f"release {label!r}: expected one frozen response model, found {len(rows)}")
    return _release(rows[0])


def load_release_by_model(conn: psycopg.Connection, response_model_id: str) -> Release:
    row = conn.execute(_release_sql("r.id = %s"), (response_model_id,)).fetchone()
    if row is None:
        raise ReleaseError(f"response model {response_model_id} is not a frozen release")
    return _release(row)


def unit_catalogue(conn: psycopg.Connection, release: Release) -> list[dict[str, object]]:
    rows = conn.execute(
        "SELECT u.unit_code, u.name, (SELECT count(*) FROM sonder.unit_item ui WHERE ui.unit_id = u.id) "
        "FROM sonder.diagnostic_unit u WHERE u.content_version_id = %s ORDER BY u.unit_code",
        (release.content_version_id,)).fetchall()
    return [{"unit_id": code, "name": name, "item_count": int(count)} for code, name, count in rows]


def load_unit(conn: psycopg.Connection, release: Release, unit_code: str) -> tuple[Unit, UnitIndex] | None:
    """Rebuild one unit exactly as stored: hypothesis slots, item positions, links and grades."""

    row = conn.execute("SELECT id, name FROM sonder.diagnostic_unit WHERE content_version_id = %s AND unit_code = %s",
                       (release.content_version_id, unit_code)).fetchone()
    if row is None:
        return None
    unit_row_id, unit_name = str(row[0]), row[1]

    hyp_rows = conn.execute(
        "SELECT h.id, m.external_id, mr.name, tr.name "
        "FROM sonder.unit_hypothesis uh "
        "JOIN sonder.hypothesis h ON h.id = uh.hypothesis_id "
        "JOIN sonder.misconception_revision mr ON mr.id = h.misconception_revision_id "
        "JOIN sonder.misconception m ON m.id = mr.misconception_id "
        "LEFT JOIN sonder.topic_misconception tm ON tm.misconception_revision_id = mr.id AND tm.membership = 'home' "
        "LEFT JOIN sonder.topic_revision tr ON tr.id = tm.topic_revision_id "
        "WHERE uh.unit_id = %s ORDER BY uh.slot", (unit_row_id,)).fetchall()
    reserved = dict(conn.execute(
        "SELECT kind, id FROM sonder.hypothesis WHERE content_version_id = %s AND kind IN ('none', 'unmodelled')",
        (release.content_version_id,)).fetchall())
    if not hyp_rows or set(reserved) != {"none", "unmodelled"}:
        raise ReleaseError(f"unit {unit_code}: hypotheses are incomplete")
    # ``companion`` is a load-time warning aid that the database does not record; it is not used in calculation.
    hypotheses = tuple(Hypothesis(external, name, topic or "", False) for _, external, name, topic in hyp_rows)
    hypothesis_ids = tuple(str(r[0]) for r in hyp_rows) + (str(reserved["none"]), str(reserved["unmodelled"]))

    item_rows = conn.execute(
        "SELECT i.id, i.external_id, i.stem, coalesce(i.batch, ''), i.twin_group, tm.external_id, tr.name "
        "FROM sonder.unit_item ui "
        "JOIN sonder.item i ON i.id = ui.item_id "
        "JOIN sonder.topic_revision tr ON tr.id = i.topic_revision_id "
        "JOIN sonder.misconception_revision tmr ON tmr.id = i.target_misconception_revision_id "
        "JOIN sonder.misconception tm ON tm.id = tmr.misconception_id "
        "WHERE ui.unit_id = %s ORDER BY ui.position", (unit_row_id,)).fetchall()
    option_rows = conn.execute(
        "SELECT o.item_id, o.id, o.label, o.option_text, o.is_correct "
        "FROM sonder.item_option o JOIN sonder.unit_item ui ON ui.item_id = o.item_id "
        "WHERE ui.unit_id = %s ORDER BY o.item_id, o.label", (unit_row_id,)).fetchall()
    # Links inside one option are ordered by misconception external ID so the rebuilt Item is deterministic.
    link_rows = conn.execute(
        "SELECT om.option_id, m.external_id, om.link_grade "
        "FROM sonder.option_misconception om "
        "JOIN sonder.item_option o ON o.id = om.option_id "
        "JOIN sonder.unit_item ui ON ui.item_id = o.item_id "
        "JOIN sonder.misconception_revision mr ON mr.id = om.misconception_revision_id "
        "JOIN sonder.misconception m ON m.id = mr.misconception_id "
        "WHERE ui.unit_id = %s ORDER BY om.option_id, m.external_id", (unit_row_id,)).fetchall()

    links: dict[str, list[tuple[str, str]]] = {}
    for option_id, external, grade in link_rows:
        links.setdefault(str(option_id), []).append((external, grade))
    options: dict[str, list[tuple]] = {}
    for item_id, option_id, label, text, is_correct in option_rows:
        options.setdefault(str(item_id), []).append((str(option_id), label, text, is_correct))

    identity = PackIdentity(release.version_code, (("pack_sha256", release.pack_sha256),))
    items, item_ids, option_ids = [], {}, {}
    for item_id, external, stem, batch, twin_group, target, topic_name in item_rows:
        rows = options.get(str(item_id), [])
        if [r[1] for r in rows] != ["A", "B", "C", "D"] or sum(1 for r in rows if r[3]) != 1:
            raise ReleaseError(f"item {external}: expected options A-D with exactly one correct")
        item_ids[external] = str(item_id)
        for option_id, label, _, _ in rows:
            option_ids[(external, label)] = option_id
        item = Item(
            item_id=external,
            option_ids=tuple(r[1] for r in rows),
            correct_index=next(i for i, r in enumerate(rows) if r[3]),
            links=tuple(tuple(m for m, _ in links.get(r[0], [])) for r in rows),
            link_grades=tuple(tuple(g for _, g in links.get(r[0], [])) for r in rows),
            twin_group=twin_group,
        )
        items.append(PackItem(item, stem, tuple(r[2] for r in rows), target, topic_name, batch))
    unit = Unit(unit_code, unit_name, hypotheses, tuple(items), identity)
    if unit.hyps[-2:] != (NONE, UNMODELLED) or not items:
        raise ReleaseError(f"unit {unit_code}: not usable by the engine")
    return unit, UnitIndex(unit_row_id, hypothesis_ids, item_ids, option_ids)


def engine_code_hash() -> str:
    """SHA-256 over the engine package's source files (names and LF-normalised content)."""

    digest = hashlib.sha256()
    for path in sorted(Path(sonder_engine.__file__).resolve().parent.glob("*.py")):
        digest.update(path.name.encode("utf-8") + b"\0")
        digest.update(path.read_bytes().replace(b"\r\n", b"\n") + b"\0")
    return digest.hexdigest()


def register_engine_release(conn: psycopg.Connection) -> tuple[str, str]:
    """Record the running engine build once; return (engine_release.id, release_code)."""

    code_hash = engine_code_hash()
    release_code = f"{sonder_engine.__version__}+{code_hash[:12]}"
    conn.execute("INSERT INTO sonder.engine_release (release_code, code_hash, selection_policy) "
                 "VALUES (%s, %s, %s) ON CONFLICT (release_code) DO NOTHING",
                 (release_code, code_hash, SELECTION_POLICY))
    row = conn.execute("SELECT id FROM sonder.engine_release WHERE release_code = %s", (release_code,)).fetchone()
    return str(row[0]), release_code
