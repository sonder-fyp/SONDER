// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), origin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./access", () => ({ AccessError: class AccessError extends Error { constructor(public status: number) { super(); } }, requireAccess: mocks.access }));
vi.mock("./origin", () => ({ isSameOrigin: mocks.origin }));
import { AccessError } from "./access";
import { withAccess } from "./guard";
const req = new Request("http://localhost/api", { method: "POST" });
describe("withAccess", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.origin.mockReturnValue(true); mocks.access.mockResolvedValue({ appUserId: "id" }); });
  it("rejects mutations without same origin before invoking handler", async () => {
    mocks.origin.mockReturnValue(false); const handler = vi.fn();
    const res = await withAccess(["student"], handler, { mutation: true })(req, {});
    expect(res.status).toBe(403); expect(await res.json()).toEqual({ error: { code: "invalid_origin" } }); expect(handler).not.toHaveBeenCalled();
  });
  it("maps authentication and role failures", async () => {
    for (const [status, code] of [[401, "authentication_required"], [403, "role_required"]] as const) {
      mocks.access.mockRejectedValueOnce(new AccessError(status, code));
      const res = await withAccess(["student"], vi.fn())(req, {});
      expect(res.status).toBe(status); expect(await res.json()).toEqual({ error: { code } });
    }
  });
  it("passes the application ID and safely maps unexpected errors", async () => {
    const handler = vi.fn(async ({ appUserId }: { appUserId: string }) => Response.json({ appUserId }));
    expect(await (await withAccess(["student"], handler)(req, {})).json()).toEqual({ appUserId: "id" });
    mocks.access.mockRejectedValueOnce(new Error("bad shape"));
    const error = await withAccess(["student"], handler)(req, {});
    expect(error.status).toBe(503); expect(await error.json()).toEqual({ error: { code: "service_unavailable" } });
  });
});
