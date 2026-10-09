import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRunPlayer } from "@/lib/useRunPlayer";
import { assertGenerationRun } from "@/lib/assertGenerationRun";
import { GENERATION_RUN } from "@/fixtures/content/generation-run";
import type { GenerationRun } from "@/fixtures/content/generation-run";

describe("useRunPlayer", () => {
  it("starts on the first round", () => {
    const { result } = renderHook(() => useRunPlayer(GENERATION_RUN));
    expect(result.current.roundIndex).toBe(0);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.current).toBe(GENERATION_RUN.rounds[0]);
    expect(result.current.totalRounds).toBe(GENERATION_RUN.rounds.length);
  });

  it("advances through every round in order", () => {
    const { result } = renderHook(() => useRunPlayer(GENERATION_RUN));
    act(() => result.current.advance());
    expect(result.current.roundIndex).toBe(1);
    act(() => result.current.advance());
    act(() => result.current.advance());
    expect(result.current.roundIndex).toBe(3);
    expect(result.current.isComplete).toBe(true);
  });

  it("clamps at the final round — advancing past the end is a no-op", () => {
    const { result } = renderHook(() => useRunPlayer(GENERATION_RUN));
    for (let i = 0; i < 10; i++) act(() => result.current.advance());
    expect(result.current.roundIndex).toBe(GENERATION_RUN.rounds.length - 1);
  });

  it("reset returns to the first round", () => {
    const { result } = renderHook(() => useRunPlayer(GENERATION_RUN));
    act(() => result.current.advance());
    act(() => result.current.advance());
    act(() => result.current.reset());
    expect(result.current.roundIndex).toBe(0);
    expect(result.current.isFirst).toBe(true);
  });

  it("keptSoFar is non-decreasing as rounds advance", () => {
    const { result } = renderHook(() => useRunPlayer(GENERATION_RUN));
    let previous = result.current.keptSoFar;
    for (let i = 0; i < GENERATION_RUN.rounds.length - 1; i++) {
      act(() => result.current.advance());
      expect(result.current.keptSoFar).toBeGreaterThanOrEqual(previous);
      previous = result.current.keptSoFar;
    }
  });

  it("the final round's keptSoFar equals finalBatch.length and sits within target", () => {
    const { result } = renderHook(() => useRunPlayer(GENERATION_RUN));
    for (let i = 0; i < GENERATION_RUN.rounds.length; i++) act(() => result.current.advance());
    expect(result.current.keptSoFar).toBe(GENERATION_RUN.finalBatch.length);
    const [min, max] = GENERATION_RUN.target;
    expect(result.current.keptSoFar).toBeGreaterThanOrEqual(min);
    expect(result.current.keptSoFar).toBeLessThanOrEqual(max);
  });

  it("history contains every round up to and including the current one", () => {
    const { result } = renderHook(() => useRunPlayer(GENERATION_RUN));
    act(() => result.current.advance());
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0]).toBe(GENERATION_RUN.rounds[0]);
    expect(result.current.history[1]).toBe(GENERATION_RUN.rounds[1]);
  });
});

describe("generation run fixture", () => {
  it("passes its own dev-time assertion", () => {
    expect(() => assertGenerationRun(GENERATION_RUN)).not.toThrow();
  });

  it("no scored candidate above the pass mark is rejected, and none below it is accepted", () => {
    for (const round of GENERATION_RUN.rounds) {
      for (const c of round.scored) {
        expect(c.passed).toBe(c.score >= GENERATION_RUN.passMark);
      }
    }
  });

  it("every rejected candidate carries a reason", () => {
    for (const round of GENERATION_RUN.rounds) {
      for (const c of round.scored) {
        if (!c.passed) expect(c.rejectReason).toBeTruthy();
      }
    }
  });

  it("assertGenerationRun throws when the final batch falls outside target", () => {
    const bad: GenerationRun = {
      ...GENERATION_RUN,
      finalBatch: GENERATION_RUN.finalBatch.slice(0, 2),
    };
    expect(() => assertGenerationRun(bad)).toThrow(/finalBatch has/);
  });

  it("assertGenerationRun throws when a passed candidate is below the pass mark", () => {
    const bad: GenerationRun = {
      ...GENERATION_RUN,
      rounds: [
        {
          ...GENERATION_RUN.rounds[0],
          scored: [{ stub: "x", score: 0.1, passed: true }],
          drafted: 1,
        },
        ...GENERATION_RUN.rounds.slice(1),
      ],
    };
    expect(() => assertGenerationRun(bad)).toThrow(/below the pass mark/);
  });
});
