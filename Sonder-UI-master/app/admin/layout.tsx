import { RoleGate } from "@/components/app/RoleGate";

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate role="admin" returnTo="/admin">{children}</RoleGate>;
}
