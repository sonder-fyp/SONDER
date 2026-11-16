import "server-only";
import { BoundaryError, config } from "./server";

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
