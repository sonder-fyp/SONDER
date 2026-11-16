import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Generation history"
      description="Trace how an item came to be."
      detail="Generation records are not available yet. Published records will include their source and review history."
      home="/teacher"
    />
  );
}
