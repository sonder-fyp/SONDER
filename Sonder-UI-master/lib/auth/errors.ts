// Neon Auth (Better Auth) returns `{ data: null, error }` where `error` is the JSON body
// `{ code, message }` plus the HTTP `status` and `statusText`. A rejected origin is
// `{ code: "INVALID_ORIGIN", message: "Invalid origin", status: 403 }`.
export type AuthErrorLike = { code?: string; status?: number; message?: string };

export function isOriginRejected(err: AuthErrorLike | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "INVALID_ORIGIN") return true;
  return err.status === 403 && /origin/i.test(err.message ?? "");
}

export function originRejectedMessage(): string {
  const base =
    "This address isn't allowed to sign in yet. Open Sonder from its usual address and try again.";
  return process.env.NODE_ENV !== "production"
    ? `${base} (Local development: use http://localhost:3000, or add this origin to Neon Auth trusted domains.)`
    : base;
}
