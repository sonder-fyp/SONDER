// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), account: vi.fn(), query: vi.fn(), origin: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getSignedInUser: mocks.user }));
vi.mock("@/lib/auth/access", () => ({ getAppAccount: mocks.account }));
vi.mock("@/lib/auth/database", () => ({ database: () => mocks.query }));
vi.mock("@/lib/auth/origin", () => ({ isSameOrigin: mocks.origin }));
import { POST } from "./route";
const body = (requestedRole: string) => new Request("http://localhost/api/account/profile", { method: "POST", body: JSON.stringify({ displayName: "Example Student", requestedRole }) });
describe("onboarding role boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "auth-id", email: "student@sonder.invalid", emailVerified: true });
    mocks.account.mockResolvedValue(null); mocks.origin.mockReturnValue(true);
    mocks.query.mockResolvedValue([{ id: "account-id", role: "student" }]);
  });
  it("rejects direct admin registration", async () => { expect((await POST(body("admin"))).status).toBe(422); expect(mocks.query).not.toHaveBeenCalled(); });
  it("creates a student account and a pending teacher request", async () => {
    expect((await POST(body("teacher"))).status).toBe(200);
    const [strings, ...params] = mocks.query.mock.calls[0];
    expect(strings.join("?")).toContain("'student'");
    expect(strings.join("?")).toContain("INSERT INTO sonder.auth_role_request");
    expect(params.filter((p: unknown) => p === "teacher")).toHaveLength(2);
  });
  it("rejects an already onboarded account", async () => { mocks.account.mockResolvedValue({ onboarding_complete: true }); expect((await POST(body("student"))).status).toBe(409); });
  it("rejects a cross-origin request and an unverified user", async () => {
    mocks.origin.mockReturnValueOnce(false); expect((await POST(body("student"))).status).toBe(403);
    mocks.user.mockResolvedValueOnce({ id: "auth-id", emailVerified: false }); expect((await POST(body("student"))).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
