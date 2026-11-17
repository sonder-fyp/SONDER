// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), origin: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/access", () => ({
  AccessError: class AccessError extends Error { constructor(public status: 401 | 403, message: string) { super(message); } },
  requireAccess: mocks.access,
}));
vi.mock("@/lib/auth/origin", () => ({ isSameOrigin: mocks.origin }));
import { AccessError } from "@/lib/auth/access";
import { parseEvidence } from "@/lib/teacher/evidence";
import { evidenceBody, sessionId } from "@/lib/teacher/testEvidence";
import { GET } from "./route";

const teacher = "00000000-0000-4000-8000-000000000007";
const call = (id = sessionId) => GET(new Request(`http://localhost/api/teacher/sessions/${id}/evidence`),
  { params: Promise.resolve({ sessionId: id }) });
const upstream = (value: unknown, status = 200) => Response.json(value, { status });

describe("teacher evidence BFF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SONDER_ENGINE_TOKEN", "t".repeat(32));
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.access.mockResolvedValue({ appUserId: teacher, role: "teacher" });
  });

  it("asks the service as the signed-in teacher and returns the parsed evidence", async () => {
    mocks.fetch.mockResolvedValue(upstream(evidenceBody()));
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).evidence.student.display_name).toBe("Ali");
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe(`http://127.0.0.1:8000/engine/teacher/sessions/${sessionId}/evidence`);
    expect(init.headers["X-Sonder-Actor"]).toBe(teacher);
    expect(mocks.access).toHaveBeenCalledWith(["teacher"]);
  });

  it("passes the service's not-found through and refuses malformed ids before calling it", async () => {
    mocks.fetch.mockResolvedValue(upstream({ error: { code: "session_not_found" } }, 404));
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "session_not_found" } });
    expect((await call("../../engine/latest")).status).toBe(404);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses students and anonymous callers without calling the service", async () => {
    mocks.access.mockRejectedValueOnce(new AccessError(403, "Wrong role."));
    expect((await call()).status).toBe(403);
    mocks.access.mockRejectedValueOnce(new AccessError(401, "Sign in."));
    expect((await call()).status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("treats malformed or mismatched service replies as unavailable", async () => {
    mocks.fetch.mockResolvedValueOnce(upstream(evidenceBody({ session_id: "88888888-8888-4888-8888-888888888888" })));
    expect((await call()).status).toBe(503);
    mocks.fetch.mockResolvedValueOnce(upstream(evidenceBody({ hypotheses: "nope" })));
    expect((await call()).status).toBe(503);
  });
});

describe("evidence parser", () => {
  it("keeps only known fields", () => {
    const parsed = parseEvidence({ ...evidenceBody(), secret: "x", student: { display_name: "Ali", email: "a@b.c" } });
    expect(JSON.stringify(parsed)).not.toContain("secret");
    expect(JSON.stringify(parsed)).not.toContain("a@b.c");
  });

  it("rejects vectors that do not match the hypotheses and unknown outcomes", () => {
    const body = evidenceBody();
    expect(() => parseEvidence({ ...body, steps: [{ ...body.steps[0], posterior: [1] }] })).toThrow();
    expect(() => parseEvidence({ ...body, outcome: { ...body.outcome, outcome: "approved" } })).toThrow();
    expect(() => parseEvidence({ ...body, questions: [{ ...body.questions[0], options: [{ ...body.questions[0].options[0], option_id: "E" }] }] })).toThrow();
  });
});
