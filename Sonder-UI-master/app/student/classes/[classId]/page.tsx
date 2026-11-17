import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Class details"
      description="Stay close to your classwork."
      detail="Class rosters and assignments are not available yet. Your teacher will share class access when it is ready."
      home="/student"
      action="Explore diagnostics"
      actionHref="/student/start"
    />
  );
}
