import {
  Home,
  Compass,
  LineChart,
  MessageCircleQuestion,
  LayoutDashboard,
  AlertTriangle,
  ClipboardCheck,
  Bot,
  FileText,
  BookMarked,
  Grid3x3,
  Gauge,
  ScrollText,
  GraduationCap,
  School,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/session";

export type NavItem = {
  label: string;
  /** Short caption for the student dock. Full `label` stays on aria-label. */
  dockLabel?: string;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes that also mark this item active. */
  match?: string[];
};
export type NavGroup = { label?: string; items: NavItem[] };

/**
 * Per-role sidebar navigation. Grouped, with an optional section label.
 * Contextual screens (an evidence panel, a single summary) are reached from
 * within a section, not listed here.
 */
export const NAV: Record<Role, NavGroup[]> = {
  student: [
    {
      items: [
        { label: "Home", dockLabel: "Home", href: "/student", icon: Home },
        {
          label: "New Diagnostic",
          dockLabel: "New",
          href: "/student/start",
          icon: Compass,
          match: ["/student/session", "/student/verify"],
        },
        {
          label: "Learn",
          dockLabel: "Learn",
          href: "/student/learn",
          icon: GraduationCap,
        },
      ],
    },
    {
      label: "Class",
      items: [
        { label: "My classes", href: "/student/classes", icon: School },
        { label: "Message teacher", href: "/student/messages", icon: MessagesSquare },
      ],
    },
    {
      label: "Progress",
      items: [
        {
          label: "My Insights",
          dockLabel: "Insights",
          href: "/student/insights",
          icon: LineChart,
        },
        {
          label: "Ask consultant",
          dockLabel: "Ask",
          href: "/student/consultant",
          icon: MessageCircleQuestion,
        },
      ],
    },
  ],
  teacher: [
    {
      items: [
        { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
      ],
    },
    {
      label: "Class",
      items: [
        { label: "Classes", href: "/teacher/classes", icon: School },
        { label: "Messages", href: "/teacher/messages", icon: MessagesSquare },
      ],
    },
    {
      label: "Queues",
      items: [
        {
          label: "Escalations",
          href: "/teacher/escalations",
          icon: AlertTriangle,
        },
        {
          label: "Content review",
          href: "/teacher/content-review",
          icon: ClipboardCheck,
        },
      ],
    },
    {
      label: "Assist",
      items: [{ label: "AI consultant", href: "/teacher/consultant", icon: Bot }],
    },
  ],
  parent: [
    {
      items: [
        { label: "Summaries", href: "/parent", icon: FileText },
        { label: "Message teacher", href: "/parent/messages", icon: MessagesSquare },
      ],
    },
  ],
  admin: [
    {
      items: [
        { label: "Overview", href: "/admin", icon: LayoutDashboard },
      ],
    },
    {
      label: "Content",
      items: [
        { label: "Catalogue", href: "/admin/catalogue", icon: BookMarked },
        { label: "Coverage", href: "/admin/coverage", icon: Grid3x3 },
        { label: "Provenance", href: "/admin/provenance", icon: ScrollText },
      ],
    },
    {
      label: "Insight",
      items: [
        { label: "Performance", href: "/admin/performance", icon: Gauge },
      ],
    },
  ],
};

/** A role home matches exactly; every other item owns its subtree, plus `match`. */
export function isNavItemActive(
  pathname: string,
  item: NavItem,
  home: string,
): boolean {
  if (item.href === home) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.match ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Human labels for path segments, for the top-bar breadcrumb. */
export const SEGMENT_LABELS: Record<string, string> = {
  student: "Student",
  teacher: "Teacher",
  parent: "Parent",
  admin: "Admin",
  start: "New diagnostic",
  session: "Session",
  review: "Review",
  remediation: "Study note",
  learn: "Learn",
  verify: "Follow-up check",
  insights: "Insights",
  consultant: "AI consultant",
  escalations: "Escalations",
  "content-review": "Content review",
  agreement: "Two-reviewer check",
  students: "Students",
  summary: "Summary",
  catalogue: "Catalogue",
  coverage: "Coverage",
  performance: "Performance",
  provenance: "Provenance",
  classes: "Classes",
  messages: "Messages",
  A: "Scenario A",
  B: "Scenario B",
  C: "Scenario C",
  topic: "Topic",
  general: "Broad check",
};
