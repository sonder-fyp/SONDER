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
const row = {
  session_id: "77777777-7777-4777-8777-777777777777", class_id: "11111111-1111-4111-8111-111111111111", class_name: "Grade 8",
  student_name: "Ana", assignment_id: null, assignment_title: null, unit_code: "U1", ended_at: new Date("2026-11-18T10:00:00Z"),
  review_status: null,
};
const call = () => GET(new Request("http://localhost/api/teacher/queue"), {});
const sql = (c: unknown[]) => (c[0] as string[]).join("?");

describe("teacher queue route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ appUserId: teacher, role: "teacher" }); });

  it("returns the parsed rows of the signed-in teacher", async () => {
    mocks.query.mockResolvedValueOnce([row]);
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).rows[0]).toMatchObject({ student_name: "Ana", ended_at: "2026-11-18T10:00:00.000Z" });
    expect(sql(mocks.query.mock.calls[0])).toContain("sonder.teacher_queue(");
    expect(mocks.query.mock.calls[0].slice(1)).toEqual([teacher]);
  });

  it("stops at the access check", async () => {
    mocks.access.mockRejectedValueOnce(new AccessError(401, "Sign in."));
    expect((await call()).status).toBe(401);
    mocks.access.mockRejectedValueOnce(new AccessError(403, "Wrong role."));
    expect((await call()).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
