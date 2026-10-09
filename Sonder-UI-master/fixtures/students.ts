import type { ScenarioId, Subject } from "./scenarios/types";
import type { SessionStatus } from "@/components/shared";

export type Student = {
  id: string;
  name: string;
  className: string;
  subject: Subject;
  topicName: string;
  /** Present = there is a full replayable session behind this student. */
  scenarioId?: ScenarioId;
  /** The engine's status before any teacher action. */
  status: SessionStatus;
  lastActivity: string;
  note?: string;
};

export const STUDENTS: Student[] = [
  {
    id: "zara",
    name: "Zara Qureshi",
    className: "9-B",
    subject: "mathematics",
    topicName: "Rounding to decimal places",
    scenarioId: "B",
    status: "awaiting-review",
    lastActivity: "1 hour ago",
  },
  {
    id: "bilal",
    name: "Bilal Ahmed",
    className: "9-B",
    subject: "physics",
    topicName: "Kinetic energy and work",
    scenarioId: "A",
    status: "awaiting-review",
    lastActivity: "3 hours ago",
  },
  {
    id: "hina",
    name: "Hina Raza",
    className: "9-B",
    subject: "chemistry",
    topicName: "Moles and stoichiometry",
    scenarioId: "C",
    status: "escalated",
    lastActivity: "yesterday",
    note: "No question separates 'ignores coefficients' from 'inverts the ratio'.",
  },
  {
    id: "ali",
    name: "Ali Raza",
    className: "9-A",
    subject: "mathematics",
    topicName: "Rounding to decimal places",
    status: "escalated",
    lastActivity: "today",
    note: "Bank held only 2 questions targeting the 'reads one place too far right' error — not enough to confirm it.",
  },
  {
    id: "usman",
    name: "Usman Tariq",
    className: "9-B",
    subject: "chemistry",
    topicName: "Moles and stoichiometry",
    status: "escalated",
    lastActivity: "yesterday",
    note: "Same coefficient-ratio pattern as Hina Raza.",
  },
  {
    id: "sara",
    name: "Sara Iqbal",
    className: "9-A",
    subject: "chemistry",
    topicName: "Ionic and covalent bonding",
    status: "awaiting-review",
    lastActivity: "4 hours ago",
  },
  {
    id: "ayesha",
    name: "Ayesha Khan",
    className: "9-A",
    subject: "mathematics",
    topicName: "Adding and subtracting fractions",
    status: "awaiting-review",
    lastActivity: "2 days ago",
  },
  {
    id: "daniyal",
    name: "Daniyal Malik",
    className: "9-B",
    subject: "mathematics",
    topicName: "Rounding to decimal places",
    status: "diagnosed",
    lastActivity: "5 days ago",
    note: "Study note read. Verification check due next week.",
  },
  {
    id: "fatima",
    name: "Fatima Noor",
    className: "9-A",
    subject: "physics",
    topicName: "Forces and acceleration",
    status: "diagnosed",
    lastActivity: "1 week ago",
    note: "Resolved. Fresh-question check passed.",
  },
];

export function getStudent(id: string): Student | undefined {
  return STUDENTS.find((s) => s.id === id);
}

export function studentForScenario(scenarioId: ScenarioId): Student | undefined {
  return STUDENTS.find((s) => s.scenarioId === scenarioId);
}
