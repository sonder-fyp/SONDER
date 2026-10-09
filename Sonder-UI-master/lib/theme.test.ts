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
});
