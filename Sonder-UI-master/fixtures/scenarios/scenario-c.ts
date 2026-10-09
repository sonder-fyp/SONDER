import type { Scenario } from "./types";

/**
 * Scenario C — Chemistry, moles and stoichiometry. Escalates rather than guesses.
 *
 * The answers never settle on one error. They alternate between ignoring the
 * balancing coefficients (M2) and inverting the mole ratio (M3), with a
 * grams-as-moles slip in the middle. After five questions M2 and M3 are level
 * and no remaining item separates them, so the engine escalates and logs the
 * pair as a coverage gap.
 */
export const scenarioC: Scenario = {
  id: "C",
  subject: "chemistry",
  topicId: "moles",
  topicName: "Moles and stoichiometry",
  questionBudget: 6,
  hypothesisLabels: {
    M1: "Reads the mass in grams as a number of moles",
    M2: "Ignores the balancing coefficients (treats every ratio as 1:1)",
    M3: "Inverts the mole ratio",
    NONE: "No misconception",
  },
  steps: [
    {
      stepIndex: 0,
      questionText: "How many moles are in 36 g of water? (Mr of H₂O = 18)",
      optionsShown: ["0.5 mol", "2 mol", "18 mol", "36 mol"],
      answerGiven: "2 mol",
      correctAnswer: "2 mol",
      posterior: { M1: 0.16, M2: 0.2, M3: 0.2, M4: 0.04, NONE: 0.34, UNMODELLED: 0.06 },
      explanation:
        "Correct. The grams-as-moles confusion (M1) drops back. Both equation-ratio hypotheses are still open.",
      outcome: "in_progress",
    },
    {
      stepIndex: 1,
      questionText:
        "N₂ + 3H₂ → 2NH₃. From 6 mol of H₂ with nitrogen in excess, how many moles of NH₃ form?",
      optionsShown: ["3 mol", "4 mol", "6 mol", "9 mol"],
      answerGiven: "6 mol",
      correctAnswer: "4 mol",
      posterior: { M1: 0.14, M2: 0.33, M3: 0.22, M4: 0.02, NONE: 0.2, UNMODELLED: 0.09 },
      explanation:
        "Correct is 4 mol (3:2 ratio). The answer 6 mol treats the ratio as 1:1, ignoring the coefficients (M2). M2 rises.",
      outcome: "in_progress",
    },
    {
      stepIndex: 2,
      questionText:
        "2Al + 3Cl₂ → 2AlCl₃. From 9 mol of Cl₂ with aluminium in excess, how many moles of AlCl₃ form?",
      optionsShown: ["3 mol", "6 mol", "9 mol", "13.5 mol"],
      answerGiven: "13.5 mol",
      correctAnswer: "6 mol",
      posterior: { M1: 0.12, M2: 0.3, M3: 0.31, M4: 0.01, NONE: 0.16, UNMODELLED: 0.1 },
      explanation:
        "Correct is 6 mol (3:2). The answer 13.5 mol is the inverted ratio (M3), not the 1:1 reading. It contradicts the previous answer. M2 and M3 are now close, neither dominant.",
      outcome: "in_progress",
    },
    {
      stepIndex: 3,
      questionText: "How many moles are in 4.4 g of CO₂? (Mr of CO₂ = 44)",
      optionsShown: ["0.1 mol", "0.4 mol", "4.4 mol", "10 mol"],
      answerGiven: "4.4 mol",
      correctAnswer: "0.1 mol",
      posterior: { M1: 0.26, M2: 0.26, M3: 0.27, M4: 0.01, NONE: 0.1, UNMODELLED: 0.1 },
      explanation:
        "The answer 4.4 mol reads the mass in grams straight off as moles (M1). A third distinct error pattern. No hypothesis is near the threshold.",
      outcome: "in_progress",
    },
    {
      stepIndex: 4,
      questionText:
        "2H₂ + O₂ → 2H₂O. From 5 mol of O₂ with hydrogen in excess, how many moles of H₂O form?",
      optionsShown: ["2.5 mol", "5 mol", "10 mol", "20 mol"],
      answerGiven: "5 mol",
      correctAnswer: "10 mol",
      posterior: { M1: 0.14, M2: 0.34, M3: 0.33, M4: 0.01, NONE: 0.09, UNMODELLED: 0.09 },
      explanation:
        "Back to the 1:1 reading (M2). Over five questions the answers alternate between ignoring coefficients (M2) and inverting the ratio (M3), plus one grams-as-moles slip. M2 34%, M3 33%.",
      outcome: "in_progress",
    },
    {
      stepIndex: 5,
      questionText: null,
      optionsShown: null,
      answerGiven: null,
      correctAnswer: null,
      posterior: { M1: 0.14, M2: 0.34, M3: 0.33, M4: 0.01, NONE: 0.09, UNMODELLED: 0.09 },
      explanation:
        "Stopping. M2 and M3 sit at 34% / 33% and no remaining item in the bank separates 'ignores coefficients' from 'inverts the ratio' for this answer pattern. Handing to the teacher, and logging (M2, M3) as a coverage gap for content generation.",
      outcome: "escalated_no_separator",
    },
  ],
  studentOutcome: {
    type: "unsure",
    headline: "Not sure yet",
    message:
      "Your answers point in a few different directions, so Sonder isn't going to guess. Mr Shah will go through this with you.",
  },
};
