import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Classes"
      description="A home for every class you teach."
      detail="Class management and assignments are not available yet. Your classes and their work will appear here when connected."
      home="/teacher"
    />
  );
}
