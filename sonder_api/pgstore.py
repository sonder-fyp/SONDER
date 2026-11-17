"""Durable diagnostic sessions in PostgreSQL (I2-L02 to I2-L06).

The service keeps no session state in memory. Every request rebuilds the session from
its pinned release and its accepted answers, with the pure engine, and checks that the
rebuilt questions equal the stored ones before anything is returned or written. One
answer is one transaction: the session row is locked, the engine calculates, and the
step, its posterior and either the next question or the final outcome are written
together. The schema's own triggers check those writes again at commit.
"""

from __future__ import annotations

import copy
import logging
import weakref
from threading import RLock
from time import monotonic, perf_counter
from uuid import UUID, uuid4

import psycopg
from psycopg_pool import ConnectionPool, PoolTimeout

from sonder_db import RedactingFilter, describe_error, num
from sonder_engine.session import EngineError, SessionState, answer, next_question, replay
from sonder_engine.stopping import Outcome
from sonder_engine.trace import trace_of

from .contracts import AnswerRequest, CONTRACT_VERSION, StartRequest
from .pgpack import (Release, ReleaseError, UnitIndex, load_release, load_release_by_model, load_unit,
                     register_engine_release, unit_catalogue)
from .store import ServiceError
from .student_view import evidence, snapshot, summary

log = logging.getLogger("sonder_api")

# psycopg_pool logs "error connecting in ...: <message>" itself, and the message can hold the DSN.
for _name in ("psycopg", "psycopg.pool"):
    logging.getLogger(_name).addFilter(RedactingFilter())

_SESSION_COLUMNS = "s.id, s.response_model_id, u.unit_code, s.question_budget, s.status, e.student_id"
_SESSION_FROM = """
FROM sonder.diagnostic_session s
JOIN sonder.enrolment e ON e.id = s.enrolment_id
JOIN sonder.diagnostic_unit u ON u.id = s.unit_id
WHERE s.id = %s
"""
_SESSION_SQL = "SELECT " + _SESSION_COLUMNS + _SESSION_FROM
_EVENTS_SQL = """
SELECT q.id, i.external_id, o.label
FROM sonder.session_question q
JOIN sonder.item i ON i.id = q.item_id
LEFT JOIN sonder.session_step st ON st.session_question_id = q.id
LEFT JOIN sonder.item_option o ON o.id = st.answer_option_id
WHERE q.session_id = %s
ORDER BY q.step_index
"""
# The session row and its events in ONE statement, so they come from one snapshot (a concurrent answer
# cannot be half visible). Used by read-only operations only: with FOR UPDATE, a statement that waited
# for the lock would still read its events from the older snapshot, so locked reads keep two statements.
_SESSION_WITH_EVENTS_SQL = ("SELECT " + _SESSION_COLUMNS + """,
  COALESCE((SELECT json_agg(json_build_array(q.id, i.external_id, o.label) ORDER BY q.step_index)
            FROM sonder.session_question q
            JOIN sonder.item i ON i.id = q.item_id
            LEFT JOIN sonder.session_step st ON st.session_question_id = q.id
            LEFT JOIN sonder.item_option o ON o.id = st.answer_option_id
            WHERE q.session_id = s.id), '[]'::json)
""" + _SESSION_FROM)
_ENROLMENT_SQL = """
SELECT e.id
FROM sonder.enrolment e
JOIN sonder.app_user u ON u.id = e.student_id AND u.role = 'student' AND u.status = 'active'
JOIN sonder.classroom c ON c.id = e.class_id AND c.status = 'active'
JOIN sonder.class_subject cs ON cs.class_id = c.id AND cs.subject_id = %s
WHERE e.student_id = %s AND e.status = 'active'
ORDER BY e.joined_at, e.id
"""


def _uuid(value: str, status: int, code: str) -> str:
    try:
        return str(UUID(value))
    except (ValueError, AttributeError, TypeError):
        raise ServiceError(status, code) from None


