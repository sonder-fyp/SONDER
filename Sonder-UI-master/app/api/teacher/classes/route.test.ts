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
import { AccessError } from "@/lib/auth/access";
import { GET, POST } from "./route";
import { GET as GET_ONE } from "./[classId]/route";

const teacher = "00000000-0000-4000-8000-000000000007";
const classId = "11111111-1111-4111-8111-111111111111";
const row = {
  class_id: classId, name: "Grade 8 Blue", note: "", join_code: "ABCDEFGHJK", grade_level: 8,
  status: "active", student_count: 0, created_at: new Date("2026-11-18T09:00:00Z"),
};
const post = (body: unknown) => new Request("http://localhost/api/teacher/classes", {
  method: "POST", headers: { origin: "http://localhost" }, body: typeof body === "string" ? body : JSON.stringify(body),
});
const get = () => new Request("http://localhost/api/teacher/classes");
const one = (id: string) => GET_ONE(new Request(`http://localhost/api/teacher/classes/${id}`), { params: Promise.resolve({ classId: id }) });
const productError = (code: string) => Object.assign(new Error(code), { code: "SN001" });
const sql = (call: unknown[]) => (call[0] as string[]).join("?");

describe("teacher class routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ appUserId: teacher, role: "teacher" });
    mocks.origin.mockReturnValue(true);
  });

  it("lists only the signed-in teacher's classes, newest first", async () => {
    mocks.query.mockResolvedValueOnce([row]);
    const res = await GET(get(), {});
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ classes: [{ ...row, created_at: "2026-11-18T09:00:00.000Z" }] });
    expect(sql(mocks.query.mock.calls[0])).toContain("sonder.teacher_classes(");
    expect(sql(mocks.query.mock.calls[0])).toContain("ORDER BY created_at DESC, class_id");
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([teacher]);
    expect(mocks.access).toHaveBeenCalledWith(["teacher"]);
  });

  it("creates a class for the account from the session, ignoring any teacher in the body", async () => {
    mocks.query.mockResolvedValueOnce([{ class_id: classId }]).mockResolvedValueOnce([row]);
    const res = await POST(post({ name: "  Grade 8 Blue ", note: " ", teacher_id: "someone-else" }), {});
    expect(res.status).toBe(201);
    expect((await res.json()).class.class_id).toBe(classId);
    expect(sql(mocks.query.mock.calls[0])).toContain("sonder.create_class(");
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([teacher, "Grade 8 Blue", ""]);
  });

  it("refuses anonymous, non-teacher and cross-origin requests before touching the database", async () => {
    mocks.access.mockRejectedValueOnce(new AccessError(401, "Authentication required."));
    expect((await GET(get(), {})).status).toBe(401);
    mocks.access.mockRejectedValueOnce(new AccessError(403, "Wrong role."));
    const denied = await POST(post({ name: "A" }), {});
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: { code: "role_required" } });
    mocks.origin.mockReturnValueOnce(false);
    expect((await POST(post({ name: "A" }), {})).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("validates the body with typed errors", async () => {
    const cases: [unknown, string][] = [
      ["not json", "invalid_request"], [[], "invalid_request"], [{}, "class_name_invalid"],
      [{ name: "   " }, "class_name_invalid"], [{ name: "x".repeat(81) }, "class_name_invalid"],
      [{ name: "A", note: 4 }, "class_note_invalid"], [{ name: "A", note: "n".repeat(501) }, "class_note_invalid"],
    ];
    for (const [body, code] of cases) {
      const res = await POST(post(body), {});
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: { code } });
    }
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("maps database rule errors and hides unexpected failures", async () => {
    mocks.query.mockRejectedValueOnce(productError("subject_missing"));
    const missing = await POST(post({ name: "A" }), {});
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ error: { code: "subject_missing" } });
    mocks.query.mockRejectedValueOnce(productError("teacher_required"));
    expect((await POST(post({ name: "A" }), {})).status).toBe(403);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query.mockRejectedValueOnce(Object.assign(new Error("password=secret"), { code: "08006" }));
    const failed = await POST(post({ name: "A" }), {});
    expect(failed.status).toBe(503);
    expect(JSON.stringify(await failed.json())).not.toContain("secret");
    quiet.mockRestore();
  });

  it("returns a class only to its teacher and treats every other id as not found", async () => {
    mocks.query.mockResolvedValueOnce([row]);
    const found = await one(classId);
    expect(found.status).toBe(200);
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([teacher, classId]);
    mocks.query.mockResolvedValueOnce([]);
    const other = await one("22222222-2222-4222-8222-222222222222");
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: { code: "class_not_found" } });
    for (const bad of ["not-a-uuid", "' OR 1=1 --", `${classId}x`]) {
      expect((await one(bad)).status).toBe(404);
    }
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});
