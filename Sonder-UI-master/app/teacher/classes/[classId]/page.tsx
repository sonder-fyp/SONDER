import { CLASSES } from "@/fixtures/classes";
import { ClassDetailClient } from "./ClassDetailClient";

/**
 * Only the two fixture class ids are pre-generated, and — unlike every other
 * dynamic route in the app — this one does not 404 for an unrecognized id.
 * Classes created by the teacher exist only in browser storage, so the
 * server can't know their ids; resolution happens client-side instead (see
 * ClassDetailClient), with an in-page "not found" state for anything that
 * doesn't resolve there.
 */
export function generateStaticParams() {
  return CLASSES.map((c) => ({ classId: c.id }));
}

export default async function TeacherClassDetail({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <ClassDetailClient classId={classId} />;
}
