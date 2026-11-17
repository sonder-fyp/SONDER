import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Content review"
      description="Careful review before publication."
      detail="The content review workflow is not available yet. No item can be approved or published from this page."
      home="/teacher"
    />
  );
}
