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

const teacher = "00000000-0000-4000-8000-000000000007";
const sid = "77777777-7777-4777-8777-777777777777";
const key = "22222222-2222-4222-8222-222222222222";
const review = { revision: 1, status: "follow_up_required", note: "Check place value", reviewer_name: "Ms Khan",
  created_at: new Date("2026-11-18T10:00:00Z") };
const ctx = (id = sid) => ({ params: Promise.resolve({ sessionId: id }) });
const post = (body: unknown) => new Request("http://localhost/api", {
  method: "POST", headers: { origin: "http://localhost" }, body: typeof body === "string" ? body : JSON.stringify(body),
});
const productError = (code: string) => Object.assign(new Error(code), { code: "SN001" });
const sql = (call: unknown[]) => (call[0] as string[]).join("?");
const good = { expected_revision: 0, status: "follow_up_required", note: " Check place value ", request_key: key };

describe("teacher review routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ appUserId: teacher, role: "teacher" });
    mocks.origin.mockReturnValue(true);
  });

  it("lists revisions only after confirming the check is in the teacher's class", async () => {
    mocks.query.mockResolvedValueOnce([{ "?column?": 1 }]).mockResolvedValueOnce([review]);
    const res = await GET(new Request("http://localhost/api"), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).reviews).toEqual([{ ...review, created_at: "2026-11-18T10:00:00.000Z" }]);
    expect(sql(mocks.query.mock.calls[0])).toContain("sonder.is_class_teacher(");
    mocks.query.mockResolvedValueOnce([]);
    expect((await GET(new Request("http://localhost/api"), ctx())).status).toBe(404);
    expect((await GET(new Request("http://localhost/api"), ctx("not-a-uuid"))).status).toBe(404);
    expect(mocks.query).toHaveBeenCalledTimes(3);
  });

  it("appends a revision with the expected revision and request key, trimming the note", async () => {
    mocks.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{ revision: 1 }]).mockResolvedValueOnce([review]);
    const res = await POST(post(good), ctx());
    expect(res.status).toBe(201);
    expect((await res.json()).reviews).toHaveLength(1);
    expect(sql(mocks.query.mock.calls[1])).toContain("sonder.add_session_review(");
    expect(mocks.query.mock.calls[1].slice(1)).toEqual([teacher, sid, 0, "follow_up_required", "Check place value", key]);
  });

  it("validates the body before writing", async () => {
    const cases: [unknown, string][] = [
      [{ ...good, status: "approved" }, "review_status_invalid"], [{ ...good, note: "n".repeat(2001) }, "review_note_invalid"],
      [{ ...good, expected_revision: -1 }, "invalid_request"], [{ ...good, request_key: "x" }, "invalid_request"], ["nope", "invalid_request"],
    ];
    for (const [body, code] of cases) {
      mocks.query.mockResolvedValueOnce([{}]);
      const res = await POST(post(body), ctx());
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: { code } });
    }
    expect(mocks.query).toHaveBeenCalledTimes(cases.length);
  });

  it("maps stale writes and unfinished checks", async () => {
    for (const [code, status] of [["review_conflict", 409], ["session_unfinished", 409]] as const) {
      mocks.query.mockResolvedValueOnce([{}]).mockRejectedValueOnce(productError(code));
      const res = await POST(post(good), ctx());
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: { code } });
    }
  });

  it("refuses students, anonymous callers and cross-origin writes before any query", async () => {
    mocks.access.mockRejectedValueOnce(new AccessError(403, "Wrong role."));
    expect((await GET(new Request("http://localhost/api"), ctx())).status).toBe(403);
    mocks.origin.mockReturnValueOnce(false);
    expect((await POST(post(good), ctx())).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
