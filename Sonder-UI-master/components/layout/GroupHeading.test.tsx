import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GroupHeading } from "./GroupHeading";

afterEach(() => {
  cleanup();
});

describe("GroupHeading", () => {
  it("marks the cluster with a SectionRule and keeps the title in white", () => {
    const { container } = render(<GroupHeading count={4}>Where to go next</GroupHeading>);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("Where to go next");
    expect(heading.querySelector("span")?.className).not.toContain("text-accent");
    expect(container.querySelector("[data-slot=section-rule]")).toBeTruthy();
    expect(container.firstElementChild?.className).not.toContain("border-b");
  });
});
