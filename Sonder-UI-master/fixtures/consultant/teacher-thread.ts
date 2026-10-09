import type { ConsultantPrompt, ConsultantReply } from "./types";

export const TEACHER_PROMPTS: ConsultantPrompt[] = [
  {
    id: "explain-hina",
    label: "What could explain Hina's answers in the moles session?",
    question: "What could explain Hina's answers in the moles session?",
    reply: {
      text: "Two modelled misconceptions fit parts of the pattern: ignoring the balancing coefficients (answers of 6 mol, 5 mol) and inverting the mole ratio (13.5 mol). Neither fits all five answers. A third possibility worth checking is that she's switching method mid-question rather than holding one wrong rule. This is a suggestion for you to weigh, not a diagnosis.",
      evidence: [
        "Q2 answer 6 mol = 1:1 ratio (coefficient-ignoring)",
        "Q3 answer 13.5 mol = inverted 3:2 ratio",
        "Q4 answer 4.4 mol = grams read as moles — a different error again",
      ],
    },
  },
  {
    id: "same-thing",
    label: "Which students are stuck on the same thing?",
    question: "Which students are stuck on the same thing?",
    reply: {
      text: "Hina Raza and Usman Tariq both show the coefficient-ratio confusion in moles, and both escalated for the same reason. Worth a short whole-group recap on reading ratios from balanced equations before re-testing either of them.",
      evidence: [
        "Hina Raza — moles session escalated 2 Sep, (M2, M3) tied",
        "Usman Tariq — moles session escalated 2 Sep, same tied pair",
      ],
    },
  },
  {
    id: "zara-reliable",
    label: "Is Zara's fast rounding fix reliable?",
    question: "Is Zara's fast rounding fix reliable?",
    reply: {
      text: "It rests on one resolved case, so treat 'resolves quickly' as a weak signal, not a property. The fresh-question check on 26 Aug is the real evidence it held. If the follow-up in a few weeks also passes, the signal is worth more.",
      evidence: [
        "1 resolved rounding case: flagged 24 Aug, verified 26 Aug",
        "Second follow-up check scheduled but not yet taken",
      ],
    },
  },
  {
    id: "queue-order",
    label: "How should I work through the escalation queue?",
    question: "How should I work through the escalation queue?",
    reply: {
      text: "Cases that escalated because two hypotheses tied (Hina, Usman) are the ones where your judgement adds the most — the engine has genuinely run out of separating questions. Cases that escalated on an exhausted budget are lower priority; another session often resolves them.",
    },
  },
];

export const TEACHER_FALLBACK: ConsultantReply = {
  text: "I can only speak to what the session and class history shows. Try one of the suggested questions, or name a student or a session.",
};

export const TEACHER_GREETING: ConsultantReply = {
  text: "Hi Mr Shah. I can talk through escalated cases, class-wide patterns, and pace observations. I propose ideas with their evidence — I don't diagnose, and nothing I say reaches a student without you.",
};
