import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Parent"
      title="Messages"
      description="Stay in touch with your child’s teacher."
      detail="Messaging is not available yet. Please use your usual school communication channel."
      home="/parent"
    />
  );
}
