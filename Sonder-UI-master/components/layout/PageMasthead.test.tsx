import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PageMasthead } from "./PageMasthead";

afterEach(() => {
  cleanup();
});

describe("PageMasthead", () => {
  it("keeps the poster opening by default", () => {
    const { container } = render(
      <PageMasthead
        label="My insights"
        title="How quickly things get fixed."
        lede="This is not a grade."
      />,
    );

    const header = container.querySelector("header") as HTMLElement;
    expect(header.className).toContain("pt-12");
    expect(screen.getByRole("heading", { level: 1 }).className).toContain("text-4xl");
    expect(container.querySelector("[aria-hidden].bg-accent")).toBeTruthy();
    expect(container.querySelector("[data-slot=section-rule]")).toBeTruthy();
    expect(
      container.querySelector("[data-slot=section-rule]")?.parentElement?.className,
    ).toContain("mt-10");
    expect(container.querySelector("hr")).toBeNull();
  });

  it("drops poster chrome in compact density", () => {
    const { container } = render(
      <PageMasthead
        density="compact"
        label="Ask the consultant"
        title="AI Consultant"
        lede="Scripted suggestions, not decisions."
      />,
    );

    const header = container.querySelector("header") as HTMLElement;
    const heading = screen.getByRole("heading", { level: 1 });
    expect(header.className).toContain("py-6");
    expect(header.className).not.toContain("pt-12");
    expect(heading.className).toContain("text-xl");
    expect(heading.className).not.toContain("text-4xl");
    expect(heading.className).not.toContain("lg:text-6xl");
    expect(container.querySelector("[aria-hidden].h-0\\.5")).toBeNull();
    expect(container.querySelector("[data-slot=section-rule]")).toBeNull();
    expect(container.querySelector("hr")).toBeNull();
    expect(screen.getByText("Scripted suggestions, not decisions.")).toBeTruthy();
  });
});
