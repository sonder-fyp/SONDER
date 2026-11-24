// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/access", () => ({
  AccessError: class AccessError extends Error { constructor(public status: 401 | 403, message: string) { super(message); } },
  requireAccess: mocks.access,
}));
vi.mock("@/lib/auth/database", () => ({ database: () => mocks.query }));
import { GET } from "./route";

const teacher = "00000000-0000-4000-8000-000000000007";
const classId = "11111111-1111-4111-8111-111111111111";
const room = { class_id: classId, name: "Grade 8", note: "", join_code: "ABCDEFGHJK", grade_level: 8, status: "active",
  student_count: 1, created_at: new Date("2026-11-18T09:00:00Z") };
const check = { session_id: "77777777-7777-4777-8777-777777777777", student_name: "Ana", unit_code: "U1", unit_name: "Rounding",
  state: "completed", answered: 4, question_budget: 8, started_at: new Date("2026-11-18T09:00:00Z"),
  ended_at: new Date("2026-11-18T10:00:00Z"), review_status: null };
const call = () => GET(new Request(`http://localhost/api/teacher/classes/${classId}/other-checks`),
  { params: Promise.resolve({ classId }) });
const sql = (c: unknown[]) => (c[0] as string[]).join("?");

describe("class other checks route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ appUserId: teacher, role: "teacher" }); });

  it("returns the checks of the teacher's class", async () => {
    mocks.query.mockResolvedValueOnce([room]).mockResolvedValueOnce([check]);
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).checks[0]).toMatchObject({ student_name: "Ana" });
    expect(sql(mocks.query.mock.calls[1])).toContain("sonder.class_other_checks(");
    expect(mocks.query.mock.calls[1].slice(1)).toEqual([teacher, classId]);
  });

  it("is not found for a class that is not the teacher's, without reading checks", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "class_not_found" } });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
