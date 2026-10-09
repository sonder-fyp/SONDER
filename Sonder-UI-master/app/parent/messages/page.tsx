import { notFound } from "next/navigation";
import { DirectChat } from "@/components/app/DirectChat";
import { getStudent } from "@/fixtures/students";
import { getClassByName } from "@/fixtures/classes";
import { getParentThread } from "@/fixtures/messaging/threads";

/** The guardian has no id of their own — the child's id is what resolves everything here. */
const CHILD_ID = "zara";

export default function ParentMessages() {
  const child = getStudent(CHILD_ID);
  const childClass = child ? getClassByName(child.className) : undefined;
  const thread = getParentThread(CHILD_ID);
  if (!child || !childClass || !thread) notFound();

  return (
    <DirectChat
      messages={thread.messages}
      meRole="parent"
      counterpartRole="teacher"
      counterpartName={childClass.teacherName}
      context={`${child.name}'s teacher for Class ${childClass.name}`}
    />
  );
}
