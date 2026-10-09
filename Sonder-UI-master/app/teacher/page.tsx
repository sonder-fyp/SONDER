"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, PageMasthead, Section, Callout, LinkRow, GroupHeading } from "@/components/layout";
import { DataTable } from "@/components/app/DataTable";
import { StatusMark, type SessionStatus } from "@/components/shared";
import { StatRow } from "@/components/type";
import { buttonVariants } from "@/components/ui/button";
import { STUDENTS, type Student } from "@/fixtures/students";
import { useTeacherReviews, effectiveStatus } from "@/lib/teacher-review";

type Row = { student: Student; status: SessionStatus; needsYou: boolean };

export default function TeacherDashboard() {
  const { decisions } = useTeacherReviews();

  const rows: Row[] = STUDENTS.map((s) => {
    const status = effectiveStatus(s, decisions);
    return {
      student: s,
      status,
      needsYou: status === "awaiting-review" || status === "escalated",
    };
  }).sort((a, b) => Number(b.needsYou) - Number(a.needsYou));

  const resolved = rows.filter((r) => r.status === "diagnosed").length;
  const escalated = rows.filter((r) => r.status === "escalated").length;
  const awaiting = rows.filter((r) => r.status === "awaiting-review").length;
  const attention = rows.filter((r) => r.needsYou);
  const lead = attention.find((r) => r.status === "escalated") ?? attention[0];

  return (
    <Container width="wide">
      <PageMasthead
        scale="page"
        label="Teacher"
        title="Class dashboard"
        lede="Every diagnosis reaches you with its evidence before a student or parent sees it."
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

      {lead ? (
        <Section size="compact" bordered>
          <Callout
            tone={lead.status === "escalated" ? "attention" : "accent"}
            kicker="Needs your attention"
            title={lead.student.name}
            body={
              <>
                {cap(lead.student.subject)} · {lead.student.topicName}
                {lead.student.note ? (
                  <span className="mt-1 block">{lead.student.note}</span>
                ) : null}
              </>
            }
            action={
              lead.student.scenarioId ? (
                <Link
                  href={`/teacher/session/${lead.student.scenarioId}`}
                  className={buttonVariants()}
                >
                  Open evidence
                  <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">
                  No session replay in this build
                </span>
              )
            }
          />
        </Section>
      ) : null}

      <Section size="tight" bordered>
        <div className="flex items-baseline justify-between gap-6 pb-6">
          <h2 className="text-2xl font-semibold tracking-tight">All students</h2>
          <Link
            href="/teacher/classes"
            className="label inline-flex min-h-11 items-center gap-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            View classes
            <ArrowRight className="size-3.5" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
        <DataTable
          caption="All students"
          getRowKey={(r) => r.student.id}
          rows={rows}
          columns={[
            {
              key: "student",
              header: "Student",
              cell: ({ student, needsYou }) => (
                <span>
                  {needsYou ? (
                    <span className="label mr-3 text-attention">Needs you</span>
                  ) : null}
                  {student.scenarioId ? (
                    <Link
                      href={`/teacher/session/${student.scenarioId}`}
                      className="font-medium hover:underline"
                    >
                      {student.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{student.name}</span>
                  )}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {student.className}
                  </span>
                </span>
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
          ]}
        />
      </Section>

      <Section size="compact" bordered>
        <GroupHeading>Where to go</GroupHeading>
        <LinkRow
          href="/teacher/escalations"
          title="Escalations"
          description="Cases the engine would not guess on."
        />
        <LinkRow
          href="/teacher/content-review"
          title="Content review"
          description="Generated questions waiting for approval."
        />
        <LinkRow
          href="/teacher/consultant"
          title="AI consultant"
          description="Ask about a student or a class."
        />
      </Section>
    </Container>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
