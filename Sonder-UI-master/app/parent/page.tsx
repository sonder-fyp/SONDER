import { requirePageRole } from "@/lib/auth/access";
import { WorkspaceHome } from "@/components/product/WorkspaceHome";
export default async function Home() {
  const account = await requirePageRole("parent", "/parent");
  return <WorkspaceHome account={account} />;
}
