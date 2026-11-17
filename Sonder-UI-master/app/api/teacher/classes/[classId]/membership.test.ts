// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), query: vi.fn(), origin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/access", () => ({
  AccessError: class AccessError extends Error { constructor(public status: 401 | 403, message: string) { super(message); } },
  requireAccess: mocks.access,
}));
vi.mock("@/lib/auth/origin", () => ({ isSameOrigin: mocks.origin }));
vi.mock("@/lib/auth/database", () => ({ database: () => mocks.query }));
import { PATCH } from "./route";
import { GET as ROSTER } from "./roster/route";
import { DELETE as REMOVE } from "./roster/[studentId]/route";
import { POST as NEW_CODE } from "./join-code/route";

const teacher = "00000000-0000-4000-8000-000000000007";
const classId = "11111111-1111-4111-8111-111111111111";
const studentId = "33333333-3333-4333-8333-333333333333";
const room = {
  class_id: classId, name: "Grade 8 Blue", note: "", join_code: "NEWCODE234", grade_level: 8,
  status: "archived", student_count: 1, created_at: "2026-11-18T09:00:00.000Z",
};
const req = (method: string, body?: unknown) => new Request("http://localhost/api/teacher/classes", {
  method, headers: { origin: "http://localhost" }, body: body === undefined ? undefined : JSON.stringify(body),
});
const params = () => ({ params: Promise.resolve({ classId }) });
const student = (id = studentId) => ({ params: Promise.resolve({ classId, studentId: id }) });
const productError = (code: string) => Object.assign(new Error(code), { code: "SN001" });
const sql = (call: unknown[]) => (call[0] as string[]).join("?");

describe("teacher class membership routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ appUserId: teacher, role: "teacher" });
    mocks.origin.mockReturnValue(true);
  });

  it("returns the roster only after confirming the class is the teacher's", async () => {
    mocks.query.mockResolvedValueOnce([room]).mockResolvedValueOnce([
      { student_id: studentId, display_name: "Ali", joined_at: new Date("2026-11-18T10:00:00Z") },
    ]);
    const res = await ROSTER(req("GET"), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ students: [{ student_id: studentId, display_name: "Ali", joined_at: "2026-11-18T10:00:00.000Z" }] });
    expect(sql(mocks.query.mock.calls[1])).toContain("sonder.class_roster(");
    mocks.query.mockResolvedValueOnce([]);
    const other = await ROSTER(req("GET"), params());
    expect(other.status).toBe(404);
    expect(mocks.query).toHaveBeenCalledTimes(3);
  });

  it("removes a student and maps not-found cases", async () => {
    mocks.query.mockResolvedValueOnce([{}]);
    const res = await REMOVE(req("DELETE"), student());
    expect(res.status).toBe(200);
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([teacher, classId, studentId]);
    mocks.query.mockRejectedValueOnce(productError("student_not_found"));
    expect((await REMOVE(req("DELETE"), student())).status).toBe(404);
    mocks.query.mockRejectedValueOnce(productError("class_not_found"));
    expect(await (await REMOVE(req("DELETE"), student())).json()).toEqual({ error: { code: "class_not_found" } });
    expect((await REMOVE(req("DELETE"), student("nope"))).status).toBe(404);
    expect(mocks.query).toHaveBeenCalledTimes(3);
  });

  it("issues a new code and returns the updated class", async () => {
    mocks.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([room]);
    const res = await NEW_CODE(req("POST"), params());
    expect(res.status).toBe(200);
    expect((await res.json()).class.join_code).toBe("NEWCODE234");
    expect(sql(mocks.query.mock.calls[0])).toContain("sonder.regenerate_join_code(");
    mocks.query.mockRejectedValueOnce(productError("class_not_found"));
    expect((await NEW_CODE(req("POST"), params())).status).toBe(404);
  });

  it("archives or restores with a validated status", async () => {
    mocks.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([room]);
    const res = await PATCH(req("PATCH", { status: "archived" }), params());
    expect(res.status).toBe(200);
    expect((await res.json()).class.status).toBe("archived");
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([teacher, classId, "archived"]);
    for (const body of [{ status: "closed" }, {}, { status: null }]) {
      const bad = await PATCH(req("PATCH", body), params());
      expect(bad.status).toBe(422);
      expect(await bad.json()).toEqual({ error: { code: "class_status_invalid" } });
    }
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("refuses cross-origin changes before touching the database", async () => {
    mocks.origin.mockReturnValue(false);
    for (const res of [
      await PATCH(req("PATCH", { status: "archived" }), params()),
      await REMOVE(req("DELETE"), student()),
      await NEW_CODE(req("POST"), params()),
    ]) {
      expect(res.status).toBe(403);
    }
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
