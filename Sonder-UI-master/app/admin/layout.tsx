import { RoleGate } from "@/components/app/RoleGate";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate role="admin">{children}</RoleGate>;
}
