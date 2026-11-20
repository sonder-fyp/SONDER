import { requirePageRole } from "@/lib/auth/access";
import { WorkspaceHome } from "@/components/product/WorkspaceHome";
export default async function Home() {
  const account = await requirePageRole("admin", "/admin");
  return <WorkspaceHome account={account} />;
}
