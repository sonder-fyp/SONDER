export const sid = "11111111-1111-4111-8111-111111111111";
export const catalogue = { contract_version: 1, subject: "Mathematics", question_budget: 8,
  units: [{ unit_id: "U1", name: "Rounding", item_count: 20 }] };
export function snapshot(count = 0, complete = false) {
  return { contract_version: 1, session_id: sid, unit: { unit_id: "U1", name: "Rounding" },
    question_budget: 8, answered_count: count, status: complete ? "complete" : "in_progress",
    question: complete ? null : { step_index: count, item_id: `item-${count}`, stem: "3⁴ − ∛27?",
      options: Array.from("ABCD", option_id => ({ option_id, text: `Answer ${option_id}` })) } };
}
