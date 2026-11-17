import { afterEach, describe, expect, it, vi } from "vitest";
import { isOriginRejected, originRejectedMessage } from "./errors";

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

describe("originRejectedMessage", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("adds the local hint outside production only", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(originRejectedMessage()).toContain("http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production");
    expect(originRejectedMessage()).not.toContain("localhost");
  });
});
