import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { assignments: vi.fn(), teacherUnits: vi.fn(), createAssignment: vi.fn(), setAssignmentStatus: vi.fn() },
}));
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { TeacherAssignment, TeacherClass } from "@/lib/classes/types";
import { ClassAssignments } from "./ClassAssignments";

const classId = "11111111-1111-4111-8111-111111111111";
const room: TeacherClass = {
  class_id: classId, name: "Grade 8 Blue", note: "", join_code: "ABCDEFGHJK", grade_level: 8,
  status: "active", student_count: 2, created_at: "2026-11-18T09:00:00.000Z",
};
const item: TeacherAssignment = {
  assignment_id: "55555555-5555-4555-8555-555555555555", class_id: classId, title: "Rounding check", unit_code: "U1",
  unit_name: "Rounding", version_code: "Maths_v2-U1-dev", status: "open", attempt_rule: "single", created_at: "2026-11-18T10:00:00.000Z",
};
beforeEach(() => {
  vi.mocked(classesClient.assignments).mockResolvedValue([]);
  vi.mocked(classesClient.teacherUnits).mockResolvedValue([{ unit_id: "U1", name: "Rounding" }, { unit_id: "U2", name: "Conversion" }]);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("class assignments", () => {
  it("lists assignments with their rule and status", async () => {
    vi.mocked(classesClient.assignments).mockResolvedValue([item, { ...item, assignment_id: "66666666-6666-4666-8666-666666666666", title: "Old", status: "closed", attempt_rule: "repeat" }]);
    render(<ClassAssignments room={room} />);
    expect(await screen.findByText("Rounding check")).toBeTruthy();
    expect(screen.getByText("Rounding · One attempt · Open")).toBeTruthy();
    expect(screen.getByText("Rounding · Repeat attempts · Closed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeTruthy();
  });

  it("assigns a chosen topic with the unit name as the default title", async () => {
    vi.mocked(classesClient.createAssignment).mockResolvedValue({ ...item, unit_code: "U2", unit_name: "Conversion", title: "Conversion", attempt_rule: "repeat" });
    render(<ClassAssignments room={room} />);
    expect(await screen.findByText("Nothing has been assigned to this class yet.")).toBeTruthy();
    const assign = await screen.findByRole("button", { name: "Assign" });
    expect((assign as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "U2" } });
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Conversion");
    fireEvent.click(screen.getByLabelText(/Repeat attempts/));
    fireEvent.click(assign);
    expect(await screen.findByText("Conversion is assigned.")).toBeTruthy();
    expect(classesClient.createAssignment).toHaveBeenCalledWith(classId, { unit_id: "U2", title: "Conversion", attempt_rule: "repeat" });
    expect(screen.getByText("Conversion · Repeat attempts · Open")).toBeTruthy();
  });

  it("explains refusals from the server", async () => {
    vi.mocked(classesClient.createAssignment).mockRejectedValue(new ClassesError("assignments_unavailable"));
    render(<ClassAssignments room={room} />);
    fireEvent.change(await screen.findByLabelText("Topic"), { target: { value: "U1" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Diagnostics are not running");
  });

  it("closes an assignment", async () => {
    vi.mocked(classesClient.assignments).mockResolvedValue([item]);
    vi.mocked(classesClient.setAssignmentStatus).mockResolvedValue({ ...item, status: "closed" });
    render(<ClassAssignments room={room} />);
    const row = (await screen.findByText("Rounding check")).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Close" }));
    expect(await screen.findByText(/is closed\. Students no longer see it/)).toBeTruthy();
    expect(classesClient.setAssignmentStatus).toHaveBeenCalledWith(classId, item.assignment_id, "closed");
    expect(within(row).getByRole("button", { name: "Reopen" })).toBeTruthy();
  });

  it("does not offer the form for an archived class", async () => {
    render(<ClassAssignments room={{ ...room, status: "archived" }} />);
    expect(await screen.findByText("Restore the class to assign more work.")).toBeTruthy();
    expect(screen.queryByLabelText("Topic")).toBeNull();
    expect(classesClient.teacherUnits).not.toHaveBeenCalled();
  });

  it("retries when topics or assignments cannot be loaded", async () => {
    vi.mocked(classesClient.teacherUnits).mockReset().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{ unit_id: "U1", name: "Rounding" }]);
    vi.mocked(classesClient.assignments).mockReset().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([item]);
    render(<ClassAssignments room={room} />);
    const retries = await screen.findAllByRole("button", { name: "Retry" });
    expect(retries).toHaveLength(2);
    retries.forEach((button) => fireEvent.click(button));
    expect(await screen.findByText("Rounding check")).toBeTruthy();
    expect(await screen.findByLabelText("Topic")).toBeTruthy();
  });
});
