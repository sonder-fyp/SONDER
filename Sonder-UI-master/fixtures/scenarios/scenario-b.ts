import type { Scenario } from "./types";

/**
 * Scenario B — Mathematics, rounding to decimal places. The headline scenario.
 *
 * The first answer is *correct*, but it is also exactly what a student who reads
 * a digit one place too far to the right would produce — so "no misconception"
 * and M4 sit level and cannot be separated. The engine says so out loud, then
 * picks a question (round to a whole number) where the two finally diverge.
 */
export const scenarioB: Scenario = {
  id: "B",
  subject: "mathematics",
  topicId: "rounding",
  topicName: "Rounding to decimal places",
  questionBudget: 4,
  hypothesisLabels: {
    M4: "Reads a digit one place too far right when rounding",
    M2: "Truncates instead of rounding",
    M3: "Always rounds up when the next digit is 5",
    NONE: "No misconception",
  },
  steps: [
    {
      stepIndex: 0,
      questionText: "Round 27.48 to one decimal place.",
      optionsShown: ["27.4", "27.5", "27.48", "28.0"],
      answerGiven: "27.5",
      correctAnswer: "27.5",
      posterior: { M4: 0.44, NONE: 0.45, M2: 0.05, M3: 0.03, M1: 0.02, UNMODELLED: 0.01 },
      explanation:
        "27.5 is correct. But rounding to one decimal place, the digit that decides it (tenths, 4) and the digit one place further (hundredths, 8) push the same way here — so a correct method and 'reads one digit too far' (M4) give the identical answer. They are tied at 0.44 / 0.45.",
      outcome: "in_progress",
    },
    {
      stepIndex: 1,
      questionText: "Round 27.48 to the nearest whole number.",
      optionsShown: ["27", "27.5", "28", "30"],
      answerGiven: "28",
      correctAnswer: "27",
      posterior: { M4: 0.83, NONE: 0.08, M2: 0.04, M3: 0.03, M1: 0.01, UNMODELLED: 0.01 },
      explanation:
        "Chosen to break the tie: rounding to a whole number, the deciding digit is the tenths (4 → round down → 27), but reading one place too far lands on the hundredths (8 → round up → 28). The answer 28 separates M4 from a correct method decisively.",
      outcome: "in_progress",
    },
    {
      stepIndex: 2,
      questionText: null,
      optionsShown: null,
      answerGiven: null,
      correctAnswer: null,
      posterior: { M4: 0.83, NONE: 0.08, M2: 0.04, M3: 0.03, M1: 0.01, UNMODELLED: 0.01 },
      explanation:
        "M4 is at 83% with two answers on record. Diagnosis: the deciding digit is being read one place too far to the right.",
      outcome: "diagnosed",
    },
  ],
  studentOutcome: {
    type: "diagnosed",
    headline: "Let's look at which digit you check when rounding",
    message:
      "You're deciding whether to round up by looking at a digit that's one place too far along. There's a short note below on which digit to look at, and a video.",
  },
  studyNote: {
    code: "M4",
    name: "Rounding: check the digit immediately to the right",
    explanation:
      "When you round, you've been looking one place too far to the right to decide whether to round up. On 27.48 to a whole number, you checked the 8 (hundredths) when the decision is made by the 4 (tenths).",
    correction:
      "Find the place you're rounding to, then look only at the single digit immediately to its right. If that digit is 5 or more, round up; otherwise leave it. 27.48 to the nearest whole: the digit right of the units is 4, so it stays 27.",
    videoTitle: "Rounding decimals: which digit decides",
    videoUrl:
      "https://www.youtube.com/results?search_query=rounding+decimals+which+digit+do+you+look+at",
  },
  verification: {
    context:
      "A few weeks ago you worked on which digit to check when rounding. Quick check.",
    questionText: "Round 8.2427 to two decimal places.",
    optionsShown: ["8.20", "8.24", "8.25", "8.243"],
    correctAnswer: "8.24",
    relapseAnswer: "8.25",
  },
};
