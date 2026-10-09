import { notFound } from "next/navigation";
import { DirectChat } from "@/components/app/DirectChat";
import { getStudent } from "@/fixtures/students";
import { getClassByName } from "@/fixtures/classes";
import { getStudentThread } from "@/fixtures/messaging/threads";

const STUDENT_ID = "zara";

export default function StudentMessages() {
  const student = getStudent(STUDENT_ID);
  const homeClass = student ? getClassByName(student.className) : undefined;
  const thread = getStudentThread(STUDENT_ID);
  if (!student || !homeClass || !thread) notFound();

  return (
    <DirectChat
      messages={thread.messages}
      meRole="student"
      counterpartRole="teacher"
      counterpartName={homeClass.teacherName}
      context={`Your teacher for ${homeClass.name}`}
    />
  );
}
