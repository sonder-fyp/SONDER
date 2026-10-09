import {
  FlaskConical,
  Sigma,
  Atom,
  type LucideIcon,
} from "lucide-react";
import type { ScenarioId, Subject as SubjectKey } from "./scenarios/types";

export type Topic = {
  id: string;
  name: string;
  blurb: string;
  /** The scripted scenario a topic diagnostic plays. Absent = not wired yet. */
  scenario?: ScenarioId;
};

export type Subject = {
  key: SubjectKey;
  name: string;
  icon: LucideIcon;
  /** Scenario the broad "whole subject" diagnostic plays. */
  generalScenario: ScenarioId;
  topics: Topic[];
};

export const SUBJECTS: Subject[] = [
  {
    key: "mathematics",
    name: "Mathematics",
    icon: Sigma,
    generalScenario: "B",
    topics: [
      {
        id: "rounding",
        name: "Rounding to decimal places",
        blurb: "Decimal places, significant figures, which digit decides.",
        scenario: "B",
      },
      {
        id: "fractions",
        name: "Adding and subtracting fractions",
        blurb: "Common denominators, mixed numbers.",
      },
      {
        id: "negatives",
        name: "Negative numbers",
        blurb: "Subtracting a negative, sign rules in multiplication.",
      },
      {
        id: "indices",
        name: "Laws of indices",
        blurb: "Multiplying, dividing and raising powers.",
      },
    ],
  },
  {
    key: "physics",
    name: "Physics",
    icon: Atom,
    generalScenario: "A",
    topics: [
      {
        id: "energy",
        name: "Kinetic energy and work",
        blurb: "½mv², work done, energy transferred.",
        scenario: "A",
      },
      {
        id: "forces",
        name: "Forces and acceleration",
        blurb: "F = ma, resultant force, free-body diagrams.",
      },
      {
        id: "waves",
        name: "Wave speed",
        blurb: "v = fλ, period and frequency.",
      },
    ],
  },
  {
    key: "chemistry",
    name: "Chemistry",
    icon: FlaskConical,
    generalScenario: "C",
    topics: [
      {
        id: "moles",
        name: "Moles and stoichiometry",
        blurb: "Mass to moles, mole ratios from balanced equations.",
        scenario: "C",
      },
      {
        id: "bonding",
        name: "Ionic and covalent bonding",
        blurb: "Electron transfer vs sharing, dot-and-cross.",
      },
      {
        id: "acids",
        name: "Acids, bases and salts",
        blurb: "Neutralisation, pH, naming salts.",
      },
    ],
  },
];

export function getSubject(key: string): Subject | undefined {
  return SUBJECTS.find((s) => s.key === key);
}
