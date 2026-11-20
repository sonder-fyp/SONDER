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

const student = "00000000-0000-4000-8000-000000000003";
const classId = "11111111-1111-4111-8111-111111111111";
const room = { class_id: classId, name: "Grade 8 Blue", grade_level: 8, teacher_names: "Ms Khan", joined_at: new Date("2026-11-18T09:00:00Z") };
const post = (body: unknown) => new Request("http://localhost/api/student/classes", {
  method: "POST", headers: { origin: "http://localhost" }, body: typeof body === "string" ? body : JSON.stringify(body),
});
const productError = (code: string) => Object.assign(new Error(code), { code: "SN001" });
const sql = (call: unknown[]) => (call[0] as string[]).join("?");

describe("student class routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ appUserId: student, role: "student" });
    mocks.origin.mockReturnValue(true);
  });

  it("lists the student's own classes without join codes", async () => {
    mocks.query.mockResolvedValueOnce([room]);
    const res = await GET(new Request("http://localhost/api/student/classes"), {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ classes: [{ ...room, joined_at: "2026-11-18T09:00:00.000Z" }] });
    expect(JSON.stringify(body)).not.toContain("join_code");
    expect(sql(mocks.query.mock.calls[0])).toContain("sonder.student_classes(");
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([student]);
    expect(mocks.access).toHaveBeenCalledWith(["student"]);
  });

  it("joins with the code as typed and reports whether it was new", async () => {
    mocks.query.mockResolvedValueOnce([{ class_id: classId, joined: true }]).mockResolvedValueOnce([room]);
    const res = await POST(post({ code: " abcd-efgh jk ", student_id: "someone-else" }), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ joined: true, class: { class_id: classId } });
    expect(sql(mocks.query.mock.calls[0])).toContain("sonder.join_class(");
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([student, " abcd-efgh jk "]);
  });

  it("gives one error for wrong codes and validates the body first", async () => {
    mocks.query.mockRejectedValueOnce(productError("join_code_invalid"));
    const wrong = await POST(post({ code: "WRONGCODE1" }), {});
    expect(wrong.status).toBe(422);
    expect(await wrong.json()).toEqual({ error: { code: "join_code_invalid" } });
    for (const body of [{}, { code: "   " }, { code: 12 }, { code: "x".repeat(65) }, []]) {
      expect((await POST(post(body), {})).status).toBe(422);
    }
    expect(await (await POST(post("not json"), {})).json()).toEqual({ error: { code: "invalid_request" } });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("refuses teachers, anonymous users and cross-origin joins before touching the database", async () => {
    mocks.access.mockRejectedValueOnce(new AccessError(403, "Wrong role."));
    expect((await POST(post({ code: "ABCDEFGHJK" }), {})).status).toBe(403);
    mocks.access.mockRejectedValueOnce(new AccessError(401, "Authentication required."));
    expect((await GET(new Request("http://localhost/api/student/classes"), {})).status).toBe(401);
    mocks.origin.mockReturnValueOnce(false);
    expect((await POST(post({ code: "ABCDEFGHJK" }), {})).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
