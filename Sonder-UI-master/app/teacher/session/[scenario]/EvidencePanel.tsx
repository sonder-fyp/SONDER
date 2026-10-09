"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { Scenario } from "@/fixtures/scenarios/types";
import { useScenarioPlayer } from "@/lib/useScenarioPlayer";
import { hypothesisRows } from "@/lib/hypotheses";
import { studentForScenario } from "@/fixtures/students";
import {
  Container,
  PageMasthead,
  Section,
  Split,
} from "@/components/layout";
import { StepTimeline } from "@/components/app/StepTimeline";
import { SessionTabs } from "./Tabs";
import {
  PosteriorBarSet,
  EvidenceStep,
  StatusMark,
  OutcomeBanner,
  type SessionStatus,
} from "@/components/shared";
import { Label } from "@/components/type";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OUTCOME_STATUS: Record<string, SessionStatus> = {
  diagnosed: "diagnosed",
  escalated_no_separator: "escalated",
  escalated_exhausted: "escalated",
  escalated_unmodelled: "escalated",
};

export function EvidencePanel({ scenario }: { scenario: Scenario }) {
  const player = useScenarioPlayer(scenario);
  const { current, stepIndex, totalSteps } = player;
  const student = studentForScenario(scenario.id);
  const finalStep = scenario.steps[scenario.steps.length - 1];
  const status = OUTCOME_STATUS[finalStep.outcome] ?? "awaiting-review";
  const questionSteps = scenario.steps.filter((s) => s.questionText !== null);
  const diagnosed =
    finalStep.outcome === "diagnosed"
      ? (scenario.hypothesisLabels[scenario.studyNote?.code ?? "M1"] ??
        scenario.studyNote?.name ??
        "Misconception identified")
      : null;

  return (
    <Container>
      <PageMasthead
        label="Evidence"
        title={student?.name ?? "Student"}
        lede={`${cap(scenario.subject)} · ${scenario.topicName}`}
        meta={<StatusMark status={status} />}
        tabs={<SessionTabs scenarioId={scenario.id} />}
      />

      <StepTimeline
        total={totalSteps}
        current={stepIndex}
        onStepChange={(i) => player.goTo(i)}
        label="Session steps"
      />

      <Section size="tight">
        <Split
          ratio="8/4"
          sticky
          primary={
            <div>
              {current.questionText ? (
                <>
                  <Label tone="muted">Question asked</Label>
                  <p className="mt-4 text-2xl font-semibold leading-snug tracking-tight">
                    {current.questionText}
                  </p>
                  <ul className="mt-8 border-t border-border">
                    {current.optionsShown?.map((opt) => {
                      const isAnswer = opt === current.answerGiven;
                      const isCorrect = opt === current.correctAnswer;
                      return (
                        <li
                          key={opt}
                          className={cn(
                            "relative flex min-h-14 items-center justify-between gap-6 border-b border-border px-2 py-4 text-base",
                            isAnswer && "bg-muted",
                          )}
                        >
                          {isAnswer ? (
                            <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
                          ) : null}
                          <span>{opt}</span>
                          <span className="label flex items-center gap-3 text-muted-foreground">
                            {isCorrect ? (
                              <span className={cn("inline-flex items-center gap-1", isAnswer ? "text-foreground" : "text-accent")}>
                                <Check className="size-3.5" strokeWidth={1.5} />
                                correct
                              </span>
                            ) : null}
                            {isAnswer ? <span>answered</span> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <Label tone="muted" className="mt-10">
                    Why this question
                  </Label>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {current.explanation}
                  </p>
                </>
              ) : (
                <>
                  <Label tone="muted">Session end</Label>
                  <p className="mt-4 text-base leading-relaxed">{current.explanation}</p>
                </>
              )}

              <div className="mt-16">
                <Label tone="muted">
                  Full answer trace
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
                      isCurrent={s.stepIndex === stepIndex}
                    />
                  ))}
                </div>
              </div>
            </div>
          }
          secondary={
            <div>
              <StatusMark status={status} />
              <OutcomeBanner
                className="mt-8"
                type={diagnosed ? "diagnosed" : "unsure"}
                title="Engine outcome"
                message={diagnosed ? `Diagnosed: ${diagnosed}` : finalStep.explanation}
              />
              <Label tone="muted" className="mt-10">
                Posterior after this step
              </Label>
              <div className="mt-6">
                <PosteriorBarSet
                  hypotheses={hypothesisRows(scenario, current.posterior)}
                />
              </div>
              <div className="mt-12 flex flex-col items-start gap-6">
                <Link
                  href={`/teacher/session/${scenario.id}/review`}
                  className={buttonVariants()}
                >
                  {status === "escalated" ? "Resolve this case" : "Go to review"}
                </Link>
                <Link href="/teacher" className={buttonVariants({ variant: "ghost" })}>
                  Back to dashboard
                </Link>
              </div>
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
