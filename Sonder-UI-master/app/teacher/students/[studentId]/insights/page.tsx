import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Student activity"
      description="See the work in context."
      detail="Student activity is not available yet. Future records will be scoped to the students in your classes."
      home="/teacher"
    />
  );
}
