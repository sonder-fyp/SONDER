import type { Subject } from "./scenarios/types";
import type { MisconceptionStatus } from "@/components/shared";

export type CatalogueEntry = {
  /** Scenario-local hypothesis code (M1..M4) — unique within a subject here. */
  code: string;
  subject: Subject;
  name: string;
  description: string;
  status: MisconceptionStatus;
};

export const CATALOGUE: CatalogueEntry[] = [
  // Mathematics — rounding
  {
    code: "M4",
    subject: "mathematics",
    name: "Rounds using a digit one place too far right",
    description:
      "Decides whether to round up by looking at the digit two places past the rounding position instead of the one immediately to its right.",
    status: "validated",
  },
  {
    code: "M2",
    subject: "mathematics",
    name: "Truncates instead of rounding",
    description:
      "Drops the trailing digits and keeps what remains, never rounding the last kept digit up.",
    status: "validated",
  },
  {
    code: "M3",
    subject: "mathematics",
    name: "Always rounds up when the next digit is 5 or more but never down",
    description:
      "Treats any non-zero following digit as a signal to round up.",
    status: "validated",
  },
  {
    code: "M1",
    subject: "mathematics",
    name: "Rounds to the nearest 10 regardless of the instruction",
    description:
      "Ignores 'to one decimal place' or 'to the nearest whole' and rounds to a round number.",
    status: "pending",
  },
  // Physics — kinetic energy
  {
    code: "M1",
    subject: "physics",
    name: "Treats kinetic energy as linear in speed",
    description:
      "Uses ½·m·v rather than ½·m·v². Doubling the speed is expected to double the energy.",
    status: "validated",
  },
  {
    code: "M3",
    subject: "physics",
    name: "Drops the one-half factor",
    description: "Uses m·v² instead of ½·m·v², so every answer is twice too large.",
    status: "validated",
  },
  {
    code: "M2",
    subject: "physics",
    name: "Confuses kinetic energy with momentum",
    description:
      "Computes m·v and reports it as an energy, mixing the two quantities.",
    status: "validated",
  },
  // Chemistry — moles
  {
    code: "M2",
    subject: "chemistry",
    name: "Ignores the balancing coefficients",
    description:
      "Treats every mole ratio in a balanced equation as 1:1.",
    status: "validated",
  },
  {
    code: "M3",
    subject: "chemistry",
    name: "Inverts the mole ratio",
    description:
      "Uses the ratio the wrong way round, multiplying where it should divide.",
    status: "validated",
  },
  {
    code: "M1",
    subject: "chemistry",
    name: "Reads the mass in grams as a number of moles",
    description:
      "Skips dividing by the molar mass and uses the gram figure directly.",
    status: "validated",
  },
  {
    code: "M4",
    subject: "chemistry",
    name: "Uses the limiting reagent inconsistently",
    description:
      "Sometimes works from the reagent in excess rather than the limiting one.",
    status: "catalogued-only",
  },
];

export function catalogueForSubject(subject: Subject): CatalogueEntry[] {
  return CATALOGUE.filter((c) => c.subject === subject);
}

export function catalogueEntry(
  subject: Subject,
  code: string,
): CatalogueEntry | undefined {
  return CATALOGUE.find((c) => c.subject === subject && c.code === code);
}
