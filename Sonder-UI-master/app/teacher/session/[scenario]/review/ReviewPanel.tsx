"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Scenario } from "@/fixtures/scenarios/types";
import { studentForScenario } from "@/fixtures/students";
import { catalogueForSubject, catalogueEntry } from "@/fixtures/catalogue";
import { escalationForScenario } from "@/fixtures/escalations";
import {
  MisconceptionCard,
  EvidenceStep,
  StatusMark,
  Mark,
} from "@/components/shared";
import {
  Container,
  PageMasthead,
  Section,
  Split,
} from "@/components/layout";
import { Label } from "@/components/type";
import { SessionTabs } from "../Tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useTeacherReviews,
  DECISION_LABEL,
  type ReviewDecision,
} from "@/lib/teacher-review";
import { cn } from "@/lib/utils";

export function ReviewPanel({ scenario }: { scenario: Scenario }) {
  const router = useRouter();
  const { decisions, decide } = useTeacherReviews();
  const existing = decisions[scenario.id];

  const student = studentForScenario(scenario.id);
  const finalStep = scenario.steps[scenario.steps.length - 1];
  const isEscalated = finalStep.outcome !== "diagnosed";
  const questionSteps = scenario.steps.filter((s) => s.questionText !== null);

  const diagnosed =
    scenario.studyNote &&
    catalogueEntry(scenario.subject, scenario.studyNote.code);
  const otherEntries = catalogueForSubject(scenario.subject).filter(
    (c) => c.code !== scenario.studyNote?.code,
  );

  const [mode, setMode] = useState<"idle" | "correct" | "reject" | "resolve">(
    "idle",
  );
  const [pickedCode, setPickedCode] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function commit(decision: ReviewDecision) {
    decide(scenario.id, decision);
    toast.success(`${DECISION_LABEL[decision]}`, {
      description: student
        ? `Recorded for ${student.name}. Dashboard counts updated.`
        : undefined,
    });
    router.push("/teacher");
  }

  const masthead = (
    <PageMasthead
      label="Review"
      title={student?.name ?? "Review"}
      lede={
        existing
          ? `${cap(scenario.subject)} · ${scenario.topicName}`
          : isEscalated
            ? "Resolve escalation"
            : "Approve, correct or reject the diagnosis"
      }
      meta={
        existing ? undefined : (
          <StatusMark status={isEscalated ? "escalated" : "awaiting-review"} />
        )
      }
      tabs={<SessionTabs scenarioId={scenario.id} />}
    />
  );

  const subjectCol = (
    <div>
      <StatusMark status={isEscalated ? "escalated" : "awaiting-review"} />
      <p className="mt-6 text-2xl font-semibold tracking-tight">
        {student?.name ?? "Student"}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {cap(scenario.subject)} · {scenario.topicName}
      </p>
      {isEscalated ? (
        <p className="mt-8 text-base leading-relaxed">{finalStep.explanation}</p>
      ) : diagnosed ? (
        <div className="mt-8">
          <MisconceptionCard
            code={diagnosed.code}
            name={diagnosed.name}
            description={diagnosed.description}
          />
        </div>
      ) : null}
    </div>
  );

  if (existing) {
    return (
      <Container>
        {masthead}
        <Section size="tight">
          <Split
            ratio="8/4"
            sticky
            primary={
              <div>
                <Mark bucket="confirmed">
                  Decision recorded: {DECISION_LABEL[existing]}
                </Mark>
                <div className="mt-12 flex flex-wrap gap-8">
                  <Button
                    variant="outline"
                    onClick={() => decide(scenario.id, existing)}
                  >
                    Keep as is
                  </Button>
                  <Link href="/teacher" className={buttonVariants()}>
                    Back to dashboard
                  </Link>
                </div>
                <p className="mt-8 text-sm text-muted-foreground">
                  To try a different decision, sign out and back in, or clear it from the
                  dashboard.
                </p>
              </div>
            }
            secondary={subjectCol}
          />
        </Section>
      </Container>
    );
  }

  const esc = escalationForScenario(scenario.id);

  return (
    <Container>
      {masthead}
      <Section size="tight">
        <Split
          ratio="8/4"
          sticky
          primary={
            <div>
              {isEscalated && esc ? (
                <div className="mb-12 border-t-2 border-t-accent pt-8">
                  <Label tone="accent">AI consultant suggestion</Label>
                  <p className="mt-3 text-sm text-muted-foreground">
                    An idea to weigh, not a diagnosis.
                  </p>
                  <p className="mt-4 text-base leading-relaxed">{esc.suggestion.text}</p>
                  <ul className="mt-6 border-t border-border">
                    {esc.suggestion.evidence.map((e) => (
                      <li key={e} className="border-b border-border py-3 text-sm text-muted-foreground">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Label tone="muted">
                Evidence
                <span className="nums ml-3">{questionSteps.length}</span>
              </Label>
              <div className="mt-6 border-t border-border">
                {questionSteps.map((s) => (
                  <EvidenceStep
                    key={s.stepIndex}
                    index={s.stepIndex + 1}
                    questionText={s.questionText ?? ""}
                    answerGiven={s.answerGiven ?? ""}
                    reasoning={s.explanation}
                  />
                ))}
              </div>

              {isEscalated && mode === "resolve" ? (
                <ManualResolve
                  entries={catalogueForSubject(scenario.subject)}
                  pickedCode={pickedCode}
                  setPickedCode={setPickedCode}
                  reason={reason}
                  setReason={setReason}
                  onSubmit={() => commit("resolved")}
                />
              ) : null}

              {!isEscalated && mode === "correct" ? (
                <ManualResolve
                  heading="Pick the correct misconception"
                  entries={otherEntries}
                  pickedCode={pickedCode}
                  setPickedCode={setPickedCode}
                  reason={reason}
                  setReason={setReason}
                  onSubmit={() => commit("corrected")}
                />
              ) : null}

              {!isEscalated && mode === "reject" ? (
                <div className="mt-12 border-t border-border pt-8">
                  <label className="text-base font-medium">
                    Why are you rejecting this?
                  </label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. the answers look like a careless slip, not a misconception"
                    className="mt-4"
                  />
                  <Button
                    className="mt-6"
                    disabled={!reason.trim()}
                    onClick={() => commit("rejected")}
                  >
                    Submit rejection
                  </Button>
                </div>
              ) : null}

              <div className="mt-12 flex flex-wrap gap-8">
                {isEscalated ? (
                  <>
                    <Button
                      variant={mode === "resolve" ? "primary" : "outline"}
                      onClick={() => setMode("resolve")}
                    >
                      Resolve manually
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => router.push("/teacher/escalations")}
                    >
                      Keep in queue
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => commit("approved")}>Approve</Button>
                    <Button
                      variant="outline"
                      onClick={() => setMode(mode === "correct" ? "idle" : "correct")}
                    >
                      Correct
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setMode(mode === "reject" ? "idle" : "reject")}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          }
          secondary={subjectCol}
        />
      </Section>
    </Container>
  );
}

function ManualResolve({
  heading = "Pick the misconception",
  entries,
  pickedCode,
  setPickedCode,
  reason,
  setReason,
  onSubmit,
}: {
  heading?: string;
  entries: { code: string; name: string; description: string }[];
  pickedCode: string | null;
  setPickedCode: (c: string) => void;
  reason: string;
  setReason: (r: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-12 border-t border-border pt-8">
      <p className="text-base font-medium">{heading}</p>
      <div className="mt-6 border-t border-border">
        {entries.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setPickedCode(c.code)}
            className={cn(
              "relative flex w-full gap-4 border-b border-border py-5 pr-2 pl-5 text-left transition-colors duration-150",
              pickedCode === c.code ? "bg-muted" : "hover:bg-muted",
            )}
          >
            {pickedCode === c.code ? (
              <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
            ) : null}
            <span className="label nums shrink-0 text-faint">{c.code}</span>
            <span>
              <span className="block text-base font-medium">{c.name}</span>
              <span className="mt-2 block text-sm text-muted-foreground">
                {c.description}
              </span>
            </span>
          </button>
        ))}
      </div>
      <label className="mt-8 block text-base font-medium">Reason</label>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="A short note for the record"
        className="mt-4"
      />
      <Button
        className="mt-6"
        disabled={!pickedCode || !reason.trim()}
        onClick={onSubmit}
      >
        Submit
      </Button>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
