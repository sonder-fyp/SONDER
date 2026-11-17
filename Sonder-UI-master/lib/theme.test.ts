import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setTheme,
  toggleTheme,
  applyTheme,
  THEME_STORAGE_KEY,
  THEME_ATTRIBUTE,
  DEFAULT_THEME,
  __resetThemeStoreForTests,
} from "./theme";

describe("theme store", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    __resetThemeStoreForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to dark, ignoring the OS preference", () => {
    expect(DEFAULT_THEME).toBe("dark");
  });

  it("writes the attribute and the stored value", () => {
    setTheme("light");
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("toggles from the stored value, not from the attribute", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    __resetThemeStoreForTests();
    toggleTheme();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("treats an unrecognised stored value as the default", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    __resetThemeStoreForTests();
    toggleTheme();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("still applies the theme when startViewTransition is unavailable", () => {
    // jsdom has no View Transition API, which is exactly the fallback path.
    expect(
      (document as Document & { startViewTransition?: unknown })
        .startViewTransition,
    ).toBeUndefined();
    setTheme("light");
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("light");
  });

  it("survives a localStorage that throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => setTheme("light")).not.toThrow();
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("light");
  });

  it("applyTheme is the only thing that touches the DOM", () => {
    applyTheme("light");
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("light");
    applyTheme("dark");
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("dark");
  });

  it("handles rejected ready/updateCallbackDone and releases the switching guard", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: Event) => unhandled.push(e);
    process.on("unhandledRejection", onUnhandled);
    const doc = document as unknown as { startViewTransition?: unknown };
    const abort = () => Promise.reject(new Error("Transition was aborted"));
    let finishedReject: (e: unknown) => void = () => {};
    const make = () => ({
      ready: abort(),
      updateCallbackDone: abort(),
      finished: new Promise((_, rej) => {
        finishedReject = rej;
      }),
    });
    const start = vi.fn((cb: () => void) => {
      cb();
      return make();
    });
    doc.startViewTransition = start;
    try {
      setTheme("light");
      expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("light");
      expect(document.documentElement.hasAttribute("data-theme-switch")).toBe(true);
      finishedReject(new Error("aborted"));
      await new Promise((r) => setTimeout(r, 10));
      expect(document.documentElement.hasAttribute("data-theme-switch")).toBe(false);
      // guard released: a second switch uses the transition again
      setTheme("dark");
      expect(start).toHaveBeenCalledTimes(2);
      finishedReject(new Error("aborted"));
      await new Promise((r) => setTimeout(r, 10));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      delete doc.startViewTransition;
    }
  });
});
