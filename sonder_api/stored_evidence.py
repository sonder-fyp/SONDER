"""Stored engine evidence, read only from database rows (I2-L04, I2-L05).

``stored_evidence`` rebuilds a session's evidence from the persisted rows alone: no
engine call and no replay. ``evidence_from_trace`` reduces an engine trace to the same
shape. ``verify_session`` replays the session with the pure engine from its pinned
release and accepted answers and compares the two, field by field. This is the
persisted-evidence interface for feature-specific queries (teacher evidence viewer,
evaluation replay checks): consumers read these rows or call these functions; they do
not parse logs or terminal output.

    python -m sonder_api.stored_evidence --all          # verify every stored session
    python -m sonder_api.stored_evidence --session ID   # verify one and print its evidence
"""

from __future__ import annotations

import argparse
import json
import sys

import psycopg

from sonder_db import database_url, describe_error
from sonder_engine.session import next_question, replay
from sonder_engine.trace import trace_of, trace_to_dict

from .pgpack import load_release_by_model, load_unit

_KIND_NAME = {"none": "NONE", "unmodelled": "UNMODELLED"}


def stored_evidence(conn: psycopg.Connection, session_id: str) -> dict | None:
    """The evidence of one session exactly as stored, or None if there is no such session."""

    row = conn.execute(
        "SELECT s.id, u.unit_code, s.question_budget, s.status, c.version_code, r.model_code, "
        "       p.params_sha256, er.release_code, s.response_model_id, s.started_at, s.ended_at "
        "FROM sonder.diagnostic_session s "
        "JOIN sonder.diagnostic_unit u ON u.id = s.unit_id "
        "JOIN sonder.response_model r ON r.id = s.response_model_id "
        "JOIN sonder.content_version c ON c.id = r.content_version_id "
        "JOIN sonder.engine_params p ON p.id = r.engine_params_id "
        "JOIN sonder.engine_release er ON er.id = s.engine_release_id "
        "WHERE s.id = %s", (session_id,)).fetchone()
    if row is None:
        return None
    sid = str(row[0])
    hypotheses = [
        {"slot": int(slot), "hypothesis_id": external or _KIND_NAME[kind], "kind": kind, "prior": float(prior)}
        for slot, kind, external, prior in conn.execute(
            "SELECT sh.slot, h.kind, m.external_id, sh.prior_probability "
            "FROM sonder.session_hypothesis sh JOIN sonder.hypothesis h ON h.id = sh.hypothesis_id "
            "LEFT JOIN sonder.misconception_revision mr ON mr.id = h.misconception_revision_id "
            "LEFT JOIN sonder.misconception m ON m.id = mr.misconception_id "
            "WHERE sh.session_id = %s ORDER BY sh.slot", (sid,)).fetchall()]
    candidates: dict[str, list[dict]] = {}
    for question_id, rank, external, eig in conn.execute(
            "SELECT qc.session_question_id, qc.rank, i.external_id, qc.eig "
            "FROM sonder.question_candidate qc JOIN sonder.session_question q ON q.id = qc.session_question_id "
            "JOIN sonder.item i ON i.id = qc.item_id WHERE q.session_id = %s ORDER BY q.step_index, qc.rank",
            (sid,)).fetchall():
        candidates.setdefault(str(question_id), []).append({"rank": int(rank), "item_id": external, "eig": float(eig)})
    questions = []
    for question_id, step_index, external, reason, entropy, eig in conn.execute(
            "SELECT q.id, q.step_index, i.external_id, q.selection_reason, q.entropy_before, q.expected_ig "
            "FROM sonder.session_question q JOIN sonder.item i ON i.id = q.item_id "
            "WHERE q.session_id = %s ORDER BY q.step_index", (sid,)).fetchall():
        questions.append({"step_index": int(step_index), "item_id": external, "selection_reason": reason,
                          "entropy_before": float(entropy), "expected_ig": float(eig),
                          "candidates": candidates.get(str(question_id), [])})
    posteriors: dict[int, list[float]] = {}
    for step_index, probability in conn.execute(
            "SELECT st.step_index, sp.probability FROM sonder.step_posterior sp "
            "JOIN sonder.session_step st ON st.id = sp.step_id "
            "JOIN sonder.session_hypothesis sh ON sh.id = sp.session_hypothesis_id "
            "WHERE st.session_id = %s ORDER BY st.step_index, sh.slot", (sid,)).fetchall():
        posteriors.setdefault(int(step_index), []).append(float(probability))
    supports: dict[int, list[int]] = {}
    for step_index, value in conn.execute(
            "SELECT step_index, support FROM sonder.step_support WHERE session_id = %s ORDER BY step_index, slot",
            (sid,)).fetchall():
        supports.setdefault(int(step_index), []).append(int(value))
    steps = [{"step_index": int(step_index), "item_id": external, "option_id": label, "answer_note": note,
              "posterior": posteriors.get(int(step_index), []), "support": supports.get(int(step_index), [])}
             for step_index, external, label, note in conn.execute(
                 "SELECT st.step_index, i.external_id, o.label, st.answer_note FROM sonder.session_step st "
                 "JOIN sonder.item_option o ON o.id = st.answer_option_id JOIN sonder.item i ON i.id = o.item_id "
                 "WHERE st.session_id = %s ORDER BY st.step_index", (sid,)).fetchall()]
    slot_of = {}
    for row_id, slot in conn.execute("SELECT id, slot FROM sonder.session_hypothesis WHERE session_id = %s",
                                     (sid,)).fetchall():
        slot_of[str(row_id)] = int(slot)
    diagnosis = [[int(rank), slot_of[str(h)]] for rank, h in conn.execute(
        "SELECT dc.rank, dc.session_hypothesis_id FROM sonder.diagnosis d "
        "JOIN sonder.diagnosis_candidate dc ON dc.diagnosis_id = d.id WHERE d.session_id = %s ORDER BY dc.rank",
        (sid,)).fetchall()]
    escalation = conn.execute("SELECT id, reason, leader_session_hypothesis_id FROM sonder.escalation "
                              "WHERE session_id = %s", (sid,)).fetchone()
    escalated = [] if escalation is None else [[int(rank), slot_of[str(h)]] for rank, h in conn.execute(
        "SELECT rank, session_hypothesis_id FROM sonder.escalation_candidate WHERE escalation_id = %s ORDER BY rank",
        (escalation[0],)).fetchall()]
    return {
        "session_id": sid, "unit_id": row[1], "question_budget": int(row[2]),
        "release": f"{row[4]}/{row[5]}", "content_version": row[4], "params_sha256": row[6],
        "engine_release": row[7], "started_at": row[9].isoformat(),
        "ended_at": None if row[10] is None else row[10].isoformat(),
        "hypotheses": hypotheses, "questions": questions, "steps": steps,
        "outcome": {"outcome": row[3], "diagnosis_candidates": diagnosis,
                    "escalation_reason": None if escalation is None else escalation[1],
                    "escalation_leader_slot": None if escalation is None else slot_of[str(escalation[2])],
                    "escalation_candidates": escalated},
    }


