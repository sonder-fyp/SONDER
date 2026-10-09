"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Container, PageMasthead, Section, ListRow } from "@/components/layout";
import { Mark } from "@/components/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEnrollment } from "@/lib/enrollment";

const STUDENT_ID = "zara";

export default function StudentClasses() {
  const { classesForStudent, joinByCode } = useEnrollment();
  const [code, setCode] = useState("");

  const classes = classesForStudent(STUDENT_ID);
  const homeId = classes[0]?.id;

  function join() {
    const room = joinByCode(code, STUDENT_ID);
    if (!room) {
      toast.error("No class has that code", {
        description: "Check it with your teacher and try again.",
      });
      return;
    }
    setCode("");
    toast.success(`Joined ${room.name}`, {
      description: "It's now in your classes.",
    });
  }

  return (
    <Container>
      <PageMasthead
        scale="page"
        label="Class"
        title="My classes"
        lede="Announcements here are read-only. If you have a question, message your teacher directly."
        actions={
          <Link href="/student/messages" className={buttonVariants({ variant: "outline" })}>
            Message teacher
          </Link>
        }
      />

      <Section size="compact" bordered>
        <p className="text-base font-medium">Join a class</p>
        <div className="mt-4 flex max-w-md flex-wrap gap-6">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. SNDR-9B24"
            className="min-w-0 flex-1"
          />
          <Button disabled={!code.trim()} onClick={join}>
            Join
          </Button>
        </div>
      </Section>

      <Section size="tight" bordered>
        <div className="border-t border-border">
          {classes.map((room) => (
            <Link key={room.id} href={`/student/classes/${room.id}`} className="block">
              <ListRow
                title={room.name}
                meta={room.teacherName}
                trailing={
                  room.id === homeId ? (
                    <Mark bucket="confirmed" glyph={false}>
                      Home class
                    </Mark>
                  ) : (
                    <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
                  )
                }
              />
            </Link>
          ))}
        </div>
      </Section>
    </Container>
  );
}
