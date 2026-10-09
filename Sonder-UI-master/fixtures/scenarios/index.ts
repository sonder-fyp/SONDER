import type { Scenario, ScenarioId } from "./types";
import { scenarioA } from "./scenario-a";
import { scenarioB } from "./scenario-b";
import { scenarioC } from "./scenario-c";

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  A: scenarioA,
  B: scenarioB,
  C: scenarioC,
};

export function getScenario(id: string | null | undefined): Scenario | null {
  if (id === "A" || id === "B" || id === "C") return SCENARIOS[id];
  return null;
}

export { scenarioA, scenarioB, scenarioC };
export type { Scenario, ScenarioId };
