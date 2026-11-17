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

const teacher = "00000000-0000-4000-8000-000000000007";
const classId = "11111111-1111-4111-8111-111111111111";
const assignment = "55555555-5555-4555-8555-555555555555";
const room = { class_id: classId, name: "Grade 8", note: "", join_code: "ABCDEFGHJK", grade_level: 8, status: "active",
  student_count: 1, created_at: new Date("2026-11-18T09:00:00Z") };
const row = { student_id: "33333333-3333-4333-8333-333333333333", student_name: "Ana", assignment_id: assignment,
  assignment_title: "Rounding", unit_code: "U1", attempt_rule: "single", state: "completed",
  session_id: "77777777-7777-4777-8777-777777777777", answered: 4, question_budget: 8, attempts: 1,
  last_activity: new Date("2026-11-18T10:00:00Z"), review_status: null };
const call = (query = "") => GET(new Request(`http://localhost/api/teacher/classes/${classId}/activity${query}`),
  { params: Promise.resolve({ classId }) });
const sql = (c: unknown[]) => (c[0] as string[]).join("?");

describe("class activity route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ appUserId: teacher, role: "teacher" }); });

  it("returns the rows of the teacher's class, optionally for one assignment", async () => {
    mocks.query.mockResolvedValueOnce([room]).mockResolvedValueOnce([row]);
    const res = await call(`?assignment=${assignment}`);
    expect(res.status).toBe(200);
    expect((await res.json()).rows[0]).toMatchObject({ student_name: "Ana", last_activity: "2026-11-18T10:00:00.000Z" });
    expect(sql(mocks.query.mock.calls[1])).toContain("sonder.class_activity(");
    expect(mocks.query.mock.calls[1].slice(1)).toEqual([teacher, classId, assignment]);
    mocks.query.mockResolvedValueOnce([room]).mockResolvedValueOnce([]);
    await call();
    expect(mocks.query.mock.calls[3].slice(1)).toEqual([teacher, classId, null]);
  });

  it("is not found for another teacher's class or a malformed assignment", async () => {
    mocks.query.mockResolvedValueOnce([]);
    expect((await call()).status).toBe(404);
    expect(await (await call("?assignment=nope")).json()).toEqual({ error: { code: "assignment_not_found" } });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("refuses students", async () => {
    mocks.access.mockRejectedValueOnce(new AccessError(403, "Wrong role."));
    expect((await call()).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
