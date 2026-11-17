import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Review agreement"
      description="Bring independent reviews together."
      detail="The content review workflow is not available yet. Reviewer decisions will appear with their saved content version."
      home="/teacher"
    />
  );
}
