import { describe, expect, it } from "vitest";
import { normalizeEmail, validateOnboarding } from "./validation";

describe("authentication input validation", () => {
  it("normalizes valid email and rejects malformed or oversized addresses", () => {
    expect(normalizeEmail("  User@Example.com ")).toBe("user@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(`a@${"b".repeat(250)}.com`)).toBeNull();
  });

  it("accepts only safe profile details and non-privileged onboarding roles", () => {
    expect(validateOnboarding({ displayName: "  Ahmed Laiq  ", requestedRole: "student" })).toEqual({
      displayName: "Ahmed Laiq",
      requestedRole: "student",
    });
    expect(validateOnboarding({ displayName: "Teacher", requestedRole: "teacher" })).not.toBeNull();
    expect(validateOnboarding({ displayName: "Admin", requestedRole: "admin" })).toBeNull();
    expect(validateOnboarding({ displayName: " \u0001 ", requestedRole: "parent" })).toBeNull();
    expect(validateOnboarding({ displayName: "x".repeat(81), requestedRole: "parent" })).toBeNull();
  });
});
