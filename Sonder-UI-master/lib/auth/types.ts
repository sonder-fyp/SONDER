export const APP_ROLES = ["student", "teacher", "parent", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];
export type Role = AppRole;

export type AppAccount = {
  id: string;
  email: string;
  display_name: string;
  role: AppRole;
  status: "active" | "deactivated";
  onboarding_complete: boolean;
  role_request_status: "pending" | "approved" | "denied" | "withdrawn" | null;
  requested_role: "teacher" | "parent" | null;
};

export const ROLE_HOME: Record<AppRole, string> = {
  student: "/student",
  teacher: "/teacher",
  parent: "/parent",
  admin: "/admin",
};

export function isAppRole(value: unknown): value is AppRole {
  return value === "student" || value === "teacher" || value === "parent" || value === "admin";
}
