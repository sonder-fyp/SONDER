import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScenarioPlayer } from "@/lib/useScenarioPlayer";
import { assertScenarioPosteriors } from "@/lib/assertPosterior";
import { scenarioA, scenarioB, scenarioC } from "@/fixtures/scenarios";
import type { Scenario } from "@/fixtures/scenarios/types";

describe("useScenarioPlayer", () => {
  it("starts on the first step", () => {
    const { result } = renderHook(() => useScenarioPlayer(scenarioB));
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
    expect(result.current.current).toBe(scenarioB.steps[0]);
    expect(result.current.totalSteps).toBe(3);
  });

  it("advances through every scripted step in order", () => {
    const { result } = renderHook(() => useScenarioPlayer(scenarioB));

    act(() => result.current.advance());
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.current.questionText).toContain("nearest whole number");

    act(() => result.current.advance());
    expect(result.current.stepIndex).toBe(2);
    expect(result.current.current.outcome).toBe("diagnosed");
    expect(result.current.current.questionText).toBeNull();
    expect(result.current.isLast).toBe(true);
  });

  it("clamps at the final step — advancing past the end is a no-op", () => {
    const { result } = renderHook(() => useScenarioPlayer(scenarioB));
    for (let i = 0; i < 6; i++) act(() => result.current.advance());
    expect(result.current.stepIndex).toBe(2);
  });

  it("reset returns to the first step", () => {
    const { result } = renderHook(() => useScenarioPlayer(scenarioB));
    act(() => result.current.advance());
    act(() => result.current.advance());
    act(() => result.current.reset());
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.isFirst).toBe(true);
  });

  it("goTo jumps to a step and clamps out-of-range targets", () => {
    const { result } = renderHook(() => useScenarioPlayer(scenarioC));
    act(() => result.current.goTo(3));
    expect(result.current.stepIndex).toBe(3);
    act(() => result.current.goTo(99));
    expect(result.current.stepIndex).toBe(scenarioC.steps.length - 1);
    act(() => result.current.goTo(-5));
    expect(result.current.stepIndex).toBe(0);
  });

  it("history contains every step up to and including the current one", () => {
    const { result } = renderHook(() => useScenarioPlayer(scenarioC));
    act(() => result.current.advance());
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0]).toBe(scenarioC.steps[0]);
    expect(result.current.history[1]).toBe(scenarioC.steps[1]);
  });
});

describe("scenario fixtures", () => {
  it("every scenario has a posterior that sums to 1.0 at every step", () => {
    expect(() => assertScenarioPosteriors(scenarioA)).not.toThrow();
    expect(() => assertScenarioPosteriors(scenarioB)).not.toThrow();
    expect(() => assertScenarioPosteriors(scenarioC)).not.toThrow();
  });

  it("scenario B is the tie case: step 0's top two are within 0.03", () => {
    const p = scenarioB.steps[0].posterior;
    const sorted = Object.values(p).sort((a, b) => b - a);
    expect(sorted[0] - sorted[1]).toBeLessThanOrEqual(0.03);
  });

  it("scenario C ends by escalating, not diagnosing", () => {
    const last = scenarioC.steps[scenarioC.steps.length - 1];
    expect(last.outcome).toBe("escalated_no_separator");
    expect(scenarioC.studentOutcome.type).toBe("unsure");
  });

  it("diagnosed scenarios carry a study note and a verification check", () => {
    for (const s of [scenarioA, scenarioB]) {
      expect(s.studentOutcome.type).toBe("diagnosed");
      expect(s.studyNote).toBeDefined();
      expect(s.verification).toBeDefined();
    }
  });

  it("assertScenarioPosteriors throws when a posterior does not sum to 1.0", () => {
    const bad: Scenario = {
      ...scenarioB,
      steps: [
        {
          ...scenarioB.steps[0],
          posterior: { M1: 0.5, M2: 0.2, M3: 0.1, M4: 0.1, NONE: 0.05, UNMODELLED: 0.2 },
        },
      ],
    };
    expect(() => assertScenarioPosteriors(bad)).toThrow(/sums to/);
  });
});
