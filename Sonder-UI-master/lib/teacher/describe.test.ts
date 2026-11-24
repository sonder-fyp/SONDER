import { describe, expect, it } from "vitest";
import { parseEvidence } from "./evidence";
import { evidenceBody } from "./testEvidence";
import { describeOutcome, percent } from "./describe";

const withOutcome = (outcome: Record<string, unknown>) =>
  parseEvidence(evidenceBody({ outcome: { diagnosis_candidates: [], escalation_reason: null, escalation_leader_slot: null,
    escalation_candidates: [], ...outcome } }));

describe("outcome wording", () => {
  it("names only the rank-1 diagnosis; the runner-up is described as next most likely", () => {
    const summary = describeOutcome(withOutcome({ outcome: "diagnosed", diagnosis_candidates: [[2, 1], [1, 0]] }));
    expect(summary.label).toBe("Diagnosed: Rounds too little");
    expect(summary.label).not.toContain("No misconception");
    expect(summary.detail).toContain("Next most likely: No misconception");
    expect(summary.tone).toBe("result");
  });

  it("explains each refusal and the tied set without claiming a result", () => {
    const reason = "No remaining question separates the tied hypotheses.";
    const tied = describeOutcome(withOutcome({ outcome: "escalated_no_separator", escalation_reason: reason,
      escalation_leader_slot: 0, escalation_candidates: [[1, 0], [2, 2]] }));
    expect(tied.label).toContain("cannot tell these apart");
    expect(tied.detail).toBe("Rounds too little and Something else stay tied, and no question left can separate them.");
    expect(tied.reason).toBe(reason);
    expect(tied.tone).toBe("refusal");
    expect(describeOutcome(withOutcome({ outcome: "escalated_exhausted", escalation_reason: "Budget used." })).detail).toContain("All 8 questions");
    expect(describeOutcome(withOutcome({ outcome: "escalated_unmodelled" })).label).toContain("fit none");
  });

  it("describes none detected and unfinished sessions", () => {
    expect(describeOutcome(withOutcome({ outcome: "none_detected" }))).toMatchObject({ label: "No misconception detected", reason: null });
    expect(describeOutcome(withOutcome({ outcome: "in_progress" })).detail).toBe("1 of up to 8 questions answered.");
  });
});

describe("percent", () => {
  it("never rounds a near-certainty to 100% or a tiny value to 0%", () => {
    expect([percent(0.5), percent(0.996), percent(0.004), percent(1), percent(0)]).toEqual(["50%", ">99%", "<1%", "100%", "0%"]);
  });
});
