import { RoleGate } from "@/components/app/RoleGate";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate role="teacher">{children}</RoleGate>;
}
