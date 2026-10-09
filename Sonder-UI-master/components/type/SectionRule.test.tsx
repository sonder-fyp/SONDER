import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SectionRule } from "./SectionRule";

afterEach(() => {
  cleanup();
});

describe("SectionRule", () => {
  it("is a decorative hairline with a 64px accent tick on the left", () => {
    render(<SectionRule />);

    const rule = document.querySelector("[data-slot=section-rule]") as HTMLElement;
    expect(rule.getAttribute("aria-hidden")).toBe("true");
    expect(rule.className).toContain("h-px");
    expect(rule.className).toContain("bg-border");
    expect(rule.className).not.toContain("bg-accent");

    const tick = rule.firstElementChild as HTMLElement;
    expect(tick.className).toContain("h-0.5");
    expect(tick.className).toContain("w-16");
    expect(tick.className).toContain("bg-accent");
  });
});
