"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GenerationRun } from "@/fixtures/content/generation-run";
import { assertGenerationRun } from "@/lib/assertGenerationRun";
import { getStudent } from "@/fixtures/students";
import {
  Container,
  PageMasthead,
  Section,
  Split,
  MetaList,
} from "@/components/layout";
import { StepTimeline } from "@/components/app/StepTimeline";
import { Label } from "@/components/type";
import { Mark } from "@/components/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Local round index so StepTimeline can jump. Mirrors useRunPlayer without
 * editing that hook (no goTo there).
 */
function useRoundIndex(run: GenerationRun) {
  useMemo(() => assertGenerationRun(run), [run]);
  const [roundIndex, setRoundIndex] = useState(0);
  const lastIndex = run.rounds.length - 1;
  const current = run.rounds[Math.min(roundIndex, lastIndex)];
  return {
    current,
    roundIndex,
    isFirst: roundIndex === 0,
    isComplete: roundIndex >= lastIndex,
    totalRounds: run.rounds.length,
    keptSoFar: current.keptTotal,
    target: run.target,
    history: run.rounds.slice(0, roundIndex + 1),
    goTo: (i: number) =>
      setRoundIndex(Math.min(lastIndex, Math.max(0, i))),
    advance: () => setRoundIndex((i) => Math.min(i + 1, lastIndex)),
    reset: () => setRoundIndex(0),
  };
}

export function GenerationRunClient({ run }: { run: GenerationRun }) {
  const player = useRoundIndex(run);
  const student = getStudent(run.trigger.studentId);
  const [targetMin, targetMax] = player.target;

  const keptStubs = player.history.flatMap((r) =>
    r.scored.filter((c) => c.passed).map((c) => c.stub),
  );

  const pct = Math.min((player.keptSoFar / targetMax) * 100, 100);

  return (
    <Container>
      <PageMasthead
        label={`Generation run · ${run.id}`}
        title={run.trigger.label}
        lede={`For ${student?.name ?? "a student"} · ${cap(run.trigger.subject)} · started ${run.startedAt}`}
      />

      <StepTimeline
        total={player.totalRounds}
        current={player.roundIndex}
        onStepChange={player.goTo}
        label="Generation rounds"
        stepNoun="Round"
      />

      <Section size="tight">
        <Split
          ratio="8/4"
          sticky
          primary={
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Round {player.current.round} of {player.totalRounds}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Drafted {player.current.drafted} · scored {player.current.scored.length} ·{" "}
                {player.current.scored.filter((c) => c.passed).length} passed
              </p>

              <div className="mt-10 border-t border-border">
                {player.current.scored.map((c) => (
                  <div
                    key={c.stub}
                    className={cn(
                      "flex items-start justify-between gap-6 border-b border-border py-5",
                      !c.passed && "opacity-55",
                    )}
                  >
                    <div className="min-w-0">
                      <Mark bucket={c.passed ? "confirmed" : "inert"} glyph>
                        {c.stub}
                      </Mark>
                      {!c.passed && c.rejectReason ? (
                        <p className="mt-2 text-sm text-muted-foreground">{c.rejectReason}</p>
                      ) : null}
                    </div>
                    <span className="nums shrink-0 font-mono text-sm">
                      {c.score.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {keptStubs.length > 0 ? (
                <div className="mt-16">
                  <Label tone="muted">
                    Kept so far
                    <span className="nums ml-3">{keptStubs.length}</span>
                  </Label>
                  <ul className="mt-6 border-t border-border">
                    {keptStubs.map((stub) => (
                      <li
                        key={stub}
                        className="flex items-center gap-3 border-b border-border py-4 text-sm"
                      >
                        <Mark bucket="confirmed" glyph={false}>
                          {stub}
                        </Mark>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {player.isComplete ? (
                <div className="mt-16 border-t-2 border-t-accent pt-8">
                  <Label tone="accent">{player.keptSoFar} questions passed the scorer.</Label>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
                    Each was run through the engine to attach its answer and misconception
                    mapping. The batch is ready for teacher review.
                  </p>
                  <Link
                    href="/teacher/content-review"
                    className={buttonVariants({ className: "mt-8" })}
                  >
                    Open the batch for review
                  </Link>
                </div>
              ) : null}
            </div>
          }
          secondary={
            <div>
              <Label tone="attention">Auto-started</Label>
              <p className="mt-4 text-base leading-relaxed">
                Because the engine escalated {student?.name ?? "a student"}
                &apos;s {student?.topicName ?? "session"}. Bank held{" "}
                <span className="nums font-medium">{run.trigger.bankCount}</span>{" "}
                questions for &ldquo;{run.trigger.label}&rdquo;.
              </p>
              <MetaList
                className="mt-10"
                items={[
                  { label: "Target", value: `${targetMin}-${targetMax} accepted` },
                  { label: "Kept so far", value: `${player.keptSoFar} / ${targetMax}` },
                  { label: "Pass mark", value: run.passMark },
                  { label: "Drafter", value: run.drafterModel },
                  { label: "Scorer", value: run.scorerModel },
                ]}
              />
              <div className="mt-8 h-0.5 w-full bg-border">
                <div
                  className="h-full bg-accent transition-[width] duration-700 ease-[var(--ease)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-12 flex flex-wrap gap-8">
                <Button onClick={player.advance} disabled={player.isComplete}>
                  {player.isFirst ? "Play round" : "Play next round"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={player.reset}
                  disabled={player.isFirst}
                >
                  Reset
                </Button>
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
