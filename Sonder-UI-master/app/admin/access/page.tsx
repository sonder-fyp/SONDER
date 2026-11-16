import { Container, PageMasthead } from "@/components/layout";
import { RoleRequestList } from "@/components/auth/RoleRequestList";
export default function AdminAccessPage() {
  return (
    <Container className="pb-20">
      <PageMasthead
        label="Administration"
        title="Access requests"
        lede="Review teacher and parent registrations. Confirm each person's relationship with the school before granting access."
      />
      <RoleRequestList />
    </Container>
  );
}
