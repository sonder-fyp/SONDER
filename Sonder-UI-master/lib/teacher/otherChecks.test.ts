import { describe, expect, it } from "vitest";
import { parseOtherCheck, parseOtherChecks } from "./otherChecks";

const row = {
  session_id: "77777777-7777-4777-8777-777777777777", student_name: "Ana", unit_code: "U1", unit_name: "Rounding",
  state: "completed", answered: 4, question_budget: 8, started_at: new Date("2026-11-18T09:00:00Z"),
  ended_at: new Date("2026-11-18T10:00:00Z"), review_status: null,
};

describe("other checks", () => {
  it("accepts a valid row and an in-progress one", () => {
    expect(parseOtherCheck(row)).toMatchObject({ started_at: "2026-11-18T09:00:00.000Z", ended_at: "2026-11-18T10:00:00.000Z" });
    expect(parseOtherCheck({ ...row, state: "in_progress", ended_at: null, review_status: "reviewed" }).ended_at).toBeNull();
    expect(parseOtherChecks({ checks: [row] })).toHaveLength(1);
  });

  it("rejects malformed rows and drops extra fields", () => {
    expect(() => parseOtherCheck({ ...row, session_id: "x" })).toThrow();
    expect(() => parseOtherCheck({ ...row, state: "done" })).toThrow();
    expect(() => parseOtherCheck({ ...row, started_at: null })).toThrow();
    expect(() => parseOtherChecks({})).toThrow();
    expect(Object.keys(parseOtherCheck({ ...row, diagnosis: "x" }))).not.toContain("diagnosis");
  });
});
