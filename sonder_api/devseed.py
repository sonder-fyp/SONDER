"""DEVELOPMENT FIXTURE: load one Maths_v2 unit into the database as a frozen candidate release.

    SONDER_ALLOW_DEV_SEED=true python -m sonder_api.devseed [--enrol-email student@example.org]

This exists so the persistent session service (I2-L01 to I2-L06) can be developed and
tested before the real content importer (I2-H14 to I2-H16, owner Harris) is merged. It is
NOT that importer: accounts are synthetic placeholders, review attribution is a stand-in,
only one unit is loaded, and the release is labelled a development candidate that no
expert has accepted. Never run it against a database that holds real records.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from dataclasses import asdict
from pathlib import Path

import psycopg

from sonder_db import database_url, describe_error, num
from sonder_engine.bayes import likelihood_matrix
from sonder_engine.model import Params
from sonder_pack.maths_v2 import DEFAULT_CONFIG, DEFAULT_ROOT, load_maths_v2, read_csv_rows

ALLOW_ENV = "SONDER_ALLOW_DEV_SEED"
SUBJECT_CODE, SUBJECT_NAME = "MATH", "Mathematics"
DEFAULT_VERSION = "Maths_v2-U1-dev"
DEFAULT_MODEL = "spec-v2-prior"
CLASS_JOIN_CODE = "DEVSEED01"
AUTHOR = ("dev-author@sonder.invalid", "admin", "Dev seed author (placeholder)")
REVIEWER = ("dev-reviewer@sonder.invalid", "admin", "Dev seed reviewer (placeholder)")
TEACHER = ("dev-teacher@sonder.invalid", "teacher", "Dev seed teacher (placeholder)")
NOTE = ("DEVELOPMENT CANDIDATE: one unit of data/Maths_v2 loaded by sonder_api.devseed for "
        "persistence development. Not expert accepted. Not the content importer (I2-H14).")


def params_sha256(params: Params) -> str:
    """Identity of a parameter set: SHA-256 of its fields as canonical JSON."""

    return hashlib.sha256(json.dumps(asdict(params), sort_keys=True).encode("utf-8")).hexdigest()


def source_sha256(root: Path = DEFAULT_ROOT) -> str:
    """SHA-256 of bank/items.csv with CRLF normalised to LF (equal on every platform)."""

    data = (root / "bank" / "items.csv").read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def _user(cur, email: str, role: str, name: str) -> str:
    cur.execute("INSERT INTO sonder.app_user (email, role, display_name) VALUES (%s, %s, %s) "
                "ON CONFLICT (email) DO NOTHING", (email, role, name))
    cur.execute("SELECT id, role FROM sonder.app_user WHERE email = %s", (email,))
    user_id, actual = cur.fetchone()
    if actual != role:
        raise RuntimeError(f"{email} already exists with role {actual}, expected {role}")
    return str(user_id)


def _one(cur, sql: str, args: tuple) -> str:
    cur.execute(sql, args)
    return str(cur.fetchone()[0])


def _seed_release(cur, *, unit_id: str, version_code: str, model_code: str, params: Params,
                  root: Path, config: Path, author: str, reviewer: str, subject: str) -> None:
    pack = load_maths_v2(root, config, params)
    unit = pack.unit(unit_id)
    topics = {row["MisconceptionId"].strip(): row for row in read_csv_rows(root / "topics.csv")}
    topic_label = unit.hypotheses[0].home_topic
    topic_code = topic_label.split(" ")[0]
    for h in unit.hypotheses:
        if h.companion or h.home_topic != topic_label:
            raise RuntimeError(f"devseed supports single-topic units only; {h.misconception_id} is a companion")

    version = _one(cur, "INSERT INTO sonder.content_version (subject_id, version_code, note) "
                        "VALUES (%s, %s, %s) RETURNING id", (subject, version_code, NOTE))
    cur.execute("INSERT INTO sonder.topic (subject_id, external_id) VALUES (%s, %s) "
                "ON CONFLICT (subject_id, external_id) DO NOTHING", (subject, topic_code))
    topic = _one(cur, "SELECT id FROM sonder.topic WHERE subject_id = %s AND external_id = %s",
                 (subject, topic_code))
    topic_revision = _one(cur, "INSERT INTO sonder.topic_revision (topic_id, content_version_id, name) "
                               "VALUES (%s, %s, %s) RETURNING id", (topic, version, topic_label))

    revision: dict[str, str] = {}  # misconception external id -> misconception_revision id
    for h in unit.hypotheses:
        mid = h.misconception_id
        cur.execute("INSERT INTO sonder.misconception (subject_id, code, external_id) VALUES (%s, %s, %s) "
                    "ON CONFLICT (subject_id, external_id) DO NOTHING", (subject, mid.split("-")[1], mid))
        misconception = _one(cur, "SELECT id FROM sonder.misconception WHERE subject_id = %s AND external_id = %s",
                             (subject, mid))
        revision[mid] = _one(
            cur, "INSERT INTO sonder.misconception_revision (misconception_id, content_version_id, name, "
                 "description, status, engine_tier) VALUES (%s, %s, %s, %s, 'validated', 1) RETURNING id",
            (misconception, version, h.name, h.name))
        cur.execute(
            "INSERT INTO sonder.topic_misconception (topic_revision_id, misconception_revision_id, membership, "
            "target_minimum, old_topic_label, review_note) VALUES (%s, %s, 'home', %s, %s, %s)",
            (topic_revision, revision[mid], int(topics[mid]["target_questions"]),
             topics[mid]["old_topic_label"], topics[mid]["comments"]))

    option_id: dict[tuple[str, str], str] = {}  # (item external id, label) -> item_option id
    item_id: dict[str, str] = {}
    assistance = "Generated by an LLM in batches and approved by Harris (data/Maths_v2/MANIFEST.md)"
    for p in unit.items:
        item = p.item
        item_id[item.item_id] = _one(
            cur, "INSERT INTO sonder.item (topic_revision_id, target_misconception_revision_id, external_id, stem, "
                 "batch, origin, author_id, llm_assisted, assistance_note, twin_group) "
                 "VALUES (%s, %s, %s, %s, %s, 'authored', %s, true, %s, %s) RETURNING id",
            (topic_revision, revision[p.target_misconception_id], item.item_id, p.stem, p.batch,
             author, assistance, item.twin_group))
        for index, label in enumerate(item.option_ids):
            option_id[(item.item_id, label)] = _one(
                cur, "INSERT INTO sonder.item_option (item_id, label, option_text, is_correct) "
                     "VALUES (%s, %s, %s, %s) RETURNING id",
                (item_id[item.item_id], label, p.option_texts[index], index == item.correct_index))
            for linked, grade in zip(item.links[index], item.link_grades[index]):
                cur.execute(
                    "INSERT INTO sonder.option_misconception (option_id, misconception_revision_id, rationale, "
                    "link_grade) VALUES (%s, %s, %s, %s)",
                    (option_id[(item.item_id, label)], revision[linked],
                     "Imported from bank/items.csv (the source has no per-link rationale)", grade))
    cur.execute("SET CONSTRAINTS ALL IMMEDIATE")  # four options, one correct, link limits: checked now
    cur.execute("SET CONSTRAINTS ALL DEFERRED")
    for external in item_id:
        cur.execute("UPDATE sonder.item SET review_status = 'in_review' WHERE id = %s", (item_id[external],))
        cur.execute("INSERT INTO sonder.item_review (item_id, review_round, reviewer_id, decision, note) "
                    "VALUES (%s, 1, %s, 'approved', %s)",
                    (item_id[external], reviewer, "Dev seed: placeholder for the recorded approval"))

    hypothesis: dict[str, str] = {}  # engine hypothesis name -> hypothesis id
    for mid in revision:
        hypothesis[mid] = _one(cur, "INSERT INTO sonder.hypothesis (content_version_id, kind, "
                                    "misconception_revision_id) VALUES (%s, 'misconception', %s) RETURNING id",
                               (version, revision[mid]))
    for name, kind in (("NONE", "none"), ("UNMODELLED", "unmodelled")):
        hypothesis[name] = _one(cur, "INSERT INTO sonder.hypothesis (content_version_id, kind) "
                                     "VALUES (%s, %s) RETURNING id", (version, kind))
    unit_row = _one(cur, "INSERT INTO sonder.diagnostic_unit (content_version_id, unit_code, name) "
                         "VALUES (%s, %s, %s) RETURNING id", (version, unit.unit_id, unit.name))
    for slot, h in enumerate(unit.hypotheses):
        cur.execute("INSERT INTO sonder.unit_hypothesis (unit_id, hypothesis_id, slot) VALUES (%s, %s, %s)",
                    (unit_row, hypothesis[h.misconception_id], slot))
    for position, p in enumerate(unit.items):
        cur.execute("INSERT INTO sonder.unit_item (unit_id, item_id, position) VALUES (%s, %s, %s)",
                    (unit_row, item_id[p.item.item_id], position))
    cur.execute("UPDATE sonder.content_version SET pack_sha256 = %s, status = 'frozen' WHERE id = %s",
                (source_sha256(root), version))

    digest = params_sha256(params)
    fields = asdict(params)
    integers = {"min_support", "min_support_none", "default_budget", "k_max"}
    columns = list(fields)
    cur.execute(
        f"INSERT INTO sonder.engine_params (params_version, params_sha256, {', '.join(columns)}) "
        f"VALUES (%s, %s, {', '.join(['%s'] * len(columns))}) ON CONFLICT (params_sha256) DO NOTHING",
        (f"assumed-{digest[:12]}", digest,
         *[fields[c] if c in integers else num(fields[c]) for c in columns]))
    engine_params = _one(cur, "SELECT id FROM sonder.engine_params WHERE params_sha256 = %s", (digest,))
    model = _one(cur, "INSERT INTO sonder.response_model (content_version_id, engine_params_id, model_code, source, "
                      "calibration_note) VALUES (%s, %s, %s, 'prior', %s) RETURNING id",
                 (version, engine_params, model_code,
                  "Spec v2 section 3.1 likelihood from assumed parameters; not calibrated on student answers"))
    rows = []
    for p in unit.items:
        matrix = likelihood_matrix(p.item, unit.hyps, params)  # rows: hypotheses, columns: options A-D
        for h_index, name in enumerate(unit.hyps):
            for o_index, label in enumerate(p.item.option_ids):
                rows.append((model, hypothesis[name], option_id[(p.item.item_id, label)],
                             num(float(matrix[h_index][o_index]))))
    cur.executemany("INSERT INTO sonder.response_probability (response_model_id, hypothesis_id, option_id, "
                    "probability) VALUES (%s, %s, %s, %s)", rows)
    cur.execute("UPDATE sonder.response_model SET status = 'frozen' WHERE id = %s", (model,))


def seed(conn: psycopg.Connection, *, unit_id: str = "U1", version_code: str = DEFAULT_VERSION,
         model_code: str = DEFAULT_MODEL, params: Params | None = None, root: Path = DEFAULT_ROOT,
         config: Path = DEFAULT_CONFIG, enrol_emails: tuple[str, ...] = (),
         synthetic_students: int = 2) -> dict[str, object]:
    """Seed everything in one transaction; safe to repeat. Returns the IDs a caller needs."""

    params = Params() if params is None else params
    with conn.transaction(), conn.cursor() as cur:
        author, reviewer, teacher = (_user(cur, *who) for who in (AUTHOR, REVIEWER, TEACHER))
        cur.execute("SELECT set_config('sonder.actor_id', %s, true)", (author,))
        cur.execute("INSERT INTO sonder.subject (code, name) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING",
                    (SUBJECT_CODE, SUBJECT_NAME))
        subject = _one(cur, "SELECT id FROM sonder.subject WHERE code = %s", (SUBJECT_CODE,))

        cur.execute("SELECT status FROM sonder.content_version WHERE subject_id = %s AND version_code = %s",
                    (subject, version_code))
        existing = cur.fetchone()
        if existing is None:
            _seed_release(cur, unit_id=unit_id, version_code=version_code, model_code=model_code, params=params,
                          root=root, config=config, author=author, reviewer=reviewer, subject=subject)
        elif existing[0] != "frozen":
            raise RuntimeError(f"content version {version_code} exists but is not frozen; drop the database")

        cur.execute("INSERT INTO sonder.classroom (name, note, join_code) VALUES (%s, %s, %s) "
                    "ON CONFLICT (join_code) DO NOTHING",
                    ("Development class (seed)", "Created by sonder_api.devseed; stands in for I2-H09/H10",
                     CLASS_JOIN_CODE))
        classroom = _one(cur, "SELECT id FROM sonder.classroom WHERE join_code = %s", (CLASS_JOIN_CODE,))
        cur.execute("INSERT INTO sonder.class_subject (class_id, subject_id) VALUES (%s, %s) "
                    "ON CONFLICT (class_id, subject_id) DO NOTHING", (classroom, subject))
        cur.execute("INSERT INTO sonder.class_teacher (class_id, teacher_id) VALUES (%s, %s) "
                    "ON CONFLICT (class_id, teacher_id) DO NOTHING", (classroom, teacher))

        students: dict[str, str] = {}
        for n in range(1, synthetic_students + 1):
            email = f"dev-student-{n}@sonder.invalid"
            students[email] = _user(cur, email, "student", f"Dev seed student {n} (placeholder)")
        for email in enrol_emails:
            cur.execute("SELECT id FROM sonder.app_user WHERE email = %s AND role = 'student' AND status = 'active'",
                        (email.strip().lower(),))
            row = cur.fetchone()
            if row is None:
                raise RuntimeError(f"no active student account with email {email}; sign up and onboard first")
            students[email.strip().lower()] = str(row[0])
        enrolments: dict[str, str] = {}
        for email, student in students.items():
            cur.execute("INSERT INTO sonder.enrolment (class_id, student_id) VALUES (%s, %s) "
                        "ON CONFLICT (class_id, student_id) DO NOTHING", (classroom, student))
            enrolments[email] = _one(cur, "SELECT id FROM sonder.enrolment WHERE class_id = %s AND student_id = %s",
                                     (classroom, student))
    return {"release": f"{version_code}/{model_code}", "class_id": classroom, "teacher_id": teacher,
            "students": students, "enrolments": enrolments}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database-url", default=None, help="defaults to SONDER_DATABASE_URL")
    parser.add_argument("--unit", default="U1")
    parser.add_argument("--enrol-email", action="append", default=[],
                        help="enrol this existing, onboarded student account in the development class")
    args = parser.parse_args(argv)
    if os.environ.get(ALLOW_ENV) != "true":
        print(f"Refusing to seed: set {ALLOW_ENV}=true to confirm this is a development database.", file=sys.stderr)
        return 2
    try:
        with psycopg.connect(database_url(args.database_url)) as conn:
            result = seed(conn, unit_id=args.unit, enrol_emails=tuple(args.enrol_email))
    except (RuntimeError, psycopg.Error) as exc:
        print(f"DEV SEED FAILED: {describe_error(exc)}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
