export type Unit = { unit_id: string; name: string; item_count: number };
export type Catalogue = { contract_version: 1; subject: string; question_budget: number; units: Unit[] };
export type OptionId = "A" | "B" | "C" | "D";
export type Question = { step_index: number; item_id: string; stem: string; options: { option_id: OptionId; text: string }[] };
type SnapshotBase = { contract_version: 1; session_id: string; unit: Pick<Unit, "unit_id" | "name">; question_budget: number; answered_count: number };
export type Snapshot = SnapshotBase & ({ status: "in_progress"; question: Question } | { status: "complete"; question: null });
export type BeginRequest = { unit_id: string; create_request_id: string };
export type AnswerRequest = { step_index: number; item_id: string; option_id: OptionId };
