"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Container,
  PageMasthead,
  Split,
  ListRow,
  GroupHeading,
} from "@/components/layout";
import { EmptyState } from "@/components/app/EmptyState";
import { Label } from "@/components/type";
import { StatusMark, Mark } from "@/components/shared";
import { buttonVariants } from "@/components/ui/button";
import { ESCALATIONS } from "@/fixtures/escalations";
import { getStudent } from "@/fixtures/students";

export default function EscalationQueue() {
  const [selectedId, setSelectedId] = useState(ESCALATIONS[0]?.studentId ?? "");
  const selected = ESCALATIONS.find((e) => e.studentId === selectedId) ?? ESCALATIONS[0];
  const selectedStudent = selected ? getStudent(selected.studentId) : undefined;

  if (!ESCALATIONS.length) {
    return (
      <Container>
        <PageMasthead
          label="Escalations"
          title="Escalation queue"
          lede="Cases where the engine ran out of separating questions or budget. It never guesses, so these wait for you."
        />
        <EmptyState title="The queue is empty." />
      </Container>
    );
  }

  return (
    <Container width="wide">
      <PageMasthead
        label="Escalations"
        title="Escalation queue"
        lede="Cases where the engine ran out of separating questions or budget. It never guesses, so these wait for you."
      />

      <Split
        ratio="8/4"
        sticky
        primary={
          <div>
            <GroupHeading count={ESCALATIONS.length}>Waiting</GroupHeading>
            <div className="border-t border-border">
              {ESCALATIONS.map((esc) => {
                const student = getStudent(esc.studentId);
                return (
                  <ListRow
                    key={esc.studentId}
                    leading={<StatusMark status="escalated" />}
                    title={student?.name ?? esc.studentId}
                    meta={
                      student
                        ? `${cap(student.subject)} · ${student.topicName}`
                        : undefined
                    }
                    trailing={`escalated ${esc.escalatedOn}`}
                    selected={esc.studentId === selectedId}
                    onSelect={() => setSelectedId(esc.studentId)}
                  />
                );
              })}
            </div>
          </div>
        }
        secondary={
          selected ? (
            <div>
              <Label tone="attention">Escalated</Label>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                {selectedStudent?.name}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {selectedStudent ? cap(selectedStudent.subject) : ""} ·{" "}
                {selectedStudent?.topicName} · escalated {selected.escalatedOn}
              </p>
              <p className="mt-8 text-base leading-relaxed">
                <span className="font-medium">Why it escalated. </span>
                {selected.reason}
              </p>
              {selected.tiedPair ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Level: {selected.tiedPair[0]} vs {selected.tiedPair[1]}
                </p>
              ) : null}

              <div className="mt-10 border-t-2 border-t-accent pt-8">
                <Label tone="accent">AI consultant suggestion</Label>
                <p className="mt-4 text-sm text-muted-foreground">
                  An idea to weigh, not a diagnosis.
                </p>
                <p className="mt-4 text-base leading-relaxed">{selected.suggestion.text}</p>
                <ul className="mt-6 border-t border-border">
                  {selected.suggestion.evidence.map((e) => (
                    <li key={e} className="border-b border-border py-3 text-sm text-muted-foreground">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>

              {selected.generationRun ? (
                <div className="mt-10 border-t border-border pt-8">
                  <Label tone="attention">Generation run auto-started</Label>
                  <p className="mt-4 text-base leading-relaxed">
                    <span className="nums font-medium">{selected.generationRun.drafted}</span>{" "}
                    new questions{" "}
                    {selected.generationRun.status === "ready"
                      ? "scored and ready for review."
                      : "being scored."}
                  </p>
                  <Link
                    href={`/teacher/content-review/generation/${selected.generationRun.runId}`}
                    className={buttonVariants({ variant: "ghost", className: "mt-6" })}
                  >
                    View run
                  </Link>
                </div>
              ) : null}

              <div className="mt-12 flex flex-wrap gap-8">
                {selected.scenarioId ? (
                  <>
                    <Link
                      href={`/teacher/session/${selected.scenarioId}`}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      Open evidence
                    </Link>
                    <Link
                      href={`/teacher/session/${selected.scenarioId}/review`}
                      className={buttonVariants()}
                    >
                      Resolve
                      <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
                    </Link>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No session replay in this build. Resolve from your own records.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <Mark bucket="inert">Select a case</Mark>
          )
        }
      />
    </Container>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
