import { requirePageRole } from "@/lib/auth/access";
import { StudentClassDetail } from "./StudentClassDetail";

export default async function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  await requirePageRole("student", `/student/classes/${classId}`);
  return <StudentClassDetail classId={classId} />;
}