class PostgresStore:
    mode = "postgres"
    RECHECK_AFTER = 30.0  # seconds a pooled connection may sit idle before it is tested again

    def __init__(self, url: str, release: str, *, pool_min: int = 1, pool_max: int = 4,
                 timeout: float = 5.0, clock=perf_counter):
        self.clock = clock
        self.lock = RLock()
        self._releases: dict[str, Release] = {}
        self._units: dict[tuple[str, str], tuple] = {}
        self._catalogue: dict | None = None
        self._last_used: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()
        # prepare_threshold=None: no server-side prepared statements, so a pooled Neon endpoint is safe.
        # check/reset: a connection is tested only after sitting idle for RECHECK_AFTER seconds (the pool
        # calls reset when a connection is returned). A dropped connection inside that window is caught by
        # _run, which retries the whole unit once on a new connection.
        self.pool = ConnectionPool(url, min_size=pool_min, max_size=pool_max, timeout=timeout,
                                   kwargs={"prepare_threshold": None}, check=self._check,
                                   reset=lambda conn: self._last_used.__setitem__(conn, monotonic()), open=False)
        try:
            self.pool.open(wait=True, timeout=timeout)
            with self.pool.connection() as conn:
                self.release = load_release(conn, release)
                self.engine_release_id, self.engine_release_code = register_engine_release(conn)
        except BaseException:
            self.pool.close()
            raise
        self._releases[self.release.response_model_id] = self.release

    def close(self) -> None:
        self.pool.close()

    # ------------------------------------------------------------------ plumbing
    def _check(self, conn) -> None:
        returned = self._last_used.get(conn)
        if returned is not None and monotonic() - returned < self.RECHECK_AFTER:
            return
        ConnectionPool.check_connection(conn)

    def _run(self, work, *, read_only: bool = False):
        """Run work(conn) as one unit: one transaction, or autocommit for a read made of one statement.

        The unit is tried at most twice. A psycopg.OperationalError (a dead pooled connection, before or
        during the unit) is retried once on a fresh connection. That is safe for every operation, because
        the unit is re-run from the start in a new transaction and starts and answers are idempotent
        (design D4): a write whose commit was lost is applied once, and one that did commit is answered
        from the stored evidence. ServiceError and other database errors are never retried, and neither
        is a pool timeout (the pool is saturated or the database is down; waiting again only adds delay).
        """

        for attempt in (1, 2):
            try:
                with self.pool.connection() as conn:
                    if read_only:
                        conn.autocommit = True
                    try:
                        return work(conn)
                    finally:
                        if read_only:
                            try:
                                conn.autocommit = False
                            except psycopg.Error:  # a dead connection is discarded by the pool anyway
                                pass
            except ServiceError:
                raise
            except PoolTimeout as exc:
                log.error("Database unavailable: %s", type(exc).__name__)
                raise ServiceError(503, "storage_unavailable") from exc
            except psycopg.OperationalError as exc:
                if attempt == 1:
                    log.warning("Database connection failed (%s); retrying once", type(exc).__name__)
                    continue
                log.error("Database unavailable: %s", type(exc).__name__)
                raise ServiceError(503, "storage_unavailable") from exc
            except psycopg.Error as exc:
                log.error("Database rejected a session write: %s", describe_error(exc))
                raise ServiceError(500, "storage_error") from exc

    def _unit(self, conn, response_model_id: str, unit_code: str):
        """(Release, Unit, UnitIndex) for a pinned release; frozen rows never change, so cache them."""

        key = (response_model_id, unit_code)
        with self.lock:
            cached = self._units.get(key)
        if cached is not None:
            return cached
        release = self._releases.get(response_model_id) or load_release_by_model(conn, response_model_id)
        loaded = load_unit(conn, release, unit_code)
        if loaded is None:
            return None
        value = (release, loaded[0], loaded[1])
        with self.lock:
            self._releases[response_model_id] = release
            self._units[key] = value
        return value

    def _session(self, conn, sid: str, actor: str | None, *, lock: bool = False):
        """Load a session, its pinned unit and its stored events; rebuild and check the engine state."""

        sid = _uuid(sid, 404, "session_unavailable")
        if lock:
            row = conn.execute(_SESSION_SQL + " FOR UPDATE OF s", (sid,)).fetchone()
        else:
            row = conn.execute(_SESSION_WITH_EVENTS_SQL, (sid,)).fetchone()
        if row is None or (actor is not None and str(row[5]) != actor):
            raise ServiceError(404, "session_unavailable")
        response_model_id, unit_code, budget, status = row[1], row[2], row[3], row[4]
        release, unit, index = self._unit(conn, str(response_model_id), unit_code)
        if lock:  # after the lock, so it sees every answer committed before the lock was granted
            events = conn.execute(_EVENTS_SQL, (sid,)).fetchall()
        else:
            events = [(qid, external, label) for qid, external, label in row[6]]
        answers = [label for _, _, label in events if label is not None]
        try:
            state = replay(unit, release.params, answers, budget=budget)
            if not state.finished:
                state = next_question(state)
        except EngineError as exc:
            log.error("Session %s cannot be replayed: %s", sid, exc.code)
            raise ServiceError(500, "replay_mismatch") from exc
        asked = [s.question.item_id for s in state.steps] + ([state.pending.item_id] if state.pending else [])
        if asked != [external for _, external, _ in events] or state.decision.outcome.value != status:
            log.error("Session %s: replayed questions or outcome differ from the stored evidence", sid)
            raise ServiceError(500, "replay_mismatch")
        return sid, release, unit, index, events, state

    def _prefix(self, unit, release: Release, budget: int, answers: list[str]) -> SessionState:
        state = replay(unit, release.params, answers, budget=budget)
        return state if state.finished else next_question(state)

    # ------------------------------------------------------------------ writes
    @staticmethod
    def _write_question(conn, sid: str, index: UnitIndex, state: SessionState) -> None:
        q = state.pending
        question_id = conn.execute(
            "INSERT INTO sonder.session_question (session_id, step_index, item_id, selection_reason, "
            "entropy_before, expected_ig) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (sid, q.step_index, index.item_ids[q.item_id], q.selection_reason,
             num(q.entropy_before), num(q.expected_ig))).fetchone()[0]
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO sonder.question_candidate (session_question_id, item_id, rank, eig) "
                "VALUES (%s, %s, %s, %s)",
                [(question_id, index.item_ids[c.item_id], c.rank, num(c.eig)) for c in q.candidates])

    @staticmethod
    def _write_outcome(conn, sid: str, state: SessionState, slots: dict[int, str]) -> None:
        outcome = trace_of(state).outcome
        conn.execute("UPDATE sonder.diagnostic_session SET status = %s, ended_at = now() WHERE id = %s",
                     (outcome.outcome.value, sid))
        if outcome.outcome is Outcome.DIAGNOSED:
            diagnosis = conn.execute("INSERT INTO sonder.diagnosis (session_id) VALUES (%s) RETURNING id",
                                     (sid,)).fetchone()[0]
            with conn.cursor() as cur:
                cur.executemany("INSERT INTO sonder.diagnosis_candidate (diagnosis_id, session_hypothesis_id, rank) "
                                "VALUES (%s, %s, %s)",
                                [(diagnosis, slots[slot], rank) for rank, slot in outcome.diagnosis_candidates])
        elif outcome.escalation_reason is not None:
            escalation = conn.execute(
                "INSERT INTO sonder.escalation (session_id, reason, leader_session_hypothesis_id) "
                "VALUES (%s, %s, %s) RETURNING id",
                (sid, outcome.escalation_reason, slots[outcome.escalation_leader_slot])).fetchone()[0]
            with conn.cursor() as cur:
                cur.executemany("INSERT INTO sonder.escalation_candidate (escalation_id, session_hypothesis_id, rank) "
                                "VALUES (%s, %s, %s)",
                                [(escalation, slots[slot], rank) for rank, slot in outcome.escalation_candidates])

    def _enrolment(self, conn, actor: str, request: StartRequest) -> str:
        if getattr(request, "assignment_id", None) is not None:
            # Assignments are I2-H11/H12 (Harris). Until that schema exists no assignment can be resolved.
            raise ServiceError(404, "assignment_not_found")
        rows = conn.execute(_ENROLMENT_SQL, (self.release.subject_id, actor)).fetchall()
        if not rows:
            raise ServiceError(403, "enrolment_required")
        if len(rows) > 1:
            raise ServiceError(409, "enrolment_ambiguous")
        return str(rows[0][0])

    # ------------------------------------------------------------------ service operations
    def health(self) -> dict:
        self._run(lambda conn: conn.execute("SELECT 1"), read_only=True)
        return {"contract_version": CONTRACT_VERSION, "mode": self.mode, "ready": True,
                "release": self.release.label, "engine_release": self.engine_release_code}

    def catalogue(self) -> dict:
        """The release is frozen, so its catalogue is read once; callers get a copy they may change."""

        with self.lock:
            cached = self._catalogue
        if cached is None:
            units = self._run(lambda conn: unit_catalogue(conn, self.release), read_only=True)
            cached = {"contract_version": CONTRACT_VERSION, "subject": self.release.subject_name,
                      "question_budget": self.release.params.default_budget, "units": units}
            with self.lock:
                if self._catalogue is None:
                    self._catalogue = cached
                cached = self._catalogue
        return copy.deepcopy(cached)

    _EXISTING_START_SQL = (
        "SELECT s.id, u.unit_code, s.response_model_id, s.question_budget "
        "FROM sonder.diagnostic_session s JOIN sonder.diagnostic_unit u ON u.id = s.unit_id "
        "WHERE s.enrolment_id = %s AND s.request_key = %s")

    def _start_retry(self, conn, existing, request: StartRequest) -> dict:
        """The original start reply of an already committed start with this request key."""

        if existing[1] != request.unit_id:
            raise ServiceError(409, "create_conflict")
        old_release, old_unit, _ = self._unit(conn, str(existing[2]), existing[1])
        return snapshot(str(existing[0]), self._prefix(old_unit, old_release, existing[3], []))

    def create(self, actor: str, request: StartRequest) -> dict:
        actor = _uuid(actor, 404, "session_unavailable")

        def work(conn):
            enrolment = self._enrolment(conn, actor, request)
            existing = conn.execute(self._EXISTING_START_SQL, (enrolment, request.create_request_id)).fetchone()
            if existing is not None:  # checked before the unit, so a changed unit is always create_conflict
                return self._start_retry(conn, existing, request)
            loaded = self._unit(conn, self.release.response_model_id, request.unit_id)
            if loaded is None:
                raise ServiceError(404, "unit_not_found")
            release, unit, index = loaded
            conn.execute("SELECT set_config('sonder.actor_id', %s, true), set_config('sonder.request_key', %s, true)",
                         (actor, request.create_request_id))
            budget = release.params.default_budget
            sid = str(uuid4())
            inserted = conn.execute(
                "INSERT INTO sonder.diagnostic_session (id, enrolment_id, response_model_id, engine_release_id, "
                "unit_id, question_budget, request_key) VALUES (%s, %s, %s, %s, %s, %s, %s) "
                "ON CONFLICT (enrolment_id, request_key) DO NOTHING RETURNING id",
                (sid, enrolment, release.response_model_id, self.engine_release_id, index.unit_row_id,
                 budget, request.create_request_id)).fetchone()
            if inserted is None:  # a concurrent identical start committed first: return its reply
                existing = conn.execute(self._EXISTING_START_SQL, (enrolment, request.create_request_id)).fetchone()
                return self._start_retry(conn, existing, request)
            state = self._prefix(unit, release, budget, [])
            if state.finished:
                raise ServiceError(500, "replay_mismatch")  # a valid unit always asks a first question
            reply = snapshot(sid, state)
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO sonder.session_hypothesis (session_id, hypothesis_id, slot, prior_probability) "
                    "VALUES (%s, %s, %s, %s)",
                    [(sid, index.hypothesis_ids[slot], slot, num(prior)) for slot, prior in enumerate(state.prior)])
            self._write_question(conn, sid, index, state)
            return reply

        return self._run(work)

    def current(self, sid: str, actor: str) -> dict:
        actor = _uuid(actor, 404, "session_unavailable")

        def work(conn):
            sid_, _, _, _, _, state = self._session(conn, sid, actor)
            return snapshot(sid_, state)

        return self._run(work, read_only=True)

    def list_sessions(self, actor: str, *, status: str | None = None, unit_id: str | None = None) -> dict:
        actor = _uuid(actor, 404, "session_unavailable")
        where, args = ["e.student_id = %s"], [actor]
        if status == "in_progress":
            where.append("s.status = 'in_progress'")
        elif status == "complete":
            where.append("s.status <> 'in_progress'")
        if unit_id is not None:
            where.append("u.unit_code = %s")
            args.append(unit_id)
        sql = ("SELECT s.id, u.unit_code, u.name, s.status, s.question_budget, s.started_at, s.ended_at, "
               "(SELECT count(*) FROM sonder.session_step st WHERE st.session_id = s.id) "
               "FROM sonder.diagnostic_session s JOIN sonder.enrolment e ON e.id = s.enrolment_id "
               "JOIN sonder.diagnostic_unit u ON u.id = s.unit_id WHERE " + " AND ".join(where) +
               " ORDER BY s.started_at DESC, s.id DESC LIMIT 50")
        rows = self._run(lambda conn: conn.execute(sql, args).fetchall(), read_only=True)
        return {"contract_version": CONTRACT_VERSION, "sessions": [
            summary(str(r[0]), r[1], r[2], r[3] != "in_progress", int(r[7]), int(r[4]),
                    r[5].isoformat(), None if r[6] is None else r[6].isoformat()) for r in rows]}

    def submit(self, sid: str, actor: str, request: AnswerRequest) -> tuple[dict, bool]:
        actor = _uuid(actor, 404, "session_unavailable")

        def work(conn):
            sid_, release, unit, index, events, state = self._session(conn, sid, actor, lock=True)
            answered = [(external, label) for _, external, label in events if label is not None]
            if request.step_index < len(answered):  # a retry of an accepted step
                if answered[request.step_index] != (request.item_id, request.option_id):
                    raise ServiceError(409, "answer_conflict")
                prefix = [label for _, label in answered[:request.step_index + 1]]
                return snapshot(sid_, self._prefix(unit, release, state.budget, prefix)), False
            if state.finished:
                raise ServiceError(409, "session_finished")
            if request.step_index != len(answered):
                raise ServiceError(409, "step_conflict")
            if state.pending is None or request.item_id != state.pending.item_id:
                raise ServiceError(409, "item_conflict")
            started = self.clock()
            updated = answer(state, request.item_id, request.option_id)
            if not updated.finished:
                updated = next_question(updated)
            elapsed_ms = max((self.clock() - started) * 1000.0, 0.0)
            reply = snapshot(sid_, updated)
            # All numerical and projection work has succeeded; now publish it in this one transaction.
            step = updated.steps[-1]
            key = f"answer:{step.step_index}"
            conn.execute("SELECT set_config('sonder.actor_id', %s, true), set_config('sonder.request_key', %s, true)",
                         (actor, key))
            step_id = conn.execute(
                "INSERT INTO sonder.session_step (session_id, step_index, session_question_id, answer_option_id, "
                "request_key, calculation_ms, answer_note) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (sid_, step.step_index, events[-1][0], index.option_ids[(request.item_id, request.option_id)],
                 key, num(round(elapsed_ms, 3)), step.answer_note)).fetchone()[0]
            slots = {int(slot): str(row_id) for row_id, slot in conn.execute(
                "SELECT id, slot FROM sonder.session_hypothesis WHERE session_id = %s", (sid_,)).fetchall()}
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO sonder.step_posterior (step_id, session_hypothesis_id, probability) "
                    "VALUES (%s, %s, %s)",
                    [(step_id, slots[slot], num(p)) for slot, p in enumerate(step.posterior)])
            if updated.finished:
                self._write_outcome(conn, sid_, updated, slots)
            else:
                self._write_question(conn, sid_, index, updated)
            self._before_commit(sid_, step.step_index)
            return reply, True

        return self._run(work)

    def _before_commit(self, sid: str, step_index: int) -> None:
        """Test seam: called after every write of an answer, just before the transaction commits."""

    def inspect(self, sid: str) -> dict:
        def work(conn):
            _, _, _, _, _, state = self._session(conn, sid, None)
            return evidence(state)

        return self._run(work, read_only=True)

    def latest_finished(self) -> dict:
        def work(conn):
            row = conn.execute(
                "SELECT s.id, (SELECT count(*) FROM sonder.diagnostic_session f "
                "              WHERE f.status NOT IN ('in_progress', 'abandoned')) "
                "FROM sonder.diagnostic_session s WHERE s.status NOT IN ('in_progress', 'abandoned') "
                "ORDER BY s.ended_at DESC, s.id DESC LIMIT 1").fetchone()
            if row is None:
                raise ServiceError(404, "session_unavailable")
            sid, _, unit, _, _, state = self._session(conn, str(row[0]), None)
            return {"session_id": sid, "finished_seq": int(row[1]),
                    "unit": {"unit_id": unit.unit_id, "name": unit.name}, **evidence(state)}

        return self._run(work, read_only=True)
