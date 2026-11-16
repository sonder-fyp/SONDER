import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Parent"
      title="Learning summary"
      description="A clearer picture of your child’s learning."
      detail="Parent summaries are not available yet. Only summaries released for an authorised child connection will appear here."
      home="/parent"
    />
  );
}
