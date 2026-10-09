"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Container, PageMasthead, Section, GroupHeading } from "@/components/layout";
import { EmptyState } from "@/components/app/EmptyState";
import { DataTable } from "@/components/app/DataTable";
import { StatusMark } from "@/components/shared";
import { StatRow } from "@/components/type";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEnrollment } from "@/lib/enrollment";
import { useTeacherReviews, effectiveStatus } from "@/lib/teacher-review";
import { getStudentThread, getParentThread } from "@/fixtures/messaging/threads";
import { announcementsForClass } from "@/fixtures/messaging/announcements";
import type { Announcement } from "@/fixtures/messaging/types";
import type { Student } from "@/fixtures/students";

type LocalAnnouncement = Pick<Announcement, "id" | "title" | "body" | "at">;

export function ClassDetailClient({ classId }: { classId: string }) {
  const { classById, rosterFor } = useEnrollment();
  const { decisions } = useTeacherReviews();
  const room = classById(classId);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posted, setPosted] = useState<LocalAnnouncement[]>([]);

  if (!room) {
    return (
      <Container>
        <EmptyState
          label="Class"
          title="Class not found"
          body="This class may have been created in another browser, or the link is stale."
          action={
            <Link href="/teacher/classes" className={buttonVariants({ variant: "outline" })}>
              Back to classes
            </Link>
          }
        />
      </Container>
    );
  }

  const roster = rosterFor(room);
  const rows = roster.map((student) => ({
    student,
    status: effectiveStatus(student, decisions),
  }));

  const awaiting = rows.filter((r) => r.status === "awaiting-review").length;
  const escalated = rows.filter((r) => r.status === "escalated").length;
  const resolved = rows.filter((r) => r.status === "diagnosed").length;

  const recentActivity = [...roster]
    .sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1))
    .slice(0, 4);

  const fixtureAnnouncements = announcementsForClass(room.name);
  const stream: LocalAnnouncement[] = [...posted, ...fixtureAnnouncements];

  function post() {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) return;
    setPosted((p) => [{ id: `local-${Date.now()}`, title: t, body: b, at: "Just now" }, ...p]);
    setTitle("");
    setBody("");
    toast.success(`Posted to ${room!.name}`, {
      description: "Not delivered in this build — students see fixture announcements only.",
    });
  }

  return (
    <Container>
      <PageMasthead
        scale="page"
        label="Class"
        title={room.name}
        lede={`${roster.length} ${roster.length === 1 ? "student" : "students"} · ${room.teacherName}`}
        meta={
          <div>
            <p className="label text-muted-foreground">Join code</p>
            <p className="nums mt-2 text-2xl font-semibold tracking-tight">{room.joinCode}</p>
            <Link
              href="/teacher/messages"
              className="label mt-6 inline-block text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Messages →
            </Link>
          </div>
        }
      />

      <Section size="compact">
        <StatRow
          items={[
            { label: "Awaiting review", value: awaiting, tone: awaiting ? "attention" : "muted" },
            { label: "Escalated", value: escalated, tone: escalated ? "attention" : "muted" },
            { label: "Resolved", value: resolved, tone: "accent" },
          ]}
        />
      </Section>

      <Section size="tight" bordered>
        <GroupHeading count={roster.length}>Roster</GroupHeading>
        {roster.length === 0 ? (
          <EmptyState
            title="No students yet"
            body={`Share the join code ${room.joinCode} to add students to this class.`}
          />
        ) : (
          <DataTable
            caption={`${room.name} roster`}
            getRowKey={(r) => r.student.id}
            rows={rows}
            columns={[
              {
                key: "student",
                header: "Student",
                cell: ({ student }) =>
                  student.scenarioId ? (
                    <Link
                      href={`/teacher/session/${student.scenarioId}`}
                      className="font-medium hover:underline"
                    >
                      {student.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{student.name}</span>
                  ),
              },
              {
                key: "topic",
                header: "Topic",
                className: "text-muted-foreground",
                cell: ({ student }) => student.topicName,
              },
              {
                key: "status",
                header: "Status",
                cell: ({ status }) => <StatusMark status={status} />,
              },
              {
                key: "activity",
                header: "Last activity",
                className: "whitespace-nowrap text-muted-foreground",
                cell: ({ student }) => student.lastActivity,
              },
              {
                key: "links",
                header: "Links",
                cell: ({ student }) => <RosterLinks student={student} />,
              },
            ]}
          />
        )}
      </Section>

      {roster.length > 0 ? (
        <Section size="tight" bordered>
          <GroupHeading>Recent activity</GroupHeading>
          <div className="border-t border-border">
            {recentActivity.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border py-5"
              >
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-3 text-sm text-muted-foreground">{s.topicName}</span>
                </span>
                <span className="text-sm text-muted-foreground">{s.lastActivity}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section size="tight" bordered>
        <GroupHeading count={stream.length}>Announcements</GroupHeading>

        <div className="max-w-xl border-b border-border py-8">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Students can read this but cannot reply."
            className="mt-4"
          />
          <Button className="mt-6" disabled={!title.trim() || !body.trim()} onClick={post}>
            Post announcement
          </Button>
        </div>

        {stream.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          <div>
            {stream.map((a) => (
              <div key={a.id} className="border-b border-border py-6">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h3 className="text-lg font-medium">{a.title}</h3>
                  <span className="label text-faint">{a.at}</span>
                </div>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                  {a.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </Container>
  );
}

function RosterLinks({ student }: { student: Student }) {
  const studentThread = getStudentThread(student.id);
  const parentThread = getParentThread(student.id);
  if (!studentThread && !parentThread) return null;

  return (
    <span className="flex flex-wrap gap-4">
      {studentThread ? (
        <Link
          href={`/teacher/messages/${studentThread.id}`}
          className="label text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          Student
        </Link>
      ) : null}
      {parentThread ? (
        <Link
          href={`/teacher/messages/${parentThread.id}`}
          className="label text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          Parent
        </Link>
      ) : null}
    </span>
  );
}
