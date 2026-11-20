import { requirePageRole } from "@/lib/auth/access";
import { WorkspaceHome } from "@/components/product/WorkspaceHome";
import { StudentAssignments } from "@/components/student/StudentAssignments";
export default async function Home() {
  const account = await requirePageRole("student", "/student");
  return (
    <WorkspaceHome account={account}>
      <StudentAssignments />
    </WorkspaceHome>
  );
}
