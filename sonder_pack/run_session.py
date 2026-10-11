"""Replay a session on a Maths_v2 unit and print its evidence trail (demo, T06.06).

Run from the repository root, for example (spec worked example D1):

    python -m sonder_pack.run_session --unit U1 --answers D,B,B,A
    python -m sonder_pack.run_session --unit U1 --answers D,B,B,A --table

The engine chooses every question; ``--answers`` gives only the option chosen at
each step. If the answers run out before the session ends, the next pending
question is shown. Files are only read; output goes to the terminal.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sonder_engine import EngineError, PackError, Params, next_question, replay, trace_of, trace_to_dict
from sonder_engine.trace import Trace
from sonder_pack.maths_v2 import DEFAULT_CONFIG, DEFAULT_ROOT, load_maths_v2


def _table(trace: Trace) -> str:
    hyps = [h.hypothesis_id for h in trace.hypotheses]
    lines = [f"{trace.content_version} unit {trace.unit_id}, engine {trace.engine_version}, "
             f"budget {trace.question_budget}",
             "Prior: " + ", ".join(f"{h} {r.prior:.4f}" for h, r in zip(hyps, trace.hypotheses))]
    for step in trace.steps:
        q = step.question
        top = sorted(range(len(hyps)), key=lambda s: (-step.posterior[s], s))[:3]
        lines += [
            f"\nStep {step.step_index}: {q.item_id} (EIG {q.expected_ig:.4f} bits, "
            f"H before {q.entropy_before:.4f}, {len(q.candidates)} candidates)",
            f"  Why: {q.selection_reason}",
            f"  Answer: {step.answer_note}",
            "  Posterior: " + ", ".join(f"{hyps[s]} {step.posterior[s]:.4f}" for s in top),
            f"  Decision: {step.decision.outcome.value}"
            + (f" ({step.decision.detail})" if step.decision.detail else ""),
        ]
    if trace.pending is not None:
        lines.append(f"\nPending question: {trace.pending.item_id} "
                     f"(EIG {trace.pending.expected_ig:.4f}). {trace.pending.selection_reason}")
    o = trace.outcome
    lines.append(f"\nOutcome: {o.outcome.value}" + (f", rule {o.rule}" if o.rule else ""))
    for rank, slot in o.diagnosis_candidates:
        lines.append(f"  Diagnosis rank {rank}: {hyps[slot]}")
    if o.escalation_reason:
        lines.append(f"  Escalation leader: {hyps[o.escalation_leader_slot]}; {o.escalation_reason}")
        lines += [f"  Candidate rank {rank}: {hyps[slot]}" for rank, slot in o.escalation_candidates]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--unit", required=True, help="Unit ID, U1 to U7")
    parser.add_argument("--answers", default="", help="Comma-separated option IDs, e.g. D,B,B,A")
    parser.add_argument("--table", action="store_true", help="Readable table instead of JSON")
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args()
    answers = [a.strip() for a in args.answers.split(",") if a.strip()]
    try:
        params = Params()
        state = replay(load_maths_v2(args.root, args.config, params).unit(args.unit), params, answers)
        if not state.finished:
            state = next_question(state)
    except (PackError, EngineError) as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1
    trace = trace_of(state)
    print(_table(trace) if args.table else json.dumps(trace_to_dict(trace), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