def evidence_from_trace(trace: dict) -> dict:
    """The engine trace reduced to the fields ``stored_evidence`` persists."""

    asked = [s["question"] for s in trace["steps"]] + ([trace["pending"]] if trace["pending"] else [])
    o = trace["outcome"]
    return {
        "unit_id": trace["unit_id"], "question_budget": trace["question_budget"],
        "content_version": trace["content_version"],
        "hypotheses": trace["hypotheses"],
        "questions": [{k: q[k] for k in ("step_index", "item_id", "selection_reason", "entropy_before",
                                          "expected_ig", "candidates")} for q in asked],
        "steps": [{"step_index": s["step_index"], "item_id": s["question"]["item_id"], "option_id": s["option_id"],
                   "answer_note": s["answer_note"], "posterior": s["posterior"], "support": s["support"]}
                  for s in trace["steps"]],
        "outcome": {"outcome": o["outcome"], "diagnosis_candidates": o["diagnosis_candidates"],
                    "escalation_reason": o["escalation_reason"],
                    "escalation_leader_slot": o["escalation_leader_slot"],
                    "escalation_candidates": o["escalation_candidates"]},
    }


def _differences(a, b, path="") -> list[str]:
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for key in sorted(set(a) | set(b)):
            out += _differences(a.get(key), b.get(key), f"{path}.{key}")
        return out
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [f"{path}: length {len(a)} != {len(b)}"]
        return [d for i, (x, y) in enumerate(zip(a, b)) for d in _differences(x, y, f"{path}[{i}]")]
    return [] if a == b else [f"{path}: stored {a!r} != replayed {b!r}"]


def verify_session(conn: psycopg.Connection, session_id: str) -> list[str]:
    """Replay a stored session from its pinned release and answers; return every difference."""

    stored = stored_evidence(conn, session_id)
    if stored is None:
        return [f"session {session_id} does not exist"]
    model, unit_code = conn.execute(
        "SELECT s.response_model_id, u.unit_code FROM sonder.diagnostic_session s "
        "JOIN sonder.diagnostic_unit u ON u.id = s.unit_id WHERE s.id = %s", (session_id,)).fetchone()
    release = load_release_by_model(conn, str(model))
    unit, _ = load_unit(conn, release, unit_code)
    state = replay(unit, release.params, [s["option_id"] for s in stored["steps"]], budget=stored["question_budget"])
    if not state.finished and len(stored["questions"]) > len(stored["steps"]):
        state = next_question(state)
    replayed = evidence_from_trace(trace_to_dict(trace_of(state)))
    mine = {k: stored[k] for k in replayed}
    return _differences(mine, replayed)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--session")
    group.add_argument("--all", action="store_true")
    parser.add_argument("--database-url", default=None)
    args = parser.parse_args(argv)
    try:
        with psycopg.connect(database_url(args.database_url)) as conn:
            ids = ([args.session] if args.session else
                   [str(r[0]) for r in conn.execute("SELECT id FROM sonder.diagnostic_session ORDER BY started_at, id")])
            failures = {sid: diffs for sid in ids if (diffs := verify_session(conn, sid))}
            if args.session and not failures:
                sys.stdout.reconfigure(encoding="utf-8")
                print(json.dumps(stored_evidence(conn, args.session), indent=2, ensure_ascii=False))
    except (RuntimeError, psycopg.Error) as exc:
        print(f"STORED EVIDENCE CHECK FAILED: {describe_error(exc)}", file=sys.stderr)
        return 2
    print(json.dumps({"checked": len(ids), "matching": len(ids) - len(failures), "mismatched": failures}, indent=2),
          file=sys.stderr if args.session else sys.stdout)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
