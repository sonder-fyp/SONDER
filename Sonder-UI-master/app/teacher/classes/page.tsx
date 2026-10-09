"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Container, PageMasthead, Section } from "@/components/layout";
import { Label } from "@/components/type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEnrollment } from "@/lib/enrollment";
import { useTeacherReviews, effectiveStatus, type ReviewDecision } from "@/lib/teacher-review";
import type { ClassRoom } from "@/fixtures/classes";
import type { Student } from "@/fixtures/students";

export default function TeacherClasses() {
  const { allClasses, rosterFor, createClass } = useEnrollment();
  const { decisions } = useTeacherReviews();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    const created = createClass(name, note);
    if (!created) return;
    setName("");
    setNote("");
    setOpen(false);
    toast.success(`Created ${created.name}`, {
      description: `Join code ${created.joinCode} — share it with students to add them.`,
    });
  }

  return (
    <Container>
      <PageMasthead
        scale="page"
        label="Class"
        title="Your classes"
        lede="Every class here is either a fixture set or one you created in this build."
        actions={
          <Button variant="outline" onClick={() => setOpen((o) => !o)}>
            {open ? "Cancel" : "Create class"}
          </Button>
        }
      />

      {open ? (
        <Section size="compact" bordered>
          <Label tone="muted">New class</Label>
          <div className="mt-6 max-w-md space-y-6">
            <div>
              <label htmlFor="class-name" className="text-sm font-medium">
                Class name
              </label>
              <Input
                id="class-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 10-A"
                className="mt-3"
              />
            </div>
            <div>
              <label htmlFor="class-note" className="text-sm font-medium">
                Note <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="class-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A short line of context for this class"
                className="mt-3"
              />
            </div>
            <div className="flex flex-wrap gap-8">
              <Button disabled={!name.trim()} onClick={submit}>
                Create class
              </Button>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Section>
      ) : null}

      <Section size="tight" bordered>
        <div>
          {allClasses.map((room) => (
            <ClassCard
              key={room.id}
              room={room}
              roster={rosterFor(room)}
              decisions={decisions}
            />
          ))}
        </div>
      </Section>
    </Container>
  );
}

function ClassCard({
  room,
  roster,
  decisions,
}: {
  room: ClassRoom;
  roster: Student[];
  decisions: Record<string, ReviewDecision>;
}) {
  let awaiting = 0;
  let escalated = 0;
  let resolved = 0;
  roster.forEach((s) => {
    const status = effectiveStatus(s, decisions);
    if (status === "escalated") escalated += 1;
    else if (status === "diagnosed") resolved += 1;
    else awaiting += 1;
  });

  return (
    <Link
      href={`/teacher/classes/${room.id}`}
      className="group block border-b border-border py-8 transition-colors duration-150 ease-[var(--ease)] hover:bg-muted"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">{room.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {roster.length} {roster.length === 1 ? "student" : "students"} · {room.teacherName}
          </p>
        </div>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-[var(--ease)] group-hover:translate-x-1 group-hover:text-accent"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>

      <p className="mt-4 max-w-2xl text-base text-muted-foreground">{room.note}</p>

      <div className="mt-6 flex flex-wrap items-center gap-8">
        <span className="label text-muted-foreground">
          <span className="nums text-foreground">{awaiting}</span> awaiting
        </span>
        <span className="label text-muted-foreground">
          <span className="nums text-attention">{escalated}</span> escalated
        </span>
        <span className="label text-muted-foreground">
          <span className="nums text-accent">{resolved}</span> resolved
        </span>
        <span className="label text-faint">Join code {room.joinCode}</span>
      </div>
    </Link>
  );
}
