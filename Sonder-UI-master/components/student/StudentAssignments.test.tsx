import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { studentDashboard: vi.fn() },
}));
import { classesClient, ClassesError } from "@/lib/classes/client";
import { parseCard } from "@/lib/student/dashboard";
import { StudentAssignments } from "./StudentAssignments";

const sid = "77777777-7777-4777-8777-777777777777";
const card = (n: number, extra: Record<string, unknown> = {}) => parseCard({
  assignment_id: `55555555-5555-4555-8555-55555555555${n}`, class_id: "11111111-1111-4111-8111-111111111111", class_name: "Grade 8",
  title: `Check ${n}`, unit_code: "U1", unit_name: "Rounding", attempt_rule: "single", created_at: "2026-11-18T09:00:00Z",
  latest_session_id: null, latest_state: null, answered: 0, question_budget: null, attempts: 0, ...extra,
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("student assignments", () => {
  it("offers exactly one action per assignment: Start, Resume or Done", async () => {
    vi.mocked(classesClient.studentDashboard).mockResolvedValue([
      card(1),
      card(2, { latest_state: "in_progress", latest_session_id: sid, answered: 3, question_budget: 8, attempts: 1 }),
      card(3, { latest_state: "submitted", latest_session_id: sid, answered: 4, question_budget: 8, attempts: 1 }),
      card(4, { attempt_rule: "repeat", latest_state: "submitted", latest_session_id: sid, answered: 4, question_budget: 8, attempts: 2 }),
    ]);
    render(<StudentAssignments />);
    expect((await screen.findByRole("link", { name: "Start: Check 1" })).getAttribute("href"))
      .toBe("/student/diagnostic/U1?assignment=55555555-5555-4555-8555-555555555551");
    expect(screen.getByRole("link", { name: "Resume: Check 2" }).getAttribute("href"))
      .toBe(`/student/diagnostic/U1?session=${sid}&assignment=55555555-5555-4555-8555-555555555552`);
    expect(screen.getByText("Rounding · One attempt · In progress · 3 answered")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Check 3/ })).toBeNull();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start again: Check 4" })).toBeTruthy();
    expect(screen.getByText(/Submitted · attempt 2/)).toBeTruthy();
  });

  it("shows nothing about results", async () => {
    vi.mocked(classesClient.studentDashboard).mockResolvedValue([card(1, { latest_state: "submitted", latest_session_id: sid, attempts: 1 })]);
    const view = render(<StudentAssignments />);
    await screen.findByText("Check 1");
    expect(view.container.textContent).not.toMatch(/diagnos|misconception|%|confidence|review/i);
  });

  it("points to joining a class when nothing is assigned, and retries failures", async () => {
    vi.mocked(classesClient.studentDashboard).mockResolvedValueOnce([]);
    const view = render(<StudentAssignments />);
    expect((await screen.findByRole("link", { name: "join your class" })).getAttribute("href")).toBe("/student/classes");
    view.unmount();
    vi.mocked(classesClient.studentDashboard).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([card(1)]);
    render(<StudentAssignments />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Check 1")).toBeTruthy();
  });

  it("asks to sign in again when the session ended", async () => {
    vi.mocked(classesClient.studentDashboard).mockRejectedValue(new ClassesError("authentication_required"));
    render(<StudentAssignments />);
    expect((await screen.findByRole("link", { name: "Log in" })).getAttribute("href")).toBe("/auth/sign-in?next=%2Fstudent");
  });
});
