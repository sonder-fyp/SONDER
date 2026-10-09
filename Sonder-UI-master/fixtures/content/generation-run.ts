/**
 * A scripted LLM-drafter + ML-scorer generation run (Feature 16a).
 *
 * Different trigger from `generated-item.ts`: that item closes a *pair*
 * separator gap (Feature 13). This run closes a *thin-coverage* gap — a
 * single misconception the bank simply doesn't have enough questions for.
 * Each round the drafter proposes candidates, the scorer rates them, and
 * anything below `passMark` is rejected with a one-line reason. The loop
 * repeats until `finalBatch` sits inside `target`. Everything here is
 * pre-written fixture data — no real model runs.
 */

export type BatchOption = {
  text: string;
  correct: boolean;
  /** Which misconception this option is designed to catch. "unmapped" = none modelled. */
  maps: "NONE" | "M1" | "M2" | "M3" | "M4" | "unmapped";
  rationale: string;
};

export type ScoredCandidate = {
  /** The drafted question's stem, shown while the run is playing. */
  stub: string;
  /** 0–1, from the scorer model. */
  score: number;
  passed: boolean;
  /** One line, present only when passed === false. */
  rejectReason?: string;
};

export type GenerationRound = {
  round: number; // 1-based
  drafted: number;
  scored: ScoredCandidate[]; // length === drafted
  /** Cumulative accepted count after this round. Monotonic non-decreasing. */
  keptTotal: number;
};

export type BatchQuestion = {
  id: string;
  questionText: string;
  options: BatchOption[];
  /** The scorer's score for the item that survived. Always >= passMark. */
  score: number;
  /** The engine's confirmed correct answer for this generated item. */
  engineAnswer: string;
};

export type GenerationRun = {
  id: string;
  gapKey: string; // links to a CoverageGap
  trigger: {
    studentId: string;
    misconception: string; // catalogue code, e.g. "M4"
    label: string;
    subject: "physics" | "mathematics" | "chemistry";
    escalatedOn: string;
    bankCount: number; // how many items targeted this misconception at escalation time
  };
  drafterModel: string;
  scorerModel: string;
  passMark: number;
  target: [number, number];
  startedAt: string;
  rounds: GenerationRound[];
  finalBatch: BatchQuestion[];
};

export function getGenerationRun(id: string | null | undefined): GenerationRun | null {
  return id === GENERATION_RUN.id ? GENERATION_RUN : null;
}

