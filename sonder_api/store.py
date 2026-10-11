"""Single-process, bounded, atomic in-memory sessions. Not durable storage."""
from copy import deepcopy
from dataclasses import dataclass, field
from math import isfinite
from threading import RLock
from time import monotonic
from uuid import uuid4

from sonder_engine.model import Params
from sonder_engine.pack import Pack
from sonder_engine.session import SessionState, answer, next_question, start

from .contracts import AnswerRequest, StartRequest
from .student_view import evidence, snapshot


class ServiceError(Exception):
    def __init__(self, status: int, code: str):
        self.status, self.code = status, code


@dataclass
class Entry:
    owner: str
    state: SessionState
    activity: float
    create_key: tuple[str, str]
    initial: dict
    trace: dict
    replies: dict[int, tuple[AnswerRequest, dict]] = field(default_factory=dict)


class InMemoryStore:
    def __init__(self, pack: Pack, params: Params, *, capacity=256, ttl=86400,
                 clock=monotonic):
        if capacity < 1 or ttl <= 0 or not isfinite(ttl):
            raise ValueError("positive capacity and TTL required")
        self.pack, self.params = pack, params
        self.capacity, self.ttl, self.clock = capacity, ttl, clock
        self.lock = RLock()
        self.entries: dict[str, Entry] = {}
        self.creates: dict[tuple[str, str], str] = {}
        self.expired: dict[str, tuple[str, float]] = {}

    def catalogue(self):
        return {"contract_version": 1, "subject": self.pack.subject,
                "question_budget": self.params.default_budget,
                "units": [{"unit_id": u.unit_id, "name": u.name,
                           "item_count": len(u.items)} for u in self.pack.units]}

    def _prune(self):
        now = self.clock()
        for sid, entry in list(self.entries.items()):
            if now - entry.activity >= self.ttl:
                self._drop(sid, now)
        self.expired = {sid: record for sid, record in self.expired.items()
                        if now - record[1] < self.ttl}
        while len(self.expired) > self.capacity:
            del self.expired[next(iter(self.expired))]

    def _drop(self, sid, now):
        entry = self.entries.pop(sid)
        self.creates.pop(entry.create_key, None)
        self.expired[sid] = (entry.owner, now)

    def _make_room(self):
        # Finished runs are immutable and only kept for resume; free the oldest one
        # so completed runs never block new ones. Active runs are never evicted.
        finished = [(e.activity, sid) for sid, e in self.entries.items() if e.state.finished]
        if finished:
            self._drop(min(finished)[1], self.clock())
            while len(self.expired) > self.capacity:
                del self.expired[next(iter(self.expired))]

    def _owned(self, sid, owner):
        self._prune()
        entry = self.entries.get(sid)
        if entry is None or entry.owner != owner:
            record = self.expired.get(sid)
            if record and record[0] == owner:
                raise ServiceError(410, "session_expired")
            raise ServiceError(404, "session_unavailable")
        return entry

    def create(self, owner: str, request: StartRequest):
        with self.lock:
            self._prune()
            key = (owner, request.create_request_id)
            if key in self.creates:
                entry = self.entries[self.creates[key]]
                if entry.state.unit.unit_id != request.unit_id:
                    raise ServiceError(409, "create_conflict")
                entry.activity = self.clock()
                return deepcopy(entry.initial)
            unit = next((u for u in self.pack.units if u.unit_id == request.unit_id), None)
            if unit is None:
                raise ServiceError(404, "unit_not_found")
            if len(self.entries) >= self.capacity:
                self._make_room()
            if len(self.entries) >= self.capacity:
                raise ServiceError(503, "capacity_exceeded")
            state = start(unit, self.params)
            if not state.finished:
                state = next_question(state)
            sid = str(uuid4())
            reply, trace = snapshot(sid, state), evidence(state)
            self.entries[sid] = Entry(owner, state, self.clock(), key, reply, trace)
            self.creates[key] = sid
            return deepcopy(reply)

    def current(self, sid: str, owner: str):
        with self.lock:
            entry = self._owned(sid, owner)
            reply = snapshot(sid, entry.state)
            entry.activity = self.clock()
            return reply

    def submit(self, sid: str, owner: str, request: AnswerRequest):
        with self.lock:
            entry = self._owned(sid, owner)
            cached = entry.replies.get(request.step_index)
            if cached:
                if cached[0] != request:
                    raise ServiceError(409, "answer_conflict")
                entry.activity = self.clock()
                return deepcopy(cached[1]), False
            state = entry.state
            if state.finished:
                raise ServiceError(409, "session_finished")
            if request.step_index != len(state.steps):
                raise ServiceError(409, "step_conflict")
            if state.pending is None or request.item_id != state.pending.item_id:
                raise ServiceError(409, "item_conflict")
            updated = answer(state, request.item_id, request.option_id)
            if not updated.finished:
                updated = next_question(updated)
            reply, trace = snapshot(sid, updated), evidence(updated)
            # All numerical/projection work succeeds before any publication.
            entry.state, entry.trace = updated, trace
            entry.replies[request.step_index] = (request, reply)
            entry.activity = self.clock()
            return deepcopy(reply), True

    def inspect(self, sid: str):
        with self.lock:
            self._prune()
            if sid not in self.entries:
                raise ServiceError(404, "session_unavailable")
            return deepcopy(self.entries[sid].trace)
