"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A boolean kept in localStorage, read through useSyncExternalStore so it is
 * SSR-safe and needs no effect. The server snapshot is always the default.
 * All mutation lives in module functions, not in hook closures.
 */

type Entry = { value: boolean; fallback: boolean; listeners: Set<() => void> };
const entries = new Map<string, Entry>();

function ensure(key: string, fallback: boolean): Entry {
  let e = entries.get(key);
  if (!e) {
    let value = fallback;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(key);
        if (raw === "1") value = true;
        else if (raw === "0") value = false;
      } catch {
        /* ignore */
      }
    }
    e = { value, fallback, listeners: new Set() };
    entries.set(key, e);
  }
  return e;
}

function notify(e: Entry) {
  e.listeners.forEach((l) => l());
}

function setFlag(key: string, next: boolean) {
  const e = entries.get(key);
  if (!e) return;
  e.value = next;
  try {
    localStorage.setItem(key, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  notify(e);
}

function syncFromStorage(key: string, raw: string | null) {
  const e = entries.get(key);
  if (!e) return;
  e.value = raw === "1";
  notify(e);
}

export function useLocalFlag(
  key: string,
  fallback = false,
): [boolean, (next: boolean) => void] {
  ensure(key, fallback);

  const subscribe = useCallback(
    (cb: () => void) => {
      const e = ensure(key, fallback);
      e.listeners.add(cb);
      const onStorage = (ev: StorageEvent) => {
        if (ev.key === key) syncFromStorage(key, ev.newValue);
      };
      window.addEventListener("storage", onStorage);
      return () => {
        e.listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key, fallback],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => entries.get(key)?.value ?? fallback,
    () => fallback,
  );

  const set = useCallback((next: boolean) => setFlag(key, next), [key]);

  return [value, set];
}
