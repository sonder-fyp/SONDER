import { Container } from "@/components/layout";
import { Label } from "@/components/type";
import { RoleRequestList } from "@/components/auth/RoleRequestList";

export default function AdminAccessPage() {
  return (
    <Container className="py-12 md:py-16">
      <Label tone="accent">Administrator</Label>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight">Access review</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Approve teacher and parent access only after verifying the person’s relationship with the school.
      </p>
      <RoleRequestList />
    </Container>
  );
}
