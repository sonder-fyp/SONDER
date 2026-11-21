import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Follow-up check"
      description="Return to an idea when you are ready."
      detail="Follow-up checks are not available yet. Your overview links to the diagnostics you can use now."
      home="/student"
      action="Go to your assignments"
      actionHref="/student"
    />
  );
}
