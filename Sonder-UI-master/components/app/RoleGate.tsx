"use client";

import { useEffect } from "react";
import { useSession, type Role } from "@/lib/session";

/**
 * Wrap a role area's pages. Content always renders (so pages server-render
 * normally); this only runs a client-side correction once the session is known:
 * adopt the role of whatever area was deep-linked into. There is no real auth,
 * so bouncing unsigned visitors to the landing would break footer deep links
 * and shareable product URLs.
 */
export function RoleGate({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { role: current, ready, signIn } = useSession();

  useEffect(() => {
    if (!ready) return;
    if (current !== role) signIn(role);
  }, [ready, current, role, signIn]);

  return <>{children}</>;
}
