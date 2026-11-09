import { getAuth } from "@/lib/auth/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  return getAuth().middleware({
    loginUrl: "/auth/sign-in",
    publicRoutes: ["/", "/api/account", "/api/admin", "/api/diagnostic", "/api/teacher"],
  })(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
