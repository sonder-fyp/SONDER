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
import { GET } from "./route";

const student = "00000000-0000-4000-8000-000000000003";
const FORBIDDEN = ["MATH-", "posterior", "probability", "diagnos", "misconception", "is_correct", "review", "outcome"];
const row = {
  assignment_id: "55555555-5555-4555-8555-555555555555", class_id: "11111111-1111-4111-8111-111111111111", class_name: "Grade 8",
  title: "Rounding check", unit_code: "U1", unit_name: "Rounding", attempt_rule: "single", created_at: new Date("2026-11-18T09:00:00Z"),
  latest_session_id: "77777777-7777-4777-8777-777777777777", latest_state: "submitted", answered: 4, question_budget: 8, attempts: 1,
};

describe("student dashboard route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ appUserId: student, role: "student" }); });

  it("returns only the student's own cards with student-safe fields", async () => {
    // Even if a query ever returned extra columns, the parser drops them.
    mocks.query.mockResolvedValueOnce([{ ...row, diagnosis: "MATH-1248", review_status: "follow_up_required", posterior: [0.9] }]);
    const res = await GET(new Request("http://localhost/api/student/dashboard"), {});
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    for (const word of FORBIDDEN) expect(text).not.toContain(word);
    expect(text).toContain("Rounding check");
    expect((mocks.query.mock.calls[0][0] as string[]).join("?")).toContain("sonder.student_dashboard(");
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([student]);
    expect(mocks.access).toHaveBeenCalledWith(["student"]);
  });

  it("refuses teachers and anonymous callers", async () => {
    mocks.access.mockRejectedValueOnce(new AccessError(403, "Wrong role."));
    expect((await GET(new Request("http://localhost/api/student/dashboard"), {})).status).toBe(403);
    mocks.access.mockRejectedValueOnce(new AccessError(401, "Sign in."));
    expect((await GET(new Request("http://localhost/api/student/dashboard"), {})).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
