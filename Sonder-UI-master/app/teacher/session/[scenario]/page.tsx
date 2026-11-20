import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Student evidence"
      description="Understand the work behind an answer."
      detail="Student evidence is not available on this link. The review service will provide access to real attempts within your classes."
      home="/teacher"
    />
  );
}
