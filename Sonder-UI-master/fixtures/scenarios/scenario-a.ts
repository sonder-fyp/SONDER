import type { Scenario } from "./types";

/**
 * Scenario A — Physics, kinetic energy. Converges cleanly to one diagnosis.
 *
 * The student uses ½mv (linear in speed) in place of ½mv². Two questions where
 * the "linear" answer diverges sharply from both the correct answer and the
 * "forgot the ½" answer are enough to push M1 past the 75% threshold.
 */
export const scenarioA: Scenario = {
  id: "A",
  subject: "physics",
  topicId: "energy",
  topicName: "Kinetic energy and work",
  questionBudget: 4,
  hypothesisLabels: {
    M1: "Treats kinetic energy as linear in speed (½mv)",
    M3: "Uses mv² — drops the one-half",
    M2: "Confuses kinetic energy with momentum",
    NONE: "No misconception",
  },
  steps: [
    {
      stepIndex: 0,
      questionText:
        "A 2 kg trolley moves at 3 m/s along a bench. What is its kinetic energy?",
      optionsShown: ["3 J", "6 J", "9 J", "18 J"],
      answerGiven: "3 J",
      correctAnswer: "9 J",
      posterior: { M1: 0.52, M3: 0.1, M2: 0.13, M4: 0.05, NONE: 0.15, UNMODELLED: 0.05 },
      explanation:
        "3 J is ½·m·v (½·2·3). It matches treating kinetic energy as linear in speed (M1). One answer in — not yet at the threshold.",
      outcome: "in_progress",
    },
    {
      stepIndex: 1,
      questionText:
        "A 4 kg cart moves at 5 m/s. What is its kinetic energy?",
      optionsShown: ["10 J", "20 J", "50 J", "100 J"],
      answerGiven: "10 J",
      correctAnswer: "50 J",
      posterior: { M1: 0.85, M3: 0.04, M2: 0.05, M4: 0.02, NONE: 0.03, UNMODELLED: 0.01 },
      explanation:
        "Selected so the linear answer (10 J = ½·4·5) is far from both the correct answer (50 J) and the no-half answer (100 J). 10 J confirms M1.",
      outcome: "in_progress",
    },
    {
      stepIndex: 2,
      questionText: null,
      optionsShown: null,
      answerGiven: null,
      correctAnswer: null,
      posterior: { M1: 0.85, M3: 0.04, M2: 0.05, M4: 0.02, NONE: 0.03, UNMODELLED: 0.01 },
      explanation:
        "M1 is at 85% with two consistent answers on record. Diagnosis: kinetic energy is being taken as linear in speed rather than in speed squared.",
      outcome: "diagnosed",
    },
  ],
  studentOutcome: {
    type: "diagnosed",
    headline: "Let's look at how speed affects energy",
    message:
      "Your answers show you're scaling kinetic energy straight with speed. It actually grows with speed multiplied by itself. Here's a short note and a video.",
  },
  studyNote: {
    code: "M1",
    name: "Kinetic energy grows with the square of speed",
    explanation:
      "You've been working out kinetic energy as one-half times mass times speed. That gives the right shape of answer but the wrong size, because speed has to be multiplied by itself first.",
    correction:
      "The rule is KE = ½ · m · v · v. Double the speed and the energy goes up four times, not two. Try re-doing the trolley question: ½ · 2 · 3 · 3 = 9 J.",
    videoTitle: "Kinetic energy and why speed is squared",
    videoUrl:
      "https://www.youtube.com/results?search_query=kinetic+energy+why+velocity+is+squared",
  },
  verification: {
    context:
      "A few weeks ago you worked on kinetic energy and the squared speed. Quick check to see it stuck.",
    questionText: "A 1 kg cart moves at 4 m/s. What is its kinetic energy?",
    optionsShown: ["2 J", "4 J", "8 J", "16 J"],
    correctAnswer: "8 J",
    relapseAnswer: "2 J",
  },
};
