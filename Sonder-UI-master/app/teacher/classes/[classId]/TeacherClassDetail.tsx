"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageMasthead } from "@/components/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { SignInAgain } from "@/components/product/SignInAgain";
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { TeacherClass } from "@/lib/classes/types";

function BackToClasses() {
  return (
    <Link href="/teacher/classes" className={buttonVariants({ variant: "ghost" })}>
      <ArrowLeft className="size-4" aria-hidden />
      All classes
    </Link>
  );
}

function JoinCode({ code }: { code: string }) {
  const [copy, setCopy] = useState<"" | "Copied" | "Copy failed. Select the code instead.">("");
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopy("Copied");
    } catch {
      setCopy("Copy failed. Select the code instead.");
    }
  }
  return (
    <section aria-labelledby="join-code" className="border-y border-border py-10">
      <h2 id="join-code" className="label text-muted-foreground">Join code</h2>
      <p className="mt-4 select-all font-mono text-4xl tracking-[0.2em] md:text-5xl">{code}</p>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Share this code with your students. They enter it to join this class.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-8">
        <Button variant="outline" onClick={() => void copyCode()}>Copy code</Button>
        <span role="status" className="text-sm text-muted-foreground">{copy}</span>
      </div>
    </section>
  );
}

export function TeacherClassDetail({ classId }: { classId: string }) {
  const [room, setRoom] = useState<TeacherClass>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.teacherClass(classId)
      .then((value) => { if (active) setRoom(value); })
      .catch((cause) => { if (active) setError(cause instanceof ClassesError ? cause.code : "service_unavailable"); });
    return () => { active = false; };
  }, [classId, attempt]);

  if (error === "authentication_required") return <SignInAgain returnTo={`/teacher/classes/${classId}`} />;
  if (error === "class_not_found")
    return (
      <>
        <PageMasthead label="Teacher" title="Class not found" lede="This class does not exist or is not one of your classes." />
        <div className="py-10"><BackToClasses /></div>
      </>
    );
  if (error)
    return (
      <>
        <PageMasthead label="Teacher" title="Class details" />
        <section role="alert" className="my-10 border-l-2 border-attention py-3 pl-6">
          <h2 className="text-xl font-semibold">We could not load this class</h2>
          <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">Nothing has changed. Try again in a moment.</p>
          <Button className="mt-6" onClick={() => { setError(null); setAttempt(attempt + 1); }}>Retry</Button>
        </section>
      </>
    );
  if (!room)
    return (
      <>
        <PageMasthead label="Teacher" title="Class details" />
        <div role="status" className="py-10">
          <p className="text-muted-foreground">Loading class…</p>
          <div aria-hidden className="mt-6 h-24 border-y border-border bg-muted/30 motion-safe:animate-pulse" />
        </div>
      </>
    );
  return (
    <>
      <PageMasthead
        label={room.status === "archived" ? "Archived class" : "Class"}
        title={room.name}
        lede={room.note || undefined}
        meta={
          <p className="text-sm text-muted-foreground">
            Mathematics · Grade {room.grade_level} · {room.student_count} {room.student_count === 1 ? "student" : "students"}
          </p>
        }
      />
      <div className="py-10"><JoinCode code={room.join_code} /></div>
      <BackToClasses />
    </>
  );
}
