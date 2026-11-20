"""The evidence of one stored session, for a teacher of the student's class (I2-A12).

``teacher_evidence`` is ``stored_evidence`` (Ahmed's persisted-evidence interface) plus what a
teacher needs to read it, all taken from the session's own pinned content version:

- who and where: the student's display name, the class, the assignment (if any);
- hypothesis names (misconception name, "No misconception", "Something else");
- each asked question's stem and options, with the correct option and each option's
  misconception links (grade S or T).

Scope: the caller must be an active teacher who actively teaches the class of the session's
enrolment (``sonder.is_class_teacher``, migration 0004). Any other session, and an unknown one, is
``None``; the service reports both as 404 ``session_not_found`` so ids cannot be probed.
The function only reads; it never changes evidence.
"""

from __future__ import annotations

import psycopg

from .stored_evidence import stored_evidence

_NAMES = {"none": "No misconception", "unmodelled": "Something else"}

_SCOPE_SQL = """
SELECT u.display_name, c.id::text, c.name, a.id::text, a.title
FROM sonder.diagnostic_session s
JOIN sonder.enrolment e ON e.id = s.enrolment_id
JOIN sonder.app_user u ON u.id = e.student_id
JOIN sonder.classroom c ON c.id = e.class_id
LEFT JOIN sonder.class_assignment a ON a.id = s.assignment_id
WHERE s.id = %s AND sonder.is_class_teacher(%s, e.class_id)
"""

_HYPOTHESES_SQL = """
SELECT sh.slot, h.kind, mr.name
FROM sonder.session_hypothesis sh
JOIN sonder.hypothesis h ON h.id = sh.hypothesis_id
LEFT JOIN sonder.misconception_revision mr ON mr.id = h.misconception_revision_id
WHERE sh.session_id = %s ORDER BY sh.slot
"""

# Items are joined by their database id, so the text is the pinned version's even if a later
# content version reuses the same external item id with different wording.
_OPTIONS_SQL = """
SELECT q.step_index, i.stem, o.label, o.option_text, o.is_correct,
       COALESCE((SELECT json_agg(json_build_array(m.external_id, mr.name, om.link_grade) ORDER BY m.external_id)
                 FROM sonder.option_misconception om
                 JOIN sonder.misconception_revision mr ON mr.id = om.misconception_revision_id
                 JOIN sonder.misconception m ON m.id = mr.misconception_id
                 WHERE om.option_id = o.id), '[]'::json)
FROM sonder.session_question q
JOIN sonder.item i ON i.id = q.item_id
JOIN sonder.item_option o ON o.item_id = i.id
WHERE q.session_id = %s ORDER BY q.step_index, o.label
"""


def teacher_evidence(conn: psycopg.Connection, teacher_id: str, session_id: str) -> dict | None:
    """The session's evidence for this teacher, or None if it is not theirs to see (or does not exist)."""

    scope = conn.execute(_SCOPE_SQL, (session_id, teacher_id)).fetchone()
    if scope is None:
        return None
    evidence = stored_evidence(conn, session_id)
    if evidence is None:  # deleted between the two reads; sessions are never deleted, but be exact
        return None
    student_name, class_id, class_name, assignment_id, assignment_title = scope

    names = {int(slot): (name if kind == "misconception" else _NAMES[kind])
             for slot, kind, name in conn.execute(_HYPOTHESES_SQL, (session_id,)).fetchall()}
    for hypothesis in evidence["hypotheses"]:
        hypothesis["name"] = names[hypothesis["slot"]]

    texts: dict[int, dict] = {}
    for step_index, stem, label, text, correct, links in conn.execute(_OPTIONS_SQL, (session_id,)).fetchall():
        entry = texts.setdefault(int(step_index), {"stem": stem, "options": []})
        entry["options"].append({"option_id": label, "text": text, "is_correct": bool(correct),
                                 "links": [{"misconception_id": m, "name": n, "grade": g} for m, n, g in links]})
    for question in evidence["questions"]:
        question.update(texts[question["step_index"]])

    evidence["student"] = {"display_name": student_name}
    evidence["class"] = {"class_id": class_id, "name": class_name}
    evidence["assignment"] = None if assignment_id is None else {"assignment_id": assignment_id, "title": assignment_title}
    return evidence
