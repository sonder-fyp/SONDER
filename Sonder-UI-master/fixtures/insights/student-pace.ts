/**
 * Learning-pace insights for the signed-in student (Feature 8). Deliberately
 * thin — Zara has two resolved misconceptions. Every number is shown with the
 * evidence it came from, and the consultant's read is framed as a pattern, not
 * a verdict.
 */

export type PaceRow = {
  label: string;
  subject: string;
  daysToResolve: number;
  classMedianDays: number;
  evidence: string;
};

export type PaceInsights = {
  student: string;
  rows: PaceRow[];
  suggestion: {
    text: string;
    evidence: string[];
    sharedWith: string;
  };
};

export const STUDENT_PACE: PaceInsights = {
  student: "Zara Qureshi",
  rows: [
    {
      label: "Rounding: reading the wrong digit",
      subject: "Mathematics",
      daysToResolve: 2,
      classMedianDays: 6,
      evidence:
        "One resolved case. Flagged 24 Aug 2026, fresh-question check passed 26 Aug 2026.",
    },
    {
      label: "Kinetic energy: linear instead of squared",
      subject: "Physics",
      daysToResolve: 5,
      classMedianDays: 4,
      evidence:
        "One resolved case. Flagged 3 Aug 2026, fresh-question check passed 8 Aug 2026.",
    },
  ],
  suggestion: {
    text: "Zara resolves procedural fixes like the rounding one quickly (2 days against a class median of 6). Where a similar step-by-step gap shows up next, a short study note on its own may be enough before booking a full session.",
    evidence: [
      "Rounding misconception: 2 days to resolve vs class median 6",
      "Kinetic energy misconception: 5 days vs class median 4 (about average)",
      "Based on 2 resolved cases only — a pattern, not a rule",
    ],
    sharedWith: "Also visible to Mr Shah, for the same oversight applied to diagnoses.",
  },
};
