export type Unit = { unit_id: string; name: string; item_count: number };
export type Catalogue = { contract_version: 1; subject: string; question_budget: number; units: Unit[] };
export type OptionId = "A" | "B" | "C" | "D";
export type Question = { step_index: number; item_id: string; stem: string; options: { option_id: OptionId; text: string }[] };
type SnapshotBase = { contract_version: 1; session_id: string; unit: Pick<Unit, "unit_id" | "name">; question_budget: number; answered_count: number };
export type Snapshot = SnapshotBase & ({ status: "in_progress"; question: Question } | { status: "complete"; question: null });
export type BeginRequest = { unit_id: string; create_request_id: string };
export type AnswerRequest = { step_index: number; item_id: string; option_id: OptionId };

export type TeacherOutcome = "diagnosed" | "none_detected" | "escalated_no_separator" | "escalated_exhausted" | "escalated_unmodelled";
export type TeacherHypothesis = { id: string; name: string; kind: "misconception" | "none" | "unmodelled"; prior: number; final: number; support: number };
export type TeacherStep = {
  step_index: number; item_id: string; reason: string; expected_ig: number; option_id: OptionId;
  answer_note: string; leader: string; leader_probability: number;
};
export type TeacherResult = {
  session_id: string; finished_seq: number; unit: Pick<Unit, "unit_id" | "name">;
  question_budget: number; answered_count: number;
  outcome: TeacherOutcome; rule: string; leader: string; leader_name: string;
  tied: string[]; detail: string; hypotheses: TeacherHypothesis[]; steps: TeacherStep[];
};
