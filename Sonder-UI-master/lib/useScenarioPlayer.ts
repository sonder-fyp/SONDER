"use client";

import { useMemo, useState } from "react";
import type { Scenario } from "@/fixtures/scenarios/types";
import { assertScenarioPosteriors } from "@/lib/assertPosterior";

/**
 * The core scripted-playback hook — the one piece of engineering in this PoC.
 *
 * It holds a pointer into a scenario's step list. `advance()` moves the pointer
 * forward on a user action; `current` is whatever step the pointer is on.
 * Screens read `current` and render it. They never compute a posterior, pick a
 * next question, or decide an outcome — the fixture already did all of that.
 *
 * Because the pointer lives in React state, every re-render is a normal render:
 * value-driven styles (a posterior bar's width, a banner's colour) just need a
 * CSS transition class to animate. No animation library is involved.
 */
export function useScenarioPlayer(scenario: Scenario) {
  // Validate the fixture once per scenario instance (dev-only, throws on bad data).
  useMemo(() => assertScenarioPosteriors(scenario), [scenario]);

  const [stepIndex, setStepIndex] = useState(0);

  const lastIndex = scenario.steps.length - 1;
  const current = scenario.steps[Math.min(stepIndex, lastIndex)];
  const isLast = stepIndex >= lastIndex;
  const isFirst = stepIndex === 0;

  const advance = () =>
    setStepIndex((i) => Math.min(i + 1, lastIndex));
  const goTo = (i: number) =>
    setStepIndex(() => Math.max(0, Math.min(i, lastIndex)));
  const reset = () => setStepIndex(0);

  return {
    /** The step the pointer is currently on — the only thing a screen renders. */
    current,
    stepIndex,
    isFirst,
    isLast,
    totalSteps: scenario.steps.length,
    /** All steps up to and including the current one — for evidence-trail views. */
    history: scenario.steps.slice(0, stepIndex + 1),
    advance,
    goTo,
    reset,
  };
}

export type ScenarioPlayer = ReturnType<typeof useScenarioPlayer>;
