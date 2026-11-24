import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="Learning support"
      description="Help for the question in front of you."
      detail="The learning assistant is not available yet. Ask your teacher if you need help with a topic."
      home="/student"
      action="Go to your assignments"
      actionHref="/student"
    />
  );
}
