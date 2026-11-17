/** A small evidence body in the service's exact shape, for tests (two questions, one answer). */
export const sessionId = "77777777-7777-4777-8777-777777777777";
export const classId = "11111111-1111-4111-8111-111111111111";

const option = (id: "A" | "B" | "C" | "D", text: string, isCorrect: boolean, links: unknown[] = []) =>
  ({ option_id: id, text, is_correct: isCorrect, links });

export function evidenceBody(overrides: Record<string, unknown> = {}) {
  return {
    session_id: sessionId,
    unit_id: "U1",
    question_budget: 8,
    release: "Maths_v2-U1-dev/spec-v2-prior",
    content_version: "Maths_v2-U1-dev",
    params_sha256: "b".repeat(64),
    engine_release: "0.1.0+fbe0204a623d",
    started_at: "2026-11-18T09:00:00+00:00",
    ended_at: "2026-11-18T09:05:00+00:00",
    student: { display_name: "Ali" },
    class: { class_id: classId, name: "Grade 8 Blue" },
    assignment: { assignment_id: "55555555-5555-4555-8555-555555555555", title: "Rounding check" },
    hypotheses: [
      { slot: 0, hypothesis_id: "MATH-1248", kind: "misconception", prior: 0.5, name: "Rounds too little" },
      { slot: 1, hypothesis_id: "NONE", kind: "none", prior: 0.4, name: "No misconception" },
      { slot: 2, hypothesis_id: "UNMODELLED", kind: "unmodelled", prior: 0.1, name: "Something else" },
    ],
    questions: [
      {
        step_index: 0, item_id: "T1-005", stem: "Round 48,630 to the nearest 1,000.",
        options: [
          option("A", "48,000", false), option("B", "48,600", false, [{ misconception_id: "MATH-1248", name: "Rounds too little", grade: "S" }]),
          option("C", "50,000", false), option("D", "49,000", true),
        ],
        selection_reason: "Chosen to separate NONE from MATH-1248.", entropy_before: 1.36, expected_ig: 0.79,
        candidates: [{ rank: 1, item_id: "T1-005", eig: 0.79 }, { rank: 2, item_id: "T1-006", eig: 0.7 }],
      },
      {
        step_index: 1, item_id: "T1-006", stem: "Round 3,456 to the nearest 100.",
        options: [option("A", "3,400", false), option("B", "3,450", false), option("C", "3,500", true), option("D", "4,000", false)],
        selection_reason: "Next best separator.", entropy_before: 0.9, expected_ig: 0.5, candidates: [],
      },
    ],
    steps: [{ step_index: 0, item_id: "T1-005", option_id: "B", answer_note: "B is linked to MATH-1248.",
      posterior: [0.8, 0.15, 0.05], support: [1, 0, 0] }],
    outcome: { outcome: "in_progress", diagnosis_candidates: [], escalation_reason: null,
      escalation_leader_slot: null, escalation_candidates: [] },
    ...overrides,
  };
}
