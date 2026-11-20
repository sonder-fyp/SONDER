import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Admin"
      title="Reports"
      description="Measure with context."
      detail="Reporting is not available yet. Future reports will identify their data source, scope and reporting period."
      home="/admin"
    />
  );
}
