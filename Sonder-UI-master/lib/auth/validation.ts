const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_ROLES = ["student", "teacher", "parent"] as const;

export type OnboardingInput = {
  displayName: string;
  requestedRole: (typeof PROFILE_ROLES)[number];
};

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function validateOnboarding(value: unknown): OnboardingInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.displayName !== "string" || typeof body.requestedRole !== "string") return null;

  const displayName = body.displayName.trim();
  if (
    displayName.length < 1 ||
    displayName.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(displayName) ||
    !(PROFILE_ROLES as readonly string[]).includes(body.requestedRole)
  ) {
    return null;
  }
  return {
    displayName,
    requestedRole: body.requestedRole as OnboardingInput["requestedRole"],
  };
}
