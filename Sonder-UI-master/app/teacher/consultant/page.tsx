import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Teacher"
      title="Teaching support"
      description="Support for your next decision."
      detail="The teaching assistant is not available yet. Your overview shows the tools available to your account."
      home="/teacher"
    />
  );
}
