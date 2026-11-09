import "server-only";
import { redirect } from "next/navigation";
import { getSignedInUser } from "./server";
import { database } from "./database";
import type { AppAccount, AppRole } from "./types";
import { isAppRole, ROLE_HOME } from "./types";

export class AccessError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
  }
}

export async function getAppAccount(authUserId: string): Promise<AppAccount | null> {
  const rows = await database()`
    SELECT u.id::text, u.email, u.display_name, u.role, u.status,
           u.auth_onboarding_complete AS onboarding_complete,
           r.status AS role_request_status, r.requested_role
    FROM sonder.app_user u
    LEFT JOIN LATERAL (
      SELECT status, requested_role
      FROM sonder.auth_role_request
      WHERE app_user_id = u.id
      ORDER BY requested_at DESC, id DESC
      LIMIT 1
    ) r ON true
    WHERE u.auth_user_id = ${authUserId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const validRequestStatus =
    row.role_request_status === null ||
    row.role_request_status === "pending" ||
    row.role_request_status === "approved" ||
    row.role_request_status === "denied" ||
    row.role_request_status === "withdrawn";
  const validRequestedRole =
    row.requested_role === null ||
    row.requested_role === "teacher" ||
    row.requested_role === "parent";
  if (
    typeof row.id !== "string" ||
    typeof row.email !== "string" ||
    typeof row.display_name !== "string" ||
    !isAppRole(row.role) ||
    (row.status !== "active" && row.status !== "deactivated") ||
    typeof row.onboarding_complete !== "boolean" ||
    !validRequestStatus ||
    !validRequestedRole
  ) {
    throw new Error("The application account has an invalid database shape.");
  }
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    status: row.status,
    onboarding_complete: row.onboarding_complete,
    role_request_status: row.role_request_status,
    requested_role: row.requested_role,
  };
}

export async function requireApiRole(roles: readonly AppRole[]) {
  const user = await getSignedInUser();
  if (!user) throw new AccessError(401, "Authentication required.");

  const account = await getAppAccount(user.id);
  if (!account || !account.onboarding_complete || account.status !== "active") {
    throw new AccessError(403, "An active, completed account is required.");
  }
  if (account.role_request_status === "pending") {
    throw new AccessError(403, "Administrator approval is required before workspace access.");
  }
  if (account.role_request_status === "denied") {
    throw new AccessError(403, "Your access request was not approved. Contact an administrator.");
  }
  if (!roles.includes(account.role)) {
    throw new AccessError(403, "This account cannot access that resource.");
  }
  return { user, account };
}

export async function requirePageRole(role: AppRole, returnTo: string) {
  const user = await getSignedInUser();
  if (!user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(returnTo)}`);
  }

  const account = await getAppAccount(user.id);
  if (!account || !account.onboarding_complete) redirect("/auth/onboarding");
  if (account.status !== "active") redirect("/auth/access-paused");
  if (account.role_request_status === "pending" || account.role_request_status === "denied") {
    redirect("/auth/access-pending");
  }
  if (account.role !== role) redirect(ROLE_HOME[account.role]);
  return account;
}
