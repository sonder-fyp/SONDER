import "server-only";
import { integer, object, text } from "./validation";
import type { OptionId, TeacherHypothesis, TeacherOutcome, TeacherResult, TeacherStep } from "./types";

const OUTCOMES: TeacherOutcome[] = ["diagnosed", "none_detected", "escalated_no_separator", "escalated_exhausted", "escalated_unmodelled"];
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function array(value: unknown, max = 100): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error("Invalid array");
  return value;
}
function probability(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error("Invalid probability");
  return value;
}
function finite(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid number");
  return value;
}
function option(value: unknown): OptionId {
  if (value !== "A" && value !== "B" && value !== "C" && value !== "D") throw new Error("Invalid option");
  return value;
}

/** The teacher's demo view of the run that finished last. Rebuilt field by field from the service trace. */
export function parseLatest(value: unknown): TeacherResult {
  const v = object(value), trace = object(v.trace), names = object(v.hypothesis_names), unit = object(v.unit);
  const sessionId = text(v.session_id, 36);
  if (!SESSION_ID.test(sessionId)) throw new Error("Invalid session");

  const rawHypotheses = array(trace.hypotheses, 20).map(object);
  const kinds = new Set(["misconception", "none", "unmodelled"]);
  const steps = array(trace.steps, 50).map(object);
  if (!rawHypotheses.length || !steps.length || trace.pending !== null) throw new Error("Run is not finished");
  const outcome = object(trace.outcome);
  if (!OUTCOMES.includes(outcome.outcome as TeacherOutcome)) throw new Error("Invalid outcome");

  const lastPosterior = array(steps[steps.length - 1].posterior, 20).map(probability);
  const lastSupport = array(steps[steps.length - 1].support, 20).map(s => integer(s, 0, 1000));
  if (lastPosterior.length !== rawHypotheses.length || lastSupport.length !== rawHypotheses.length) throw new Error("Invalid posterior");

  const nameOf = (id: string, kind: string) =>
    kind === "none" ? "No misconception" : kind === "unmodelled" ? "Outside the catalogue"
      : typeof names[id] === "string" ? (names[id] as string) : id;

  const hypotheses: TeacherHypothesis[] = rawHypotheses.map((h, slot) => {
    const kind = text(h.kind, 16);
    if (!kinds.has(kind) || h.slot !== slot) throw new Error("Invalid hypothesis");
    const id = text(h.hypothesis_id, 32);
    return { id, name: nameOf(id, kind), kind: kind as TeacherHypothesis["kind"],
      prior: probability(h.prior), final: lastPosterior[slot], support: lastSupport[slot] };
  });
  const slotOf = (id: string) => hypotheses.findIndex(h => h.id === id);

  const teacherSteps: TeacherStep[] = steps.map((s, index) => {
    const q = object(s.question), d = object(s.decision), posterior = array(s.posterior, 20).map(probability);
    if (s.step_index !== index || posterior.length !== hypotheses.length) throw new Error("Invalid step");
    const leader = text(d.leader, 32), slot = slotOf(leader);
    if (slot < 0) throw new Error("Invalid leader");
    return { step_index: index, item_id: text(q.item_id, 64), reason: text(q.selection_reason, 2000),
      expected_ig: finite(q.expected_ig), option_id: option(s.option_id), answer_note: text(s.answer_note, 500),
      leader, leader_probability: posterior[slot] };
  });

  const decision = object(steps[steps.length - 1].decision);
  const leader = text(decision.leader, 32), leaderSlot = slotOf(leader);
  if (leaderSlot < 0) throw new Error("Invalid leader");
  const tied = array(decision.tied, 20).map(t => text(t, 32));
  if (tied.some(id => slotOf(id) < 0)) throw new Error("Invalid tied set");

  return {
    session_id: sessionId, finished_seq: integer(v.finished_seq, 1, 1_000_000_000),
    unit: { unit_id: text(unit.unit_id, 32), name: text(unit.name, 256) },
    question_budget: integer(trace.question_budget, 1, 100), answered_count: steps.length,
    outcome: outcome.outcome as TeacherOutcome, rule: text(outcome.rule, 8),
    leader, leader_name: hypotheses[leaderSlot].name, tied, detail: text(decision.detail, 2000),
    hypotheses, steps: teacherSteps,
  };
}
