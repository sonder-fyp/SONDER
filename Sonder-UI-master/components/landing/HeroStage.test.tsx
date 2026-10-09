import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createElement } from "react";
import {
  HERO_HEADLINE,
  HERO_HEADLINE_ACCENT,
  HERO_HEADLINE_LEAD,
  HERO_KICKER,
} from "@/lib/landing/hero/copy";

vi.mock("./styles/hero-stage.css", () => ({}));

vi.mock("./BrainViewer", () => ({
  BrainViewer: () => createElement("div", { "data-testid": "brain-viewer" }),
}));

vi.mock("./SonderWordmark", () => ({
  default: () => createElement("div", { "data-testid": "wordmark" }),
}));

vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    set: vi.fn(),
    context: () => ({ revert: vi.fn() }),
    timeline: () => ({
      to() {
        return this;
      },
      fromTo() {
        return this;
      },
    }),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

import HeroStage from "./HeroStage";

describe("HeroStage statement", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders one h1 with the two-line statement", () => {
    render(createElement(HeroStage));
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent?.replace(/\s+/g, " ").trim()).toBe(HERO_HEADLINE);
    expect(screen.getByText(HERO_HEADLINE_LEAD)).toBeTruthy();
    expect(screen.getByText(HERO_HEADLINE_ACCENT)).toBeTruthy();
  });

  it("keeps the kicker as supporting label, not a second title", () => {
    render(createElement(HeroStage));
    expect(screen.getByText(HERO_KICKER)).toBeTruthy();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("does not render the overflowing previous headline", () => {
    render(createElement(HeroStage));
    expect(screen.queryByText(/does not mark the answer/i)).toBeNull();
    expect(screen.queryByText(/idea underneath/i)).toBeNull();
  });

  it("anchors the statement in the bottom lead, not a full-height stack", () => {
    const { container } = render(createElement(HeroStage));
    const lead = container.querySelector(".hero-lead");
    expect(lead).toBeTruthy();
    expect(lead?.className).toContain("bottom-0");
    const titleBox = lead?.querySelector("h1")?.parentElement;
    expect(titleBox?.className).not.toMatch(/max-w-\[15ch\]/);
  });
});
