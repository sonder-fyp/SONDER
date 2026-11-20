import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Learning"
      description="Make time to understand the idea."
      detail="The learning library is not available yet. You can explore the available diagnostics in the meantime."
      home="/student"
      action="Explore diagnostics"
      actionHref="/student/start"
    />
  );
}
