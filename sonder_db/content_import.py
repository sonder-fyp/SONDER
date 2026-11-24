"""Content importer: load a Maths pack into the content tables as a DRAFT candidate version.

    python -m sonder_db.content_import plan   [--root data/Maths_v2]
    python -m sonder_db.content_import import --author-email EMAIL [--root ...] [--version-code CODE] [--dry-run]
    python -m sonder_db.content_import verify [--root ...] [--version-code CODE]

What it does (work-division tasks I2-H14 and I2-H15):

* ``plan`` reads ``bank/items.csv``, ``topics.csv`` and the unit table, checks them against the
  database's own rules (four options, one correct, no link on the correct option, known IDs) and
  against the engine's pack loader, and prints what an import would write. It never touches a database.
* ``import`` writes the catalogue, items, options, links, twin groups, hypotheses, diagnostic units
  and their item order in ONE transaction, then verifies the rows against the source before it commits.
  With ``--dry-run`` the transaction is rolled back at the end, so database rejections show up without
  keeping anything.
* ``verify`` compares the stored version with the source files, field by field, and exits non-zero
  on any difference.

What it deliberately does NOT do:

* It never records a review, never approves an item and never freezes the version. The content is
  owner-approved only; the database lets an item be approved only through a review by someone who is
  not its author, and no external Maths expert has reviewed anything. Items stay ``draft``.
* It never edits a frozen version, and never changes an existing version whose source hash differs
  (import under a new ``--version-code`` instead).
* It does not build response models or engine parameters (they need approved items).

The release identity is the SHA-256 of ``bank/items.csv`` with CRLF converted to LF (so it is the same
on every platform), stored in ``content_version.pack_sha256``. The hashes of ``topics.csv`` and the unit
table are written into the version's note.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import sys
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path

from sonder_engine.pack import PackError, derive_twin_groups
from sonder_pack.maths_v2 import DEFAULT_CONFIG, DEFAULT_ROOT, load_maths_v2

from . import database_url, describe_error

SUBJECT_CODE = "MATH"
SUBJECT_NAME = "Mathematics"
LABELS = ("A", "B", "C", "D")
ASSISTANCE_NOTE = ("Drafted by an LLM in batches; reviewed and approved by the dataset owner. "
                   "Not reviewed by an external Maths expert (see data/Maths_v2/MANIFEST.md).")
LINK_RATIONALE = ("Imported from bank/items.csv; the source has no per-link rationale "
                  "(see data/Maths_v2/MANIFEST.md and the decision ledger).")
VERSION_NOTE = ("Candidate import of {code}: owner-approved, NOT reviewed by an external Maths expert, "
                "not frozen. source sha256 (CRLF->LF) bank/items.csv {items}; topics.csv {topics}; "
                "unit table {units}.")
LOCK_KEY = 7120430017  # advisory lock so two imports cannot interleave


class ImportRefused(RuntimeError):
    """The import cannot proceed; the message says why and what to do."""


# --------------------------------------------------------------------------- source
@dataclass(frozen=True)
class OptionRow:
    label: str
    text: str
    correct: bool
    links: tuple[str, ...]


@dataclass(frozen=True)
class ItemRow:
    item_id: str
    topic_prefix: str
    bank_label: str
    target: str
    stem: str
    batch: str
    options: tuple[OptionRow, ...]


@dataclass(frozen=True)
class MisconceptionRow:
    misconception_id: str
    name: str
    home_prefix: str
    target_minimum: int
    old_topic_label: str
    comments: str


@dataclass(frozen=True)
class UnitRow:
    unit_id: str
    name: str
    hypotheses: tuple[str, ...]   # misconception IDs in slot order 0..k-1
    items: tuple[str, ...]        # item IDs in pack order 0..n-1


@dataclass(frozen=True)
class Source:
    root: Path
    version_code: str
    topics: "OrderedDict[str, str]"           # prefix -> topic name
    misconceptions: tuple[MisconceptionRow, ...]
    items: tuple[ItemRow, ...]
    twin_groups: dict[str, str]
    units: tuple[UnitRow, ...]
    unplaced: tuple[str, ...]
    sha_items: str
    sha_topics: str
    sha_units: str

    @property
    def pack_sha256(self) -> str:
        return self.sha_items


def lf_sha256(path: Path) -> str:
    """SHA-256 of a file with every CRLF converted to LF (the same value on every platform)."""

    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def _read_csv(path: Path) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8-sig"), newline="")))


def check_rows(bank: list[dict[str, str]], topics: list[dict[str, str]]) -> list[str]:
    """Problems that the database would reject or that make the import meaningless. Empty = fine."""

    problems: list[str] = []
    known = {t["MisconceptionId"] for t in topics}
    prefixes = {t["topic"].split(" ")[0] for t in topics}
    if len(known) != len(topics):
        problems.append("topics.csv: a MisconceptionId is listed twice")
    by_item: "OrderedDict[str, list[dict[str, str]]]" = OrderedDict()
    for r in bank:
        by_item.setdefault(r["item_id"], []).append(r)
    for item_id, rows in by_item.items():
        where = f"item {item_id}"
        prefix = item_id.split("-")[0]
        if prefix not in prefixes:
            problems.append(f"{where}: topic prefix {prefix} is not in topics.csv")
        labels = [r["option_id"] for r in rows]
        if sorted(labels) != list(LABELS):
            problems.append(f"{where}: options must be exactly A, B, C, D (found {labels})")
        if len({r["option_text"] for r in rows}) != len(rows):
            problems.append(f"{where}: two options have the same text")
        if sum(r["is_correct"] == "True" for r in rows) != 1:
            problems.append(f"{where}: needs exactly one correct option")
        for field in ("stem", "target", "batch", "topic"):
            if len({r[field] for r in rows}) != 1:
                problems.append(f"{where}: rows disagree on {field}")
        if rows[0]["target"] not in known:
            problems.append(f"{where}: target {rows[0]['target']} is not in topics.csv")
        if not rows[0]["stem"].strip():
            problems.append(f"{where}: empty stem")
        for r in rows:
            links = [m for m in r["misconceptions"].split("|") if m]
            if r["is_correct"] == "True" and links:
                problems.append(f"{where} option {r['option_id']}: the correct option has links")
            if len(links) > 3:
                problems.append(f"{where} option {r['option_id']}: more than three links")
            if len(set(links)) != len(links):
                problems.append(f"{where} option {r['option_id']}: a misconception is listed twice")
            for m in links:
                if m not in known:
                    problems.append(f"{where} option {r['option_id']}: unknown misconception {m}")
    return problems


def read_source(root: Path = DEFAULT_ROOT, config: Path = DEFAULT_CONFIG) -> Source:
    """Read and check a pack. Raises ImportRefused listing every problem, or the engine's PackError."""

    root = Path(root)
    bank = _read_csv(root / "bank" / "items.csv")
    topics = _read_csv(root / "topics.csv")
    problems = check_rows(bank, topics)
    if problems:
        raise ImportRefused("the source fails the importer's checks:\n  " + "\n  ".join(problems))
    pack = load_maths_v2(root, config)  # the engine's own loader: the database and the engine must agree
    topic_names: "OrderedDict[str, str]" = OrderedDict()
    home: dict[str, str] = {}
    for t in topics:
        prefix = t["topic"].split(" ")[0]
        topic_names[prefix] = t["topic"]
        home[t["MisconceptionId"]] = prefix
    misconceptions = tuple(
        MisconceptionRow(t["MisconceptionId"], t["MisconceptionName"].strip(), home[t["MisconceptionId"]],
                         int(t["target_questions"]), t["old_topic_label"], t["comments"]) for t in topics)
    grouped: "OrderedDict[str, list[dict[str, str]]]" = OrderedDict()
    for r in bank:
        grouped.setdefault(r["item_id"], []).append(r)
    items = tuple(
        ItemRow(i, i.split("-")[0], rows[0]["topic"], rows[0]["target"], rows[0]["stem"], rows[0]["batch"],
                tuple(OptionRow(o["option_id"], o["option_text"], o["is_correct"] == "True",
                                tuple(m for m in o["misconceptions"].split("|") if m))
                      for o in sorted(rows, key=lambda x: x["option_id"])))
        for i, rows in grouped.items())
    units = tuple(UnitRow(u.unit_id, u.name, tuple(h.misconception_id for h in u.hypotheses),
                          tuple(p.item.item_id for p in u.items)) for u in pack.units)
    return Source(root, pack.identity.content_version, topic_names, misconceptions, items,
                  derive_twin_groups(bank), units, tuple(p.item.item_id for p in pack.unplaced),
                  lf_sha256(root / "bank" / "items.csv"), lf_sha256(root / "topics.csv"), lf_sha256(Path(config)))


