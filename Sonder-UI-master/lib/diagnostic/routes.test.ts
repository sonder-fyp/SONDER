// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { answerRoute, beginRoute, catalogueRoute, currentRoute } from "./routes";
import { beginOwner, capability, cookieName } from "./owner";
import { catalogue, sid, snapshot } from "./testFixtures";

const origin = "http://127.0.0.1:3000";
const nonce = "22222222-2222-4222-8222-222222222222";
function request(body?: unknown, cookie?: string, requestOrigin = origin) {
  return new Request(`${origin}/api/diagnostic/sessions`, { method: body ? "POST" : "GET",
    headers: { origin: requestOrigin, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
}
function upstream(value: unknown, status = 200) { return Response.json(value, { status }); }
describe("student BFF", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("SONDER_ENGINE_TOKEN", "t".repeat(32));
    vi.stubEnv("SONDER_COOKIE_KEY", "k".repeat(32));
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("same Begin retry before a cookie uses the same owner and creates a scoped cookie", async () => {
    fetchMock.mockImplementation(async () => upstream(snapshot()));
    const payload = { unit_id: "U1", create_request_id: nonce };
    const [a, b] = await Promise.all([beginRoute(request(payload)), beginRoute(request(payload))]);
    expect(a.status).toBe(200);
    expect(b.headers.get("set-cookie")).toBe(a.headers.get("set-cookie"));
    const options = fetchMock.mock.calls.map(c => c[1]);
    expect(options[0].headers["X-Sonder-Owner"]).toBe(options[1].headers["X-Sonder-Owner"]);
    expect(a.headers.get("set-cookie")).toContain(`Path=/api/diagnostic/sessions/${sid}`);
    expect(a.headers.get("set-cookie")).toContain("HttpOnly");
    expect(a.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(a.headers.get("cache-control")).toBe("no-store");
    expect(options[0].cache).toBe("no-store");
  });
  it("accepts the same loopback UI opened as localhost", async () => {
    fetchMock.mockResolvedValue(upstream(snapshot()));
    const payload = { unit_id: "U1", create_request_id: nonce };
    expect((await beginRoute(request(payload, undefined, "http://localhost:3000"))).status).toBe(200);
  });
  it("different Begin nonces have separate owner and cookie identities", async () => {
    const other = "33333333-3333-4333-8333-333333333333";
    fetchMock.mockResolvedValueOnce(upstream(snapshot())).mockResolvedValueOnce(upstream({ ...snapshot(), session_id: other }));
    const a = await beginRoute(request({ unit_id: "U1", create_request_id: nonce }));
    const b = await beginRoute(request({ unit_id: "U1", create_request_id: other }));
    expect(a.headers.get("set-cookie")).not.toBe(b.headers.get("set-cookie"));
    expect(fetchMock.mock.calls[0][1].headers["X-Sonder-Owner"]).not.toBe(fetchMock.mock.calls[1][1].headers["X-Sonder-Owner"]);
  });
  it("verifies session-bound cookie and ignores caller owner headers", async () => {
    const owner = beginOwner(nonce), cookie = `${cookieName(sid)}=${capability(sid, owner)}`;
    fetchMock.mockResolvedValue(upstream(snapshot(1)));
    const r = request({ step_index: 0, item_id: "T1-005", option_id: "D" }, cookie);
    r.headers.set("X-Sonder-Owner", "forged");
    expect((await answerRoute(r, sid)).status).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers["X-Sonder-Owner"]).toBe(owner);
    const wrongSid = "33333333-3333-4333-8333-333333333333";
    expect((await currentRoute(request(undefined, `${cookieName(wrongSid)}=${capability(sid, owner)}`), wrongSid)).status).toBe(404);
    expect((await currentRoute(request(), sid)).status).toBe(404);
    expect((await currentRoute(request(undefined, cookie + ";" + cookie), sid)).status).toBe(404);
    expect((await currentRoute(request(), "../trace")).status).toBe(404);
  });
  it("checks origin, strict body and required configuration before mutation", async () => {
    const payload = { unit_id: "U1", create_request_id: nonce };
    expect((await beginRoute(request(payload, undefined, "http://evil.example"))).status).toBe(403);
    for (const other of ["http://localhost:3001", "https://localhost:3000", "http://127.0.0.1:3001", "null"]) {
      expect((await beginRoute(request(payload, undefined, other))).status).toBe(403);
    }
    expect((await beginRoute(request({ ...payload, budget: 100 }))).status).toBe(422);
    expect((await beginRoute(new Request(origin, { method: "POST", headers: { origin }, body: "{" }))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("SONDER_COOKIE_KEY", "");
    expect((await beginRoute(request(payload))).status).toBe(503);
  });
  it("projects success and errors, rejects upstream session mismatch", async () => {
    fetchMock.mockResolvedValueOnce(upstream({ ...catalogue, trace: "MATH-secret" }));
    expect(await (await catalogueRoute()).json()).toEqual(catalogue);
    const cookie = `${cookieName(sid)}=${capability(sid, beginOwner(nonce))}`;
    fetchMock.mockResolvedValueOnce(upstream({ ...snapshot(), outcome: "diagnosed", posterior: [1] }));
    expect(await (await currentRoute(request(undefined, cookie), sid)).json()).toEqual(snapshot());
    fetchMock.mockResolvedValueOnce(upstream({ error: { code: "answer_conflict", detail: "MATH-secret" } }, 409));
    expect(await (await currentRoute(request(undefined, cookie), sid)).json()).toEqual({ error: { code: "answer_conflict" } });
    fetchMock.mockResolvedValueOnce(upstream({ ...snapshot(), session_id: nonce }));
    expect((await currentRoute(request(undefined, cookie), sid)).status).toBe(503);
  });
  it("maps unreachable, timeout, unknown errors and invalid upstream contracts safely", async () => {
    for (const [error, status] of [[new Error("secret"), 503], [new DOMException("timeout", "TimeoutError"), 504]] as const) {
      fetchMock.mockRejectedValueOnce(error);
      expect((await catalogueRoute()).status).toBe(status);
    }
    for (const response of [upstream({ detail: "MATH-secret" }, 401), upstream({ trace: "secret" }), new Response("invalid")]) {
      fetchMock.mockResolvedValueOnce(response);
      expect(await (await catalogueRoute()).json()).toEqual({ error: { code: "engine_unavailable" } });
    }
  });
});
