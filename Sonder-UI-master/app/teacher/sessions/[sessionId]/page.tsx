import { Container } from "@/components/layout";
import { TeacherEvidence } from "./TeacherEvidence";

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <Container className="pb-20">
      <TeacherEvidence key={sessionId} sessionId={sessionId} />
    </Container>
  );
}
