// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), query: vi.fn(), redirect: vi.fn((url: string): never => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./server", () => ({ getSignedInUser: mocks.user }));
vi.mock("./database", () => ({ database: () => mocks.query }));
import { AccessError, requireAccess, requireApiRole, requirePageRole } from "./access";
const id = "00000000-0000-4000-8000-000000000001";
const row = { id, email: "student@sonder.invalid", display_name: "Student", role: "student", status: "active", onboarding_complete: true, role_request_status: null, requested_role: null };
describe("account access", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id }); mocks.query.mockResolvedValue([row]); });
  it("rejects anonymous requests and redirects anonymous pages", async () => {
    mocks.user.mockResolvedValue(null);
    await expect(requireApiRole(["student"])).rejects.toMatchObject({ status: 401 });
    await expect(requirePageRole("student", "/student")).rejects.toThrow("REDIRECT:/auth/sign-in?next=%2Fstudent");
  });
  it("requires an onboarded account", async () => {
    for (const rows of [[], [{ ...row, onboarding_complete: false }]]) {
      mocks.query.mockResolvedValue(rows);
      await expect(requireApiRole(["student"])).rejects.toMatchObject({ status: 403 });
      await expect(requirePageRole("student", "/student")).rejects.toThrow("REDIRECT:/auth/onboarding");
    }
  });
  it("denies deactivated, pending and denied accounts", async () => {
    for (const [change, path] of [[{ status: "deactivated" }, "/auth/access-paused"], [{ role_request_status: "pending" }, "/auth/access-pending"], [{ role_request_status: "denied" }, "/auth/access-pending"]] as const) {
      mocks.query.mockResolvedValue([{ ...row, ...change }]);
      await expect(requireApiRole(["student"])).rejects.toMatchObject({ status: 403 });
      await expect(requirePageRole("student", "/student")).rejects.toThrow(`REDIRECT:${path}`);
    }
  });
  it("uses the database role and returns the application ID", async () => {
    await expect(requireApiRole(["teacher"])).rejects.toBeInstanceOf(AccessError);
    await expect(requirePageRole("teacher", "/teacher")).rejects.toThrow("REDIRECT:/student");
    await expect(requireAccess(["student"])).resolves.toMatchObject({ appUserId: id, role: "student", authUserId: id });
    const forged = new Request("http://localhost", { headers: { "x-role": "teacher" } });
    expect(forged.headers.get("x-role")).toBe("teacher");
    await expect(requireAccess(["teacher"])).rejects.toMatchObject({ status: 403 });
    expect(mocks.query.mock.calls.at(-1)?.slice(1)).toEqual([id]);
  });
  it("rejects malformed database roles and loses access after logout", async () => {
    mocks.query.mockResolvedValueOnce([{ ...row, role: "superuser" }]);
    await expect(requireAccess(["student"])).rejects.toThrow("invalid database shape");
    mocks.user.mockResolvedValue(null);
    await expect(requireApiRole(["student"])).rejects.toMatchObject({ status: 401 });
  });
});