def describe(source: Source) -> str:
    """The plan: what an import would write."""

    links = sum(len(o.links) for i in source.items for o in i.options)
    cross = sorted({(i.topic_prefix, i.target) for i in source.items
                    if next(m for m in source.misconceptions if m.misconception_id == i.target).home_prefix != i.topic_prefix})
    lines = [f"version {source.version_code}  (draft candidate; no review rows; never frozen)",
             f"  topics {len(source.topics)}, misconceptions {len(source.misconceptions)}, items {len(source.items)}, "
             f"options {sum(len(i.options) for i in source.items)}, links {links}, twin items {len(source.twin_groups)} "
             f"in {len(set(source.twin_groups.values()))} groups, cross-topic target memberships {len(cross)}",
             f"  sha256 bank/items.csv {source.sha_items}", f"  sha256 topics.csv     {source.sha_topics}",
             f"  sha256 unit table     {source.sha_units}"]
    for u in source.units:
        lines.append(f"  unit {u.unit_id} {u.name}: k = {len(u.hypotheses)}, items {len(u.items)}")
    lines.append(f"  items in no unit: {', '.join(source.unplaced) or 'none'}")
    return "\n".join(lines)


# --------------------------------------------------------------------------- database
def _ids(conn, sql, params=()):
    return conn.execute(sql, params).fetchall()


