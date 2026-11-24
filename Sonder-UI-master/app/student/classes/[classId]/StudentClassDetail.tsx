"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Container, PageMasthead } from "@/components/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { SignInAgain } from "@/components/product/SignInAgain";
import { StudentAssignments } from "@/components/student/StudentAssignments";
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { StudentClass } from "@/lib/classes/types";

const YourClasses = () => (
  <Link href="/student/classes" className={buttonVariants({ variant: "outline" })}>Your classes</Link>
);

/** One of the student's classes with that class's assignments only. */
export function StudentClassDetail({ classId }: { classId: string }) {
  const [classes, setClasses] = useState<StudentClass[]>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.studentClasses()
      .then((value) => { if (active) setClasses(value); })
      .catch((cause) => { if (active) setError(cause instanceof ClassesError ? cause.code : "service_unavailable"); });
    return () => { active = false; };
  }, [attempt]);

  if (error === "authentication_required") return <SignInAgain returnTo={`/student/classes/${classId}`} />;
  const room = classes?.find((entry) => entry.class_id === classId);
  return (
    <Container className="pb-20">
      {error ? (
        <section role="alert" className="my-10 border-l-2 border-attention py-3 pl-6">
          <p className="text-muted-foreground">We could not load this class.</p>
          <Button className="mt-4" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Retry</Button>
        </section>
      ) : !classes ? (
        <p role="status" className="py-10 text-muted-foreground">Loading your class…</p>
      ) : !room ? (
        <PageMasthead label="Class" title="Class not found" lede="You are not in this class, or it is no longer active." actions={<YourClasses />} />
      ) : (
        <>
          <PageMasthead
            label="Class"
            title={room.name}
            lede={`Mathematics · Grade ${room.grade_level}${room.teacher_names ? ` · ${room.teacher_names}` : ""}`}
            actions={<YourClasses />}
          />
          <StudentAssignments classId={classId} title="Assignments in this class" />
        </>
      )}
    </Container>
  );
}
