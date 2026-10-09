"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Scenario } from "@/fixtures/scenarios/types";
import { useScenarioPlayer } from "@/lib/useScenarioPlayer";
import { OutcomeBanner } from "@/components/shared";
import { FocusFrame } from "@/components/layout";
import { Label, AccentBar } from "@/components/type";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const THINKING_MS = 950;

export function SessionClient({
  scenario,
  mode,
}: {
  scenario: Scenario;
  mode: "general" | "topic";
}) {
  const player = useScenarioPlayer(scenario);
  const [phase, setPhase] = useState<"intro" | "question" | "thinking" | "done">(
    "intro",
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const modeLabel =
    mode === "general"
      ? `Broad check · ${subjectName(scenario)}`
      : scenario.topicName;

  const answeredSoFar = player.stepIndex;
  const nextIsEnd = useMemo(
    () => (scenario.steps[player.stepIndex + 1]?.questionText ?? null) === null,
    [scenario, player.stepIndex],
  );

  function answer(option: string) {
    if (phase !== "question") return;
    setChosen(option);
    setPhase("thinking");
    timer.current = setTimeout(() => {
      player.advance();
      setChosen(null);
      setPhase(nextIsEnd ? "done" : "question");
    }, THINKING_MS);
  }

  function restart() {
    if (timer.current) clearTimeout(timer.current);
    player.reset();
    setChosen(null);
    setPhase("intro");
  }

  const progress =
    phase === "intro"
      ? { current: 0, total: scenario.questionBudget }
      : phase === "done"
        ? { current: scenario.questionBudget, total: scenario.questionBudget }
        : {
            current: Math.min(answeredSoFar + 1, scenario.questionBudget),
            total: scenario.questionBudget,
          };

  if (phase === "intro") {
    return (
      <FocusFrame
        progress={progress}
        exitHref="/student"
        exitLabel="Leave this check"
      >
        <Label tone="accent">
          {mode === "general" ? "Broad subject check" : "Topic diagnostic"}
        </Label>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
          {modeLabel}
        </h1>
        <AccentBar className="mt-8" />
        <p className="mt-10 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          You will get one question at a time, up to {scenario.questionBudget}.
          Answer as best you can. There is no time limit and no score at the end.
        </p>
        <Button size="lg" className="mt-12 w-full" onClick={() => setPhase("question")}>
          Begin
          <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
        </Button>
      </FocusFrame>
    );
  }

  if (phase === "thinking") {
    return (
      <FocusFrame
        progress={progress}
        exitHref="/student"
        exitLabel="Leave this check"
      >
        <div role="status" className="py-16">
          <div className="rule-sweep w-40" aria-hidden />
          <p className="mt-6 text-base text-muted-foreground">
            Working through your answer
          </p>
        </div>
      </FocusFrame>
    );
  }

  if (phase === "done") {
    const o = scenario.studentOutcome;
    return (
      <FocusFrame
        progress={progress}
        exitHref="/student"
        exitLabel="Leave this check"
      >
        <Label tone="muted">{`Session complete · ${modeLabel}`}</Label>
        <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
          {o.headline}
        </h1>
        <OutcomeBanner type={o.type} message={o.message} className="mt-12" />

        <div className="mt-12 flex flex-wrap gap-8">
          {o.type === "diagnosed" ? (
            <Link
              href={`/student/remediation/${scenario.id}`}
              className={buttonVariants()}
            >
              See your study note
              <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
            </Link>
          ) : (
            <Link href="/student" className={buttonVariants()}>
              Back to home
            </Link>
          )}
          <Button variant="ghost" onClick={restart}>
            Run again
          </Button>
        </div>

        {o.type === "unsure" ? (
          <>
            <p className="mt-10 text-base">
              <Link
                href="/student/learn"
                className="relative inline-block font-medium text-foreground after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-accent"
              >
                Learn about a related concept
              </Link>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing is shared with your parent until a teacher has reviewed it.
            </p>
          </>
        ) : null}
      </FocusFrame>
    );
  }

  const step = player.current;
  return (
    <FocusFrame
      progress={progress}
      exitHref="/student"
      exitLabel="Leave this check"
    >
      <Label tone="muted">{modeLabel}</Label>
      <h1 className="mt-10 text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
        {step.questionText}
      </h1>

      <div className="mt-12 border-t border-border">
        {step.optionsShown?.map((opt, i) => {
          const selected = chosen === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => answer(opt)}
              className={cn(
                "group relative flex min-h-16 w-full items-center gap-6 border-b border-border px-2 py-5 text-left text-lg transition-colors duration-150 ease-[var(--ease)]",
                selected ? "bg-muted" : "hover:bg-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 w-0.5 transition-colors duration-150 ease-[var(--ease)]",
                  selected ? "bg-accent" : "bg-transparent group-hover:bg-border-strong",
                )}
              />
              <span
                className={cn(
                  "label nums w-6 shrink-0",
                  selected ? "text-accent" : "text-faint",
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        Sonder picks each next question from your answers so far. You will not see
        the reasoning. Your teacher does.
      </p>
    </FocusFrame>
  );
}

function subjectName(s: Scenario) {
  return s.subject.charAt(0).toUpperCase() + s.subject.slice(1);
}
