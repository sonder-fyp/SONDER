"use client";

/**
 * Classes the teacher created, and which students joined which class by
 * code. Purely additive on top of the two fixture classes and their fixture
 * rosters (see fixtures/classes.ts) — this store never duplicates fixture
 * data, only layers deltas on top of it. Same shape as the review-decision
 * store: module cache + useSyncExternalStore, no provider, no
 * setState-in-effect.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { CLASSES, getClassByName, studentsInClass, type ClassRoom } from "@/fixtures/classes";
import { getStudent, type Student } from "@/fixtures/students";
import { ROLES } from "@/lib/roles";

const KEY = "sonder.classes.enrollment";

type Store = {
  createdClasses: ClassRoom[];
  enrollments: Record<string, string[]>;
};

const EMPTY: Store = { createdClasses: [], enrollments: {} };
let cache: Store | null = null;

function coerce(value: unknown): Store {
  if (!value || typeof value !== "object") return { createdClasses: [], enrollments: {} };
  const v = value as Record<string, unknown>;
  return {
    createdClasses: Array.isArray(v.createdClasses) ? (v.createdClasses as ClassRoom[]) : [],
    enrollments:
      v.enrollments && typeof v.enrollments === "object" && !Array.isArray(v.enrollments)
        ? (v.enrollments as Record<string, string[]>)
        : {},
  };
}

function read(): Store {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    cache = coerce(JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    cache = { createdClasses: [], enrollments: {} };
  }
  return cache;
}

const listeners = new Set<() => void>();

function write(next: Store) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** I, L, O, 0 and 1 are deliberately excluded — ambiguous read aloud or copied by hand. */
const JOIN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += JOIN_ALPHABET[Math.floor(Math.random() * JOIN_ALPHABET.length)];
  }
  return `SNDR-${code}`;
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "class";
}

export function useEnrollment() {
  const store = useSyncExternalStore(subscribe, read, () => EMPTY);
  const { createdClasses, enrollments } = store;

  const allClasses = useMemo<ClassRoom[]>(
    () => [...CLASSES, ...createdClasses],
    [createdClasses],
  );

  const classById = useCallback(
    (id: string) => allClasses.find((c) => c.id === id),
    [allClasses],
  );

  const rosterFor = useCallback(
    (room: ClassRoom): Student[] => {
      const map = new Map<string, Student>();
      studentsInClass(room.name).forEach((s) => map.set(s.id, s));
      (enrollments[room.id] ?? []).forEach((studentId) => {
        if (map.has(studentId)) return;
        const student = getStudent(studentId);
        if (student) map.set(studentId, student);
      });
      return Array.from(map.values());
    },
    [enrollments],
  );

  const classesForStudent = useCallback(
    (studentId: string): ClassRoom[] => {
      const result: ClassRoom[] = [];
      const seen = new Set<string>();

      const student = getStudent(studentId);
      const home = student ? getClassByName(student.className) : undefined;
      if (home) {
        result.push(home);
        seen.add(home.id);
      }

      Object.entries(enrollments).forEach(([classId, studentIds]) => {
        if (seen.has(classId) || !studentIds.includes(studentId)) return;
        const room = classById(classId);
        if (!room) return;
        result.push(room);
        seen.add(classId);
      });

      return result;
    },
    [enrollments, classById],
  );

  const createClass = useCallback((name: string, note?: string): ClassRoom | null => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    const current = read();
    const takenIds = new Set([...CLASSES, ...current.createdClasses].map((c) => c.id));
    const base = `new-${slugify(trimmedName)}`;
    let id = base;
    let n = 2;
    while (takenIds.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }

    const room: ClassRoom = {
      id,
      name: trimmedName,
      teacherName: ROLES.teacher.person,
      note: note?.trim() || "A class you created in this build.",
      joinCode: generateJoinCode(),
    };

    write({ ...current, createdClasses: [...current.createdClasses, room] });
    return room;
  }, []);

  const joinByCode = useCallback((code: string, studentId: string): ClassRoom | null => {
    const entered = code.trim().toUpperCase();
    if (!entered) return null;

    const current = read();
    const room = [...CLASSES, ...current.createdClasses].find(
      (c) => c.joinCode.toUpperCase() === entered,
    );
    if (!room) return null;

    const existing = current.enrollments[room.id] ?? [];
    if (existing.includes(studentId)) return room;

    write({
      ...current,
      enrollments: { ...current.enrollments, [room.id]: [...existing, studentId] },
    });
    return room;
  }, []);

  return {
    createdClasses,
    enrollments,
    allClasses,
    classById,
    rosterFor,
    classesForStudent,
    createClass,
    joinByCode,
  };
}
