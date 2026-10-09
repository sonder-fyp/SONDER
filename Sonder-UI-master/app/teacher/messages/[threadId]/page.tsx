import { notFound } from "next/navigation";
import { DirectChat } from "@/components/app/DirectChat";
import { THREADS, getThreadById } from "@/fixtures/messaging/threads";
import { getStudent } from "@/fixtures/students";

/**
 * Every thread is a fixture and none can be created at runtime, so — unlike
 * the class detail route — this one resolves on the server and 404s properly
 * for an unrecognized id.
 */
export function generateStaticParams() {
  return THREADS.map((t) => ({ threadId: t.id }));
}

export default async function TeacherMessageThread({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const thread = getThreadById(threadId);
  const student = thread ? getStudent(thread.studentId) : undefined;
  if (!thread || !student) notFound();

  const context =
    thread.kind === "parent"
      ? `Guardian of ${student.name} · ${student.className}`
      : `${cap(student.subject)} · ${student.className}`;

  return (
    <DirectChat
      messages={thread.messages}
      meRole="teacher"
      counterpartRole={thread.kind === "parent" ? "parent" : "student"}
      counterpartName={thread.label}
      context={context}
    />
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
