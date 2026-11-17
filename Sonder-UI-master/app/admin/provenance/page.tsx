import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Admin"
      title="Provenance"
      description="Follow the source of every item."
      detail="Provenance browsing is not available yet. Content records will show their authorship and review status."
      home="/admin"
    />
  );
}
