import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AppAccount } from "@/lib/auth/types";
import { WorkspaceHome } from "./WorkspaceHome";
import { WorkspaceState } from "./WorkspaceState";
const base: AppAccount = {
  id: "example",
  email: "student@sonder.invalid",
  display_name: "Example Learner",
  role: "student",
  status: "active",
  onboarding_complete: true,
  role_request_status: null,
  requested_role: null,
};
afterEach(cleanup);
describe("account workspace homes", () => {
  it("welcomes the actual student, with no topic picker and no self-start link", () => {
    render(<WorkspaceHome account={base} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Example",
    );
    expect(screen.queryByRole("link", { name: "Explore diagnostics" })).toBeNull();
    expect(screen.queryByText("Start with a topic.")).toBeNull();
    const links = screen.queryAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).not.toContain("/student/start");
    expect(screen.getByText("Before you begin")).toBeTruthy();
    expect(screen.queryByText("Follow-up check due")).toBeNull();
  });
  it("renders children for students and teachers", () => {
    for (const role of ["student", "teacher"] as const) {
      const view = render(<WorkspaceHome account={{ ...base, role }}><p>Child content</p></WorkspaceHome>);
      expect(screen.getByText("Child content")).toBeTruthy();
      view.unmount();
    }
    render(<WorkspaceHome account={{ ...base, role: "teacher" }} />);
    expect(screen.getByRole("link", { name: "Manage classes" }).getAttribute("href")).toBe("/teacher/classes");
  });
  it("does not populate teaching and family workspaces with example records", () => {
    for (const role of ["teacher", "parent"] as const) {
      const view = render(<WorkspaceHome account={{ ...base, role }} />);
      const links = screen.queryAllByRole("link").map((link) => link.getAttribute("href"));
      expect(links).toEqual(role === "teacher" ? ["/teacher/classes"] : []);
      if (role === "parent") expect(view.container.textContent).toContain("not available yet");
      else expect(view.container.textContent).not.toContain("not available yet");
      expect(view.container.textContent).not.toMatch(/Zara|Imran|9-B|Resolved/);
      view.unmount();
    }
  });
  it("offers the real access tool to administrators", () => {
    render(<WorkspaceHome account={{ ...base, role: "admin" }} />);
    expect(
      screen
        .getByRole("link", { name: "Review access requests" })
        .getAttribute("href"),
    ).toBe("/admin/access");
  });
  it("provides recovery from unavailable features without simulated mutations", () => {
    render(
      <WorkspaceState
        label="Class"
        title="My classes"
        description="Your classwork"
        detail="Joining a class is not available yet."
        home="/student"
        action="Go to your assignments"
        actionHref="/student"
      />,
    );
    expect(
      screen
        .getByRole("link", { name: "Back to overview" })
        .getAttribute("href"),
    ).toBe("/student");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
