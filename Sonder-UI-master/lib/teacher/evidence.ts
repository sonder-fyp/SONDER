/**
 * The teacher evidence of one stored session (GET /engine/teacher/sessions/{id}/evidence, I2-A12).
 * Rebuilt field by field: anything the service adds later cannot reach the browser unchecked.
 */

export type SessionOutcome =
  | "in_progress" | "diagnosed" | "none_detected" | "escalated_no_separator" | "escalated_exhausted"
  | "escalated_unmodelled" | "abandoned";

export type EvidenceOption = {
  option_id: "A" | "B" | "C" | "D";
  text: string;
  is_correct: boolean;
  links: { misconception_id: string; name: string; grade: "S" | "T" }[];
};

export type EvidenceQuestion = {
  step_index: number;
  item_id: string;
  stem: string;
  options: EvidenceOption[];
  selection_reason: string;
  entropy_before: number;
  expected_ig: number;
  candidates: { rank: number; item_id: string; eig: number }[];
};

export type EvidenceStep = {
  step_index: number;
  item_id: string;
  option_id: "A" | "B" | "C" | "D";
  answer_note: string;
  posterior: number[];
  support: number[];
};

export type Evidence = {
  session_id: string;
  unit_id: string;
  question_budget: number;
  release: string;
  content_version: string;
  params_sha256: string;
  engine_release: string;
  started_at: string;
  ended_at: string | null;
  student: { display_name: string };
  class: { class_id: string; name: string };
  assignment: { assignment_id: string; title: string } | null;
  hypotheses: { slot: number; hypothesis_id: string; kind: "misconception" | "none" | "unmodelled"; prior: number; name: string }[];
  questions: EvidenceQuestion[];
  steps: EvidenceStep[];
  outcome: {
    outcome: SessionOutcome;
    diagnosis_candidates: [number, number][];
    escalation_reason: string | null;
    escalation_leader_slot: number | null;
    escalation_candidates: [number, number][];
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OUTCOMES: SessionOutcome[] = ["in_progress", "diagnosed", "none_detected", "escalated_no_separator",
  "escalated_exhausted", "escalated_unmodelled", "abandoned"];
const OPTIONS = ["A", "B", "C", "D"] as const;

function fail(what: string): never {
  throw new Error(`Invalid evidence: ${what}`);
}
function obj(v: unknown, what: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) fail(what);
  return v as Record<string, unknown>;
}
function arr(v: unknown, what: string, max = 1000): unknown[] {
  if (!Array.isArray(v) || v.length > max) fail(what);
  return v;
}
function str(v: unknown, what: string, max = 2000): string {
  if (typeof v !== "string" || v.length > max) fail(what);
  return v;
}
function num(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(what);
  return v;
}
function int(v: unknown, what: string, min = 0): number {
  if (!Number.isInteger(v) || (v as number) < min) fail(what);
  return v as number;
}
function option(v: unknown, what: string) {
  if (!OPTIONS.includes(v as (typeof OPTIONS)[number])) fail(what);
  return v as (typeof OPTIONS)[number];
}
function pairs(v: unknown, what: string): [number, number][] {
  return arr(v, what, 100).map((p) => {
    const pair = arr(p, what, 2);
    if (pair.length !== 2) fail(what);
    return [int(pair[0], what), int(pair[1], what)];
  });
}

export function parseEvidence(value: unknown): Evidence {
  const v = obj(value, "body");
  const sid = str(v.session_id, "session_id", 36);
  if (!UUID.test(sid)) fail("session_id");
  const student = obj(v.student, "student");
  const room = obj(v.class, "class");
  const classId = str(room.class_id, "class_id", 36);
  if (!UUID.test(classId)) fail("class_id");
  const assignment = v.assignment === null ? null : obj(v.assignment, "assignment");
  if (assignment && !UUID.test(str(assignment.assignment_id, "assignment_id", 36))) fail("assignment_id");
  const outcome = obj(v.outcome, "outcome");
  if (!OUTCOMES.includes(outcome.outcome as SessionOutcome)) fail("outcome");
  const hypotheses = arr(v.hypotheses, "hypotheses", 100).map((raw) => {
    const h = obj(raw, "hypothesis");
    if (h.kind !== "misconception" && h.kind !== "none" && h.kind !== "unmodelled") fail("kind");
    return { slot: int(h.slot, "slot"), hypothesis_id: str(h.hypothesis_id, "hypothesis_id", 64),
      kind: h.kind as Evidence["hypotheses"][number]["kind"], prior: num(h.prior, "prior"), name: str(h.name, "name", 512) };
  });
  const width = hypotheses.length;
  const vector = (raw: unknown, what: string) => {
    const values = arr(raw, what, 100).map((x) => num(x, what));
    if (values.length !== width) fail(what);
    return values;
  };
  return {
    session_id: sid,
    unit_id: str(v.unit_id, "unit_id", 32),
    question_budget: int(v.question_budget, "question_budget", 1),
    release: str(v.release, "release", 256),
    content_version: str(v.content_version, "content_version", 256),
    params_sha256: str(v.params_sha256, "params_sha256", 64),
    engine_release: str(v.engine_release, "engine_release", 256),
    started_at: str(v.started_at, "started_at", 64),
    ended_at: v.ended_at === null ? null : str(v.ended_at, "ended_at", 64),
    student: { display_name: str(student.display_name, "display_name", 256) },
    class: { class_id: classId, name: str(room.name, "class name", 256) },
    assignment: assignment
      ? { assignment_id: assignment.assignment_id as string, title: str(assignment.title, "title", 256) }
      : null,
    hypotheses,
    questions: arr(v.questions, "questions", 200).map((raw) => {
      const q = obj(raw, "question");
      return {
        step_index: int(q.step_index, "step_index"),
        item_id: str(q.item_id, "item_id", 64),
        stem: str(q.stem, "stem", 4000),
        options: arr(q.options, "options", 4).map((rawOption) => {
          const o = obj(rawOption, "option");
          if (typeof o.is_correct !== "boolean") fail("is_correct");
          return {
            option_id: option(o.option_id, "option_id"),
            text: str(o.text, "option text", 2000),
            is_correct: o.is_correct,
            links: arr(o.links, "links", 10).map((rawLink) => {
              const l = obj(rawLink, "link");
              if (l.grade !== "S" && l.grade !== "T") fail("grade");
              return { misconception_id: str(l.misconception_id, "misconception_id", 64), name: str(l.name, "link name", 512),
                grade: l.grade as "S" | "T" };
            }),
          };
        }),
        selection_reason: str(q.selection_reason, "selection_reason", 4000),
        entropy_before: num(q.entropy_before, "entropy_before"),
        expected_ig: num(q.expected_ig, "expected_ig"),
        candidates: arr(q.candidates, "candidates", 500).map((rawCandidate) => {
          const c = obj(rawCandidate, "candidate");
          return { rank: int(c.rank, "rank", 1), item_id: str(c.item_id, "candidate item", 64), eig: num(c.eig, "eig") };
        }),
      };
    }),
    steps: arr(v.steps, "steps", 200).map((raw) => {
      const s = obj(raw, "step");
      return {
        step_index: int(s.step_index, "step_index"),
        item_id: str(s.item_id, "step item", 64),
        option_id: option(s.option_id, "step option"),
        answer_note: str(s.answer_note, "answer_note", 2000),
        posterior: vector(s.posterior, "posterior"),
        support: vector(s.support, "support").map((x) => int(x, "support")),
      };
    }),
    outcome: {
      outcome: outcome.outcome as SessionOutcome,
      diagnosis_candidates: pairs(outcome.diagnosis_candidates, "diagnosis_candidates"),
      escalation_reason: outcome.escalation_reason === null ? null : str(outcome.escalation_reason, "escalation_reason", 4000),
      escalation_leader_slot: outcome.escalation_leader_slot === null ? null : int(outcome.escalation_leader_slot, "leader slot"),
      escalation_candidates: pairs(outcome.escalation_candidates, "escalation_candidates"),
    },
  };
}
