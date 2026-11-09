import { requirePageRole } from "@/lib/auth/access";
import type { AppRole } from "@/lib/auth/types";

export async function RoleGate({
  role,
  returnTo,
  children,
}: {
  role: AppRole;
  returnTo: string;
  children: React.ReactNode;
}) {
  await requirePageRole(role, returnTo);
  return <>{children}</>;
}
