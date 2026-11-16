// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/access", () => ({
  AccessError: class AccessError extends Error { constructor(public status: 401 | 403, message: string) { super(message); } },
  requireAccess: vi.fn(async () => ({ appUserId: "00000000-0000-4000-8000-000000000002" })),
  requireApiRole: vi.fn(async () => ({ user: { id: "00000000-0000-4000-8000-000000000001" },
    account: { id: "00000000-0000-4000-8000-000000000002", role: "student" } })),
}));
import { AccessError, requireAccess } from "@/lib/auth/access";
import { answerRoute, beginRoute, catalogueRoute, currentRoute, unfinishedRoute } from "./routes";
import { catalogue, sid, snapshot } from "./testFixtures";

const origin = "http://127.0.0.1:3000";
const nonce = "22222222-2222-4222-8222-222222222222";
const account = "00000000-0000-4000-8000-000000000002";
const payload = { unit_id: "U1", create_request_id: nonce };
function request(body?: unknown, requestOrigin = origin) {
  return new Request(`${origin}/api/diagnostic/sessions`, { method: body ? "POST" : "GET", headers: { origin: requestOrigin }, body: body ? JSON.stringify(body) : undefined });
}
function upstream(value: unknown, status = 200) { return Response.json(value, { status }); }
describe("student BFF", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubEnv("SONDER_ENGINE_TOKEN", "t".repeat(32)); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("sends the account as actor and ignores browser identity and cookies", async () => {
    fetchMock.mockResolvedValue(upstream(snapshot()));
    const req = request(payload); req.headers.set("X-Sonder-Actor", "forged"); req.headers.set("cookie", "sonder_run_x=y");
    const res = await beginRoute(req);
    expect(res.status).toBe(200); expect(res.headers.get("set-cookie")).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers["X-Sonder-Actor"]).toBe(account);
    expect(fetchMock.mock.calls[0][1].headers["X-Sonder-Owner"]).toBeUndefined();
  });
  it("forwards identical begins identically", async () => {
    fetchMock.mockImplementation(async () => upstream(snapshot()));
    const [a, b] = await Promise.all([beginRoute(request(payload)), beginRoute(request(payload))]);
    expect([a.status, b.status]).toEqual([200, 200]); expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });
  it("uses the actor for current and answer and rejects malformed IDs", async () => {
    fetchMock.mockImplementation(async () => upstream(snapshot()));
    expect((await currentRoute(request(), sid)).status).toBe(200);
    expect((await answerRoute(request({ step_index: 0, item_id: "T1-005", option_id: "A" }), sid)).status).toBe(200);
    expect(fetchMock.mock.calls.every(c => c[1].headers["X-Sonder-Actor"] === account)).toBe(true);
    fetchMock.mockClear();
    for (const bad of ["../trace", "guessed"]) expect((await currentRoute(request(), bad)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("checks origin, strict body and configuration", async () => {
    for (const bad of ["http://evil.example", "http://localhost:3001", "https://localhost:3000", "http://127.0.0.1:3001", "null"]) expect((await beginRoute(request(payload, bad))).status).toBe(403);
    expect((await beginRoute(request({ ...payload, budget: 3 }))).status).toBe(422);
    expect((await beginRoute(new Request(origin, { method: "POST", headers: { origin }, body: "{" }))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled(); vi.stubEnv("SONDER_ENGINE_TOKEN", "");
    expect((await beginRoute(request(payload))).status).toBe(503);
  });
  it("forwards assignment only when supplied", async () => {
    fetchMock.mockImplementation(async () => upstream(snapshot()));
    await beginRoute(request({ ...payload, assignment_id: account })); await beginRoute(request({ ...payload, assignment_id: null }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).assignment_id).toBe(account);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).assignment_id).toBeUndefined();
  });
  it("maps authentication and role errors", async () => {
    for (const [status, code] of [[401, "authentication_required"], [403, "role_required"]] as const) {
      vi.mocked(requireAccess).mockRejectedValueOnce(new AccessError(status, code));
      const res = await beginRoute(request(payload)); expect(res.status).toBe(status); expect(await res.json()).toEqual({ error: { code } });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("projects responses, passes known errors, and rejects mismatched sessions", async () => {
    fetchMock.mockResolvedValueOnce(upstream({ ...catalogue, trace: "secret" })); expect(await (await catalogueRoute()).json()).toEqual(catalogue);
    fetchMock.mockResolvedValueOnce(upstream({ ...snapshot(), outcome: "secret" })); expect(await (await currentRoute(request(), sid)).json()).toEqual(snapshot());
    for (const [status, code] of [[409, "answer_conflict"], [503, "storage_unavailable"], [500, "replay_mismatch"]] as const) {
      fetchMock.mockResolvedValueOnce(upstream({ error: { code, detail: "secret" } }, status)); const res = await currentRoute(request(), sid);
      expect(res.status).toBe(status); expect(await res.json()).toEqual({ error: { code } });
    }
    fetchMock.mockResolvedValueOnce(upstream({ ...snapshot(), session_id: nonce })); expect((await currentRoute(request(), sid)).status).toBe(503);
  });
  it("forwards unfinished lookup and rejects invalid units", async () => {
    fetchMock.mockResolvedValueOnce(upstream({ contract_version: 2, sessions: [], secret: true }));
    const response = await unfinishedRoute(new Request(`${origin}/api/diagnostic/sessions?unit_id=U1`));
    expect(await response.json()).toEqual({ contract_version: 2, sessions: [] });
    expect(fetchMock.mock.calls[0][0]).toContain("status=in_progress&unit_id=U1");
    expect(fetchMock.mock.calls[0][1].headers["X-Sonder-Actor"]).toBe(account);
    fetchMock.mockClear();
    expect((await unfinishedRoute(new Request(`${origin}/api/diagnostic/sessions?unit_id=%21`))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps unreachable, timeout and invalid contracts safely", async () => {
    for (const [error, status] of [[new Error("secret"), 503], [new DOMException("timeout", "TimeoutError"), 504]] as const) {
      fetchMock.mockRejectedValueOnce(error); expect((await catalogueRoute()).status).toBe(status);
    }
    for (const response of [upstream({ detail: "secret" }, 401), upstream({ trace: "secret" }), new Response("invalid")]) {
      fetchMock.mockResolvedValueOnce(response); expect(await (await catalogueRoute()).json()).toEqual({ error: { code: "engine_unavailable" } });
    }
  });
});
