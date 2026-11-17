import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Admin"
      title="Catalogue"
      description="Keep content organised and traceable."
      detail="Catalogue management is not available yet. Development content is candidate content, not an expert-accepted release."
      home="/admin"
    />
  );
}
