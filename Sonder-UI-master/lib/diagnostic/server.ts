import "server-only";
import { parseError } from "./validation";

export class BoundaryError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export function config() {
  const token = process.env.SONDER_ENGINE_TOKEN ?? "";
  const base = new URL(process.env.SONDER_ENGINE_URL ?? "http://127.0.0.1:8000");
  const origin = process.env.SONDER_UI_ORIGIN ?? "http://127.0.0.1:3000";
  const ui = new URL(origin);
  if (token.length < 32 || base.protocol !== "http:" || base.hostname !== "127.0.0.1"
    || base.pathname !== "/" || base.search || base.hash || base.username || base.password
    || ui.protocol !== "http:" || ui.hostname !== "127.0.0.1" || ui.origin !== origin) {
    throw new BoundaryError(503, "engine_unavailable");
  }
  return { token, base: base.origin, origin };
}
export async function engine<T>(path: string, parser: (v: unknown) => T, actor?: string, body?: unknown): Promise<T> {
  const { base, token } = config();
  let response: Response;
  try {
    response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Sonder-Token": token, ...(actor ? { "X-Sonder-Actor": actor } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  } catch (error) {
    throw new BoundaryError(error instanceof Error && error.name === "TimeoutError" ? 504 : 503,
      error instanceof Error && error.name === "TimeoutError" ? "engine_timeout" : "engine_unavailable");
  }
  try {
    const value: unknown = await response.json();
    if (!response.ok) throw new BoundaryError(response.status, parseError(value, response.status));
    return parser(value);
  } catch (error) {
    if (error instanceof BoundaryError) throw error;
    throw new BoundaryError(503, "engine_unavailable");
  }
}
