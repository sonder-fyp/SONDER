import { requirePageRole } from "@/lib/auth/access";
import { WorkspaceHome } from "@/components/product/WorkspaceHome";
import { TeacherQueue } from "@/components/teacher/TeacherQueue";
export default async function Home() {
  const account = await requirePageRole("teacher", "/teacher");
  return <WorkspaceHome account={account}><TeacherQueue /></WorkspaceHome>;
}
