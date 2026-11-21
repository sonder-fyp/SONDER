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
const sessionId = "77777777-7777-4777-8777-777777777777";
const attempt = { session_id: sessionId, attempt_number: 1, state: "completed", answered: 4, question_budget: 8,
  started_at: new Date("2026-11-18T09:00:00Z"), ended_at: new Date("2026-11-18T10:00:00Z"), review_status: null };
const call = (id = sessionId) => GET(new Request(`http://localhost/api/teacher/sessions/${id}/attempts`),
  { params: Promise.resolve({ sessionId: id }) });
const sql = (c: unknown[]) => (c[0] as string[]).join("?");

describe("session attempts route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ appUserId: teacher, role: "teacher" }); });

  it("returns the attempts when the teacher can see the session", async () => {
    mocks.query.mockResolvedValueOnce([{ "?column?": 1 }]).mockResolvedValueOnce([attempt]);
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).attempts[0]).toMatchObject({ attempt_number: 1 });
    expect(sql(mocks.query.mock.calls[1])).toContain("sonder.session_attempts(");
    expect(mocks.query.mock.calls[1].slice(1)).toEqual([teacher, sessionId]);
  });

  it("is not found for a malformed id without a query", async () => {
    expect((await call("nope")).status).toBe(404);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("is not found when the teacher cannot see the session", async () => {
    mocks.query.mockResolvedValueOnce([]);
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "session_not_found" } });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
