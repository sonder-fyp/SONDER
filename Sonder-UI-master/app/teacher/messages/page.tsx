import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Messages"
      description="Keep conversations connected to your teaching."
      detail="Messaging is not available yet. Use your usual school communication channel."
      home="/teacher"
    />
  );
}