def _find_version(conn, subject_id, code):
    row = conn.execute("SELECT id, status, pack_sha256 FROM content_version WHERE subject_id = %s AND version_code = %s",
                       (subject_id, code)).fetchone()
    return row


def _author(conn, email: str):
    row = conn.execute("SELECT id, role FROM app_user WHERE lower(email) = lower(%s)", (email,)).fetchone()
    if row is None:
        raise ImportRefused("no app_user with that e-mail exists; create the account first (the importer does not provision accounts)")
    if row[1] not in ("admin", "teacher"):
        raise ImportRefused(f"the author account has role {row[1]!r}; the database accepts items only from an admin or teacher")
    return row[0]


def _get_or_create(conn, table: str, where: str, where_params: tuple, insert_sql: str, insert_params: tuple):
    row = conn.execute(f"SELECT id FROM {table} WHERE {where}", where_params).fetchone()
    return row[0] if row else conn.execute(insert_sql, insert_params).fetchone()[0]


def _write(conn, source: Source, author_id, version_code: str, note: str, assistance_note: str) -> str:
    # subject, topic and misconception rows are append-only (the database rejects any update), so look
    # first and insert only what is missing; the advisory lock keeps two imports from racing.
    subject_id = _get_or_create(conn, "subject", "code = %s", (SUBJECT_CODE,),
                                "INSERT INTO subject (code, name) VALUES (%s, %s) RETURNING id", (SUBJECT_CODE, SUBJECT_NAME))
    cv = conn.execute("INSERT INTO content_version (subject_id, version_code, note, pack_sha256) VALUES (%s, %s, %s, %s) RETURNING id",
                      (subject_id, version_code, note, source.pack_sha256)).fetchone()[0]
    topic_rev: dict[str, object] = {}
    for prefix, name in source.topics.items():
        tid = _get_or_create(conn, "topic", "subject_id = %s AND external_id = %s", (subject_id, prefix),
                             "INSERT INTO topic (subject_id, external_id) VALUES (%s, %s) RETURNING id", (subject_id, prefix))
        topic_rev[prefix] = conn.execute("INSERT INTO topic_revision (topic_id, content_version_id, name) VALUES (%s, %s, %s) RETURNING id",
                                         (tid, cv, name)).fetchone()[0]
    mis_rev: dict[str, object] = {}
    for m in source.misconceptions:
        mid = _get_or_create(conn, "misconception", "subject_id = %s AND external_id = %s", (subject_id, m.misconception_id),
                             "INSERT INTO misconception (subject_id, code, external_id) VALUES (%s, %s, %s) RETURNING id",
                             (subject_id, m.misconception_id.split("-")[1], m.misconception_id))
        mis_rev[m.misconception_id] = conn.execute(
            "INSERT INTO misconception_revision (misconception_id, content_version_id, name, description, status, engine_tier) "
            "VALUES (%s, %s, %s, %s, 'validated', 1) RETURNING id", (mid, cv, m.name, m.name)).fetchone()[0]
        conn.execute("INSERT INTO topic_misconception (topic_revision_id, misconception_revision_id, membership, target_minimum, old_topic_label, review_note) "
                     "VALUES (%s, %s, 'home', %s, %s, %s)",
                     (topic_rev[m.home_prefix], mis_rev[m.misconception_id], m.target_minimum, m.old_topic_label, m.comments))
    home = {m.misconception_id: m.home_prefix for m in source.misconceptions}
    for prefix, target, label in sorted({(i.topic_prefix, i.target, i.bank_label) for i in source.items if home[i.target] != i.topic_prefix}):
        conn.execute("INSERT INTO topic_misconception (topic_revision_id, misconception_revision_id, membership, target_minimum, review_note) "
                     "VALUES (%s, %s, 'cross_topic', NULL, %s) ON CONFLICT DO NOTHING",
                     (topic_rev[prefix], mis_rev[target], f"Cross-topic target in the source (bank label: {label})"))
    hyp: dict[str, object] = {}
    for m in source.misconceptions:
        hyp[m.misconception_id] = conn.execute("INSERT INTO hypothesis (content_version_id, kind, misconception_revision_id) "
                                               "VALUES (%s, 'misconception', %s) RETURNING id", (cv, mis_rev[m.misconception_id])).fetchone()[0]
    for kind in ("none", "unmodelled"):
        conn.execute("INSERT INTO hypothesis (content_version_id, kind) VALUES (%s, %s)", (cv, kind))
    item_db: dict[str, object] = {}
    for it in source.items:
        item_db[it.item_id] = iid = conn.execute(
            "INSERT INTO item (topic_revision_id, target_misconception_revision_id, external_id, stem, batch, origin, author_id, "
            "llm_assisted, assistance_note, twin_group) VALUES (%s, %s, %s, %s, %s, 'authored', %s, true, %s, %s) RETURNING id",
            (topic_rev[it.topic_prefix], mis_rev[it.target], it.item_id, it.stem, it.batch, author_id, assistance_note,
             source.twin_groups.get(it.item_id))).fetchone()[0]
        for o in it.options:
            oid = conn.execute("INSERT INTO item_option (item_id, label, option_text, is_correct) VALUES (%s, %s, %s, %s) RETURNING id",
                               (iid, o.label, o.text, o.correct)).fetchone()[0]
            for link in o.links:
                conn.execute("INSERT INTO option_misconception (option_id, misconception_revision_id, rationale) VALUES (%s, %s, %s)",
                             (oid, mis_rev[link], LINK_RATIONALE))
    for u in source.units:
        uid = conn.execute("INSERT INTO diagnostic_unit (content_version_id, unit_code, name) VALUES (%s, %s, %s) RETURNING id",
                           (cv, u.unit_id, u.name)).fetchone()[0]
        for slot, m in enumerate(u.hypotheses):
            conn.execute("INSERT INTO unit_hypothesis (unit_id, hypothesis_id, slot) VALUES (%s, %s, %s)", (uid, hyp[m], slot))
        for pos, i in enumerate(u.items):
            conn.execute("INSERT INTO unit_item (unit_id, item_id, position) VALUES (%s, %s, %s)", (uid, item_db[i], pos))
    return cv


