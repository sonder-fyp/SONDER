import type { Subject } from "./scenarios/types";

/**
 * Coverage gaps: places the bank can't currently support a diagnosis
 * (Feature 12). Two different shapes trigger two different pipelines:
 *
 *  - "separator" (Feature 13) — a pair of misconceptions no question can
 *    tell apart. Closed by generating one new question (Features 14-17).
 *  - "thin-coverage" (Feature 16a) — a single misconception with too few
 *    questions targeting it. Closed by an automated drafter + ML-scorer
 *    loop that produces a batch of 5-10 (a `GenerationRun`).
 *
 * An open gap is the trigger for generation; each one links forward to its
 * generated content once it exists.
 */

type CoverageGapBase = {
  subject: Subject;
  status: "open" | "generating" | "in-review" | "closed";
  detectedOn: string;
  note: string;
};

export type SeparatorGap = CoverageGapBase & {
  kind: "separator";
  pair: [string, string];
  labels: [string, string];
  /** Route to the generated item, when one exists. */
  itemHref?: string;
};

export type ThinCoverageGap = CoverageGapBase & {
  kind: "thin-coverage";
  misconception: string;
  label: string;
  /** How many items in the bank currently target this misconception. */
  bankCount: number;
  /** The minimum the generation run is targeting. */
  targetMin: number;
  /** Route to the generation run, when one exists. */
  runHref?: string;
};

export type CoverageGap = SeparatorGap | ThinCoverageGap;

export const COVERAGE_GAPS: CoverageGap[] = [
  {
    kind: "thin-coverage",
    subject: "mathematics",
    misconception: "M4",
    label: "Rounds using a digit one place too far right",
    bankCount: 2,
    targetMin: 5,
    status: "in-review",
    detectedOn: "4 Sep 2026",
    note: "Found from Ali Raza's escalated rounding session. A generation run has produced 8 vetted questions, now with the content reviewers.",
    runHref: "/teacher/content-review/generation/gen-run-0912",
  },
  {
    kind: "separator",
    subject: "chemistry",
    pair: ["M2", "M3"],
    labels: ["Ignores the balancing coefficients", "Inverts the mole ratio"],
    status: "in-review",
    detectedOn: "28 Aug 2026",
    note: "Found from Hina Raza's escalated moles session. A generated question is now with the content reviewers.",
    itemHref: "/teacher/content-review",
  },
  {
    kind: "separator",
    subject: "chemistry",
    pair: ["M2", "M4"],
    labels: ["Ignores the balancing coefficients", "Uses the limiting reagent inconsistently"],
    status: "open",
    detectedOn: "1 Sep 2026",
    note: "No question distinguishes a coefficient error from a limiting-reagent error. Not yet queued for generation.",
  },
  {
    kind: "separator",
    subject: "mathematics",
    pair: ["M2", "M4"],
    labels: ["Truncates instead of rounding", "Rounds using a digit one place too far right"],
    status: "closed",
    detectedOn: "12 Aug 2026",
    note: "Closed by the 'round to the nearest whole number' item, which now separates the two.",
  },
  {
    kind: "separator",
    subject: "physics",
    pair: ["M1", "M2"],
    labels: ["Treats kinetic energy as linear in speed", "Confuses kinetic energy with momentum"],
    status: "open",
    detectedOn: "3 Sep 2026",
    note: "Both give m·v-shaped answers on single-object questions. Needs a two-object comparison item.",
  },
];
