"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import {
  Container,
  PageMasthead,
  Section,
  GroupHeading,
  ListRow,
} from "@/components/layout";
import { Mark } from "@/components/shared";
import { PARENT, PARENT_SUMMARIES } from "@/fixtures/parent";
import { useTeacherReviews } from "@/lib/teacher-review";

export default function ParentHome() {
  const { decisions } = useTeacherReviews();

  const visible = (s: (typeof PARENT_SUMMARIES)[number]) => {
    if (s.approvedByDefault) return true;
    if (!s.gatedOnScenario) return false;
    const d = decisions[s.gatedOnScenario];
    return d === "approved" || d === "corrected";
  };

  const child = PARENT.children[0];
  const first = child.split(" ")[0];

  return (
    <Container>
      <PageMasthead
        scale="page"
        label="Parent"
        title={`${first}'s progress`}
        lede="Plain-language summaries, and only after a teacher has approved them. No scores, no raw results."
        meta={
          <div>
            <p className="text-lg font-medium">{child}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Class 9-B · guardian: {PARENT.guardian}
            </p>
          </div>
        }
      />

      <Section size="tight">
        <GroupHeading>Summaries</GroupHeading>
        <div className="border-t border-border">
          {PARENT_SUMMARIES.map((s) => {
            if (visible(s)) {
              return (
                <Link key={s.id} href={`/parent/summary/${s.id}`} className="block">
                  <ListRow
                    leading={<Mark bucket="confirmed">Approved</Mark>}
                    title={`${s.subject} · ${s.topicName}`}
                    meta={`${s.date}${s.approvedOn ? ` · approved ${s.approvedOn}` : ""}`}
                  />
                </Link>
              );
            }
            return (
              <div key={s.id} className="opacity-70">
                <ListRow
                  leading={<Clock className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />}
                  title={`${s.subject} · ${s.topicName}`}
                  meta={`${s.date} · awaiting your teacher's review · nothing to show yet`}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          The most recent summary appears once the teacher approves the diagnosis on
          their dashboard.
        </p>
      </Section>
    </Container>
  );
}
