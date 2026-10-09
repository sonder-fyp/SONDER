/**
 * Fixture shape for scripted scenario playback.
 *
 * The whole "backend" of this PoC is an ordered list of steps. A screen never
 * computes anything — it reads the `current` step from `useScenarioPlayer` and
 * renders it, then calls `advance()` on a user action. Every value shown already
 * exists in the fixture before the click; the click only moves a pointer.
 */

export type HypothesisId = "M1" | "M2" | "M3" | "M4" | "NONE" | "UNMODELLED";

/** Probabilities across every hypothesis. Must sum to 1.0 (see assertPosterior). */
export type PosteriorState = Record<HypothesisId, number>;

export type StepOutcome =
  | "in_progress"
  | "diagnosed"
  | "escalated_no_separator"
  | "escalated_exhausted"
  | "escalated_unmodelled"
  | "none";

export type SessionStep = {
  stepIndex: number;
  /** null = the session has ended (no further question is asked). */
  questionText: string | null;
  optionsShown: string[] | null;
  /** The pre-decided answer for this step. null on the closing step. */
  answerGiven: string | null;
  /** The correct option, for the teacher trace. null on the closing step. */
  correctAnswer?: string | null;
  posterior: PosteriorState;
  /** The engine's stated reasoning for choosing this item. Teacher-facing only. */
  explanation: string;
  outcome: StepOutcome;
};

export type ScenarioId = "A" | "B" | "C";
export type Subject = "physics" | "mathematics" | "chemistry";

/** Plain-language study note handed straight to the student (Features 6 + 7). */
export type StudyNote = {
  code: HypothesisId;
  name: string;
  /** What they were likely getting confused about, in student-facing language. */
  explanation: string;
  /** How to think about it correctly. */
  correction: string;
  videoTitle: string;
  /** A real, working URL. Swap for a curated video per topic when available. */
  videoUrl: string;
};

/** The delayed fresh-question check (Feature 4). */
export type VerificationCheck = {
  context: string;
  questionText: string;
  optionsShown: string[];
  correctAnswer: string;
  /** The option that would signal the misconception has returned. */
  relapseAnswer: string;
};

export type StudentOutcome = {
  type: "diagnosed" | "unsure";
  headline: string;
  message: string;
};

export type Scenario = {
  id: ScenarioId;
  subject: Subject;
  topicId: string;
  topicName: string;
  /** Upper bound on questions, shown to the student as "of up to N". */
  questionBudget: number;
  /** Teacher-facing names for each hypothesis that appears in the posterior. */
  hypothesisLabels: Partial<Record<HypothesisId, string>>;
  steps: SessionStep[];
  studentOutcome: StudentOutcome;
  /** Present only when studentOutcome.type === "diagnosed". */
  studyNote?: StudyNote;
  /** Present only when a verification check has been scripted for this scenario. */
  verification?: VerificationCheck;
};
