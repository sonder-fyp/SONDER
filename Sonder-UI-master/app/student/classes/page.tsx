import { WorkspaceState } from "@/components/product/WorkspaceState";
export default function Page() {
  return (
    <WorkspaceState
      label="Student"
      title="My classes"
      description="Your classes, all in one place."
      detail="Joining a class by code is not available yet. Ask your teacher when class enrolment will open."
      home="/student"
      action="Explore diagnostics"
      actionHref="/student/start"
    />
  );
}
