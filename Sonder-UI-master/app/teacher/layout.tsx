import { RoleGate } from "@/components/app/RoleGate";
import { LatestDiagnosticNotice } from "@/components/app/LatestDiagnosticNotice";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGate role="teacher">
      {children}
      <LatestDiagnosticNotice />
    </RoleGate>
  );
}
