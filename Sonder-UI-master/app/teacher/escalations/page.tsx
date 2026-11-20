import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Follow-up"
      description="Give attention where it is needed."
      detail="The follow-up queue is not available yet. It will show authorised student work that needs your attention."
      home="/teacher"
    />
  );
}
