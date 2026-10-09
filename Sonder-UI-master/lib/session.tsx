"use client";

/**
 * Fake auth. There is no real login in this PoC — a "session" is just which of
 * the four roles you picked on the landing screen, kept in localStorage so a
 * refresh doesn't drop you back to the picker.
 *
 * Role is read through useSyncExternalStore so SSR sees "signed out", the client
 * sees the stored value after hydration, and there is no effect calling setState.
 */

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

export type Role = "student" | "teacher" | "parent" | "admin";

const STORAGE_KEY = "sonder.role";

function isRole(v: unknown): v is Role {
  return v === "student" || v === "teacher" || v === "parent" || v === "admin";
}

function readStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isRole(saved) ? saved : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribeRole(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== "undefined") window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", cb);
  };
}
const noopSubscribe = () => () => {};

type SessionValue = {
  role: Role | null;
  /** false while the client is still hydrating; true once mounted. */
  ready: boolean;
  signIn: (role: Role) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const role = useSyncExternalStore(subscribeRole, readStoredRole, () => null);
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const signIn = useCallback((next: Role) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    emit();
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    emit();
  }, []);

  return (
    <SessionContext.Provider value={{ role, ready, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
