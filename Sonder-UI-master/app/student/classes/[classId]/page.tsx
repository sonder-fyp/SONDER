import { CLASSES } from "@/fixtures/classes";
import { StudentClassPageClient } from "./StudentClassPageClient";

/** Same client-resolution exception as the teacher's class detail route — see that page's comment. */
export function generateStaticParams() {
  return CLASSES.map((c) => ({ classId: c.id }));
}

export default async function StudentClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <StudentClassPageClient classId={classId} />;
}
