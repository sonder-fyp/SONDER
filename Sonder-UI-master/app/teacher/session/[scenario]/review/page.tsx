import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Review"
      description="Record a thoughtful next step."
      detail="Persistent student review is not available yet. No review decision can be submitted from this page."
      home="/teacher"
    />
  );
}
