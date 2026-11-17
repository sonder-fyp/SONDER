"""Explicit student projection. Never serialize an engine state to the browser."""
from sonder_engine.session import SessionState
from sonder_engine.trace import trace_of, trace_to_dict

from .contracts import CONTRACT_VERSION


def snapshot(session_id: str, state: SessionState) -> dict:
    question = None
    if not state.finished:
        assert state.pending is not None
        item = next(p for p in state.unit.items if p.item.item_id == state.pending.item_id)
        question = {
            "step_index": state.pending.step_index, "item_id": item.item.item_id,
            "stem": item.stem,
            "options": [{"option_id": key, "text": text}
                        for key, text in zip(item.item.option_ids, item.option_texts)],
        }
    return {
        "contract_version": CONTRACT_VERSION, "session_id": session_id,
        "unit": {"unit_id": state.unit.unit_id, "name": state.unit.name},
        "question_budget": state.budget, "answered_count": len(state.steps),
        "status": "complete" if state.finished else "in_progress", "question": question,
    }


def evidence(state: SessionState) -> dict:
    return {"trace": trace_to_dict(trace_of(state)),
            "hypothesis_names": {h.misconception_id: h.name for h in state.unit.hypotheses}}


def summary(session_id: str, unit_id: str, unit_name: str, finished: bool, answered: int, budget: int,
            started_at: str | None, ended_at: str | None) -> dict:
    return {"session_id": session_id, "unit": {"unit_id": unit_id, "name": unit_name},
            "status": "complete" if finished else "in_progress", "answered_count": answered,
            "question_budget": budget, "started_at": started_at, "ended_at": ended_at}
