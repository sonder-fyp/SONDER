import { STUDENTS, type Student } from "./students";

/**
 * A class's roster is derived, never stored: fixture membership is exactly
 * "every student whose className equals this class's name" (studentsInClass).
 * There is deliberately no studentIds field here — joined-by-code membership
 * is layered on top at the store level only (see lib/enrollment.tsx).
 */
export type ClassRoom = {
  id: string;
  name: string;
  teacherName: string;
  note: string;
  joinCode: string;
};

export const CLASSES: ClassRoom[] = [
  {
    id: "9-b",
    name: "9-B",
    teacherName: "Imran Shah",
    note: "The Physics and Chemistry set. Two moles-and-stoichiometry cases escalated this week.",
    joinCode: "SNDR-9B24",
  },
  {
    id: "9-a",
    name: "9-A",
    teacherName: "Imran Shah",
    note: "A mixed set, mostly rounding and bonding work. One case currently with the engine.",
    joinCode: "SNDR-9A17",
  },
];

export function getClass(id: string): ClassRoom | undefined {
  return CLASSES.find((c) => c.id === id);
}

export function getClassByName(name: string): ClassRoom | undefined {
  return CLASSES.find((c) => c.name === name);
}

export function studentsInClass(className: string): Student[] {
  return STUDENTS.filter((s) => s.className === className);
}
