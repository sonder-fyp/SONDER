import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Learning resource"
      description="A little clarity goes a long way."
      detail="Learning resources are not available yet. Return to your overview to find an available diagnostic."
      home="/student"
      action="Go to your assignments"
      actionHref="/student"
    />
  );
}
