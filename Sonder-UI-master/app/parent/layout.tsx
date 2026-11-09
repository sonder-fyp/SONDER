import { RoleGate } from "@/components/app/RoleGate";

export const dynamic = "force-dynamic";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate role="parent" returnTo="/parent">{children}</RoleGate>;
}
