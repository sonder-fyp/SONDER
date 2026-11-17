import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { assignments: vi.fn() },
}));
vi.mock("@/lib/teacher/client", () => ({ teacherClient: { activity: vi.fn() } }));
import { classesClient } from "@/lib/classes/client";
import { teacherClient } from "@/lib/teacher/client";
import { parseActivityRow } from "@/lib/teacher/activity";
import type { TeacherAssignment, TeacherClass } from "@/lib/classes/types";
import { ClassActivity } from "./ClassActivity";

const classId = "11111111-1111-4111-8111-111111111111";
const room: TeacherClass = { class_id: classId, name: "Grade 8", note: "", join_code: "ABCDEFGHJK", grade_level: 8,
  status: "active", student_count: 3, created_at: "2026-11-18T09:00:00.000Z" };
const assignment: TeacherAssignment = { assignment_id: "55555555-5555-4555-8555-555555555555", class_id: classId, title: "Rounding",
  unit_code: "U1", unit_name: "Rounding", version_code: "v", status: "closed", attempt_rule: "single", created_at: "2026-11-18T09:00:00.000Z" };
const sid = "77777777-7777-4777-8777-777777777777";
const row = (name: string, extra: Record<string, unknown> = {}) => parseActivityRow({
  student_id: `33333333-3333-4333-8333-${String(name.charCodeAt(0)).padStart(12, "0")}`, student_name: name,
  assignment_id: assignment.assignment_id, assignment_title: "Rounding", unit_code: "U1", attempt_rule: "single",
  state: "not_started", session_id: null, answered: 0, question_budget: null, attempts: 0, last_activity: null, review_status: null, ...extra,
});
const rows = [
  row("Ana"),
  row("Ben", { state: "in_progress", session_id: sid, answered: 2, question_budget: 8, attempts: 1, last_activity: "2026-11-18T10:00:00Z" }),
  row("Cyrus", { state: "completed", session_id: sid, answered: 4, question_budget: 8, attempts: 1, last_activity: "2026-11-18T11:00:00Z",
    review_status: "follow_up_required" }),
];
beforeEach(() => {
  vi.mocked(classesClient.assignments).mockResolvedValue([assignment]);
  vi.mocked(teacherClient.activity).mockResolvedValue(rows);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const count = (label: string) => screen.getByRole("button", { name: new RegExp(`${label}$`) });

describe("class activity", () => {
  it("shows counts and narrows the table to exactly the counted rows", async () => {
    render(<ClassActivity room={room} />);
    expect((await screen.findByRole("button", { name: /Assigned$/ })).textContent).toBe("3Assigned");
    expect(count("Follow-up required").textContent).toBe("1Follow-up required");
    expect(screen.getAllByRole("row")).toHaveLength(4);
    fireEvent.click(count("Not started"));
    expect(count("Not started").getAttribute("aria-pressed")).toBe("true");
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(1);
    expect(bodyRows[0].textContent).toContain("Ana");
  });

  it("lists rows by latest activity with status, review and an evidence link", async () => {
    render(<ClassActivity room={room} />);
    const bodyRows = (await screen.findAllByRole("row")).slice(1);
    expect(bodyRows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["Cyrus", "Ben", "Ana"]);
    expect(bodyRows[1].textContent).toContain("In progress · 2 of 8");
    expect(bodyRows[0].textContent).toContain("Follow-up required");
    expect(within(bodyRows[0]).getByRole("link", { name: "Evidence for Cyrus, Rounding" }).getAttribute("href")).toBe(`/teacher/sessions/${sid}`);
    expect(within(bodyRows[2]).queryByRole("link")).toBeNull();
  });

  it("explains every count and asks for one assignment when chosen", async () => {
    render(<ClassActivity room={room} />);
    expect(await screen.findByText(/Completed, and you have not reviewed the latest attempt/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Assignment"), { target: { value: assignment.assignment_id } });
    await vi.waitFor(() => expect(teacherClient.activity).toHaveBeenLastCalledWith(classId, assignment.assignment_id));
    expect(screen.getByRole("option", { name: "Rounding (closed)" })).toBeTruthy();
  });

  it("has empty and retry states", async () => {
    vi.mocked(teacherClient.activity).mockResolvedValueOnce([]);
    const view = render(<ClassActivity room={room} />);
    expect(await screen.findByText(/No students have joined yet/)).toBeTruthy();
    view.unmount();
    vi.mocked(teacherClient.activity).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(rows);
    render(<ClassActivity room={room} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Cyrus")).toBeTruthy();
  });
});
