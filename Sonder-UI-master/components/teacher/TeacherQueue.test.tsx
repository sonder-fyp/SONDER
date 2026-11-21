import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/teacher/client", async (original) => ({
  ...(await original<typeof import("@/lib/teacher/client")>()),
  teacherClient: { queue: vi.fn() },
}));
import { teacherClient, TeacherError } from "@/lib/teacher/client";
import { parseQueueRow } from "@/lib/teacher/queue";
import { TeacherQueue } from "./TeacherQueue";

const row = (n: number, extra: Record<string, unknown> = {}) => parseQueueRow({
  session_id: `77777777-7777-4777-8777-77777777777${n}`, class_id: "11111111-1111-4111-8111-111111111111", class_name: "Grade 8",
  student_name: `Student ${n}`, assignment_id: "55555555-5555-4555-8555-555555555555", assignment_title: `Check ${n}`, unit_code: "U1",
  ended_at: `2026-11-1${n}T10:00:00Z`, review_status: null, ...extra,
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("teacher queue", () => {
  it("groups checks by what the teacher must do, with counts and links", async () => {
    vi.mocked(teacherClient.queue).mockResolvedValue([
      row(1), row(2), row(3, { review_status: "follow_up_required" }), row(4, { assignment_id: null, assignment_title: null }),
    ]);
    const view = render(<TeacherQueue />);
    expect(await screen.findByRole("heading", { name: "Needs review (3)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Follow-up required (1)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Waiting for you" })).toBeTruthy();
    const other = screen.getByRole("link", { name: "Open evidence: Student 4, other check" });
    expect(other.getAttribute("href")).toBe("/teacher/sessions/77777777-7777-4777-8777-777777777774");
    expect(within(other.closest("li") as HTMLElement).getByText(/Grade 8 · Other check · U1 · finished/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open evidence: Student 1, Check 1" })).toBeTruthy();
    expect(view.container.textContent).not.toContain("MATH-");
  });

  it("says when nothing is waiting", async () => {
    vi.mocked(teacherClient.queue).mockResolvedValue([]);
    render(<TeacherQueue />);
    expect(await screen.findByText("Nothing is waiting for you. Finished checks appear here until you review them.")).toBeTruthy();
  });

  it("offers Retry after a failure", async () => {
    vi.mocked(teacherClient.queue).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([row(1)]);
    render(<TeacherQueue />);
    expect((await screen.findByRole("alert")).textContent).toContain("We could not load checks waiting for you.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Student 1")).toBeTruthy();
  });

  it("asks to sign in again when the session ended", async () => {
    vi.mocked(teacherClient.queue).mockRejectedValue(new TeacherError("authentication_required"));
    render(<TeacherQueue />);
    expect((await screen.findByRole("link", { name: "Log in" })).getAttribute("href")).toBe("/auth/sign-in?next=%2Fteacher");
  });
});
