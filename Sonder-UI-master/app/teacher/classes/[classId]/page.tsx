import { Container } from "@/components/layout";
import { TeacherClassDetail } from "./TeacherClassDetail";

export default async function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  return (
    <Container className="pb-20">
      <TeacherClassDetail key={classId} classId={classId} />
    </Container>
  );
}
