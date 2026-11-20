import "server-only";
import { NextResponse } from "next/server";
import { AccessError, requireAccess, type AccessContext } from "./access";
import { isSameOrigin } from "./origin";
import type { AppRole } from "./types";

const headers = { "Cache-Control": "no-store" };
export function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers });
}
/** Authenticate, check the role and (for mutations) the origin, then run the handler. */
export function withAccess<C>(roles: readonly AppRole[], handler: (access: AccessContext, request: Request, context: C) => Promise<Response>,
  options: { mutation?: boolean } = {}) {
  return async (request: Request, context: C) => {
    if (options.mutation && !isSameOrigin(request)) return errorResponse("invalid_origin", 403);
    try {
      return await handler(await requireAccess(roles), request, context);
    } catch (error) {
      if (error instanceof AccessError) return errorResponse(error.status === 401 ? "authentication_required" : "role_required", error.status);
      console.error("Request failed.", error);
      return errorResponse("service_unavailable", 503);
    }
  };
}
