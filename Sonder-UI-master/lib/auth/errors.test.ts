import { afterEach, describe, expect, it, vi } from "vitest";
import { authErrorInfo, isAlreadyRegistered, isOriginRejected, originRejectedMessage } from "./errors";

describe("isOriginRejected", () => {
  it("matches the INVALID_ORIGIN code", () => {
    expect(isOriginRejected({ code: "INVALID_ORIGIN", status: 403, message: "Invalid origin" })).toBe(true);
    expect(isOriginRejected({ code: "INVALID_ORIGIN" })).toBe(true);
  });
  it("matches a 403 whose message mentions the origin", () => {
    expect(isOriginRejected({ status: 403, message: "Invalid Origin" })).toBe(true);
  });
  it("does not match other errors", () => {
    expect(isOriginRejected({ status: 403, message: "Forbidden" })).toBe(false);
    expect(isOriginRejected({ status: 401, message: "Invalid origin" })).toBe(false);
    expect(isOriginRejected({ code: "USER_ALREADY_EXISTS", status: 422 })).toBe(false);
    expect(isOriginRejected(null)).toBe(false);
    expect(isOriginRejected(undefined)).toBe(false);
  });
});

function thrown(status: number, message: string, body: Record<string, unknown>) {
  return Object.assign(new Error(message), {
    status,
    code: "mapped_code",
    statusText: "x",
    error: { ...body, status },
  });
}

describe("authErrorInfo", () => {
  it("prefers the raw body code from a thrown Neon error", () => {
    const err = thrown(403, "Invalid origin", { code: "INVALID_ORIGIN", message: "Invalid origin" });
    expect(authErrorInfo(err)).toEqual({ code: "INVALID_ORIGIN", status: 403, message: "Invalid origin" });
    expect(isOriginRejected(err)).toBe(true);
  });
  it("falls back to top-level status and message", () => {
    const err = Object.assign(new Error("Invalid origin"), { status: 403 });
    expect(authErrorInfo(err)).toEqual({ status: 403, message: "Invalid origin" });
    expect(isOriginRejected(err)).toBe(true);
    expect(isAlreadyRegistered(Object.assign(new Error("User already exists. Use another email."), { status: 422 }))).toBe(true);
  });
  it("accepts a plain returned shape", () => {
    expect(authErrorInfo({ code: "X", status: 400, message: "m" })).toEqual({ code: "X", status: 400, message: "m" });
    expect(isAlreadyRegistered({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })).toBe(true);
    expect(isAlreadyRegistered({ code: "USER_ALREADY_EXISTS", status: 422 })).toBe(true);
    expect(isAlreadyRegistered({ status: 500, message: "boom" })).toBe(false);
  });
  it("returns {} for non-objects", () => {
    expect(authErrorInfo(null)).toEqual({});
    expect(authErrorInfo(undefined)).toEqual({});
    expect(authErrorInfo("oops")).toEqual({});
    expect(isOriginRejected("oops")).toBe(false);
    expect(isAlreadyRegistered(null)).toBe(false);
  });
});

describe("originRejectedMessage", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("adds the local hint outside production only", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(originRejectedMessage()).toContain("http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production");
    expect(originRejectedMessage()).not.toContain("localhost");
  });
});
