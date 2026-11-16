import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Conversation"
      description="Keep conversations connected to your teaching."
      detail="This conversation is unavailable. Messaging has not opened yet; use your usual school communication channel."
      home="/teacher"
    />
  );
}
