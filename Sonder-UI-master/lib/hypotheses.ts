import type { PosteriorState, Scenario } from "@/fixtures/scenarios/types";
import type { Hypothesis } from "@/components/shared";

/**
 * Turn a step's posterior into the rows PosteriorBarSet expects, using the
 * scenario's curated hypothesis labels and keeping their author-defined order.
 */
export function hypothesisRows(
  scenario: Scenario,
  posterior: PosteriorState,
): Hypothesis[] {
  return Object.entries(scenario.hypothesisLabels).map(([id, label]) => ({
    id,
    label: label as string,
    probability: posterior[id as keyof PosteriorState] ?? 0,
  }));
}