def verify_version(conn, source: Source, version_code: str | None = None) -> list[str]:
    """Differences between the stored version and the source. Empty = identical."""

    code = version_code or source.version_code
    diffs: list[str] = []
    row = conn.execute("SELECT c.id, c.status, c.pack_sha256 FROM content_version c JOIN subject s ON s.id = c.subject_id "
                       "WHERE s.code = %s AND c.version_code = %s", (SUBJECT_CODE, code)).fetchone()
    if row is None:
        return [f"version {code} is not in the database"]
    cv, status, sha = row
    if sha != source.pack_sha256:
        diffs.append(f"pack_sha256 differs: database {sha}, source {source.pack_sha256}")

    def one(label, got, want):
        if got != want:
            diffs.append(f"{label}: database {got!r}, source {want!r}")

    topics = {r[0]: r[1] for r in conn.execute(
        "SELECT t.external_id, tr.name FROM topic_revision tr JOIN topic t ON t.id = tr.topic_id WHERE tr.content_version_id = %s", (cv,))}
    one("topics", topics, dict(source.topics))
    mis = {r[0]: (r[1], r[2], r[3]) for r in conn.execute(
        "SELECT m.external_id, mr.name, tp.external_id, x.target_minimum FROM misconception_revision mr JOIN misconception m ON m.id = mr.misconception_id "
        "JOIN topic_misconception x ON x.misconception_revision_id = mr.id AND x.membership = 'home' "
        "JOIN topic_revision tr ON tr.id = x.topic_revision_id JOIN topic tp ON tp.id = tr.topic_id WHERE mr.content_version_id = %s", (cv,))}
    one("misconceptions (id, name, home topic, target minimum)", mis,
        {m.misconception_id: (m.name, m.home_prefix, m.target_minimum) for m in source.misconceptions})
    stored: dict[str, tuple] = {}
    for r in conn.execute(
            "SELECT i.external_id, tp.external_id, tm.external_id, i.stem, i.batch, i.twin_group, i.review_status, i.llm_assisted, i.id "
            "FROM item i JOIN topic_revision tr ON tr.id = i.topic_revision_id JOIN topic tp ON tp.id = tr.topic_id "
            "JOIN misconception_revision mr ON mr.id = i.target_misconception_revision_id JOIN misconception tm ON tm.id = mr.misconception_id "
            "WHERE tr.content_version_id = %s", (cv,)):
        stored[r[0]] = r
    one("item IDs", sorted(stored), sorted(i.item_id for i in source.items))
    for it in source.items:
        r = stored.get(it.item_id)
        if r is None:
            continue
        one(f"{it.item_id} topic/target/stem/batch/twin group", tuple(r[1:6]),
            (it.topic_prefix, it.target, it.stem, it.batch, source.twin_groups.get(it.item_id)))
        if status == "draft" and r[6] != "draft":
            diffs.append(f"{it.item_id}: review_status is {r[6]!r} in a draft candidate")
        opts = {o[0]: (o[1], o[2], tuple(sorted(o[3] or []))) for o in conn.execute(
            "SELECT o.label, o.option_text, o.is_correct, array_agg(m.external_id) FILTER (WHERE m.external_id IS NOT NULL) "
            "FROM item_option o LEFT JOIN option_misconception om ON om.option_id = o.id "
            "LEFT JOIN misconception_revision mr ON mr.id = om.misconception_revision_id LEFT JOIN misconception m ON m.id = mr.misconception_id "
            "WHERE o.item_id = %s GROUP BY o.id, o.label, o.option_text, o.is_correct", (r[8],))}
        one(f"{it.item_id} options (text, correct, links)", opts,
            {o.label: (o.text, o.correct, tuple(sorted(o.links))) for o in it.options})
    units = {}
    for uid, ucode, uname in conn.execute("SELECT id, unit_code, name FROM diagnostic_unit WHERE content_version_id = %s", (cv,)):
        hyps = [x[0] for x in conn.execute("SELECT m.external_id FROM unit_hypothesis uh JOIN hypothesis h ON h.id = uh.hypothesis_id "
                                           "JOIN misconception_revision mr ON mr.id = h.misconception_revision_id JOIN misconception m ON m.id = mr.misconception_id "
                                           "WHERE uh.unit_id = %s ORDER BY uh.slot", (uid,))]
        its = [x[0] for x in conn.execute("SELECT i.external_id FROM unit_item ui JOIN item i ON i.id = ui.item_id WHERE ui.unit_id = %s ORDER BY ui.position", (uid,))]
        units[ucode] = (uname, tuple(hyps), tuple(its))
    one("units (name, hypotheses in slot order, items in position order)", units,
        {u.unit_id: (u.name, u.hypotheses, u.items) for u in source.units})
    n = conn.execute("SELECT count(*) FROM hypothesis WHERE content_version_id = %s AND kind IN ('none','unmodelled')", (cv,)).fetchone()[0]
    one("NONE and UNMODELLED hypotheses", n, 2)
    reviews = conn.execute("SELECT count(*) FROM item_review r JOIN item i ON i.id = r.item_id JOIN topic_revision tr ON tr.id = i.topic_revision_id "
                           "WHERE tr.content_version_id = %s", (cv,)).fetchone()[0]
    if status == "draft" and reviews:
        diffs.append(f"{reviews} review rows exist on a candidate that must have none")
    return diffs


