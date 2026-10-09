import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Container,
  PageMasthead,
  Section,
  Split,
  GroupHeading,
} from "@/components/layout";
import { Label } from "@/components/type";
import { StatusMark } from "@/components/shared";
import { buttonVariants } from "@/components/ui/button";
import { getStudent } from "@/fixtures/students";
import { STUDENT_HISTORY } from "@/fixtures/insights/student-history";

export function generateStaticParams() {
  return Object.keys(STUDENT_HISTORY).map((studentId) => ({ studentId }));
}

const STATUS_BADGE = {
  resolved: "diagnosed",
  monitoring: "awaiting-review",
  "awaiting-review": "awaiting-review",
} as const;

export default async function StudentInsights({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const history = STUDENT_HISTORY[studentId];
  const student = getStudent(studentId);
  if (!history || !student) notFound();

  return (
    <Container>
      <PageMasthead
        label="Student insights"
        title={student.name}
        lede={`${cap(student.subject)} · ${student.className}. The same pace read the student sees, for the same oversight you apply to diagnoses.`}
        actions={
          <Link href="/teacher" className={buttonVariants({ variant: "ghost" })}>
            Back to dashboard
          </Link>
        }
      />

      <Section size="tight">
        <Split
          ratio="8/4"
          sticky
          primary={
            <div>
              <GroupHeading>Misconception history</GroupHeading>
              <div className="border-t border-border">
                {history.timeline.map((ev, i) => (
                  <div
                    key={`${ev.code}-${ev.diagnosedOn}-${i}`}
                    className="flex flex-wrap items-start justify-between gap-6 border-b border-border py-6"
                  >
                    <div className="min-w-0">
                      <span className="label nums text-faint">{ev.code}</span>
                      <p className="mt-3 text-lg font-medium">{ev.name}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {ev.subject} · diagnosed {ev.diagnosedOn}
                        {ev.resolvedOn ? ` · resolved ${ev.resolvedOn}` : ""}
                        {ev.verification ? ` · check ${ev.verification}` : ""}
                      </p>
                    </div>
                    <StatusMark status={STATUS_BADGE[ev.status]} />
                  </div>
                ))}
              </div>
            </div>
          }
          secondary={
            <div className="border-t-2 border-t-accent pt-8">
              <Label tone="accent">Pace observation</Label>
              <p className="mt-3 text-sm text-muted-foreground">
                A pattern, not a verdict.
              </p>
              <p className="mt-6 text-base leading-relaxed">{history.paceNote.text}</p>
              <ul className="mt-8 border-t border-border">
                {history.paceNote.evidence.map((e) => (
                  <li key={e} className="border-b border-border py-3 text-sm text-muted-foreground">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          }
        />
      </Section>
    </Container>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
