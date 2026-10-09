"use client";

/**
 * The theme store.
 *
 * One attribute — `data-theme` on <html> — is the single source of truth for the
 * rendered palette. globals.css defines the dark palette on :root and the light
 * palette on :root[data-theme="light"], and `@theme inline` means every Tailwind
 * colour utility emits `var(--token)` rather than a baked hex. Flipping the
 * attribute therefore repaints the entire product without re-rendering a single
 * component.
 *
 * The value is mirrored into localStorage and re-applied by the inline script in
 * app/layout.tsx before first paint, so a hard load never flashes.
 *
 * Read through useSyncExternalStore, exactly like lib/session.tsx: SSR sees the
 * default, the client sees the stored value after hydration, and no effect ever
 * calls setState.
 */

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "sonder.theme";
export const THEME_ATTRIBUTE = "data-theme";
/** Set on <html> for the duration of a switch. Scopes every wipe rule in
 *  globals.css so route transitions are never caught by them. */
export const THEME_SWITCH_ATTRIBUTE = "data-theme-switch";

/**
 * Dark is the brand, so a visitor with no stored preference gets dark whatever
 * their OS says. To respect the OS instead you must change BOTH this constant
 * and the inline script string in app/layout.tsx — if the two disagree, every
 * page load flashes.
 */
export const DEFAULT_THEME: Theme = "dark";

function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light";
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Module-level cache, so the client snapshot is referentially stable and
 *  useSyncExternalStore does not loop. */
let current: Theme | null = null;

function snapshot(): Theme {
  if (current === null) current = readStoredTheme();
  return current;
}

function serverSnapshot(): Theme {
  return DEFAULT_THEME;
}

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** The only thing that actually changes the paint. Everything else is bookkeeping. */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    current = isTheme(e.newValue) ? e.newValue : DEFAULT_THEME;
    applyTheme(current);
    emit();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Viewport coordinates the circular wipe expands from. */
export type WipeOrigin = { x: number; y: number };

type ViewTransition = { finished: Promise<unknown> };
type DocumentWithVT = Document & {
  startViewTransition?: (cb: () => void) => ViewTransition;
};

/**
 * Writes the wipe geometry onto <html> as custom properties. The
 * ::view-transition pseudo-element tree inherits custom properties from the
 * document element, which is what lets a keyframe read them.
 *
 * The radius is the distance to the FARTHEST viewport corner: the point at which
 * the expanding circle has covered every pixel.
 */
function writeWipeVars(origin: WipeOrigin | null) {
  const root = document.documentElement;
  const x = origin ? origin.x : window.innerWidth / 2;
  const y = origin ? origin.y : window.innerHeight / 2;
  const r = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  root.style.setProperty("--theme-x", `${x}px`);
  root.style.setProperty("--theme-y", `${y}px`);
  root.style.setProperty("--theme-r", `${r}px`);
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Guards against a second switch starting while one is mid-flight. */
let switching = false;

export function setTheme(next: Theme, origin?: WipeOrigin) {
  current = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }

  const commit = () => {
    applyTheme(next);
    emit();
  };

  const doc = typeof document !== "undefined" ? (document as DocumentWithVT) : null;

  if (!doc || !doc.startViewTransition || switching || prefersReducedMotion()) {
    commit();
    return;
  }

  switching = true;
  writeWipeVars(origin ?? null);
  // MUST be set before startViewTransition: the old snapshot is captured
  // synchronously inside that call, and this attribute is what strips the
  // `topbar` / `worknav` view-transition-names so the frozen chrome groups do
  // not tear a hole in the wipe.
  doc.documentElement.setAttribute(THEME_SWITCH_ATTRIBUTE, "1");

  const transition = doc.startViewTransition(commit);
  const done = () => {
    switching = false;
    doc.documentElement.removeAttribute(THEME_SWITCH_ATTRIBUTE);
  };
  transition.finished.then(done, done);
}

export function toggleTheme(origin?: WipeOrigin) {
  setTheme(snapshot() === "dark" ? "light" : "dark", origin);
}

export function useTheme(): {
  theme: Theme;
  setTheme: (next: Theme, origin?: WipeOrigin) => void;
  toggle: (origin?: WipeOrigin) => void;
} {
  const theme = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const set = useCallback(
    (next: Theme, origin?: WipeOrigin) => setTheme(next, origin),
    [],
  );
  const toggle = useCallback((origin?: WipeOrigin) => toggleTheme(origin), []);
  return { theme, setTheme: set, toggle };
}

/** Test-only: drop the module cache so each test starts from localStorage. */
export function __resetThemeStoreForTests() {
  current = null;
  switching = false;
  listeners.clear();
}
