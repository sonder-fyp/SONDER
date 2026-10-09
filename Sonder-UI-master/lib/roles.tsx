import {
  GraduationCap,
  Presentation,
  Users,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/session";

export type RoleMeta = {
  role: Role;
  label: string;
  /** The person you are signed in as, for demo realism. */
  person: string;
  context: string; // e.g. school / grade
  blurb: string;
  home: string;
  icon: LucideIcon;
};

export const ROLES: Record<Role, RoleMeta> = {
  student: {
    role: "student",
    label: "Student",
    person: "Zara Qureshi",
    context: "Grade 9 · Beaconhouse Margalla",
    blurb: "Take a diagnostic, read your study notes, check a past fix still holds.",
    home: "/student",
    icon: GraduationCap,
  },
  teacher: {
    role: "teacher",
    label: "Teacher",
    person: "Imran Shah",
    context: "Science · 4 classes",
    blurb: "Review every diagnosis with its evidence before it reaches a student.",
    home: "/teacher",
    icon: Presentation,
  },
  parent: {
    role: "parent",
    label: "Parent",
    person: "Nadia Qureshi",
    context: "Guardian of Zara Qureshi",
    blurb: "See the plain-language summary your teacher approved. Nothing before that.",
    home: "/parent",
    icon: Users,
  },
  admin: {
    role: "admin",
    label: "Admin",
    person: "Sana Malik",
    context: "Content & curriculum lead",
    blurb: "Curate the misconception catalogue, watch coverage gaps, track accuracy.",
    home: "/admin",
    icon: ShieldCheck,
  },
};

export const ROLE_ORDER: Role[] = ["student", "teacher", "parent", "admin"];
