import { afterEach, describe, expect, it, vi } from "vitest";
import { devSkipEmailVerification, isEmailVerified } from "./devVerification";

afterEach(() => vi.unstubAllEnvs());

describe("development email-verification bypass", () => {
  it("is off by default", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(devSkipEmailVerification()).toBe(false);
    expect(isEmailVerified({ emailVerified: false })).toBe(false);
    expect(isEmailVerified({ emailVerified: true })).toBe(true);
  });

  it("turns on only with the flag set to true outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SONDER_DEV_SKIP_EMAIL_OTP", "yes");
    expect(devSkipEmailVerification()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SONDER_DEV_SKIP_EMAIL_OTP", "true");
    expect(devSkipEmailVerification()).toBe(true);
    expect(isEmailVerified({ emailVerified: false })).toBe(true);
  });

  it("never turns on in production, even with the flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SONDER_DEV_SKIP_EMAIL_OTP", "true");
    expect(devSkipEmailVerification()).toBe(false);
    expect(isEmailVerified({ emailVerified: false })).toBe(false);
  });
});
