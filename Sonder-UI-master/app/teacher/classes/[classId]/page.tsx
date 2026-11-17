import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Class details"
      description="Keep classwork in context."
      detail="Class rosters and assignments are not available yet. Return to your overview for workspace availability."
      home="/teacher"
    />
  );
}