def import_content(url: str, source: Source, author_email: str, *, version_code: str | None = None,
                   dry_run: bool = False, assistance_note: str = ASSISTANCE_NOTE) -> tuple[str, str]:
    """Import ``source``. Returns (outcome, detail); outcome is 'imported', 'dry-run ok' or 'unchanged'."""

    import psycopg

    code = version_code or source.version_code
    note = VERSION_NOTE.format(code=code, items=source.sha_items, topics=source.sha_topics, units=source.sha_units)
    with psycopg.connect(url) as conn:
        conn.execute("SET LOCAL search_path = sonder, public")
        conn.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_KEY,))
        author_id = _author(conn, author_email)
        subject = conn.execute("SELECT id FROM subject WHERE code = %s", (SUBJECT_CODE,)).fetchone()
        existing = _find_version(conn, subject[0], code) if subject else None
        if existing:
            _, status, sha = existing
            if status == "frozen":
                raise ImportRefused(f"version {code} is frozen and immutable; import under a new --version-code")
            if sha != source.pack_sha256:
                raise ImportRefused(f"version {code} already exists with a different source hash ({sha}); "
                                    f"nothing was changed. Import under a new --version-code")
            diffs = verify_version(conn, source, code)
            if diffs:
                raise ImportRefused(f"version {code} exists with the same hash but its rows differ from the source:\n  " + "\n  ".join(diffs))
            return "unchanged", f"version {code} is already imported and verified (hash {sha[:12]}...)"
        _write(conn, source, author_id, code, note, assistance_note)
        conn.execute("SET CONSTRAINTS ALL IMMEDIATE")  # fire the deferred item checks before we trust the data
        diffs = verify_version(conn, source, code)
        if diffs:
            conn.rollback()
            raise ImportRefused("the rows written do not match the source; rolled back:\n  " + "\n  ".join(diffs))
        if dry_run:
            conn.rollback()
            return "dry-run ok", f"every row was accepted by the database and matched the source; rolled back (hash {source.sha_items[:12]}...)"
        conn.commit()
    return "imported", f"version {code} imported as a draft candidate (hash {source.sha_items[:12]}...)"


