import {
  Home,
  Compass,
  ShieldCheck,
  Settings,
  Users,
  History,
  type LucideIcon,
} from "lucide-react";
import type { AppRole as Role } from "@/lib/auth/types";

export type NavItem = {
  label: string;
  dockLabel?: string;
  href: string;
  icon: LucideIcon;
  match?: string[];
};
export type NavGroup = { label?: string; items: NavItem[] };

/** Only operational destinations belong in the primary navigation. */
export const NAV: Record<Role, NavGroup[]> = {
  student: [
    {
      items: [
        { label: "Home", href: "/student", icon: Home },
        {
          label: "Diagnostics",
          href: "/student/start",
          icon: Compass,
          match: ["/student/diagnostic"],
        },
        { label: "Classes", href: "/student/classes", icon: Users },
        { label: "History", href: "/student/history", icon: History },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Preferences", href: "/student/settings", icon: Settings },
      ],
    },
  ],
  teacher: [
    {
      items: [
        { label: "Overview", href: "/teacher", icon: Home },
        { label: "Classes", href: "/teacher/classes", icon: Users },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Preferences", href: "/teacher/settings", icon: Settings },
      ],
    },
  ],
  parent: [
    { items: [{ label: "Overview", href: "/parent", icon: Home }] },
    {
      label: "Account",
      items: [
        { label: "Preferences", href: "/parent/settings", icon: Settings },
      ],
    },
  ],
  admin: [
    {
      items: [
        { label: "Overview", href: "/admin", icon: Home },
        { label: "Access requests", href: "/admin/access", icon: ShieldCheck },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Preferences", href: "/admin/settings", icon: Settings },
      ],
    },
  ],
};
export function isNavItemActive(
  pathname: string,
  item: NavItem,
  home: string,
): boolean {
  if (item.href === home) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`))
    return true;
  return (item.match ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
export const SEGMENT_LABELS: Record<string, string> = {
  student: "Home",
  teacher: "Overview",
  parent: "Overview",
  admin: "Overview",
  start: "Diagnostics",
  diagnostic: "Diagnostic",
  settings: "Preferences",
  access: "Access requests",
  session: "Session",
  review: "Review",
  remediation: "Study note",
  learn: "Learning",
  verify: "Follow-up",
  insights: "Activity",
  consultant: "Consultant",
  escalations: "Follow-up",
  "content-review": "Content review",
  agreement: "Review agreement",
  students: "Student",
  summary: "Summary",
  catalogue: "Catalogue",
  coverage: "Coverage",
  performance: "Reports",
  provenance: "Provenance",
  classes: "Classes",
  messages: "Messages",
  generation: "Generation history",
};
