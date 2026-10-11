import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { BoundaryError, config } from "./server";
import { UUID } from "./validation";

function hmac(value: string) { return createHmac("sha256", config().key).update(value).digest("hex"); }
export function beginOwner(nonce: string) { return hmac(`begin:${nonce}`); }
export function cookieName(sid: string) { return `sonder_run_${sid}`; }
export function capability(sid: string, owner: string) { return `${owner}.${hmac(`run:${sid}:${owner}`)}`; }
export function sessionOwner(request: Request, sid: string) {
  if (!UUID.test(sid)) throw new BoundaryError(404, "session_unavailable");
  const values = (request.headers.get("cookie") ?? "").split(";").map(s => s.trim())
    .filter(s => s.startsWith(cookieName(sid) + "="));
  if (values.length !== 1) throw new BoundaryError(404, "session_unavailable");
  const value = values[0].slice(cookieName(sid).length + 1);
  const [owner, signature] = value.split(".");
  if (!/^[0-9a-f]{64}$/.test(owner ?? "") || !/^[0-9a-f]{64}$/.test(signature ?? "")
    || value.split(".").length !== 2 || !timingSafeEqual(Buffer.from(signature), Buffer.from(hmac(`run:${sid}:${owner}`)))) {
    throw new BoundaryError(404, "session_unavailable");
  }
  return owner;
}
// The configured origin is 127.0.0.1; "localhost" on the same port is the same loopback UI.
export function allowedOrigins() {
  const configured = new URL(config().origin);
  const alias = new URL(configured.origin);
  alias.hostname = "localhost";
  return [configured.origin, alias.origin];
}
export function checkOrigin(request: Request) {
  if (!allowedOrigins().includes(request.headers.get("origin") ?? "")) throw new BoundaryError(403, "invalid_origin");
}
