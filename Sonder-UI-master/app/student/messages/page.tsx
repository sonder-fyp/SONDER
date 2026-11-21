import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Messages"
      description="A conversation with your teacher."
      detail="Messaging is not available yet. Please contact your teacher through your usual school channel."
      home="/student"
      action="Go to your assignments"
      actionHref="/student"
    />
  );
}
