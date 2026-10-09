import type { PosteriorState, Scenario } from "@/fixtures/scenarios/types";

const EPSILON = 1e-6;

const ALL_HYPOTHESES: (keyof PosteriorState)[] = [
  "M1",
  "M2",
  "M3",
  "M4",
  "NONE",
  "UNMODELLED",
];

/**
 * Dev-time guard: every posterior distribution in a fixture must be complete
 * (all six hypotheses present) and sum to 1.0. A malformed fixture is a build
 * error, not a runtime edge case — this throws loudly in development and is a
 * no-op in production.
 */
export function assertScenarioPosteriors(scenario: Scenario): void {
  if (process.env.NODE_ENV === "production") return;

  scenario.steps.forEach((step) => {
    const keys = Object.keys(step.posterior);
    const missing = ALL_HYPOTHESES.filter((h) => !(h in step.posterior));
    if (missing.length > 0) {
      throw new Error(
        `[fixture ${scenario.id}] step ${step.stepIndex}: posterior is missing ${missing.join(", ")}`,
      );
    }
    if (keys.length !== ALL_HYPOTHESES.length) {
      throw new Error(
        `[fixture ${scenario.id}] step ${step.stepIndex}: posterior has unexpected keys ${keys.join(", ")}`,
      );
    }

    const sum = Object.values(step.posterior).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > EPSILON) {
      throw new Error(
        `[fixture ${scenario.id}] step ${step.stepIndex}: posterior sums to ${sum.toFixed(4)}, expected 1.0`,
      );
    }
  });
}
