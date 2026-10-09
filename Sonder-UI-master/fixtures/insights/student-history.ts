/**
 * Per-student history for the teacher's T7 view: pace on resolved misconceptions
 * plus the full misconception timeline. Same numbers a student sees on S8 — the
 * point of Feature 8 is that the teacher gets the same oversight.
 */

export type MisconceptionEvent = {
  code: string;
  name: string;
  subject: string;
  diagnosedOn: string;
  status: "resolved" | "monitoring" | "awaiting-review";
  resolvedOn?: string;
  verification?: "passed" | "pending" | "failed";
};

export type StudentHistory = {
  studentId: string;
  paceNote: {
    text: string;
    evidence: string[];
  };
  timeline: MisconceptionEvent[];
};

export const STUDENT_HISTORY: Record<string, StudentHistory> = {
  zara: {
    studentId: "zara",
    paceNote: {
      text: "Zara resolves procedural fixes quickly — the rounding misconception closed in 2 days against a class median of 6. She was about average (5 days vs 4) on the kinetic-energy fix, which was more conceptual. Pattern from 2 cases only.",
      evidence: [
        "Rounding: flagged 24 Aug 2026, verified 26 Aug 2026 (2 days)",
        "Kinetic energy: flagged 3 Aug 2026, verified 8 Aug 2026 (5 days)",
        "Class median for a procedural fix: 6 days",
      ],
    },
    timeline: [
      {
        code: "M4",
        name: "Rounds using a digit one place too far right",
        subject: "Mathematics",
        diagnosedOn: "1 Sep 2026",
        status: "awaiting-review",
      },
      {
        code: "M4",
        name: "Rounds using a digit one place too far right",
        subject: "Mathematics",
        diagnosedOn: "24 Aug 2026",
        status: "resolved",
        resolvedOn: "26 Aug 2026",
        verification: "passed",
      },
      {
        code: "M1",
        name: "Treats kinetic energy as linear in speed",
        subject: "Physics",
        diagnosedOn: "3 Aug 2026",
        status: "resolved",
        resolvedOn: "8 Aug 2026",
        verification: "passed",
      },
    ],
  },
  bilal: {
    studentId: "bilal",
    paceNote: {
      text: "Not enough resolved cases to read a pace pattern yet — one diagnosis on record and it hasn't been through remediation.",
      evidence: ["Kinetic energy: flagged 2 Sep 2026, awaiting your review"],
    },
    timeline: [
      {
        code: "M1",
        name: "Treats kinetic energy as linear in speed",
        subject: "Physics",
        diagnosedOn: "2 Sep 2026",
        status: "awaiting-review",
      },
    ],
  },
};
