import { describe, expect, it } from "vitest";
import { parseAttempt, parseAttempts } from "./attempts";

const row = {
  session_id: "77777777-7777-4777-8777-777777777777", attempt_number: 2, state: "in_progress", answered: 1, question_budget: 8,
  started_at: new Date("2026-11-18T09:00:00Z"), ended_at: null, review_status: null,
};

describe("attempts", () => {
  it("accepts a valid row", () => {
    expect(parseAttempt(row)).toMatchObject({ attempt_number: 2, started_at: "2026-11-18T09:00:00.000Z", ended_at: null });
    expect(parseAttempts({ attempts: [row] })).toHaveLength(1);
  });

  it("rejects malformed rows and drops extra fields", () => {
    expect(() => parseAttempt({ ...row, attempt_number: 0 })).toThrow();
    expect(() => parseAttempt({ ...row, session_id: "x" })).toThrow();
    expect(() => parseAttempt({ ...row, review_status: "other" })).toThrow();
    expect(() => parseAttempts({})).toThrow();
    expect(Object.keys(parseAttempt({ ...row, diagnosis: "x" }))).not.toContain("diagnosis");
  });
});
