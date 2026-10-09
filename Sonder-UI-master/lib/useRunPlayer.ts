"use client";

import { useMemo, useState } from "react";
import type { GenerationRun } from "@/fixtures/content/generation-run";
import { assertGenerationRun } from "@/lib/assertGenerationRun";

/**
 * Round-stepper for a scripted generation run — the same spirit as
 * `useScenarioPlayer`, one step at a time, nothing computed on the fly.
 * `advance()` moves to the next round on a user action; `current` is
 * whatever round the pointer is on. A screen never recomputes a score or a
 * kept-count — the fixture already has it.
 */
export function useRunPlayer(run: GenerationRun) {
  useMemo(() => assertGenerationRun(run), [run]);

  const [roundIndex, setRoundIndex] = useState(0);

  const lastIndex = run.rounds.length - 1;
  const current = run.rounds[Math.min(roundIndex, lastIndex)];
  const isComplete = roundIndex >= lastIndex;
  const isFirst = roundIndex === 0;

  const advance = () => setRoundIndex((i) => Math.min(i + 1, lastIndex));
  const reset = () => setRoundIndex(0);

  return {
    /** The round the pointer is currently on — the only thing a screen renders. */
    current,
    roundIndex,
    isFirst,
    isComplete,
    totalRounds: run.rounds.length,
    /** Cumulative accepted count as of the current round. */
    keptSoFar: current.keptTotal,
    target: run.target,
    /** Every round up to and including the current one — for a running list view. */
    history: run.rounds.slice(0, roundIndex + 1),
    advance,
    reset,
  };
}

export type RunPlayer = ReturnType<typeof useRunPlayer>;
