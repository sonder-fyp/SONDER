import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { studentHistory: vi.fn() },
}));
import { classesClient, ClassesError } from "@/lib/classes/client";
import { parseHistoryEntry } from "@/lib/student/history";
import { StudentHistory } from "./StudentHistory";

const aid = "55555555-5555-4555-8555-555555555555";
const entry = (n: number, extra: Record<string, unknown> = {}) => parseHistoryEntry({
  session_id: `77777777-7777-4777-8777-77777777777${n}`, unit_code: "U1", unit_name: "Rounding", class_name: "Grade 8",
  assignment_id: aid, assignment_title: "Rounding check", attempt_number: n, started_at: "2026-11-18T09:00:00Z", ended_at: null,
  state: "in_progress", answered: 2, question_budget: 8, ...extra,
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("student history", () => {
  it("lists checks with attempt numbers and a resume link only for unfinished ones", async () => {
    vi.mocked(classesClient.studentHistory).mockResolvedValue([
      entry(2),
      entry(1, { state: "submitted", ended_at: "2026-11-18T09:10:00Z", answered: 4 }),
      entry(3, { assignment_id: null, assignment_title: null, attempt_number: null, state: "submitted", ended_at: "2026-11-18T08:00:00Z" }),
    ]);
    const view = render(<StudentHistory />);
    const resumes = await screen.findAllByRole("link", { name: /^Resume/ });
    expect(resumes).toHaveLength(1);
    expect(resumes[0].getAttribute("href")).toBe(`/student/diagnostic/U1?session=77777777-7777-4777-8777-777777777772&assignment=${aid}`);
    expect(screen.getByText("· Attempt 2")).toBeTruthy();
    expect(screen.getByText("Submitted · 4 questions answered")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Rounding" })).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/diagnos|misconception|%|score|review/i);
  });

  it("has empty, retry and sign-in states", async () => {
    vi.mocked(classesClient.studentHistory).mockResolvedValueOnce([]);
    const view = render(<StudentHistory />);
    expect(await screen.findByText("No checks yet")).toBeTruthy();
    view.unmount();
    vi.mocked(classesClient.studentHistory).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([entry(1)]);
    const second = render(<StudentHistory />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("· Attempt 1")).toBeTruthy();
    second.unmount();
    vi.mocked(classesClient.studentHistory).mockRejectedValue(new ClassesError("authentication_required"));
    render(<StudentHistory />);
    expect((await screen.findByRole("link", { name: "Log in" })).getAttribute("href")).toBe("/auth/sign-in?next=%2Fstudent%2Fhistory");
  });
});
