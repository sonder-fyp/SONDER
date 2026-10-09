import { RoleGate } from "@/components/app/RoleGate";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate role="parent">{children}</RoleGate>;
}
