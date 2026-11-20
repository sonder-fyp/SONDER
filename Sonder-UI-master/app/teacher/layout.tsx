import { RoleGate } from "@/components/app/RoleGate";

export const dynamic = "force-dynamic";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGate role="teacher" returnTo="/teacher">
      {children}
    </RoleGate>
  );
}
