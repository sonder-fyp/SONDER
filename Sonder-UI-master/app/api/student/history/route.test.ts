// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/access", () => ({
  AccessError: class AccessError extends Error { constructor(public status: 401 | 403, message: string) { super(message); } },
  requireAccess: mocks.access,
}));
vi.mock("@/lib/auth/database", () => ({ database: () => mocks.query }));
import { AccessError } from "@/lib/auth/access";
import { parseHistoryEntry, resumeHref } from "@/lib/student/history";
import { GET } from "./route";

const student = "00000000-0000-4000-8000-000000000003";
const sid = "77777777-7777-4777-8777-777777777777";
const aid = "55555555-5555-4555-8555-555555555555";
const row = { session_id: sid, unit_code: "U1", unit_name: "Rounding", class_name: "Grade 8", assignment_id: aid,
  assignment_title: "Rounding check", attempt_number: 2, started_at: new Date("2026-11-18T09:00:00Z"), ended_at: null,
  state: "in_progress", answered: 3, question_budget: 8 };

describe("student history route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ appUserId: student, role: "student" }); });

  it("returns the student's own checks with student-safe fields", async () => {
    mocks.query.mockResolvedValueOnce([{ ...row, diagnosis: "MATH-1248", posterior: [1] }]);
    const res = await GET(new Request("http://localhost/api/student/history"), {});
    const text = JSON.stringify(await res.json());
    expect(res.status).toBe(200);
    for (const word of ["MATH-", "posterior", "diagnos", "review", "outcome"]) expect(text).not.toContain(word);
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([student]);
    expect(mocks.access).toHaveBeenCalledWith(["student"]);
  });

  it("refuses teachers", async () => {
    mocks.access.mockRejectedValueOnce(new AccessError(403, "Wrong role."));
    expect((await GET(new Request("http://localhost/api/student/history"), {})).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe("history entries", () => {
  it("link an unfinished check to its own session and assignment, and nothing for submitted ones", () => {
    const entry = parseHistoryEntry(row);
    expect(resumeHref(entry)).toBe(`/student/diagnostic/U1?session=${sid}&assignment=${aid}`);
    const plain = parseHistoryEntry({ ...row, assignment_id: null, assignment_title: null, attempt_number: null });
    expect(resumeHref(plain)).toBe(`/student/diagnostic/U1?session=${sid}`);
    expect(resumeHref(parseHistoryEntry({ ...row, state: "submitted", ended_at: "2026-11-18T09:10:00Z" }))).toBeNull();
  });

  it("reject inconsistent assignment fields and result states", () => {
    expect(() => parseHistoryEntry({ ...row, attempt_number: null })).toThrow();
    expect(() => parseHistoryEntry({ ...row, state: "diagnosed" })).toThrow();
  });
});