export const GENERATION_RUN: GenerationRun = {
  id: "gen-run-0912",
  gapKey: "mathematics:M4:thin-coverage",
  trigger: {
    studentId: "ali",
    misconception: "M4",
    label: "Rounds using a digit one place too far right",
    subject: "mathematics",
    escalatedOn: "4 Sep 2026",
    bankCount: 2,
  },
  drafterModel: "Question drafter v0.5",
  scorerModel: "Item-quality scorer v0.2",
  passMark: 0.72,
  target: [5, 10],
  startedAt: "4 Sep 2026, 09:12",
  rounds: [
    {
      round: 1,
      drafted: 3,
      keptTotal: 2,
      scored: [
        { stub: "Round 6.2384 to two decimal places.", score: 0.85, passed: true },
        { stub: "Round 14.752 to one decimal place.", score: 0.79, passed: true },
        {
          stub: "Round 5.5 to the nearest whole number.",
          score: 0.41,
          passed: false,
          rejectReason:
            "5.5 sits exactly on the tie boundary — every hypothesis rounds it the same way, so it can't test the M4 error.",
        },
      ],
    },
    {
      round: 2,
      drafted: 3,
      keptTotal: 4,
      scored: [
        { stub: "Round 3.4623 to two decimal places.", score: 0.88, passed: true },
        { stub: "Round 9.847 to the nearest whole number.", score: 0.81, passed: true },
        {
          stub: "Round 12.0 to one decimal place.",
          score: 0.35,
          passed: false,
          rejectReason: "Already at the target precision — there's no rounding decision to make.",
        },
      ],
    },
    {
      round: 3,
      drafted: 4,
      keptTotal: 7,
      scored: [
        { stub: "Round 21.0963 to two decimal places.", score: 0.77, passed: true },
        { stub: "Round 0.6523 to one decimal place.", score: 0.83, passed: true },
        { stub: "Round 8.3624 to the nearest whole number.", score: 0.9, passed: true },
        {
          stub: "Round −3.65 to one decimal place.",
          score: 0.44,
          passed: false,
          rejectReason:
            "Introduces a negative-number sign rule the bank doesn't test elsewhere — adds a second error mode on top of M4.",
        },
      ],
    },
    {
      round: 4,
      drafted: 2,
      keptTotal: 8,
      scored: [
        { stub: "Round 17.5049 to two decimal places.", score: 0.74, passed: true },
        {
          stub: "Round 6.005 to two decimal places.",
          score: 0.6,
          passed: false,
          rejectReason:
            "The trailing zero makes the two-places-past digit read as 0 either way — doesn't separate M4 from a correct method.",
        },
      ],
    },
  ],
  finalBatch: [
    {
      id: "gen-run-0912-q1",
      questionText: "Round 6.2384 to two decimal places.",
      score: 0.85,
      engineAnswer: "6.24",
      options: [
        { text: "6.24", correct: true, maps: "NONE", rationale: "Correct — the thousandths digit (8) decides, so the hundredths round up." },
        { text: "6.23", correct: false, maps: "M4", rationale: "Checks the ten-thousandths digit (4) instead of the thousandths digit (8) immediately to the right, so rounds down when it should round up." },
        { text: "6.2", correct: false, maps: "unmapped", rationale: "Rounded to the nearest tenth instead of the nearest hundredth — wrong place value, not the M4 pattern." },
        { text: "6.3", correct: false, maps: "unmapped", rationale: "Wrong place value and wrong direction — not a modelled error." },
      ],
    },
    {
      id: "gen-run-0912-q2",
      questionText: "Round 14.752 to one decimal place.",
      score: 0.79,
      engineAnswer: "14.8",
      options: [
        { text: "14.8", correct: true, maps: "NONE", rationale: "Correct — the hundredths digit (5) decides, so the tenths round up." },
        { text: "14.7", correct: false, maps: "M4", rationale: "Checks the thousandths digit (2) instead of the hundredths digit (5) immediately to the right, so keeps the tenths as they are." },
        { text: "14.75", correct: false, maps: "unmapped", rationale: "Didn't round at all — just kept an extra digit." },
        { text: "15.0", correct: false, maps: "unmapped", rationale: "Rounded to the nearest whole number instead of one decimal place." },
      ],
    },
    {
      id: "gen-run-0912-q3",
      questionText: "Round 3.4623 to two decimal places.",
      score: 0.88,
      engineAnswer: "3.46",
      options: [
        { text: "3.46", correct: true, maps: "NONE", rationale: "Correct — the thousandths digit (2) is below 5, so the hundredths stay as they are." },
        { text: "3.47", correct: false, maps: "M4", rationale: "Checks the ten-thousandths digit (3) as if it decided the round, rounding up when the correct decider digit (2) says to keep it." },
        { text: "3.5", correct: false, maps: "unmapped", rationale: "Rounded to one decimal place instead of two." },
        { text: "3.4", correct: false, maps: "unmapped", rationale: "Truncated to one decimal place — two errors at once, not the isolated M4 pattern." },
      ],
    },
    {
      id: "gen-run-0912-q4",
      questionText: "Round 9.847 to the nearest whole number.",
      score: 0.81,
      engineAnswer: "10",
      options: [
        { text: "10", correct: true, maps: "NONE", rationale: "Correct — the tenths digit (8) decides, so the whole number rounds up." },
        { text: "9", correct: false, maps: "M4", rationale: "Checks the hundredths digit (4) instead of the tenths digit (8) immediately to the right, so keeps the whole number as it is." },
        { text: "9.8", correct: false, maps: "unmapped", rationale: "Didn't round to a whole number — stopped one place too early." },
        { text: "9.85", correct: false, maps: "unmapped", rationale: "Rounded to two decimal places instead of the nearest whole number." },
      ],
    },
    {
      id: "gen-run-0912-q5",
      questionText: "Round 21.0963 to two decimal places.",
      score: 0.77,
      engineAnswer: "21.10",
      options: [
        { text: "21.1", correct: false, maps: "unmapped", rationale: "Rounded to one decimal place, not two — wrong target precision." },
        { text: "21.10", correct: true, maps: "NONE", rationale: "Correct — the thousandths digit (6) decides, so the hundredths round up to 10, carrying into the tenths." },
        { text: "21.09", correct: false, maps: "M4", rationale: "Checks the ten-thousandths digit (3) instead of the thousandths digit (6) immediately to the right, so misses the round-up and the carry." },
        { text: "21.096", correct: false, maps: "unmapped", rationale: "Didn't round at all — kept an extra digit." },
      ],
    },
    {
      id: "gen-run-0912-q6",
      questionText: "Round 0.6523 to one decimal place.",
      score: 0.83,
      engineAnswer: "0.7",
      options: [
        { text: "0.7", correct: true, maps: "NONE", rationale: "Correct — the hundredths digit (5) decides, so the tenths round up." },
        { text: "0.6", correct: false, maps: "M4", rationale: "Checks the thousandths digit (2) instead of the hundredths digit (5) immediately to the right, so keeps the tenths as they are." },
        { text: "0.65", correct: false, maps: "unmapped", rationale: "Rounded to two decimal places instead of one." },
        { text: "1.0", correct: false, maps: "unmapped", rationale: "Rounded to the nearest whole number instead of one decimal place." },
      ],
    },
    {
      id: "gen-run-0912-q7",
      questionText: "Round 8.3624 to the nearest whole number.",
      score: 0.9,
      engineAnswer: "8",
      options: [
        { text: "8", correct: true, maps: "NONE", rationale: "Correct — the tenths digit (3) is below 5, so the whole number stays as it is." },
        { text: "9", correct: false, maps: "M4", rationale: "Checks the hundredths digit (6) as if it decided the round, rounding up when the correct decider digit (3) says to keep it." },
        { text: "8.4", correct: false, maps: "unmapped", rationale: "Didn't round to a whole number — stopped one place too early." },
        { text: "8.36", correct: false, maps: "unmapped", rationale: "Rounded to two decimal places instead of the nearest whole number." },
      ],
    },
    {
      id: "gen-run-0912-q8",
      questionText: "Round 17.5049 to two decimal places.",
      score: 0.74,
      engineAnswer: "17.5",
      options: [
        { text: "17.5", correct: true, maps: "NONE", rationale: "Correct — the thousandths digit (4) is below 5, so the hundredths stay as they are." },
        { text: "17.51", correct: false, maps: "M4", rationale: "Checks the ten-thousandths digit (9) as if it decided the round, rounding up when the correct decider digit (4) says to keep it." },
        { text: "17.505", correct: false, maps: "unmapped", rationale: "Didn't round at all — kept an extra digit." },
        { text: "18.0", correct: false, maps: "unmapped", rationale: "Rounded to the nearest whole number instead of two decimal places." },
      ],
    },
  ],
};
