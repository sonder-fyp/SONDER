import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Diagnostic"
      description="Checks now start from your assignments."
      detail="This diagnostic link is no longer available. Choose an available topic to start or resume a saved check."
      home="/student"
      action="Go to your assignments"
      actionHref="/student"
    />
  );
}
