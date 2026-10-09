"use client";

/**
 * Where teacher decisions live so they survive navigation (T3 writes, T1 reads
 * updated counts). Module store + useSyncExternalStore, same shape as the
 * session store — no provider, no setState-in-effect.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { SessionStatus } from "@/components/shared";
import type { Student } from "@/fixtures/students";

export type ReviewDecision =
  | "approved"
  | "corrected"
  | "rejected"
  | "resolved";

const KEY = "sonder.teacher.reviews";
type Store = Record<string, ReviewDecision>;

const EMPTY: Store = {};
let cache: Store | null = null;

function read(): Store {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    cache = {};
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

export function useTeacherReviews() {
  const decisions = useSyncExternalStore(subscribe, read, () => EMPTY);

  const decide = useCallback((sessionId: string, decision: ReviewDecision) => {
    write({ ...read(), [sessionId]: decision });
  }, []);

  const clearAll = useCallback(() => write({}), []);

  return { decisions, decide, clearAll };
}

export const DECISION_LABEL: Record<ReviewDecision, string> = {
  approved: "Approved",
  corrected: "Corrected",
  rejected: "Rejected",
  resolved: "Resolved manually",
};

/**
 * The student's status once any recorded teacher decision is applied. Shared
 * so the dashboard, the class list, and the class detail views can never
 * silently drift apart on what a decision means.
 */
export function effectiveStatus(
  student: Student,
  decisions: Record<string, ReviewDecision>,
): SessionStatus {
  const d = student.scenarioId ? decisions[student.scenarioId] : undefined;
  if (d === "approved" || d === "corrected" || d === "resolved") return "diagnosed";
  if (d === "rejected") return "awaiting-review";
  return student.status;
}