def verify_content(url: str, source: Source, version_code: str | None = None) -> list[str]:
    import psycopg

    with psycopg.connect(url) as conn:
        conn.execute("SET LOCAL search_path = sonder, public")
        return verify_version(conn, source, version_code)


# --------------------------------------------------------------------------- command line
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m sonder_db.content_import", description=__doc__.split("\n\n")[0])
    parser.add_argument("command", choices=("plan", "import", "verify"))
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="directory with bank/items.csv and topics.csv")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="unit table (JSON)")
    parser.add_argument("--database-url", default=None, help="default: SONDER_DATABASE_URL")
    parser.add_argument("--author-email", default=None, help="e-mail of an existing admin or teacher account recorded as item author")
    parser.add_argument("--version-code", default=None, help="default: the pack's content version")
    parser.add_argument("--dry-run", action="store_true", help="import: do everything, then roll back")
    args = parser.parse_args(argv)
    try:
        source = read_source(args.root, args.config)
    except (ImportRefused, PackError, OSError, KeyError) as exc:
        print(f"REFUSED {exc}", file=sys.stderr)
        return 1
    if args.command == "plan":
        print(describe(source))
        return 0
    try:
        url = database_url(args.database_url)
        if args.command == "verify":
            diffs = verify_content(url, source, args.version_code)
            print("verified: the database matches the source" if not diffs else "MISMATCH\n  " + "\n  ".join(diffs))
            return 0 if not diffs else 1
        if not args.author_email:
            print("REFUSED --author-email is required for import", file=sys.stderr)
            return 2
        outcome, detail = import_content(url, source, args.author_email, version_code=args.version_code, dry_run=args.dry_run)
        print(f"{outcome}: {detail}")
        return 0
    except ImportRefused as exc:
        print(f"REFUSED {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # database errors are reported without secrets
        print(f"FAILED {describe_error(exc)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
