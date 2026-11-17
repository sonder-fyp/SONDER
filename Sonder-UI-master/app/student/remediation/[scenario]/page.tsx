import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Study notes"
      description="Your next steps, in context."
      detail="Personal study notes are not available yet. Any future recommendations will be linked to your own permitted records."
      home="/student"
      action="Explore diagnostics"
      actionHref="/student/start"
    />
  );
}
