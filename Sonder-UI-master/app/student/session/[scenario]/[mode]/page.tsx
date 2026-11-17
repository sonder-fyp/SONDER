import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Diagnostic"
      description="Find a diagnostic for you."
      detail="This diagnostic link is no longer available. Choose an available topic to start or resume a saved check."
      home="/student"
      action="Explore diagnostics"
      actionHref="/student/start"
    />
  );
}
