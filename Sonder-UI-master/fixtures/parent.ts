import type { ScenarioId } from "./scenarios/types";

/**
 * What a parent can see: teacher-approved, plain-language summaries only — no
 * probabilities, no raw evidence, nothing before a teacher has signed it off
 * (Feature 11).
 */

export type ParentSummary = {
  id: string;
  childName: string;
  subject: string;
  topicName: string;
  date: string;
  /** Historical, already-approved summaries are always visible. */
  approvedByDefault?: boolean;
  approvedBy?: string;
  approvedOn?: string;
  /** If set, visibility is gated on this scenario being approved in the review store. */
  gatedOnScenario?: ScenarioId;
  whatWeFound: string;
  whatToWorkOn: string;
  howItsGoing: string;
};

export const PARENT = {
  guardian: "Nadia Qureshi",
  children: ["Zara Qureshi"],
};

export const PARENT_SUMMARIES: ParentSummary[] = [
  {
    id: "zara-rounding-sep",
    childName: "Zara Qureshi",
    subject: "Mathematics",
    topicName: "Rounding to decimal places",
    date: "1 Sep 2026",
    gatedOnScenario: "B",
    whatWeFound:
      "When Zara rounds a number, she has been checking a digit that is one place too far along before deciding whether to round up.",
    whatToWorkOn:
      "Finding the place to round to, then looking only at the single digit immediately to its right.",
    howItsGoing:
      "A short study note and a video have been shared with her. A follow-up check is scheduled for a few weeks' time.",
  },
  {
    id: "zara-rounding-aug",
    childName: "Zara Qureshi",
    subject: "Mathematics",
    topicName: "Rounding to decimal places",
    date: "24 Aug 2026",
    approvedByDefault: true,
    approvedBy: "Mr Shah",
    approvedOn: "26 Aug 2026",
    whatWeFound:
      "Zara was rounding by looking at the wrong digit in a similar way to the more recent session.",
    whatToWorkOn: "Which digit decides whether to round up.",
    howItsGoing:
      "Resolved. She answered a fresh question correctly two weeks later, so the fix held.",
  },
  {
    id: "zara-energy-aug",
    childName: "Zara Qureshi",
    subject: "Physics",
    topicName: "Kinetic energy and work",
    date: "3 Aug 2026",
    approvedByDefault: true,
    approvedBy: "Mr Shah",
    approvedOn: "5 Aug 2026",
    whatWeFound:
      "Zara was working out kinetic energy as if it grew straight in line with speed, rather than with speed multiplied by itself.",
    whatToWorkOn:
      "Remembering that doubling the speed makes the energy four times bigger, not twice.",
    howItsGoing: "Resolved. A fresh-question check a few weeks later was correct.",
  },
];

export function getParentSummary(id: string): ParentSummary | undefined {
  return PARENT_SUMMARIES.find((s) => s.id === id);
}
