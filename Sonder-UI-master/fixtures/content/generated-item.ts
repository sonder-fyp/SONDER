/**
 * The one worked example that flows through the content-validation pipeline
 * (Features 13–17, 19). Generated to close the (M2, M3) gap that Scenario C
 * logged: no existing question separates "ignores the coefficients" from
 * "inverts the ratio".
 */

export type GeneratedOption = {
  text: string;
  correct: boolean;
  /** Which misconception this option is designed to catch. "unmapped" = none. */
  maps: "NONE" | "M1" | "M2" | "M3" | "unmapped";
  rationale: string;
};

export type ReviewerJudgement = {
  name: string;
  verdict: "approve" | "approve-with-edit" | "reject";
  note: string;
};

export const GENERATED_ITEM = {
  id: "gen-2026-0834",
  subject: "chemistry" as const,
  createdAt: "28 Aug 2026",
  generatedBy: "Question generator v0.4 · moles template",
  gap: {
    pair: ["M2", "M3"] as const,
    labels: [
      "Ignores the balancing coefficients",
      "Inverts the mole ratio",
    ],
    detectedAt: "28 Aug 2026",
    detectedFrom: "Scenario replay — Hina Raza, moles session",
  },
  question:
    "4Fe + 3O₂ → 2Fe₂O₃. Starting from 12 mol of O₂ with iron in excess, how many moles of Fe₂O₃ form?",
  distractorSource: "computed" as const,
  mappingSource: "ai-proposed" as const,
  options: [
    {
      text: "8 mol",
      correct: true,
      maps: "NONE",
      rationale: "Correct. 3:2 ratio, 12 × 2/3 = 8.",
    },
    {
      text: "12 mol",
      correct: false,
      maps: "M2",
      rationale: "Treats the ratio as 1:1 — the coefficient-ignoring error.",
    },
    {
      text: "18 mol",
      correct: false,
      maps: "M3",
      rationale: "Uses 3:2 the wrong way round, 12 × 3/2 = 18 — the inverted ratio.",
    },
    {
      text: "6 mol",
      correct: false,
      maps: "unmapped",
      rationale: "Halves the 12 without using the ratio. Not a modelled misconception.",
    },
  ] satisfies GeneratedOption[],
  reviewers: [
    {
      name: "Imran Shah",
      verdict: "approve",
      note: "Ratio arithmetic checks out. 12 and 18 clearly land on M2 and M3.",
    },
    {
      name: "Ayesha Siddiqui",
      verdict: "approve-with-edit",
      note: "Approve the question. Change the '6 mol' label from M1 to unmapped — halving isn't the grams-as-moles error.",
    },
  ] satisfies ReviewerJudgement[],
  /** Both approve; they differ on one distractor's label — a minor disagreement. */
  agreement: "minor-disagreement" as const,
  adjudication:
    "Question and the M2 / M3 mappings are accepted. '6 mol' is recorded as unmapped, per Reviewer B. Item enters the bank.",
};
