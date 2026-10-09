"use client";

import Link from "next/link";
import { Container, PageMasthead, Section, GroupHeading } from "@/components/layout";
import { EmptyState } from "@/components/app/EmptyState";
import { buttonVariants } from "@/components/ui/button";
import { useEnrollment } from "@/lib/enrollment";
import { announcementsForClass } from "@/fixtures/messaging/announcements";

export function StudentClassPageClient({ classId }: { classId: string }) {
  const { classById } = useEnrollment();
  const room = classById(classId);

  if (!room) {
    return (
      <Container>
        <EmptyState
          label="Class"
          title="Class not found"
          body="This class may have been created in another browser, or the link is stale."
          action={
            <Link href="/student/classes" className={buttonVariants({ variant: "outline" })}>
              Back to my classes
            </Link>
          }
        />
      </Container>
    );
  }

  const announcements = announcementsForClass(room.name);

  return (
    <Container>
      <PageMasthead
        scale="page"
        label="Class"
        title={room.name}
        lede={`${room.teacherName}. Announcements here are from your teacher and are read-only.`}
      />

      <Section size="tight" bordered>
        <GroupHeading count={announcements.length}>Announcements</GroupHeading>
        {announcements.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            No announcements in this class yet.
          </p>
        ) : (
          <div>
            {announcements.map((a) => (
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
