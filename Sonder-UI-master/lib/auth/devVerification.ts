/**
 * DEVELOPMENT ONLY: skip email-OTP verification so test accounts can be created without an inbox.
 *
 * Off unless NEXT_PUBLIC_SONDER_DEV_SKIP_EMAIL_OTP=true, and never on in a production build
 * (NODE_ENV=production). While on, the verification form accepts any code and the server treats every
 * signed-in email as verified. Remove this file and its call sites (grep devSkipEmailVerification)
 * before real users sign up; docs/SETUP.md section 4 says the same.
 */
export function devSkipEmailVerification(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SONDER_DEV_SKIP_EMAIL_OTP === "true";
}

/** The account's email counts as verified, or verification is skipped in development. */
export function isEmailVerified(user: { emailVerified?: boolean | null }): boolean {
  return Boolean(user.emailVerified) || devSkipEmailVerification();
}
