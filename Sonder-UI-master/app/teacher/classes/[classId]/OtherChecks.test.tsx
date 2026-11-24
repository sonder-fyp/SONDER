import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/teacher/client", async (original) => ({
  ...(await original<typeof import("@/lib/teacher/client")>()),
  teacherClient: { otherChecks: vi.fn() },
}));
import { teacherClient } from "@/lib/teacher/client";
import type { TeacherClass } from "@/lib/classes/types";
import { parseOtherCheck } from "@/lib/teacher/otherChecks";
import { OtherChecks } from "./OtherChecks";

const room: TeacherClass = {
  class_id: "11111111-1111-4111-8111-111111111111", name: "Grade 8", note: "", join_code: "ABCDEFGHJK",
  grade_level: 8, status: "active", student_count: 2, created_at: "2026-11-18T09:00:00.000Z",
};
const check = (n: number, extra: Record<string, unknown> = {}) => parseOtherCheck({
  session_id: `77777777-7777-4777-8777-77777777777${n}`, student_name: `Student ${n}`, unit_code: "U1", unit_name: "Rounding",
  state: "completed", answered: 4, question_budget: 8, started_at: "2026-11-18T09:00:00Z", ended_at: "2026-11-18T09:10:00Z",
  review_status: null, ...extra,
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("other checks", () => {
  it("renders nothing when there are none", async () => {
    vi.mocked(teacherClient.otherChecks).mockResolvedValue([]);
    const view = render(<OtherChecks room={room} />);
    await vi.waitFor(() => expect(teacherClient.otherChecks).toHaveBeenCalledWith(room.class_id));
    expect(view.container.textContent).toBe("");
  });

  it("lists the checks with status, review and an evidence link", async () => {
    vi.mocked(teacherClient.otherChecks).mockResolvedValue([
      check(1), check(2, { state: "in_progress", ended_at: null, answered: 2 }), check(3, { review_status: "follow_up_required" }),
    ]);
    render(<OtherChecks room={room} />);
    expect(await screen.findByRole("heading", { name: "Other checks" })).toBeTruthy();
    expect(screen.getByText(/They are not counted in Activity/)).toBeTruthy();
    expect(screen.getByText("In progress · 2 of 8")).toBeTruthy();
    expect(screen.getByText("Not reviewed")).toBeTruthy();
    expect(screen.getByText("Follow-up required")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Evidence for Student 1, other check" }).getAttribute("href"))
      .toBe("/teacher/sessions/77777777-7777-4777-8777-777777777771");
  });

  it("offers Retry after a failure", async () => {
    vi.mocked(teacherClient.otherChecks).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([check(1)]);
    render(<OtherChecks room={room} />);
    expect((await screen.findByRole("alert")).textContent).toContain("We could not load other checks.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Student 1")).toBeTruthy();
  });
});
