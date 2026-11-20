// Neon Auth (Better Auth) returns `{ data: null, error }` where `error` is the JSON body
// `{ code, message }` plus the HTTP `status` and `statusText`. A rejected origin is
// `{ code: "INVALID_ORIGIN", message: "Invalid origin", status: 403 }`.
export type AuthErrorLike = { code?: string; status?: number; message?: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

/**
 * Reads code/status/message from either error shape. Neon's client THROWS an
 * AuthError whose `.code` is a mapped, snake_case code and whose `.error` holds the
 * raw JSON body plus the HTTP status, so the raw Better Auth code (and status) is
 * preferred from `.error`. A plain `{ code, status, message }` object also works.
 * Never throws.
 */
export function authErrorInfo(err: unknown): AuthErrorLike {
  try {
    const top = asRecord(err);
    if (!top) return {};
    const inner = asRecord(top.error);
    const pick = <T,>(type: "string" | "number", ...vals: unknown[]) =>
      vals.find((v) => typeof v === type) as T | undefined;
    const info: AuthErrorLike = {};
    const code = pick<string>("string", inner?.code, top.code);
    const status = pick<number>("number", inner?.status, top.status);
    const message = pick<string>("string", top.message, inner?.message);
    if (code !== undefined) info.code = code;
    if (status !== undefined) info.status = status;
    if (message !== undefined) info.message = message;
    return info;
  } catch {
    return {};
  }
}

export function isOriginRejected(err: unknown): boolean {
  const { code, status, message } = authErrorInfo(err);
  if (code === "INVALID_ORIGIN") return true;
  return status === 403 && /origin/i.test(message ?? "");
}

export function isAlreadyRegistered(err: unknown): boolean {
  const { code, status, message } = authErrorInfo(err);
  if (code?.startsWith("USER_ALREADY_EXISTS")) return true;
  return status === 422 && /already exists/i.test(message ?? "");
}

export function originRejectedMessage(): string {
  const base =
    "This address isn't allowed to sign in yet. Open Sonder from its usual address and try again.";
  return process.env.NODE_ENV !== "production"
    ? `${base} (Local development: use http://localhost:3000, or add this origin to Neon Auth trusted domains.)`
    : base;
}
