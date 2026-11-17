import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/classes/client", async (original) => ({
  ...(await original<typeof import("@/lib/classes/client")>()),
  classesClient: { teacherClass: vi.fn(), roster: vi.fn(), removeStudent: vi.fn(), newJoinCode: vi.fn(), setClassStatus: vi.fn() },
}));
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { RosterStudent, TeacherClass } from "@/lib/classes/types";
import { TeacherClassDetail } from "./TeacherClassDetail";

const id = "11111111-1111-4111-8111-111111111111";
const room: TeacherClass = {
  class_id: id, name: "Grade 8 Blue", note: "Morning group", join_code: "ABCDEFGHJK",
  grade_level: 8, status: "active", student_count: 2, created_at: "2026-11-18T09:00:00.000Z",
};
const ali: RosterStudent = { student_id: "33333333-3333-4333-8333-333333333333", display_name: "Ali", joined_at: "2026-11-18T10:00:00.000Z" };
const sara: RosterStudent = { student_id: "44444444-4444-4444-8444-444444444444", display_name: "Sara", joined_at: "2026-11-18T11:00:00.000Z" };
beforeEach(() => { vi.mocked(classesClient.roster).mockResolvedValue([ali, sara]); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("teacher class detail", () => {
  it("shows the class, its join code and its students, and copies the code", async () => {
    vi.mocked(classesClient.teacherClass).mockResolvedValue(room);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<TeacherClassDetail classId={id} />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Grade 8 Blue");
    expect(classesClient.teacherClass).toHaveBeenCalledWith(id);
    expect(screen.getByText("ABCDEFGHJK")).toBeTruthy();
    expect(await screen.findByText("Ali")).toBeTruthy();
    expect(screen.getByText("2 joined")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith("ABCDEFGHJK");
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("says when copying is not possible", async () => {
    vi.mocked(classesClient.teacherClass).mockResolvedValue(room);
    vi.stubGlobal("navigator", {});
    render(<TeacherClassDetail classId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy code" }));
    expect(await screen.findByText(/Copy failed/)).toBeTruthy();
  });

  it("removes a student only after confirming", async () => {
    vi.mocked(classesClient.teacherClass).mockResolvedValue(room);
    vi.mocked(classesClient.removeStudent).mockResolvedValue(undefined);
    render(<TeacherClassDetail classId={id} />);
    const row = (await screen.findByText("Ali")).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
    expect(classesClient.removeStudent).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "Remove Ali" }));
    expect(await screen.findByText("Ali was removed from the class.")).toBeTruthy();
    expect(classesClient.removeStudent).toHaveBeenCalledWith(id, ali.student_id);
    expect(screen.queryByRole("button", { name: "Remove Ali" })).toBeNull();
    expect(screen.getByText("Sara")).toBeTruthy();
  });

  it("issues a new code after confirming and shows it", async () => {
    vi.mocked(classesClient.teacherClass).mockResolvedValue(room);
    vi.mocked(classesClient.newJoinCode).mockResolvedValue({ ...room, join_code: "ZXCVBNMQWE" });
    render(<TeacherClassDetail classId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Issue a new code" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(classesClient.newJoinCode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Issue a new code" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace code" }));
    expect(await screen.findByText("ZXCVBNMQWE")).toBeTruthy();
    expect(screen.queryByText("ABCDEFGHJK")).toBeNull();
    expect(screen.getByText(/old code no longer works/)).toBeTruthy();
  });

  it("archives after confirming, hides the code and can restore", async () => {
    vi.mocked(classesClient.teacherClass).mockResolvedValue(room);
    vi.mocked(classesClient.setClassStatus)
      .mockResolvedValueOnce({ ...room, status: "archived" })
      .mockResolvedValueOnce(room);
    render(<TeacherClassDetail classId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Archive class" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByText(/This class is archived/)).toBeTruthy();
    expect(screen.queryByText("ABCDEFGHJK")).toBeNull();
    expect(classesClient.setClassStatus).toHaveBeenLastCalledWith(id, "archived");
    fireEvent.click(screen.getByRole("button", { name: "Restore class" }));
    expect(await screen.findByText("ABCDEFGHJK")).toBeTruthy();
    expect(classesClient.setClassStatus).toHaveBeenLastCalledWith(id, "active");
  });

  it("shows an empty roster and a roster load failure", async () => {
    vi.mocked(classesClient.teacherClass).mockResolvedValue(room);
    vi.mocked(classesClient.roster).mockResolvedValueOnce([]);
    const view = render(<TeacherClassDetail classId={id} />);
    expect(await screen.findByText(/No students have joined yet/)).toBeTruthy();
    view.unmount();
    vi.mocked(classesClient.roster).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([ali]);
    render(<TeacherClassDetail classId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Ali")).toBeTruthy();
  });

  it("says not found for another teacher's or an unknown class", async () => {
    vi.mocked(classesClient.teacherClass).mockRejectedValue(new ClassesError("class_not_found"));
    render(<TeacherClassDetail classId={id} />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Class not found");
    expect(screen.queryByText("ABCDEFGHJK")).toBeNull();
    expect(classesClient.roster).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "All classes" }).getAttribute("href")).toBe("/teacher/classes");
  });

  it("retries other failures", async () => {
    vi.mocked(classesClient.teacherClass).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(room);
    render(<TeacherClassDetail classId={id} />);
    expect((await screen.findByRole("alert")).textContent).toContain("could not load");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("ABCDEFGHJK")).toBeTruthy();
  });
});
