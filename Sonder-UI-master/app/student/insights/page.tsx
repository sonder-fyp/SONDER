import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Activity"
      description="A clear record of your learning."
      detail="Attempt history and review updates are not available yet. You can return to an unfinished diagnostic through its topic."
      home="/student"
      action="Explore diagnostics"
      actionHref="/student/start"
    />
  );
}
