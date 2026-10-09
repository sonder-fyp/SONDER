import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  THEME_STORAGE_KEY,
  THEME_ATTRIBUTE,
  __resetThemeStoreForTests,
} from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    __resetThemeStoreForTests();
  });

  afterEach(cleanup);

  it("offers light while dark, and flips on click", () => {
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: "Switch to light theme" });
    expect(button.getAttribute("data-theme-state")).toBe("dark");

    fireEvent.click(button);

    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeTruthy();
  });

  it("reads the stored preference on mount", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    __resetThemeStoreForTests();
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeTruthy();
    // The useLayoutEffect re-apply covers React's dev-only Strict Mode remount.
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe("light");
  });

  it("gives the mask a unique, fragment-safe id", () => {
    const { container } = render(<ThemeToggle />);
    const mask = container.querySelector("mask");
    expect(mask?.id).toMatch(/^tk-[A-Za-z0-9_-]+$/);
    expect(container.querySelector(".tk-disc")?.getAttribute("mask")).toBe(
      `url(#${mask?.id})`,
    );
  });
});
