import type { ScenarioId } from "./scenarios/types";

export type Escalation = {
  studentId: string;
  /** Present = a full session replay exists (opens the evidence panel). */
  scenarioId?: ScenarioId;
  reason: string;
  tiedPair?: [string, string];
  escalatedOn: string;
  /** AI Consultant's suggested explanation — an idea to weigh, never a diagnosis. */
  suggestion: {
    text: string;
    evidence: string[];
  };
  /**
   * Present when the "bank exhausted" reason auto-started a generation run
   * (Feature 16a) — the teacher is notified, not asked first.
   */
  generationRun?: {
    runId: string;
    drafted: number;
    status: "generating" | "ready";
  };
};

export const ESCALATIONS: Escalation[] = [
  {
    studentId: "ali",
    reason:
      "The bank held only 2 questions targeting 'reads a digit one place too far right when rounding' (M4) — not enough to confirm or rule it out for this answer pattern.",
    escalatedOn: "4 Sep 2026",
    suggestion: {
      text: "Two of his three answers this session are consistent with the M4 rounding error, but the bank couldn't put enough weight behind it. A generation run has already started to close this gap — no action needed from you until it's ready.",
      evidence: [
        "Q1 answer 28 to 'round 27.48 to the nearest whole number' (correct 27) — consistent with M4",
        "Q2 answer 4.7 to 'round 4.648 to one decimal place' (correct 4.6) — consistent with M4",
      ],
    },
    generationRun: { runId: "gen-run-0912", drafted: 12, status: "ready" },
  },
  {
    studentId: "hina",
    scenarioId: "C",
    reason: "No question in the bank separates 'ignores the coefficients' from 'inverts the ratio' for this answer pattern.",
    tiedPair: ["Ignores the balancing coefficients", "Inverts the mole ratio"],
    escalatedOn: "2 Sep 2026",
    suggestion: {
      text: "Two modelled misconceptions each fit part of the pattern but not all of it. A third possibility is that she is switching method between questions rather than holding one wrong rule. Weigh this against her class work.",
      evidence: [
        "Q2 answer 6 mol = 1:1 ratio (coefficient-ignoring)",
        "Q3 answer 13.5 mol = inverted 3:2 ratio",
        "Q4 answer 4.4 mol = grams read as moles — a third pattern",
      ],
    },
  },
  {
    studentId: "usman",
    reason: "Budget exhausted at six questions with no hypothesis above 60%.",
    escalatedOn: "2 Sep 2026",
    suggestion: {
      text: "Same coefficient-ratio confusion as Hina Raza, but weaker signal. A short re-test after a group recap may resolve it without a manual diagnosis.",
      evidence: [
        "3 of 6 answers consistent with ignoring coefficients",
        "No answer consistent with a grams/moles error",
      ],
    },
  },
];

export function escalationForScenario(id: ScenarioId): Escalation | undefined {
  return ESCALATIONS.find((e) => e.scenarioId === id);
}
