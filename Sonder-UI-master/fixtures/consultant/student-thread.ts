/**
 * Scripted AI-consultant conversation for the student. Every reply that makes a
 * claim carries the evidence it rests on (Feature 8). Free text that doesn't
 * match a scripted prompt gets the fallback — nothing here handles genuinely
 * open input.
 */

import type { ConsultantPrompt, ConsultantReply } from "./types";

export const STUDENT_PROMPTS: ConsultantPrompt[] = [
  {
    id: "focus",
    label: "What should I focus on next?",
    question: "What should I focus on next?",
    reply: {
      text: "Your rounding fix has held for two weeks, so that one is closed. The next thing your answers suggest is shaky is adding fractions with different denominators. You haven't been diagnosed there, it's just where you slow down. Want to run a quick check on it?",
      evidence: [
        "Rounding verification passed on 26 Aug 2026",
        "3 of your last 5 fraction attempts took over 90 seconds",
      ],
    },
  },
  {
    id: "why-wrong",
    label: "Why did I get the rounding question wrong?",
    question: "Why did I get the rounding question wrong?",
    reply: {
      text: "You were checking a digit one place too far to the right when deciding whether to round up. On 27.48 to the nearest whole number you looked at the 8 instead of the 4. The study note walks through which digit to use.",
      evidence: [
        "Session on 24 Aug 2026: answered 28 to 'Round 27.48 to the nearest whole number' (correct answer 27)",
      ],
    },
  },
  {
    id: "behind",
    label: "Am I behind the class?",
    question: "Am I behind the class?",
    reply: {
      text: "On the two misconceptions you've resolved, you were faster than the class median on one and about average on the other. 'Behind' isn't something Sonder measures — it only tracks how quickly a specific fix lands once it's found.",
      evidence: [
        "Rounding: 2 days to resolve vs class median 6",
        "Kinetic energy: 5 days vs class median 4",
      ],
    },
  },
  {
    id: "how",
    label: "How does the diagnosis actually work?",
    question: "How does the diagnosis actually work?",
    reply: {
      text: "Each answer you give shifts how likely each possible misunderstanding is. When one passes 75% with at least two answers behind it, that's the diagnosis. If two stay level, Sonder asks a question built to tell them apart. If nothing separates them, it stops and hands the case to your teacher rather than guessing.",
    },
  },
];

export const STUDENT_FALLBACK: ConsultantReply = {
  text: "I can only speak to what your session history shows. Try one of the suggested questions, or ask about a specific topic or session.",
};

export const STUDENT_GREETING: ConsultantReply = {
  text: "Hi Zara. I can talk through your past sessions and what the evidence points to next. I don't set marks and I don't diagnose — Mr Shah does that. What would you like to know?",
};
