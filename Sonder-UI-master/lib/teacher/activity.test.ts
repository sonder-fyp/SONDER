import { describe, expect, it } from "vitest";
import { counts, FILTERS, matches, ordered, parseActivityRow, type ActivityRow } from "./activity";

const base = {
  student_id: "33333333-3333-4333-8333-333333333333", student_name: "Ana", assignment_id: "55555555-5555-4555-8555-555555555555",
  assignment_title: "Rounding", unit_code: "U1", attempt_rule: "single", state: "not_started", session_id: null, answered: 0,
  question_budget: null, attempts: 0, last_activity: null, review_status: null,
};
const row = (overrides: Record<string, unknown>): ActivityRow => parseActivityRow({ ...base, ...overrides });
const sid = "77777777-7777-4777-8777-777777777777";

const rows = [
  row({ student_name: "Ana" }),
  row({ student_name: "Ben", state: "in_progress", session_id: sid, answered: 2, question_budget: 8, attempts: 1, last_activity: "2026-11-18T10:00:00Z" }),
  row({ student_name: "Cai", state: "completed", session_id: sid, answered: 4, question_budget: 8, attempts: 1, last_activity: "2026-11-18T11:00:00Z" }),
  row({ student_name: "Dia", state: "completed", session_id: sid, answered: 5, question_budget: 8, attempts: 1, last_activity: "2026-11-18T09:00:00Z", review_status: "follow_up_required" }),
  row({ student_name: "Eli", state: "completed", session_id: sid, answered: 6, question_budget: 8, attempts: 2, last_activity: "2026-11-18T08:00:00Z", review_status: "reviewed" }),
];

describe("dashboard counts", () => {
  it("are computed from the rows with the same test the table filter uses", () => {
    const summary = counts(rows);
    expect(summary).toEqual({ all: 5, not_started: 1, in_progress: 1, completed: 3, needs_review: 1, follow_up: 1 });
    for (const { value } of FILTERS) expect(rows.filter((r) => matches(r, value))).toHaveLength(summary[value]);
  });

  it("every filter has a written definition", () => {
    expect(FILTERS.every((f) => f.definition.length > 20)).toBe(true);
  });

  it("orders by latest activity, never-started last, then by name", () => {
    expect(ordered(rows).map((r) => r.student_name)).toEqual(["Cai", "Ben", "Dia", "Eli", "Ana"]);
  });
});

describe("activity row parser", () => {
  it("accepts database timestamps and rejects unknown states", () => {
    expect(row({ last_activity: new Date("2026-11-18T10:00:00Z"), state: "completed", session_id: sid }).last_activity).toBe("2026-11-18T10:00:00.000Z");
    expect(() => row({ state: "graded" })).toThrow();
    expect(() => row({ review_status: "approved" })).toThrow();
  });
});
