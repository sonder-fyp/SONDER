import { describe, expect, it } from "vitest";
import { orderedQueue, parseQueue, parseQueueRow } from "./queue";

const row = {
  session_id: "77777777-7777-4777-8777-777777777777", class_id: "11111111-1111-4111-8111-111111111111", class_name: "Grade 8",
  student_name: "Ana", assignment_id: "55555555-5555-4555-8555-555555555555", assignment_title: "Rounding", unit_code: "U1",
  ended_at: new Date("2026-11-18T10:00:00Z"), review_status: null,
};

describe("teacher queue rows", () => {
  it("accepts rows with and without an assignment", () => {
    expect(parseQueueRow(row)).toMatchObject({ student_name: "Ana", ended_at: "2026-11-18T10:00:00.000Z" });
    expect(parseQueueRow({ ...row, assignment_id: null, assignment_title: null, review_status: "follow_up_required" }))
      .toMatchObject({ assignment_id: null, review_status: "follow_up_required" });
  });

  it("rejects malformed rows", () => {
    expect(() => parseQueueRow({ ...row, session_id: "nope" })).toThrow();
    expect(() => parseQueueRow({ ...row, review_status: "reviewed" })).toThrow();
    expect(() => parseQueueRow({ ...row, assignment_title: null })).toThrow();
    expect(() => parseQueueRow({ ...row, assignment_id: null })).toThrow();
    expect(() => parseQueueRow({ ...row, unit_code: "bad code!" })).toThrow();
    expect(() => parseQueueRow({ extra: 1 })).toThrow();
    expect(() => parseQueue({})).toThrow();
  });

  it("drops extra fields", () => {
    expect(Object.keys(parseQueueRow({ ...row, diagnosis: "MATH-1" }))).not.toContain("diagnosis");
  });

  it("puts the newest finished first", () => {
    const a = parseQueueRow(row);
    const b = parseQueueRow({ ...row, session_id: "88888888-8888-4888-8888-888888888888", ended_at: "2026-11-19T10:00:00Z" });
    expect(orderedQueue([a, b]).map((r) => r.session_id)).toEqual([b.session_id, a.session_id]);
  });
});
